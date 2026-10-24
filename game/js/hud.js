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

function drawHUD(ctx) {
  const p = G.p, u = R.dpr, W = R.W, H = R.H;
  const touch = Input.touch;
  const pad = 14 * u;
  ctx.textBaseline = "middle";
  const font = (s, b = "") => ctx.font = `${b} ${s * u}px ui-monospace, Menlo, Consolas, monospace`;

  // bars
  const bars = [["ЗДОРОВЬЕ", p.hp, "#b52a2a"], ["ВЫНОСЛИВОСТЬ", p.sta, "#c8a43a"], ["РАССУДОК", p.san, "#7a4ab0"], ["ФОНАРЬ", p.bat, p.light ? "#e8e0a0" : "#6a6a5a"]];
  const bw = 150 * u, bh = 8 * u;
  const narrow = W < 640 * u || touch;
  let by = touch || narrow ? pad + 62 * u : H - pad - bars.length * 22 * u;
  const bx = pad;
  font(10, "bold");
  for (const [n, val, c] of bars) {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(bx, by + 10 * u, bw, bh);
    ctx.fillStyle = c; ctx.fillRect(bx, by + 10 * u, bw * clamp(val, 0, 100) / 100, bh);
    ctx.fillStyle = "rgba(230,225,210,0.75)"; ctx.fillText(n + (n === "ФОНАРЬ" ? (G.inv.battery ? `  🔋${G.inv.battery}` : "") : ""), bx, by + 3 * u);
    by += 22 * u;
  }

  // objective
  font(13, "bold");
  const step = STEPS[G.step];
  if (step && G.step < 7) {
    let t = step.t;
    if (G.step === 4) t += `  (${G.seals.length}/3)`;
    const tw = Math.min(ctx.measureText("ЦЕЛЬ: " + t).width + 20 * u, W - pad * 2 - (touch ? (W / u > 600 ? 270 * u : 0) : narrow ? 0 : 200 * u));
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(pad, pad, tw, 26 * u);
    ctx.fillStyle = "#d8c890";
    ctx.save(); ctx.beginPath(); ctx.rect(pad, pad, tw, 26 * u); ctx.clip();
    ctx.fillText("ЦЕЛЬ: " + t, pad + 10 * u, pad + 13 * u);
    ctx.restore();
  }

  // clock
  font(13, "bold");
  ctx.textAlign = narrow ? "left" : "right";
  ctx.fillStyle = G.night > 0.5 ? "#8a9ac8" : "#d8c890";
  ctx.fillText(`${G.night > 0.5 ? "☾" : "☀"} День ${G.day} · ${clock()}`, narrow ? pad : W - pad, pad + (narrow ? 42 : 13) * u);
  ctx.textAlign = "left";

  // objective compass: the arrow points where to go relative to the view
  const tgt = objectiveTarget();
  if (tgt && !G.showMap) {
    const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
    const rel = angDiff(p.a, Math.atan2(dy, dx));
    const cx = W / 2, cy = (narrow ? 104 : 64) * u;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rel - Math.PI / 2);
    ctx.fillStyle = Math.abs(rel) < 0.3 ? "rgba(232,214,150,0.9)" : "rgba(216,200,144,0.55)";
    ctx.beginPath(); ctx.moveTo(11 * u, 0); ctx.lineTo(-6 * u, -8 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-6 * u, 8 * u); ctx.closePath(); ctx.fill();
    ctx.restore();
    font(11, "bold"); ctx.textAlign = "center"; ctx.fillStyle = "rgba(216,200,144,0.75)";
    ctx.fillText(Math.round(d / 40) + " м", cx, cy + 20 * u); ctx.textAlign = "left";
  }

  // weapon hotbar
  const slot = (touch ? 44 : 54) * u, gap = 6 * u, n = G.owned.length;
  const hcx = touch && W / u > 600 ? (W - 230 * u) / 2 : W / 2;
  const hx = hcx - (n * slot + (n - 1) * gap) / 2, hy = H - pad - slot;
  R.hotbar = { x: hx / u, y: hy / u, slot: slot / u, gap: gap / u, n };
  font(10, "bold");
  G.owned.forEach((id, i) => {
    const w = WEAPONS[W_IDX[id]], x = hx + i * (slot + gap);
    ctx.fillStyle = i === G.wi ? "rgba(216,200,144,0.25)" : "rgba(0,0,0,0.5)";
    ctx.fillRect(x, hy, slot, slot);
    ctx.strokeStyle = i === G.wi ? "#d8c890" : "rgba(255,255,255,0.12)"; ctx.lineWidth = 1.5 * u; ctx.strokeRect(x, hy, slot, slot);
    ctx.fillStyle = "rgba(230,225,210,0.5)"; ctx.fillText(String(i + 1), x + 4 * u, hy + 8 * u);
    ctx.fillStyle = "#e6e1d2";
    ctx.textAlign = "center";
    ctx.fillText(w.n.split(" ")[0].slice(0, 8), x + slot / 2, hy + slot / 2);
    if (w.ammo) {
      const s = w.mag ? `${G.mag[id] || 0}/${G.inv[w.ammo] || 0}` : `${G.inv[w.ammo] || 0}`;
      ctx.fillStyle = "#d8c890"; ctx.fillText(s, x + slot / 2, hy + slot - 9 * u);
    }
    ctx.textAlign = "left";
  });
  if (p.reloadT > 0) {
    font(12, "bold"); ctx.textAlign = "center"; ctx.fillStyle = "#d8c890";
    ctx.fillText("ПЕРЕЗАРЯДКА…", W / 2, hy - 14 * u); ctx.textAlign = "left";
  }

  // interaction prompt
  if (G.target && !G.showMap) {
    font(13, "bold"); ctx.textAlign = "center";
    const t = (touch ? "[✋] " : "[E] ") + interactLabel(G.target);
    const tw = ctx.measureText(t).width + 24 * u;
    const ty = hy - (p.reloadT > 0 ? 44 : 22) * u;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(W / 2 - tw / 2, ty - 13 * u, tw, 26 * u);
    ctx.fillStyle = "#efe6c8"; ctx.fillText(t, W / 2, ty);
    ctx.textAlign = "left";
  }

  // messages
  font(14, "bold"); ctx.textAlign = "center";
  G.msgs.forEach((m, i) => {
    const a = Math.min(1, m.t / 0.5, (m.max - m.t) / 0.2 + 0.2);
    ctx.globalAlpha = clamp(a, 0, 1);
    const y = H * 0.22 + i * 26 * u;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; const tw = ctx.measureText(m.text).width + 24 * u;
    ctx.fillRect(W / 2 - tw / 2, y - 12 * u, tw, 24 * u);
    ctx.fillStyle = "#efe6c8"; ctx.fillText(m.text, W / 2, y);
  });
  ctx.globalAlpha = 1; ctx.textAlign = "left";

  // boss bar
  if (G.boss && !G.bossDead) {
    const b = G.boss, w = Math.min(500 * u, W - 40 * u), x = W / 2 - w / 2, y = pad + 96 * u;
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(x - 2 * u, y - 2 * u, w + 4 * u, 14 * u);
    ctx.fillStyle = "#8a1010"; ctx.fillRect(x, y, w * Math.max(0, b.hp) / b.max, 10 * u);
    font(12, "bold"); ctx.textAlign = "center"; ctx.fillStyle = "#e8c0a0"; ctx.fillText("ХОЗЯИН ЛЕСА", W / 2, y + 24 * u); ctx.textAlign = "left";
  }

  // crosshair
  if (!G.showMap) {
    const mx = W / 2, my = H / 2;
    ctx.strokeStyle = G.target ? "rgba(240,220,150,0.9)" : "rgba(230,220,190,0.55)"; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.arc(mx, my, (G.target ? 9 : 6) * u, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(230,220,190,0.8)"; ctx.fillRect(mx - u, my - u, 2 * u, 2 * u);
  }
}

function drawMap(ctx) {
  const W = R.W, H = R.H, u = R.dpr;
  ctx.fillStyle = "rgba(5,6,5,0.88)"; ctx.fillRect(0, 0, W, H);
  const size = Math.min(W, H) - 80 * u, ox = (W - size) / 2, oy = (H - size) / 2, k = size / WORLD_W;
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
  ctx.strokeStyle = G.discovered.altar ? "#a03020" : "#444"; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(ox + a.x * k, oy + a.y * k, 190 * k, 0, 7); ctx.stroke();
  ctx.fillStyle = G.discovered.altar ? "#d8c890" : "#666"; ctx.fillText(G.discovered.altar ? "Капище" : "?", ox + a.x * k, oy + (a.y - 220) * k);
  const t = objectiveTarget();
  if (t) { ctx.fillStyle = "#e0b040"; ctx.beginPath(); ctx.arc(ox + t.x * k, oy + t.y * k, 5 * u + Math.sin(R.time * 5) * 2 * u, 0, 7); ctx.fill(); }
  for (const f of G.fires) { ctx.fillStyle = "#ff8a20"; ctx.beginPath(); ctx.arc(ox + f.x * k, oy + f.y * k, 3 * u, 0, 7); ctx.fill(); }
  const p = G.p;
  ctx.save(); ctx.translate(ox + p.x * k, oy + p.y * k); ctx.rotate(p.a);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(8 * u, 0); ctx.lineTo(-5 * u, -5 * u); ctx.lineTo(-5 * u, 5 * u); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#d8c890"; ctx.fillText("КАРТА — нажми M / ✕, чтобы закрыть", W / 2, oy - 16 * u);
  ctx.textAlign = "left";
}

// hint box above the bars
function drawTip(ctx) {
  if (!G.tip || G.showMap) return;
  const u = R.dpr, W = R.W, H = R.H;
  const a = clamp(Math.min(G.tip.t, 8 - G.tip.t) / 0.4, 0, 1);
  ctx.globalAlpha = a;
  ctx.font = `${13 * u}px ui-monospace, Menlo, Consolas, monospace`;
  const maxW = Math.min(W * (Input.touch ? 0.4 : 0.36), 420 * u);
  const words = ("💡 " + G.tip.text).split(" "), lines = [];
  let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW - 24 * u && line) { lines.push(line); line = w; } else line = t; }
  lines.push(line);
  const lh = 18 * u, bw = maxW, bh = lines.length * lh + 16 * u;
  // bottom-left, clear of the crosshair, above the weapon slots
  const x = 14 * u, y = Input.touch ? H - bh - 72 * u : H - 14 * u - 88 * u - bh - 14 * u;
  ctx.fillStyle = "rgba(20,18,10,0.82)"; ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = "rgba(216,200,144,0.6)"; ctx.lineWidth = u; ctx.strokeRect(x, y, bw, bh);
  ctx.fillStyle = "#efe6c8"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x + 12 * u, y + 8 * u + lh * (i + 0.5)));
  ctx.globalAlpha = 1;
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
