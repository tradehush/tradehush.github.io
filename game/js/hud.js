"use strict";
// 2D overlay on top of the 3D view: bars, hotbar, prompts, messages, screen effects, map.

const R = { cv: null, ctx: null, W: 0, H: 0, dpr: 1, time: 0 };

function initHud() {
  R.cv = document.getElementById("hud");
  R.ctx = R.cv.getContext("2d");
  resizeHud();
  addEventListener("resize", resizeHud);
}
function resizeHud() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.cv.width = Math.round(innerWidth * R.dpr); R.cv.height = Math.round(innerHeight * R.dpr);
  R.cv.style.width = innerWidth + "px"; R.cv.style.height = innerHeight + "px";
  R.W = R.cv.width; R.H = R.cv.height;
}

function renderHud(dt) {
  R.time += dt;
  const ctx = R.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, R.W, R.H);
  if (G.state === "title" || G.state === "intro") return;
  drawScreenFx(ctx);
  drawHUD(ctx);
  drawTip(ctx);
  if (!G.showMap) drawRun(ctx);
  if (G.showMap) drawMap(ctx);
  if (G.scare) drawScare(ctx);
  if (Input.touch && innerHeight > innerWidth && G.state === "play" && !G.showMap) {
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, R.H * 0.42, R.W, 44 * R.dpr);
    ctx.font = `bold ${14 * R.dpr}px ui-monospace, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#efe6c8";
    ctx.fillText("⟲ Поверни телефон горизонтально", R.W / 2, R.H * 0.42 + 22 * R.dpr); ctx.textAlign = "left";
  }
  if (!Input.touch && !Input.locked && G.state === "play" && !UI.modal && !G.showMap) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, R.H / 2 + 30 * R.dpr, R.W, 40 * R.dpr);
    ctx.font = `bold ${16 * R.dpr}px ui-monospace, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#efe6c8";
    ctx.fillText("Кликни, чтобы играть", R.W / 2, R.H / 2 + 50 * R.dpr); ctx.textAlign = "left";
  }
}

// film grain: a small noise tile drawn at a random offset every frame
let GRAIN = null;
function drawGrain(ctx, a) {
  if (!GRAIN) {
    const c = document.createElement("canvas"); c.width = c.height = 160;
    const g = c.getContext("2d"), im = g.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); GRAIN = ctx.createPattern(c, "repeat");
  }
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "overlay";
  ctx.translate(-Math.random() * 160, -Math.random() * 160); ctx.fillStyle = GRAIN; ctx.fillRect(0, 0, R.W + 160, R.H + 160);
  ctx.restore();
}

function drawScreenFx(ctx) {
  const p = G.p, W = R.W, H = R.H;
  drawGrain(ctx, 0.05 + G.night * 0.05 + (1 - p.san / 100) * 0.08 + (G.lordHunt ? 0.08 : 0));
  if (G.gasT > 0) { ctx.fillStyle = `rgba(70,130,30,${0.22 * Math.min(1, G.gasT / 0.35)})`; ctx.fillRect(0, 0, W, H); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  const sanK = 1 - p.san / 100;
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.32 + sanK * 0.45})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (p.san < 40) {
    const a = (40 - p.san) / 40 * (0.18 + 0.1 * Math.sin(R.time * 2));
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.65);
    g.addColorStop(0, "rgba(60,0,40,0)"); g.addColorStop(1, `rgba(60,0,40,${a * 2})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (p.hp < 35 || G.hurtFlash > 0) {
    const a = Math.max(G.hurtFlash * 0.8, p.hp < 35 ? (35 - p.hp) / 35 * (0.35 + 0.15 * Math.sin(R.time * 6)) : 0);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.65);
    g.addColorStop(0, "rgba(120,0,0,0)"); g.addColorStop(1, `rgba(140,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // film grain
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
}

// --- HUD ----------------------------------------------------------------------------

const WICON = { knife: "🔪", axe: "🪓", bat: "🏏", machete: "🗡", pistol: "🔫", shotgun: "💥", crossbow: "🏹", molotov: "🔥" };

// a small dial: amber for day, blue for night, a hand for the time, the time under it
function drawClock(ctx, cx, cy, u) {
  const r = 10 * u, h = G.t * 24;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, r + 3 * u, 0, 7); ctx.fill();
  const ang = hh => -Math.PI / 2 + (hh / 24) * Math.PI * 2 + Math.PI; // midnight at the bottom
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = "rgba(90,110,170,0.8)"; ctx.beginPath(); ctx.arc(cx, cy, r, ang(21.5), ang(28)); ctx.stroke();
  ctx.strokeStyle = "rgba(220,180,90,0.85)"; ctx.beginPath(); ctx.arc(cx, cy, r, ang(4), ang(21.5)); ctx.stroke();
  const a = ang(h);
  ctx.strokeStyle = "#efe6c8"; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); ctx.stroke();
  ctx.font = `${12 * u}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(G.night > 0.5 ? "☾" : "☀", cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  ctx.font = `bold ${10 * u}px ui-monospace, Menlo, monospace`; ctx.fillStyle = G.night > 0.5 ? "rgba(168,184,232,0.8)" : "rgba(239,230,200,0.75)";
  ctx.fillText(clock(), cx, cy + r + 10 * u);
  const toNight = h >= 6 && h < 21.5 ? 21.5 - h : 0;
  if (!World.indoor && toNight > 0 && toNight < 1.5) { ctx.font = `${9 * u}px ui-monospace, Menlo, monospace`; ctx.fillStyle = Math.sin(R.time * 4) > 0 ? "#e08060" : "rgba(224,128,96,0.5)"; ctx.fillText("скоро ночь", cx, cy + r + 22 * u); }
  ctx.textAlign = "left";
}

function iconCircle(ctx, x, y, r, icon, u, col = "rgba(216,200,144,0.9)") {
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.fillStyle = "#efe6c8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = icon.length > 2 ? `bold ${9 * u}px ui-monospace, monospace` : `bold ${r * 1.05}px ui-monospace, monospace`;
  ctx.fillText(icon, x, y + u);
  ctx.textAlign = "left";
}

function drawHUD(ctx) {
  const p = G.p, u = R.dpr, W = R.W, H = R.H, touch = Input.touch, pad = 14 * u;
  ctx.textBaseline = "middle";
  const font = (sz, b = "bold") => ctx.font = `${b} ${sz * u}px ui-monospace, Menlo, Consolas, monospace`;

  // together: the room code while waiting, then the friend's health and where they are
  if (Net.role) {
    font(10); ctx.textAlign = "left";
    const r = Net.remote, y = pad + 44 * u;
    let t;
    if (Net.host && !Net.on) t = "👥 комната " + Net.code;
    else if (!r) t = "👥 соединение…";
    else {
      const here = r.map === World.map, d = here ? Math.round(Math.hypot(r.x - p.x, r.y - p.y) / 40) : null;
      t = "👥 друг " + (r.hp > 0 ? "❤" + r.hp : "☠") + (here ? "  " + d + " м" : "  в другом месте");
    }
    const tw = ctx.measureText(t).width + 14 * u;
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(pad, y - 9 * u, tw, 18 * u);
    ctx.fillStyle = "#cfe6ff"; ctx.fillText(t, pad + 7 * u, y);
    // an arrow at the screen edge pointing to the friend when they are out of sight
    if (r && r.map === World.map && !G.showMap) {
      const ang = Math.atan2(r.y - p.y, r.x - p.x) - p.a, dd = Math.hypot(r.x - p.x, r.y - p.y);
      if (dd > 160 && Math.abs(angDiff(0, ang)) > 0.55) {
        const cx = W / 2 + Math.sin(ang) * W * 0.42, cy = H / 2 - Math.cos(ang) * H * 0.4;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.fillStyle = "rgba(140,200,255,0.75)";
        ctx.beginPath(); ctx.moveTo(0, -9 * u); ctx.lineTo(7 * u, 6 * u); ctx.lineTo(-7 * u, 6 * u); ctx.fill(); ctx.restore();
      }
    }
  }
  // the Master's health while it fights you
  {
    const L = G.mons.find(m => m.type === "lord" && !m.dead);
    if (L && !G.showMap && (L.state === "hunt" || L.barT > 0) && dist2(L.x, L.y, p.x, p.y) < 1100 * 1100) {
      const bw = Math.min(W * 0.5, 320 * u), bx = W / 2 - bw / 2, by = pad + 30 * u, k = clamp(L.hp / (L.max || 1), 0, 1);
      font(10); ctx.textAlign = "center"; ctx.fillStyle = "#e8b0a0"; ctx.fillText("ХОЗЯИН ЛЕСА", W / 2, by - 8 * u);
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 2 * u, by - 2 * u, bw + 4 * u, 9 * u);
      ctx.fillStyle = k < 0.35 ? "#ff3a1a" : "#a01810"; ctx.fillRect(bx, by, bw * k, 5 * u);
      ctx.textAlign = "left";
    }
  }
  if (G.downT > 0) {
    ctx.fillStyle = "rgba(60,0,0,0.6)"; ctx.fillRect(0, 0, W, H);
    font(22); ctx.textAlign = "center"; ctx.fillStyle = "#e05040"; ctx.fillText("ТЫ ПОГИБ", W / 2, H * 0.4);
    font(13); ctx.fillStyle = "#e8d8c0"; ctx.fillText(`Вернёшься к другу через ${Math.ceil(G.downT)}`, W / 2, H * 0.4 + 30 * u);
    ctx.textAlign = "left";
  }

  // vitals: icon + thin bar, nothing else
  // only what matters right now: full stamina and a full flashlight stay hidden
  // a bar shows up only when that stat drops; a healthy screen stays empty
  const vit = [["♥", p.hp, "#b52a2a", 60], ["◉", p.san, "#8a5ac0", 60], ["🍖", p.food, "#9a7a40", 50], ["⚡", p.sta, "#c8a43a", 40], ["🔦", p.bat, "#e8e0a0", 30]].filter(v => v[1] < v[3]);
  let vy = pad + 2 * u;
  const bw = 58 * u, bh = 4 * u;
  for (const [ic, v, c] of vit) {
    const warn = v < 25 && Math.sin(R.time * 7) > 0;
    font(11, "");
    ctx.globalAlpha = warn ? 1 : 0.8;
    ctx.fillStyle = warn ? "#ff6050" : "#efe6c8"; ctx.fillText(ic, pad, vy);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(pad + 17 * u, vy - bh / 2, bw, bh);
    ctx.fillStyle = c; ctx.fillRect(pad + 17 * u, vy - bh / 2, bw * clamp(v, 0, 100) / 100, bh);
    vy += 11 * u;
  }
  ctx.globalAlpha = 1;
  if (Voice.on) {
    // a small red dot while the game listens; what it heard flashes briefly
    ctx.fillStyle = Voice.heardT > 0 ? "#ff6050" : "rgba(200,60,50,0.6)"; ctx.beginPath(); ctx.arc(W - pad - 50 * u, pad + 16 * u, 3 * u, 0, 7); ctx.fill();
    if (Voice.heardT > 0) { font(10, ""); ctx.textAlign = "right"; ctx.fillStyle = "rgba(230,225,210,0.7)"; ctx.fillText("«" + Voice.heard.slice(0, 28) + "»", W - pad - 58 * u, pad + 16 * u); ctx.textAlign = "left"; }
    Voice.heardT -= 1 / 60;
  }

  // time of day
  const ccx = touch ? W / 2 - 40 * u : W / 2;
  drawClock(ctx, ccx, pad + 12 * u, u);

  // where to go: a small arrow beside the clock
  const tgt = objectiveTarget();
  if (tgt && !G.showMap) {
    const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy), rel = angDiff(p.a, Math.atan2(dy, dx));
    const ax = ccx + 34 * u, ay = pad + 12 * u;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(rel - Math.PI / 2);
    ctx.fillStyle = Math.abs(rel) < 0.3 ? "rgba(232,214,150,0.95)" : "rgba(216,200,144,0.6)";
    ctx.beginPath(); ctx.moveTo(10 * u, 0); ctx.lineTo(-6 * u, -7 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-6 * u, 7 * u); ctx.closePath(); ctx.fill();
    ctx.restore();
    font(9, ""); ctx.textAlign = "center"; ctx.fillStyle = "rgba(216,200,144,0.7)"; ctx.fillText(Math.round(d / 40) + "м", ax, ay + 17 * u); ctx.textAlign = "left";
  }

  // objective only when it changes
  if (G.objBanner && !G.showMap) {
    const b = G.objBanner, a = clamp(Math.min(b.t, 6 - b.t) / 0.5, 0, 1);
    ctx.globalAlpha = a; font(13); ctx.textAlign = "center";
    const t = "🎯 " + b.text, tw = Math.min(ctx.measureText(t).width + 30 * u, W - 40 * u), y = pad + 74 * u;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(W / 2 - tw / 2, y - 14 * u, tw, 28 * u);
    ctx.fillStyle = "#e8d690"; ctx.fillText(t, W / 2, y, tw - 20 * u);
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }

  // weapon: just the one in hand, small; tap it to switch
  const slot = (touch ? 34 : 34) * u, n = G.owned.length;
  const hx = (touch && W / u > 600 ? (W - 230 * u) / 2 : W / 2) - slot / 2, hy = H - pad - slot;
  R.hotbar = { x: hx / u, y: hy / u, slot: slot / u, gap: 0, n: 1, single: true };
  if (!G.drive) {
    const id = G.owned[G.wi], w = WEAPONS[W_IDX[id]];
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.arc(hx + slot / 2, hy + slot / 2, slot / 2, 0, 7); ctx.fill();
    ctx.font = `${slot * 0.5}px serif`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(WICON[id] || "?", hx + slot / 2, hy + slot / 2);
    if (w.ammo) { font(9); ctx.fillStyle = "#d8c890"; ctx.fillText(w.mag ? `${G.mag[id] || 0}/${G.inv[w.ammo] || 0}` : `${G.inv[w.ammo] || 0}`, hx + slot / 2, hy - 6 * u); }
    if (n > 1) { font(8, ""); ctx.fillStyle = "rgba(230,225,210,0.5)"; ctx.fillText(`${G.wi + 1}/${n}`, hx + slot + 10 * u, hy + slot / 2); }
    ctx.textAlign = "left"; ctx.globalAlpha = 1;
  }
  // quick bar: only the filled slots, small, to the right of the weapon
  R.quick = [];
  if (!G.drive && G.quick) {
    const qs = 30 * u, gap = 6 * u; let qx = hx + slot + 28 * u;
    G.quick.forEach((k, i) => {
      if (!k) return;
      const cnt = k.startsWith("w:") ? null : G.inv[k] || 0, cy = hy + slot - qs / 2;
      ctx.globalAlpha = cnt === 0 ? 0.35 : 0.8;
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.strokeStyle = "rgba(216,200,144,0.35)"; ctx.lineWidth = 1 * u;
      ctx.beginPath(); ctx.arc(qx + qs / 2, cy, qs / 2, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = `${qs * 0.5}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      ctx.fillText(quickIcon(k), qx + qs / 2, cy + 1 * u);
      if (cnt !== null) { font(8); ctx.fillStyle = "#e8dcb0"; ctx.fillText(String(cnt), qx + qs - 3 * u, cy + qs / 2 - 3 * u); }
      if (!touch) { font(8, ""); ctx.fillStyle = "rgba(230,225,210,0.5)"; ctx.fillText(String(i + 5), qx + qs / 2, cy - qs / 2 - 6 * u); }
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.globalAlpha = 1;
      R.quick.push({ i, x: qx / u, y: (cy - qs / 2) / u, s: qs / u });
      qx += qs + gap;
    });
  }
  if (p.reloadT > 0) { const k = 1 - p.reloadT / curW().reload; ctx.strokeStyle = "#d8c890"; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(W / 2, H / 2, 14 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }

  // what you can do right here: an icon of the button and one verb
  if (G.target && !G.showMap) {
    const icon = touch ? "✋" : "E", t = interactLabel(G.target);
    font(12); const tw = ctx.measureText(t).width;
    const y = H * 0.62, x0 = W / 2 - (tw + 30 * u) / 2;
    iconCircle(ctx, x0 + 10 * u, y, 11 * u, icon, u);
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x0 + 24 * u, y - 11 * u, tw + 12 * u, 22 * u);
    ctx.fillStyle = "#efe6c8"; font(12); ctx.fillText(t, x0 + 30 * u, y);
    if (G.p.act) { const k = G.p.actProg / (G.target.type === "build" ? BUILD_HOLD : GATHER[G.target.type] ? GATHER[G.target.type].time() : 1); ctx.strokeStyle = "#e8d8a0"; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.arc(x0 + 10 * u, y, 13 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
  }

  // messages: short, small, under the clock
  font(11);
  ctx.textAlign = "center";
  G.msgs.slice(-2).forEach((m, i) => {
    ctx.globalAlpha = clamp(Math.min(m.t / 0.5, (m.max - m.t) / 0.2 + 0.2), 0, 1);
    const y = pad + (G.objBanner ? 90 : 56) * u + i * 19 * u, tw = ctx.measureText(m.text).width + 16 * u;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(W / 2 - tw / 2, y - 9 * u, tw, 18 * u);
    ctx.fillStyle = "#efe6c8"; ctx.fillText(m.text, W / 2, y);
  });
  ctx.globalAlpha = 1; ctx.textAlign = "left";

  // driving: speed, fuel, damage
  if (G.drive) {
    const c = G.car, kmh = Math.round(Math.abs(c.v) / 40 * 3.6);
    const x = W / 2, y = H - pad - 30 * u;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - 90 * u, y - 24 * u, 180 * u, 48 * u);
    ctx.textAlign = "center"; font(20); ctx.fillStyle = "#efe6c8"; ctx.fillText(kmh + "", x - 40 * u, y - 4 * u);
    font(9, ""); ctx.fillStyle = "rgba(230,225,210,0.6)"; ctx.fillText("км/ч", x - 40 * u, y + 13 * u);
    ctx.textAlign = "left"; font(11, "");
    ctx.fillStyle = "#efe6c8"; ctx.fillText("⛽", x + 4 * u, y - 8 * u); ctx.fillText("🔧", x + 4 * u, y + 9 * u);
    for (const [v, yy, col] of [[c.fuel, y - 8 * u, c.fuel < 15 ? "#e05040" : "#c8a43a"], [c.hp, y + 9 * u, "#8aa070"]]) { ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + 22 * u, yy - 3 * u, 56 * u, 6 * u); ctx.fillStyle = col; ctx.fillRect(x + 22 * u, yy - 3 * u, 56 * u * clamp(v, 0, 100) / 100, 6 * u); }
  }

  // building: what is in hand and whether it fits
  if (G.place) {
    const d = BDEF[G.place.k], need = Object.entries(d.need).map(([k, q]) => `${ITEMS[k].icon}${G.inv[k] || 0}/${q}`).join(" ");
    font(12); ctx.textAlign = "center";
    const t = G.place.move ? `${d.icon} ${d.n} — переставить` : `${d.icon} ${d.n}  ${need}`, tw = ctx.measureText(t).width + 24 * u, y = H * 0.3;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(W / 2 - tw / 2, y - 12 * u, tw, 24 * u);
    ctx.fillStyle = G.place.ok ? "#a8d890" : "#e08070"; ctx.fillText(G.place.ok ? t : t + "  ✕ " + (G.place.why || ""), W / 2, y);
    ctx.textAlign = "left";
  }

  // fishing: wait, then strike when the "!" shows
  if (G.fishing) {
    ctx.textAlign = "center";
    if (G.fishing.bite > 0) { font(54); ctx.fillStyle = Math.sin(R.time * 20) > 0 ? "#ffe060" : "#ff8040"; ctx.fillText("!", W / 2, H * 0.4); iconCircle(ctx, W / 2, H * 0.4 + 46 * u, 16 * u, touch ? "✋" : "E", u, "#ffe060"); }
    else { font(22); ctx.fillStyle = "rgba(230,225,210,0.6)"; ctx.fillText(".".repeat(1 + Math.floor(R.time * 2) % 3), W / 2, H * 0.42); }
    ctx.textAlign = "left";
  }

  // boss bar
  if (G.boss && !G.bossDead) {
    const b = G.boss, w = Math.min(420 * u, W - 40 * u), x = W / 2 - w / 2, y = pad + 92 * u;
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(x - 2 * u, y - 2 * u, w + 4 * u, 10 * u);
    ctx.fillStyle = "#8a1010"; ctx.fillRect(x, y, w * Math.max(0, b.hp) / b.max, 6 * u);
  }

  // what you just picked up: tiny icons on the left, gone in a moment
  if (G.feed && G.feed.length) {
    font(11, "");
    G.feed.forEach((f, i) => {
      ctx.globalAlpha = clamp(f.t / 0.6, 0, 1) * 0.85;
      ctx.fillStyle = "#efe6c8"; ctx.fillText(`${ITEMS[f.k].icon} +${f.q}`, pad, H * 0.45 + i * 16 * u);
    });
    ctx.globalAlpha = 1;
  }

  // crosshair
  if (!G.showMap && !G.drive) {
    const mx = W / 2, my = H / 2;
    ctx.fillStyle = G.target ? "rgba(240,220,150,0.9)" : "rgba(230,220,190,0.45)";
    ctx.beginPath(); ctx.arc(mx, my, (G.target ? 2.5 : 1.6) * u, 0, 7); ctx.fill();
  }
}

// hint box: the button to press drawn as an icon next to a short instruction
function drawTip(ctx) {
  if (!G.tip || G.showMap) return;
  const u = R.dpr, W = R.W, H = R.H;
  const a = clamp(Math.min(G.tip.t, 9 - G.tip.t) / 0.4, 0, 1);
  ctx.globalAlpha = a;
  ctx.font = `${12 * u}px ui-monospace, Menlo, Consolas, monospace`;
  const maxW = Math.min(W * (Input.touch ? 0.42 : 0.36), 420 * u);
  const words = G.tip.text.split(" "), lines = [];
  let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW - 58 * u && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  const lh = 17 * u, bw = maxW, bh = Math.max(lines.length * lh + 16 * u, 44 * u);
  const x = 14 * u, y = Input.touch ? H - bh - 72 * u : H - bh - 70 * u;
  ctx.fillStyle = "rgba(18,16,10,0.85)"; ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = "rgba(216,200,144,0.55)"; ctx.lineWidth = u; ctx.strokeRect(x, y, bw, bh);
  const pulse = 1 + 0.08 * Math.sin(R.time * 6);
  iconCircle(ctx, x + 24 * u, y + bh / 2, 15 * u * pulse, G.tip.icon || "💡", u, "#e8d690");
  ctx.fillStyle = "#efe6c8"; ctx.textBaseline = "middle"; ctx.font = `${12 * u}px ui-monospace, Menlo, Consolas, monospace`;
  lines.forEach((l, i) => ctx.fillText(l, x + 48 * u, y + bh / 2 + (i - (lines.length - 1) / 2) * lh));
  ctx.globalAlpha = 1;
}

// map view: zoom 1 shows the whole map, the centre is in world units
const MapView = {
  z: 1, cx: 0, cy: 0, btns: [],
  fit() { return (Math.min(R.W, R.H) / R.dpr - 70) / World.W; },
  clampC() {
    const half = Math.min(R.W, R.H) / R.dpr / 2 / (this.fit() * this.z);
    const lo = Math.min(World.W / 2, half * 0.5), hi = Math.max(World.W / 2, World.W - half * 0.5);
    this.cx = clamp(this.cx, lo, hi); this.cy = clamp(this.cy, lo, hi);
  },
  zoomAt(f, sx, sy) {
    // keep the world point under (sx, sy) in CSS px where it is
    const k0 = this.fit() * this.z, nz = clamp(this.z * f, 1, World.W / 1200);
    const wx = this.cx + (sx - R.W / R.dpr / 2) / k0, wy = this.cy + (sy - R.H / R.dpr / 2) / k0;
    this.z = nz; const k1 = this.fit() * nz;
    this.cx = wx - (sx - R.W / R.dpr / 2) / k1; this.cy = wy - (sy - R.H / R.dpr / 2) / k1;
    this.clampC();
  },
  pan(dx, dy) { const k = this.fit() * this.z; this.cx -= dx / k; this.cy -= dy / k; this.clampC(); },
  open() { this.cx = this.z > 1 ? G.p.x : World.W / 2; this.cy = this.z > 1 ? G.p.y : World.W / 2; this.clampC(); },
  hit(x, y) { for (const b of this.btns) if (x >= b.x && x <= b.x + b.s && y >= b.y && y <= b.y + b.s) return b.id; return null; },
};

function drawMap(ctx) {
  const W = R.W, H = R.H, u = R.dpr, MV = MapView;
  ctx.fillStyle = "rgba(5,6,5,0.92)"; ctx.fillRect(0, 0, W, H);
  const k = MV.fit() * MV.z * u, size = World.W * k, ox = W / 2 - MV.cx * k, oy = H / 2 - MV.cy * k;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, size, size); ctx.clip();
  ctx.fillStyle = "#1a2015"; ctx.fillRect(ox, oy, size, size);
  ctx.strokeStyle = "#3a3222"; ctx.lineWidth = Math.max(4 * u, 120 * k); ctx.lineCap = "round";
  for (const r of World.roads) { ctx.beginPath(); ctx.moveTo(ox + r[0][0] * k, oy + r[0][1] * k); for (const pt of r) ctx.lineTo(ox + pt[0] * k, oy + pt[1] * k); ctx.stroke(); }
  ctx.fillStyle = "#0e1714"; for (const s of World.swamp) { ctx.beginPath(); ctx.arc(ox + s.x * k, oy + s.y * k, s.r * k, 0, 7); ctx.fill(); }
  ctx.font = `bold ${11 * u}px ui-monospace, monospace`; ctx.textAlign = "center";
  for (const h of World.houses) {
    const known = G.discovered[h.id];
    ctx.fillStyle = known ? "#6a5238" : "#2a2a24";
    ctx.fillRect(ox + h.x * k, oy + h.y * k, h.w * k, h.h * k);
  }
  const a = World.altar;
  if (a) {
    ctx.strokeStyle = G.discovered.altar ? "#a03020" : "#444"; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(ox + a.x * k, oy + a.y * k, 190 * k, 0, 7); ctx.stroke();
  }
  if (World.dungeon) {
    const D = World.dungeon;
    ctx.fillStyle = "#4a4236";
    for (let y = 0; y < D.ROWS; y++) for (let x = 0; x < D.COLS; x++) if (D.floor[y * D.COLS + x]) ctx.fillRect(ox + (D.ox + x * D.T) * k, oy + (D.oy + y * D.T) * k, D.T * k + 0.5, D.T * k + 0.5);
  }
  // ways down: a ringed dot
  for (const e of World.exits) { const ex = ox + e.x * k, ey = oy + e.y * k; ctx.fillStyle = "#c8a860"; ctx.beginPath(); ctx.arc(ex, ey, 4.5 * u, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
  const t = objectiveTarget();
  if (t) { ctx.fillStyle = "#e0b040"; ctx.beginPath(); ctx.arc(ox + t.x * k, oy + t.y * k, 5 * u + Math.sin(R.time * 5) * 2 * u, 0, 7); ctx.fill(); }
  ctx.font = `${14 * u}px serif`; ctx.textAlign = "center";
  if (G.base && G.base.map === World.map) { ctx.fillText("⌂", ox + G.base.x * k, oy + G.base.y * k); ctx.strokeStyle = "rgba(120,200,120,0.5)"; ctx.beginPath(); ctx.arc(ox + G.base.x * k, oy + G.base.y * k, BASE_R * k, 0, 7); ctx.stroke(); }
  if (carHere() && !G.drive) ctx.fillText("🚗", ox + G.car.x * k, oy + G.car.y * k);
  { const r = netRemoteHere(); if (r) { ctx.save(); ctx.translate(ox + r.x * k, oy + r.y * k); ctx.rotate(r.a); ctx.fillStyle = "#8cc8ff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(9 * u, 0); ctx.lineTo(-6 * u, -6 * u); ctx.lineTo(-6 * u, 6 * u); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); } }
  if (G.drop && !G.drop.looted && World.map === "forest") ctx.fillText("📦", ox + G.drop.x * k, oy + G.drop.y * k);
  ctx.font = `bold ${11 * u}px ui-monospace, monospace`;
  for (const f of G.fires) { ctx.fillStyle = "#ff8a20"; ctx.beginPath(); ctx.arc(ox + f.x * k, oy + f.y * k, 3 * u, 0, 7); ctx.fill(); }
  const p = G.p;
  // names last, each in a free spot next to its place; a name that does not fit anywhere is left out,
  // and nothing covers you, your base, the car, the drop or the target
  const taken = [], L = (x, y, r) => taken.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  L(ox + p.x * k, oy + p.y * k, 14 * u);
  for (const b of MV.btns) taken.push({ x: (b.x - 6) * u, y: (b.y - 6) * u, w: (b.s + 12) * u, h: (b.s + 12) * u });
  if (t) L(ox + t.x * k, oy + t.y * k, 10 * u);
  if (G.base && G.base.map === World.map) L(ox + G.base.x * k, oy + G.base.y * k - 5 * u, 11 * u);
  if (carHere() && !G.drive) L(ox + G.car.x * k, oy + G.car.y * k - 5 * u, 11 * u);
  if (G.drop && !G.drop.looted && World.map === "forest") L(ox + G.drop.x * k, oy + G.drop.y * k - 5 * u, 11 * u);
  for (const e of World.exits) L(ox + e.x * k, oy + e.y * k, 6 * u);
  const labels = World.exits.map(e => ({ text: MAPS[e.to].n, x: e.x, y: e.y, col: "#e8c870", gap: 8 }));
  if (World.altar && G.discovered.altar) labels.push({ text: "Капище", x: World.altar.x, y: World.altar.y, col: "#e09080", gap: 8 });
  if (MV.z >= 2 || World.W <= 6000) for (const h of World.houses) if (G.discovered[h.id] && (MV.z >= 4 || !h.id.startsWith("cabin") || World.W <= 6000)) labels.push({ text: h.name, x: h.x + h.w / 2, y: h.y + h.h / 2, col: "#d8c890", gap: Math.max(h.w, h.h) * k / 2 + 3 * u });
  ctx.font = `bold ${10 * u}px ui-monospace, monospace`; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const hit = (r) => taken.some(q => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
  for (const lb of labels) {
    const cx = ox + lb.x * k, cy = oy + lb.y * k;
    if (cx < -100 || cy < -40 || cx > W + 100 || cy > H + 40) continue;
    const tw = ctx.measureText(lb.text).width + 8 * u, th = 14 * u, g = lb.gap;
    const spots = [[cx, cy - g - th / 2], [cx, cy + g + th / 2], [cx + g + tw / 2, cy], [cx - g - tw / 2, cy]];
    for (const [x, y] of spots) {
      const r = { x: x - tw / 2, y: y - th / 2, w: tw, h: th };
      if (r.x < Math.max(4 * u, ox) || r.y < Math.max(30 * u, oy) || r.x + r.w > Math.min(W - 4 * u, ox + size) || r.y + r.h > Math.min(H - 4 * u, oy + size) || hit(r)) continue;
      taken.push({ x: r.x - 2 * u, y: r.y - 2 * u, w: r.w + 4 * u, h: r.h + 4 * u });
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = lb.col; ctx.fillText(lb.text, x, y + 0.5 * u);
      break;
    }
  }
  ctx.textBaseline = "alphabetic";
  ctx.save(); ctx.translate(ox + p.x * k, oy + p.y * k); ctx.rotate(p.a);
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5 * u;
  ctx.beginPath(); ctx.moveTo(9 * u, 0); ctx.lineTo(-6 * u, -6 * u); ctx.lineTo(-6 * u, 6 * u); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // scale bar: 100 m = 4000 px
  let m = 50; for (const v of [100, 250, 500, 1000, 2500]) if (v * 40 * k <= 130 * u) m = v;
  const bl = m * 40 * k;
  ctx.fillStyle = "#d8c890"; ctx.fillRect(W - 24 * u - bl, H - 22 * u, bl, 2 * u);
  ctx.textAlign = "right"; ctx.font = `${10 * u}px ui-monospace, monospace`; ctx.fillText(m + " м", W - 24 * u, H - 28 * u);
  ctx.textAlign = "center"; ctx.font = `bold ${11 * u}px ui-monospace, monospace`;
  ctx.fillText(MAPS[World.map].n.toUpperCase(), W / 2, 18 * u);
  // buttons on the left: zoom in, zoom out, centre on me, close
  const s = 44, gx = 14, gy = (H / u - 4 * s - 3 * 10) / 2;
  MV.btns = [["in", "+"], ["out", "−"], ["me", "◎"], ["close", "✕"]].map(([id, l], i) => ({ id, l, x: gx, y: gy + i * (s + 10), s }));
  ctx.font = `${22 * u}px sans-serif`; ctx.textBaseline = "middle";
  for (const b of MV.btns) {
    ctx.fillStyle = "rgba(20,20,16,0.85)"; ctx.strokeStyle = "rgba(216,200,144,0.5)"; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.arc((b.x + s / 2) * u, (b.y + s / 2) * u, s / 2 * u, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e8dcb0"; ctx.fillText(b.l, (b.x + s / 2) * u, (b.y + s / 2 + 1) * u);
  }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
}

// the Master of the forest has seen you: red pulsing edges, noise, and "БЕГИ" for three seconds
function drawRun(ctx) {
  const W = R.W, H = R.H, u = R.dpr, t = R.time;
  if (G.lordHunt) {
    const k = 0.5 + 0.5 * Math.sin(t * 12.5);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.65);
    vg.addColorStop(0, "rgba(120,0,0,0)"); vg.addColorStop(1, `rgba(150,0,0,${0.35 + k * 0.25})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // torn scanlines
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 6; i++) { const y = (Math.random() * H) | 0; ctx.fillRect(0, y, W, (1 + Math.random() * 3) * u); }
  }
  const a = G.lordAlert || 0;
  if (a > 0) {
    const fade = Math.min(1, a / 0.4, (3 - a) / 0.15);
    ctx.save();
    ctx.globalAlpha = clamp(fade, 0, 1);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const size = Math.min(W, H) * 0.22 * (1 + (3 - a) * 0.04);
    ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    const x = W / 2 + (Math.random() - 0.5) * 10 * u, y = H * 0.38 + (Math.random() - 0.5) * 8 * u;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText("БЕГИ", x + 4 * u, y + 5 * u);
    ctx.fillStyle = "rgba(255,40,20,0.5)"; ctx.fillText("БЕГИ", x - 6 * u, y);
    ctx.fillStyle = "#d00a0a"; ctx.fillText("БЕГИ", x, y);
    if (Math.random() < 0.3) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(0, y - size * 0.1 + (Math.random() - 0.5) * size * 0.6, W, size * 0.08); }
    ctx.restore();
  }
}

// the jump-scare face, drawn procedurally and shaking
// several kinds of jump scares; each draws itself procedurally and shakes
function drawScare(ctx) {
  const st = G.scare.style || "face";
  if (st !== "face") { drawScare2(ctx, st); return; }
  const sc = G.scare, W = R.W, H = R.H;
  const k = sc.t / sc.max, rnd = mulberry32(Math.floor(R.time * 30) + (sc.seed * 1000 | 0));
  ctx.save();
  ctx.globalAlpha = clamp(k * 3, 0, 1);
  ctx.fillStyle = rnd() < 0.5 ? "rgba(60,0,0,0.85)" : "rgba(0,0,0,0.9)";
  ctx.fillRect(0, 0, W, H);
  const S = Math.min(W, H) * (0.9 + (1 - k) * 0.5) * (0.95 + rnd() * 0.1);
  ctx.translate(W / 2 + (rnd() - 0.5) * 40, H / 2 + (rnd() - 0.5) * 40);
  ctx.rotate((rnd() - 0.5) * 0.15);
  // skull-pale face
  const g = ctx.createRadialGradient(0, -S * 0.05, S * 0.05, 0, 0, S * 0.5);
  g.addColorStop(0, sc.kind === "stalker" ? "#e8e4dc" : "#b8ad98"); g.addColorStop(0.7, sc.kind === "stalker" ? "#9a958c" : "#6a5e4c"); g.addColorStop(1, "rgba(20,10,5,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.36, S * 0.5, 0, 0, 7); ctx.fill();
  // veins and cracks
  ctx.strokeStyle = "rgba(60,10,10,0.6)"; ctx.lineWidth = Math.max(1, S * 0.004);
  for (let i = 0; i < 14; i++) { ctx.beginPath(); let x = (rnd() - 0.5) * S * 0.5, y = (rnd() - 0.5) * S * 0.7; ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * S * 0.08; y += (rnd() - 0.5) * S * 0.08; ctx.lineTo(x, y); } ctx.stroke(); }
  // hollow eyes
  for (const sd of [-1, 1]) {
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sd * S * 0.13, -S * 0.12, S * 0.085, S * 0.11, sd * 0.2, 0, 7); ctx.fill();
    ctx.fillStyle = sc.kind === "stalker" ? "#ffffff" : "#ff2010"; ctx.beginPath(); ctx.arc(sd * S * 0.13 + (rnd() - 0.5) * 4, -S * 0.11, S * 0.012, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = S * 0.01; ctx.beginPath(); ctx.moveTo(sd * S * 0.13, -S * 0.02); ctx.lineTo(sd * S * 0.11, S * 0.12); ctx.stroke();
  }
  // gaping mouth with teeth
  const mh = S * (0.22 + 0.06 * Math.sin(R.time * 40));
  ctx.fillStyle = "#0a0000"; ctx.beginPath(); ctx.ellipse(0, S * 0.22, S * 0.13, mh * 0.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#d8ceb0";
  for (let i = -4; i <= 4; i++) {
    const x = i * S * 0.026;
    ctx.beginPath(); ctx.moveTo(x - S * 0.012, S * 0.22 - mh * 0.52); ctx.lineTo(x + S * 0.012, S * 0.22 - mh * 0.52); ctx.lineTo(x, S * 0.22 - mh * 0.3 + rnd() * S * 0.02); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - S * 0.012, S * 0.22 + mh * 0.52); ctx.lineTo(x + S * 0.012, S * 0.22 + mh * 0.52); ctx.lineTo(x, S * 0.22 + mh * 0.3 - rnd() * S * 0.02); ctx.fill();
  }
  ctx.restore();
  // scanline glitch
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 12; i++) ctx.fillRect(0, rnd() * H, W, 2 + rnd() * 6);
  ctx.globalAlpha = 1;
}

function drawScare2(ctx, st) {
  const sc = G.scare, W = R.W, H = R.H, k = sc.t / sc.max, rnd = mulberry32(Math.floor(R.time * 30) + (sc.seed * 1000 | 0));
  const S = Math.min(W, H) * (1 + (1 - k) * 0.6), cx = W / 2 + (rnd() - 0.5) * 50, cy = H / 2 + (rnd() - 0.5) * 50;
  ctx.save(); ctx.globalAlpha = clamp(k * 3, 0, 1);
  ctx.fillStyle = st === "static" ? "#111" : "rgba(0,0,0,0.92)"; ctx.fillRect(0, 0, W, H);
  ctx.translate(cx, cy); ctx.rotate((rnd() - 0.5) * 0.2);
  if (st === "girl") {
    // a pale face behind wet black hair, one eye showing
    ctx.fillStyle = "#c8c4bc"; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.24, S * 0.34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#050505";
    for (let i = 0; i < 26; i++) { const x = (i / 25 - 0.5) * S * 0.7; if (x > -S * 0.1 && x < S * 0.17) continue; ctx.fillRect(x, -S * 0.45, S * (0.02 + rnd() * 0.03), S * (0.75 + rnd() * 0.5)); }
    for (let i = 0; i < 5; i++) ctx.fillRect(-S * 0.1 + i * S * 0.06, -S * 0.45, S * 0.025, S * (0.25 + rnd() * 0.2));
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-S * 0.03, -S * 0.09, S * 0.035, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(S * 0.08, -S * 0.09, S * 0.04, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(S * 0.08 + (rnd() - 0.5) * 3, -S * 0.09, S * 0.008, 0, 7); ctx.fill();
    ctx.fillStyle = "#3a0000"; ctx.fillRect(-S * 0.04, S * 0.16, S * 0.1, S * 0.03 + Math.sin(R.time * 40) * S * 0.01);
  } else if (st === "hands") {
    // pale hands slap the screen from every side
    ctx.fillStyle = "#b0a898"; ctx.strokeStyle = "rgba(60,0,0,0.7)"; ctx.lineWidth = S * 0.006;
    for (let i = 0; i < 9; i++) {
      ctx.save(); ctx.translate((rnd() - 0.5) * W * 0.9, (rnd() - 0.5) * H * 0.9); ctx.rotate(rnd() * 6.28); const s2 = S * (0.12 + rnd() * 0.08);
      ctx.beginPath(); ctx.ellipse(0, 0, s2 * 0.5, s2 * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke();
      for (let f = 0; f < 5; f++) { ctx.save(); ctx.rotate(-0.9 + f * 0.45); ctx.fillRect(-s2 * 0.07, -s2 * 1.35, s2 * 0.14, s2 * 0.8); ctx.restore(); }
      ctx.restore();
    }
    ctx.fillStyle = "rgba(120,0,0,0.35)"; ctx.fillRect(-W, -H, W * 2, H * 2);
  } else if (st === "eye") {
    // one huge bloodshot eye, the pupil twitching
    ctx.fillStyle = "#e8e0d0"; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.5, S * 0.26, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(170,10,10,0.7)"; ctx.lineWidth = S * 0.004;
    for (let i = 0; i < 30; i++) { const a = rnd() * 6.28; ctx.beginPath(); ctx.moveTo(Math.cos(a) * S * 0.45, Math.sin(a) * S * 0.22); ctx.lineTo(Math.cos(a) * S * 0.18, Math.sin(a) * S * 0.12); ctx.stroke(); }
    const px = (rnd() - 0.5) * S * 0.05;
    ctx.fillStyle = "#5a1a10"; ctx.beginPath(); ctx.arc(px, 0, S * 0.15, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(px, 0, S * (0.05 + 0.03 * Math.sin(R.time * 30)), 0, 7); ctx.fill();
  } else if (st === "upside") {
    // a grinning face hanging upside down from the top of the screen
    ctx.rotate(Math.PI); ctx.translate(0, S * 0.1);
    ctx.fillStyle = "#8a8070"; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.3, S * 0.42, 0, 0, 7); ctx.fill();
    for (const sd of [-1, 1]) { ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(sd * S * 0.11, -S * 0.1, S * 0.07, S * 0.05, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sd * S * 0.11, -S * 0.1, S * 0.01, 0, 7); ctx.fill(); }
    ctx.fillStyle = "#0a0000"; ctx.beginPath(); ctx.ellipse(0, S * 0.17, S * 0.2, S * 0.06, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = "#d8ceb0"; for (let i = -6; i <= 6; i++) ctx.fillRect(i * S * 0.028 - S * 0.008, S * 0.17, S * 0.016, S * 0.03);
  } else if (st === "static") {
    // a television full of snow and a face surfacing in it
    for (let i = 0; i < 900; i++) { const v = rnd() * 255 | 0; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect((rnd() - 0.5) * W, (rnd() - 0.5) * H, 4, 3); }
    ctx.globalAlpha = 0.75 * clamp(k * 3, 0, 1);
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.ellipse(0, 0, S * 0.25, S * 0.33, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * S * 0.09, -S * 0.08, S * 0.03, 0, 7); ctx.fill(); }
    ctx.fillRect(-S * 0.08, S * 0.12, S * 0.16, S * 0.02);
  }
  ctx.restore();
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 10; i++) ctx.fillRect(0, rnd() * H, W, 2 + rnd() * 5);
  ctx.globalAlpha = 1;
}
