"use strict";
// Game state and simulation.

const WORLD_V = 2;
const SAVE_KEY = "blackpine.save.v3";
const FLASH_RANGE = 440, FLASH_HALF = 0.5, FLASH_RAYS = 72, HALO_R = 85;

const G = {
  state: "title", seed: 1, t: 15 / 24, day: 1, step: 0,
  p: null, mons: [], projs: [], parts: [], decals: [], tracers: [], fires: [], traps: [], drops: [], roots: [],
  inv: {}, owned: ["knife"], mag: {}, wi: 0, notes: [], seals: [], placed: false, discovered: {},
  msgs: [], shake: 0, flash: 0, hurtFlash: 0, lightOff: 0, noise: null, spawnT: 5, flowT: 0, hallT: 15, whisperT: 20,
  rays: [], night: 0, maps: {}, watchers: [], figure: null, ambT: 8, watchT: 15, figT: 60, storm: 0, stormOn: false, stormT: 240, bolt: 0, boltT: 6, interf: 0, scare: null, scareCd: 20, spotCd: 0, tips: [], tip: null,
  boss: null, endT: 0, bossDead: false, inside: null, swingT: 0,
  input: { up: 0, down: 0, left: 0, right: 0, sprint: false, attack: false, interact: false, mvX: 0, mvY: 0 },
};

function newPlayer() {
  return { x: World.start.x, y: World.start.y, r: 12, a: -Math.PI / 2, pitch: 0, hp: 100, sta: 100, san: 100, bat: 100, food: 100, light: true, isPlayer: true,
    atkCd: 0, reloadT: 0, iframe: 0, staLock: 0, stepT: 0, act: null, actProg: 0, actTick: 0, moving: false };
}

// one-time hints; shown in their own box so they do not get lost among pickups
function tip(key, text, icon) {
  if (G.tips.includes(key)) return;
  G.tips.push(key);
  G.tip = { text, t: 9, icon: icon || "💡" };
}
const K = (touch, key) => Input.touch ? touch : key;

// jump scare: a face fills the screen with a scream
function screamer(kind) {
  if (!Settings.scares || G.scareCd > 0 || G.state !== "play") return;
  G.scare = { t: 0.8, max: 0.8, kind, seed: Math.random() };
  G.scareCd = 35;
  G.shake = Math.max(G.shake, 22);
  G.p.san = Math.max(0, G.p.san - 5);
  Sound.screamer();
}

function toast(text, dur = 3.5) {
  G.msgs.push({ text, t: dur, max: dur });
  if (G.msgs.length > 4) G.msgs.shift();
}

function addItem(k, q = 1, silent = false) {
  G.inv[k] = (G.inv[k] || 0) + q;
  // pickups go to a small feed in the corner instead of the middle of the screen
  if (!silent) {
    G.feed = G.feed || [];
    const f = G.feed.find(x => x.k === k);
    if (f) { f.q += q; f.t = 2.5; } else { G.feed.push({ k, q, t: 2.5 }); if (G.feed.length > 3) G.feed.shift(); }
  }
}
function has(need) { for (const k in need) if ((G.inv[k] || 0) < need[k]) return false; return true; }
function take(need) { for (const k in need) G.inv[k] -= need[k]; }

function nightFactor(t) {
  const h = t * 24;
  if (h < 4) return 1; if (h < 7) return 1 - (h - 4) / 3; if (h < 18) return 0; if (h < 21.5) return (h - 18) / 3.5; return 1;
}
function clock() {
  const m = Math.floor(G.t * 24 * 60);
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

// --- new game / save / load ----------------------------------------------------

function newGame() {
  G.seed = 1337;
  generateWorld(G.seed, "forest");
  Object.assign(G, { t: 15 / 24, day: 1, step: 0, mons: [], projs: [], parts: [], decals: [], tracers: [], fires: [], traps: [], drops: [], roots: [],
    inv: { bandage: 1 }, quick: ["bandage", null, null, null], power: {}, owned: ["knife"], mag: {}, wi: 0, notes: [], seals: [], placed: false, discovered: {}, msgs: [],
    boss: null, endT: 0, bossDead: false, spawnT: 8, hallT: 25, lightOff: 0, maps: {}, watchers: [], figure: null, ambT: 8, watchT: 20, figT: 70,
    storm: 0, stormOn: false, stormT: 200 + Math.random() * 200, bolt: 0, boltT: 6, interf: 0, scare: null, scareCd: 30, spotCd: 0, tips: [], tip: null });
  G.p = newPlayer();
  Object.assign(G, { car: makeCar(), base: null, builds: [], place: null, fishing: null, drive: false, lastStep: 0, objBanner: null, lastRegion: null, drop: null, nextDrop: 3, raidDay: 0, voiceCd: 0 });
}

// what changes on a map (resources, crates, fires, traps) is kept per map while you are elsewhere
function snapMap() {
  const res = [];
  World.res.forEach((o, i) => { if (o.left < o.max || o.regrow) res.push([i, o.left, o.regrow]); });
  return { res, it: World.inter.map(o => (o.full === false ? 1 : 0) | (o.taken ? 2 : 0)), hz: World.hazards.map(h => h.armed === false ? 1 : 0),
    fires: G.fires, traps: G.traps, day: G.day, builds: G.builds.map(b => ({ k: b.k, x: b.x, y: b.y, rot: b.rot, hp: b.hp, ammo: b.ammo, plant: b.plant, grow: b.grow })) };
}
function applyMap(m) {
  if (!m) { G.builds = []; return; }
  for (const [i, left, regrow] of m.res) if (World.res[i]) { World.res[i].left = left; World.res[i].regrow = regrow; if (left <= 0 && World.res[i].type !== "tree" && World.res[i].type !== "bush") World.res[i].block = false; }
  (m.it || []).forEach((f, i) => { const o = World.inter[i]; if (!o) return; if (f & 1) o.full = false; if (f & 2) o.taken = true; });
  (m.hz || []).forEach((f, i) => { if (f && World.hazards[i]) World.hazards[i].armed = false; });
  G.fires = m.fires || []; G.traps = m.traps || [];
  G.builds = (m.builds || []).map(b => Object.assign({}, b));
  registerBuilds();
  // days passed while away: things regrow and some crates fill up
  for (let d = (m.day || G.day); d < G.day; d++) {
    for (const o of World.res) if (o.regrow && o.regrow <= G.day) { o.left = o.max; o.regrow = 0; o.block = o.type !== "bush"; }
    for (const o of World.inter) if (o.type === "crate" && !o.full && Math.random() < 0.5) o.full = true;
  }
  World.dirty = true;
}

function save() {
  cancelPlace();
  try {
    const p = G.p;
    G.maps[World.map] = snapMap();
    const data = { v: 3, seed: G.seed, map: World.map, maps: G.maps, t: G.t, day: G.day, step: G.step, inv: G.inv, owned: G.owned, mag: G.mag, wi: G.wi, notes: G.notes,
      seals: G.seals, placed: G.placed, tips: G.tips, discovered: G.discovered, car: G.car, base: G.base, drive: G.drive, drop: G.drop, nextDrop: G.nextDrop, raidDay: G.raidDay, quick: G.quick, power: G.power, wv: WORLD_V,
      p: { x: p.x, y: p.y, a: p.a, hp: p.hp, san: p.san, bat: p.bat, food: p.food, light: p.light } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch (e) { d = null; }
  if (!d || d.v !== 3) return false;
  newGame();
  G.seed = d.seed;
  generateWorld(d.seed, d.map || "forest");
  Object.assign(G, { t: d.t, day: d.day, step: d.step, inv: d.inv, owned: d.owned, mag: d.mag, wi: d.wi, notes: d.notes, seals: d.seals,
    placed: d.placed, discovered: d.discovered || {}, tips: d.tips || [], maps: d.maps || {}, car: Object.assign(makeCar(), d.car || {}), base: d.base || null, drive: !!d.drive && d.car && d.car.map === d.map, drop: d.drop || null, nextDrop: d.nextDrop || 3, raidDay: d.raidDay || 0, quick: d.quick || ["bandage", null, null, null], power: d.power || {} });
  // the world layout changed since this save: keep builds and things, forget per-object states
  if (d.wv !== WORLD_V) for (const k in G.maps) { G.maps[k].res = []; G.maps[k].it = []; G.maps[k].hz = []; }
  if (G.drop && G.drop.landed && !G.drop.looted) placeDropCrate();
  applyMap(G.maps[World.map]);
  Object.assign(G.p, d.p);
  G.p.light = true;
  populateMap();
  if (typeof rebuildWorld3d === "function") rebuildWorld3d();
  return true;
}

// move to another location through an exit
function travel(to) {
  cancelPlace();
  const from = World.map;
  G.maps[from] = snapMap();
  G.state = "travel";
  UI.fade(() => {
    generateWorld(G.seed, to);
    Object.assign(G, { mons: [], projs: [], drops: [], decals: [], roots: [], tracers: [], parts: [], watchers: [], figure: null, boss: G.bossDead ? null : G.boss, fires: [], traps: [], builds: [], place: null, fishing: null });
    if (G.boss && !G.bossDead) G.boss = null;
    applyMap(G.maps[to]);
    const back = World.exits.find(e => e.to === from) || World.exits[0];
    G.p.x = back ? back.ax : World.start.x; G.p.y = back ? back.ay : World.start.y;
    if (back) G.p.a = Math.atan2(back.ay - back.y, back.ax - back.x);
    G.p.pitch = 0;
    populateMap();
    rebuildWorld3d();
    G.state = "play";
    save();
    toast(MAPS[to].n, 3.5);
    if (World.indoor) tip("dungeon", "Подземелье. Здесь ловушки: шипы в полу, спрятанные капканы и растяжки. Свети под ноги. В конце — оружейный ящик.");
    Sound.sting();
  });
}

// dungeons start inhabited
function populateMap() {
  if (!World.indoor) return;
  for (const r of World.rooms.slice(1)) {
    if (Math.random() < 0.55) { const m = spawnMonster(pickType(), r.cx + (Math.random() - 0.5) * 60, r.cy + (Math.random() - 0.5) * 60); m.aggro = 0; }
  }
  if (World.endRoom && !G.maps[World.map]) for (let i = 0; i < 2; i++) { const m = spawnMonster(World.map === "bunker" ? "brute" : pickType(), World.endRoom.cx + (i ? 40 : -40), World.endRoom.cy + 30); m.aggro = 0; }
}

// --- weapons -------------------------------------------------------------------

function curW() { return WEAPONS[W_IDX[G.owned[G.wi]]]; }
function bestTool(key) { let b = 0.25; for (const id of G.owned) { const w = WEAPONS[W_IDX[id]]; if (w[key]) b = Math.max(b, w[key]); } return b; }

function giveWeapon(id) {
  if (!G.owned.includes(id)) {
    G.owned.push(id);
    G.owned.sort((a, b) => W_IDX[a] - W_IDX[b]);
  }
  G.wi = G.owned.indexOf(id);
  const w = WEAPONS[W_IDX[id]];
  if (w.mag && G.mag[id] == null) G.mag[id] = 0;
}

function switchWeapon(i) {
  if (i < 0 || i >= G.owned.length || i === G.wi) return;
  G.wi = i; G.p.reloadT = 0; G.p.atkCd = Math.max(G.p.atkCd, 0.15);
  Sound.click();
}
function cycleWeapon(d) { const n = G.owned.length; switchWeapon(((G.wi + d) % n + n) % n); }

function startReload() {
  const w = curW(), p = G.p;
  if (!w.mag || p.reloadT > 0) return;
  if ((G.mag[w.id] || 0) >= w.mag || !(G.inv[w.ammo] > 0)) return;
  p.reloadT = w.reload; Sound.reload();
}
function finishReload() {
  const w = curW();
  const need = w.mag - (G.mag[w.id] || 0), got = Math.min(need, G.inv[w.ammo] || 0);
  G.mag[w.id] = (G.mag[w.id] || 0) + got; G.inv[w.ammo] -= got;
}

function aimPoint() {
  const p = G.p;
  const d = clamp(260 + (p.pitch || 0) * 300, 120, 360);
  return { x: p.x + Math.cos(p.a) * d, y: p.y + Math.sin(p.a) * d };
}

// on touch screens, nudge the aim toward a creature close to the crosshair
function assistAim(range) {
  if (!Input.touch) return;
  const p = G.p;
  let best = null, ba = 0.16;
  for (const m of G.mons) {
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > range + m.r) continue;
    const da = Math.abs(angDiff(p.a, Math.atan2(m.y - p.y, m.x - p.x)));
    if (da < ba && !wallBetween(p.x, p.y, m.x, m.y)) { ba = da; best = m; }
  }
  if (best) p.a = Math.atan2(best.y - p.y, best.x - p.x);
}

function makeNoise(x, y, r) { G.noise = { x, y, r, t: 0.5 }; }

function attack() {
  const p = G.p, w = curW();
  if (p.atkCd > 0 || p.reloadT > 0) return;
  if (w.kind === "melee") {
    assistAim(w.range + 30);
    p.atkCd = w.cd; G.swingT = 0.18; Sound.swing();
    let hit = false;
    for (const m of G.mons) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > w.range + m.r) continue;
      if (Math.abs(angDiff(p.a, Math.atan2(m.y - p.y, m.x - p.x))) > w.arc / 2 + m.r / Math.max(d, 1)) continue;
      if (wallBetween(p.x, p.y, m.x, m.y)) continue;
      damage(m, w.dmg, (m.x - p.x) / (d || 1) * w.kb, (m.y - p.y) / (d || 1) * w.kb);
      hit = true;
    }
    if (hit) { Sound.hit(); G.shake = Math.max(G.shake, 3); }
    makeNoise(p.x, p.y, 200);
    return;
  }
  if (w.kind === "throw") {
    if (!(G.inv.molotov > 0)) { toast("Нет коктейлей Молотова", 1.5); p.atkCd = 0.5; return; }
    G.inv.molotov--; p.atkCd = w.cd; G.kick = 1;
    const t = aimPoint(); let dx = t.x - p.x, dy = t.y - p.y; const l = Math.hypot(dx, dy) || 1;
    const d = Math.min(l, 360);
    G.projs.push({ kind: "bottle", sx: p.x, sy: p.y, tx: p.x + dx / l * d, ty: p.y + dy / l * d, t: 0, dur: 0.25 + d / 900, x: p.x, y: p.y });
    Sound.swing();
    return;
  }
  // guns and crossbow
  const m = G.mag[w.id] || 0;
  if (m > 0) assistAim(w.kind === "bow" ? 900 : w.range);
  if (m <= 0) {
    if (G.inv[w.ammo] > 0) startReload(); else { Sound.click(); p.atkCd = 0.3; toast(`Нет боеприпасов: ${ITEMS[w.ammo].n}`, 1.5); }
    return;
  }
  G.mag[w.id] = m - 1; p.atkCd = w.cd; G.kick = 1;
  const mx = p.x + Math.cos(p.a) * 18, my = p.y + Math.sin(p.a) * 18;
  if (w.kind === "bow") {
    G.projs.push({ kind: "bolt", x: mx, y: my, vx: Math.cos(p.a) * w.speed, vy: Math.sin(p.a) * w.speed, dmg: w.dmg, life: 0.9, pierce: 3, hit: [] });
    Sound.bow(); makeNoise(p.x, p.y, w.noise);
    return;
  }
  w.id === "shotgun" ? Sound.shotgun() : Sound.shot();
  Sound.casing(); G.recoil = w.id === "shotgun" ? 1 : 0.5;
  // a hot casing flies out to the right and bounces
  { const ea = p.a + 1.5 + (Math.random() - 0.5) * 0.4; G.parts.push({ x: p.x + Math.cos(p.a) * 14 + Math.cos(p.a + 1.57) * 8, y: p.y + Math.sin(p.a) * 14 + Math.sin(p.a + 1.57) * 8, vx: Math.cos(ea) * 110, vy: Math.sin(ea) * 110, life: 2.5, max: 2.5, col: w.id === "shotgun" ? "#b02818" : "#c8a040", size: 2.2, z: 52, vz: 90, bounce: true }); }
  makeNoise(p.x, p.y, w.noise);
  G.flash = 0.07; G.shake = Math.max(G.shake, w.id === "shotgun" ? 9 : 4);
  const bl = nearBlockers(p.x, p.y, w.range);
  for (let k = 0; k < w.pellets; k++) {
    const a = p.a + (Math.random() - 0.5) * w.spread;
    const dx = Math.cos(a), dy = Math.sin(a);
    let t = castRay(mx, my, a, w.range, bl), target = null;
    for (const mo of G.mons) {
      const tt = rayCircle(mx, my, dx, dy, mo.x, mo.y, mo.r + 2, t);
      if (tt < t) { t = tt; target = mo; }
    }
    G.tracers.push({ x1: mx, y1: my, x2: mx + dx * t, y2: my + dy * t, life: 0.08 });
    if (target) {
      const fall = w.id === "shotgun" ? clamp(1.25 - t / w.range, 0.35, 1) : 1;
      damage(target, w.dmg * fall, dx * 90, dy * 90);
    } else {
      for (let i = 0; i < 3; i++) spark(mx + dx * t, my + dy * t, "#d9c79a");
    }
  }
}

function spark(x, y, col, n = 1, spd = 120, life = 0.3, size = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, col, size });
  }
}
function blood(x, y, n = 6, col = "#5a0c0c") {
  spark(x, y, col, n, 160, 0.45, 2.5);
  G.decals.push({ x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10, r: 6 + Math.random() * 10, a: 0.7, col });
  if (G.decals.length > 180) G.decals.shift();
}

// --- monsters --------------------------------------------------------------------

function spawnMonster(type, x, y, extra = {}) {
  const d = MONSTERS[type];
  const hpMul = type === "boss" ? 1 : 1 + (G.day - 1) * 0.12;
  const m = Object.assign({ type, x, y, r: d.r, hp: d.hp * hpMul, max: d.hp * hpMul, a: Math.random() * 6.28, state: "wander", aggro: 0,
    atkT: 0, wind: 0, stun: 0, kx: 0, ky: 0, hitF: 0, wx: x, wy: y, wT: 0, losT: 0, los: false, lit: false, beam: false,
    spitT: 2, sumT: 6, rootT: 8, darkT: 12, chargeT: 9, charge: 0, step: Math.random() * 10, growlT: 3 + Math.random() * 8, burn: 0 }, extra);
  G.mons.push(m);
  return m;
}

function freeSpot(cx, cy, minD, maxD, allowHouse = false, avoidLight = true) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    if (x < 40 || y < 40 || x > World.W - 40 || y > World.H - 40) continue;
    const ci = Math.floor(y / World.ncell) * World.nw + Math.floor(x / World.ncell);
    if (World.nav[ci]) continue;
    if (!allowHouse && insideHouse(x, y, 30)) continue;
    if (avoidLight) {
      let bad = false;
      if (G.night < 0.5 && inBase(x, y)) bad = true;
      for (const b of G.builds) if (b.k === "light" && dist2(x, y, b.x, b.y) < 600 * 600) bad = true;
      for (const f of G.fires) if (dist2(x, y, f.x, f.y) < 420 * 420) bad = true;
      for (const l of World.lights) if (lightOn(l) && dist2(x, y, l.x, l.y) < (l.r + 260) ** 2) bad = true;
      if (bad) continue;
      if (isBeamLit(x, y, 20)) continue;
    }
    return { x, y };
  }
  return null;
}

function pickType() {
  const n = G.night > 0.5, d = G.day;
  const reg = World.indoor ? null : regionAt(G.p.x, G.p.y);
  const custom = (reg && reg.spawn) || MAPS[World.map].spawn;
  const w = custom ? Object.assign({}, custom) : n
    ? { crawler: 40, ghoul: 30, spitter: 12 + d * 2, stalker: d >= 2 ? 8 + d * 2 : 3, brute: d >= 2 ? 4 + d * 2 : 1 }
    : { crawler: 55, ghoul: 40, spitter: 10, brute: d >= 3 ? 4 : 0 };
  let s = 0; for (const k in w) s += w[k];
  let r = Math.random() * s;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return "crawler";
}

function spawnTick(dt) {
  if (G.step >= 7) return;
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  const night = G.night > 0.5;
  // day is quiet, night is not
  G.spawnT = World.indoor ? 7 : night ? Math.max(2, 3.6 - G.day * 0.25) : 20;
  const free = G.mons.filter(m => !m.guard && !m.fake && m.type !== "boss" && m.type !== "lord").length;
  const cap = World.indoor ? 5 + G.day : night ? Math.min(7 + G.day * 2, 18) : 2;
  if (free >= cap) return;
  // the very first minutes are calm
  if ((G.clock || 0) < 60 && !night) return;
  const s = World.indoor ? freeSpot(G.p.x, G.p.y, 450, 800) : freeSpot(G.p.x, G.p.y, 640, 950);
  if (!s) return;
  const type = pickType();
  if (type === "stalker" && !night) return;
  const m = spawnMonster(type, s.x, s.y);
  if (night && Math.random() < 0.5) { m.state = "chase"; m.aggro = 6; }
}

function damage(m, dmg, kx = 0, ky = 0, fire = false) {
  if (m.dead) return;
  if (m.fake) { vanish(m); return; }
  if (m.type === "lord") {
    // it cannot be killed; a hard enough blow only staggers it for a moment
    m.hitF = 0.12; spark(m.x, m.y, "#3a2a1a", 4, 80);
    if (dmg >= 20 && !(m.stunCd > G.clock)) { m.stun = 0.6; m.stunCd = G.clock + 4; }
    if (m.state !== "hunt" && dist2(m.x, m.y, G.p.x, G.p.y) < 1200 * 1200) { m.state = "hunt"; m.lastX = G.p.x; m.lastY = G.p.y; m.lostT = 0; lordSpotted(m); }
    tip("lordhit", "Его не убить. Только задержать на миг. Беги!", "⚠");
    return;
  }
  let mul = 1;
  if (m.type === "stalker" && m.beam) mul = 1.6;
  if (fire && m.type === "boss") mul = 2;
  m.hp -= dmg * mul;
  m.hitF = 0.12;
  m.aggro = 10; m.state = "chase";
  const kbm = m.type === "boss" ? 0.04 : m.type === "brute" ? 0.3 : 1;
  m.kx += kx * kbm; m.ky += ky * kbm;
  if (!fire) { blood(m.x, m.y, 5, m.type === "stalker" ? "#141418" : m.type === "spitter" ? "#3d4a12" : "#5a0c0c"); Sound.at(m.x, m.y, Sound.flesh); }
  if (m.hp <= 0) kill(m);
}

function vanish(m) {
  m.dead = true;
  spark(m.x, m.y, "#222", 14, 80, 0.8, 4);
  Sound.whisper();
}

function kill(m) {
  m.dead = true;
  const d = MONSTERS[m.type];
  for (let i = 0; i < 3; i++) blood(m.x, m.y, 8, m.type === "stalker" ? "#141418" : "#4a0909");
  Sound.at(m.x, m.y, () => { Sound.growl(m.type === "crawler" ? 1.8 : m.type === "brute" ? 0.6 : 1.1, 0.3); Sound.body(); });
  for (const k in d.drop) if (Math.random() < d.drop[k]) G.drops.push({ x: m.x + (Math.random() - 0.5) * 20, y: m.y + (Math.random() - 0.5) * 20, item: k, q: 1, t: 120 });
  if (Math.random() < 0.18) G.drops.push({ x: m.x, y: m.y, item: Math.random() < 0.6 ? "ammo9" : "shells", q: Math.random() < 0.6 ? 3 : 2, t: 120 });
  if (m.type === "boss") bossDefeated();
}

function isBeamLit(x, y, r) {
  const p = G.p;
  if (!p.light || G.lightOff > 0 || !G.rays.length) return false;
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
  if (d > FLASH_RANGE + r) return false;
  const da = angDiff(p.a, Math.atan2(dy, dx));
  if (Math.abs(da) > FLASH_HALF + r / Math.max(d, 1)) return false;
  const idx = clamp(Math.round((da + FLASH_HALF) / (2 * FLASH_HALF) * (FLASH_RAYS - 1)), 0, FLASH_RAYS - 1);
  return d < G.rays[idx] + r;
}
function fireLit(x, y) {
  for (const f of G.fires) if (dist2(x, y, f.x, f.y) < 220 * 220) return true;
  for (const b of G.builds) if ((b.k === "light" && dist2(x, y, b.x, b.y) < 300 * 300) || (b.k === "stove" && dist2(x, y, b.x, b.y) < 160 * 160)) return true;
  for (const l of World.lights) if (lightOn(l) && dist2(x, y, l.x, l.y) < (l.r * 0.75) ** 2) return true;
  return false;
}
function nearFire(x, y, r) {
  for (const f of G.fires) if (dist2(x, y, f.x, f.y) < r * r) return f;
  for (const b of G.builds) if ((b.k === "stove" || b.k === "light") && dist2(x, y, b.x, b.y) < (b.k === "light" ? r * 1.4 : r) ** 2) return b;
  for (const l of World.lights) if (l.col.startsWith("255") && lightOn(l) && dist2(x, y, l.x, l.y) < r * r) return l;
  return null;
}

// what the ground under your feet sounds like
function surfaceAt(x, y) {
  if (World.indoor) return inSwamp(x, y) ? "water" : ["bunker", "hospital", "sewer"].includes(World.map) ? "metal" : "stone";
  if (insideHouse(x, y)) return "wood";
  if (inSwamp(x, y)) return "water";
  if (distToRoad(x, y) < 40) return "road";
  return "grass";
}

function hurt(dmg, src) {
  const p = G.p;
  if (p.iframe > 0 || G.state !== "play") return;
  if (G.drive) { G.car.hp -= dmg * 0.6; dmg *= 0.35; }
  p.hp -= dmg; p.iframe = 0.45; p.san = Math.max(0, p.san - dmg * 0.25);
  G.shake = Math.max(G.shake, 8); G.hurtFlash = 0.5;
  Sound.hurt(); blood(p.x, p.y, 6);
  if (src && src.type) {
    const behind = Math.abs(angDiff(p.a, Math.atan2(src.y - p.y, src.x - p.x))) > 1.9;
    if (src.type === "stalker" || (behind && Math.random() < 0.6)) screamer(src.type);
  }
  if (src) { const dx = p.x - src.x, dy = p.y - src.y, l = Math.hypot(dx, dy) || 1; p.x += dx / l * 10; p.y += dy / l * 10; collide(p); }
  if (p.hp <= 0) { p.hp = 0; die(); }
}

function updateMonsters(dt) {
  const p = G.p;
  const senseBase = 330 + G.night * 260 + (p.light ? 110 : 0);
  for (const m of G.mons) {
    if (m.dead) continue;
    const def = MONSTERS[m.type];
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (m.type === "lord") { lordAI(m, dt, d, dx, dy); continue; }
    m.beam = isBeamLit(m.x, m.y, m.r) || fireLit(m.x, m.y);
    m.lit = m.beam || d < HALO_R + m.r || G.night < 0.4;
    m.hitF = Math.max(0, m.hitF - dt);
    m.atkT = Math.max(0, m.atkT - dt);
    m.losT -= dt;
    if (m.losT <= 0) { m.losT = 0.25 + Math.random() * 0.15; m.los = !wallBetween(m.x, m.y, p.x, p.y); }

    // burning
    if (m.burn > 0) { m.burn -= dt; damage(m, 18 * dt, 0, 0, true); if (Math.random() < 0.5) spark(m.x, m.y, "#ff9a2a", 1, 60, 0.4, 3); if (m.dead) continue; }
    for (const f of G.projs) if (f.kind === "firezone" && dist2(m.x, m.y, f.x, f.y) < (f.r + m.r) ** 2) { damage(m, 42 * dt, 0, 0, true); m.burn = 2; }
    if (m.dead) continue;

    // hallucinations dissolve when looked at or touched
    if (m.fake) {
      m.fakeT -= dt;
      if (m.beam && d < 360 || d < 40 || m.fakeT <= 0) { if (d < 40) { p.san = Math.max(0, p.san - 6); Sound.scream(); G.hurtFlash = 0.3; } vanish(m); continue; }
    }

    if (m.stun > 0) { m.stun -= dt; m.kx *= 0.85; m.ky *= 0.85; m.x += m.kx * dt; m.y += m.ky * dt; collide(m); continue; }

    // awareness
    const heard = G.noise && dist2(m.x, m.y, G.noise.x, G.noise.y) < G.noise.r * G.noise.r;
    if ((d < senseBase && (m.los || d < 160)) || heard || (m.beam && d < FLASH_RANGE) || m.guard || m.type === "boss") { m.aggro = Math.max(m.aggro, heard ? 8 : 5); }
    m.aggro -= dt;
    m.state = m.aggro > 0 ? "chase" : "wander";
    if (m.state === "chase" && !m.spotted) {
      m.spotted = true;
      if (!m.fake && d < 650 && G.spotCd <= 0) { G.spotCd = 2.5; Sound.at(m.x, m.y, () => m.type === "stalker" ? Sound.whisper() : Sound.screech(m.type === "crawler" ? 1.5 : m.type === "brute" ? 0.6 : m.type === "boss" ? 0.45 : m.type === "spitter" ? 1.2 : 1, 0.5), !m.los); }
    }

    // growls
    m.growlT -= dt;
    if (m.growlT <= 0 && d < 700) {
      m.growlT = 5 + Math.random() * 9;
      if (m.type === "stalker") { if (Math.random() < 0.4) Sound.whisper(); }
      else if (!m.fake) Sound.at(m.x, m.y, () => Sound.growl(m.type === "crawler" ? 1.7 : m.type === "brute" ? 0.55 : m.type === "boss" ? 0.4 : m.type === "spitter" ? 1.3 : 1, 0.4), !m.los);
    }

    let spd = def.speed * (m.fake ? 1.1 : 1), mvx = 0, mvy = 0;
    if (inSwamp(m.x, m.y)) spd *= 0.7;

    // the stalker only moves while nobody is looking at it
    m.frozen = m.type === "stalker" && m.beam;
    if (m.frozen) { spd = 0; m.wind = 0; }

    if (m.state === "chase") {
      let dir = null;
      if (m.raid && G.base && dist2(p.x, p.y, G.base.x, G.base.y) > 1500 * 1500) {
        // raiders head for the base and tear down whatever is in the way
        const bx = G.base.x - m.x, by = G.base.y - m.y, bl = Math.hypot(bx, by) || 1;
        dir = bl > 60 ? { x: bx / bl, y: by / bl } : { x: 0, y: 0 };
      }
      else if (m.los) dir = { x: dx / d, y: dy / d };
      else dir = flowDir(m.x, m.y) || { x: dx / d, y: dy / d };
      if (m.type === "spitter" && m.los) {
        if (d < 200) dir = { x: -dx / d, y: -dy / d };
        else if (d < 330) dir = { x: -dy / d * 0.6, y: dx / d * 0.6 };
        m.spitT -= dt;
        if (m.spitT <= 0 && d < 480) {
          m.spitT = def.acd + Math.random();
          const lead = 0.25;
          const tx = p.x + (p.vx || 0) * lead - m.x, ty = p.y + (p.vy || 0) * lead - m.y, tl = Math.hypot(tx, ty) || 1;
          G.projs.push({ kind: "acid", x: m.x, y: m.y, vx: tx / tl * 340, vy: ty / tl * 340, life: 1.8, dmg: def.dmg });
          Sound.spit();
        }
      }
      if (m.type === "boss") bossAI(m, dt, d, dx, dy);
      if (m.charge > 0) { spd *= 2.8; m.charge -= dt; }
      mvx = dir.x; mvy = dir.y;
      // weak creatures fear fire
      if (m.type !== "brute" && m.type !== "boss" && m.type !== "stalker" && !m.guard) {
        const f = nearFire(m.x, m.y, 190);
        if (f) { const fx = m.x - f.x, fy = m.y - f.y, fl = Math.hypot(fx, fy) || 1; mvx = fx / fl; mvy = fy / fl; m.aggro = Math.min(m.aggro, 2); }
      }
      m.a = Math.atan2(dy, dx);
      // attack
      const reach = m.r + p.r + def.reach;
      if (!m.frozen && m.type !== "spitter") {
        if (m.wind > 0) {
          m.wind -= dt; spd *= 0.2;
          if (m.wind <= 0) {
            if (d < reach + (m.type === "brute" || m.type === "boss" ? 22 : 10) && m.los && !m.fake) hurt(def.dmg, m);
            m.atkT = def.acd;
          }
        } else if (d < reach && m.atkT <= 0) {
          m.wind = m.type === "brute" ? 0.65 : m.type === "boss" ? 0.5 : m.type === "stalker" ? 0.12 : 0.28;
        }
      } else if (m.type === "spitter" && d < reach && m.atkT <= 0) { hurt(def.dmg * 0.6, m); m.atkT = def.acd; }
      if (d < m.r + p.r + 2) { mvx = 0; mvy = 0; }
    } else {
      // wander
      m.wT -= dt;
      if (m.wT <= 0) {
        m.wT = 2 + Math.random() * 4; const a = Math.random() * 6.28; m.wx = m.x + Math.cos(a) * 200; m.wy = m.y + Math.sin(a) * 200;
        // a lit window or a humming generator: walk to the light
        const lure = !m.fake && lureNear(m.x, m.y); m.lure = !!lure;
        if (lure) { m.wx = lure.x + (Math.random() - 0.5) * 160; m.wy = lure.y + (Math.random() - 0.5) * 160; m.wT = 3; if (dist2(m.x, m.y, lure.x, lure.y) < 420 * 420 && d < 600) m.aggro = 5; }
      }
      const wx = m.wx - m.x, wy = m.wy - m.y, wl = Math.hypot(wx, wy);
      if (wl > 10) { const sp = m.lure ? 0.75 : 0.4; mvx = wx / wl * sp; mvy = wy / wl * sp; m.a = Math.atan2(wy, wx); }
    }

    m.kx *= Math.pow(0.02, dt); m.ky *= Math.pow(0.02, dt);
    const ox = m.x, oy = m.y;
    if (m.slowT > 0) { m.slowT -= dt; spd *= 0.4; }
    m.x += (mvx * spd + m.kx) * dt; m.y += (mvy * spd + m.ky) * dt;
    m.hitBuild = null;
    collide(m);
    if (m.hitBuild && m.state === "chase" && !m.fake) {
      m.bT = (m.bT || 0) - dt;
      if (m.bT <= 0) { m.bT = def.acd; m.wind = 0.3; damageBuild(m.hitBuild.build, def.dmg * (m.type === "brute" ? 2 : 1)); }
    }
    m.step += Math.hypot(m.x - ox, m.y - oy) * 0.08;
    // footsteps you can place in the dark
    const sn = Math.floor(m.step / Math.PI);
    if (sn !== m.stepN) { m.stepN = sn; if (d < 650 && !m.fake) Sound.at(m.x, m.y, () => Sound.mstep(m.type), !m.los); }

    // traps
    if (m.type !== "boss") for (const t of G.traps) {
      if (!t.used && dist2(m.x, m.y, t.x, t.y) < (m.r + 14) ** 2) { t.used = true; damage(m, 60); m.stun = 2.5; Sound.hit(); spark(t.x, t.y, "#bbb", 8); }
    }
  }
  G.traps = G.traps.filter(t => !t.used);

  // separation
  const ms = G.mons;
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
    const a = ms[i], b = ms[j];
    if (a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2), push = (rr - d) / 2, ux = dx / d, uy = dy / d;
      const wa = a.type === "boss" ? 0.1 : 1, wb = b.type === "boss" ? 0.1 : 1;
      a.x -= ux * push * wa; a.y -= uy * push * wa; b.x += ux * push * wb; b.y += uy * push * wb;
    }
  }

  // despawn far / daylight
  G.mons = G.mons.filter(m => {
    if (m.dead) return false;
    if (m.guard || m.type === "boss" || m.camp) return true;
    const d2p = dist2(m.x, m.y, p.x, p.y);
    if (m.type === "lord") return d2p < 7000 * 7000;
    if (d2p > 1500 * 1500) return false;
    if (G.night < 0.2 && m.state !== "chase" && d2p > 750 * 750 && Math.random() < dt * 0.3) return false;
    if (m.type === "stalker" && G.night < 0.15 && d2p > 500 * 500) return false;
    return true;
  });
}

// --- boss ----------------------------------------------------------------------------

function bossAI(m, dt, d, dx, dy) {
  const enraged = m.hp < m.max * 0.5;
  m.sumT -= dt; m.rootT -= dt; m.chargeT -= dt;
  if (m.sumT <= 0) {
    m.sumT = enraged ? 6 : 8;
    for (let i = 0; i < (enraged ? 4 : 3); i++) {
      const s = freeSpot(m.x, m.y, 60, 160, false, false);
      if (s) { const c = spawnMonster(Math.random() < 0.7 ? "crawler" : "ghoul", s.x, s.y, { guard: true }); c.aggro = 99; spark(s.x, s.y, "#2a1a10", 12, 120, 0.6, 4); }
    }
    Sound.growl(0.5, 0.4);
  }
  if (m.rootT <= 0) {
    m.rootT = enraged ? 5 : 7.5;
    const ux = dx / d, uy = dy / d;
    for (let i = 1; i <= 12; i++) G.roots.push({ x: m.x + ux * i * 48 + (Math.random() - 0.5) * 14, y: m.y + uy * i * 48 + (Math.random() - 0.5) * 14, t: 0.9 + i * 0.05, life: 0.6, hit: false });
  }
  if (enraged) {
    if (m.chargeT <= 0 && d > 150) { m.chargeT = 9; m.charge = 1.0; Sound.bossRoar(); }
    m.darkT -= dt;
    if (m.darkT <= 0) { m.darkT = 16; G.lightOff = 3.2; Sound.scream(); toast("Фонарь гаснет…", 2); }
  }
}

function updateRoots(dt) {
  const p = G.p;
  for (const r of G.roots) {
    if (r.t > 0) { r.t -= dt; if (r.t <= 0) { spark(r.x, r.y, "#3a2a18", 6, 140, 0.5, 3); if (!r.hit && dist2(r.x, r.y, p.x, p.y) < 34 * 34) { r.hit = true; hurt(28); } } }
    else r.life -= dt;
  }
  G.roots = G.roots.filter(r => r.t > 0 || r.life > 0);
}

function startBoss() {
  G.step = 6;
  G.placed = true;
  const a = World.altar;
  const b = spawnMonster("boss", a.x, a.y - 260, { guard: true, aggro: 99 });
  G.boss = b;
  Sound.bossRoar(); Sound.sting();
  G.shake = 20;
  toast("Из чащи выходит Хозяин леса", 4);
  save();
}

function bossDefeated() {
  G.bossDead = true; G.step = 7; G.endT = 4;
  for (const m of G.mons) if (m !== G.boss) { m.dead = true; spark(m.x, m.y, "#222", 10, 80, 0.8, 4); }
  Sound.bossRoar();
  G.shake = 25;
  toast("Хозяин леса повержен", 4);
}

// --- projectiles, fire, drops ------------------------------------------------------

function pointBlocked(x, y) {
  for (const R of World.walls) if (x > R.x && x < R.x + R.w && y > R.y && y < R.y + R.h) return true;
  for (const o of gridQuery(x, y, 20)) if (o.block && o.type !== "bush" && dist2(x, y, o.x, o.y) < o.r * o.r) return true;
  return false;
}

function updateProjs(dt) {
  const p = G.p;
  for (const pr of G.projs) {
    if (pr.kind === "bottle") {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      pr.x = lerp(pr.sx, pr.tx, k); pr.y = lerp(pr.sy, pr.ty, k); pr.h = Math.sin(k * Math.PI) * 40;
      if (k >= 1 || pointBlocked(pr.x, pr.y)) {
        pr.dead = true;
        G.projs.push({ kind: "firezone", x: pr.x, y: pr.y, r: 85, life: 7, max: 7 });
        Sound.glass(); Sound.fire(); makeNoise(pr.x, pr.y, 400);
        spark(pr.x, pr.y, "#ffb040", 30, 220, 0.7, 3);
      }
      continue;
    }
    if (pr.kind === "firezone") {
      pr.life -= dt;
      if (Math.random() < dt * 30) G.parts.push({ x: pr.x + (Math.random() - 0.5) * pr.r * 1.6, y: pr.y + (Math.random() - 0.5) * pr.r * 1.6, vx: 0, vy: -40 - Math.random() * 40, life: 0.6, max: 0.6, col: Math.random() < 0.5 ? "#ff8a20" : "#ffd060", size: 3, glow: true });
      if (dist2(p.x, p.y, pr.x, pr.y) < pr.r * pr.r) hurt(8);
      if (pr.life <= 0) pr.dead = true;
      continue;
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.life <= 0 || pointBlocked(pr.x, pr.y)) { pr.dead = true; if (pr.kind === "bolt") G.drops.push({ x: pr.x - pr.vx * 0.02, y: pr.y - pr.vy * 0.02, item: "bolts", q: 1, t: 60 }); continue; }
    if (pr.kind === "dart") {
      if (dist2(pr.x, pr.y, p.x, p.y) < (p.r + 4) ** 2) { pr.dead = true; hurt(pr.dmg); }
    } else if (pr.kind === "acid") {
      if (dist2(pr.x, pr.y, p.x, p.y) < (p.r + 6) ** 2) { pr.dead = true; hurt(pr.dmg); spark(pr.x, pr.y, "#9fd02a", 10); }
      if (Math.random() < 0.5) G.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.3, max: 0.3, col: "#9fd02a", size: 3 });
    } else if (pr.kind === "bolt") {
      for (const m of G.mons) {
        if (m.dead || pr.hit.includes(m)) continue;
        if (dist2(pr.x, pr.y, m.x, m.y) < (m.r + 4) ** 2) {
          pr.hit.push(m); damage(m, pr.dmg, pr.vx * 0.15, pr.vy * 0.15);
          if (--pr.pierce <= 0) { pr.dead = true; break; }
        }
      }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);

  for (const d of G.drops) {
    d.t -= dt;
    const dd = dist2(d.x, d.y, p.x, p.y);
    if (dd < 90 * 90) { const l = Math.sqrt(dd) || 1; d.x += (p.x - d.x) / l * 200 * dt; d.y += (p.y - d.y) / l * 200 * dt; }
    if (dd < 22 * 22) { d.t = 0; addItem(d.item, d.q); Sound.pickup(); }
  }
  G.drops = G.drops.filter(d => d.t > 0);

  for (const f of G.fires) {
    f.life -= dt;
    if (Math.random() < dt * 12) G.parts.push({ x: f.x + (Math.random() - 0.5) * 14, y: f.y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 40, life: 0.9, max: 0.9, col: Math.random() < 0.6 ? "#ff9a30" : "#ffe080", size: 2.5, glow: true });
  }
  G.fires = G.fires.filter(f => f.life > 0);
}

// --- interaction & gathering ---------------------------------------------------------

const GATHER = {
  tree:  { n: "Рубить дерево", time: () => 1.4 / bestTool("chop"), give: () => [["wood", 1 + (Math.random() < 0.35 ? 1 : 0)]], snd: "chop", regrow: 2 },
  rock:  { n: "Добывать камень", time: () => 1.3 / bestTool("mine"), give: () => [["stone", 1], ...(Math.random() < 0.2 ? [["scrap", 1]] : [])], snd: "mine", regrow: 3 },
  bush:  { n: "Собрать травы и ягоды", time: () => 0.9, give: () => [["herb", 1 + (Math.random() < 0.3 ? 1 : 0)], ...(Math.random() < 0.35 ? [["berries", 1]] : [])], snd: "step", regrow: 1 },
  scrap: { n: "Разобрать металлолом", time: () => 1.5, give: (o) => [["scrap", 1], ...(Math.random() < 0.18 ? [["powder", 1]] : []), ...(Math.random() < 0.1 ? [["cloth", 1]] : []), ...(o && o.car && Math.random() < 0.3 ? [["parts", 1]] : []), ...(o && o.car && Math.random() < 0.08 ? [["fuel", 1]] : [])], snd: "mine", regrow: 3 },
};

function findInteract() {
  const p = G.p;
  let best = null, bd = 1e9;
  const fx = p.x + Math.cos(p.a) * 14, fy = p.y + Math.sin(p.a) * 14;
  for (const o of World.inter) {
    if (o.taken) continue;
    if (o.type === "seal" && (!STORY_MODE || G.seals.includes(o.seal))) continue;
    if (o.type === "altar" && !STORY_MODE) continue;
    const d = Math.hypot(o.x - fx, o.y - fy);
    if (d < o.r && d < bd && !wallBetween(p.x, p.y, o.x, o.y)) { bd = d - 10; best = o; }
  }
  for (const o of gridQuery(p.x, p.y, 70)) {
    if (!GATHER[o.type] || o.left <= 0) continue;
    const d = Math.hypot(o.x - fx, o.y - fy) - o.r;
    if (d < 30 && d < bd) { bd = d; best = o; }
  }
  if (carHere()) { const d = Math.hypot(G.car.x - fx, G.car.y - fy) - CAR_R; if (d < 40 && d < bd) { bd = d; best = { type: "car" }; } }
  for (const b of G.builds) { const d = Math.hypot(b.x - fx, b.y - fy) - Math.max(b.R.w, b.R.h) / 2; if (d < 34 && d < bd) { bd = d; best = { type: "build", b }; } }
  if (!best && G.inv.rod > 0) { const w = waterSpot(); if (w) best = { type: "fishing", x: w.x, y: w.y }; }
  return best;
}

function interactLabel(o) {
  if (!o) return "";
  if (GATHER[o.type]) return o.car ? "Разобрать машину на запчасти" : GATHER[o.type].n;
  if (o.type === "build") return buildLabel(o.b);
  if (o.type === "fishing") return "Рыбачить";
  if (o.type === "loot") return "Взять: " + o.label;
  if (o.type === "airdrop") return "Открыть аирдроп";
  switch (o.type) {
    case "note": return "Читать: " + NOTES[o.key].t;
    case "crate": return o.full ? "Обыскать ящик" : "Пустой ящик";
    case "bench": return "Верстак — крафт";
    case "bed": return G.night > 0.45 ? "Спать до утра (сохранение)" : "Сохранить игру";
    case "pickup": return "Взять: " + o.label;
    case "exit": return o.label;
    case "wchest": return o.full ? "Открыть: " + o.label : "Пустой ящик";
    case "seal": return "Взять: " + o.label;
    case "altar": return G.placed ? "Алтарь" : "Положить печати на алтарь";
    case "car": { const c = G.car; return c.trunk ? "Обыскать багажник" : !c.engine ? (G.inv.engine ? "Поставить двигатель" : "Машина: нет двигателя") : c.fuel < 1 ? (G.inv.fuel ? "Залить бензин" : "Машина: пустой бак") : "Сесть за руль"; }
  }
  return homeLabel(o);
}
const HOME_TYPES = new Set(["switch", "generator", "fireplace", "sofa", "radio", "fridge", "medcab", "bookcase", "tv", "piano", "mirror"]);

function isHoldAction(o) { return !!GATHER[o.type]; }

function doInteract(o) {
  const p = G.p;
  if (HOME_TYPES.has(o.type)) { homeUse(o); return; }
  switch (o.type) {
    case "note": UI.showNote(o.key); return;
    case "crate":
      if (!o.full) { toast("Пусто. Может, завтра что-то появится…", 2); return; }
      o.full = false; Sound.pickup();
      let got = 0;
      for (const [k, ch, a, b] of CRATE_LOOT) if (Math.random() < ch) { addItem(k, a + Math.floor(Math.random() * (b - a + 1))); got++; }
      if (!got) addItem("cloth", 1);
      if (Math.random() < CRATE_GUN_CHANCE) {
        const pool = ["shotgun", "shotgun", "shotgun", "pistol", "pistol", "crossbow"].filter(id => !G.owned.includes(id));
        const w = pool[Math.floor(Math.random() * pool.length)];
        if (w) { giveWeapon(w); const wd = WEAPONS[W_IDX[w]]; if (wd.ammo) addItem(wd.ammo, w === "shotgun" ? 4 : 6); toast(`В ящике оружие: ${wd.n}!`, 3.5); Sound.craft(); }
        else addItem(Math.random() < 0.5 ? "shells" : "ammo9", 4);
      } else if (Math.random() < CRATE_WEAPON_CHANCE) {
        const w = ["bat", "machete"].find(id => !G.owned.includes(id));
        if (w) { giveWeapon(w); toast(`На дне ящика: ${WEAPONS[W_IDX[w]].n}!`, 3.5); Sound.craft(); }
      }
      return;
    case "wchest": {
      if (!o.full) { toast("Ящик пуст.", 1.5); return; }
      o.full = false;
      const w = WEAPONS[W_IDX[o.weapon]];
      if (G.owned.includes(o.weapon)) { for (const k in o.give) addItem(k, o.give[k]); toast(`${w.n} у тебя уже есть — забираешь патроны`, 3); }
      else { giveWeapon(o.weapon); if (w.mag) G.mag[o.weapon] = w.mag; for (const k in o.give) addItem(k, o.give[k], true); toast(`Найдено оружие: ${w.n}!`, 4); }
      Sound.craft(); G.shake = 4;
      tip("wchest", "Оружие в этой игре только находят — в таких ящиках, в подземельях и изредка в обычных ящиках.");
      save();
      return;
    }
    case "exit":
      if (G.boss && !G.bossDead) { toast("Хозяин не отпустит тебя.", 2); return; }
      travel(o.to);
      return;
    case "bench": UI.openInv(); return;
    case "bed": return sleep();
    case "pickup":
      o.taken = true; giveWeapon(o.weapon);
      for (const k in o.give) addItem(k, o.give[k], true);
      const w = WEAPONS[W_IDX[o.weapon]];
      G.mag[o.weapon] = w.mag;
      toast(`Получено: ${w.n}`, 3); Sound.craft();
      return;
    case "seal":
      G.seals.push(o.seal); Sound.sting(); G.shake = 10;
      toast(`${o.label} (${G.seals.length}/3)`, 3);
      setTimeout(() => { toast("Что-то пробудилось…", 3); screamer("seal"); }, 1100);
      for (const [type, n] of o.guard) for (let i = 0; i < n; i++) {
        const s = freeSpot(p.x, p.y, 160, 340, true, false);
        if (s) { const m = spawnMonster(type, s.x, s.y, { guard: true }); m.aggro = 99; }
      }
      if (G.seals.length >= 3 && G.step >= 4 && G.step < 5) { G.step = 5; toast("Все печати собраны. Капище ждёт на севере.", 4); }
      save();
      return;
    case "altar":
      if (G.placed) { toast("Камни дрожат.", 2); return; }
      if (G.seals.length < 3) { toast(`Не хватает печатей: ${G.seals.length}/3`, 2.5); return; }
      if (G.night < 0.6) { toast("Камни молчат. Дождись ночи.", 2.5); return; }
      startBoss();
      return;
    case "car": carInteract(); return;
    case "airdrop": openAirdrop(o); return;
    case "build": return;
    case "fishing": startFishing(o); return;
    case "loot":
      o.taken = true;
      for (const k in o.give) addItem(k, o.give[k]);
      Sound.pickup();
      if (o.give.engine) tip("engine2", "Двигатель у тебя. Отнеси его к своей машине у дороги на юге деревни.", "🔧");
      if (o.give.rod) tip("rod", "Удочка! Подойди к воде и смотри на неё — появится «Рыбачить».", "🎣");
      return;
  }
}

function finishGather(o) {
  const g = GATHER[o.type];
  for (const [k, q] of g.give(o)) addItem(k, q);
  o.left--; World.dirty = true;
  if (o.left <= 0) { o.regrow = G.day + g.regrow; if (o.type === "rock" || o.type === "scrap") o.block = false; }
  Sound.pickup();
}

function sleep() {
  const p = G.p;
  if (G.night > 0.45) {
    if (G.mons.some(m => !m.fake && m.state === "chase" && dist2(m.x, m.y, p.x, p.y) < 900 * 900)) { toast("Нельзя спать — твари рядом!", 2.5); return; }
    if (G.step === 6) { toast("Не время спать.", 2); return; }
    UI.fade(() => {
      if (G.t > 0.5) newDay();
      G.t = 7 / 24;
      p.hp = Math.min(100, p.hp + 40); p.san = Math.min(100, p.san + 45); p.sta = 100;
      G.mons = G.mons.filter(m => m.guard);
      save();
      toast(`День ${G.day}. Игра сохранена.`, 3);
    });
  } else {
    save(); toast("Игра сохранена.", 2);
  }
}

function newDay() {
  G.day++;
  for (const o of World.res) if (o.regrow && o.regrow <= G.day) { o.left = o.max; o.regrow = 0; o.block = o.type !== "bush"; }
  World.dirty = true;
  for (const o of World.inter) if (o.type === "crate" && !o.full && Math.random() < 0.5) o.full = true;
  refillHomes();
}

// --- crafting ------------------------------------------------------------------------

function nearBench() {
  const p = G.p;
  return World.inter.some(o => o.type === "bench" && dist2(o.x, o.y, p.x, p.y) < 110 * 110) || G.builds.some(b => b.k === "bench" && dist2(b.x, b.y, p.x, p.y) < 120 * 120);
}
function nearCookFire() { return !!nearFire(G.p.x, G.p.y, 150); }

function craft(r) {
  if (!has(r.need)) return;
  if (r.where === "bench" && !nearBench()) { toast("Нужен верстак", 1.5); return; }
  if (r.where === "fire" && !nearCookFire()) { toast("Нужен огонь: костёр или печь", 1.5); return; }
  if (r.w && G.owned.includes(r.out)) return;
  take(r.need);
  const p = G.p;
  if (r.w) {
    giveWeapon(r.out);
    const w = WEAPONS[W_IDX[r.out]];
    if (w.mag) G.mag[r.out] = 0;
    if (r.out === "crossbow") addItem("bolts", 5, true);
    toast(`Создано: ${r.n}`, 2.5);
    if (r.out === "axe" && G.step === 2) { G.step = 3; toast("Теперь — в деревню. Дом старосты на северо-востоке.", 4); save(); }
  } else if (r.out === "campfire") {
    G.fires.push({ x: p.x + Math.cos(p.a) * 40, y: p.y + Math.sin(p.a) * 40, life: 240 });
    toast("Костёр разожжён", 2);
  } else if (r.out === "trap") {
    G.traps.push({ x: p.x + Math.cos(p.a) * 40, y: p.y + Math.sin(p.a) * 40 });
    toast("Капкан установлен", 2);
  } else addItem(r.out, r.q, true);
  Sound.craft();
}

function useItem(k) {
  const p = G.p;
  if (!(G.inv[k] > 0)) return false;
  if (k === "bandage" || k === "medkit") {
    if (p.hp >= 100) { toast("Здоровье полное", 1.2); return false; }
    p.hp = Math.min(100, p.hp + (k === "medkit" ? 60 : 25));
  } else if (k === "tea") {
    p.san = Math.min(100, p.san + 40);
  } else if (k === "battery") {
    if (p.bat > 90) { toast("Батарея почти полная", 1.2); return false; }
    p.bat = 100;
  } else if (ITEMS[k] && ITEMS[k].food) return eat(k);
  else return false;
  G.inv[k]--; Sound.pickup(); toast(`Использовано: ${ITEMS[k].n}`, 1.5);
  return true;
}
function quickHeal() { if (!useItem("medkit") && !(G.inv.medkit > 0)) useItem("bandage"); }

// quick bar: any usable item or weapon from the bag, one tap to use
const QUICK_N = 4, USABLE = ["bandage", "medkit", "tea", "battery"];
function quickable(k) { return k.startsWith("w:") ? G.owned.includes(k.slice(2)) : USABLE.includes(k) || !!(ITEMS[k] && ITEMS[k].food); }
function quickIcon(k) { return k.startsWith("w:") ? WICON[k.slice(2)] || "?" : ITEMS[k].icon; }
function quickName(k) { return k.startsWith("w:") ? WEAPONS[W_IDX[k.slice(2)]].n : ITEMS[k].n; }
function useQuick(i) {
  const k = G.quick[i]; if (!k) return;
  if (k.startsWith("w:")) { const j = G.owned.indexOf(k.slice(2)); if (j >= 0) switchWeapon(j); }
  else if (!(G.inv[k] > 0)) { toast(`Нет: ${ITEMS[k].n}`, 1.2); Sound.click(); }
  else useItem(k);
}
function toggleQuick(k) {
  const i = G.quick.indexOf(k);
  if (i >= 0) { G.quick[i] = null; return; }
  let j = G.quick.indexOf(null); if (j < 0) j = QUICK_N - 1;
  G.quick[j] = k;
}

// --- story ---------------------------------------------------------------------------

function readNote(key) {
  if (!G.notes.includes(key)) G.notes.push(key);
  if (!STORY_MODE) return;
  if (key === "anya1" && G.step <= 1) { G.step = 2; save(); }
  if (key === "head" && G.step < 4) { G.step = G.seals.length >= 3 ? 5 : 4; save(); }
}

function nextHop(from, to) {
  if (from === to) return null;
  const prev = { [from]: null }, q = [from];
  while (q.length) { const m = q.shift(); for (const n of MAP_LINKS[m]) if (!(n in prev)) { prev[n] = m; q.push(n); } }
  let cur = to;
  while (prev[cur] && prev[cur] !== from) cur = prev[cur];
  return prev[cur] === from ? cur : null;
}
function routeTo(map) {
  const hop = nextHop(World.map, map);
  return hop ? World.exits.find(e => e.to === hop) : null;
}

function objectiveTarget() {
  if (!STORY_MODE) return G.drop && !G.drop.looted && World.map === "forest" ? G.drop : null;
  const H = id => World.houses.find(h => h.id === id);
  if (G.step <= 3 || G.step === 5) { if (World.map !== "forest") return routeTo("forest"); }
  switch (G.step) {
    case 0: case 1: return H("forester").doorPos;
    case 2: return World.inter.find(o => o.type === "bench");
    case 3: return H("headman").doorPos;
    case 4: {
      const left = World.inter.filter(o => o.type === "seal" && !G.seals.includes(o.seal));
      if (left.length) {
        let b = null, bd = 1e18;
        for (const o of left) { const d = dist2(o.x, o.y, G.p.x, G.p.y); if (d < bd) { bd = d; b = o; } }
        return b;
      }
      const want = ["bone", "heart", "eye"].filter(k => !G.seals.includes(k)).map(k => SEAL_MAP[k]);
      let best = null, bl = 99;
      for (const m of want) { let n = 0, cur = World.map; while (cur && cur !== m && n < 9) { cur = nextHop(cur, m); n++; } if (n < bl) { bl = n; best = m; } }
      return best ? routeTo(best) : null;
    }
    case 5: return World.altar;
    case 6: return G.boss;
  }
  return null;
}

// --- dungeon traps -----------------------------------------------------------------

function segDist(px, py, x1, y1, x2, y2) { return distToSeg(px, py, x1, y1, x2, y2); }

function updateHazards(dt) {
  const p = G.p;
  G.gasT = Math.max(0, (G.gasT || 0) - dt);
  for (const h of World.hazards) {
    if (h.kind === "gas") {
      if (dist2(p.x, p.y, h.x, h.y) < h.r * h.r) {
        p.hp -= (h.mad ? 1.5 : 4) * dt; p.san = Math.max(0, p.san - (h.mad ? 9 : 4) * dt); G.gasT = 0.35;
        tip("gas", h.mad ? "Этот воздух сводит с ума. Не задерживайся." : "Ядовитый газ! Проходи быстро.", "☣");
        if (p.hp <= 0) { p.hp = 0; die(); return; }
      }
      continue;
    }
    if (h.kind === "rocks") {
      if (!h.armed) continue;
      if (h.t > 0) {
        h.t -= dt;
        if (Math.random() < 0.6) spark(h.x + (Math.random() - 0.5) * h.r, h.y + (Math.random() - 0.5) * h.r, "#8a7a60", 1, 30, 0.6, 2);
        if (h.t <= 0) {
          h.armed = false; Sound.thunder(0); G.shake = Math.max(G.shake, 16); makeNoise(h.x, h.y, 900);
          if (dist2(p.x, p.y, h.x, h.y) < (h.r + 8) ** 2) { hurt(30); p.root = 1.2; toast("Обвал!", 1.5); }
          for (const m of G.mons) if (!m.fake && m.type !== "boss" && dist2(m.x, m.y, h.x, h.y) < (h.r + m.r) ** 2) damage(m, 70);
        }
      } else if (dist2(p.x, p.y, h.x, h.y) < h.r * h.r) { h.t = 0.9; Sound.rattle(); tip("rocks", "Сыплется песок — сейчас обвал! Беги!", "⚠"); }
      continue;
    }
    if (h.kind === "spikes") {
      const t = (G.clock + h.ph) % 3.4;
      const prev = h.state;
      h.state = t < 2.3 ? 0 : t < 2.9 ? 1 : 2;
      if (h.state === 1 && prev === 0 && dist2(p.x, p.y, h.x, h.y) < 500 * 500) Sound.rattle();
      if (h.state === 2) {
        if (prev !== 2 && dist2(p.x, p.y, h.x, h.y) < 600 * 600) Sound.spikes();
        const inside = (x, y, r) => Math.abs(x - h.x) < h.w / 2 + r * 0.5 && Math.abs(y - h.y) < h.h / 2 + r * 0.5;
        if (inside(p.x, p.y, p.r)) hurt(26);
        for (const m of G.mons) if (!m.fake && m.type !== "boss" && inside(m.x, m.y, m.r) && !m.spiked) { m.spiked = 0.6; damage(m, 45); }
      }
      for (const m of G.mons) if (m.spiked) { m.spiked -= dt; if (m.spiked <= 0) m.spiked = 0; }
    } else if (h.kind === "bear" && h.armed) {
      if (dist2(p.x, p.y, h.x, h.y) < 20 * 20) { h.armed = false; hurt(22); p.root = 1.8; Sound.trap(); makeNoise(p.x, p.y, 600); toast("Капкан!", 1.5); tip("bear", "Капканы спрятаны в темноте. Свети фонарём под ноги — металл блеснёт."); }
      else for (const m of G.mons) if (!m.fake && m.type !== "boss" && dist2(m.x, m.y, h.x, h.y) < (m.r + 8) ** 2) { h.armed = false; damage(m, 50); m.stun = 2.5; Sound.trap(); break; }
    } else if (h.kind === "wire" && h.armed) {
      if (segDist(p.x, p.y, h.x1, h.y1, h.x2, h.y2) < p.r) {
        h.armed = false; Sound.twang();
        // darts fly from the wall at one end of the wire
        const sx = h.x1, sy = h.y1, dx = p.x - sx, dy = p.y - sy, l = Math.hypot(dx, dy) || 1;
        for (let i = 0; i < 3; i++) G.projs.push({ kind: "dart", x: sx, y: sy, vx: dx / l * 520 + (Math.random() - 0.5) * 60, vy: dy / l * 520 + (Math.random() - 0.5) * 60, life: 1.2, dmg: 9 });
        tip("wire", "Растяжка! Тонкая проволока поперёк коридора — её видно, только если посветить.");
      }
    }
  }
}

// --- the forest watches you ------------------------------------------------------

function updateCreepy(dt) {
  const p = G.p, dark = World.indoor || G.night > 0.5;
  // eyes in the dark that vanish when the light finds them
  G.watchT -= dt;
  if (dark && G.watchT <= 0 && G.watchers.length < 3) {
    G.watchT = (World.indoor ? 10 : 14) + Math.random() * 22;
    const s = freeSpot(p.x, p.y, 260, 560, World.indoor, false);
    if (s && !isBeamLit(s.x, s.y, 20)) G.watchers.push({ x: s.x, y: s.y, h: 30 + Math.random() * 90, t: 4 + Math.random() * 6, blink: 0, col: Math.random() < 0.7 ? "#ff2a10" : Math.random() < 0.5 ? "#e8f0ff" : "#b6ff2a", seen: 0 });
  }
  for (const w of G.watchers) {
    w.t -= dt; w.blink -= dt;
    if (w.blink < -2 - Math.random() * 3) w.blink = 0.15;
    if (isBeamLit(w.x, w.y, 30) || dist2(p.x, p.y, w.x, w.y) < 140 * 140) {
      w.seen += dt;
      if (w.seen > 0.25) { w.t = 0; p.san = Math.max(0, p.san - 3); Sound.whisper(); tip("watchers", "Что-то смотрит на тебя из темноты. Иногда это просто глаза. Иногда — нет."); if (Math.random() < 0.2) { const m = spawnMonster("crawler", w.x, w.y); m.aggro = 8; } }
    }
  }
  G.watchers = G.watchers.filter(w => w.t > 0);
  // a tall figure stands far away and watches; it is gone when you come closer or light it
  G.figT -= dt;
  if (dark && !G.figure && G.figT <= 0 && !World.indoor) {
    G.figT = 70 + Math.random() * 90;
    const a = p.a + (Math.random() - 0.5) * 1.2, d = 480 + Math.random() * 200;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    const ci = Math.floor(y / World.ncell) * World.nw + Math.floor(x / World.ncell);
    if (x > 60 && y > 60 && x < World.W - 60 && y < World.H - 60 && !World.nav[ci]) G.figure = { x, y, t: 14, lit: 0 };
  }
  if (G.figure) {
    const f = G.figure, d = Math.hypot(f.x - p.x, f.y - p.y);
    f.t -= dt;
    if (isBeamLit(f.x, f.y, 20)) { f.lit += dt; if (f.lit > 0.45) { f.t = 0; Sound.sting(); p.san = Math.max(0, p.san - 6); G.lightOff = Math.max(G.lightOff, 0.35); } }
    if (d < 300) f.t = 0;
    if (f.t <= 0) G.figure = null;
  }
  // sounds: steps behind you, snapping branches, distant screams, knocking, breathing
  G.ambT -= dt;
  if (G.ambT <= 0) {
    G.ambT = (dark ? 7 : 16) + Math.random() * (dark ? 12 : 20);
    const r = Math.random(), behind = Math.sin(Math.PI + (Math.random() - 0.5) * 1.2);
    if (r < 0.25) Sound.stepsBehind(behind);
    else if (r < 0.45) Sound.snap((Math.random() - 0.5) * 2);
    else if (r < 0.6 && dark) Sound.farScream((Math.random() - 0.5) * 2);
    else if (r < 0.72 && (G.inside || World.indoor)) Sound.knock((Math.random() - 0.5) * 2);
    else if (r < 0.85 && p.san < 60) Sound.breath(behind);
    else if (dark) { Sound.radio(); G.lightOff = Math.max(G.lightOff, 0.2 + Math.random() * 0.4); }
  }
}

function die() {
  G.state = "dead";
  Sound.scream();
  UI.showDead();
}

// --- main update -------------------------------------------------------------------

function update(dt) {
  const p = G.p, inp = G.input;
  G.t += dt / DAY_LEN;
  if (G.t >= 1) { G.t -= 1; newDay(); toast(`День ${G.day}`, 3); }
  G.night = World.indoor ? 1 : nightFactor(G.t);
  G.clock = (G.clock || 0) + dt;
  Sound.listener(p.x, p.y, p.a);
  Sound.setEnv(World.indoor ? 0.55 : G.inside ? 0.26 : 0.06);
  Sound.ambience(dt, { night: G.night, dungeon: World.indoor, house: !!G.inside, rain: G.storm || 0 });
  Sound.hunt = !!G.lordHunt;
  updatePower(dt);
  ensureLord(dt);
  updateLordFx(dt);

  // weather: mostly clear and sunny by day; now and then fog rolls in or a thunderstorm comes
  G.stormT -= dt;
  if (G.stormT <= 0) {
    G.wx = (G.wx || "clear") !== "clear" ? "clear" : Math.random() < 0.5 ? "fog" : "rain";
    G.stormOn = G.wx === "rain";
    G.stormT = G.wx === "clear" ? 260 + Math.random() * 320 : 100 + Math.random() * 140;
  }
  G.wfog = clamp((G.wfog || 0) + (G.wx === "fog" ? 1 : -1) * dt * 0.06, 0, 1);
  G.storm = clamp(G.storm + (G.stormOn ? 1 : -1) * dt * 0.08, 0, 1);
  Sound.rain(World.indoor ? 0 : G.inside ? G.storm * 0.4 : G.storm);
  G.bolt = Math.max(0, G.bolt - dt);
  if (G.storm > 0.5) {
    G.boltT -= dt;
    if (G.boltT <= 0) { G.boltT = 5 + Math.random() * 14; G.bolt = 0.35; Sound.thunder(0.3 + Math.random() * 1.5); }
  }
  // the flashlight goes mad near the Shadow and the Master
  let near = 0;
  for (const m of G.mons) if (!m.fake && (m.type === "stalker" || m.type === "boss" || m.type === "lord")) near = Math.max(near, 1 - Math.hypot(m.x - p.x, m.y - p.y) / 480);
  G.interf = clamp(near, 0, 1);
  G.scareCd = Math.max(0, G.scareCd - dt);
  G.spotCd = Math.max(0, G.spotCd - dt);
  if (G.scare) { G.scare.t -= dt; if (G.scare.t <= 0) G.scare = null; }
  if (G.tip) { G.tip.t -= dt; if (G.tip.t <= 0) G.tip = null; }

  // story: entering the forester's house
  G.inside = insideHouse(p.x, p.y);
  if (G.step === 0 && G.inside && G.inside.id === "forester") { G.step = 1; toast("Дом лесника. Здесь кто-то жил совсем недавно.", 3.5); }
  for (const h of World.houses) if (!G.discovered[h.id] && dist2(p.x, p.y, h.x + h.w / 2, h.y + h.h / 2) < 520 * 520) { G.discovered[h.id] = 1; }
  if (G.inside && !G.base && (G.clock || 0) > 20) tip("claim", "Любой дом можно сделать своей базой и укреплять. Открой стройку, когда стоишь внутри дома.", "🔨");
  if (World.altar && !G.discovered.altar && dist2(p.x, p.y, World.altar.x, World.altar.y) < 450 * 450) { G.discovered.altar = 1; toast("Капище", 2.5); Sound.sting(); }

  if (G.drive && carHere()) { driveCar(dt, inp); } else {
  // movement
  // first person: forward/strafe relative to where the player looks
  const fw = (inp.up - inp.down) - inp.mvY, st = (inp.right - inp.left) + inp.mvX;
  let mx = Math.cos(p.a) * fw - Math.sin(p.a) * st, my = Math.sin(p.a) * fw + Math.cos(p.a) * st;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;
  let spd = 150;
  p.staLock = Math.max(0, p.staLock - dt);
  if (inp.sprint && p.moving && p.sta > 0 && p.staLock <= 0) { spd = 245; p.sta -= 28 * dt; if (p.sta <= 0) { p.sta = 0; p.staLock = 1.5; } }
  else p.sta = Math.min(100, p.sta + (p.moving ? 12 : 22) * dt);
  if (inSwamp(p.x, p.y)) spd *= 0.55;
  if (p.act) spd *= 0.3;
  if (p.root > 0) { p.root -= dt; spd = 0; }
  const ox = p.x, oy = p.y;
  p.x += mx * spd * dt; p.y += my * spd * dt;
  collide(p);
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  if (p.moving) { p.stepT -= dt * spd / 150; if (p.stepT <= 0) { p.stepT = 0.38; Sound.stepOn(surfaceAt(p.x, p.y), spd > 200); } }
  // out of breath
  if (p.sta < 30 && (G.input.sprint || p.staLock > 0)) { G.pantT = (G.pantT || 0) - dt; if (G.pantT <= 0) { G.pantT = 0.9; Sound.pant(); } }
  }
  if (!G.drive) Sound.engine(0, 0);

  // aim

  // timers
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.iframe = Math.max(0, p.iframe - dt);
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; finishReload(); } }
  // an empty gun reloads by itself when there is ammo
  { const w = curW(); if (w.mag && !(G.mag[w.id] > 0) && G.inv[w.ammo] > 0 && p.reloadT <= 0 && !G.drive) startReload(); }
  G.swingT = Math.max(0, G.swingT - dt);
  G.flash = Math.max(0, G.flash - dt);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt);
  G.lightOff = Math.max(0, G.lightOff - dt);
  G.shake *= Math.pow(0.004, dt);
  if (G.noise) { G.noise.t -= dt; if (G.noise.t <= 0) G.noise = null; }

  if (G.place) { updatePlacement(); if (inp.attack && !inp.placeUsed) { inp.placeUsed = true; placeBuild(); } if (!inp.attack) inp.placeUsed = false; }
  else if (inp.attack && !p.act && !G.drive) attack();

  // flashlight
  if (p.light && G.lightOff <= 0) {
    p.bat -= dt * 0.4;
    if (p.bat <= 0) {
      p.bat = 0;
      if (G.inv.battery > 0) { G.inv.battery--; p.bat = 100; toast("Батарейка заменена", 2); Sound.click(); }
      else { p.light = false; toast("Батарея села! Нужна батарейка", 3); }
    }
  }
  computeRays();

  // interaction (E): press for instant actions, hold for gathering
  if (G.drive) {
    G.target = null;
    if (inp.interact && !inp.interactUsed) { inp.interactUsed = true; exitCar(); }
    if (!inp.interact) inp.interactUsed = false;
  }
  if (G.fishing) {
    const pressed = inp.interact && !inp.interactUsed;
    if (pressed) inp.interactUsed = true;
    updateFishing(dt, pressed, p.moving);
    if (!inp.interact) inp.interactUsed = false;
  }
  const target = G.drive || G.fishing ? null : findInteract();
  G.target = target;
  if (target) {
    if (GATHER[target.type]) tip("gather", `Держи ${K("✋", "E")}, чтобы добывать ресурсы. Топор рубит в 3 раза быстрее.`);
    else if (target.type === "bench") tip("bench", `Верстак! Нажми ${K("✋", "E")} — откроется крафт. Сначала сделай топор: 4 дерева + 3 камня.`);
    else if (target.type === "crate") tip("crate", "В ящиках ткань, порох, спирт, батарейки и патроны. За ночь часть ящиков наполняется снова.");
    else if (target.type === "note") tip("note", `Записки двигают сюжет. Перечитать — в журнале (${K("⏸ → Журнал", "J")}).`);
  }
  if (G.night > 0.5 && !World.indoor) tip("night", "Наступила ночь. Твари сильнее и их больше — держись у света и костров.");
  if (p.bat < 25) tip("battery", `Фонарь садится. Батарейки — в ящиках или на верстаке (2 металлолома + 1 порох).`);
  if (p.san < 55) tip("sanity", "Рассудок падает в темноте и при виде тварей. Помогают костёр, свет и травяной отвар.");
  if (p.hp < 55) tip("heal", `Ты ранен. Лечение — ${K("🩹", "H")} (бинт или аптечка). Бинт: 2 ткани.`);
  if ((G.inv.fang || 0) > 0) tip("fang", "Клыки тварей нужны для мачете и капканов.");
  if (G.mons.some(m => m.beam && !m.fake && m.type === "stalker")) tip("stalker", "Это Тень. Пока свет фонаря на ней — она не двигается. Не отворачивайся!");
  else if (G.mons.some(m => m.beam && !m.fake && m.type !== "lord")) tip("monster", `Тварь! Бей — ${K("⚔", "ЛКМ")}. Выстрелы громкие и приманивают других.`);
  // builds: a tap uses them, holding picks them up to move or remove
  if (p.act && p.act.type === "build" && (!inp.interact || !target || target.b !== p.act.b)) {
    if (!inp.interact && !inp.interactUsed && G.builds.includes(p.act.b)) buildUse(p.act.b);
    if (!inp.interact) inp.interactUsed = false;
    p.act = null; p.actProg = 0;
  }
  if (inp.interact && target && target.type === "build" && !G.drive && !G.fishing) {
    if (!inp.interactUsed && !G.place) {
      if (!p.act || p.act.b !== target.b) { p.act = target; p.actProg = 0; }
      p.actProg += dt;
      if (p.actProg >= BUILD_HOLD) { inp.interactUsed = true; p.act = null; p.actProg = 0; pickUpBuild(target.b); }
    }
  } else if (inp.interact && target && !G.drive && !G.fishing) {
    if (isHoldAction(target)) {
      if (p.act !== target) { p.act = target; p.actProg = 0; p.actTick = 0; }
      const time = GATHER[target.type].time();
      p.actProg += dt; p.actTick -= dt;
      if (p.actTick <= 0) { p.actTick = 0.35; Sound[GATHER[target.type].snd](); spark(target.x, target.y, target.type === "tree" ? "#8a6a40" : target.type === "bush" ? "#4a7a30" : "#999", 2, 80); makeNoise(p.x, p.y, 320); }
      if (p.actProg >= time) { finishGather(target); p.actProg = 0; if (target.left <= 0) p.act = null; }
    } else if (!inp.interactUsed) {
      inp.interactUsed = true;
      doInteract(target);
    }
  } else { p.act = null; p.actProg = 0; }
  if (!inp.interact) inp.interactUsed = false;

  // hunger: about a day and a half from full to empty
  p.food = Math.max(0, (p.food == null ? 100 : p.food) - dt * 100 / (DAY_LEN * 1.5));
  if (p.food <= 0) { p.hp -= 0.6 * dt; if (p.hp <= 0) { p.hp = 0; die(); return; } }
  if (p.food < 30) tip("hunger", "Ты голоден. Ешь: рыба, овощи с грядки, тушёнка из ящиков. Готовь на костре или печи.", "🍖");
  // regions announce themselves
  if (!World.indoor) {
    const reg = regionAt(p.x, p.y), name = reg ? reg.name : null;
    if (name !== G.lastRegion) { if (name) toast(name, 2.5); G.lastRegion = name; }
  }
  if (STORY_MODE && G.step !== G.lastStep) { G.lastStep = G.step; if (STEPS[G.step] && G.step < 7) G.objBanner = { text: STEPS[G.step].t, t: 6 }; }
  if (G.objBanner) { G.objBanner.t -= dt; if (G.objBanner.t <= 0) G.objBanner = null; }

  // sanity
  const lightHere = Math.max(1 - G.night, nearFire(p.x, p.y, 240) ? 1 : 0, World.lights.some(l => lightOn(l) && dist2(p.x, p.y, l.x, l.y) < l.r * l.r) ? 0.8 : 0, p.light && G.lightOff <= 0 ? 0.45 : 0);
  let dsan = 0;
  if (lightHere < 0.3) dsan -= 1.1; else if (lightHere < 0.6) dsan -= 0.35 * G.night;
  if (nearFire(p.x, p.y, 240)) dsan += 2.2;
  else if (G.night < 0.3) dsan += 0.3;
  let seen = 0;
  for (const m of G.mons) if (!m.dead && m.beam && !m.fake && dist2(m.x, m.y, p.x, p.y) < 420 * 420) seen += m.type === "boss" ? 3 : m.type === "stalker" || m.type === "brute" ? 1.5 : 0.6;
  dsan -= Math.min(2, seen);
  if (G.boss && !G.bossDead) dsan -= 0.6;
  p.san = clamp(p.san + dsan * dt, 0, 100);
  if (p.san <= 0) { p.hp -= 1.5 * dt; if (p.hp <= 0) { p.hp = 0; die(); return; } }

  // hallucinations and whispers
  if (p.san < 40) {
    G.hallT -= dt;
    if (G.hallT <= 0) {
      G.hallT = 6 + Math.random() * 14 * (p.san / 40 + 0.3);
      const s = freeSpot(p.x, p.y, 260, 420, false, false);
      if (s) { const m = spawnMonster(Math.random() < 0.5 ? "ghoul" : "stalker", s.x, s.y, { fake: true, fakeT: 8, aggro: 99 }); m.hp = 1; }
    }
    if (p.san < 25 && Math.random() < dt / 70) screamer("hall");
    G.whisperT -= dt;
    if (G.whisperT <= 0) { G.whisperT = 4 + Math.random() * 8; Sound.whisper(); }
  }

  if (G.state !== "play") return;
  spawnTick(dt);
  G.flowT -= dt;
  if (G.flowT <= 0) { G.flowT = 0.25; updateFlow(p.x, p.y); }
  updateMonsters(dt);
  updateRoots(dt);
  updateHazards(dt);
  updateCreepy(dt);
  updateBuilds(dt);
  updateAirdrop(dt);
  updateRaid(dt);
  updateProjs(dt);

  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt; }
  G.parts = G.parts.filter(q => q.life > 0);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter(t => t.life > 0);
  for (const d of G.decals) d.a -= dt * 0.004;
  G.decals = G.decals.filter(d => d.a > 0);
  for (const m of G.msgs) m.t -= dt;
  if (G.feed) { for (const f of G.feed) f.t -= dt; G.feed = G.feed.filter(f => f.t > 0); }
  G.msgs = G.msgs.filter(m => m.t > 0);

  if (G.endT > 0) { G.endT -= dt; if (G.endT <= 0) { G.state = "end"; UI.showEnd(p.san >= 30); try { localStorage.removeItem(SAVE_KEY); } catch (e) {} } }

  const fear = clamp(Math.max((100 - p.hp) / 100, (60 - p.san) / 60, G.mons.some(m => m.state === "chase" && !m.fake && dist2(m.x, m.y, p.x, p.y) < 300 * 300) ? 0.55 : 0), 0, 1);
  Sound.update(dt, G.night, fear, true);
}

function computeRays() {
  const p = G.p;
  G.rays.length = 0;
  if (!p.light || G.lightOff > 0) return;
  const bl = nearBlockers(p.x, p.y, FLASH_RANGE);
  G.rayBl = bl;
  for (let i = 0; i < FLASH_RAYS; i++) {
    const a = p.a - FLASH_HALF + (i / (FLASH_RAYS - 1)) * FLASH_HALF * 2;
    G.rays.push(castRay(p.x, p.y, a, FLASH_RANGE, bl));
  }
}
