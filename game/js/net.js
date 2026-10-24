"use strict";
// Playing together: two phones connect directly (WebRTC through PeerJS; the public PeerJS server only
// introduces them). The host runs the world — creatures, time, weather, the Master, airdrops — and sends
// it to the guest ten times a second. The guest sends back where they are, what they hit and what they
// changed. Each player keeps their own bag.

const Net = {
  role: null,          // null | "host" | "guest"
  peer: null, conn: null, code: "", status: "",
  remote: null,        // the other player, as seen here
  sendT: 0, snapN: 0, dmgQ: new Map(), bLock: 0, fireN: 0, lastFireN: 0,
  get on() { return !!(this.conn && this.conn.open); },
  get guest() { return this.role === "guest"; },
  get host() { return this.role === "host"; },
};

const NET_PREFIX = "blackpine-v1-";
const NET_ICE = { iceServers: [
  { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
] };

function netLoadLib() {
  if (window.Peer) return Promise.resolve();
  return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "vendor/peerjs.min.js?v=" + BUILD; s.onload = ok; s.onerror = () => bad(new Error("lib")); document.head.appendChild(s); });
}
function netStatus(t) { Net.status = t; if (typeof UI !== "undefined" && UI.netStatus) UI.netStatus(t); }
function netSend(o) { if (Net.on) try { Net.conn.send(o); } catch (e) {} }

// --- connecting --------------------------------------------------------------------------

function netHost() {
  if (Net.peer) return;
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  Net.code = Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
  Net.role = "host";
  netStatus("Создаю комнату…");
  netLoadLib().then(() => {
    const peer = Net.peer = new Peer(NET_PREFIX + Net.code, { config: NET_ICE, debug: 0 });
    peer.on("open", () => netStatus("Комната " + Net.code + " — скажи этот код другу"));
    peer.on("connection", c => {
      if (Net.on) { c.on("open", () => { c.send({ t: "full" }); setTimeout(() => c.close(), 500); }); return; }
      Net.conn = c;
      c.on("open", () => { netStatus("Друг подключился!"); toast("Друг в игре", 3); Sound.craft(); netSendInit(); });
      c.on("data", netOnData);
      c.on("close", () => { if (Net.conn === c) { Net.conn = null; Net.remote = null; toast("Друг отключился", 3); netStatus("Комната " + Net.code + " — ждём друга"); } });
    });
    peer.on("error", e => {
      if (e.type === "unavailable-id") { Net.peer.destroy(); Net.peer = null; netHost(); return; }
      netStatus("Ошибка связи: " + (e.type || e.message));
    });
    peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) {} });
  }).catch(() => netStatus("Не удалось загрузить сетевой модуль. Проверь интернет."));
}

function netJoin(code) {
  code = (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) { netStatus("Код — 4 знака"); return; }
  netLeave(true);
  Net.role = "guest"; Net.code = code;
  netStatus("Подключаюсь к " + code + "…");
  netLoadLib().then(() => {
    const peer = Net.peer = new Peer(undefined, { config: NET_ICE, debug: 0 });
    peer.on("open", () => {
      const c = Net.conn = peer.connect(NET_PREFIX + code, { reliable: true, serialization: "json" });
      const timer = setTimeout(() => { if (!c.open) netStatus("Не получается соединиться. Проверь код и интернет у обоих."); }, 15000);
      c.on("open", () => { clearTimeout(timer); netStatus("Соединено, загружаю мир…"); });
      c.on("data", netOnData);
      c.on("close", () => { if (Net.role === "guest") { toast("Связь с другом потеряна", 4); setTimeout(() => { if (Net.role === "guest") { netLeave(); toTitle(); } }, 2500); } });
    });
    peer.on("error", e => netStatus(e.type === "peer-unavailable" ? "Комната " + code + " не найдена. Друг должен открыть её в паузе." : "Ошибка связи: " + (e.type || e.message)));
  }).catch(() => netStatus("Не удалось загрузить сетевой модуль. Проверь интернет."));
}

function netLeave(quiet) {
  try { Net.conn && Net.conn.close(); } catch (e) {}
  try { Net.peer && Net.peer.destroy(); } catch (e) {}
  Object.assign(Net, { role: null, peer: null, conn: null, remote: null, code: "" });
  if (!quiet) netStatus("");
}

// --- host: what the guest needs ---------------------------------------------------------

function netBuilds() { return G.builds.map(b => [b.k, Math.round(b.x), Math.round(b.y), b.rot, Math.round(b.hp), b.ammo || 0, b.plant ? 1 : 0, +(b.grow || 0).toFixed(2)]); }
function netSendInit() {
  netSend({ t: "init", seed: G.seed, map: World.map, tm: G.t, day: G.day, base: G.base, power: G.power, drop: G.drop, nextDrop: G.nextDrop,
    wx: G.wx, so: G.stormOn, st: G.storm, wf: G.wfog, m: snapMap(), b: netBuilds(), x: G.p.x, y: G.p.y });
}
function netSnapshot() {
  const p = G.p, s = { t: "s", tm: +G.t.toFixed(5), day: G.day, wx: G.wx, so: G.stormOn,
    p: [Math.round(p.x), Math.round(p.y), +p.a.toFixed(2), +(p.pitch || 0).toFixed(2), G.owned[G.wi], p.light && G.lightOff <= 0 ? 1 : 0, Math.round(p.hp), Net.fireN, World.map, G.drive ? 1 : 0],
    m: [], pj: [], dr: [], fi: [], tr: [], pw: G.power, dp: G.drop, base: G.base };
  for (const m of G.mons) if (!m.dead && !m.fake) s.m.push([m.id, m.type, Math.round(m.x), Math.round(m.y), +m.a.toFixed(2), Math.round(m.hp), m.state === "hunt" || m.state === "chase" ? 1 : m.state === "search" ? 2 : 0, m.wind > 0 ? 1 : 0, m.stun > 0 ? 1 : 0, m.type === "lord" && m.tgRemote ? 1 : 0]);
  for (const pr of G.projs) if (pr.kind === "acid") s.pj.push([Math.round(pr.x), Math.round(pr.y), Math.round(pr.vx), Math.round(pr.vy)]);
  for (const d of G.drops) { if (!d.id) d.id = ++G.dropId; s.dr.push([d.id, Math.round(d.x), Math.round(d.y), d.item, d.q]); }
  for (const f of G.fires) s.fi.push([Math.round(f.x), Math.round(f.y), Math.round(f.life), f.hearth ? 1 : 0]);
  for (const t of G.traps) s.tr.push([Math.round(t.x), Math.round(t.y)]);
  if (++Net.snapN % 10 === 0) s.b = netBuilds();
  if (carHere() || G.car.map) s.car = [Math.round(G.car.x), Math.round(G.car.y), +G.car.a.toFixed(2), G.car.map];
  netSend(s);
}

// --- guest: applying the host's world --------------------------------------------------------

function netApplyBuilds(list) {
  for (const b of G.builds) if (b.R) rectRemove(b.R);
  G.builds = list.map(([k, x, y, rot, hp, ammo, plant, grow]) => ({ k, x, y, rot, hp, ammo, plant: !!plant, grow }));
  registerBuilds(); buildNav(); for (const o of G.builds) if (!o.R.soft) markRectNav(o.R);
}
function netApplySnap(s) {
  G.t = s.tm;
  if (s.day > G.day) { G.day = s.day; for (const o of World.res) if (o.regrow && o.regrow <= G.day) { o.left = o.max; o.regrow = 0; o.block = o.type !== "bush"; } World.dirty = true; refillHomes(); }
  G.wx = s.wx; G.stormOn = s.so;
  if (s.pw) G.power = s.pw;
  G.drop = s.dp; G.base = s.base;
  netSetRemote(s.p);
  if (s.p[8] !== World.map) return; // the host is somewhere else right now
  // creatures: keep the same objects so they animate smoothly
  const seen = new Set();
  Net.mons = Net.mons || new Map();
  for (const [id, type, x, y, a, hp, st, wind, stun, tg] of s.m) {
    seen.add(id);
    let m = Net.mons.get(id);
    if (!m) { m = spawnMonster(type, x, y, { id, aggro: 0 }); Net.mons.set(id, m); }
    m.tx = x; m.ty = y; m.ta = a; m.hp = hp; m.state = st === 1 ? (type === "lord" ? "hunt" : "chase") : st === 2 ? "search" : "wander"; m.wind = wind ? 0.2 : 0; m.stun = stun ? 0.2 : 0;
    if (type === "lord") {
      if (tg && !m.tgMe) { G.lordAlert = 3; Sound.bossRoar(); setTimeout(() => Sound.sting(), 300); G.shake = Math.max(G.shake, 24); G.p.san = Math.max(0, G.p.san - 10); tip("lord", "Это Хозяин леса. Его не убить. Беги, прячься в доме без света, уходи из виду.", "⚠"); }
      if (!tg && m.tgMe) toast("Он потерял тебя…", 2.5);
      m.tgMe = !!tg; G.lordHunt = !!tg;
    }
  }
  for (const [id, m] of Net.mons) if (!seen.has(id)) { m.dead = true; Net.mons.delete(id); }
  G.mons = G.mons.filter(m => !m.dead);
  G.projs = G.projs.filter(pr => !pr.net).concat(s.pj.map(([x, y, vx, vy]) => ({ kind: "acid", x, y, vx, vy, life: 0.2, dmg: 0, net: true })));
  G.drops = s.dr.map(([id, x, y, item, q]) => ({ id, x, y, item, q, t: 60 }));
  G.fires = s.fi.map(([x, y, life, h]) => ({ x, y, life, hearth: !!h }));
  G.traps = s.tr.map(([x, y]) => ({ x, y }));
  if (s.b && Net.bLock <= 0) netApplyBuilds(s.b);
  if (s.car) { G.car.x = s.car[0]; G.car.y = s.car[1]; G.car.a = s.car[2]; G.car.map = s.car[3]; }
}

// guest: creatures glide to where the host says they are
function netGuestTick(dt) {
  const p = G.p;
  for (const m of G.mons) {
    if (m.tx == null) continue;
    const ox = m.x, oy = m.y, k = Math.min(1, dt * 10);
    m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; m.a += angDiff(m.a, m.ta) * k;
    m.step += Math.hypot(m.x - ox, m.y - oy) * 0.08;
    m.beam = isBeamLit(m.x, m.y, m.r);
    m.lit = m.beam || dist2(m.x, m.y, p.x, p.y) < (HALO_R + m.r) ** 2 || G.night < 0.4;
    m.frozen = m.type === "stalker" && m.beam;
    m.hitF = Math.max(0, (m.hitF || 0) - dt);
    const sn = Math.floor(m.step / Math.PI);
    if (sn !== m.stepN) { m.stepN = sn; if (dist2(m.x, m.y, p.x, p.y) < 650 * 650) Sound.at(m.x, m.y, () => m.type === "lord" ? Sound.lordStep(0.7) : Sound.mstep(m.type)); }
  }
  // hits are sent in batches
  if (Net.dmgQ.size) { netSend({ t: "dmg", l: [...Net.dmgQ.entries()].map(([id, v]) => [id, Math.round(v.d), Math.round(v.kx), Math.round(v.ky), v.f ? 1 : 0]) }); Net.dmgQ.clear(); }
}

// --- the other player --------------------------------------------------------------------

function netSetRemote(a) {
  const r = Net.remote || (Net.remote = { x: a[0], y: a[1], a: a[2], r: 12, isRemote: true });
  r.tx = a[0]; r.ty = a[1]; r.ta = a[2]; r.pitch = a[3]; r.w = a[4]; r.light = !!a[5]; r.hp = a[6]; r.map = a[8]; r.drive = !!a[9];
  if (a[7] !== r.fireN) { if (r.fireN != null && r.map === World.map) netRemoteShot(r); r.fireN = a[7]; }
  r.seen = G.clock;
}
function netRemoteShot(r) {
  const w = WEAPONS[W_IDX[r.w]] || {};
  Sound.at(r.x, r.y, () => w.kind === "gun" ? (r.w === "shotgun" ? Sound.shotgun() : Sound.shot()) : w.kind === "bow" ? Sound.bow() : Sound.swing());
  if (w.kind === "gun") G.remoteFlash = 0.07;
}
function netRemoteHere() { const r = Net.remote; return r && Net.on && r.map === World.map && r.hp > 0 ? r : null; }
function netTickRemote(dt) {
  const r = Net.remote; if (!r) return;
  const k = Math.min(1, dt * 12), ox = r.x, oy = r.y;
  r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.a += angDiff(r.a, r.ta) * k;
  r.step = (r.step || 0) + Math.hypot(r.x - ox, r.y - oy) * 0.08;
  r.moving = Math.hypot(r.x - ox, r.y - oy) > 0.3;
  r.vx = (r.x - ox) / Math.max(dt, 1e-3); r.vy = (r.y - oy) / Math.max(dt, 1e-3);
  G.remoteFlash = Math.max(0, (G.remoteFlash || 0) - dt);
}

// host: which player a creature goes for
function monTarget(m) {
  const r = Net.host ? netRemoteHere() : null;
  if (!r) return G.p;
  m.tgT = (m.tgT || 0) - 1 / 60;
  if (m.tgT <= 0 || !m.tg) { m.tgT = 1; m.tg = dist2(m.x, m.y, r.x, r.y) < dist2(m.x, m.y, G.p.x, G.p.y) * 0.8 ? r : G.p; }
  return m.tg === r ? r : G.p;
}
function hitTarget(tg, dmg, src) {
  if (tg && tg.isRemote) { netSend({ t: "hurt", d: Math.round(dmg), x: Math.round(src.x), y: Math.round(src.y), ty: src.type }); return; }
  hurt(dmg, src);
}

// --- messages ------------------------------------------------------------------------------

function netOnData(d) {
  if (!d || !d.t) return;
  const H = Net.host;
  switch (d.t) {
    case "full": netStatus("В этой комнате уже играют двое"); netLeave(true); return;
    case "init": netGuestStart(d); return;
    case "s": if (!H) netApplySnap(d); return;
    case "p": if (H) netSetRemote(d.p); return;
    case "dmg": if (H) for (const [id, dmg, kx, ky, f] of d.l) { const m = G.mons.find(q => q.id === id && !q.dead); if (m) { m.lastHitBy = "remote"; damage(m, dmg, kx, ky, !!f); } } return;
    case "hurt": if (!H) hurt(d.d, { x: d.x, y: d.y, type: d.ty }); return;
    case "res": { const o = World.res[d.i]; if (o) { o.left = d.l; o.regrow = d.rg; o.block = !!d.bl; World.dirty = true; } return; }
    case "it": { const o = World.inter[d.i]; if (o) { o.full = d.f; o.taken = d.tk; if (d.day != null) o.day = d.day; } return; }
    case "hz": { const h = World.hazards[d.i]; if (h) h.armed = d.a; return; }
    case "b": netApplyBuilds(d.b); return;
    case "fire": if (H) G.fires.push({ x: d.x, y: d.y, life: d.life || 240, hearth: !!d.h }); return;
    case "trap": if (H) G.traps.push({ x: d.x, y: d.y }); return;
    case "noise": if (H) makeNoise(d.x, d.y, d.r); return;
    case "pick": if (H) G.drops = G.drops.filter(q => q.id !== d.id); return;
    case "power": if (H) G.power[d.k] = { on: d.on, e: d.e }; return;
    case "base": if (H) { G.base = d.base; save(); } return;
    case "drop": if (H && G.drop) { G.drop.looted = true; } return;
    case "go": if (H) travel(d.to); return;
    case "travel": if (!H) { Net.pendingMap = d.m; travel(d.to); } return;
    case "toast": toast(d.s, 3); return;
  }
}

// guest: build the host's world and step into it
function netGuestStart(d) {
  UI.close && UI.close();
  newGame();
  Net.mons = new Map();
  Object.assign(G, { seed: d.seed, t: d.tm, day: d.day, base: d.base, power: d.power || {}, drop: d.drop, nextDrop: d.nextDrop, wx: d.wx, stormOn: d.so, storm: d.st || 0, wfog: d.wf || 0 });
  generateWorld(d.seed, d.map);
  applyMap(d.m);
  netApplyBuilds(d.b || []);
  G.p.x = d.x + 40; G.p.y = d.y + 20; collide(G.p);
  G.tips = ["start", "gather", "claim"];
  if (typeof rebuildWorld3d === "function") rebuildWorld3d();
  netStatus("");
  enterPlay();
  toast("Ты в игре у друга", 3);
}

// --- hooks called from the game ---------------------------------------------------------------

function netTick(dt) {
  if (!Net.on) return;
  netTickRemote(dt);
  Net.bLock = Math.max(0, Net.bLock - dt);
  Net.sendT -= dt;
  if (Net.sendT > 0) return;
  if (Net.host) { Net.sendT = 0.1; netSnapshot(); }
  else { Net.sendT = 0.066; const p = G.p; netSend({ t: "p", p: [Math.round(p.x), Math.round(p.y), +p.a.toFixed(2), +(p.pitch || 0).toFixed(2), G.owned[G.wi], p.light && G.lightOff <= 0 ? 1 : 0, Math.round(p.hp), Net.fireN, World.map, 0] }); }
}
function netRes(o) { if (!Net.on) return; const i = World.res.indexOf(o); if (i >= 0) netSend({ t: "res", i, l: o.left, rg: o.regrow || 0, bl: o.block ? 1 : 0 }); }
function netInter(o) { if (!Net.on || !o) return; const i = World.inter.indexOf(o); if (i >= 0) netSend({ t: "it", i, f: o.full, tk: !!o.taken, day: o.day }); }
function netHz(h) { if (!Net.on) return; const i = World.hazards.indexOf(h); if (i >= 0) netSend({ t: "hz", i, a: h.armed }); }
function netBuildsChanged() { if (!Net.on) return; Net.bLock = 1.5; netSend({ t: "b", b: netBuilds() }); }
function netDamage(m, dmg, kx, ky, fire) {
  const q = Net.dmgQ.get(m.id) || { d: 0, kx: 0, ky: 0, f: false };
  q.d += dmg; q.kx += kx; q.ky += ky; q.f = q.f || fire; Net.dmgQ.set(m.id, q);
}
