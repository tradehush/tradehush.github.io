"use strict";
// World layout, procedural forest, collision, navigation and light rays.

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const WT = 14;      // wall thickness
const DOOR = 64;    // door width

const World = {
  houses: [], walls: [], furn: [], res: [], stones: [], swamp: [], roads: [], props: [],
  inter: [], lights: [], grid: null, gcell: 100, gw: 0, gh: 0,
  nav: null, ncell: 25, nw: 0, nh: 0, start: { x: 430, y: 3800 }, altar: null,
};

// --- house construction ------------------------------------------------------

function wallLine(list, x1, y1, x2, y2, gaps = []) {
  // axis-aligned wall from (x1,y1) to (x2,y2) with door gaps given as [from, to] along it
  const horiz = y1 === y2;
  const a = horiz ? Math.min(x1, x2) : Math.min(y1, y2), b = horiz ? Math.max(x1, x2) : Math.max(y1, y2);
  let cur = a;
  const sorted = gaps.map(g => [a + g[0], a + g[1]]).sort((p, q) => p[0] - q[0]);
  const push = (s, e) => {
    if (e - s < 1) return;
    if (horiz) list.push({ x: s, y: y1 - WT / 2, w: e - s, h: WT });
    else list.push({ x: x1 - WT / 2, y: s, w: WT, h: e - s });
  };
  for (const g of sorted) { push(cur, g[0]); cur = g[1]; }
  push(cur, b);
}

function addHouse(h) {
  const { x, y, w, h: hh } = h;
  const walls = [];
  const dg = s => s === h.door ? [[(s === "n" || s === "s" ? w : hh) / 2 - DOOR / 2, (s === "n" || s === "s" ? w : hh) / 2 + DOOR / 2]] : [];
  wallLine(walls, x - WT / 2, y, x + w + WT / 2, y, dg("n").map(g => [g[0] + WT / 2, g[1] + WT / 2]));
  wallLine(walls, x - WT / 2, y + hh, x + w + WT / 2, y + hh, dg("s").map(g => [g[0] + WT / 2, g[1] + WT / 2]));
  wallLine(walls, x, y, x, y + hh, dg("w"));
  wallLine(walls, x + w, y, x + w, y + hh, dg("e"));
  for (const p of h.parts || []) wallLine(walls, x + p[0], y + p[1], x + p[2], y + p[3], p[4] ? [p[4]] : []);
  h.walls = walls;
  World.walls.push(...walls);
  World.houses.push(h);
  const dx = h.door === "w" ? x : h.door === "e" ? x + w : x + w / 2;
  const dy = h.door === "n" ? y : h.door === "s" ? y + hh : y + hh / 2;
  h.doorPos = { x: dx, y: dy };
  return h;
}

function furn(h, rx, ry, w, hh, kind, extra = {}) {
  const f = Object.assign({ x: h.x + rx, y: h.y + ry, w, h: hh, kind, house: h.id }, extra);
  World.furn.push(f);
  return f;
}

function inter(o) { World.inter.push(o); return o; }

function crate(h, rx, ry) {
  const f = furn(h, rx, ry, 30, 30, "crate");
  const c = inter({ type: "crate", x: f.x + 15, y: f.y + 15, r: 38, house: h.id, full: true, id: "c" + World.inter.length });
  return c;
}

function insideHouse(px, py, margin = 0) {
  for (const h of World.houses) if (px > h.x - margin && px < h.x + h.w + margin && py > h.y - margin && py < h.y + h.h + margin) return h;
  return null;
}

function buildHouses() {
  // 1. Forester's house — the base
  const f = addHouse({ id: "forester", name: "Дом лесника", x: 520, y: 3150, w: 380, h: 280, door: "s", floor: "#3a2c20", roof: "#2b211a",
    parts: [[230, 0, 230, 280, [100, 100 + DOOR]]] });
  furn(f, 20, 20, 110, 40, "bench");
  inter({ type: "bench", x: f.x + 75, y: f.y + 60, r: 50 });
  furn(f, 140, 150, 60, 40, "table");
  inter({ type: "note", key: "anya1", x: f.x + 170, y: f.y + 170, r: 40, step: 1 });
  furn(f, 300, 20, 60, 100, "bed");
  inter({ type: "bed", x: f.x + 330, y: f.y + 125, r: 46 });
  crate(f, 20, 220); crate(f, 330, 230);
  World.lights.push({ x: f.x + 115, y: f.y + 140, r: 230, col: "255,190,110", flick: 0.06 });

  // 2. Headman's house
  const hd = addHouse({ id: "headman", name: "Дом старосты", x: 2150, y: 1950, w: 440, h: 320, door: "s", floor: "#33281f", roof: "#3a1f1a",
    parts: [[0, 170, 440, 170, [180, 180 + DOOR]]] });
  furn(hd, 180, 60, 90, 50, "table");
  inter({ type: "note", key: "head", x: hd.x + 225, y: hd.y + 85, r: 50, step: 3 });
  inter({ type: "pickup", weapon: "pistol", give: { ammo9: 10 }, x: hd.x + 205, y: hd.y + 80, r: 50, label: "Пистолет старосты" });
  furn(hd, 20, 20, 80, 30, "shelf"); furn(hd, 340, 20, 80, 30, "shelf");
  crate(hd, 20, 120); crate(hd, 390, 120); crate(hd, 380, 270); crate(hd, 20, 270);
  furn(hd, 40, 200, 90, 36, "table");

  // 3. Chapel
  const ch = addHouse({ id: "chapel", name: "Часовня", x: 2750, y: 1300, w: 300, h: 460, door: "s", floor: "#2c2a2a", roof: "#1f1f26", cross: true });
  furn(ch, 110, 30, 80, 40, "altar");
  for (let i = 0; i < 5; i++) { furn(ch, 25, 120 + i * 60, 95, 16, "pew"); furn(ch, 180, 120 + i * 60, 95, 16, "pew"); }
  inter({ type: "seal", seal: "bone", x: ch.x + 150, y: ch.y + 50, r: 50, label: "Печать: Кость", guard: [["ghoul", 3], ["crawler", 3]] });
  inter({ type: "note", key: "priest", x: ch.x + 60, y: ch.y + 430, r: 40 });
  crate(ch, 255, 410);

  // 4. School
  const sc = addHouse({ id: "school", name: "Старая школа", x: 1500, y: 1350, w: 520, h: 300, door: "s", floor: "#30302a", roof: "#262a22",
    parts: [[340, 0, 340, 300, [200, 200 + DOOR]]] });
  furn(sc, 40, 14, 200, 10, "board");
  inter({ type: "note", key: "school", x: sc.x + 140, y: sc.y + 40, r: 50 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) furn(sc, 40 + c * 70, 90 + r * 60, 40, 24, "desk");
  furn(sc, 380, 40, 100, 40, "table");
  inter({ type: "seal", seal: "heart", x: sc.x + 430, y: sc.y + 60, r: 50, label: "Печать: Сердце-камень", guard: [["stalker", 2]] });
  crate(sc, 470, 250); crate(sc, 20, 250);

  // 5. Hunter's cabin
  const hu = addHouse({ id: "hunter", name: "Хижина охотника", x: 3450, y: 2650, w: 300, h: 240, door: "w", floor: "#3a2d1e", roof: "#2a2418" });
  furn(hu, 200, 20, 80, 40, "bench");
  inter({ type: "bench", x: hu.x + 240, y: hu.y + 60, r: 50 });
  furn(hu, 120, 150, 60, 40, "table");
  inter({ type: "note", key: "hunter", x: hu.x + 150, y: hu.y + 170, r: 46 });
  inter({ type: "pickup", weapon: "shotgun", give: { shells: 6 }, x: hu.x + 140, y: hu.y + 160, r: 46, label: "Дробовик охотника" });
  crate(hu, 250, 190); crate(hu, 20, 20);

  // 6. Witch's house on the swamp
  const wi = addHouse({ id: "witch", name: "Дом Агафьи", x: 650, y: 800, w: 320, h: 280, door: "e", floor: "#26281e", roof: "#1d2017" });
  furn(wi, 120, 100, 60, 60, "cauldron");
  inter({ type: "note", key: "witch", x: wi.x + 60, y: wi.y + 240, r: 40 });
  inter({ type: "seal", seal: "eye", x: wi.x + 150, y: wi.y + 130, r: 56, label: "Печать: Глаз", guard: [["brute", 1], ["spitter", 3]] });
  furn(wi, 20, 20, 80, 30, "shelf");
  crate(wi, 270, 20); crate(wi, 20, 230);
  World.lights.push({ x: wi.x + 150, y: wi.y + 130, r: 140, col: "120,255,140", flick: 0.15 });
}

// --- roads ---------------------------------------------------------------------

function buildRoads() {
  World.roads = [
    [[380, 4000], [600, 3700], [700, 3560], [710, 3430]],
    [[650, 3640], [1100, 3300], [1500, 2900], [1900, 2550], [2370, 2280]],
    [[2370, 2280], [2600, 2050], [2900, 1780]],
    [[2100, 2300], [1900, 1900], [1760, 1660]],
    [[2500, 2300], [3000, 2500], [3300, 2740], [3450, 2770]],
    [[2050, 1800], [2150, 1300], [2130, 900], [2100, 640]],
    [[1760, 1660], [1400, 1500], [1150, 1150], [975, 940]],
  ];
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function distToRoad(x, y) {
  let m = 1e9;
  for (const r of World.roads) for (let i = 0; i < r.length - 1; i++) m = Math.min(m, distToSeg(x, y, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
  return m;
}

// --- static circle grid -------------------------------------------------------

function gridAdd(o) {
  const cx = clamp(Math.floor(o.x / World.gcell), 0, World.gw - 1), cy = clamp(Math.floor(o.y / World.gcell), 0, World.gh - 1);
  World.grid[cy * World.gw + cx].push(o);
}
function gridQuery(x, y, rad, out = []) {
  const g = World.gcell;
  const x0 = clamp(Math.floor((x - rad) / g), 0, World.gw - 1), x1 = clamp(Math.floor((x + rad) / g), 0, World.gw - 1);
  const y0 = clamp(Math.floor((y - rad) / g), 0, World.gh - 1), y1 = clamp(Math.floor((y + rad) / g), 0, World.gh - 1);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const c = World.grid[cy * World.gw + cx];
    for (let i = 0; i < c.length; i++) out.push(c[i]);
  }
  return out;
}

function generateWorld(seed) {
  const rnd = mulberry32(seed);
  Object.assign(World, { houses: [], walls: [], furn: [], res: [], stones: [], swamp: [], props: [], inter: [], lights: [] });
  buildHouses();
  buildRoads();

  // the car at the forest edge
  World.furn.push({ x: 330, y: 3850, w: 110, h: 56, kind: "car" });
  inter({ type: "car", x: 385, y: 3878, r: 80, full: true });

  // stone circle (Kapishche)
  const cx = 2100, cy = 430;
  World.altar = inter({ type: "altar", x: cx, y: cy, r: 70 });
  World.furn.push({ x: cx - 30, y: cy - 20, w: 60, h: 40, kind: "altarstone" });
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    World.stones.push({ x: cx + Math.cos(a) * 190, y: cy + Math.sin(a) * 190, r: 18, type: "stone" });
  }
  inter({ type: "note", key: "anya2", x: cx + 60, y: cy + 90, r: 40 });

  // swamp water around the witch's house
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = 180 + rnd() * 380;
    const x = 810 + Math.cos(a) * d, y = 940 + Math.sin(a) * d;
    if (insideHouse(x, y, 60) || distToRoad(x, y) < 50) continue;
    World.swamp.push({ x, y, r: 50 + rnd() * 70 });
  }

  World.gw = Math.ceil(WORLD_W / World.gcell); World.gh = Math.ceil(WORLD_H / World.gcell);
  World.grid = Array.from({ length: World.gw * World.gh }, () => []);
  World.stones.forEach(gridAdd);

  const okSpot = (x, y, near) => {
    if (x < 40 || y < 40 || x > WORLD_W - 40 || y > WORLD_H - 40) return false;
    if (insideHouse(x, y, 90)) return false;
    if (distToRoad(x, y) < 55) return false;
    if (dist2(x, y, cx, cy) < 290 * 290) return false;
    if (dist2(x, y, World.start.x, World.start.y) < 140 * 140) return false;
    if (dist2(x, y, 385, 3878) < 120 * 120) return false;
    for (const s of World.swamp) if (dist2(x, y, s.x, s.y) < (s.r + 10) ** 2) return false;
    for (const o of gridQuery(x, y, near)) if (dist2(x, y, o.x, o.y) < (near + o.r) ** 2 * 0.5) return false;
    return true;
  };
  const place = (n, fn) => { let tries = 0, k = 0; while (k < n && tries < n * 8) { tries++; const x = rnd() * WORLD_W, y = rnd() * WORLD_H; const o = fn(x, y); if (o) k++; } };

  place(1250, (x, y) => {
    if (!okSpot(x, y, 40)) return null;
    const dead = rnd() < 0.12;
    const o = { type: "tree", x, y, r: 9 + rnd() * 6, cr: dead ? 0 : 36 + rnd() * 26, dead, left: 4, max: 4, hue: rnd(), regrow: 0, block: true };
    World.res.push(o); gridAdd(o); return o;
  });
  place(170, (x, y) => {
    if (!okSpot(x, y, 50)) return null;
    const o = { type: "rock", x, y, r: 14 + rnd() * 12, left: 4, max: 4, regrow: 0, block: true, sh: rnd() };
    World.res.push(o); gridAdd(o); return o;
  });
  place(240, (x, y) => {
    if (!okSpot(x, y, 30)) return null;
    const o = { type: "bush", x, y, r: 14, left: 2, max: 2, regrow: 0, block: false, sh: rnd() };
    World.res.push(o); gridAdd(o); return o;
  });
  place(34, (x, y) => {
    if (!okSpot(x, y, 60)) return null;
    const o = { type: "scrap", x, y, r: 18, left: 5, max: 5, regrow: 0, block: true, sh: rnd() };
    World.res.push(o); gridAdd(o); return o;
  });
  // a couple of scrap heaps in the village
  [[2000, 2380], [2700, 2350], [1850, 1780], [3300, 2560]].forEach(([x, y]) => {
    const o = { type: "scrap", x, y, r: 20, left: 6, max: 6, regrow: 0, block: true, sh: rnd() };
    World.res.push(o); gridAdd(o);
  });
  // decorative grass / debris (no collision)
  for (let i = 0; i < 2600; i++) World.props.push({ x: rnd() * WORLD_W, y: rnd() * WORLD_H, k: rnd() < 0.85 ? 0 : 1, s: rnd() });

  buildNav();
}

// --- collision ------------------------------------------------------------------

function circleRect(cx, cy, r, R) {
  const nx = clamp(cx, R.x, R.x + R.w), ny = clamp(cy, R.y, R.y + R.h);
  const dx = cx - nx, dy = cy - ny, d = dx * dx + dy * dy;
  if (d >= r * r) return null;
  if (d > 1e-6) { const l = Math.sqrt(d); return { x: dx / l * (r - l), y: dy / l * (r - l) }; }
  // center inside rect: push out along the smallest axis
  const l = cx - R.x, rr = R.x + R.w - cx, t = cy - R.y, b = R.y + R.h - cy, m = Math.min(l, rr, t, b);
  if (m === l) return { x: -(l + r), y: 0 }; if (m === rr) return { x: rr + r, y: 0 };
  if (m === t) return { x: 0, y: -(t + r) }; return { x: 0, y: b + r };
}

const _q = [];
function collide(e) {
  // push entity circle out of walls, furniture and solid round things
  for (let it = 0; it < 2; it++) {
    for (const R of World.walls) {
      if (e.x + e.r < R.x || e.x - e.r > R.x + R.w || e.y + e.r < R.y || e.y - e.r > R.y + R.h) continue;
      const p = circleRect(e.x, e.y, e.r, R); if (p) { e.x += p.x; e.y += p.y; }
    }
    for (const R of World.furn) {
      if (e.x + e.r < R.x || e.x - e.r > R.x + R.w || e.y + e.r < R.y || e.y - e.r > R.y + R.h) continue;
      const p = circleRect(e.x, e.y, e.r, R); if (p) { e.x += p.x; e.y += p.y; }
    }
    _q.length = 0; gridQuery(e.x, e.y, e.r + 30, _q);
    for (const o of _q) {
      if (!o.block) continue;
      const rr = (o.type === "tree" ? o.r : o.r * 0.9) + e.r;
      const dx = e.x - o.x, dy = e.y - o.y, d = dx * dx + dy * dy;
      if (d < rr * rr && d > 1e-6) { const l = Math.sqrt(d); e.x += dx / l * (rr - l); e.y += dy / l * (rr - l); }
    }
  }
  e.x = clamp(e.x, 20, WORLD_W - 20); e.y = clamp(e.y, 20, WORLD_H - 20);
}

function inSwamp(x, y) {
  for (const s of World.swamp) if (dist2(x, y, s.x, s.y) < s.r * s.r * 0.8) return true;
  return false;
}

// --- rays (light, bullets, line of sight) -----------------------------------------

function rayRect(ox, oy, dx, dy, R, maxT) {
  let tmin = 0, tmax = maxT;
  if (Math.abs(dx) < 1e-9) { if (ox < R.x || ox > R.x + R.w) return maxT; }
  else { let t1 = (R.x - ox) / dx, t2 = (R.x + R.w - ox) / dx; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return maxT; }
  if (Math.abs(dy) < 1e-9) { if (oy < R.y || oy > R.y + R.h) return maxT; }
  else { let t1 = (R.y - oy) / dy, t2 = (R.y + R.h - oy) / dy; if (t1 > t2) [t1, t2] = [t2, t1]; tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return maxT; }
  return tmin > 0 ? tmin : maxT;
}
function rayCircle(ox, oy, dx, dy, cx, cy, r, maxT) {
  const fx = ox - cx, fy = oy - cy;
  const b = fx * dx + fy * dy, c = fx * fx + fy * fy - r * r;
  if (c < 0) return maxT; // origin inside: ignore
  const disc = b * b - c;
  if (disc < 0) return maxT;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < maxT ? t : maxT;
}

// blockers near a point, cached by the caller for a frame
function nearBlockers(x, y, rad) {
  const rects = World.walls.filter(R => R.x < x + rad && R.x + R.w > x - rad && R.y < y + rad && R.y + R.h > y - rad);
  const circles = gridQuery(x, y, rad).filter(o => o.block && (o.type === "tree" || o.type === "stone" || o.type === "rock"));
  return { rects, circles };
}

function castRay(ox, oy, a, maxT, bl) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = maxT;
  for (const R of bl.rects) t = Math.min(t, rayRect(ox, oy, dx, dy, R, t));
  for (const o of bl.circles) t = Math.min(t, rayCircle(ox, oy, dx, dy, o.x, o.y, o.type === "tree" ? o.r : o.r * 0.85, t));
  return t;
}

function wallBetween(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
  if (l < 1) return false;
  const ux = dx / l, uy = dy / l;
  for (const R of World.walls) {
    if (Math.max(ax, bx) < R.x || Math.min(ax, bx) > R.x + R.w || Math.max(ay, by) < R.y || Math.min(ay, by) > R.y + R.h) continue;
    if (rayRect(ax, ay, ux, uy, R, l) < l) return true;
  }
  return false;
}

// --- navigation flow field ----------------------------------------------------------

function buildNav() {
  const c = World.ncell;
  World.nw = Math.ceil(WORLD_W / c); World.nh = Math.ceil(WORLD_H / c);
  const n = World.nw * World.nh;
  World.nav = new Uint8Array(n);
  World.flow = new Int32Array(n).fill(-1);
  const pad = 9;
  const markRect = R => {
    const x0 = Math.floor((R.x - pad) / c), x1 = Math.floor((R.x + R.w + pad) / c);
    const y0 = Math.floor((R.y - pad) / c), y1 = Math.floor((R.y + R.h + pad) / c);
    for (let y = Math.max(0, y0); y <= Math.min(World.nh - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(World.nw - 1, x1); x++) {
        const px = x * c + c / 2, py = y * c + c / 2;
        if (px > R.x - pad && px < R.x + R.w + pad && py > R.y - pad && py < R.y + R.h + pad) World.nav[y * World.nw + x] = 1;
      }
  };
  World.walls.forEach(markRect);
  World.furn.forEach(markRect);
  const markCircle = o => {
    const r = o.r + 4;
    const x0 = Math.floor((o.x - r) / c), x1 = Math.floor((o.x + r) / c), y0 = Math.floor((o.y - r) / c), y1 = Math.floor((o.y + r) / c);
    for (let y = Math.max(0, y0); y <= Math.min(World.nh - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(World.nw - 1, x1); x++)
        if (dist2(x * c + c / 2, y * c + c / 2, o.x, o.y) < r * r) World.nav[y * World.nw + x] = 1;
  };
  World.res.forEach(o => { if (o.block) markCircle(o); });
  World.stones.forEach(markCircle);
}

const _bfsQ = new Int32Array(200 * 200);
function updateFlow(px, py, radiusCells = 46) {
  const c = World.ncell, W = World.nw, H = World.nh;
  const flow = World.flow;
  flow.fill(-1);
  let sx = clamp(Math.floor(px / c), 0, W - 1), sy = clamp(Math.floor(py / c), 0, H - 1);
  let head = 0, tail = 0;
  const s = sy * W + sx;
  flow[s] = 0; _bfsQ[tail++] = s;
  while (head < tail) {
    const i = _bfsQ[head++], x = i % W, y = (i / W) | 0, d = flow[i];
    if (Math.abs(x - sx) > radiusCells || Math.abs(y - sy) > radiusCells) continue;
    for (let k = 0; k < 4; k++) {
      const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (flow[j] !== -1 || World.nav[j]) continue;
      flow[j] = d + 1; _bfsQ[tail++] = j;
    }
  }
}

// direction toward the player following the flow field, or null
function flowDir(x, y) {
  const c = World.ncell, W = World.nw, H = World.nh;
  const cx = clamp(Math.floor(x / c), 0, W - 1), cy = clamp(Math.floor(y / c), 0, H - 1);
  const here = World.flow[cy * W + cx];
  let best = here === -1 ? 1e9 : here, bx = 0, by = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const v = World.flow[ny * W + nx];
    if (v === -1) continue;
    if (dx && dy && (World.nav[cy * W + nx] || World.nav[ny * W + cx])) continue; // no corner cutting
    if (v < best) { best = v; bx = dx; by = dy; }
  }
  if (!bx && !by) return null;
  const tx = (cx + bx) * c + c / 2 - x, ty = (cy + by) * c + c / 2 - y, l = Math.hypot(tx, ty) || 1;
  return { x: tx / l, y: ty / l };
}
