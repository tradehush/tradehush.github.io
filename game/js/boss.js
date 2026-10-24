"use strict";
// The Master of the forest walks the woods all the time. It cannot be killed: hide in a dark house,
// break its line of sight or outrun it. When it sees you, "БЕГИ" — until it loses you.

const LORD = { roam: 64, huntNight: 236, huntDay: 214, seeNight: 900, seeDay: 560, loseAfter: 5, dmg: 42 };

function ensureLord(dt) {
  if (World.indoor || World.map !== "forest" || (G.clock || 0) < 90) return;
  if (G.mons.some(m => m.type === "lord" && !m.dead)) return;
  G.lordT = (G.lordT == null ? 0 : G.lordT) - dt;
  if (G.lordT > 0) return;
  G.lordT = 20;
  // it comes out of the forest somewhere far away
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = 2600 + Math.random() * 1500;
    const x = G.p.x + Math.cos(a) * d, y = G.p.y + Math.sin(a) * d;
    if (x < 200 || y < 200 || x > World.W - 200 || y > World.H - 200 || inSwamp(x, y) || insideHouse(x, y, 60)) continue;
    spawnMonster("lord", x, y, { state: "roam", lostT: 0, searchT: 0, stepT: 0 });
    return;
  }
}

function lordSpotted(m) {
  const p = G.p;
  G.lordAlert = 3; G.lordHunt = true;
  Sound.bossRoar(); setTimeout(() => Sound.sting(), 300);
  G.shake = Math.max(G.shake, 24); G.lightOff = Math.max(G.lightOff, 0.35);
  p.san = Math.max(0, p.san - 10);
  tip("lord", "Это Хозяин леса. Его не убить. Беги, прячься в доме без света, уходи из виду.", "⚠");
}

function lordAI(m, dt, d, dx, dy, tgt) {
  const p = tgt || G.p, night = G.night > 0.5, remote = !!p.isRemote;
  m.hitF = Math.max(0, m.hitF - dt); m.atkT = Math.max(0, m.atkT - dt);
  m.stun = Math.max(0, m.stun - dt); m.wind = Math.max(0, m.wind - dt);
  m.losT -= dt;
  if (m.losT <= 0) { m.losT = 0.2; m.los = !wallBetween(m.x, m.y, p.x, p.y); }
  m.beam = isBeamLit(m.x, m.y, m.r); m.lit = true;

  // does it see you? a dark house hides you, a flashlight at night gives you away
  const lightOnMe = remote ? p.light : p.light && G.lightOff <= 0;
  const hiddenIndoors = (remote ? insideHouse(p.x, p.y) : G.inside) && !insideHouse(m.x, m.y) && !lightOnMe;
  let range = night ? LORD.seeNight : LORD.seeDay;
  if (night && lightOnMe) range *= 1.3;
  if (G.drive) range *= 1.2;
  if (hiddenIndoors) range = 200;
  const facing = Math.abs(angDiff(m.a, Math.atan2(dy, dx))) < 1.0;
  const heard = G.noise && G.noise.r >= 500 && dist2(m.x, m.y, G.noise.x, G.noise.y) < G.noise.r * G.noise.r * 0.5;
  const sees = (m.los && d < range && (facing || d < 320 || m.state === "hunt")) || d < 130;
  if (sees) {
    if (m.state !== "hunt" && !remote) lordSpotted(m);
    m.tgRemote = remote;
    m.state = "hunt"; m.lastX = p.x; m.lastY = p.y; m.lostT = 0;
  } else if (m.state === "hunt") {
    m.lostT += dt;
    if (m.lostT > LORD.loseAfter || d > 1800) { m.state = "search"; m.searchT = 14; if (!m.tgRemote) { G.lordHunt = false; toast("Он потерял тебя…", 2.5); } m.tgRemote = false; Sound.growl(0.35, 0.3); }
  } else if (heard) { m.state = "search"; m.searchT = 10; m.lastX = G.noise.x; m.lastY = G.noise.y; }

  // where to go
  let tx, ty, spd;
  if (m.state === "hunt") {
    const dir = m.los ? { x: dx / d, y: dy / d } : flowDir(m.x, m.y) || { x: (m.lastX - m.x) / (Math.hypot(m.lastX - m.x, m.lastY - m.y) || 1), y: (m.lastY - m.y) / (Math.hypot(m.lastX - m.x, m.lastY - m.y) || 1) };
    tx = m.x + dir.x * 100; ty = m.y + dir.y * 100; spd = night ? LORD.huntNight : LORD.huntDay;
    G.interf = Math.max(G.interf, clamp(1 - d / 700, 0, 1) * 0.8);
  } else if (m.state === "search") {
    m.searchT -= dt;
    if (dist2(m.x, m.y, m.lastX, m.lastY) < 60 * 60) { const a = Math.random() * 6.28; m.lastX += Math.cos(a) * 260; m.lastY += Math.sin(a) * 260; }
    tx = m.lastX; ty = m.lastY; spd = 120;
    if (m.searchT <= 0) { m.state = "roam"; m.wT = 0; }
  } else {
    m.wT -= dt;
    if (m.wT <= 0 || dist2(m.x, m.y, m.wx, m.wy) < 80 * 80) {
      // wander far, but drift towards wherever you are often enough to keep you nervous
      m.wT = 25 + Math.random() * 25;
      const near = Math.random() < 0.45, a = Math.random() * 6.28, r = near ? 400 + Math.random() * 900 : 1500 + Math.random() * 2000;
      const cx = near ? p.x : m.x, cy = near ? p.y : m.y;
      m.wx = clamp(cx + Math.cos(a) * r, 300, World.W - 300); m.wy = clamp(cy + Math.sin(a) * r, 300, World.H - 300);
    }
    tx = m.wx; ty = m.wy; spd = LORD.roam * (night ? 1.3 : 1);
  }
  if (m.stun > 0) spd = 0;
  if (inSwamp(m.x, m.y)) spd *= 0.75;

  // attack
  if (d < m.r + p.r + 30 && m.atkT <= 0 && m.state === "hunt") {
    m.atkT = 1.4; m.wind = 0.4;
    hitTarget(p, LORD.dmg, m); if (!remote) G.shake = Math.max(G.shake, 26); Sound.at(m.x, m.y, Sound.bossRoar);
  }

  const mx = tx - m.x, my = ty - m.y, ml = Math.hypot(mx, my) || 1;
  const ox = m.x, oy = m.y;
  if (ml > 8 && !(m.state === "hunt" && d < m.r + p.r + 4)) { m.x += mx / ml * spd * dt; m.y += my / ml * spd * dt; m.a = Math.atan2(my, mx); }
  else if (m.state === "hunt") m.a = Math.atan2(dy, dx);
  collide(m);
  const moved = Math.hypot(m.x - ox, m.y - oy);
  m.step += moved * 0.06;
  // heavy steps you hear before you see it
  m.stepT -= moved;
  if (m.stepT <= 0 && d < 1300) { m.stepT = 90; Sound.at(m.x, m.y, () => Sound.lordStep(0.7), !m.los); if (d < 600) G.shake = Math.max(G.shake, 3); }
  m.growlT -= dt;
  if (m.growlT <= 0 && d < 1500 && m.state !== "hunt") { m.growlT = 9 + Math.random() * 10; Sound.growl(0.3, clamp(0.3 - d / 3000, 0.04, 0.3)); }
}

// while it hunts you, the alert timer runs and the heart pounds
function updateLordFx(dt) {
  G.lordAlert = Math.max(0, (G.lordAlert || 0) - dt);
  const lord = G.mons.find(m => m.type === "lord" && !m.dead);
  if (Net.guest) { if (!G.lordHunt) return; }
  else if (!lord || lord.state !== "hunt" || lord.tgRemote || World.indoor) { G.lordHunt = false; return; }
  G.heartT = (G.heartT || 0) - dt;
  if (G.heartT <= 0) { G.heartT = 0.5; Sound.heart(); }
}
