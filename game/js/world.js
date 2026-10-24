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
  const c = inter({ type: "crate", x: f.x + 15, y: f.y + 15, r: 38, house: h.id, full: true });
  return c;
}

function insideHouse(px, py, margin = 0) {
  for (const h of World.houses) if (px > h.x - margin && px < h.x + h.w + margin && py > h.y - margin && py < h.y + h.h + margin) return h;
  return null;
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

function exitTo(to, x, y, ax, ay, look, label) {
  const e = inter({ type: "exit", to, x, y, r: 70, ax, ay, look, label });
  World.exits.push(e);
  return e;
}
function wchest(x, y, weapon, give, label) {
  World.furn.push({ x: x - 22, y: y - 14, w: 44, h: 28, kind: "wchest" });
  return inter({ type: "wchest", x, y, r: 46, weapon, give, label, full: true });
}
function decor(k, x, y, a = 0, s = 1) { World.decor.push({ k, x, y, a, s }); }

// --- forest: the village of Black Pine (story hub) ---------------------------------

function buildForest(rnd) {
  World.start = { x: 430, y: 3800 };
  World.style = { base: "#1c2416", road: "dirt" };
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

  const hd = addHouse({ id: "headman", name: "Дом старосты", x: 2150, y: 1950, w: 440, h: 320, door: "s", floor: "#33281f", roof: "#3a1f1a",
    parts: [[0, 170, 440, 170, [180, 180 + DOOR]]] });
  furn(hd, 180, 60, 90, 50, "table");
  inter({ type: "note", key: "head", x: hd.x + 225, y: hd.y + 85, r: 50, step: 3 });
  furn(hd, 20, 20, 80, 30, "shelf"); furn(hd, 340, 20, 80, 30, "shelf");
  crate(hd, 20, 120); crate(hd, 390, 120); crate(hd, 380, 270); crate(hd, 20, 270);
  furn(hd, 40, 200, 90, 36, "table");

  const ch = addHouse({ id: "chapel", name: "Часовня", x: 2750, y: 1300, w: 300, h: 460, door: "s", floor: "#2c2a2a", roof: "#1f1f26", cross: true });
  furn(ch, 110, 30, 80, 40, "altar");
  for (let i = 1; i < 5; i++) { furn(ch, 25, 120 + i * 60, 95, 16, "pew"); furn(ch, 180, 120 + i * 60, 95, 16, "pew"); }
  exitTo("catacombs", ch.x + 150, ch.y + 115, ch.x + 150, ch.y + 175, "hatch", "Спуститься в катакомбы");
  inter({ type: "note", key: "priest", x: ch.x + 60, y: ch.y + 430, r: 40 });
  crate(ch, 255, 410);
  for (let i = 0; i < 14; i++) decor("cross", 3110 + (i % 4) * 55 + rnd() * 14, 1360 + Math.floor(i / 4) * 70 + rnd() * 14, (rnd() - 0.5) * 0.4);

  const sc = addHouse({ id: "school", name: "Старая школа", x: 1500, y: 1350, w: 520, h: 300, door: "s", floor: "#30302a", roof: "#262a22",
    parts: [[340, 0, 340, 300, [200, 200 + DOOR]]] });
  furn(sc, 40, 14, 200, 10, "board");
  inter({ type: "note", key: "school", x: sc.x + 140, y: sc.y + 40, r: 50 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) furn(sc, 40 + c * 70, 90 + r * 60, 40, 24, "desk");
  furn(sc, 380, 40, 100, 40, "table");
  wchest(sc.x + 472, sc.y + 254, "bat", {}, "Ящик учителя труда");
  crate(sc, 20, 250);
  decor("doll", sc.x + 60, sc.y + 120, 1.2);

  const hu = addHouse({ id: "hunter", name: "Хижина охотника", x: 3450, y: 2650, w: 300, h: 240, door: "w", floor: "#3a2d1e", roof: "#2a2418" });
  furn(hu, 200, 20, 80, 40, "bench");
  inter({ type: "bench", x: hu.x + 240, y: hu.y + 60, r: 50 });
  furn(hu, 120, 150, 60, 40, "table");
  inter({ type: "note", key: "hunter", x: hu.x + 150, y: hu.y + 170, r: 46 });
  crate(hu, 250, 190); crate(hu, 20, 20);

  World.roads = [
    [[380, 4000], [600, 3700], [700, 3560], [710, 3430]],
    [[650, 3640], [1100, 3300], [1500, 2900], [1900, 2550], [2370, 2280]],
    [[2370, 2280], [2600, 2050], [2900, 1780]],
    [[2100, 2300], [1900, 1900], [1760, 1660]],
    [[2500, 2300], [3000, 2500], [3300, 2740], [3450, 2770]],
    [[3300, 2740], [3400, 3000], [3800, 3060], [4000, 3060]],
    [[2050, 1800], [2150, 1300], [2130, 900], [2100, 640]],
    [[1760, 1660], [1400, 1500], [1100, 1150], [800, 860], [560, 640]],
    [[2900, 1780], [3200, 1450], [3480, 1170]],
  ];
  exitTo("swamp", 560, 640, 640, 720, "sign", "Старая дорога: Гнилые топи");
  exitTo("camp", 3940, 3060, 3850, 3060, "sign", "Дорога в лагерь «Зорька»");
  exitTo("mine", 3520, 1120, 3460, 1190, "mine", "Войти в старую шахту");
  for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.5; World.stones.push({ x: 3520 + Math.cos(a - Math.PI * 0.75) * 70, y: 1120 + Math.sin(a - Math.PI * 0.75) * 70, r: 22, type: "stone" }); }

  World.furn.push({ x: 330, y: 3850, w: 110, h: 56, kind: "car" });
  inter({ type: "car", x: 385, y: 3878, r: 80, full: true });

  const cx = 2100, cy = 430;
  World.altar = inter({ type: "altar", x: cx, y: cy, r: 70 });
  World.furn.push({ x: cx - 30, y: cy - 20, w: 60, h: 40, kind: "altarstone" });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; World.stones.push({ x: cx + Math.cos(a) * 190, y: cy + Math.sin(a) * 190, r: 18, type: "stone" }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; decor("totem", cx + Math.cos(a) * 280, cy + Math.sin(a) * 280, a + Math.PI); }
  inter({ type: "note", key: "anya2", x: cx + 60, y: cy + 90, r: 40 });
  World.keep.push({ x: cx, y: cy, r: 300 }, { x: 385, y: 3878, r: 120 }, { x: World.start.x, y: World.start.y, r: 140 }, { x: 3520, y: 1120, r: 110 });

  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2, d = 120 + rnd() * 330;
    const x = 760 + Math.cos(a) * d, y = 900 + Math.sin(a) * d;
    if (insideHouse(x, y, 60) || distToRoad(x, y) < 50) continue;
    World.swamp.push({ x, y, r: 50 + rnd() * 60 });
  }
  scatterNature(rnd, { trees: 1250, dead: 0.14, rocks: 170, bushes: 240, scrap: 34 });
  [[2000, 2380], [2700, 2350], [1850, 1780], [3300, 2560]].forEach(([x, y]) => addRes({ type: "scrap", x, y, r: 20, left: 6, max: 6, regrow: 0, block: true, sh: rnd() }));
  scatterHorror(rnd, { effigy: 26, hanged: 7, bones: 12, blood: 30, doll: 3 });
}

// --- the pioneer camp "Zorka" ---------------------------------------------------

function buildCamp(rnd) {
  World.style = { base: "#1e2618", road: "dirt" };
  World.start = { x: 230, y: 2000 };
  World.roads = [
    [[0, 2000], [700, 2000], [1300, 2050], [1950, 2050]],
    [[1950, 2050], [2600, 2600], [3300, 2880]],
    [[1950, 2050], [1950, 1780]], [[1350, 1780], [2550, 1780]],
    [[1950, 2050], [2350, 2100], [2700, 2120]],
    [[1730, 2050], [1730, 2260]], [[2380, 2100], [2380, 2340]],
  ];
  exitTo("forest", 110, 2000, 220, 2000, "sign", "Дорога назад, в Чёрную Сосну");
  exitTo("bunker", 3320, 2900, 3250, 2840, "bunker", "Спуститься в бункер");
  decor("gate", 700, 2000, 0);
  decor("flag", 1950, 1960, 0);
  for (let i = 0; i < 4; i++) {
    const h = addHouse({ id: "corpus" + i, name: "Корпус " + (i + 1), x: 1370 + i * 300, y: 1530, w: 230, h: 160, door: "s", floor: "#3a3026", roof: i % 2 ? "#3a2a22" : "#2a3226" });
    for (let b = 0; b < 3; b++) { furn(h, 18 + b * 72, 16, 34, 62, "bed"); }
    if (i % 2 === 0) crate(h, 190, 120);
    if (i === 2) decor("doll", h.x + 120, h.y + 110, 2.4);
  }
  const cn = addHouse({ id: "canteen", name: "Столовая", x: 1480, y: 2260, w: 480, h: 280, door: "n", floor: "#34302a", roof: "#30261e" });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) furn(cn, 50 + c * 140, 70 + r * 110, 100, 40, "table");
  furn(cn, 20, 230, 140, 34, "shelf");
  crate(cn, 420, 230); crate(cn, 200, 236);
  const md = addHouse({ id: "medic", name: "Медпункт", x: 2260, y: 2340, w: 260, h: 200, door: "n", floor: "#3a3a36", roof: "#4a2020" });
  furn(md, 150, 120, 90, 50, "table");
  furn(md, 20, 120, 34, 62, "bed");
  inter({ type: "seal", seal: "heart", x: md.x + 195, y: md.y + 145, r: 56, label: "Печать: Сердце-камень", guard: [["stalker", 2], ["ghoul", 2]] });
  inter({ type: "note", key: "camp", x: md.x + 60, y: md.y + 40, r: 40 });
  crate(md, 210, 20);
  const cl = addHouse({ id: "club", name: "Клуб", x: 2700, y: 1980, w: 320, h: 260, door: "w", floor: "#2e2a26", roof: "#262626" });
  furn(cl, 250, 20, 50, 220, "stage");
  for (let i = 0; i < 4; i++) furn(cl, 40, 30 + i * 55, 120, 14, "pew");
  wchest(cl.x + 212, cl.y + 130, "machete", {}, "Ящик у сцены");
  // the lake
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, d = rnd() * 220; World.swamp.push({ x: 2950 + Math.cos(a) * d, y: 1200 + Math.sin(a) * d * 0.7, r: 120 + rnd() * 90 }); }
  World.keep.push({ x: 1950, y: 2050, r: 140 }, { x: 3320, y: 2900, r: 110 }, { x: 230, y: 2000, r: 140 });
  World.clear.push({ x0: 1300, y0: 1450, x1: 3100, y1: 2620 });
  scatterNature(rnd, { trees: 1000, dead: 0.2, rocks: 120, bushes: 200, scrap: 26 });
  // twenty-two stick figures behind the canteen
  for (let i = 0; i < 22; i++) decor("effigy", 1500 + (i % 11) * 42 + rnd() * 10, 2620 + Math.floor(i / 11) * 40 + rnd() * 10, rnd() * 6, 0.8 + rnd() * 0.3);
  scatterHorror(rnd, { effigy: 14, hanged: 4, bones: 8, blood: 24, doll: 7 });
}

// --- the rotten swamp -----------------------------------------------------------

function buildSwamp(rnd) {
  World.style = { base: "#161a10", road: "planks" };
  World.start = { x: 3500, y: 3500 };
  World.roads = [
    [[3700, 3700], [3000, 3000], [2500, 2550], [2210, 1960]],
    [[2500, 2550], [2780, 2380]],
    [[3000, 3000], [2400, 3200]],
    [[2500, 2550], [1700, 2650], [1420, 2680]],
  ];
  exitTo("forest", 3640, 3640, 3500, 3500, "sign", "Тропа назад, в Чёрную Сосну");
  const wi = addHouse({ id: "witch", name: "Дом Агафьи", x: 1880, y: 1820, w: 320, h: 280, door: "e", floor: "#26281e", roof: "#1d2017" });
  furn(wi, 120, 100, 60, 60, "cauldron");
  inter({ type: "note", key: "witch", x: wi.x + 60, y: wi.y + 240, r: 40 });
  inter({ type: "seal", seal: "eye", x: wi.x + 150, y: wi.y + 130, r: 56, label: "Печать: Глаз", guard: [["brute", 1], ["spitter", 3]] });
  furn(wi, 20, 20, 80, 30, "shelf");
  crate(wi, 270, 20); crate(wi, 20, 230);
  World.lights.push({ x: wi.x + 150, y: wi.y + 130, r: 160, col: "120,255,140", flick: 0.15 });
  const r1 = addHouse({ id: "ruin1", name: "Гнилая изба", x: 2690, y: 2240, w: 200, h: 150, door: "s", floor: "#2a2a20", roof: "#1a1c14", ruin: true });
  crate(r1, 150, 20);
  inter({ type: "note", key: "swamp", x: r1.x + 60, y: r1.y + 60, r: 40 });
  const r2 = addHouse({ id: "ruin2", name: "Затопленный сарай", x: 1250, y: 2600, w: 200, h: 150, door: "e", floor: "#24261c", roof: "#1a1c14", ruin: true });
  crate(r2, 30, 30); crate(r2, 140, 100);
  const r3 = addHouse({ id: "ruin3", name: "Изба рыбака", x: 2250, y: 3130, w: 190, h: 140, door: "e", floor: "#24261c", roof: "#1a1c14", ruin: true });
  crate(r3, 20, 90);
  World.keep.push({ x: 3500, y: 3500, r: 160 }, { x: 2040, y: 1960, r: 260 });
  for (let i = 0; i < 130; i++) {
    const x = 200 + rnd() * 3600, y = 200 + rnd() * 3600;
    if (insideHouse(x, y, 90) || distToRoad(x, y) < 70 || World.keep.some(k => dist2(x, y, k.x, k.y) < (k.r + 60) ** 2)) continue;
    World.swamp.push({ x, y, r: 70 + rnd() * 120 });
  }
  scatterNature(rnd, { trees: 800, dead: 0.65, rocks: 60, bushes: 260, scrap: 14 });
  scatterHorror(rnd, { effigy: 18, hanged: 9, bones: 18, blood: 20, totem: 8 });
}

// --- dungeons: rooms and corridors carved out of a tile grid ---------------------

function buildDungeon(rnd, id) {
  const T = 40, COLS = 64, ROWS = 64, ox = 720, oy = 720, CELL = 10;
  World.style = { base: id === "bunker" ? "#2a2a28" : id === "mine" ? "#2a241c" : "#24221e", road: "none", floor: id };
  const floor = new Uint8Array(COLS * ROWS);
  const carve = (x0, y0, x1, y1) => { for (let y = Math.max(1, y0); y <= Math.min(ROWS - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(COLS - 2, x1); x++) floor[y * COLS + x] = 1; };
  // random walk over 6x6 cells, plus side branches
  const N = 6, used = new Map(), edges = [];
  const key = (cx, cy) => cy * N + cx;
  let cx = 0, cy = Math.floor(rnd() * N);
  used.set(key(cx, cy), { cx, cy, d: 0 });
  const dirs = [[1, 0], [0, 1], [0, -1], [-1, 0]];
  for (let i = 0; i < 40 && used.size < 11; i++) {
    const opts = dirs.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && !used.has(key(x, y)));
    if (!opts.length) { const all = [...used.values()]; const pick = all[Math.floor(rnd() * all.length)]; cx = pick.cx; cy = pick.cy; continue; }
    const [nx, ny] = opts[Math.floor(rnd() * opts.length * 0.999)];
    const d = used.get(key(cx, cy)).d + 1;
    used.set(key(nx, ny), { cx: nx, cy: ny, d });
    edges.push([key(cx, cy), key(nx, ny)]);
    cx = nx; cy = ny;
  }
  const rooms = new Map();
  for (const [k, c] of used) {
    const w = 4 + Math.floor(rnd() * 4), h = 4 + Math.floor(rnd() * 4);
    const x0 = c.cx * CELL + 1 + Math.floor(rnd() * (CELL - w - 1)), y0 = c.cy * CELL + 1 + Math.floor(rnd() * (CELL - h - 1));
    carve(x0, y0, x0 + w, y0 + h);
    rooms.set(k, { x0, y0, x1: x0 + w, y1: y0 + h, d: c.d, cx: (x0 + w / 2 + 0.5) * T + ox, cy: (y0 + h / 2 + 0.5) * T + oy });
  }
  const corridors = [];
  for (const [a, b] of edges) {
    const A = rooms.get(a), B = rooms.get(b);
    const ax = Math.floor((A.x0 + A.x1) / 2), ay = Math.floor((A.y0 + A.y1) / 2), bx = Math.floor((B.x0 + B.x1) / 2), by = Math.floor((B.y0 + B.y1) / 2);
    carve(Math.min(ax, bx), ay, Math.max(ax, bx), ay + 1);
    carve(bx, Math.min(ay, by), bx + 1, Math.max(ay, by));
    corridors.push({ ax, ay, bx, by });
  }
  // walls: solid tiles touching floor, merged into horizontal runs
  const isF = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && floor[y * COLS + x];
  for (let y = 0; y < ROWS; y++) {
    let run = -1;
    for (let x = 0; x <= COLS; x++) {
      let wall = false;
      if (x < COLS && !isF(x, y)) for (let dy = -1; dy <= 1 && !wall; dy++) for (let dx = -1; dx <= 1; dx++) if (isF(x + dx, y + dy)) { wall = true; break; }
      if (wall && run < 0) run = x;
      if (!wall && run >= 0) { World.walls.push({ x: ox + run * T, y: oy + y * T, w: (x - run) * T, h: T }); run = -1; }
    }
  }
  World.dungeon = { ox, oy, T, COLS, ROWS, floor };
  const list = [...rooms.values()].sort((a, b) => a.d - b.d);
  const start = list[0], end = list[list.length - 1];
  World.rooms = list;
  World.start = { x: start.cx, y: start.cy + 40 };
  exitTo(id === "bunker" ? "camp" : "forest", start.cx, start.cy - 20, start.cx, start.cy + 50, "ladder", "Подняться наверх");
  const tileXY = (r) => ({ x: ox + (r.x0 + 1 + rnd() * (r.x1 - r.x0 - 1)) * T, y: oy + (r.y0 + 1 + rnd() * (r.y1 - r.y0 - 1)) * T });
  // the prize at the end
  const prize = { catacombs: ["crossbow", { bolts: 10 }, "Ящик с арбалетом отца Михаила"], mine: ["pistol", { ammo9: 12 }, "Ящик в последнем забое"], bunker: ["shotgun", { shells: 8 }, "Оружейный ящик"] }[id];
  wchest(end.cx + 30, end.cy, prize[0], prize[1], prize[2]);
  if (id === "catacombs") inter({ type: "seal", seal: "bone", x: end.cx - 40, y: end.cy, r: 56, label: "Печать: Кость", guard: [["ghoul", 3], ["crawler", 2]] });
  World.endRoom = end;
  const mid = list[Math.floor(list.length / 2)];
  inter({ type: "note", key: id, x: mid.cx, y: mid.cy, r: 40 });
  for (const r of list) {
    if (r === start) continue;
    if (rnd() < 0.7) { const p = tileXY(r); World.furn.push({ x: p.x - 15, y: p.y - 15, w: 30, h: 30, kind: "crate" }); inter({ type: "crate", x: p.x, y: p.y, r: 38, full: true }); }
    if (rnd() < 0.55 || r === end) World.lights.push({ x: r.cx + (rnd() - 0.5) * 60, y: r.cy + (rnd() - 0.5) * 60, r: 200, col: id === "bunker" ? "200,220,255" : "255,170,90", flick: id === "bunker" ? 0.5 : 0.12, torch: id !== "bunker" });
    // decor by dungeon type
    for (let i = 0; i < 3; i++) {
      const p = tileXY(r);
      if (dist2(p.x, p.y, r.cx, r.cy) < 50 * 50) continue;
      if (id === "catacombs") { if (rnd() < 0.5) { World.furn.push({ x: p.x - 20, y: p.y - 40, w: 40, h: 80, kind: "coffin" }); } else decor("bones", p.x, p.y, rnd() * 6); }
      else if (id === "mine") { if (rnd() < 0.4) World.furn.push({ x: p.x - 18, y: p.y - 26, w: 36, h: 52, kind: "cart" }); else decor("bones", p.x, p.y, rnd() * 6, 0.8); }
      else { if (rnd() < 0.5) World.furn.push({ x: p.x - 16, y: p.y - 16, w: 32, h: 32, kind: "barrel" }); else World.furn.push({ x: p.x - 40, y: p.y - 14, w: 80, h: 28, kind: "shelf" }); }
    }
    for (let i = 0; i < 3; i++) { const p = tileXY(r); World.blood.push({ x: p.x, y: p.y, r: 10 + rnd() * 22 }); }
  }
  // traps: spikes in corridors, hidden bear traps in rooms, tripwires across corridors
  corridors.forEach((c, i) => {
    const horizLen = Math.abs(c.bx - c.ax), vertLen = Math.abs(c.by - c.ay);
    if (horizLen > 4 && rnd() < 0.7) {
      const tx = Math.min(c.ax, c.bx) + 2 + Math.floor(rnd() * (horizLen - 3));
      if (rnd() < 0.6) World.hazards.push({ kind: "spikes", x: ox + (tx + 0.5) * T, y: oy + (c.ay + 1) * T, w: T * 1.6, h: T * 2, ph: rnd() * 3.4 });
      else World.hazards.push({ kind: "wire", x1: ox + (tx + 0.5) * T, y1: oy + c.ay * T + 4, x2: ox + (tx + 0.5) * T, y2: oy + (c.ay + 2) * T - 4, armed: true });
    }
    if (vertLen > 4 && rnd() < 0.6) {
      const ty = Math.min(c.ay, c.by) + 2 + Math.floor(rnd() * (vertLen - 3));
      if (rnd() < 0.5) World.hazards.push({ kind: "spikes", x: ox + (c.bx + 1) * T, y: oy + (ty + 0.5) * T, w: T * 2, h: T * 1.6, ph: rnd() * 3.4 });
      else World.hazards.push({ kind: "wire", x1: ox + c.bx * T + 4, y1: oy + (ty + 0.5) * T, x2: ox + (c.bx + 2) * T - 4, y2: oy + (ty + 0.5) * T, armed: true });
    }
  });
  for (const r of list) if (r !== start && rnd() < 0.65) { const p = tileXY(r); World.hazards.push({ kind: "bear", x: p.x, y: p.y, armed: true }); }
}

// --- shared scatter helpers ---------------------------------------------------------

function addRes(o) { World.res.push(o); gridAdd(o); return o; }

function scatterNature(rnd, o) {
  const okSpot = (x, y, near) => {
    if (x < 40 || y < 40 || x > WORLD_W - 40 || y > WORLD_H - 40) return false;
    if (insideHouse(x, y, 90)) return false;
    if (distToRoad(x, y) < 55) return false;
    for (const k of World.keep) if (dist2(x, y, k.x, k.y) < k.r * k.r) return false;
    for (const e of World.exits) if (dist2(x, y, e.x, e.y) < 120 * 120) return false;
    for (const c of World.clear) if (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1 && rnd() < 0.85) return false;
    for (const s of World.swamp) if (dist2(x, y, s.x, s.y) < (s.r + 10) ** 2) return false;
    for (const q of gridQuery(x, y, near)) if (dist2(x, y, q.x, q.y) < (near + q.r) ** 2 * 0.5) return false;
    return true;
  };
  const place = (n, fn) => { let tries = 0, k = 0; while (k < n && tries < n * 8) { tries++; const x = rnd() * WORLD_W, y = rnd() * WORLD_H; if (fn(x, y)) k++; } };
  place(o.trees, (x, y) => {
    if (!okSpot(x, y, 40)) return null;
    const dead = rnd() < o.dead;
    return addRes({ type: "tree", x, y, r: 9 + rnd() * 6, cr: dead ? 0 : 36 + rnd() * 26, dead, left: 4, max: 4, hue: rnd(), regrow: 0, block: true });
  });
  place(o.rocks, (x, y) => okSpot(x, y, 50) && addRes({ type: "rock", x, y, r: 14 + rnd() * 12, left: 4, max: 4, regrow: 0, block: true, sh: rnd() }));
  place(o.bushes, (x, y) => okSpot(x, y, 30) && addRes({ type: "bush", x, y, r: 14, left: 2, max: 2, regrow: 0, block: false, sh: rnd() }));
  place(o.scrap, (x, y) => okSpot(x, y, 60) && addRes({ type: "scrap", x, y, r: 18, left: 5, max: 5, regrow: 0, block: true, sh: rnd() }));
  for (let i = 0; i < 2600; i++) World.props.push({ x: rnd() * WORLD_W, y: rnd() * WORLD_H, k: rnd() < 0.85 ? 0 : 1, s: rnd() });
}

// creepy dressing: stick figures and bodies hang from trees, bones and blood on the ground
function scatterHorror(rnd, o) {
  const trees = World.res.filter(r => r.type === "tree" && !r.dead);
  const nearTree = () => trees[Math.floor(rnd() * trees.length)];
  for (let i = 0; i < (o.effigy || 0); i++) { const t = nearTree(); if (t) decor("effigy", t.x + 14, t.y + 14, rnd() * 6, 0.8 + rnd() * 0.5); }
  for (let i = 0; i < (o.hanged || 0); i++) { const t = nearTree(); if (t) decor("hanged", t.x + 26, t.y, rnd() * 6); }
  const ground = () => { for (let k = 0; k < 20; k++) { const x = 100 + rnd() * 3800, y = 100 + rnd() * 3800; if (!insideHouse(x, y, 10) && !World.swamp.some(s => dist2(x, y, s.x, s.y) < s.r * s.r)) return { x, y }; } return { x: 2000, y: 2000 }; };
  for (let i = 0; i < (o.bones || 0); i++) { const p = ground(); decor("bones", p.x, p.y, rnd() * 6); }
  for (let i = 0; i < (o.totem || 0); i++) { const p = ground(); decor("totem", p.x, p.y, rnd() * 6); }
  for (let i = 0; i < (o.doll || 0); i++) { const t = nearTree(); if (t) decor("doll", t.x + 20, t.y + 10, rnd() * 6); }
  for (let i = 0; i < (o.blood || 0); i++) { const p = ground(); for (let k = 0; k < 4; k++) World.blood.push({ x: p.x + (rnd() - 0.5) * 50, y: p.y + (rnd() - 0.5) * 50, r: 6 + rnd() * 18 }); }
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

function generateWorld(seed, mapId = "forest") {
  const base = { forest: 0, camp: 101, swamp: 202, catacombs: 303, mine: 404, bunker: 505 }[mapId] || 0;
  const rnd = mulberry32(seed + base);
  Object.assign(World, { map: mapId, indoor: MAPS[mapId].kind === "dungeon", houses: [], walls: [], furn: [], res: [], stones: [], swamp: [], props: [], inter: [], lights: [],
    roads: [], exits: [], decor: [], blood: [], hazards: [], keep: [], clear: [], rooms: [], dungeon: null, endRoom: null, altar: null });
  World.gw = Math.ceil(WORLD_W / World.gcell); World.gh = Math.ceil(WORLD_H / World.gcell);
  World.grid = Array.from({ length: World.gw * World.gh }, () => []);
  if (mapId === "forest") buildForest(rnd);
  else if (mapId === "camp") buildCamp(rnd);
  else if (mapId === "swamp") buildSwamp(rnd);
  else buildDungeon(rnd, mapId);
  World.stones.forEach(gridAdd);
  buildNav();
  // in a dungeon everything that is not carved floor is solid rock
  if (World.dungeon) {
    const D = World.dungeon, c = World.ncell;
    for (let y = 0; y < World.nh; y++) for (let x = 0; x < World.nw; x++) {
      const tx = Math.floor((x * c + c / 2 - D.ox) / D.T), ty = Math.floor((y * c + c / 2 - D.oy) / D.T);
      if (tx < 0 || ty < 0 || tx >= D.COLS || ty >= D.ROWS || !D.floor[ty * D.COLS + tx]) World.nav[y * World.nw + x] = 1;
    }
  }
  World.dirty = true;
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
