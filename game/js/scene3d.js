"use strict";
// 3D view (Three.js): builds the world from World/G and syncs it every frame.
// World x/y map to three.js x/z; y is up. Units are the same pixels the simulation uses (≈40 per metre).

const EYE = 62, WALL_H = 124, DOOR_H = 92;
const FURN_H = { crate: 30, bench: 36, table: 34, bed: 24, shelf: 84, altar: 40, pew: 20, board: 0, desk: 28, cauldron: 32, car: 52, altarstone: 34, wchest: 30, stage: 30, coffin: 26, cart: 34, barrel: 40 };

const V = {
  ready: false, mobile: false, shadows: true, renderer: null, scene: null, camera: null,
  hemi: null, moon: null, spot: null, pool: [], muzzle: null, vm: null, vmId: null, kick: 0, time: 0,
  idx: {}, inst: {}, crates: [], seals: [], notes: [], pickups: [], mons: new Map(), dying: [], dyn: new Map(),
};

const tmpO = new THREE.Object3D(), tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
const lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });

const QUALITY = {
  low:  { n: "Низкая",  ratio: 0.75, shadow: 0,    fog: 10, rain: 500 },
  mid:  { n: "Средняя", ratio: 1,    shadow: 512,  fog: 22, rain: 900 },
  high: { n: "Высокая", ratio: 1.75, shadow: 1024, fog: 34, rain: 1600 },
};

function initScene() {
  V.mobile = Input.touch || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  let q = null;
  try { q = localStorage.getItem("bp.quality"); } catch (e) {}
  V.quality = QUALITY[q] ? q : V.mobile ? "mid" : "high";
  const cv = document.getElementById("c");
  const r = V.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !V.mobile, powerPreference: "high-performance" });
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.shadowMap.autoUpdate = false;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.3;
  const s = V.scene = new THREE.Scene();
  s.fog = new THREE.Fog(0x020306, 30, 600);
  s.background = new THREE.Color(0x020306);
  V.camera = new THREE.PerspectiveCamera(72, 1, 1.5, 2600);
  s.add(V.camera);

  V.hemi = new THREE.HemisphereLight(0x9aa6b8, 0x2a2a1e, 1);
  s.add(V.hemi);
  V.moon = new THREE.DirectionalLight(0x9fb0d8, 0.5);
  V.moon.position.set(-0.5, 1, -0.3);
  s.add(V.moon);

  const sp = V.spot = new THREE.SpotLight(0xfff0d2, 9, FLASH_RANGE * 1.2, FLASH_HALF * 1.05, 0.55, 0);
  sp.position.set(7, -6, 2);
  sp.target.position.set(0, -6, -100);
  V.camera.add(sp); V.camera.add(sp.target);
  sp.shadow.camera.near = 6; sp.shadow.camera.far = FLASH_RANGE * 1.2;
  sp.shadow.bias = -0.0015;

  for (let i = 0; i < (V.mobile ? 3 : 4); i++) { const l = new THREE.PointLight(0xffa050, 0, 300, 0); s.add(l); V.pool.push(l); }
  V.muzzle = new THREE.PointLight(0xffd090, 0, 420, 0);
  V.muzzle.position.set(0, 0, -30);
  V.camera.add(V.muzzle);

  for (const l of [V.hemi, V.moon, sp, V.muzzle, ...V.pool]) l.layers.enableAll();
  V.vm = new THREE.Group();
  V.vm.scale.setScalar(0.6);
  V.camera.add(V.vm);

  buildTextures();
  buildSky();
  buildDynamicPools();
  buildAtmosphere();
  buildCreepy();
  rebuildWorld3d();
  setQuality(V.quality, true);
  addEventListener("resize", resize3d);
  V.ready = true;
}

function setQuality(q, initial) {
  V.quality = q;
  const Q = QUALITY[q];
  if (!initial) try { localStorage.setItem("bp.quality", q); } catch (e) {}
  const sp = V.spot;
  sp.castShadow = Q.shadow > 0;
  if (Q.shadow) {
    if (sp.shadow.map) { sp.shadow.map.dispose(); sp.shadow.map = null; }
    sp.shadow.mapSize.set(Q.shadow, Q.shadow);
  }
  V.fogs.forEach((f, i) => f.visible = i < Q.fog);
  resize3d();
}

function resize3d() {
  const w = innerWidth, h = innerHeight;
  const Q = QUALITY[V.quality];
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, V.mobile ? Math.min(Q.ratio, 1.25) : Q.ratio));
  V.renderer.setSize(w, h, false);
  V.renderer.domElement.style.width = w + "px"; V.renderer.domElement.style.height = h + "px";
  V.camera.aspect = w / h;
  V.camera.fov = w / h < 1 ? 92 : 72;
  V.camera.updateProjectionMatrix();
}

// --- textures ---------------------------------------------------------------------

function buildTextures() {
  const rnd = mulberry32(5);
  const T = V.tex = {};
  // log-cabin wood: horizontal logs with grain
  T.wood = canvasTex(256, (g, S) => {
    g.fillStyle = "#b8a080"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) {
      const y = i * 64;
      const gr = g.createLinearGradient(0, y, 0, y + 64);
      gr.addColorStop(0, "#6a5640"); gr.addColorStop(0.2, "#c8b090"); gr.addColorStop(0.75, "#a89070"); gr.addColorStop(1, "#4a3a28");
      g.fillStyle = gr; g.fillRect(0, y, S, 64);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,40,20,${0.1 + rnd() * 0.25})`; g.lineWidth = 1; g.beginPath(); const yy = y + 6 + rnd() * 52; g.moveTo(0, yy); g.bezierCurveTo(S * 0.3, yy + rnd() * 6 - 3, S * 0.6, yy + rnd() * 6 - 3, S, yy); g.stroke(); }
      for (let k = 0; k < 3; k++) { g.fillStyle = "rgba(40,25,10,0.5)"; g.beginPath(); g.ellipse(rnd() * S, y + 20 + rnd() * 24, 5, 3, 0, 0, 7); g.fill(); }
    }
  }, true);
  T.bark = canvasTex(128, (g, S) => {
    g.fillStyle = "#9a8a78"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(30,20,12,${0.25 + rnd() * 0.45})`; const x = rnd() * S; g.fillRect(x, 0, 1 + rnd() * 3, S); }
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(20,14,8,${0.3 + rnd() * 0.4})`; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 5, 6 + rnd() * 18); }
  }, true);
  T.bark.repeat.set(2, 5);
  T.needles = canvasTex(128, (g, S) => {
    g.fillStyle = "#a0a8a0"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { const v = 0.4 + rnd() * 0.8; g.strokeStyle = `rgba(${40 * v | 0},${70 * v | 0},${40 * v | 0},0.7)`; g.lineWidth = 1; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y + 4 + rnd() * 6); g.stroke(); }
  }, true);
  T.needles.repeat.set(4, 2);
  T.shingle = canvasTex(256, (g, S) => {
    g.fillStyle = "#9a948a"; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const x = c * 32 + (r % 2) * 16, y = r * 32, v = 0.7 + rnd() * 0.4;
      g.fillStyle = `rgb(${130 * v | 0},${122 * v | 0},${110 * v | 0})`; g.fillRect(x + 1, y + 1, 30, 30);
      g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(x, y + 28, 32, 4);
    }
    for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(40,60,30,${rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 2 + rnd() * 6, 0, 7); g.fill(); }
  }, true);
  T.stone = canvasTex(128, (g, S) => {
    g.fillStyle = "#a8a8a0"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 800; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${rnd() * 0.25})` : `rgba(255,255,255,${rnd() * 0.15})`; g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 4, 1 + rnd() * 4); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(50,70,40,${rnd() * 0.35})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 3 + rnd() * 8, 0, 7); g.fill(); }
  }, true);
  T.rock = canvasTex(256, (g, S) => {
    g.fillStyle = "#8a8070"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { const v = rnd(); g.fillStyle = `rgba(${v < 0.5 ? "20,16,10" : "200,190,170"},${0.08 + rnd() * 0.2})`; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 6 + rnd() * 26, 4 + rnd() * 14, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = "rgba(10,8,5,0.5)"; g.lineWidth = 1 + rnd() * 2; g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 50; y += rnd() * 30; g.lineTo(x, y); } g.stroke(); }
  }, true);
  T.brick = canvasTex(256, (g, S) => {
    g.fillStyle = "#3a352e"; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const v = 0.7 + rnd() * 0.4; g.fillStyle = `rgb(${120 * v | 0},${112 * v | 0},${100 * v | 0})`; g.fillRect(c * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); }
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(40,60,30,${rnd() * 0.4})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 2 + rnd() * 9, 0, 7); g.fill(); }
    for (let i = 0; i < 25; i++) { g.fillStyle = `rgba(70,10,8,${rnd() * 0.4})`; g.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 3, 10 + rnd() * 40); }
  }, true);
  T.concrete = canvasTex(256, (g, S) => {
    g.fillStyle = "#9a9a94"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, 126, S, 4); g.fillRect(126, 0, 4, S);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(60,40,20,${0.1 + rnd() * 0.2})`; g.fillRect(rnd() * S, rnd() * S * 0.5, 4 + rnd() * 10, 30 + rnd() * 90); }
  }, true);
  T.detail = canvasTex(256, (g, S) => {
    g.fillStyle = "#909090"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.1 + rnd() * 0.25})` : `rgba(255,255,255,${0.05 + rnd() * 0.15})`; const z = 1 + rnd() * 3; g.fillRect(rnd() * S, rnd() * S, z, z); }
    for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(${rnd() < 0.5 ? "0,0,0" : "255,255,255"},0.12)`; g.beginPath(); const x = rnd() * S, y = rnd() * S; g.moveTo(x, y); g.lineTo(x + rnd() * 8 - 4, y - 4 - rnd() * 8); g.stroke(); }
  }, true);
  T.detail.colorSpace = THREE.NoColorSpace;
  const glow = document.createElement("canvas"); glow.width = glow.height = 64;
  const gg = glow.getContext("2d"), rg = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.25, "rgba(255,255,255,0.45)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  gg.fillStyle = rg; gg.fillRect(0, 0, 64, 64);
  T.glow = new THREE.CanvasTexture(glow);
  T.puff = canvasTex(128, (g, S) => {
    for (let i = 0; i < 14; i++) {
      const x = S * (0.25 + rnd() * 0.5), y = S * (0.35 + rnd() * 0.3), r = S * (0.12 + rnd() * 0.18);
      const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, "rgba(255,255,255,0.35)"); q.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = q; g.fillRect(0, 0, S, S);
    }
  });
}

// sky dome with a horizon that matches the fog, stars and the moon
function buildSky() {
  const s = V.scene;
  V.skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x05070d) }, bot: { value: new THREE.Color(0x020306) } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.8 + 0.02, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(h, 0.7)), 1.0); }",
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  V.sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 12), V.skyMat);
  V.sky.renderOrder = -10; V.sky.frustumCulled = false;
  s.add(V.sky);
  const n = 900, pos = new Float32Array(n * 3), rnd = mulberry32(11);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, e = Math.asin(0.08 + rnd() * 0.92);
    pos[i * 3] = Math.cos(a) * Math.cos(e) * 2100; pos[i * 3 + 1] = Math.sin(e) * 2100; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 2100;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  V.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  V.stars.renderOrder = -9; V.stars.frustumCulled = false;
  s.add(V.stars);
  V.moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: 0xdfe6ff, fog: false, depthWrite: false, transparent: true }));
  V.moonDisc.scale.setScalar(360); V.moonDisc.renderOrder = -8;
  s.add(V.moonDisc);
}

// fog banks lit by the flashlight, rain, visible flashlight beam, swaying lamps
function buildAtmosphere() {
  const s = V.scene;
  V.fogs = [];
  const fm = new THREE.MeshLambertMaterial({ map: V.tex.puff, color: 0xb8c0c0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 34; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(340, 140), fm);
    m.userData = { x: 0, y: 0, ph: Math.random() * 6, placed: false };
    m.renderOrder = 2;
    s.add(m); V.fogs.push(m);
  }
  const RN = QUALITY.high.rain, rp = new Float32Array(RN * 6);
  const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.BufferAttribute(rp, 3).setUsage(THREE.DynamicDrawUsage));
  V.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8a9aaa, transparent: true, opacity: 0.35, depthWrite: false }));
  V.rain.frustumCulled = false; V.rain.visible = false;
  V.rainDrops = Array.from({ length: RN }, () => ({ x: Math.random() * 900 - 450, y: Math.random() * 400, z: Math.random() * 900 - 450 }));
  s.add(V.rain);
  // visible beam: a soft additive cone in front of the flashlight
  const len = 360, rad = Math.tan(FLASH_HALF * 0.85) * len;
  const bg = new THREE.ConeGeometry(rad, len, 28, 1, true); bg.translate(0, -len / 2, 0); bg.rotateX(Math.PI / 2);
  const beamTex = canvasTex(64, (g, S) => { const q = g.createLinearGradient(0, 0, 0, S); q.addColorStop(0, "#fff"); q.addColorStop(0.35, "#777"); q.addColorStop(1, "#000"); g.fillStyle = q; g.fillRect(0, 0, S, S); });
  beamTex.colorSpace = THREE.NoColorSpace;
  V.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffeccc, alphaMap: beamTex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  V.beam.position.set(7, -6, 2);
  V.camera.add(V.beam);
}

// --- geometry helpers -------------------------------------------------------------

// merge several geometries (already positioned) into one with per-part vertex colours
function mergeParts(parts) {
  const pos = [], nor = [], col = [], uv = [];
  for (const { geo, c, shade = 0 } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    tmpC.set(c);
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) {
      const k = 1 - shade * (0.5 + 0.5 * Math.sin(i * 0.37 + P[i * 3] * 0.05));
      col.push(tmpC.r * k, tmpC.g * k, tmpC.b * k);
      // planar mapping by the dominant normal axis, 128 px per texture tile
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]);
      if (ay >= ax && ay >= az) uv.push(x / 128, z / 128); else if (ax >= az) uv.push(z / 128, y / 128); else uv.push(x / 128, y / 128);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
function box(x, y, z, w, h, d, c, shade = 0.08) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
  return { geo: g, c, shade };
}
function cyl(x, y, z, r1, r2, h, c, seg = 8) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y, z);
  return { geo: g, c };
}

function surfaceH(x, y) {
  for (const f of World.furn) if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return FURN_H[f.kind] || 0;
  return 0;
}

function canvasTex(size, draw, repeat = false) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, V.renderer.capabilities.getMaxAnisotropy());
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// --- static world --------------------------------------------------------------------

function disposeTree(root) {
  const shared = new Set(Object.values(V.tex));
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) { if (m.map && !shared.has(m.map)) m.map.dispose(); m.dispose(); }
  });
}

// the map's static scene lives in one group that is thrown away when the player changes location
function rebuildWorld3d() {
  if (V.world) { V.scene.remove(V.world); disposeTree(V.world); }
  V.world = new THREE.Group();
  V.scene.add(V.world);
  Object.assign(V, { crates: [], seals: [], notes: [], pickups: [], wchests: [], hz: [], hanged: [] });
  buildStatic();
  buildLamps();
  V.builtMap = World.map;
  World.dirty = true;
}

function buildLamps() {
  V.lampMeshes = World.lights.map(l => {
    const g = new THREE.Group();
    if (l.torch) {
      // standing torch: pole, bowl, flame
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 70, 6), lam(0x2a1e14)); pole.position.y = 35; g.add(pole);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 5, 8, 8), lam(0x333333)); bowl.position.y = 72; g.add(bowl);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(6, 18, 7), glowMat(0xff9030)); fl.position.y = 84; g.add(fl);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: 0xff8020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
      halo.scale.setScalar(70); halo.position.y = 84; g.add(halo);
      g.userData.flame = fl;
      g.position.set(l.x, 0, l.y);
    } else if (!l.col.startsWith("255")) {
      if (World.indoor) {
        // fluorescent tube on the ceiling
        const tube = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 6), glowMat(0xdfe8ff)); tube.position.y = -4; g.add(tube);
        g.userData.tube = tube;
        g.position.set(l.x, WALL_H, l.y);
      } else return null;
    } else {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 4), lam(0x222222)); cord.position.y = -15; g.add(cord);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), glowMat(0xffd090)); bulb.position.y = -32; g.add(bulb);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      halo.scale.setScalar(40); halo.position.y = -32; g.add(halo);
      g.position.set(l.x, WALL_H, l.y);
    }
    V.world.add(g);
    return g;
  });
}

function buildStatic() {
  const s = V.world;
  const rnd = mulberry32(99);
  const st = World.style || { base: "#1c2416", road: "dirt" };

  // ground: one painted texture for the whole map
  const gsz = V.mobile ? 2048 : 4096;
  const groundTex = canvasTex(gsz, (g, S) => {
    const k = S / WORLD_W;
    g.fillStyle = st.base; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S * S / 60; i++) {
      const v = rnd();
      g.fillStyle = v < 0.45 ? `rgba(8,12,6,${0.2 + rnd() * 0.35})` : v < 0.85 ? `rgba(44,58,30,${0.2 + rnd() * 0.3})` : `rgba(62,50,32,${0.25 + rnd() * 0.3})`;
      const z = (1 + rnd() * 2.5) * S / 4096;
      g.fillRect(rnd() * S, rnd() * S, z * 2, z * 2);
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(30,24,14,${0.1 + rnd() * 0.15})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, (20 + rnd() * 60) * k, 0, 7); g.fill(); }
    g.lineCap = "round"; g.lineJoin = "round";
    const roadCols = st.road === "planks" ? [[56, "rgba(20,16,10,0.9)"], [40, "#4a3a28"], [4, "#2a2016"]] : [[60, "rgba(30,26,18,0.9)"], [42, "#2e271a"], [10, "#372f21"]];
    for (const [w, c] of roadCols) {
      g.strokeStyle = c; g.lineWidth = w * k;
      for (const r of World.roads) { g.beginPath(); g.moveTo(r[0][0] * k, r[0][1] * k); for (const p of r) g.lineTo(p[0] * k, p[1] * k); g.stroke(); }
    }
    if (st.road === "planks") {
      // cross boards on the boardwalks
      g.strokeStyle = "rgba(15,10,6,0.8)"; g.lineWidth = 2 * k;
      for (const r of World.roads) for (let i = 0; i < r.length - 1; i++) {
        const [ax, ay] = r[i], [bx, by] = r[i + 1], L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
        for (let t = 0; t < L; t += 14) { const x = ax + ux * t, y = ay + uy * t; g.beginPath(); g.moveTo((x - uy * 20) * k, (y + ux * 20) * k); g.lineTo((x + uy * 20) * k, (y - ux * 20) * k); g.stroke(); }
      }
    }
    for (const sw of World.swamp) { g.fillStyle = "#121a10"; g.beginPath(); g.arc(sw.x * k, sw.y * k, (sw.r + 18) * k, 0, 7); g.fill(); }
    for (const b of World.blood) { g.fillStyle = `rgba(${60 + rnd() * 30 | 0},6,4,${0.5 + rnd() * 0.4})`; g.beginPath(); g.ellipse(b.x * k, b.y * k, b.r * k, b.r * k * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill(); }
    if (World.dungeon) {
      // dungeon floor: flagstones, dirt or concrete slabs over the carved tiles
      const D = World.dungeon;
      for (let y = 0; y < D.ROWS; y++) for (let x = 0; x < D.COLS; x++) {
        if (!D.floor[y * D.COLS + x]) continue;
        const px = (D.ox + x * D.T) * k, py = (D.oy + y * D.T) * k, q = D.T * k, v = 0.75 + rnd() * 0.4;
        if (st.floor === "mine") { g.fillStyle = `rgb(${52 * v | 0},${42 * v | 0},${30 * v | 0})`; g.fillRect(px, py, q, q); }
        else if (st.floor === "bunker") { g.fillStyle = `rgb(${72 * v | 0},${72 * v | 0},${68 * v | 0})`; g.fillRect(px, py, q, q); g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(px, py, q, 1.5 * k); g.fillRect(px, py, 1.5 * k, q); }
        else { g.fillStyle = `rgb(${62 * v | 0},${58 * v | 0},${50 * v | 0})`; g.fillRect(px + k, py + k, q - 2 * k, q - 2 * k); }
      }
      if (st.floor === "mine") {
        g.strokeStyle = "#3a2c1e"; g.lineWidth = 3 * k;
        for (const c of World.rooms) { g.beginPath(); g.moveTo((c.cx - 60) * k, c.cy * k); g.lineTo((c.cx + 60) * k, c.cy * k); g.stroke(); }
      }
    }
    const a = World.altar;
    if (a) {
    g.fillStyle = "#18160f"; g.beginPath(); g.arc(a.x * k, a.y * k, 250 * k, 0, 7); g.fill();
    g.strokeStyle = "#2c2418"; g.lineWidth = 7 * k; g.beginPath(); g.arc(a.x * k, a.y * k, 120 * k, 0, 7); g.stroke();
    g.strokeStyle = "rgba(110,30,20,0.55)"; g.lineWidth = 3 * k; g.beginPath();
    for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + i * Math.PI * 4 / 5; const x = a.x + Math.cos(an) * 115, y = a.y + Math.sin(an) * 115; i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k); }
    g.stroke();
    }
  });
  // the painted canvas is huge; once it is on the GPU the CPU copy can go
  groundTex.onUpdate = () => { const c = groundTex.image; if (c && c.width > 1) { c.width = 1; c.height = 1; } };
  const gmat = lam(0xffffff, { map: groundTex });
  // fine detail texture multiplied over the painted map so the ground is not blurry up close
  gmat.onBeforeCompile = sh => {
    sh.uniforms.detailMap = { value: V.tex.detail };
    sh.fragmentShader = "uniform sampler2D detailMap;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n  diffuseColor.rgb *= texture2D(detailMap, vMapUv * 260.0).rgb * 1.75;");
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), gmat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD_W / 2, 0, WORLD_H / 2);
  ground.receiveShadow = true;
  s.add(ground);
  // dark border so the map edge is not a cliff into nothing
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 3, WORLD_H * 3), lam(World.indoor ? 0x050505 : 0x0e130b));
  outer.rotation.x = -Math.PI / 2; outer.position.set(WORLD_W / 2, -1, WORLD_H / 2);
  s.add(outer);

  // swamp water as one mesh
  if (World.swamp.length) {
    const wp = World.swamp.map(sw => { const g = new THREE.CircleGeometry(sw.r, 20); g.rotateX(-Math.PI / 2); g.translate(sw.x, 0.6, sw.y); return { geo: g, c: "#ffffff" }; });
    const wm = new THREE.Mesh(mergeParts(wp), new THREE.MeshPhongMaterial({ color: 0x0a1412, shininess: 90, specular: 0x334440 }));
    wm.receiveShadow = true;
    s.add(wm);
  }

  // houses: walls, lintels, furniture, floors, ceilings, roofs
  const parts = [], sparts = [];
  const wallKind = MAPS[World.map].wall, wallCol = { wood: "#4d3c2b", stone: "#6a6458", rock: "#5a5040", concrete: "#7a7a74" }[wallKind];
  for (const R of World.walls) parts.push(box(R.x + R.w / 2, WALL_H / 2, R.y + R.h / 2, R.w, WALL_H, R.h, wallCol, 0.12));
  for (const h of World.houses) {
    const d = h.doorPos, lh = WALL_H - DOOR_H;
    if (h.door === "s" || h.door === "n") parts.push(box(d.x, DOOR_H + lh / 2, d.y, DOOR + 4, lh, WT, "#43342a"));
    else parts.push(box(d.x, DOOR_H + lh / 2, d.y, WT, lh, DOOR + 4, "#43342a"));
  }
  for (const f of World.furn) {
    const cx = f.x + f.w / 2, cz = f.y + f.h / 2, H = FURN_H[f.kind] || 20;
    switch (f.kind) {
      case "crate": break; // separate meshes (they change colour)
      case "bench":
        parts.push(box(cx, H - 3, cz, f.w, 6, f.h, "#5e4630"));
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(cx + ox * (f.w / 2 - 4), (H - 6) / 2, cz + oz * (f.h / 2 - 4), 5, H - 6, 5, "#3e2e1e"));
        parts.push(box(cx - 30, H + 2, cz - 4, 24, 4, 6, "#8a8a8a")); parts.push(box(cx + 10, H + 3, cz + 6, 30, 3, 4, "#999"));
        parts.push(box(cx + 38, H + 8, cz, 14, 16, 14, "#3a2a1a"));
        break;
      case "table":
        parts.push(box(cx, H - 2, cz, f.w, 4, f.h, "#4e3a26"));
        for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(cx + ox * (f.w / 2 - 3), (H - 4) / 2, cz + oz * (f.h / 2 - 3), 4, H - 4, 4, "#36281a"));
        break;
      case "bed":
        parts.push(box(cx, 8, cz, f.w, 16, f.h, "#3a2a1c")); parts.push(box(cx, 19, cz, f.w - 6, 6, f.h - 6, "#6b6a5e"));
        parts.push(box(cx, 23, f.y + 14, f.w - 14, 5, 16, "#8c8a7c")); parts.push(box(cx, 23, cz + 14, f.w - 6, 3, f.h - 40, "#4a3f5e"));
        parts.push(box(cx, 26, f.y + 3, f.w, 40, 6, "#3a2a1c"));
        break;
      case "shelf":
        parts.push(box(cx, H / 2, cz, f.w, H, f.h, "#3e2e1e"));
        for (let i = 0; i < 4; i++) parts.push(box(f.x + 10 + i * 18, 40 + (i % 2) * 22, cz, 10, 14, f.h - 8, "#6a5a40"));
        break;
      case "altar": sparts.push(box(cx, H / 2, cz, f.w, H, f.h, "#7a7470")); parts.push(box(cx, H + 1, cz, f.w - 8, 2, f.h - 10, "#7a2020")); break;
      case "pew": parts.push(box(cx, 12, cz, f.w, 4, f.h, "#3e2c1c")); parts.push(box(cx, 22, f.y + f.h, f.w, 22, 3, "#3e2c1c")); parts.push(box(cx, 5, cz, f.w - 10, 10, 3, "#2e2014")); break;
      case "board": parts.push(box(cx, 70, f.y + 2, f.w, 50, 4, "#1e2a22")); break;
      case "desk": parts.push(box(cx, H - 2, cz, f.w, 4, f.h, "#4a3a28")); parts.push(box(cx, (H - 4) / 2, cz, f.w - 8, H - 4, f.h - 8, "#3a2c1e")); break;
      case "cauldron": sparts.push(cyl(cx, 16, cz, f.w / 2, f.w / 2 - 6, 32, "#2a2a2a", 14)); break;
      case "car":
        sparts.push(box(cx, 22, cz, f.w, 28, f.h, "#2a2f36")); sparts.push(box(cx - 6, 44, cz, 52, 18, f.h - 8, "#1a1e24"));
        for (const [ox, oz] of [[-36, -26], [36, -26], [-36, 26], [36, 26]]) sparts.push(cyl(cx + ox, 9, cz + oz, 9, 9, 6, "#111", 10));
        sparts.push(box(f.x + f.w, 26, cz - 18, 2, 6, 10, "#c8b060")); sparts.push(box(f.x + f.w, 26, cz + 18, 2, 6, 10, "#c8b060"));
        break;
      case "altarstone": sparts.push(box(cx, H / 2, cz, f.w, H, f.h, "#6a665e", 0.2)); break;
      case "wchest":
        parts.push(box(cx, 13, cz, f.w, 26, f.h, "#3a4a30")); sparts.push(box(cx, 27, cz, f.w + 2, 4, f.h + 2, "#555a50"));
        sparts.push(box(cx, 14, cz - f.h / 2 - 1, 8, 8, 2, "#b0a060")); break;
      case "stage": parts.push(box(cx, H / 2, cz, f.w, H, f.h, "#5a2a22")); break;
      case "coffin": parts.push(box(cx, 10, cz, f.w, 20, f.h, "#2e2218")); parts.push(box(cx + 4, 22, cz, f.w - 4, 4, f.h - 6, "#3a2a1e")); break;
      case "cart": sparts.push(box(cx, 20, cz, f.w, 22, f.h, "#4a3a2a")); for (const oz of [-1, 1]) sparts.push(cyl(cx + oz * (f.w / 2), 8, cz, 7, 7, 4, "#222", 10)); break;
      case "barrel": sparts.push(cyl(cx, 20, cz, f.w / 2, f.w / 2, 40, "#3a4a3a", 12)); sparts.push(cyl(cx, 30, cz, f.w / 2 + 0.5, f.w / 2 + 0.5, 3, "#222", 12)); break;
    }
  }
  for (const st of World.stones) sparts.push(cyl(st.x, 55, st.y, st.r * 0.75, st.r, 110, "#6a665c", 6));
  const houseMesh = new THREE.Mesh(mergeParts(parts), lam(0xffffff, { vertexColors: true, map: { wood: V.tex.wood, stone: V.tex.brick, rock: V.tex.rock, concrete: V.tex.concrete }[wallKind] }));
  houseMesh.castShadow = houseMesh.receiveShadow = true;
  s.add(houseMesh);
  const stoneMesh = new THREE.Mesh(mergeParts(sparts), lam(0xffffff, { vertexColors: true, map: V.tex.stone }));
  stoneMesh.castShadow = stoneMesh.receiveShadow = true;
  s.add(stoneMesh);

  const plank = canvasTex(256, (g, S) => {
    g.fillStyle = "#6a5038"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.15})`; g.fillRect(0, i * 32, S, 32);
      g.fillStyle = "rgba(0,0,0,0.5)"; g.fillRect(0, i * 32, S, 2);
      g.fillRect(rnd() * S, i * 32, 2, 32);
    }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.15})`; g.fillRect(rnd() * S, rnd() * S, 8 + rnd() * 20, 1); }
  }, true);
  const roofParts = [];
  if (World.dungeon) {
    const D = World.dungeon, W = D.COLS * D.T, H = D.ROWS * D.T;
    roofParts.push(box(D.ox + W / 2, WALL_H + 2, D.oy + H / 2, W, 4, H, World.map === "bunker" ? "#4a4a46" : "#2a2622", 0));
  }
  for (const h of World.houses) {
    const fg = new THREE.PlaneGeometry(h.w, h.h);
    const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * h.w / 128, uv.getY(i) * h.h / 128);
    const floor = new THREE.Mesh(fg, lam(h.floor, { map: plank }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(h.x + h.w / 2, 0.8, h.y + h.h / 2); floor.receiveShadow = true;
    s.add(floor);
    const m = 16;
    if (h.ruin) {
      // a collapsed roof: a few broken beams
      for (let i = 0; i < 3; i++) roofParts.push(box(h.x + h.w * (0.25 + i * 0.25), WALL_H - 10 - i * 18, h.y + h.h / 2, 8, 8, h.h + 10, "#2a2016"));
      continue;
    }
    // ceiling
    roofParts.push(box(h.x + h.w / 2, WALL_H + 2, h.y + h.h / 2, h.w + m * 2, 4, h.h + m * 2, "#2a1f16", 0));
    // gable roof along the longer side
    const horiz = h.w >= h.h, L = (horiz ? h.w : h.h) + m * 2, Wd = (horiz ? h.h : h.w) + m * 2, rh = Wd * 0.38;
    const shape = new THREE.Shape(); shape.moveTo(-Wd / 2, 0); shape.lineTo(Wd / 2, 0); shape.lineTo(0, rh); shape.lineTo(-Wd / 2, 0);
    const rg = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false });
    rg.translate(0, 0, -L / 2);
    if (horiz) rg.rotateY(Math.PI / 2);
    rg.translate(h.x + h.w / 2, WALL_H + 4, h.y + h.h / 2);
    roofParts.push({ geo: rg, c: h.roof, shade: 0.1 });
    if (h.cross) {
      const cx = h.x + h.w / 2, cz = h.y + 60, top = WALL_H + 4 + rh;
      roofParts.push(box(cx, top + 26, cz, 6, 52, 6, "#555")); roofParts.push(box(cx, top + 36, cz, 6, 6, 30, "#555"));
    }
  }
  const roofs = new THREE.Mesh(mergeParts(roofParts), lam(0xffffff, { vertexColors: true, side: THREE.DoubleSide, map: World.indoor ? V.tex.rock : V.tex.shingle }));
  roofs.castShadow = true; roofs.receiveShadow = true;
  s.add(roofs);

  // crates
  for (const o of World.inter) if (o.type === "crate") {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), lam(0x6a4e2e));
    b.position.y = 15; b.castShadow = b.receiveShadow = true; g.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(32, 3, 32), lam(0x4a3420)); lid.position.y = 31; g.add(lid);
    g.position.set(o.x, 0, o.y);
    s.add(g);
    V.crates.push({ i: World.inter.indexOf(o), body: b.material, lid });
  }

  // notes, weapon pickups, seals
  const paper = lam(0xe8dfc4, { emissive: 0x3a352a });
  World.inter.forEach((o, i) => {
    if (o.type === "note") {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), paper.clone());
      m.rotation.x = -Math.PI / 2; m.rotation.z = 0.3;
      m.position.set(o.x, surfaceH(o.x, o.y) + 1.2, o.y);
      s.add(m); V.notes.push({ i, m });
    } else if (o.type === "pickup") {
      const g = gunModel(o.weapon);
      g.rotation.set(-Math.PI / 2, 0, 0.6);
      g.position.set(o.x, surfaceH(o.x, o.y) + 3, o.y);
      s.add(g); V.pickups.push({ i, m: g });
    } else if (o.type === "seal") {
      const col = o.seal === "bone" ? 0xe8e0c8 : o.seal === "heart" ? 0xd03020 : 0x60d0ff;
      let geo;
      if (o.seal === "bone") { geo = new THREE.CapsuleGeometry(2.5, 18, 4, 8); geo.rotateZ(Math.PI / 2); }
      else if (o.seal === "heart") geo = new THREE.IcosahedronGeometry(7, 1);
      else geo = new THREE.SphereGeometry(7, 16, 12);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 }));
      if (o.seal === "eye") { const pu = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), glowMat(0x000000)); pu.position.x = 6; m.add(pu); }
      m.position.set(o.x, surfaceH(o.x, o.y) + 12, o.y);
      s.add(m); V.seals.push({ i, m, y: m.position.y });
    }
  });
  // seals placed on the altar
  V.altarSeals = new THREE.Group();
  [0xd8d0b8, 0xc03020, 0x60d0ff].forEach((c, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), glowMat(c)); m.position.set(-16 + i * 16, 40, 0); V.altarSeals.add(m); });
  if (World.altar) V.altarSeals.position.set(World.altar.x, 0, World.altar.y);
  V.altarSeals.visible = false;
  s.add(V.altarSeals);
  buildMapDressing(s);

  buildResources();
}

function buildResources() {
  const s = V.world;
  const idx = V.idx = { tree: [], rock: [], bush: [], scrap: [] };
  World.res.forEach((o, i) => idx[o.type].push(i));

  const trunkGeo = new THREE.CylinderGeometry(0.65, 1, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, lam(0xffffff, { map: V.tex.bark }), idx.tree.length);
  // pine canopy: three stacked cones in unit space (radius 1, height 1)
  const cp = [];
  const cpU = [];
  [[0.22, 0.42, 1], [0.42, 0.36, 0.78], [0.6, 0.4, 0.52]].forEach(([y, h, r]) => { const g = new THREE.ConeGeometry(r, h, 9); g.translate(0, y + h / 2, 0); cpU.push(g.toNonIndexed().attributes.uv.array); cp.push({ geo: g, c: "#ffffff", shade: 0.25 }); });
  const cpUV = () => { const a = []; for (const u of cpU) for (const v of u) a.push(v); return new THREE.Float32BufferAttribute(a, 2); };
  // canopy cones keep their own UVs for the needle texture
  const cgeo = mergeParts(cp); cgeo.setAttribute("uv", cpUV(cp.length));
  const canopy = new THREE.InstancedMesh(cgeo, lam(0xffffff, { vertexColors: true, map: V.tex.needles }), idx.tree.length);
  trunks.castShadow = canopy.castShadow = true;
  trunks.receiveShadow = true;
  idx.tree.forEach((ri, k) => {
    const o = World.res[ri];
    trunks.setColorAt(k, tmpC.set(o.dead ? 0x4a4440 : 0x3a2a1c));
    canopy.setColorAt(k, tmpC.setRGB(0.05 + o.hue * 0.03, 0.12 + o.hue * 0.06, 0.06 + o.hue * 0.02));
  });
  s.add(trunks, canopy);

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 1), lam(0x8a8880, { map: V.tex.stone, flatShading: true }), idx.rock.length);
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), lam(0xffffff), idx.bush.length);
  const scrapGeo = mergeParts([cyl(6, 11, 0, 9, 9, 22, "#6a4a30", 10), box(-8, 6, 4, 22, 12, 16, "#4a3428"), box(-4, 3, -10, 26, 4, 5, "#5a5a5a"), box(-14, 10, 6, 4, 18, 4, "#5a5a5a")]);
  const scraps = new THREE.InstancedMesh(scrapGeo, lam(0xffffff, { vertexColors: true }), idx.scrap.length);
  rocks.castShadow = scraps.castShadow = true;
  rocks.receiveShadow = true;
  s.add(rocks, bushes, scraps);
  V.inst = { trunks, canopy, rocks, bushes, scraps };

  // grass tufts
  const tufts = World.props.filter((p, i) => !p.k && (!V.mobile || i % 3 === 0) && !insideHouse(p.x, p.y, 10) && distToRoad(p.x, p.y) > 26);
  const grass = new THREE.InstancedMesh(mergeParts([cyl(0, 6, 0, 0, 2.2, 12, "#2c3a1e", 3), cyl(3, 5, 2, 0, 1.8, 10, "#26331a", 3), cyl(-2, 7, -2, 0, 2, 14, "#304020", 3)]), lam(0xffffff, { vertexColors: true }), tufts.length);
  tufts.forEach((p, k) => { tmpO.position.set(p.x, 0, p.y); tmpO.rotation.set(0, p.s * 6, 0); tmpO.scale.setScalar(0.8 + p.s * 0.8); tmpO.updateMatrix(); grass.setMatrixAt(k, tmpO.matrix); });
  s.add(grass);
  syncResources();
}

function syncResources() {
  const { trunks, canopy, rocks, bushes, scraps } = V.inst;
  V.idx.tree.forEach((ri, k) => {
    const o = World.res[ri];
    const H = 320 + o.hue * 220;
    tmpO.rotation.set(0, o.hue * 9, 0);
    tmpO.position.set(o.x, 0, o.y);
    if (o.left > 0) tmpO.scale.set(o.r, o.dead ? H * 0.6 : H * 0.8, o.r); else tmpO.scale.set(o.r, 14, o.r);
    tmpO.updateMatrix(); trunks.setMatrixAt(k, tmpO.matrix);
    if (o.left > 0 && !o.dead) tmpO.scale.set(o.cr * 1.05, H, o.cr * 1.05); else tmpO.scale.set(0, 0, 0);
    tmpO.updateMatrix(); canopy.setMatrixAt(k, tmpO.matrix);
  });
  V.idx.rock.forEach((ri, k) => {
    const o = World.res[ri], q = o.left > 0 ? o.r * (0.6 + 0.4 * o.left / o.max) : 0;
    tmpO.position.set(o.x, q * 0.35, o.y); tmpO.rotation.set(o.sh * 3, o.sh * 7, 0); tmpO.scale.set(q * 1.15, q * 0.8, q);
    tmpO.updateMatrix(); rocks.setMatrixAt(k, tmpO.matrix);
  });
  V.idx.bush.forEach((ri, k) => {
    const o = World.res[ri];
    tmpO.position.set(o.x, o.r * 0.45, o.y); tmpO.rotation.set(0, o.sh * 6, 0); tmpO.scale.set(o.r * 1.3, o.r * 0.9, o.r * 1.2);
    tmpO.updateMatrix(); bushes.setMatrixAt(k, tmpO.matrix);
    bushes.setColorAt(k, o.left > 0 ? tmpC.set(0x3d6a2a) : tmpC.set(0x2a2a1a));
  });
  V.idx.scrap.forEach((ri, k) => {
    const o = World.res[ri];
    tmpO.position.set(o.x, 0, o.y); tmpO.rotation.set(0, o.sh * 6, 0); tmpO.scale.setScalar(o.left > 0 ? 1 : 0);
    tmpO.updateMatrix(); scraps.setMatrixAt(k, tmpO.matrix);
  });
  for (const m of [trunks, canopy, rocks, bushes, scraps]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  World.dirty = false;
}

// --- map dressing: exits, horror props, traps -----------------------------------------

function buildMapDressing(s) {
  const P = [], wood = "#3a2a1c", dark = "#1a1410", bone = "#cfc6ae", rope = "#6a5a3a";
  const at = (g, x, y, a) => { g.rotateY(-a); g.translate(x, 0, y); return g; };
  const B = (x, y, z, w, h, d, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return { g, c }; };
  const C = (x, y, z, r1, r2, h, c, seg = 6, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return { g, c }; };
  const S = (x, y, z, r, c, sy = 1) => { const g = new THREE.SphereGeometry(r, 8, 6); g.scale(1, sy, 1); g.translate(x, y, z); return { g, c }; };
  const place = (list, x, y, a, k = 1) => { for (const it of list) { it.g.scale(k, k, k); P.push({ geo: at(it.g, x, y, a), c: it.c }); } };
  for (const e of World.exits) {
    if (e.look === "sign") place([C(0, 45, 0, 3, 3, 90, wood), B(14, 78, 0, 46, 18, 3, "#4a3a28"), B(36, 78, 0, 6, 10, 3, "#4a3a28")], e.x, e.y, Math.atan2(e.y - e.ay, e.x - e.ax));
    else if (e.look === "hatch" || e.look === "bunker") {
      const col = e.look === "bunker" ? "#4a4e46" : "#2a2016";
      place([B(0, 1.5, 0, 56, 3, 56, "#0a0a0a"), B(0, 3, -24, 60, 6, 8, col), B(0, 3, 24, 60, 6, 8, col), B(-24, 3, 0, 8, 6, 60, col), B(24, 3, 0, 8, 6, 60, col), B(0, 30, -30, 50, 4, 30, col)], e.x, e.y, 0);
    } else if (e.look === "mine") place([C(-38, 50, 0, 5, 5, 100, wood), C(38, 50, 0, 5, 5, 100, wood), B(0, 100, 0, 90, 10, 12, wood), B(0, 50, 6, 70, 96, 2, "#050403")], e.x, e.y, Math.atan2(e.ay - e.y, e.ax - e.x) - Math.PI / 2);
    else if (e.look === "ladder") place([C(-12, 62, 0, 2, 2, 124, wood), C(12, 62, 0, 2, 2, 124, wood), ...[0, 1, 2, 3, 4, 5].map(i => B(0, 12 + i * 20, 0, 24, 3, 3, wood))], e.x, e.y, 0);
  }
  for (const d of World.decor) {
    switch (d.k) {
      case "cross": place([B(0, 26, 0, 5, 52, 5, wood), B(0, 38, 0, 24, 5, 5, wood), S(0, 0, 0, 10, "#2a2418", 0.3)], d.x, d.y, d.a); break;
      case "bones": place([S(0, 4, 0, 6, bone), C(10, 2, 4, 1.5, 1.5, 18, bone, 5, 0, 1.4), C(-6, 2, -8, 1.5, 1.5, 16, bone, 5, 1.3, 0.3), C(4, 2, -10, 1.2, 1.2, 12, bone, 5, 0.2, 1.6), S(-4, 3, 8, 3, bone)], d.x, d.y, d.a, d.s); break;
      case "totem": place([C(0, 45, 0, 3, 4, 90, wood), S(0, 96, 0, 8, bone, 1.3), C(-10, 108, 0, 1, 2, 30, dark, 5, 0, 0.7), C(10, 108, 0, 1, 2, 30, dark, 5, 0, -0.7), B(0, 70, 0, 20, 3, 3, rope)], d.x, d.y, d.a); break;
      case "doll": place([S(0, 6, 0, 5, "#d8d0c0", 1.2), S(0, 15, 0, 4, "#e8e0d0"), S(2.5, 16, 1.5, 0.8, "#000"), S(2.5, 16, -1.5, 0.8, "#000"), C(0, 3, 5, 1, 1, 8, "#d8d0c0", 5, 1.2), C(0, 3, -5, 1, 1, 8, "#d8d0c0", 5, -1.2)], d.x, d.y, d.a); break;
      case "gate": place([C(0, 80, -90, 5, 6, 160, wood), C(0, 80, 90, 5, 6, 160, wood), B(0, 158, 0, 8, 26, 200, "#5a2018"), B(0, 158, 0, 9, 18, 150, "#b8a060")], d.x, d.y, 0); break;
      case "flag": place([C(0, 110, 0, 2, 3, 220, "#666", 6), B(0, 200, 22, 2, 26, 40, "#601010")], d.x, d.y, d.a); break;
      case "effigy": {
        // a stick figure tied with twine, hanging at head height
        const y = 95 * d.s;
        place([C(0, y, 0, 0.8, 0.8, 26, dark, 4), C(0, y + 8, 0, 0.7, 0.7, 24, dark, 4, 0, Math.PI / 2), C(-6, y - 18, 0, 0.7, 0.7, 20, dark, 4, 0, 0.35), C(6, y - 18, 0, 0.7, 0.7, 20, dark, 4, 0, -0.35), B(0, y + 3, 0, 4, 4, 4, rope), C(0, y + 30, 0, 0.3, 0.3, 30, rope, 3)], d.x, d.y, d.a, 1);
        break;
      }
    }
  }
  if (P.length) { const m = new THREE.Mesh(mergeParts(P), lam(0xffffff, { vertexColors: true })); m.castShadow = true; m.receiveShadow = true; s.add(m); }
  // camp gate sign
  for (const d of World.decor) if (d.k === "gate") {
    const t = canvasTex(256, (g, S) => { g.clearRect(0, 0, S, S); g.fillStyle = "#b8a060"; g.fillRect(0, S * 0.3, S, S * 0.4); g.fillStyle = "#5a1810"; g.font = "bold 64px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ЗОРЬКА", S / 2, S / 2 + 4); g.fillStyle = "rgba(40,20,10,0.5)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * S, S * 0.3 + Math.random() * S * 0.4, 3 + Math.random() * 10, 2); });
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), lam(0xffffff, { map: t, transparent: true, alphaTest: 0.5 }));
      m.position.set(d.x + side * 5, 158, d.y); m.rotation.y = side * Math.PI / 2; s.add(m);
    }
  }
  // hanged bodies sway; they are separate so they can move
  const sack = lam(0x3a3228), rp = lam(0x6a5a3a);
  for (const d of World.decor) if (d.k === "hanged") {
    const piv = new THREE.Group(); piv.position.set(d.x, 150, d.y);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 4), rp); r.position.y = -20; piv.add(r);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(9, 46, 3, 8), sack); b.position.y = -72; b.castShadow = true; piv.add(b);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), sack); hd.position.set(0, -44, 0); piv.add(hd);
    for (const sd of [-1, 1]) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(2.5, 26, 2, 5), sack); f.position.set(0, -112, sd * 4); piv.add(f); }
    piv.rotation.y = d.a; s.add(piv); V.hanged.push({ piv, ph: d.x * 0.01 });
  }
  // weapon chests glint while full
  World.inter.forEach((o, i) => {
    if (o.type !== "wchest") return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: 0xd8c890, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
    sp.scale.setScalar(30); sp.position.set(o.x, 34, o.y); s.add(sp);
    V.wchests.push({ i, sp });
  });
  // traps
  const metal = lam(0x6a6a66), rust = lam(0x5a3a28);
  World.hazards.forEach((h, i) => {
    if (h.kind === "spikes") {
      const g = new THREE.Group(); g.position.set(h.x, 0, h.y); s.add(g);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(h.w, 2, h.h), rust); plate.position.y = 1; g.add(plate);
      const sp = new THREE.Group(); g.add(sp);
      for (let x = -h.w / 2 + 8; x < h.w / 2; x += 14) for (let z = -h.h / 2 + 8; z < h.h / 2; z += 14) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.6, 30, 5), metal); c.position.set(x, 15, z); sp.add(c); }
      V.hz.push({ i, kind: "spikes", sp });
    } else if (h.kind === "bear") {
      const g = new THREE.Group(); g.position.set(h.x, 0, h.y); s.add(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.4, 5, 16), metal); ring.rotation.x = Math.PI / 2; ring.position.y = 1.5; g.add(ring);
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const c = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 4), metal); c.position.set(Math.cos(a) * 9, 4, Math.sin(a) * 9); g.add(c); }
      V.hz.push({ i, kind: "bear", g });
    } else if (h.kind === "wire") {
      const L = Math.hypot(h.x2 - h.x1, h.y2 - h.y1);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, L, 3), new THREE.MeshBasicMaterial({ color: 0xb0b0a0, transparent: true, opacity: 0 }));
      w.rotation.z = Math.PI / 2; w.rotation.y = -Math.atan2(h.y2 - h.y1, h.x2 - h.x1);
      w.position.set((h.x1 + h.x2) / 2, 10, (h.y1 + h.y2) / 2); s.add(w);
      V.hz.push({ i, kind: "wire", w });
    }
  });
}

// eyes in the dark and the far-away figure (they outlive map changes)
function buildCreepy() {
  V.watch = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const eyes = [];
    for (const sd of [-1, 1]) {
      const e = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: 0xff2a10, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
      e.scale.set(16, 9, 1); e.position.x = sd * 6; g.add(e); eyes.push(e);
    }
    g.visible = false; V.scene.add(g); V.watch.push({ g, eyes });
  }
  V.figure = buildMonster({ type: "stalker", x: 0, y: 0, fake: false });
  V.figure.g.visible = false;
  V.figure.g.scale.setScalar(1.15);
}

function syncCreepy(dt) {
  const cam = V.camera;
  V.watch.forEach((v, i) => {
    const w = G.watchers[i];
    v.g.visible = !!w && G.state !== "title";
    if (!w) return;
    v.g.position.set(w.x, w.h, w.y);
    v.g.lookAt(cam.position.x, w.h, cam.position.z);
    const a = (w.blink > 0 ? 0 : 1) * Math.min(1, w.t * 2) * (w.seen > 0 ? 0.4 : 1);
    v.eyes.forEach(e => { e.material.opacity = a; e.material.color.set(w.col); });
  });
  const f = G.figure, fv = V.figure;
  fv.g.visible = !!f && G.state === "play";
  if (f) {
    fv.g.position.set(f.x, 0, f.y);
    fv.g.rotation.y = -Math.atan2(G.p.y - f.y, G.p.x - f.x);
    if (fv.jaw) fv.jaw.rotation.z = -0.6;
  }
  for (const h of V.hanged) { h.piv.rotation.z = Math.sin(V.time * 0.7 + h.ph) * 0.06; h.piv.rotation.x = Math.cos(V.time * 0.5 + h.ph) * 0.04; }
  for (const c of V.wchests) { const o = World.inter[c.i]; c.sp.visible = !!(o && o.full); c.sp.material.opacity = 0.25 + 0.2 * Math.sin(V.time * 3 + c.i); }
  const p = G.p;
  for (const v of V.hz) {
    const h = World.hazards[v.i];
    if (!h) continue;
    if (v.kind === "spikes") v.sp.position.y = h.state === 2 ? 0 : h.state === 1 ? -22 + Math.random() * 3 : -31;
    else if (v.kind === "bear") {
      // hidden in the dark: only a flashlight or standing right next to it reveals the metal
      const d2 = dist2(p.x, p.y, h.x, h.y);
      v.g.visible = !h.armed || d2 < 55 * 55 || (isBeamLit(h.x, h.y, 10) && d2 < 260 * 260);
      v.g.scale.y = h.armed ? 1 : 0.4;
    } else if (v.kind === "wire") {
      const lit = h.armed && (isBeamLit((h.x1 + h.x2) / 2, (h.y1 + h.y2) / 2, 30) && dist2(p.x, p.y, h.x1, h.y1) < 280 * 280);
      v.w.material.opacity = lit ? 0.8 : 0;
      v.w.visible = h.armed;
    }
  }
  // flames and tubes
  (V.lampMeshes || []).forEach(g => {
    if (!g) return;
    if (g.userData.flame) { const k = 0.85 + Math.random() * 0.3; g.userData.flame.scale.set(k, k * (0.9 + Math.random() * 0.3), k); }
    if (g.userData.tube) g.userData.tube.material.color.setScalar(Math.random() < 0.06 ? 0.15 : 1);
  });
}

// --- dynamic pools -------------------------------------------------------------------

function buildDynamicPools() {
  const s = V.scene;
  const N = 700;
  const mk = (additive) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ size: additive ? 5 : 3.5, vertexColors: true, sizeAttenuation: true, transparent: additive, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !additive }));
    m.frustumCulled = false; s.add(m); return m;
  };
  V.pts = mk(false); V.glow = mk(true);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(64 * 6), 3).setUsage(THREE.DynamicDrawUsage));
  V.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.8 }));
  V.tracers.frustumCulled = false; s.add(V.tracers);
  const dg = new THREE.CircleGeometry(1, 10); dg.rotateX(-Math.PI / 2);
  V.decals = new THREE.InstancedMesh(dg, lam(0xffffff, { transparent: true, opacity: 0.85, depthWrite: false }), 200);
  V.decals.frustumCulled = false; V.decals.count = 0; s.add(V.decals);
  const rg = new THREE.ConeGeometry(7, 1, 5); rg.translate(0, 0.5, 0);
  V.roots = new THREE.InstancedMesh(rg, lam(0x2a1c10), 60); V.roots.count = 0; V.roots.frustumCulled = false; s.add(V.roots);
  const wg = new THREE.CircleGeometry(20, 14); wg.rotateX(-Math.PI / 2);
  V.warns = new THREE.InstancedMesh(wg, new THREE.MeshBasicMaterial({ color: 0x701808, transparent: true, opacity: 0.55, depthWrite: false }), 60); V.warns.count = 0; V.warns.frustumCulled = false; s.add(V.warns);
}

// creates or reuses a mesh for a dynamic game object (projectile, fire, trap, drop)
function dynMesh(obj, make) {
  let m = V.dyn.get(obj);
  if (!m) { m = make(); V.scene.add(m); V.dyn.set(obj, m); }
  m.userData.seen = V.frame;
  return m;
}

// --- weapon models -----------------------------------------------------------------

function gunModel(id) {
  const g = new THREE.Group();
  const add = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, lam(c)); m.position.set(x, y, z); g.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  switch (id) {
    case "knife": add(B(2.4, 3, 9), 0x2a2018, 0, 0, 0); add(B(0.8, 3.4, 14), 0xc8c8c8, 0, 0.6, -11); break;
    case "axe": add(B(2.6, 2.6, 34), 0x6a4a2a, 0, 0, -10); add(B(1.6, 12, 9), 0x9a9a9a, 0, 4, -26); break;
    case "bat": { add(new THREE.CylinderGeometry(2.6, 1.6, 40, 8).rotateX(Math.PI / 2), 0x7a5a3a, 0, 0, -14); for (let i = 0; i < 5; i++) add(B(0.5, 8, 0.5), 0xcccccc, 0, 0, -22 - i * 3.5).rotation.z = i; break; }
    case "machete": add(B(2.4, 3, 9), 0x222222, 0, 0, 0); add(B(0.8, 5, 30), 0xc0c0c0, 0, 0.8, -19); break;
    case "pistol": add(B(3, 3.4, 14), 0x1a1a1a, 0, 1.4, -6); add(B(2.8, 7, 3.6), 0x2a2a2a, 0, -3, -1).rotation.x = 0.25; break;
    case "shotgun": add(B(3, 3, 34), 0x1a1a1a, 0, 1.4, -16); add(B(2.6, 2.6, 26), 0x222222, 0, -1.2, -14); add(B(3.4, 5, 14), 0x5a3a20, 0, -0.5, 6); break;
    case "crossbow": add(B(3, 3, 26), 0x5a3a20, 0, 0, -8); add(B(30, 2, 2.4), 0x333333, 0, 0.6, -20); add(B(0.8, 0.8, 22), 0xc8b080, 0, 2, -12); break;
    case "molotov": add(new THREE.CylinderGeometry(3, 3.4, 12, 10), 0x3a6a40, 0, 0, 0); add(B(1.6, 6, 1.6), 0xd8c8a0, 0, 8, 0); add(new THREE.SphereGeometry(2.2, 6, 6), 0xffa030, 0, 11.5, 0).material = glowMat(0xffa030); break;
  }
  return g;
}

function buildViewModel(id) {
  const vm = V.vm;
  while (vm.children.length) vm.remove(vm.children[0]);
  const skin = lam(0xc8a882), sleeve = lam(0x2f3a42);
  const hand = new THREE.Group();
  const w = gunModel(id);
  hand.add(w);
  const fist = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 6), skin); fist.position.set(0, -1, 1); hand.add(fist);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 22), sleeve); arm.position.set(1, -3, 13); hand.add(arm);
  hand.position.set(10, -10, -18);
  if (id === "molotov") hand.position.set(10, -12, -20);
  vm.add(hand);
  // left hand with the flashlight
  const left = new THREE.Group();
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 12, 10).rotateX(Math.PI / 2), lam(0x2a2a2a)); left.add(torch);
  V.lens = new THREE.Mesh(new THREE.CircleGeometry(1.8, 10), glowMat(0xfff0c0)); V.lens.position.z = -6.05; left.add(V.lens);
  const lf = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 6), skin); lf.position.set(0, -1, 1); left.add(lf);
  const la = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 22), sleeve); la.position.set(-1, -3, 13); left.add(la);
  left.position.set(-11, -11, -20);
  vm.add(left);
  vm.userData = { hand, left };
  // view model draws over everything and ignores fog
  // the view model lives on layer 1 and is drawn in a second pass over the cleared depth
  vm.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.fog = false; } o.layers.set(1); });
  V.vmId = id;
}

// --- monsters ----------------------------------------------------------------------
// Low-poly but deliberately unpleasant: gaunt bodies, open jaws with teeth, claws, glowing eyes.

const MG = {
  sph: new THREE.SphereGeometry(1, 12, 10),
  eye: new THREE.SphereGeometry(1, 8, 6),
  cone: new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  caps: new Map(),
};
const MM = {
  tooth: lam(0xd9d0b0), maw: new THREE.MeshBasicMaterial({ color: 0x1a0303 }), socket: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  blood: lam(0x3a0606), bone: lam(0xd8d0b8),
};
function capsule(r, len) {
  const k = r + ":" + len;
  if (!MG.caps.has(k)) MG.caps.set(k, new THREE.CapsuleGeometry(r, len, 3, 7));
  return MG.caps.get(k);
}
function part(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  parent.add(m); return m;
}
// a limb hanging down (-y) from a pivot; claws optional
function limb(parent, r, len, mat, x, y, z, claws = 0, clawLen = 8) {
  const piv = new THREE.Group(); piv.position.set(x, y, z);
  const m = new THREE.Mesh(capsule(r, len), mat); m.position.y = -len / 2 - r; m.castShadow = true;
  piv.add(m); parent.add(piv);
  for (let i = 0; i < claws; i++) {
    const a = (i / Math.max(1, claws - 1) - 0.5) * 1.2;
    part(piv, MG.cone, MM.tooth, Math.sin(a) * r * 0.4 + r * 0.3, -len - r * 1.6, Math.cos(a) * r * 0.9 * (i % 2 ? 1 : -1) * 0.6, r * 0.28, clawLen, r * 0.28, 0, 0, Math.PI - 0.35);
  }
  return piv;
}
function head(v, parent, x, y, z, s, skin, eyeCol, o = {}) {
  const h = new THREE.Group(); h.position.set(x, y, z); parent.add(h);
  if (o.mask) part(h, MG.sph, lam(0xe8e4dc), 0, 0, 0, s * 0.8, s * 1.25, s * 0.85);
  else if (o.deer) { part(h, MG.sph, MM.bone, s * 0.5, 0, 0, s * 1.6, s * 0.75, s * 0.7); part(h, MG.sph, MM.bone, -s * 0.2, s * 0.25, 0, s * 0.8, s * 0.8, s * 0.8); }
  else { part(h, MG.sph, skin, 0, 0, 0, s, s * 1.1, s * 0.9); part(h, MG.sph, skin, s * 0.45, s * 0.38, 0, s * 0.45, s * 0.28, s * 0.85); }
  const ex = o.deer ? s * 0.55 : s * 0.72, ey = o.mask ? s * 0.35 : o.deer ? s * 0.32 : s * 0.18, ez = o.deer ? s * 0.42 : s * 0.36;
  for (const k of [-1, 1]) {
    part(h, MG.sph, MM.socket, ex, ey, k * ez, s * 0.2, s * (o.mask ? 0.3 : 0.22), s * 0.2);
    const e = part(h, MG.eye, glowMat(eyeCol), ex + s * 0.12, ey, k * ez, s * 0.07, s * 0.07, s * 0.07);
    v.eyes.push(e);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.tex.glow, color: eyeCol, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.8 }));
  glow.position.set(ex + s * 0.2, ey, 0); glow.scale.set(s * 2.2, s * 1.1, 1); h.add(glow); v.glows.push(glow);
  // mouth: dark maw, upper teeth on the skull, lower teeth on a hinged jaw
  const mx = o.deer ? s * 1.6 : s * 0.62, my = o.mask ? -s * 0.45 : -s * 0.38, teeth = o.teeth || 5, tw = o.mask ? s * 0.08 : s * 0.13;
  part(h, MG.sph, MM.maw, mx - s * 0.1, my, 0, s * 0.4, o.mask ? s * 0.5 : s * 0.32, s * (o.mask ? 0.25 : 0.5));
  for (let i = 0; i < teeth; i++) { const t = (i - (teeth - 1) / 2); part(h, MG.cone, MM.tooth, mx + s * 0.18, my + s * 0.08, t * tw, s * 0.045, s * 0.24, s * 0.045, Math.PI, 0, 0); }
  const jaw = new THREE.Group(); jaw.position.set(o.deer ? s * 0.4 : s * 0.05, my - s * 0.05, 0); h.add(jaw);
  part(jaw, MG.box, o.deer ? MM.bone : skin, (mx - jaw.position.x) * 0.55, -s * 0.12, 0, (mx - jaw.position.x) * 1.15, s * 0.18, s * (o.mask ? 0.4 : 0.8));
  for (let i = 0; i < teeth; i++) { const t = (i - (teeth - 1) / 2); part(jaw, MG.cone, MM.tooth, mx - jaw.position.x + s * 0.12, -s * 0.05, t * tw, s * 0.04, s * 0.22, s * 0.04); }
  if (o.blood) part(jaw, MG.sph, MM.blood, mx - jaw.position.x, -s * 0.3, 0, s * 0.25, s * 0.35, s * 0.3);
  v.head = h; v.jaw = jaw;
  return h;
}

function buildMonster(m) {
  const d = MONSTERS[m.type];
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const skin = lam(d.col), dark = lam(new THREE.Color(d.col).multiplyScalar(0.55));
  const v = { g, body, legs: [], arms: [], mats: [skin, dark], eyes: [], glows: [], head: null, jaw: null, tw: 0, twT: 1, twX: 0, twZ: 0 };
  switch (m.type) {
    case "crawler": {
      // a person forced onto all fours, limbs bent the wrong way
      part(body, capsule(7, 20), skin, 0, 18, 0, 1, 1, 1, 0, 0, Math.PI / 2);
      for (let i = -1; i <= 1; i++) part(body, MG.box, dark, i * 5, 25, 0, 1.4, 1.4, 12);
      head(v, body, 20, 17, 0, 6.5, skin, d.eye, { blood: true });
      v.head.rotation.x = 0.6;
      for (const [x, s] of [[10, 1], [10, -1], [-10, 1], [-10, -1]]) {
        const piv = new THREE.Group(); piv.position.set(x, 18, s * 6); body.add(piv);
        piv.rotation.x = s * 2.4;
        const up = new THREE.Mesh(capsule(2.2, 14), skin); up.position.y = -9; piv.add(up);
        const elbow = new THREE.Group(); elbow.position.y = -18; elbow.rotation.x = -s * 2.1; piv.add(elbow);
        const lo = new THREE.Mesh(capsule(1.8, 18), dark); lo.position.y = -11; elbow.add(lo);
        for (let k = 0; k < 3; k++) part(elbow, MG.cone, MM.tooth, (k - 1) * 1.5, -21, 0, 0.5, 6, 0.5, Math.PI, 0, (k - 1) * 0.3);
        piv.userData.s = s * (x > 0 ? 1 : -1);
        v.legs.push(piv);
      }
      break;
    }
    case "ghoul": {
      v.legs.push(limb(body, 3.2, 26, dark, 0, 38, -6), limb(body, 3.2, 26, dark, 0, 38, 6));
      part(body, MG.sph, dark, 0, 38, 0, 6, 5, 9);
      part(body, capsule(7, 18), skin, 5, 50, 0, 1, 1, 1, 0, 0, -0.5);
      for (let t = -6; t <= 6; t += 4) part(body, MG.box, dark, 5 + 0.48 * t + 6.2, 50 + 0.88 * t - 3.4, 0, 1.4, 1.4, 12.5 - Math.abs(t) * 0.3, 0, 0, -0.5);
      part(body, MG.sph, MM.blood, 12, 50, 2, 3, 5, 4);
      part(body, MG.sph, skin, 10, 58, 0, 5, 4, 12);
      part(body, capsule(2.5, 7), skin, 14, 62, 0, 1, 1, 1, 0, 0, -0.9);
      head(v, body, 19, 67, 0, 7.5, skin, d.eye, { blood: true });
      v.arms.push(limb(body, 2.4, 34, skin, 10, 58, -12, 4, 9), limb(body, 2.4, 34, skin, 10, 58, 12, 4, 9));
      break;
    }
    case "stalker": {
      // very tall, black, with a white face that has nothing on it but eyes and a mouth
      v.legs.push(limb(body, 2, 46, skin, 0, 56, -5), limb(body, 2, 46, skin, 0, 56, 5));
      part(body, capsule(4.5, 26), skin, 3, 74, 0, 1, 1, 1, 0, 0, -0.2);
      part(body, MG.sph, skin, 6, 90, 0, 4, 3, 10);
      part(body, capsule(1.6, 14), skin, 9, 98, 0, 1, 1, 1, 0, 0, -0.35);
      head(v, body, 13, 110, 0, 6.5, skin, d.eye, { mask: true, teeth: 9 });
      v.arms.push(limb(body, 1.6, 64, skin, 6, 90, -11, 4, 15), limb(body, 1.6, 64, skin, 6, 90, 11, 4, 15));
      for (let i = 0; i < 7; i++) part(body, new THREE.CylinderGeometry(0.4, 0.9, 24, 3), skin, -2, 84 + i * 3, (i - 3) * 3, 1, 1, 1, (i - 3) * 0.35, 0, -0.9);
      break;
    }
    case "brute": {
      v.legs.push(limb(body, 8, 26, dark, -4, 40, -12), limb(body, 8, 26, dark, -4, 40, 12));
      part(body, MG.sph, skin, 0, 64, 0, 24, 28, 26, 0, 0, -0.4);
      part(body, MG.sph, MM.blood, 16, 58, 6, 6, 8, 8);
      head(v, body, 24, 84, 0, 11, dark, d.eye, { teeth: 7, blood: true });
      v.arms.push(limb(body, 7, 42, skin, 10, 82, -26, 4, 14), limb(body, 7, 42, skin, 10, 82, 26, 4, 14));
      for (let i = 0; i < 11; i++) { const a = (i / 10 - 0.5) * 2.4; part(body, MG.cone, dark, -14, 76 + Math.cos(a) * 8, a * 13, 2.5, 30 + (i % 3) * 8, 2.5, a * 0.6, 0, 0.9); }
      break;
    }
    case "spitter": {
      v.legs.push(limb(body, 3, 8, dark, -2, 16, -7), limb(body, 3, 8, dark, -2, 16, 7));
      part(body, MG.sph, skin, 0, 30, 0, 17, 16, 18);
      const pus = lam(0x9aaa3a, { emissive: 0x334400 });
      for (let i = 0; i < 7; i++) part(body, MG.sph, pus, Math.cos(i * 1.7) * 9 - 4, 34 + Math.sin(i * 2.3) * 8, Math.sin(i * 1.7) * 12, 5 + (i % 3), 5 + (i % 3), 5 + (i % 3));
      head(v, body, 16, 38, 0, 5.5, dark, d.eye, { teeth: 6 });
      for (let i = 0; i < 3; i++) part(v.jaw, new THREE.CylinderGeometry(0.4, 0.2, 10, 3), pus, 6, -6, (i - 1) * 2);
      break;
    }
    case "boss": {
      v.legs.push(limb(body, 12, 70, dark, 0, 100, -18), limb(body, 12, 70, dark, 0, 100, 18));
      part(body, capsule(6, 60), dark, -4, 140, 0, 1, 1, 1, 0, 0, -0.2);
      for (let i = 0; i < 6; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 2, 1.8, 4, 10, Math.PI * 1.1), MM.bone);
        rib.rotation.set(Math.PI / 2, 0, -Math.PI * 0.55); rib.position.set(-2 + i * 1.5, 118 + i * 9, 0); body.add(rib);
      }
      const heart = part(body, MG.sph, new THREE.MeshBasicMaterial({ color: 0xc01808 }), 2, 140, 0, 8, 9, 8);
      v.heart = heart;
      part(body, MG.sph, dark, 4, 172, 0, 12, 8, 34);
      part(body, capsule(4, 16), dark, 12, 182, 0, 1, 1, 1, 0, 0, -0.7);
      head(v, body, 26, 198, 0, 13, dark, d.eye, { deer: true, teeth: 8 });
      v.arms.push(limb(body, 7, 96, dark, 8, 172, -38, 4, 24), limb(body, 7, 96, dark, 8, 172, 38, 4, 24));
      const ant = lam(0x3a2a1a);
      for (const sd of [-1, 1]) {
        const branch = (x, y, z, len, rx, rz, depth) => {
          const piv = new THREE.Group(); piv.position.set(x, y, z); piv.rotation.set(rx, 0, rz);
          const c = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3, len, 5), ant); c.position.y = len / 2; piv.add(c); v.head.add(piv);
          if (depth > 0) { piv.updateMatrix(); const tip = new THREE.Vector3(0, len, 0).applyMatrix4(piv.matrix); branch(tip.x, tip.y, tip.z, len * 0.65, rx + sd * 0.35, rz + 0.4, depth - 1); branch(tip.x, tip.y, tip.z, len * 0.6, rx - sd * 0.1, rz - 0.5, depth - 1); }
        };
        branch(-4, 8, sd * 7, 42, sd * 0.7, 0.2, 2);
      }
      const moss = lam(0x1e2a16);
      for (let i = 0; i < 10; i++) part(body, new THREE.CylinderGeometry(0.6, 1.2, 30 + i * 3, 3), moss, -10 + (i % 4) * 6, 150 - i, (i - 5) * 6, 1, 1, 1, 0, 0, 0.1);
      break;
    }
  }
  if (m.fake) for (const x of [skin, dark]) { x.transparent = true; x.opacity = 0.6; }
  g.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  V.scene.add(g);
  return v;
}

function syncMonsters(dt) {
  const alive = new Set(), p = G.p;
  for (const m of G.mons) {
    alive.add(m);
    let v = V.mons.get(m);
    if (!v) { v = buildMonster(m); V.mons.set(m, v); }
    const g = v.g, d = Math.hypot(m.x - p.x, m.y - p.y);
    g.position.set(m.x, 0, m.y);
    g.rotation.y += angDiff(g.rotation.y, -m.a) * Math.min(1, dt * 10);
    const moving = !m.frozen && m.stun <= 0;
    const sw = Math.sin(m.step) * (moving ? 0.7 : 0);
    const L = v.legs;
    if (m.type === "crawler") L.forEach((pv, i) => { pv.rotation.z = Math.sin(m.step * 1.6 + i * 1.6) * 0.45 * pv.userData.s; });
    else if (L.length) { L[0].rotation.z = sw; L[1].rotation.z = -sw; }
    const wind = m.wind > 0;
    v.arms.forEach((a, i) => {
      const base = m.type === "stalker" ? 0.35 : m.type === "boss" ? 0.5 : m.type === "brute" ? 0.6 : 1.0;
      a.rotation.z = lerp(a.rotation.z, wind ? 2.5 : base + Math.sin(m.step + i * 3) * 0.25, Math.min(1, dt * (wind ? 14 : 6)));
      a.rotation.x = (i ? 1 : -1) * (wind ? 0.35 : 0.12);
    });
    // jaw: wide when attacking, chattering when close
    if (v.jaw) {
      const open = wind ? 0.95 : d < 260 ? 0.35 + 0.25 * Math.sin(V.time * 9 + m.x) : m.type === "stalker" ? 0.5 : 0.12;
      v.jaw.rotation.z = lerp(v.jaw.rotation.z, -open, Math.min(1, dt * 12));
    }
    // sudden head twitches
    if (v.head) {
      v.twT -= dt;
      if (v.twT <= 0) { v.twT = 0.4 + Math.random() * (m.type === "stalker" ? 1 : 2.2); v.twX = (Math.random() - 0.5) * 1.1; v.twZ = (Math.random() - 0.5) * 0.6; v.tw = 0.14; }
      v.tw -= dt;
      const tx = v.tw > 0 ? v.twX : (m.type === "crawler" ? 0.6 : 0), tz = v.tw > 0 ? v.twZ : 0;
      v.head.rotation.x += (tx - v.head.rotation.x) * Math.min(1, dt * 35);
      v.head.rotation.z += (tz - v.head.rotation.z) * Math.min(1, dt * 35);
    }
    v.body.scale.y = 1 + Math.sin(V.time * 3 + m.x) * 0.018;
    v.body.position.x = wind ? -4 : 0;
    v.body.rotation.z = m.stun > 0 ? Math.sin(V.time * 10) * 0.2 : 0;
    if (m.type === "stalker") v.body.position.z = moving ? (Math.random() - 0.5) * 1.5 : 0;
    if (v.heart) v.heart.scale.setScalar(8 * (1 + 0.15 * Math.max(0, Math.sin(V.time * 7))));
    const flash = m.hitF > 0 ? 0.8 : m.burn > 0 ? 0.35 : 0;
    for (const mt of v.mats) { mt.emissive.setRGB(flash, flash * (m.burn > 0 ? 0.4 : 1), flash * (m.burn > 0 ? 0.1 : 1)); if (m.fake) mt.opacity = 0.3 + 0.25 * Math.sin(V.time * 12); }
    // eye halos are strongest in the dark
    const halo = m.lit && G.night < 0.4 ? 0.15 : 0.85;
    v.glows.forEach(s => s.material.opacity = halo * (0.8 + 0.2 * Math.sin(V.time * 6 + m.y)));
  }
  for (const [m, v] of V.mons) if (!alive.has(m)) { V.mons.delete(m); V.dying.push({ v, t: m.fake ? 0.25 : 1.2, max: m.fake ? 0.25 : 1.2, fake: m.fake }); }
  V.dying = V.dying.filter(d => {
    d.t -= dt;
    const k = 1 - d.t / d.max;
    if (d.fake) d.v.g.scale.setScalar(1 + k * 0.6);
    else { d.v.body.rotation.z = Math.min(1.5, k * 3); d.v.g.position.y = -k * 6; d.v.eyes.forEach(e => e.visible = false); d.v.glows.forEach(e => e.visible = false); if (d.v.jaw) d.v.jaw.rotation.z = -1; }
    if (d.t <= 0) {
      V.scene.remove(d.v.g);
      d.v.g.traverse(o => {
        if (o.geometry && o.geometry !== MG.sph && o.geometry !== MG.eye && o.geometry !== MG.cone && o.geometry !== MG.box && ![...MG.caps.values()].includes(o.geometry)) o.geometry.dispose();
        if (o.material && o.material !== MM.tooth && o.material !== MM.maw && o.material !== MM.socket && o.material !== MM.blood && o.material !== MM.bone) o.material.dispose();
      });
      return false;
    }
    return true;
  });
}

// --- per-frame sync --------------------------------------------------------------------

function syncDynamic(dt) {
  V.frame = (V.frame || 0) + 1;
  // crates, notes, pickups, seals
  for (const c of V.crates) { const o = World.inter[c.i]; const full = o && o.full; c.body.color.set(full ? 0x6a4e2e : 0x3a2c1c); c.lid.position.x = full ? 0 : 10; c.lid.rotation.z = full ? 0 : -0.5; }
  const pulse = 0.5 + 0.5 * Math.sin(V.time * 3);
  for (const n of V.notes) { const o = World.inter[n.i]; n.m.material.emissive.setScalar(G.notes.includes(o.key) ? 0.04 : 0.12 + 0.2 * pulse); }
  for (const p of V.pickups) p.m.visible = !World.inter[p.i].taken;
  for (const s of V.seals) { const o = World.inter[s.i]; s.m.visible = !G.seals.includes(o.seal); s.m.rotation.y += dt; s.m.position.y = s.y + Math.sin(V.time * 2 + s.i) * 2; }
  V.altarSeals.visible = G.placed && !!World.altar;

  // projectiles
  for (const pr of G.projs) {
    if (pr.kind === "dart") { const m = dynMesh(pr, () => new THREE.Mesh(new THREE.BoxGeometry(12, 1, 1), lam(0x8a8a80))); m.position.set(pr.x, 34, pr.y); m.rotation.y = -Math.atan2(pr.vy, pr.vx); }
    else if (pr.kind === "acid") { const m = dynMesh(pr, () => new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), glowMat(0xa8e030))); m.position.set(pr.x, 40, pr.y); }
    else if (pr.kind === "bolt") { const m = dynMesh(pr, () => { const b = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 1), lam(0xc8b080)); return b; }); m.position.set(pr.x, EYE - 8, pr.y); m.rotation.y = -Math.atan2(pr.vy, pr.vx); }
    else if (pr.kind === "bottle") { const m = dynMesh(pr, () => gunModel("molotov")); m.position.set(pr.x, 40 + pr.h * 2, pr.y); m.rotation.z += dt * 12; }
    else if (pr.kind === "firezone") {
      const m = dynMesh(pr, () => { const c = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.35, depthWrite: false })); return c; });
      m.position.set(pr.x, 1.5, pr.y); m.scale.setScalar(pr.r * (0.95 + 0.05 * Math.sin(V.time * 15))); m.material.opacity = 0.35 * Math.min(1, pr.life / 1.5);
    }
  }
  for (const f of G.fires) {
    const m = dynMesh(f, () => {
      const g = new THREE.Group();
      for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(5, 0), lam(0x444440)); st.position.set(Math.cos(i * 0.785) * 16, 2, Math.sin(i * 0.785) * 16); g.add(st); }
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 26, 6), lam(0x4a3420)); l.rotation.set(Math.PI / 2, i * 1.05, 0.4); l.position.y = 4; g.add(l); }
      const fl = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 7), glowMat(0xff8a20)); fl.position.y = 14; g.add(fl);
      const fl2 = new THREE.Mesh(new THREE.ConeGeometry(4, 14, 7), glowMat(0xffe080)); fl2.position.y = 10; g.add(fl2);
      g.userData.fl = fl; return g;
    });
    m.position.set(f.x, 0, f.y);
    const k = 0.8 + 0.25 * Math.sin(V.time * 18 + f.x) * Math.random();
    m.userData.fl.scale.set(k, k * (0.9 + 0.3 * Math.random()), k);
  }
  for (const t of G.traps) {
    const m = dynMesh(t, () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(12, 1.4, 5, 16).rotateX(Math.PI / 2), lam(0x8a8a8a)); r.position.y = 1.5; g.add(r); for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 4), lam(0xaaaaaa)); c.position.set(Math.cos(i * 0.628) * 10, 4, Math.sin(i * 0.628) * 10); c.rotation.set(Math.sin(i * 0.628) * 0.7, 0, -Math.cos(i * 0.628) * 0.7); g.add(c); } return g; });
    m.position.set(t.x, 0, t.y);
  }
  for (const d of G.drops) {
    const m = dynMesh(d, () => new THREE.Mesh(new THREE.OctahedronGeometry(3.5), glowMat(0xd8c890)));
    m.position.set(d.x, 8 + Math.sin(V.time * 4 + d.x) * 2, d.y); m.rotation.y += dt * 3;
  }
  for (const [o, m] of V.dyn) if (m.userData.seen !== V.frame) { V.scene.remove(m); m.traverse(x => { if (x.geometry) x.geometry.dispose(); }); V.dyn.delete(o); }

  // particles
  const P = V.pts.geometry.attributes, Q = V.glow.geometry.attributes;
  let np = 0, ng = 0;
  for (const q of G.parts) {
    if (q.z === undefined) { q.z = q.glow ? 6 + Math.random() * 10 : 20 + Math.random() * 30; q.vz = q.glow ? 40 + Math.random() * 40 : (Math.random() - 0.2) * 120; }
    q.z += q.vz * dt; if (!q.glow) q.vz -= 300 * dt; if (q.z < 0.5) { q.z = 0.5; q.vz = 0; }
    tmpC.set(q.col);
    const k = q.life / q.max;
    if (q.glow) { if (ng >= 700) continue; Q.position.setXYZ(ng, q.x, q.z, q.y); Q.color.setXYZ(ng, tmpC.r * k, tmpC.g * k, tmpC.b * k); ng++; }
    else { if (np >= 700) continue; P.position.setXYZ(np, q.x, q.z, q.y); P.color.setXYZ(np, tmpC.r, tmpC.g, tmpC.b); np++; }
  }
  V.pts.geometry.setDrawRange(0, np); V.glow.geometry.setDrawRange(0, ng);
  P.position.needsUpdate = P.color.needsUpdate = Q.position.needsUpdate = Q.color.needsUpdate = true;

  const T = V.tracers.geometry.attributes.position;
  let nt = 0;
  for (const t of G.tracers) { if (nt >= 64) break; T.setXYZ(nt * 2, t.x1, EYE - 8, t.y1); T.setXYZ(nt * 2 + 1, t.x2, EYE - 8, t.y2); nt++; }
  V.tracers.geometry.setDrawRange(0, nt * 2); T.needsUpdate = true;

  let nd = 0;
  for (const d of G.decals) {
    if (nd >= 200) break;
    tmpO.position.set(d.x, 0.9 + (nd % 7) * 0.05, d.y); tmpO.rotation.set(0, 0, 0); tmpO.scale.setScalar(d.r * Math.min(1, d.a * 1.5)); tmpO.updateMatrix();
    V.decals.setMatrixAt(nd, tmpO.matrix); V.decals.setColorAt(nd, tmpC.set(d.col).multiplyScalar(0.7)); nd++;
  }
  V.decals.count = nd; V.decals.instanceMatrix.needsUpdate = true; if (V.decals.instanceColor) V.decals.instanceColor.needsUpdate = true;

  let nr = 0, nw = 0;
  for (const r of G.roots) {
    if (r.t > 0) { if (nw < 60) { tmpO.position.set(r.x, 1.2, r.y); tmpO.scale.setScalar(0.6 + 0.4 * (1 - Math.min(1, r.t))); tmpO.rotation.set(0, 0, 0); tmpO.updateMatrix(); V.warns.setMatrixAt(nw++, tmpO.matrix); } }
    else if (nr < 60) { tmpO.position.set(r.x, 0, r.y); tmpO.rotation.set(0.2 * Math.sin(r.x), r.x, 0.2 * Math.cos(r.y)); tmpO.scale.set(1.4, 50 * Math.min(1, r.life * 3), 1.4); tmpO.updateMatrix(); V.roots.setMatrixAt(nr++, tmpO.matrix); }
  }
  V.roots.count = nr; V.warns.count = nw; V.roots.instanceMatrix.needsUpdate = V.warns.instanceMatrix.needsUpdate = true;
}

function syncLights(dt) {
  const p = G.p, n = G.night, storm = G.storm || 0;
  // sky, fog and ambient follow the time of day and the weather
  const day = (1 - n) * (1 - storm * 0.45);
  const fogC = tmpC.setRGB(lerp(0.004, 0.17, day), lerp(0.006, 0.19, day), lerp(0.012, 0.18, day));
  V.scene.fog.color.copy(fogC); V.scene.background.copy(fogC);
  V.skyMat.uniforms.bot.value.copy(fogC);
  V.skyMat.uniforms.top.value.setRGB(lerp(0.008, 0.3, day), lerp(0.012, 0.36, day), lerp(0.03, 0.42, day));
  // thick fog: the forest ends a few steps beyond the flashlight; the swamp is worse
  const mf = MAPS[World.map].fog;
  V.scene.fog.near = lerp(6, 110, day) * (1 - storm * 0.3) / mf;
  V.scene.fog.far = lerp(400, 1350, day) * (G.inside ? 0.85 : 1) * (1 - storm * 0.25) / mf;
  if (World.altar && n > 0.5) {
    const ad = Math.hypot(p.x - World.altar.x, p.y - World.altar.y), k = clamp(1 - ad / 700, 0, 1) * 0.8;
    if (k > 0) { fogC.lerp(tmpC2.setRGB(0.06, 0.004, 0.002), k); V.scene.fog.color.copy(fogC); V.scene.background.copy(fogC); V.skyMat.uniforms.bot.value.copy(fogC); }
  }
  if (World.indoor) {
    fogC.setRGB(0.002, 0.002, 0.003); V.scene.fog.color.copy(fogC); V.scene.background.copy(fogC);
    V.scene.fog.near = 10; V.scene.fog.far = 340;
  }
  // lightning: two quick flashes light the whole forest
  const b = G.bolt || 0, flash = b > 0.27 || (b > 0.1 && b < 0.17) ? 1 : 0;
  V.hemi.intensity = World.indoor ? 0.025 : lerp(0.05, 1.3, day * day) + flash * 2.2;
  V.moon.intensity = World.indoor ? 0 : lerp(0.11, 1.0, day) + flash * 3;
  V.moon.color.setRGB(lerp(0.55, 1, day), lerp(0.62, 0.96, day), lerp(0.85, 0.9, day));
  if (flash) V.skyMat.uniforms.top.value.setRGB(0.5, 0.55, 0.7);
  V.stars.material.opacity = clamp(n * 1.2 - 0.2, 0, 1) * (1 - storm);
  V.moonDisc.material.opacity = clamp(n * 1.2 - 0.2, 0, 1) * (1 - storm * 0.85);

  // flashlight: weak battery and nearby horrors make it flicker
  const on = p.light && G.lightOff <= 0;
  let flick = p.bat < 15 ? (Math.random() < 0.15 ? 0.25 : 1) : 1;
  if (G.interf > 0 && Math.random() < G.interf * 0.35) flick *= Math.random() * 0.4;
  V.spot.intensity = on ? 9 * flick : 0;
  V.beam.visible = on;
  V.beam.material.opacity = 0.075 * flick * (0.6 + n * 0.6);
  if (V.lens) V.lens.material.color.set(on ? 0xfff0c0 : 0x333333);
  V.muzzle.intensity = G.flash > 0 ? 6 : 0;

  // lamps sway on their cords
  World.lights.forEach((l, i) => {
    l.ox = Math.sin(V.time * 1.3 + i) * 9; l.oy = Math.cos(V.time * 1.1 + i * 2) * 5;
    const lm = V.lampMeshes[i];
    if (lm && !l.torch && l.col.startsWith("255")) { lm.rotation.z = -l.ox * 0.012; lm.rotation.x = l.oy * 0.012; }
  });

  // the closest light sources get the point lights from the pool
  const cand = [];
  for (const f of G.fires) cand.push({ x: f.x, y: f.y, h: 20 + Math.random() * 4, r: 330, i: 3 * (0.8 + 0.2 * Math.sin(V.time * 13 + f.x) * Math.random()), c: 0xff9040 });
  for (const l of World.lights) cand.push({ x: l.x + (l.torch ? 0 : l.ox), y: l.y + (l.torch ? 0 : l.oy), h: l.torch ? 84 : WALL_H - 32, r: l.r * 1.3, i: 3 * (1 - l.flick + l.flick * Math.sin(V.time * 9 + l.x)), c: new THREE.Color(`rgb(${l.col})`).getHex() });
  for (const pr of G.projs) if (pr.kind === "firezone") cand.push({ x: pr.x, y: pr.y, h: 20, r: 300, i: 4 * Math.min(1, pr.life / 2) * (0.8 + Math.random() * 0.3), c: 0xff8020 });
  for (const o of World.inter) if (o.type === "seal" && !G.seals.includes(o.seal)) cand.push({ x: o.x, y: o.y, h: 30, r: 120, i: 2, c: o.seal === "heart" ? 0xff3020 : o.seal === "eye" ? 0x50c8ff : 0xfff0d0 });
  if (G.placed && World.altar) cand.push({ x: World.altar.x, y: World.altar.y, h: 60, r: 380, i: 2.5 * (0.8 + 0.2 * Math.sin(V.time * 3)), c: 0xc02010 });
  if (G.boss && !G.bossDead) cand.push({ x: G.boss.x, y: G.boss.y, h: 150, r: 260, i: 2.5, c: 0xff2008 });
  for (const c of cand) c.d = dist2(c.x, c.y, p.x, p.y);
  cand.sort((a, b2) => a.d - b2.d);
  V.pool.forEach((l, i) => {
    const c = cand[i];
    if (!c || c.d > (c.r + 900) ** 2) { l.intensity = 0; return; }
    l.position.set(c.x, c.h, c.y); l.distance = c.r; l.intensity = c.i; l.color.set(c.c);
  });
}

function syncAtmosphere(dt) {
  const cam = V.camera, p = G.p, n = G.night;
  V.sky.position.copy(cam.position); V.stars.position.copy(cam.position);
  V.sky.visible = V.stars.visible = V.moonDisc.visible = !World.indoor;
  V.moonDisc.position.set(cam.position.x - 1100, cam.position.y + 1500, cam.position.z - 700);
  // fog banks drift around the player and get recycled when left behind
  const Q = QUALITY[V.quality];
  V.fogs.forEach((f, i) => {
    if (i >= Q.fog) return;
    const u = f.userData;
    if (!u.placed || dist2(u.x, u.y, p.x, p.y) > 650 * 650) {
      const a = p.a + (Math.random() - 0.5) * 2.6, d = u.placed ? 450 + Math.random() * 150 : 60 + Math.random() * 520;
      u.x = p.x + Math.cos(a) * d; u.y = p.y + Math.sin(a) * d; u.placed = true; u.h = 18 + Math.random() * 30;
    }
    u.x += Math.cos(u.ph) * 8 * dt; u.y += Math.sin(u.ph) * 8 * dt;
    f.position.set(u.x, u.h + Math.sin(V.time * 0.3 + u.ph) * 4, u.y);
    f.lookAt(cam.position.x, f.position.y, cam.position.z);
    const dd = Math.sqrt(dist2(u.x, u.y, p.x, p.y));
    f.material.opacity = Math.min(0.85, 0.55 * (0.45 + n * 0.55) * MAPS[World.map].fog) * clamp((dd - 40) / 120, 0, 1) * (World.indoor ? 0.5 : 1);
  });
  // rain
  const storm = G.storm || 0, R = V.rain;
  R.visible = storm > 0.05 && !G.inside && !World.indoor;
  if (R.visible) {
    const count = Math.floor(Q.rain * storm), P = R.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const d = V.rainDrops[i];
      d.y -= 900 * dt; d.x -= 60 * dt;
      if (d.y < 0) { d.y = 300 + Math.random() * 100; d.x = Math.random() * 900 - 450; d.z = Math.random() * 900 - 450; }
      const x = cam.position.x + d.x, z = cam.position.z + d.z;
      P.setXYZ(i * 2, x, d.y, z); P.setXYZ(i * 2 + 1, x + 2, d.y + 18, z);
    }
    R.geometry.setDrawRange(0, count * 2); P.needsUpdate = true;
  }
}

function syncCamera(dt) {
  const p = G.p, cam = V.camera;
  const moving = p.moving && G.state === "play";
  V.bobT = (V.bobT || 0) + dt * (moving ? (G.input.sprint ? 13 : 9) : 0);
  const bob = Math.sin(V.bobT) * (moving ? 2.2 : 0);
  const sh = G.shake * 0.35;
  cam.position.set(p.x + (Math.random() - 0.5) * sh, EYE + bob + (Math.random() - 0.5) * sh, p.y + (Math.random() - 0.5) * sh);
  const cp = Math.cos(p.pitch || 0);
  cam.lookAt(cam.position.x + Math.cos(p.a) * cp, cam.position.y + Math.sin(p.pitch || 0), cam.position.z + Math.sin(p.a) * cp);
  const wob = p.san < 30 ? Math.sin(V.time * 0.9) * (30 - p.san) * 0.004 : 0;
  cam.rotateZ(wob + Math.sin(V.bobT * 0.5) * (moving ? 0.006 : 0));

  // the flashlight trails a little behind fast turns
  const da = dt > 0 ? angDiff(V.prevA == null ? p.a : V.prevA, p.a) / dt : 0, dp = dt > 0 ? ((p.pitch || 0) - (V.prevP || 0)) / dt : 0;
  V.prevA = p.a; V.prevP = p.pitch || 0;
  V.lagX = lerp(V.lagX || 0, clamp(-da * 0.09, -0.35, 0.35), Math.min(1, dt * 7));
  V.lagY = lerp(V.lagY || 0, clamp(-dp * 0.09, -0.3, 0.3), Math.min(1, dt * 7));
  V.spot.target.position.set(-V.lagX * 100, -6 + V.lagY * 100, -100);
  V.beam.rotation.set(V.lagY, -V.lagX, 0);

  // view model
  V.vm.visible = G.state === "play" || G.state === "dead";
  const id = G.owned[G.wi];
  if (id !== V.vmId) buildViewModel(id);
  const { hand, left } = V.vm.userData;
  V.kick = Math.max(0, V.kick - dt * 6);
  if (G.kick) { V.kick = 1; G.kick = 0; }
  const w = curW();
  const bx = Math.sin(V.bobT * 0.5) * (moving ? 1.2 : 0.3), by = Math.abs(Math.cos(V.bobT * 0.5)) * (moving ? 1.2 : 0.3);
  hand.position.set(10 + bx, -10 - by, -18 + V.kick * 4);
  hand.rotation.set(V.kick * 0.25, 0, 0);
  if (w.kind === "melee") {
    const k = G.swingT > 0 ? 1 - G.swingT / 0.18 : 1;
    const s = G.swingT > 0 ? Math.sin(k * Math.PI) : 0;
    hand.rotation.set(-0.3 - s * 0.6, 0.4 - (G.swingT > 0 ? (k - 0.5) * 2.4 : 0), s * 0.6);
    hand.position.x = 10 + bx - s * 8; hand.position.z = -18 - s * 8;
  }
  if (p.reloadT > 0) { const k = 1 - p.reloadT / w.reload; hand.rotation.x = -Math.sin(k * Math.PI) * 0.9; hand.position.y = -10 - Math.sin(k * Math.PI) * 6; }
  if (p.act) { const s = Math.sin(V.time * 18); hand.rotation.x = -0.4 + s * 0.4; }
  left.position.set(-11 - bx * 0.6 - V.lagX * 6, -11 - by + V.lagY * 6, -20);
  left.rotation.set(V.lagY, -V.lagX, 0);
}

function render3d(dt) {
  V.time += dt;
  if (V.builtMap !== World.map) rebuildWorld3d();
  if (World.dirty) syncResources();
  syncCamera(dt);
  syncLights(dt);
  syncAtmosphere(dt);
  syncMonsters(dt);
  syncDynamic(dt);
  syncCreepy(dt);
  const r = V.renderer, cam = V.camera;
  r.shadowMap.needsUpdate = true;
  r.autoClear = true;
  cam.layers.set(0);
  r.render(V.scene, cam);
  r.autoClear = false;
  r.clearDepth();
  cam.layers.set(1);
  const bg = V.scene.background; V.scene.background = null; // a colour background would clear the frame again
  r.render(V.scene, cam);
  V.scene.background = bg;
  cam.layers.set(0);
}
