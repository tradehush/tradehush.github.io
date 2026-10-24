"use strict";
// Drawing: world, entities, darkness and HUD.

const R = {
  cv: null, ctx: null, dark: null, dctx: null, W: 0, H: 0, dpr: 1, S: 1, cam: { x: 0, y: 0 }, ground: null, time: 0,
};

function initRender() {
  R.cv = document.getElementById("c");
  R.ctx = R.cv.getContext("2d");
  R.dark = document.createElement("canvas");
  R.dctx = R.dark.getContext("2d");
  // ground texture
  const g = document.createElement("canvas"); g.width = g.height = 256;
  const gc = g.getContext("2d");
  gc.fillStyle = "#1a2015"; gc.fillRect(0, 0, 256, 256);
  const rnd = mulberry32(7);
  for (let i = 0; i < 2200; i++) {
    const v = rnd();
    gc.fillStyle = v < 0.5 ? `rgba(10,14,8,${0.25 + rnd() * 0.3})` : v < 0.85 ? `rgba(40,52,30,${0.2 + rnd() * 0.3})` : `rgba(60,48,32,${0.2 + rnd() * 0.3})`;
    const s = 1 + rnd() * 3;
    gc.fillRect(rnd() * 256, rnd() * 256, s, s);
  }
  R.gcv = g;
  resize();
  addEventListener("resize", resize);
}

function resize() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = innerWidth, h = innerHeight;
  R.cv.width = Math.round(w * R.dpr); R.cv.height = Math.round(h * R.dpr);
  R.cv.style.width = w + "px"; R.cv.style.height = h + "px";
  R.W = R.cv.width; R.H = R.cv.height;
  R.S = clamp(Math.sqrt(w * h) / 860, 0.6, 1.45) * R.dpr;
  R.dark.width = Math.ceil(R.W / 2); R.dark.height = Math.ceil(R.H / 2);
  R.ground = R.ctx.createPattern(R.gcv, "repeat");
}

function screenToWorld(sx, sy) {
  return { x: R.cam.x + (sx * R.dpr - R.W / 2) / R.S, y: R.cam.y + (sy * R.dpr - R.H / 2) / R.S };
}

function viewRect(m = 120) {
  const hw = R.W / 2 / R.S, hh = R.H / 2 / R.S;
  return { x0: R.cam.x - hw - m, y0: R.cam.y - hh - m, x1: R.cam.x + hw + m, y1: R.cam.y + hh + m };
}
const inView = (v, x, y, r = 0) => x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;

function render(dt) {
  R.time += dt;
  const ctx = R.ctx, p = G.p;
  R.cam.x = lerp(R.cam.x, p.x, Math.min(1, dt * 8));
  R.cam.y = lerp(R.cam.y, p.y, Math.min(1, dt * 8));
  if (!isFinite(R.cam.x)) { R.cam.x = p.x; R.cam.y = p.y; }
  const sx = (Math.random() - 0.5) * G.shake, sy = (Math.random() - 0.5) * G.shake;
  const wob = p.san < 30 ? Math.sin(R.time * 0.9) * (30 - p.san) * 0.0006 : 0;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, R.W, R.H);
  ctx.setTransform(R.S, 0, 0, R.S, R.W / 2, R.H / 2);
  ctx.rotate(wob);
  ctx.translate(-R.cam.x + sx, -R.cam.y + sy);
  const v = viewRect();

  drawGround(ctx, v);
  drawHouses(ctx, v, false);
  drawStatics(ctx, v);
  drawItems(ctx, v);
  drawEntities(ctx, v);
  drawCanopies(ctx, v);
  drawHouses(ctx, v, true);
  drawFog(ctx, v);

  drawDarkness(wob, sx, sy);

  ctx.setTransform(R.S, 0, 0, R.S, R.W / 2, R.H / 2);
  ctx.rotate(wob);
  ctx.translate(-R.cam.x + sx, -R.cam.y + sy);
  drawGlows(ctx, v);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreenFx(ctx);
  if (G.state !== "title" && G.state !== "intro") drawHUD(ctx);
  if (G.showMap) drawMap(ctx);
}

// --- ground ----------------------------------------------------------------------

function drawGround(ctx, v) {
  ctx.fillStyle = R.ground;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  // roads
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const [w, c] of [[52, "#211d14"], [36, "#2c261a"], [8, "#332c1f"]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    for (const r of World.roads) { ctx.beginPath(); ctx.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]); ctx.stroke(); }
  }
  // swamp
  for (const s of World.swamp) {
    if (!inView(v, s.x, s.y, s.r + 20)) continue;
    ctx.fillStyle = "#141c12"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 14, 0, 7); ctx.fill();
  }
  for (const s of World.swamp) {
    if (!inView(v, s.x, s.y, s.r)) continue;
    ctx.fillStyle = "#0b1513"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(120,160,140,0.07)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.5 + 0.3 * Math.sin(R.time * 0.5 + s.x)), 0, 7); ctx.stroke();
  }
  // stone circle ground
  const a = World.altar;
  if (inView(v, a.x, a.y, 260)) {
    ctx.fillStyle = "#17150f"; ctx.beginPath(); ctx.arc(a.x, a.y, 240, 0, 7); ctx.fill();
    ctx.strokeStyle = "#2a2318"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(a.x, a.y, 120, 0, 7); ctx.stroke();
    ctx.strokeStyle = G.placed ? "rgba(200,40,20,0.5)" : "rgba(80,60,40,0.4)"; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + i * Math.PI * 4 / 5; const x = a.x + Math.cos(an) * 115, y = a.y + Math.sin(an) * 115; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  // grass tufts
  ctx.strokeStyle = "#26301c"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const g of World.props) {
    if (g.k || !inView(v, g.x, g.y)) continue;
    ctx.moveTo(g.x, g.y); ctx.lineTo(g.x - 3, g.y - 7 - g.s * 4);
    ctx.moveTo(g.x + 2, g.y); ctx.lineTo(g.x + 4, g.y - 6 - g.s * 3);
  }
  ctx.stroke();
  ctx.fillStyle = "#2a241a";
  for (const g of World.props) if (g.k && inView(v, g.x, g.y)) ctx.fillRect(g.x, g.y, 3 + g.s * 4, 2 + g.s * 2);
  // blood
  for (const d of G.decals) {
    if (!inView(v, d.x, d.y, d.r)) continue;
    ctx.globalAlpha = Math.min(1, d.a); ctx.fillStyle = d.col;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- houses ------------------------------------------------------------------------

function drawHouses(ctx, v, top) {
  const p = G.p;
  for (const h of World.houses) {
    if (!inView(v, h.x + h.w / 2, h.y + h.h / 2, Math.max(h.w, h.h))) continue;
    const inside = G.inside === h;
    h.roofA = lerp(h.roofA == null ? 1 : h.roofA, inside ? 0 : 1, 0.12);
    if (!top) {
      ctx.fillStyle = h.floor; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = h.y + 18; y < h.y + h.h; y += 18) { ctx.moveTo(h.x, y); ctx.lineTo(h.x + h.w, y); }
      ctx.stroke();
      for (const f of World.furn) if (f.house === h.id) drawFurn(ctx, f);
    } else {
      ctx.fillStyle = "#4b3b2b";
      for (const w of h.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = "#2a2018";
      for (const w of h.walls) ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
      if (h.roofA > 0.02) {
        ctx.globalAlpha = h.roofA;
        const m = 14;
        ctx.fillStyle = h.roof; ctx.fillRect(h.x - m, h.y - m, h.w + m * 2, h.h + m * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath();
        const horiz = h.w >= h.h;
        for (let i = 1; i < 12; i++) {
          if (horiz) { const y = h.y - m + (h.h + 2 * m) * i / 12; ctx.moveTo(h.x - m, y); ctx.lineTo(h.x + h.w + m, y); }
          else { const x = h.x - m + (h.w + 2 * m) * i / 12; ctx.moveTo(x, h.y - m); ctx.lineTo(x, h.y + h.h + m); }
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        if (horiz) ctx.fillRect(h.x - m, h.y - m, h.w + 2 * m, (h.h + 2 * m) / 2); else ctx.fillRect(h.x - m, h.y - m, (h.w + 2 * m) / 2, h.h + 2 * m);
        ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 4;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(h.x - m, h.y + h.h / 2); ctx.lineTo(h.x + h.w + m, h.y + h.h / 2); }
        else { ctx.moveTo(h.x + h.w / 2, h.y - m); ctx.lineTo(h.x + h.w / 2, h.y + h.h + m); }
        ctx.stroke();
        if (h.cross) {
          ctx.fillStyle = "#555"; const cx = h.x + h.w / 2, cy = h.y + 70;
          ctx.fillRect(cx - 4, cy - 26, 8, 52); ctx.fillRect(cx - 18, cy - 12, 36, 8);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawFurn(ctx, f) {
  const { x, y, w, h } = f;
  switch (f.kind) {
    case "crate": {
      const c = World.inter.find(o => o.type === "crate" && Math.abs(o.x - x - 15) < 1 && Math.abs(o.y - y - 15) < 1);
      ctx.fillStyle = c && c.full ? "#6a4e2e" : "#3a2c1c"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#2a1e12"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
      break;
    }
    case "bench":
      ctx.fillStyle = "#5a4430"; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#8a8a8a"; ctx.fillRect(x + 10, y + 8, 22, 6); ctx.fillRect(x + 50, y + 20, 30, 4);
      ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + 84, y + 10, 16, 18);
      break;
    case "table": ctx.fillStyle = "#4e3a26"; ctx.fillRect(x, y, w, h); ctx.strokeStyle = "#2e2216"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); break;
    case "bed":
      ctx.fillStyle = "#3a2a1c"; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#6b6a5e"; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      ctx.fillStyle = "#8c8a7c"; ctx.fillRect(x + 8, y + 8, w - 16, 18);
      ctx.fillStyle = "#4a3f5e"; ctx.fillRect(x + 4, y + 40, w - 8, h - 44);
      break;
    case "shelf": ctx.fillStyle = "#3e2e1e"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#6a5a40"; for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 18, y + 6, 10, h - 12); break;
    case "altar": ctx.fillStyle = "#5a5450"; ctx.fillRect(x, y, w, h); ctx.fillStyle = "#7a2020"; ctx.fillRect(x + 6, y + 6, w - 12, 6); break;
    case "pew": ctx.fillStyle = "#3e2c1c"; ctx.fillRect(x, y, w, h); break;
    case "board": ctx.fillStyle = "#1e2a22"; ctx.fillRect(x, y, w, h); break;
    case "desk": ctx.fillStyle = "#4a3a28"; ctx.fillRect(x, y, w, h); break;
    case "cauldron":
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, 0, 7); ctx.fill();
      ctx.fillStyle = "#2f5a2a"; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2 - 6, 0, 7); ctx.fill();
      break;
  }
}

// --- static objects --------------------------------------------------------------

function drawStatics(ctx, v) {
  // the car
  ctx.save(); ctx.translate(385, 3878); ctx.rotate(-0.15);
  ctx.fillStyle = "#2a2f36"; ctx.fillRect(-55, -28, 110, 56);
  ctx.fillStyle = "#1a1e24"; ctx.fillRect(-18, -24, 40, 48);
  ctx.fillStyle = "#4a5260"; ctx.fillRect(-50, -24, 22, 48);
  ctx.fillStyle = "#c8b060"; ctx.fillRect(50, -24, 5, 10); ctx.fillRect(50, 14, 5, 10);
  ctx.restore();

  const a = World.altar;
  if (inView(v, a.x, a.y, 260)) {
    ctx.fillStyle = "#4a4640"; ctx.fillRect(a.x - 30, a.y - 20, 60, 40);
    ctx.strokeStyle = "#2a2622"; ctx.lineWidth = 3; ctx.strokeRect(a.x - 30, a.y - 20, 60, 40);
    if (G.placed) ["#d8d0b8", "#c03020", "#60d0ff"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(a.x - 16 + i * 16, a.y, 5, 0, 7); ctx.fill(); });
    for (const s of World.stones) {
      ctx.fillStyle = "#3e3b36"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      ctx.fillStyle = "#57534c"; ctx.beginPath(); ctx.arc(s.x - 4, s.y - 4, s.r * 0.6, 0, 7); ctx.fill();
    }
  }

  const list = gridQuery((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2, Math.max(v.x1 - v.x0, v.y1 - v.y0) / 2);
  R.visible = list;
  for (const o of list) {
    if (!inView(v, o.x, o.y, 70)) continue;
    if (o.type === "tree") {
      if (o.left <= 0) {
        ctx.fillStyle = "#3a2c1e"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
        ctx.strokeStyle = "#5a4430"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.55, 0, 7); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.arc(o.x + 6, o.y + 6, o.r + 4, 0, 7); ctx.fill();
        ctx.fillStyle = o.dead ? "#3a3530" : "#2e2116"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
        if (o.left < o.max) { ctx.fillStyle = "#8a6a44"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 - o.left / o.max) * 0.8, 0, 7); ctx.fill(); }
      }
    } else if (o.type === "rock" && o.left > 0) {
      const k = 0.6 + 0.4 * o.left / o.max;
      ctx.fillStyle = "#3a3a38"; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r * k * 1.15, o.r * k, o.sh * 3, 0, 7); ctx.fill();
      ctx.fillStyle = "#55554f"; ctx.beginPath(); ctx.ellipse(o.x - 3, o.y - 4, o.r * k * 0.7, o.r * k * 0.55, o.sh * 3, 0, 7); ctx.fill();
    } else if (o.type === "bush") {
      ctx.fillStyle = "#1f3018"; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.arc(o.x + 8, o.y + 4, o.r * 0.8, 0, 7); ctx.fill();
      if (o.left > 0) { ctx.fillStyle = "#7aa850"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(o.x + Math.cos(i * 2.4 + o.sh * 6) * 9, o.y + Math.sin(i * 2.4 + o.sh * 6) * 7, 2.2, 0, 7); ctx.fill(); } }
    } else if (o.type === "scrap" && o.left > 0) {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.sh * 6);
      ctx.fillStyle = "#4a3428"; ctx.fillRect(-16, -10, 22, 16);
      ctx.fillStyle = "#6a4a30"; ctx.beginPath(); ctx.arc(8, 6, 9, 0, 7); ctx.fill();
      ctx.fillStyle = "#5a5a5a"; ctx.fillRect(-6, 4, 20, 4); ctx.fillRect(-12, -14, 4, 12);
      ctx.restore();
    }
  }
}

function drawItems(ctx, v) {
  const pulse = 0.5 + 0.5 * Math.sin(R.time * 3);
  for (const o of World.inter) {
    if (o.taken || !inView(v, o.x, o.y, 40)) continue;
    if (o.type === "note") {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(0.2);
      ctx.fillStyle = G.notes.includes(o.key) ? "#a89f88" : "#e8dfc4"; ctx.fillRect(-7, -9, 14, 18);
      ctx.fillStyle = "#555"; for (let i = 0; i < 4; i++) ctx.fillRect(-5, -6 + i * 4, 10, 1);
      ctx.restore();
    } else if (o.type === "pickup") {
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(-0.4);
      ctx.fillStyle = "#222"; ctx.fillRect(-14, -3, o.weapon === "shotgun" ? 36 : 20, 6); ctx.fillStyle = "#4a3020"; ctx.fillRect(-14, -3, 8, 10);
      ctx.restore();
    } else if (o.type === "seal" && !G.seals.includes(o.seal)) {
      const c = o.seal === "bone" ? "#e8e0c8" : o.seal === "heart" ? "#d03020" : "#60d0ff";
      ctx.fillStyle = c; ctx.beginPath();
      if (o.seal === "eye") { ctx.ellipse(o.x, o.y, 10, 6, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, 7); }
      else if (o.seal === "heart") ctx.arc(o.x, o.y, 7 + pulse * 2, 0, 7);
      else { ctx.fillRect(o.x - 10, o.y - 2, 20, 4); ctx.arc(o.x - 10, o.y, 4, 0, 7); ctx.arc(o.x + 10, o.y, 4, 0, 7); }
      ctx.fill();
    }
  }
  for (const d of G.drops) {
    ctx.fillStyle = "#d8c890"; ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.beginPath(); ctx.arc(d.x, d.y, 4, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of G.traps) {
    ctx.strokeStyle = "#8a8a8a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, 7); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ctx.beginPath(); ctx.moveTo(t.x + Math.cos(a) * 8, t.y + Math.sin(a) * 8); ctx.lineTo(t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14); ctx.stroke(); }
  }
  for (const f of G.fires) {
    ctx.fillStyle = "#2a2018"; ctx.beginPath(); ctx.arc(f.x, f.y, 16, 0, 7); ctx.fill();
    ctx.strokeStyle = "#5a4028"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(f.x - 12, f.y - 6); ctx.lineTo(f.x + 12, f.y + 6); ctx.moveTo(f.x - 12, f.y + 6); ctx.lineTo(f.x + 12, f.y - 6); ctx.stroke();
    const fl = 0.8 + 0.2 * Math.sin(R.time * 20 + f.x);
    ctx.fillStyle = "#ff8a20"; ctx.beginPath(); ctx.arc(f.x, f.y, 8 * fl, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffe080"; ctx.beginPath(); ctx.arc(f.x, f.y - 2, 4 * fl, 0, 7); ctx.fill();
  }
  for (const r of G.roots) {
    if (r.t > 0) { ctx.fillStyle = `rgba(80,30,10,${0.3 + 0.4 * (1 - Math.min(1, r.t))})`; ctx.beginPath(); ctx.arc(r.x, r.y, 20, 0, 7); ctx.fill(); }
    else {
      ctx.fillStyle = "#2a1c10";
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + r.x; ctx.beginPath(); ctx.moveTo(r.x + Math.cos(a) * 14, r.y + Math.sin(a) * 14); ctx.lineTo(r.x + Math.cos(a + 0.4) * 4, r.y + Math.sin(a + 0.4) * 4 - 22); ctx.lineTo(r.x + Math.cos(a + 0.8) * 14, r.y + Math.sin(a + 0.8) * 14); ctx.fill(); }
    }
  }
}

// --- creatures & player ---------------------------------------------------------

function drawMonster(ctx, m) {
  const d = MONSTERS[m.type];
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
  if (m.fake) ctx.globalAlpha = 0.55 + 0.3 * Math.sin(R.time * 12);
  const lunge = m.wind > 0 ? -4 : 0;
  ctx.translate(lunge, 0);
  const sw = Math.sin(m.step);
  ctx.fillStyle = d.col; ctx.strokeStyle = d.col;
  switch (m.type) {
    case "crawler":
      ctx.lineWidth = 2.5;
      for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(i * 6, 0); ctx.lineTo(i * 6 + sw * s * 5 + 4, s * 16); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a2a24"; ctx.beginPath(); ctx.arc(12, 0, 6, 0, 7); ctx.fill();
      break;
    case "ghoul":
    case "stalker": {
      const st = m.type === "stalker";
      if (st) ctx.globalAlpha *= 0.92;
      ctx.lineWidth = st ? 3 : 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(st ? 26 : 18 + sw * 4, -11 - sw * 2); ctx.moveTo(0, 9); ctx.lineTo(st ? 26 : 18 - sw * 4, 11 + sw * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, st ? 7 : 9, st ? 12 : 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = st ? "#050507" : "#5e6458"; ctx.beginPath(); ctx.arc(4, 0, st ? 6 : 7, 0, 7); ctx.fill();
      if (st) { ctx.strokeStyle = "#050507"; ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-4, (i - 2) * 4); ctx.lineTo(-14 - Math.random() * 6, (i - 2) * 6); ctx.stroke(); } }
      break;
    }
    case "brute":
      ctx.lineWidth = 9; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(24 + sw * 4, -24); ctx.moveTo(0, 20); ctx.lineTo(24 - sw * 4, 24); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-2, 0, 22, 27, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#241c14"; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const a = Math.PI * 0.6 + i * 0.25; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 36); ctx.stroke(); }
      ctx.fillStyle = "#4a3e30"; ctx.beginPath(); ctx.arc(12, 0, 10, 0, 7); ctx.fill();
      break;
    case "spitter":
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
      ctx.fillStyle = "#7a8a3a"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * 9 - 2, Math.sin(i * 1.7) * 9, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#2a3010"; ctx.beginPath(); ctx.arc(12, 0, 5, 0, 7); ctx.fill();
      break;
    case "boss": {
      const k = m.hp < m.max * 0.5 ? 1.1 : 1;
      ctx.scale(k, k);
      ctx.strokeStyle = "#1a120c"; ctx.lineWidth = 12; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(40 + sw * 6, -40); ctx.moveTo(0, 30); ctx.lineTo(40 - sw * 6, 40); ctx.stroke();
      ctx.fillStyle = d.col; ctx.beginPath(); ctx.ellipse(-4, 0, 34, 42, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 4;
      const ant = (s) => { ctx.beginPath(); ctx.moveTo(14, s * 10); ctx.lineTo(0, s * 60); ctx.lineTo(-20, s * 80); ctx.moveTo(4, s * 40); ctx.lineTo(28, s * 66); ctx.moveTo(-6, s * 66); ctx.lineTo(4, s * 90); ctx.stroke(); };
      ant(1); ant(-1);
      ctx.fillStyle = "#2a1f16"; ctx.beginPath(); ctx.arc(16, 0, 16, 0, 7); ctx.fill();
      ctx.fillStyle = "#d8d0b8"; ctx.beginPath(); ctx.ellipse(24, 0, 8, 12, 0, 0, 7); ctx.fill();
      break;
    }
  }
  if (m.hitF > 0) { ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; }
  ctx.restore();
  if (m.stun > 0) { ctx.fillStyle = "#ddd"; for (let i = 0; i < 3; i++) { const a = R.time * 4 + i * 2.1; ctx.fillRect(m.x + Math.cos(a) * 14 - 1, m.y - m.r - 8 + Math.sin(a) * 4, 3, 3); } }
  if (!m.fake && m.hp < m.max && m.type !== "boss" && m.lit) {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(m.x - 16, m.y - m.r - 10, 32, 4);
    ctx.fillStyle = "#b02020"; ctx.fillRect(m.x - 16, m.y - m.r - 10, 32 * m.hp / m.max, 4);
  }
}

function drawPlayer(ctx) {
  const p = G.p, w = curW();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
  if (p.iframe > 0 && Math.floor(R.time * 30) % 2) ctx.globalAlpha = 0.6;
  const bob = p.moving ? Math.sin(R.time * 12) * 2 : 0;
  // feet
  ctx.fillStyle = "#1e1e20";
  ctx.beginPath(); ctx.ellipse(bob, -6, 5, 3.5, 0, 0, 7); ctx.ellipse(-bob, 6, 5, 3.5, 0, 0, 7); ctx.fill();
  // body
  ctx.fillStyle = "#3d4a52"; ctx.beginPath(); ctx.ellipse(0, 0, 9, 13, 0, 0, 7); ctx.fill();
  // weapon
  let swing = 0;
  if (w.kind === "melee" && G.swingT > 0) swing = (G.swingT / 0.18 - 0.5) * w.arc;
  ctx.save(); ctx.rotate(swing);
  ctx.strokeStyle = "#c8a882"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(14, 6); ctx.stroke();
  if (w.kind === "melee") {
    if (w.id === "knife") { ctx.fillStyle = "#bbb"; ctx.fillRect(14, 4, 14, 3); }
    else if (w.id === "axe") { ctx.fillStyle = "#6a4a2a"; ctx.fillRect(12, 4, 28, 4); ctx.fillStyle = "#999"; ctx.fillRect(34, -2, 8, 12); }
    else if (w.id === "bat") { ctx.fillStyle = "#7a5a3a"; ctx.fillRect(12, 3, 34, 7); ctx.fillStyle = "#ccc"; for (let i = 0; i < 4; i++) ctx.fillRect(30 + i * 4, 0, 1.5, 13); }
    else { ctx.fillStyle = "#333"; ctx.fillRect(12, 4, 8, 4); ctx.fillStyle = "#c8c8c8"; ctx.fillRect(20, 2, 26, 6); }
  } else {
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(14, 0); ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    if (w.id === "pistol") ctx.fillRect(12, 1, 14, 5);
    else if (w.id === "shotgun") { ctx.fillRect(10, 1, 32, 5); ctx.fillStyle = "#5a3a20"; ctx.fillRect(4, 1, 10, 6); }
    else if (w.id === "crossbow") { ctx.fillStyle = "#5a3a20"; ctx.fillRect(8, 2, 26, 4); ctx.strokeStyle = "#333"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(32, 4, 14, -1.1, 1.1); ctx.stroke(); }
    else if (w.id === "molotov") { ctx.fillStyle = "#3a6a40"; ctx.fillRect(12, 1, 10, 6); ctx.fillStyle = "#ffb040"; ctx.fillRect(22, 2, 4, 3); }
  }
  ctx.restore();
  // head
  ctx.fillStyle = "#2a2420"; ctx.beginPath(); ctx.arc(1, 0, 6.5, 0, 7); ctx.fill();
  // flashlight
  ctx.fillStyle = p.light && G.lightOff <= 0 ? "#ffe9a8" : "#555"; ctx.fillRect(8, -11, 6, 4);
  ctx.restore();
  // gather progress
  if (p.act) {
    const t = p.actProg / GATHER[p.act.type].time();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y - 26, 9, 0, 7); ctx.stroke();
    ctx.strokeStyle = "#e8d8a0"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 26, 9, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2); ctx.stroke();
  }
}

function drawEntities(ctx, v) {
  for (const m of G.mons) if (inView(v, m.x, m.y, m.r + 60)) drawMonster(ctx, m);
  drawPlayer(ctx);
  for (const pr of G.projs) {
    if (pr.kind === "acid") { ctx.fillStyle = "#a8e030"; ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, 7); ctx.fill(); }
    else if (pr.kind === "bolt") { ctx.strokeStyle = "#c8b080"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.025, pr.y - pr.vy * 0.025); ctx.stroke(); }
    else if (pr.kind === "bottle") { ctx.fillStyle = "#3a6a40"; ctx.beginPath(); ctx.arc(pr.x, pr.y - pr.h, 5, 0, 7); ctx.fill(); ctx.fillStyle = "#ffb040"; ctx.beginPath(); ctx.arc(pr.x + 3, pr.y - pr.h - 4, 2.5, 0, 7); ctx.fill(); }
    else if (pr.kind === "firezone") {
      const a = Math.min(1, pr.life / 1.5);
      ctx.fillStyle = `rgba(255,120,20,${0.25 * a})`; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,200,60,${0.25 * a})`; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.6 * (0.9 + 0.1 * Math.sin(R.time * 15)), 0, 7); ctx.fill();
    }
  }
  for (const q of G.parts) {
    if (q.glow) continue;
    ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.col;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,230,160,0.8)"; ctx.lineWidth = 1.5;
  for (const t of G.tracers) { ctx.globalAlpha = t.life / 0.08; ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function drawCanopies(ctx, v) {
  const p = G.p;
  for (const o of R.visible || []) {
    if (o.type !== "tree" || o.left <= 0 || !inView(v, o.x, o.y, o.cr + 10)) continue;
    if (o.dead) {
      ctx.strokeStyle = "#2e2a26"; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = o.hue * 6 + i * 1.05; ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(a) * 34, o.y + Math.sin(a) * 34); }
      ctx.stroke();
      continue;
    }
    const near = dist2(o.x, o.y, p.x, p.y) < (o.cr + 10) ** 2;
    const sway = Math.sin(R.time * 0.8 + o.x * 0.01) * 2;
    ctx.globalAlpha = near ? 0.35 : 0.93;
    const g = 22 + o.hue * 14 | 0;
    ctx.fillStyle = `rgb(${g * 0.55 | 0},${g + 8},${g * 0.6 | 0})`;
    ctx.beginPath(); ctx.arc(o.x + sway, o.y, o.cr, 0, 7); ctx.fill();
    ctx.fillStyle = `rgb(${g * 0.7 | 0},${g + 20},${g * 0.75 | 0})`;
    ctx.beginPath(); ctx.arc(o.x - o.cr * 0.25 + sway, o.y - o.cr * 0.25, o.cr * 0.6, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(0,0,0,0.25)`;
    ctx.beginPath(); ctx.arc(o.x + o.cr * 0.3 + sway, o.y + o.cr * 0.3, o.cr * 0.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFog(ctx, v) {
  for (let i = 0; i < 7; i++) {
    const fx = ((i * 913 + R.time * (8 + i * 2)) % 2400) + Math.floor(R.cam.x / 2400) * 2400 - 600;
    const fy = R.cam.y + Math.sin(i * 1.7 + R.time * 0.05) * 500;
    for (const ox of [-2400, 0, 2400]) {
      const x = fx + ox;
      if (!inView(v, x, fy, 400)) continue;
      const g = ctx.createRadialGradient(x, fy, 0, x, fy, 380);
      g.addColorStop(0, "rgba(160,170,170,0.07)"); g.addColorStop(1, "rgba(160,170,170,0)");
      ctx.fillStyle = g; ctx.fillRect(x - 380, fy - 380, 760, 760);
    }
  }
}

// --- light & darkness -------------------------------------------------------------

function drawDarkness(wob, sx, sy) {
  const p = G.p, d = R.dctx, k = R.dark.width / R.W;
  const inside = G.inside ? 0.04 : 0;
  const dark = clamp(lerp(0.3, 0.975, G.night) + inside, 0, 0.985);
  d.setTransform(1, 0, 0, 1, 0, 0);
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, R.dark.width, R.dark.height);
  d.fillStyle = `rgba(2,4,8,${dark})`;
  d.fillRect(0, 0, R.dark.width, R.dark.height);
  d.setTransform(R.S * k, 0, 0, R.S * k, R.dark.width / 2, R.dark.height / 2);
  d.rotate(wob);
  d.translate(-R.cam.x + sx, -R.cam.y + sy);
  d.globalCompositeOperation = "destination-out";

  const radial = (x, y, r, a) => {
    const g = d.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
  };
  radial(p.x, p.y, HALO_R + 20, 0.6);
  if (G.rays.length) {
    const flick = p.bat < 15 ? (Math.random() < 0.15 ? 0.3 : 1) : 1;
    const g = d.createRadialGradient(p.x, p.y, 10, p.x, p.y, FLASH_RANGE);
    g.addColorStop(0, `rgba(0,0,0,${flick})`); g.addColorStop(0.55, `rgba(0,0,0,${0.85 * flick})`); g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g;
    d.beginPath(); d.moveTo(p.x, p.y);
    for (let i = 0; i < FLASH_RAYS; i++) {
      const a = p.a - FLASH_HALF + (i / (FLASH_RAYS - 1)) * FLASH_HALF * 2;
      d.lineTo(p.x + Math.cos(a) * G.rays[i], p.y + Math.sin(a) * G.rays[i]);
    }
    d.closePath(); d.fill();
  }
  for (const f of G.fires) radial(f.x, f.y, 280 * (0.95 + 0.05 * Math.sin(R.time * 13 + f.x)) * Math.min(1, f.life / 20 + 0.4), 1);
  for (const l of World.lights) radial(l.x, l.y, l.r * (1 - l.flick + l.flick * Math.sin(R.time * 9 + l.x)), 0.95);
  for (const pr of G.projs) if (pr.kind === "firezone") radial(pr.x, pr.y, 220 * Math.min(1, pr.life / 2), 1);
  if (G.flash > 0) radial(p.x + Math.cos(p.a) * 20, p.y + Math.sin(p.a) * 20, 340, 1);
  for (const o of World.inter) if (o.type === "seal" && !G.seals.includes(o.seal)) radial(o.x, o.y, 60, 0.6);
  if (G.placed) radial(World.altar.x, World.altar.y, 160, 0.5);

  R.ctx.setTransform(1, 0, 0, 1, 0, 0);
  R.ctx.drawImage(R.dark, 0, 0, R.W, R.H);
}

function drawGlows(ctx, v) {
  ctx.globalCompositeOperation = "lighter";
  const warm = (x, y, r, a, col = "255,140,40") => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  };
  for (const f of G.fires) if (inView(v, f.x, f.y, 260)) warm(f.x, f.y, 260, 0.13);
  for (const l of World.lights) if (inView(v, l.x, l.y, l.r)) warm(l.x, l.y, l.r, 0.1, l.col);
  for (const pr of G.projs) if (pr.kind === "firezone") warm(pr.x, pr.y, 200, 0.18);
  if (G.flash > 0) warm(G.p.x + Math.cos(G.p.a) * 24, G.p.y + Math.sin(G.p.a) * 24, 60, 0.6, "255,220,140");
  for (const q of G.parts) if (q.glow) { ctx.globalAlpha = q.life / q.max; ctx.fillStyle = q.col; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); }
  ctx.globalAlpha = 1;
  for (const o of World.inter) {
    if (o.taken || !inView(v, o.x, o.y, 40)) continue;
    if (o.type === "seal" && !G.seals.includes(o.seal)) warm(o.x, o.y, 40, 0.3 + 0.15 * Math.sin(R.time * 3), o.seal === "heart" ? "255,60,40" : o.seal === "eye" ? "80,200,255" : "255,240,200");
    if (o.type === "note" && !G.notes.includes(o.key)) warm(o.x, o.y, 22, 0.12 + 0.08 * Math.sin(R.time * 2.5), "255,240,190");
    if (o.type === "pickup") warm(o.x, o.y, 26, 0.1, "255,240,190");
  }
  for (const d of G.drops) warm(d.x, d.y, 14, 0.15, "255,230,160");
  // eyes in the dark
  const p = G.p;
  for (const m of G.mons) {
    if (m.lit && m.type !== "boss" || !inView(v, m.x, m.y, 40)) continue;
    const dd = Math.hypot(m.x - p.x, m.y - p.y);
    if (dd > 900) continue;
    const col = MONSTERS[m.type].eye;
    const fx = Math.cos(m.a), fy = Math.sin(m.a), px = -fy, py = fx;
    const ex = m.x + fx * (m.r * 0.7), ey = m.y + fy * (m.r * 0.7), sp = m.type === "boss" ? 10 : m.type === "brute" ? 6 : 3.5;
    const a = clamp(1.1 - dd / 900, 0.15, 1) * (m.fake ? 0.6 : 1);
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(ex + px * sp, ey + py * sp, m.type === "boss" ? 8 : 4.5, 0, 7); ctx.arc(ex - px * sp, ey - py * sp, m.type === "boss" ? 8 : 4.5, 0, 7); ctx.fill();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(ex + px * sp, ey + py * sp, m.type === "boss" ? 3 : 1.5, 0, 7); ctx.arc(ex - px * sp, ey - py * sp, m.type === "boss" ? 3 : 1.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
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
  const narrow = W < 640 * u;
  let by = touch || narrow ? pad + (narrow ? 62 : 40) * u : H - pad - bars.length * 22 * u;
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
    const tw = Math.min(ctx.measureText("ЦЕЛЬ: " + t).width + 20 * u, W - pad * 2 - (narrow ? 0 : 200 * u));
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

  // objective compass arrow
  const tgt = objectiveTarget();
  if (tgt && !G.showMap) {
    const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
    if (d > 160) {
      const a = Math.atan2(dy, dx);
      const cx = W / 2 + Math.cos(a) * 70 * u * (R.S / R.dpr), cy = H / 2 + Math.sin(a) * 70 * u * (R.S / R.dpr);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = "rgba(216,200,144,0.55)";
      ctx.beginPath(); ctx.moveTo(9 * u, 0); ctx.lineTo(-5 * u, -6 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-5 * u, 6 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // weapon hotbar
  const slot = 54 * u, gap = 6 * u, n = G.owned.length;
  const hx = W / 2 - (n * slot + (n - 1) * gap) / 2, hy = H - pad - slot - (touch ? 150 * u : 0);
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
    const b = G.boss, w = Math.min(500 * u, W - 40 * u), x = W / 2 - w / 2, y = pad + 44 * u;
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(x - 2 * u, y - 2 * u, w + 4 * u, 14 * u);
    ctx.fillStyle = "#8a1010"; ctx.fillRect(x, y, w * Math.max(0, b.hp) / b.max, 10 * u);
    font(12, "bold"); ctx.textAlign = "center"; ctx.fillStyle = "#e8c0a0"; ctx.fillText("ХОЗЯИН ЛЕСА", W / 2, y + 24 * u); ctx.textAlign = "left";
  }

  // crosshair (mouse)
  if (!touch && Input.mouseActive && !G.showMap) {
    const mx = Input.mx * u, my = Input.my * u;
    ctx.strokeStyle = "rgba(230,220,190,0.7)"; ctx.lineWidth = 1.5 * u;
    ctx.beginPath(); ctx.arc(mx, my, 7 * u, 0, 7); ctx.moveTo(mx - 12 * u, my); ctx.lineTo(mx - 4 * u, my); ctx.moveTo(mx + 4 * u, my); ctx.lineTo(mx + 12 * u, my);
    ctx.moveTo(mx, my - 12 * u); ctx.lineTo(mx, my - 4 * u); ctx.moveTo(mx, my + 4 * u); ctx.lineTo(mx, my + 12 * u); ctx.stroke();
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
