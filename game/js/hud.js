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

function drawScreenFx(ctx) {
  const p = G.p, W = R.W, H = R.H;
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  const sanK = 1 - p.san / 100;
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${0.45 + sanK * 0.45})`);
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
  const r = 17 * u, h = G.t * 24;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.arc(cx, cy, r + 3 * u, 0, 7); ctx.fill();
  const ang = hh => -Math.PI / 2 + (hh / 24) * Math.PI * 2 + Math.PI; // midnight at the bottom
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = "rgba(90,110,170,0.8)"; ctx.beginPath(); ctx.arc(cx, cy, r, ang(21.5), ang(28)); ctx.stroke();
  ctx.strokeStyle = "rgba(220,180,90,0.85)"; ctx.beginPath(); ctx.arc(cx, cy, r, ang(4), ang(21.5)); ctx.stroke();
  const a = ang(h);
  ctx.strokeStyle = "#efe6c8"; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); ctx.stroke();
  ctx.font = `${12 * u}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(G.night > 0.5 ? "☾" : "☀", cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  ctx.font = `bold ${13 * u}px ui-monospace, Menlo, monospace`; ctx.fillStyle = G.night > 0.5 ? "#a8b8e8" : "#efe6c8";
  ctx.fillText(clock(), cx, cy + r + 13 * u);
  const toNight = h >= 6 && h < 21.5 ? 21.5 - h : 0, toDay = h < 6 ? 6 - h : h >= 21.5 ? 30 - h : 0;
  ctx.font = `${10 * u}px ui-monospace, Menlo, monospace`; ctx.fillStyle = "rgba(230,225,210,0.6)";
  ctx.fillText(World.indoor ? "под землёй" : toNight ? `ночь через ${Math.ceil(toNight)} ч` : `рассвет через ${Math.ceil(toDay)} ч`, cx, cy + r + 27 * u);
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

  // vitals: icon + thin bar, nothing else
  const vit = [["♥", p.hp, "#b52a2a"], ["⚡", p.sta, "#c8a43a"], ["◉", p.san, "#8a5ac0"], ["🍖", p.food, "#9a7a40"], ["🔦", p.bat, p.light ? "#e8e0a0" : "#6a6a5a"]];
  let vy = pad + 4 * u;
  const bw = 84 * u, bh = 5 * u;
  for (const [ic, v, c] of vit) {
    const warn = v < 25 && Math.sin(R.time * 7) > 0;
    font(11, "");
    ctx.globalAlpha = warn ? 1 : 0.8;
    ctx.fillStyle = warn ? "#ff6050" : "#efe6c8"; ctx.fillText(ic, pad, vy);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(pad + 17 * u, vy - bh / 2, bw, bh);
    ctx.fillStyle = c; ctx.fillRect(pad + 17 * u, vy - bh / 2, bw * clamp(v, 0, 100) / 100, bh);
    vy += 13 * u;
  }
  ctx.globalAlpha = 1;
  if (G.inv.battery) { font(10, ""); ctx.fillStyle = "rgba(230,225,210,0.6)"; ctx.fillText("+" + G.inv.battery, pad + 17 * u + bw + 4 * u, vy - 13 * u); }

  // time of day
  const ccx = touch ? W / 2 - 40 * u : W / 2;
  drawClock(ctx, ccx, pad + 20 * u, u);

  // where to go: a small arrow beside the clock
  const tgt = objectiveTarget();
  if (tgt && !G.showMap) {
    const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy), rel = angDiff(p.a, Math.atan2(dy, dx));
    const ax = ccx + 48 * u, ay = pad + 20 * u;
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

  // weapons: icons with ammo
  const slot = (touch ? 40 : 46) * u, gap = 5 * u, n = G.owned.length;
  const hcx = touch && W / u > 600 ? (W - 230 * u) / 2 : W / 2;
  const hx = hcx - (n * slot + (n - 1) * gap) / 2, hy = H - pad - slot;
  R.hotbar = { x: hx / u, y: hy / u, slot: slot / u, gap: gap / u, n };
  if (!G.drive) G.owned.forEach((id, i) => {
    const w = WEAPONS[W_IDX[id]], x = hx + i * (slot + gap), on = i === G.wi;
    ctx.fillStyle = on ? "rgba(216,200,144,0.22)" : "rgba(0,0,0,0.45)"; ctx.fillRect(x, hy, slot, slot);
    ctx.strokeStyle = on ? "#d8c890" : "rgba(255,255,255,0.08)"; ctx.lineWidth = 1.5 * u; ctx.strokeRect(x, hy, slot, slot);
    ctx.font = `${slot * 0.45}px serif`; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText(WICON[id] || "?", x + slot / 2, hy + slot * 0.42);
    if (w.ammo) { font(9); ctx.fillStyle = "#d8c890"; ctx.fillText(w.mag ? `${G.mag[id] || 0}/${G.inv[w.ammo] || 0}` : `${G.inv[w.ammo] || 0}`, x + slot / 2, hy + slot - 7 * u); }
    ctx.textAlign = "left";
  });
  if (p.reloadT > 0) { const k = 1 - p.reloadT / curW().reload; ctx.strokeStyle = "#d8c890"; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(W / 2, H / 2, 14 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }

  // what you can do right here: an icon of the button and one verb
  if (G.target && !G.showMap) {
    const icon = touch ? "✋" : "E", t = interactLabel(G.target);
    font(12); const tw = ctx.measureText(t).width;
    const y = hy - 26 * u, x0 = W / 2 - (tw + 30 * u) / 2;
    iconCircle(ctx, x0 + 10 * u, y, 11 * u, icon, u);
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x0 + 24 * u, y - 11 * u, tw + 12 * u, 22 * u);
    ctx.fillStyle = "#efe6c8"; font(12); ctx.fillText(t, x0 + 30 * u, y);
    if (G.p.act) { const k = G.p.actProg / (G.target.type === "build" ? 1.2 : GATHER[G.target.type] ? GATHER[G.target.type].time() : 1); ctx.strokeStyle = "#e8d8a0"; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.arc(x0 + 10 * u, y, 13 * u, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
  }

  // messages: short, small, under the clock
  font(12);
  ctx.textAlign = "center";
  G.msgs.forEach((m, i) => {
    ctx.globalAlpha = clamp(Math.min(m.t / 0.5, (m.max - m.t) / 0.2 + 0.2), 0, 1);
    const y = pad + (G.objBanner ? 104 : 78) * u + i * 22 * u, tw = ctx.measureText(m.text).width + 20 * u;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W / 2 - tw / 2, y - 10 * u, tw, 20 * u);
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
    const t = `${d.icon} ${d.n}  ${need}`, tw = ctx.measureText(t).width + 24 * u, y = H * 0.68;
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

  // crosshair
  if (!G.showMap && !G.drive) {
    const mx = W / 2, my = H / 2;
    ctx.strokeStyle = G.target ? "rgba(240,220,150,0.9)" : "rgba(230,220,190,0.4)"; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.arc(mx, my, (G.target ? 8 : 5) * u, 0, 7); ctx.stroke();
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

function drawMap(ctx) {
  const W = R.W, H = R.H, u = R.dpr;
  ctx.fillStyle = "rgba(5,6,5,0.88)"; ctx.fillRect(0, 0, W, H);
  const size = Math.min(W, H) - 80 * u, ox = (W - size) / 2, oy = (H - size) / 2, k = size / World.W;
  ctx.fillStyle = "#1a2015"; ctx.fillRect(ox, oy, size, size);
  ctx.strokeStyle = "#3a3222"; ctx.lineWidth = 4 * u; ctx.lineCap = "round";
  for (const r of World.roads) { ctx.beginPath(); ctx.moveTo(ox + r[0][0] * k, oy + r[0][1] * k); for (const pt of r) ctx.lineTo(ox + pt[0] * k, oy + pt[1] * k); ctx.stroke(); }
  ctx.fillStyle = "#0e1714"; for (const s of World.swamp) { ctx.beginPath(); ctx.arc(ox + s.x * k, oy + s.y * k, s.r * k, 0, 7); ctx.fill(); }
  ctx.font = `bold ${11 * u}px ui-monospace, monospace`; ctx.textAlign = "center";
  for (const h of World.houses) {
    const known = G.discovered[h.id];
    ctx.fillStyle = known ? "#6a5238" : "#2a2a24";
    ctx.fillRect(ox + h.x * k, oy + h.y * k, h.w * k, h.h * k);
    ctx.fillStyle = known ? "#d8c890" : "#666";
    ctx.fillText(known ? h.name : "?", ox + (h.x + h.w / 2) * k, oy + h.y * k - 8 * u);
  }
  const a = World.altar;
  if (a) {
    ctx.strokeStyle = G.discovered.altar ? "#a03020" : "#444"; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.arc(ox + a.x * k, oy + a.y * k, 190 * k, 0, 7); ctx.stroke();
    ctx.fillStyle = G.discovered.altar ? "#d8c890" : "#666"; ctx.fillText(G.discovered.altar ? "Капище" : "?", ox + a.x * k, oy + (a.y - 220) * k);
  }
  if (World.dungeon) {
    const D = World.dungeon;
    ctx.fillStyle = "#4a4236";
    for (let y = 0; y < D.ROWS; y++) for (let x = 0; x < D.COLS; x++) if (D.floor[y * D.COLS + x]) ctx.fillRect(ox + (D.ox + x * D.T) * k, oy + (D.oy + y * D.T) * k, D.T * k + 0.5, D.T * k + 0.5);
  }
  ctx.fillStyle = "#c8a860";
  for (const e of World.exits) { ctx.beginPath(); ctx.arc(ox + e.x * k, oy + e.y * k, 4 * u, 0, 7); ctx.fill(); ctx.fillText(MAPS[e.to].n, ox + e.x * k, oy + e.y * k - 10 * u); }
  const t = objectiveTarget();
  if (t) { ctx.fillStyle = "#e0b040"; ctx.beginPath(); ctx.arc(ox + t.x * k, oy + t.y * k, 5 * u + Math.sin(R.time * 5) * 2 * u, 0, 7); ctx.fill(); }
  ctx.font = `${14 * u}px serif`; ctx.textAlign = "center";
  if (G.base && G.base.map === World.map) { ctx.fillText("⌂", ox + G.base.x * k, oy + G.base.y * k); ctx.strokeStyle = "rgba(120,200,120,0.5)"; ctx.beginPath(); ctx.arc(ox + G.base.x * k, oy + G.base.y * k, BASE_R * k, 0, 7); ctx.stroke(); }
  if (carHere() && !G.drive) ctx.fillText("🚗", ox + G.car.x * k, oy + G.car.y * k);
  ctx.font = `bold ${11 * u}px ui-monospace, monospace`;
  for (const f of G.fires) { ctx.fillStyle = "#ff8a20"; ctx.beginPath(); ctx.arc(ox + f.x * k, oy + f.y * k, 3 * u, 0, 7); ctx.fill(); }
  const p = G.p;
  ctx.save(); ctx.translate(ox + p.x * k, oy + p.y * k); ctx.rotate(p.a);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(8 * u, 0); ctx.lineTo(-5 * u, -5 * u); ctx.lineTo(-5 * u, 5 * u); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#d8c890"; ctx.fillText(MAPS[World.map].n.toUpperCase() + " — нажми M / ✕, чтобы закрыть", W / 2, oy - 16 * u);
  ctx.textAlign = "left";
}

// the jump-scare face, drawn procedurally and shaking
function drawScare(ctx) {
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
