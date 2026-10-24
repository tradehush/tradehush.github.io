"use strict";
// Lights you can switch on (houses need a battery in the fuse box, dungeons a generator with fuel),
// and the things in houses that do something. Light is seen from far away: at night the creatures come to it.

function powerOf(sw) {
  const k = World.map + ":" + sw;
  return G.power[k] || (G.power[k] = { on: false, e: 0 });
}
function lightOn(l) { return !l.sw || powerOf(l.sw).on; }
function litLights() { return World.lights.filter(lightOn); }

// lights that were switched on draw the creatures: positions they walk to
function lureNear(x, y) {
  if (!World.indoor && G.night < 0.4) return null;
  const range = World.indoor ? 4000 : 2200;
  let best = null, bd = range * range;
  for (const l of World.lights) {
    if (!l.sw || !powerOf(l.sw).on) continue;
    const d = dist2(x, y, l.x, l.y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

function updatePower(dt) {
  for (const k in G.power) {
    const pw = G.power[k];
    if (!pw.on) continue;
    // a battery keeps a house lit for most of a day; a can of fuel runs the generator a bit less
    pw.e -= dt / (DAY_LEN * (k.endsWith(":gen") ? 0.45 : 0.7));
    if (pw.e <= 0) {
      pw.e = 0; pw.on = false;
      if (k.startsWith(World.map + ":")) { Sound.switchClick(); toast(k.endsWith(":gen") ? "Генератор заглох" : "Свет погас — села батарейка", 2.5); }
    }
  }
  // at night a lit house calls more of them out of the forest
  G.lureT = (G.lureT == null ? 30 : G.lureT) - dt;
  if (G.lureT <= 0) {
    G.lureT = 70 + Math.random() * 40;
    if (!World.indoor && G.night > 0.5) {
      const lit = World.lights.filter(l => l.sw && powerOf(l.sw).on);
      if (lit.length) {
        const l = lit[Math.floor(Math.random() * lit.length)];
        const n = 1;
        for (let i = 0; i < n; i++) { const s = freeSpot(l.x, l.y, 1100, 1500, false, false); if (s) spawnMonster(pickType(), s.x, s.y, { lured: true }); }
      }
    }
  }
}

function homeLabel(o) {
  switch (o.type) {
    case "switch": { const pw = powerOf(o.sw); return pw.on ? "Выключить свет" : pw.e > 0 ? "Включить свет" : "Включить свет (нужна 🔋)"; }
    case "generator": { const pw = powerOf("gen"); return pw.on ? "Выключить генератор" : pw.e > 0 ? "Запустить генератор" : "Запустить генератор (нужен ⛽)"; }
    case "fireplace": return nearHearth(o) ? "Камин горит" : "Разжечь камин (2 🪵)";
    case "sofa": return "Отдохнуть на диване";
    case "radio": return "Включить радио";
    case "fridge": return o.full ? "Открыть холодильник" : "Пустой холодильник";
    case "medcab": return o.full ? "Открыть аптечный шкафчик" : "Пустой шкафчик";
    case "bookcase": return o.day === G.day ? "Книги (уже читал сегодня)" : "Почитать книгу";
    case "tv": return "Включить телевизор";
    case "piano": return "Сыграть на пианино";
    case "mirror": return "Посмотреть в зеркало";
  }
  return "";
}

function nearHearth(o) { return G.fires.some(f => f.hearth && dist2(f.x, f.y, o.fx, o.fy) < 30 * 30); }

function homeUse(o) {
  const p = G.p;
  switch (o.type) {
    case "switch": case "generator": {
      const gen = o.type === "generator", pw = powerOf(gen ? "gen" : o.sw);
      if (pw.on) { pw.on = false; Sound.switchClick(); if (Net.guest) netSend({ t: "power", k: World.map + ":" + (gen ? "gen" : o.sw), on: false, e: pw.e }); return; }
      if (pw.e <= 0) {
        const need = gen ? "fuel" : "battery";
        if (!(G.inv[need] > 0)) { toast(gen ? "Нужен бензин ⛽" : "Щиток пуст — нужна батарейка 🔋", 2.2); Sound.click(); return; }
        G.inv[need]--; pw.e = 1;
      }
      pw.on = true;
      if (Net.guest) netSend({ t: "power", k: World.map + ":" + (gen ? "gen" : o.sw), on: true, e: pw.e });
      if (gen) {
        Sound.hum(); makeNoise(p.x, p.y, 4000);
        toast("Свет! Но теперь тебя слышат все…", 3);
        // everything down here wakes up and comes
        for (const m of G.mons) if (!m.fake) m.aggro = Math.max(m.aggro, 6);
        const n = 2 + Math.floor(G.day / 2);
        for (let i = 0; i < n; i++) { const s = freeSpot(p.x, p.y, 700, 1600, false, false); if (s) spawnMonster(pickType(), s.x, s.y, { aggro: 8 }); }
      } else {
        Sound.switchClick();
        tip("lure", "Свет в окнах видно издалека. Ночью твари идут на него.", "💡");
      }
      return;
    }
    case "fireplace": {
      if (nearHearth(o)) { toast("Тепло. Рассудок восстанавливается.", 1.6); return; }
      if (!(G.inv.wood >= 2)) { toast("Нужно 2 дерева", 1.6); return; }
      G.inv.wood -= 2; Sound.fire();
      if (Net.guest) netSend({ t: "fire", x: Math.round(o.fx), y: Math.round(o.fy), life: 300, h: 1 }); else G.fires.push({ x: o.fx, y: o.fy, life: 300, hearth: true });
      return;
    }
    case "sofa": {
      if (o.cd && o.cd > G.clock) { toast("Пока не хочется", 1.2); return; }
      o.cd = G.clock + 90; p.san = Math.min(100, p.san + 12); p.sta = 100; G.t += 0.5 / 24;
      Sound.breath(0); toast("Ты немного отдохнул. Прошло полчаса.", 2);
      return;
    }
    case "radio": {
      Sound.radio();
      if (G.night > 0.6 && Math.random() < 0.3) { setTimeout(() => Sound.whisper(), 900); p.san = Math.max(0, p.san - 5); toast("…сквозь шум кто-то шепчет твоё имя…", 3); return; }
      const d = G.drop;
      toast(d && !d.looted ? "«…груз сброшен… квадрат…» — 📦 отмечен на карте" : `«…следующий сброс через ${Math.max(1, G.nextDrop - G.day)} дн…»`, 3.5);
      return;
    }
    case "fridge": case "medcab": {
      if (!o.full) { toast("Пусто. Может, завтра…", 1.6); return; }
      o.full = false; Sound.pickup();
      if (G.night > 0.55 && Math.random() < 0.07) setTimeout(() => screamer("fridge"), 250);
      const loot = o.type === "fridge"
        ? [[{ canned: 1 + Math.floor(Math.random() * 2) }], [{ berries: 3 }], [{ veg: 2 }], [{ fish: 1, canned: 1 }]]
        : [[{ bandage: 2 }], [{ bandage: 1, tea: 1 }], [{ medkit: 1 }], [{ tea: 2 }]];
      const g = loot[Math.floor(Math.random() * loot.length)][0];
      for (const k in g) addItem(k, g[k]);
      return;
    }
    case "bookcase": {
      if (o.day === G.day) { toast("Ты уже читал сегодня", 1.4); return; }
      o.day = G.day; p.san = Math.min(100, p.san + 15); Sound.pickup();
      const r = Math.random();
      if (r < 0.15) { addItem("seeds", 2); toast("Между страниц — пакетик семян", 2); }
      else if (r < 0.28) { addItem("battery", 1); toast("За книгами спрятана батарейка", 2); }
      else toast(["Старый справочник грибника. Спокойнее.", "Детские сказки. Почему-то страшно.", "Дневник хозяйки обрывается на полуслове.", "Атлас леса: «к северу — река».", "Советы рыболову: рыба клюёт у моста."][Math.floor(Math.random() * 5)], 3);
      return;
    }
    case "tv": {
      Sound.tvStatic(); G.lightOff = Math.max(G.lightOff, 0.3);
      if (G.night > 0.5 && Math.random() < 0.35) { setTimeout(() => { if (G.state === "play") { G.scareCd = 0; screamer("tv"); } }, 1300); return; }
      toast(G.wx === "fog" ? "Помехи… «…туман рассеется к вечеру…»" : G.wx === "rain" ? "Помехи… «…штормовое предупреждение…»" : "Помехи… «…ясно, без осадков…»", 3);
      return;
    }
    case "piano": {
      Sound.piano(); p.san = Math.min(100, p.san + 8); makeNoise(p.x, p.y, 1400);
      tip("piano", "Музыку слышно далеко. Твари тоже слушают.", "🎹");
      return;
    }
    case "mirror": {
      if (G.night > 0.5 && Math.random() < 0.4) { p.san = Math.max(0, p.san - 6); G.scareCd = 0; screamer("mirror"); return; }
      toast(p.san < 40 ? "Отражение улыбается. Ты — нет." : "Ты выглядишь уставшим.", 2.2);
      return;
    }
  }
}

// fridges and cabinets fill up again over the days
function refillHomes() {
  for (const o of World.inter) if ((o.type === "fridge" || o.type === "medcab") && !o.full && Math.random() < 0.35) o.full = true;
}
