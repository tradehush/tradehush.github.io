"use strict";
// Survival systems on top of the core game: the car, your base and its structures, food, fishing.

// --- the car ------------------------------------------------------------------------

const CAR_R = 34;

function makeCar() {
  const s = World.carStart || World.start;
  return { x: s.x, y: s.y, a: s.a || 0, v: 0, steer: 0, fuel: 0, engine: false, hp: 100, map: "forest", trunk: true };
}
function carHere() { return G.car && G.car.map === World.map; }

function carInteract() {
  const c = G.car, p = G.p;
  if (c.trunk) { c.trunk = false; addItem("cloth", 2); addItem("battery", 1); addItem("bandage", 1); Sound.pickup(); toast("В багажнике: тряпки, батарейка, бинт.", 3); return; }
  if (!c.engine) {
    if (G.inv.engine > 0) { G.inv.engine--; c.engine = true; c.hp = 100; Sound.craft(); toast("Двигатель установлен!", 3); tip("fuel", "Теперь нужен бензин. Канистры — на заправке и в ящиках, или сделай на верстаке.", "⛽"); }
    else { toast("Двигатель мёртв. Нужен новый двигатель.", 2.5); tip("engine", "Двигатель есть в автомастерской на юго-западе. Или собери: 4 запчасти + 6 металлолома на верстаке. Запчасти — в разбитых машинах.", "🔧"); }
    return;
  }
  if (c.fuel < 1) {
    if (G.inv.fuel > 0) { G.inv.fuel--; c.fuel = Math.min(100, c.fuel + 40); Sound.pickup(); toast(`Залито 40 л. Бак: ${c.fuel | 0}`, 2.5); }
    else toast("Бак пуст. Нужна канистра бензина.", 2.5);
    return;
  }
  if (G.inv.fuel > 0 && c.fuel < 60) { G.inv.fuel--; c.fuel = Math.min(100, c.fuel + 40); toast(`Залито 40 л. Бак: ${c.fuel | 0}`, 2); }
  enterCar();
}

function enterCar() {
  G.drive = true; cancelPlace(); G.fishing = null;
  G.p.a = G.car.a; G.p.pitch = 0;
  Sound.engineStart();
  tip("drive", Input.touch ? "Левый стик: вперёд/назад и поворот. ✋ — выйти из машины." : "W/S — газ и тормоз, A/D — руль, E — выйти.", Input.touch ? "✋" : "E");
}
function exitCar() {
  const c = G.car, p = G.p;
  G.drive = false; c.v = 0;
  // step out on the driver's side, or wherever there is room
  for (const side of [-1, 1, 2]) {
    const a = c.a + (side === 2 ? Math.PI : side * Math.PI / 2);
    p.x = c.x + Math.cos(a) * 52; p.y = c.y + Math.sin(a) * 52;
    const before = { x: p.x, y: p.y };
    collide(p);
    if (dist2(p.x, p.y, before.x, before.y) < 4) break;
  }
  Sound.engine(0, 0);
}

const _car = { x: 0, y: 0, r: CAR_R };
function driveCar(dt, inp) {
  const c = G.car, p = G.p;
  let throttle = clamp((inp.up - inp.down) - inp.mvY, -1, 1);
  const steer = clamp((inp.right - inp.left) + inp.mvX, -1, 1);
  if (c.fuel <= 0) { throttle = Math.min(0, throttle) * 0; if (!c.dryWarn) { c.dryWarn = true; toast("Бензин кончился", 2.5); } } else c.dryWarn = false;
  const onRoad = distToRoad(c.x, c.y) < 40, water = inSwamp(c.x, c.y);
  const max = onRoad ? 820 : water ? 180 : 520;
  if (throttle > 0) c.v += (c.v < 0 ? 900 : 430) * throttle * dt;
  else if (throttle < 0) c.v += (c.v > 0 ? -900 : -260) * -throttle * dt;
  c.v -= c.v * (onRoad ? 0.35 : water ? 2.5 : 0.9) * dt;
  c.v = clamp(c.v, -260, max);
  if (!throttle && Math.abs(c.v) < 6) c.v = 0;
  c.steer = lerp(c.steer, steer, Math.min(1, dt * 6));
  c.a += c.steer * dt * 2.1 * clamp(c.v / 260, -1, 1);
  const ox = c.x, oy = c.y;
  c.x += Math.cos(c.a) * c.v * dt; c.y += Math.sin(c.a) * c.v * dt;
  _car.x = c.x; _car.y = c.y; _car.hitBuild = null;
  collide(_car);
  const push = Math.hypot(_car.x - c.x, _car.y - c.y);
  c.x = _car.x; c.y = _car.y;
  if (push > 1.5 && Math.abs(c.v) > 120) {
    const hit = Math.abs(c.v);
    c.hp -= hit * 0.025; G.shake = Math.max(G.shake, hit / 50); Sound.carHit();
    if (hit > 450) hurt(hit * 0.02);
    if (_car.hitBuild) damageBuild(_car.hitBuild.build, hit * 0.3);
    c.v *= -0.25;
  }
  // run creatures over
  for (const m of G.mons) {
    if (m.dead) continue;
    const d = Math.hypot(m.x - c.x, m.y - c.y);
    if (d < CAR_R + m.r) {
      const sp = Math.abs(c.v);
      if (sp > 140 && !m.fake) {
        const ux = Math.cos(c.a) * Math.sign(c.v), uy = Math.sin(c.a) * Math.sign(c.v);
        damage(m, sp * (m.type === "boss" ? 0.04 : 0.16), ux * sp * 0.8, uy * sp * 0.8);
        c.v *= m.type === "brute" || m.type === "boss" ? 0.3 : 0.85; c.hp -= m.type === "brute" ? 6 : 2;
        Sound.carHit(); G.shake = Math.max(G.shake, 6);
      } else if (m.fake) vanish(m);
      else { const k = (CAR_R + m.r - d) / (d || 1); m.x += (m.x - c.x) * k; m.y += (m.y - c.y) * k; }
    }
  }
  c.fuel = Math.max(0, c.fuel - Math.hypot(c.x - ox, c.y - oy) * 0.0004);
  if (c.hp <= 0) { c.hp = 0; c.engine = false; toast("Двигатель заглох и задымился. Нужен новый.", 3.5); exitCar(); return; }
  p.x = c.x; p.y = c.y; p.a = c.a; p.vx = (c.x - ox) / dt; p.vy = (c.y - oy) / dt; p.moving = false;
  Sound.engine(1, Math.abs(c.v) / 820);
}

// --- base and structures -------------------------------------------------------------

const BDEF = Object.fromEntries(BUILDS.map(b => [b.k, b]));

function inBase(x, y) { return G.base && G.base.map === World.map && dist2(x, y, G.base.x, G.base.y) < BASE_R * BASE_R; }

function claimBase() {
  const h = G.inside;
  if (!h) { toast("Зайди в дом, который хочешь сделать базой.", 2.5); return; }
  G.base = { map: World.map, id: h.id, name: h.name, x: h.x + h.w / 2, y: h.y + h.h / 2 };
  Sound.craft(); toast(`${h.name} — теперь твоя база`, 3.5);
  tip("base", "Строй вокруг базы: заборы, стены, турели, прожекторы, грядки. Открой стройку и выбери, что поставить.", "🔨");
  save();
}

function buildRect(b) {
  const d = BDEF[b.k], w = b.rot ? d.h : d.w, h = b.rot ? d.w : d.h;
  return { x: b.x - w / 2, y: b.y - h / 2, w, h, build: b, gate: b.k === "gate", soft: !!d.soft, kind: "build" };
}

function markRectNav(R) {
  const c = World.ncell, pad = 9;
  for (let y = Math.max(0, Math.floor((R.y - pad) / c)); y <= Math.min(World.nh - 1, Math.floor((R.y + R.h + pad) / c)); y++)
    for (let x = Math.max(0, Math.floor((R.x - pad) / c)); x <= Math.min(World.nw - 1, Math.floor((R.x + R.w + pad) / c)); x++) {
      const px = x * c + c / 2, py = y * c + c / 2;
      if (px > R.x - pad && px < R.x + R.w + pad && py > R.y - pad && py < R.y + R.h + pad) World.nav[y * World.nw + x] = 1;
    }
}

function registerBuilds() {
  for (const b of G.builds) { b.R = buildRect(b); rectAdd(b.R); if (!b.R.soft) markRectNav(b.R); }
}

function removeBuild(b) {
  rectRemove(b.R);
  G.builds = G.builds.filter(x => x !== b);
  buildNav();
  for (const o of G.builds) if (!o.R.soft) markRectNav(o.R);
}

function damageBuild(b, dmg) {
  if (!b || !G.builds.includes(b)) return;
  b.hp -= dmg;
  spark(b.x, b.y, b.k === "wall" || b.k === "stove" ? "#999" : "#8a6a40", 4, 90);
  if (b.hp <= 0) { removeBuild(b); Sound.carHit(); toast(`${BDEF[b.k].n}: сломано!`, 2); }
}

function canAfford(need) { return has(need); }

function startPlace(k) {
  if (!G.base || G.base.map !== World.map) { toast("Сначала сделай дом базой.", 2.5); return; }
  G.place = { k, rot: 0, x: 0, y: 0, ok: false };
  tip("place", Input.touch ? "Повернись туда, где строить. ✔ — поставить, ⟲ — повернуть, ✕ — закончить." : "ЛКМ — поставить, R — повернуть, Esc — закончить.", Input.touch ? "✔" : "ЛКМ");
}

// hold ✋ on a build to pick it up; then put it elsewhere, or throw it away for half the materials back
function pickUpBuild(b) {
  if (G.place || !G.builds.includes(b)) return;
  removeBuild(b);
  G.place = { k: b.k, rot: b.rot, x: b.x, y: b.y, ok: false, move: b };
  Sound.chop();
  tip("carry", Input.touch ? "✔ — поставить здесь, ⟲ — повернуть, 🗑 — убрать совсем, ✕ — вернуть на место." : "ЛКМ — поставить, R — повернуть, Delete — убрать совсем, Esc — вернуть на место.", Input.touch ? "✔" : "ЛКМ");
}
function cancelPlace() {
  const pl = G.place;
  G.place = null;
  if (pl && pl.move) { const b = pl.move; b.R = buildRect(b); rectAdd(b.R); if (!b.R.soft) markRectNav(b.R); G.builds.push(b); }
}
function trashCarried() {
  const pl = G.place;
  if (!pl || !pl.move) return;
  const d = BDEF[pl.k];
  for (const k in d.need) if (Math.floor(d.need[k] / 2) > 0) addItem(k, Math.floor(d.need[k] / 2), true);
  G.place = null; Sound.chop(); toast(`${d.n} убран`, 1.5);
}

function updatePlacement() {
  const pl = G.place, p = G.p, d = BDEF[pl.k];
  pl.x = Math.round((p.x + Math.cos(p.a) * 90) / 10) * 10;
  pl.y = Math.round((p.y + Math.sin(p.a) * 90) / 10) * 10;
  const R = buildRect(pl);
  const paid = !!pl.move;
  let ok = inBase(pl.x, pl.y) && (paid || canAfford(d.need));
  if (ok) for (const o of rectsIn(R.x, R.y, R.x + R.w, R.y + R.h)) if (!(R.x + R.w <= o.x || R.x >= o.x + o.w || R.y + R.h <= o.y || R.y >= o.y + o.h)) { ok = false; break; }
  if (ok) for (const o of gridQuery(pl.x, pl.y, 60)) if (o.block && circleRect(o.x, o.y, o.r, R)) { ok = false; break; }
  if (ok && inSwamp(pl.x, pl.y)) ok = false;
  if (ok && !d.soft && circleRect(p.x, p.y, p.r + 2, R)) ok = false;
  pl.ok = ok;
  pl.why = !inBase(pl.x, pl.y) ? "далеко от базы" : !paid && !canAfford(d.need) ? "не хватает ресурсов" : ok ? "" : "мешает";
}

function placeBuild() {
  const pl = G.place;
  if (!pl) return;
  if (!pl.ok) { toast(pl.why ? "Нельзя: " + pl.why : "Нельзя поставить здесь", 1.5); Sound.click(); return; }
  const d = BDEF[pl.k];
  if (pl.move) {
    const b = pl.move; b.x = pl.x; b.y = pl.y; b.rot = pl.rot;
    b.R = buildRect(b); rectAdd(b.R); if (!b.R.soft) markRectNav(b.R);
    G.builds.push(b); G.place = null; Sound.chop();
    return;
  }
  take(d.need);
  const b = { k: pl.k, x: pl.x, y: pl.y, rot: pl.rot, hp: d.hp, ammo: 0 };
  b.R = buildRect(b); rectAdd(b.R); if (!b.R.soft) markRectNav(b.R);
  G.builds.push(b);
  Sound.chop(); Sound.craft();
  tip("move", `Постройку можно переставить или убрать: держи ${Input.touch ? "✋" : "E"} на ней.`, Input.touch ? "✋" : "E");
  if (!canAfford(d.need)) { G.place = null; toast("Ресурсы кончились", 1.5); }
}

function buildLabel(b) {
  const d = BDEF[b.k];
  if (b.k === "turret") return `Зарядить турель (${b.ammo}) · держи — переставить`;
  if (b.k === "garden") return !b.plant ? "Посадить семена" : b.grow >= 1 ? "Собрать урожай" : `Растёт… ${Math.floor((b.grow || 0) * 100)}%`;
  if (b.k === "stove") return "Печь — готовить";
  if (b.k === "bed") return G.night > 0.45 ? "Спать до утра (сохранение)" : "Сохранить игру";
  if (b.k === "bench") return "Верстак — крафт";
  if (b.k === "light") return "Прожектор";
  return `${d.n}: держи — переставить или убрать`;
}
const BUILD_HOLD = 0.6;

function buildUse(b) {
  if (b.k === "turret") {
    const n = Math.min(G.inv.ammo9 || 0, 60 - b.ammo);
    if (n <= 0) { toast(b.ammo >= 60 ? "Турель полная" : "Нет патронов 9мм", 1.8); return; }
    G.inv.ammo9 -= n; b.ammo += n; Sound.reload(); toast(`Турель заряжена: ${b.ammo}`, 1.8);
  } else if (b.k === "garden") {
    if (!b.plant) { if (!(G.inv.seeds > 0)) { toast("Нужны семена", 1.8); tip("seeds", "Семена бывают в домах, ящиках и на ферме.", "🌱"); return; } G.inv.seeds--; b.plant = true; b.grow = 0; Sound.pickup(); toast("Посажено", 1.5); }
    else if (b.grow >= 1) { addItem("veg", 2 + (Math.random() < 0.5 ? 1 : 0)); if (Math.random() < 0.6) addItem("seeds", 1); b.plant = false; b.grow = 0; Sound.pickup(); }
    else toast("Ещё не выросло", 1.2);
  } else if (b.k === "stove" || b.k === "bench") UI.openInv();
  else if (b.k === "bed") sleep();
  else toast(`Держи ${Input.touch ? "✋" : "E"}, чтобы переставить или убрать`, 1.6);
}


function updateBuilds(dt) {
  for (const b of G.builds) {
    if (b.k === "turret" && b.ammo > 0) {
      b.cd = (b.cd || 0) - dt;
      let best = null, bd = 520 * 520;
      for (const m of G.mons) { if (m.dead || m.fake) continue; const d = dist2(m.x, m.y, b.x, b.y); if (d < bd && !wallBetween(b.x, b.y, m.x, m.y)) { bd = d; best = m; } }
      if (best) {
        b.aim = Math.atan2(best.y - b.y, best.x - b.x);
        if (b.cd <= 0) {
          b.cd = 0.45; b.ammo--; b.flash = 0.06;
          damage(best, 16, Math.cos(b.aim) * 60, Math.sin(b.aim) * 60);
          G.tracers.push({ x1: b.x, y1: b.y, x2: best.x, y2: best.y, life: 0.08, h: 30 });
          Sound.turret(dist2(b.x, b.y, G.p.x, G.p.y)); makeNoise(b.x, b.y, 500);
        }
      }
    }
    if (b.flash > 0) b.flash -= dt;
    if (b.k === "spikes") for (const m of G.mons) {
      if (m.dead || m.fake || m.type === "boss") continue;
      const R = b.R;
      if (m.x + m.r > R.x && m.x - m.r < R.x + R.w && m.y + m.r > R.y && m.y - m.r < R.y + R.h) { damage(m, 28 * dt, 0, 0, true); m.slowT = 0.2; b.hp -= 3 * dt; if (b.hp <= 0) { removeBuild(b); break; } }
    }
    if (b.k === "garden" && b.plant && b.grow < 1) b.grow = Math.min(1, (b.grow || 0) + dt / (DAY_LEN * 0.4));
  }
}

function buildNear(x, y, r) {
  let best = null, bd = r * r;
  for (const b of G.builds) { const d = dist2(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
  return best;
}

// --- food and fishing ----------------------------------------------------------------

function eat(k) {
  const it = ITEMS[k], p = G.p;
  if (!it || !it.food || !(G.inv[k] > 0)) return false;
  if (p.food >= 99) { toast("Ты сыт", 1.2); return false; }
  G.inv[k]--; p.food = Math.min(100, p.food + it.food); if (it.hp) p.hp = Math.min(100, p.hp + it.hp);
  Sound.pickup(); toast(`Съедено: ${it.n}`, 1.5);
  return true;
}
function quickEat() {
  const order = ["stew", "fishcooked", "canned", "veg", "berries", "fish"];
  for (const k of order) if (G.inv[k] > 0) return eat(k);
  toast("Нечего есть", 1.5);
  return false;
}

function waterSpot() {
  const p = G.p;
  for (const s of World.swamp) {
    const d = Math.hypot(s.x - p.x, s.y - p.y) - s.r;
    if (d > -15 && d < 90) {
      const a = Math.atan2(s.y - p.y, s.x - p.x);
      if (Math.abs(angDiff(p.a, a)) < 1.0) {
        const reach = Math.min(d + 60, 160);
        return { x: p.x + Math.cos(p.a) * reach, y: p.y + Math.sin(p.a) * reach };
      }
    }
  }
  return null;
}

function startFishing(spot) {
  G.fishing = { x: spot.x, y: spot.y, t: 3 + Math.random() * 6, bite: 0 };
  Sound.splash();
  tip("fishing", Input.touch ? "Жди поклёвки. Когда появится «!» — сразу жми ✋." : "Жди поклёвки. Когда появится «!» — сразу жми E.", Input.touch ? "✋" : "E");
}

function updateFishing(dt, pressed, moving) {
  const f = G.fishing;
  if (moving) { G.fishing = null; return; }
  if (f.bite > 0) {
    f.bite -= dt;
    if (pressed) {
      G.fishing = null;
      const r = Math.random();
      if (G.night > 0.6 && r < 0.06) { screamer("lake"); const m = spawnMonster("crawler", f.x, f.y); m.aggro = 9; toast("Из воды тянется рука…", 2.5); return; }
      if (r < 0.8) addItem("fish", 1);
      else if (r < 0.88) { addItem("scrap", 1); toast("Старый ботинок…", 1.5); }
      else if (r < 0.94) addItem("spirit", 1);
      else addItem("ammo9", 3);
      Sound.splash();
      return;
    }
    if (f.bite <= 0) { G.fishing = null; toast("Сорвалась", 1.5); }
  } else {
    f.t -= dt;
    if (f.t <= 0) { f.bite = 1.1; Sound.bite(); }
  }
}

// --- airdrops: every third day a crate comes down on a parachute ---------------------

function launchAirdrop() {
  const center = G.base && G.base.map === "forest" ? G.base : G.p;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, d = 1800 + Math.random() * 1800;
    const x = clamp(center.x + Math.cos(a) * d, 400, World.W - 400), y = clamp(center.y + Math.sin(a) * d, 400, World.H - 400);
    if (World.map === "forest") {
      const ci = Math.floor(y / World.ncell) * World.nw + Math.floor(x / World.ncell);
      if (World.nav[ci] || inSwamp(x, y) || insideHouse(x, y, 80)) continue;
    }
    G.drop = { x, y, h: 1500, landed: false, looted: false, day: G.day };
    break;
  }
  if (!G.drop) return;
  Sound.plane();
  toast("✈ Слышен самолёт… сброшен груз!", 4);
  tip("airdrop", "Аирдроп! Стрелка у часов показывает, где он упадёт. Красный дым видно издалека. Возле груза могут ждать твари.", "✈");
}

function placeDropCrate() {
  if (World.map !== "forest" || !G.drop || G.drop.looted) return;
  if (World.inter.some(o => o.type === "airdrop")) return;
  inter({ type: "airdrop", x: G.drop.x, y: G.drop.y, r: 56 });
}

function updateAirdrop(dt) {
  if (G.day >= G.nextDrop && G.t > 12 / 24 && World.map === "forest") { G.nextDrop = G.day + 3; launchAirdrop(); }
  const d = G.drop;
  if (!d || d.looted) return;
  if (!d.landed) {
    d.h -= dt * 60;
    if (d.h <= 0) {
      d.h = 0; d.landed = true;
      placeDropCrate();
      if (World.map === "forest" && dist2(G.p.x, G.p.y, d.x, d.y) < 1400 * 1400) Sound.carHit();
      // something smelled it too
      for (let i = 0; i < 2 + Math.floor(G.day / 3); i++) { const s = freeSpot(d.x, d.y, 120, 300, false, false); if (s && World.map === "forest") { const m = spawnMonster(pickType(), s.x, s.y, { camp: true }); m.aggro = 0; } }
    }
  } else if (World.map === "forest" && Math.random() < dt * 25) {
    G.parts.push({ x: d.x + (Math.random() - 0.5) * 10, y: d.y + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 4, max: 4, col: Math.random() < 0.7 ? "#c02818" : "#e05030", size: 7, smoke: true });
  }
}

function openAirdrop(o) {
  o.taken = true; G.drop.looted = true;
  for (const [k, a, b, ch] of AIRDROP_LOOT) if (Math.random() < ch) addItem(k, a + Math.floor(Math.random() * (b - a + 1)));
  const missing = ["bat", "machete", "pistol", "shotgun", "crossbow"].filter(w => !G.owned.includes(w));
  if (missing.length && Math.random() < 0.5) { const w = missing[Math.floor(Math.random() * missing.length)]; giveWeapon(w); const W = WEAPONS[W_IDX[w]]; if (W.mag) G.mag[w] = W.mag; toast(`В аирдропе оружие: ${W.n}!`, 4); }
  Sound.craft(); G.shake = 4;
  save();
}

// --- night raids: once a night the forest comes for your base -----------------------

function updateRaid(dt) {
  if (!G.base || G.base.map !== World.map || World.indoor) return;
  const h = G.t * 24;
  if (h >= 0.5 && h < 3 && G.raidDay !== G.day) {
    G.raidDay = G.day;
    const n = 3 + G.day * 2;
    for (let i = 0; i < n; i++) {
      const s = freeSpot(G.base.x, G.base.y, 800, 1100, false, false);
      if (!s) continue;
      const m = spawnMonster(pickType(), s.x, s.y, { guard: true, raid: true });
      m.aggro = 99;
    }
    Sound.farScream(0); Sound.sting();
    toast("☠ Набег! Твари идут к базе", 4);
    tip("raid", "Каждую ночь твари приходят к базе. Заборы, колья, турели и свет помогут её удержать.", "🔨");
  }
}
