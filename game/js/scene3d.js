"use strict";
// 3D view (Three.js): builds the world from World/G and syncs it every frame.
// World x/y map to three.js x/z; y is up. Units are the same pixels the simulation uses (≈40 per metre).

const EYE = 62, WALL_H = 124, DOOR_H = 92;
const FURN_H = { crate: 30, bench: 36, table: 34, bed: 24, shelf: 84, altar: 40, pew: 20, board: 0, desk: 28, cauldron: 32, car: 52, altarstone: 34 };

const V = {
  ready: false, mobile: false, shadows: true, renderer: null, scene: null, camera: null,
  hemi: null, moon: null, spot: null, pool: [], muzzle: null, vm: null, vmId: null, kick: 0, time: 0,
  idx: {}, inst: {}, crates: [], seals: [], notes: [], pickups: [], mons: new Map(), dying: [], dyn: new Map(),
};

const tmpO = new THREE.Object3D(), tmpC = new THREE.Color();
const lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, fog: false });

function initScene() {
  V.mobile = Input.touch || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  try { const q = localStorage.getItem("bp.shadows"); V.shadows = q == null ? !V.mobile : q === "1"; } catch (e) {}
  const cv = document.getElementById("c");
  const r = V.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !V.mobile, powerPreference: "high-performance" });
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  r.shadowMap.autoUpdate = false;
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

  const sp = V.spot = new THREE.SpotLight(0xfff0d2, 9, FLASH_RANGE * 1.2, FLASH_HALF * 1.05, 0.5, 0);
  sp.position.set(7, -6, 2);
  sp.target.position.set(0, -6, -100);
  V.camera.add(sp); V.camera.add(sp.target);
  sp.shadow.mapSize.set(V.mobile ? 512 : 1024, V.mobile ? 512 : 1024);
  sp.shadow.camera.near = 6; sp.shadow.camera.far = FLASH_RANGE * 1.2;
  sp.shadow.bias = -0.0015;
  sp.castShadow = V.shadows;

  for (let i = 0; i < (V.mobile ? 3 : 4); i++) { const l = new THREE.PointLight(0xffa050, 0, 300, 0); s.add(l); V.pool.push(l); }
  V.muzzle = new THREE.PointLight(0xffd090, 0, 420, 0);
  V.muzzle.position.set(0, 0, -30);
  V.camera.add(V.muzzle);

  for (const l of [V.hemi, V.moon, sp, V.muzzle, ...V.pool]) l.layers.enableAll();
  V.vm = new THREE.Group();
  V.vm.scale.setScalar(0.6);
  V.camera.add(V.vm);

  buildStatic();
  buildDynamicPools();
  resize3d();
  addEventListener("resize", resize3d);
  V.ready = true;
}

function setShadows(on) {
  V.shadows = on; V.spot.castShadow = on;
  try { localStorage.setItem("bp.shadows", on ? "1" : "0"); } catch (e) {}
}

function resize3d() {
  const w = innerWidth, h = innerHeight;
  V.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, V.mobile ? 1.25 : 1.75));
  V.renderer.setSize(w, h, false);
  V.renderer.domElement.style.width = w + "px"; V.renderer.domElement.style.height = h + "px";
  V.camera.aspect = w / h;
  V.camera.fov = w / h < 1 ? 92 : 72;
  V.camera.updateProjectionMatrix();
}

// --- geometry helpers -------------------------------------------------------------

// merge several geometries (already positioned) into one with per-part vertex colours
function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  for (const { geo, c, shade = 0 } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    tmpC.set(c);
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) {
      const k = 1 - shade * (0.5 + 0.5 * Math.sin(i * 0.37 + P[i * 3] * 0.05));
      col.push(tmpC.r * k, tmpC.g * k, tmpC.b * k);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
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

function buildStatic() {
  const s = V.scene;
  const rnd = mulberry32(99);

  // ground: one painted texture for the whole map
  const gsz = V.mobile ? 2048 : 4096;
  const groundTex = canvasTex(gsz, (g, S) => {
    const k = S / WORLD_W;
    g.fillStyle = "#1c2416"; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S * S / 60; i++) {
      const v = rnd();
      g.fillStyle = v < 0.45 ? `rgba(8,12,6,${0.2 + rnd() * 0.35})` : v < 0.85 ? `rgba(44,58,30,${0.2 + rnd() * 0.3})` : `rgba(62,50,32,${0.25 + rnd() * 0.3})`;
      const z = (1 + rnd() * 2.5) * S / 4096;
      g.fillRect(rnd() * S, rnd() * S, z * 2, z * 2);
    }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(30,24,14,${0.1 + rnd() * 0.15})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, (20 + rnd() * 60) * k, 0, 7); g.fill(); }
    g.lineCap = "round"; g.lineJoin = "round";
    for (const [w, c] of [[60, "rgba(30,26,18,0.9)"], [42, "#2e271a"], [10, "#372f21"]]) {
      g.strokeStyle = c; g.lineWidth = w * k;
      for (const r of World.roads) { g.beginPath(); g.moveTo(r[0][0] * k, r[0][1] * k); for (const p of r) g.lineTo(p[0] * k, p[1] * k); g.stroke(); }
    }
    for (const sw of World.swamp) { g.fillStyle = "#121a10"; g.beginPath(); g.arc(sw.x * k, sw.y * k, (sw.r + 18) * k, 0, 7); g.fill(); }
    const a = World.altar;
    g.fillStyle = "#18160f"; g.beginPath(); g.arc(a.x * k, a.y * k, 250 * k, 0, 7); g.fill();
    g.strokeStyle = "#2c2418"; g.lineWidth = 7 * k; g.beginPath(); g.arc(a.x * k, a.y * k, 120 * k, 0, 7); g.stroke();
    g.strokeStyle = "rgba(110,30,20,0.55)"; g.lineWidth = 3 * k; g.beginPath();
    for (let i = 0; i <= 5; i++) { const an = -Math.PI / 2 + i * Math.PI * 4 / 5; const x = a.x + Math.cos(an) * 115, y = a.y + Math.sin(an) * 115; i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k); }
    g.stroke();
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), lam(0xffffff, { map: groundTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(WORLD_W / 2, 0, WORLD_H / 2);
  ground.receiveShadow = true;
  s.add(ground);
  // dark border so the map edge is not a cliff into nothing
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W * 3, WORLD_H * 3), lam(0x0e130b));
  outer.rotation.x = -Math.PI / 2; outer.position.set(WORLD_W / 2, -1, WORLD_H / 2);
  s.add(outer);

  // swamp water
  const water = new THREE.MeshPhongMaterial({ color: 0x0a1412, shininess: 90, specular: 0x334440 });
  for (const sw of World.swamp) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(sw.r, 20), water);
    m.rotation.x = -Math.PI / 2; m.position.set(sw.x, 0.6, sw.y); m.receiveShadow = true;
    s.add(m);
  }

  // houses: walls, lintels, furniture, floors, ceilings, roofs
  const parts = [];
  for (const R of World.walls) parts.push(box(R.x + R.w / 2, WALL_H / 2, R.y + R.h / 2, R.w, WALL_H, R.h, "#4d3c2b", 0.12));
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
      case "altar": parts.push(box(cx, H / 2, cz, f.w, H, f.h, "#5a5450")); parts.push(box(cx, H + 1, cz, f.w - 8, 2, f.h - 10, "#7a2020")); break;
      case "pew": parts.push(box(cx, 12, cz, f.w, 4, f.h, "#3e2c1c")); parts.push(box(cx, 22, f.y + f.h, f.w, 22, 3, "#3e2c1c")); parts.push(box(cx, 5, cz, f.w - 10, 10, 3, "#2e2014")); break;
      case "board": parts.push(box(cx, 70, f.y + 2, f.w, 50, 4, "#1e2a22")); break;
      case "desk": parts.push(box(cx, H - 2, cz, f.w, 4, f.h, "#4a3a28")); parts.push(box(cx, (H - 4) / 2, cz, f.w - 8, H - 4, f.h - 8, "#3a2c1e")); break;
      case "cauldron": parts.push(cyl(cx, 16, cz, f.w / 2, f.w / 2 - 6, 32, "#1a1a1a", 14)); break;
      case "car":
        parts.push(box(cx, 22, cz, f.w, 28, f.h, "#2a2f36")); parts.push(box(cx - 6, 44, cz, 52, 18, f.h - 8, "#1a1e24"));
        for (const [ox, oz] of [[-36, -26], [36, -26], [-36, 26], [36, 26]]) parts.push(cyl(cx + ox, 9, cz + oz, 9, 9, 6, "#111", 10));
        parts.push(box(f.x + f.w, 26, cz - 18, 2, 6, 10, "#c8b060")); parts.push(box(f.x + f.w, 26, cz + 18, 2, 6, 10, "#c8b060"));
        break;
      case "altarstone": parts.push(box(cx, H / 2, cz, f.w, H, f.h, "#4a4640", 0.2)); break;
    }
  }
  for (const st of World.stones) parts.push(cyl(st.x, 55, st.y, st.r * 0.75, st.r, 110, "#45423c", 6));
  const houseMesh = new THREE.Mesh(mergeParts(parts), lam(0xffffff, { vertexColors: true }));
  houseMesh.castShadow = houseMesh.receiveShadow = true;
  s.add(houseMesh);

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
  for (const h of World.houses) {
    const fg = new THREE.PlaneGeometry(h.w, h.h);
    const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * h.w / 128, uv.getY(i) * h.h / 128);
    const floor = new THREE.Mesh(fg, lam(h.floor, { map: plank }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(h.x + h.w / 2, 0.8, h.y + h.h / 2); floor.receiveShadow = true;
    s.add(floor);
    const m = 16;
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
  const roofs = new THREE.Mesh(mergeParts(roofParts), lam(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
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
  V.altarSeals.position.set(World.altar.x, 0, World.altar.y);
  V.altarSeals.visible = false;
  s.add(V.altarSeals);

  buildResources();
}

function buildResources() {
  const s = V.scene;
  const idx = V.idx = { tree: [], rock: [], bush: [], scrap: [] };
  World.res.forEach((o, i) => idx[o.type].push(i));

  const trunkGeo = new THREE.CylinderGeometry(0.65, 1, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, lam(0xffffff), idx.tree.length);
  // pine canopy: three stacked cones in unit space (radius 1, height 1)
  const cp = [];
  [[0.22, 0.42, 1], [0.42, 0.36, 0.78], [0.6, 0.4, 0.52]].forEach(([y, h, r]) => { const g = new THREE.ConeGeometry(r, h, 8); g.translate(0, y + h / 2, 0); cp.push({ geo: g, c: "#ffffff", shade: 0.25 }); });
  const canopy = new THREE.InstancedMesh(mergeParts(cp), lam(0xffffff, { vertexColors: true }), idx.tree.length);
  trunks.castShadow = canopy.castShadow = true;
  trunks.receiveShadow = true;
  idx.tree.forEach((ri, k) => {
    const o = World.res[ri];
    trunks.setColorAt(k, tmpC.set(o.dead ? 0x4a4440 : 0x3a2a1c));
    canopy.setColorAt(k, tmpC.setRGB(0.05 + o.hue * 0.03, 0.12 + o.hue * 0.06, 0.06 + o.hue * 0.02));
  });
  s.add(trunks, canopy);

  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), lam(0x56544e), idx.rock.length);
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

const MGEO = {
  cap: (r, l) => new THREE.CapsuleGeometry(r, l, 3, 8),
  sph: new THREE.SphereGeometry(1, 12, 10),
  eye: new THREE.SphereGeometry(1, 6, 5),
};

function limb(parent, r, len, mat, x, y, z) {
  // a capsule hanging down from a pivot at (x,y,z)
  const piv = new THREE.Group(); piv.position.set(x, y, z);
  const m = new THREE.Mesh(MGEO.cap(r, len), mat); m.position.y = -len / 2 - r; m.castShadow = true;
  piv.add(m); parent.add(piv);
  return piv;
}
function blob(parent, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(MGEO.sph, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}

function buildMonster(m) {
  const d = MONSTERS[m.type];
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const mat = lam(d.col), dark = lam(new THREE.Color(d.col).multiplyScalar(0.6));
  if (m.fake) for (const x of [mat, dark]) { x.transparent = true; x.opacity = 0.6; }
  const eyeM = glowMat(d.eye);
  const v = { g, body, legs: [], arms: [], mats: [mat, dark], eyes: [] };
  const eyes = (x, y, sp, r) => { for (const s of [-1, 1]) { const e = new THREE.Mesh(MGEO.eye, eyeM); e.position.set(x, y, s * sp); e.scale.setScalar(r); body.add(e); v.eyes.push(e); } };
  switch (m.type) {
    case "crawler": {
      blob(body, mat, 0, 11, 0, 17, 8, 10);
      blob(body, dark, 14, 12, 0, 7, 6, 6);
      eyes(19, 14, 2.5, 1.3);
      for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) {
        const piv = new THREE.Group(); piv.position.set(i * 7, 11, s * 6);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.6, 22, 4), dark); leg.position.y = -6; leg.position.z = s * 9; leg.rotation.x = s * 1.0;
        piv.add(leg); body.add(piv); v.legs.push(piv); piv.userData.s = s * (i === 0 ? -1 : 1);
      }
      break;
    }
    case "ghoul":
    case "stalker": {
      const st = m.type === "stalker", k = st ? 1.35 : 1;
      v.legs.push(limb(body, st ? 2.5 : 4, 22 * k, dark, 0, 34 * k, -6), limb(body, st ? 2.5 : 4, 22 * k, dark, 0, 34 * k, 6));
      const torso = new THREE.Mesh(MGEO.cap(st ? 6 : 9, 16 * k), mat); torso.position.set(2, 48 * k, 0); torso.rotation.z = -0.35; torso.castShadow = true; body.add(torso);
      blob(body, dark, 9, 63 * k, 0, st ? 6 : 8, st ? 8 : 8.5, st ? 6 : 7.5);
      eyes(15, 65 * k, 2.8, st ? 1.2 : 1.4);
      v.arms.push(limb(body, st ? 2 : 3.2, (st ? 40 : 26) * k * (st ? 1 : 1), mat, 6, 56 * k, -11), limb(body, st ? 2 : 3.2, (st ? 40 : 26) * k, mat, 6, 56 * k, 11));
      if (st) for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.8, 18, 3), dark); t.position.set(2, 70 * k + i * 2, (i - 2.5) * 3); t.rotation.set((i - 2.5) * 0.3, 0, -0.8); body.add(t); }
      break;
    }
    case "brute": {
      v.legs.push(limb(body, 8, 26, dark, -4, 40, -12), limb(body, 8, 26, dark, -4, 40, 12));
      blob(body, mat, 0, 64, 0, 24, 28, 26).rotation.z = -0.4;
      blob(body, dark, 20, 82, 0, 11, 10, 11);
      eyes(30, 85, 4, 1.8);
      v.arms.push(limb(body, 7, 40, mat, 10, 82, -26), limb(body, 7, 40, mat, 10, 82, 26));
      for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(2.5, 28, 4), dark); const a = (i / 8 - 0.5) * 2.2; sp.position.set(-12, 80, a * 12); sp.rotation.set(a * 0.6, 0, 0.9); body.add(sp); }
      break;
    }
    case "spitter": {
      v.legs.push(limb(body, 3, 8, dark, -2, 16, -7), limb(body, 3, 8, dark, -2, 16, 7));
      blob(body, mat, 0, 28, 0, 16, 15, 16);
      for (let i = 0; i < 5; i++) blob(body, lam(0x8a9a3a), Math.cos(i * 1.7) * 9 - 4, 34 + Math.sin(i * 2.3) * 7, Math.sin(i * 1.7) * 11, 6, 6, 6);
      blob(body, dark, 15, 32, 0, 6, 5, 6);
      eyes(19, 35, 2.4, 1.3);
      break;
    }
    case "boss": {
      v.legs.push(limb(body, 12, 70, dark, 0, 100, -18), limb(body, 12, 70, dark, 0, 100, 18));
      blob(body, mat, 0, 140, 0, 32, 48, 36).rotation.z = -0.25;
      const skull = blob(body, lam(0xd8d0b8), 26, 196, 0, 13, 17, 12);
      eyes(37, 200, 5, 3);
      v.arms.push(limb(body, 8, 90, dark, 10, 170, -38), limb(body, 8, 90, dark, 10, 170, 38));
      const ant = lam(0x3a2a1a);
      for (const s of [-1, 1]) {
        const branch = (x, y, z, len, rx, rz, depth) => {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3, len, 5), ant);
          const piv = new THREE.Group(); piv.position.set(x, y, z); piv.rotation.set(rx, 0, rz);
          c.position.y = len / 2; piv.add(c); body.add(piv);
          if (depth > 0) { piv.updateMatrixWorld(); const tip = new THREE.Vector3(0, len, 0).applyMatrix4(piv.matrix); branch(tip.x, tip.y, tip.z, len * 0.65, rx + s * 0.35, rz + 0.4, depth - 1); branch(tip.x, tip.y, tip.z, len * 0.6, rx - s * 0.1, rz - 0.5, depth - 1); }
        };
        branch(24, 208, s * 8, 40, s * 0.7, 0.2, 2);
      }
      skull.castShadow = true;
      break;
    }
  }
  g.traverse(o => { if (o.isMesh && o.material !== eyeM) o.castShadow = true; });
  V.scene.add(g);
  return v;
}

function syncMonsters(dt) {
  const alive = new Set();
  for (const m of G.mons) {
    alive.add(m);
    let v = V.mons.get(m);
    if (!v) { v = buildMonster(m); V.mons.set(m, v); }
    const g = v.g;
    g.position.set(m.x, 0, m.y);
    // smooth turning
    const target = -m.a;
    g.rotation.y += angDiff(g.rotation.y, target) * Math.min(1, dt * 10);
    const sw = Math.sin(m.step) * (m.frozen ? 0 : 0.7);
    const L = v.legs;
    if (m.type === "crawler") L.forEach((p, i) => { p.rotation.z = Math.sin(m.step * 1.5 + i) * 0.5 * p.userData.s; });
    else if (L.length) { L[0].rotation.z = sw; L[1].rotation.z = -sw; }
    const wind = m.wind > 0 ? 1 : 0;
    v.arms.forEach((a, i) => {
      const base = m.type === "stalker" ? 0.5 : m.type === "boss" ? 0.6 : 1.1;
      a.rotation.z = lerp(a.rotation.z, wind ? 2.6 : base + Math.sin(m.step + i * 3) * 0.25, Math.min(1, dt * (wind ? 12 : 6)));
    });
    v.body.position.x = wind ? -3 : 0;
    v.body.rotation.z = m.stun > 0 ? Math.sin(V.time * 10) * 0.2 : m.type === "stalker" && m.frozen ? 0 : 0;
    if (m.type === "stalker") { v.body.position.y = m.frozen ? 0 : Math.sin(V.time * 30) * 0.6; }
    const flash = m.hitF > 0 ? 0.8 : m.burn > 0 ? 0.35 : 0;
    for (const mt of v.mats) { mt.emissive.setRGB(flash, flash * (m.burn > 0 ? 0.4 : 1), flash * (m.burn > 0 ? 0.1 : 1)); if (m.fake) mt.opacity = 0.35 + 0.25 * Math.sin(V.time * 12); }
  }
  for (const [m, v] of V.mons) if (!alive.has(m)) { V.mons.delete(m); V.dying.push({ v, t: m.fake ? 0.25 : 1.2, max: m.fake ? 0.25 : 1.2, fake: m.fake }); }
  V.dying = V.dying.filter(d => {
    d.t -= dt;
    const k = 1 - d.t / d.max;
    if (d.fake) d.v.g.scale.setScalar(1 + k * 0.5);
    else { d.v.body.rotation.z = Math.min(1.5, k * 3); d.v.g.position.y = -k * 6; d.v.eyes.forEach(e => e.visible = false); }
    if (d.t <= 0) { V.scene.remove(d.v.g); d.v.g.traverse(o => { if (o.geometry && o.geometry !== MGEO.sph && o.geometry !== MGEO.eye) o.geometry.dispose(); }); return false; }
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
  V.altarSeals.visible = G.placed;

  // projectiles
  for (const pr of G.projs) {
    if (pr.kind === "acid") { const m = dynMesh(pr, () => new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), glowMat(0xa8e030))); m.position.set(pr.x, 40, pr.y); }
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

function syncLights() {
  const p = G.p, n = G.night;
  // sky, fog and ambient follow the time of day
  const day = 1 - n;
  const fogC = tmpC.setRGB(lerp(0.004, 0.2, day), lerp(0.006, 0.22, day), lerp(0.012, 0.2, day));
  V.scene.fog.color.copy(fogC); V.scene.background.copy(fogC);
  V.scene.fog.near = lerp(20, 140, day);
  V.scene.fog.far = lerp(560, 1500, day) * (G.inside ? 0.8 : 1);
  V.hemi.intensity = lerp(0.07, 1.5, day * day);
  V.moon.intensity = lerp(0.12, 1.1, day);
  V.moon.color.setRGB(lerp(0.55, 1, day), lerp(0.62, 0.96, day), lerp(0.85, 0.9, day));

  const on = p.light && G.lightOff <= 0;
  const flick = p.bat < 15 ? (Math.random() < 0.15 ? 0.25 : 1) : 1;
  V.spot.intensity = on ? 9 * flick : 0;
  if (V.lens) V.lens.material.color.set(on ? 0xfff0c0 : 0x333333);
  V.muzzle.intensity = G.flash > 0 ? 6 : 0;

  // the closest light sources get the point lights from the pool
  const cand = [];
  for (const f of G.fires) cand.push({ x: f.x, y: f.y, h: 20, r: 330, i: 3 * (0.85 + 0.15 * Math.sin(V.time * 13 + f.x)), c: 0xff9040 });
  for (const l of World.lights) cand.push({ x: l.x, y: l.y, h: 70, r: l.r * 1.3, i: 3 * (1 - l.flick + l.flick * Math.sin(V.time * 9 + l.x)), c: new THREE.Color(`rgb(${l.col})`).getHex() });
  for (const pr of G.projs) if (pr.kind === "firezone") cand.push({ x: pr.x, y: pr.y, h: 20, r: 300, i: 4 * Math.min(1, pr.life / 2), c: 0xff8020 });
  for (const o of World.inter) if (o.type === "seal" && !G.seals.includes(o.seal)) cand.push({ x: o.x, y: o.y, h: 30, r: 120, i: 2, c: o.seal === "heart" ? 0xff3020 : o.seal === "eye" ? 0x50c8ff : 0xfff0d0 });
  if (G.placed) cand.push({ x: World.altar.x, y: World.altar.y, h: 60, r: 380, i: 2.5, c: 0xc02010 });
  for (const c of cand) c.d = dist2(c.x, c.y, p.x, p.y);
  cand.sort((a, b) => a.d - b.d);
  V.pool.forEach((l, i) => {
    const c = cand[i];
    if (!c || c.d > (c.r + 900) ** 2) { l.intensity = 0; return; }
    l.position.set(c.x, c.h, c.y); l.distance = c.r; l.intensity = c.i; l.color.set(c.c);
  });
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
  left.position.set(-11 - bx * 0.6, -11 - by, -20);
}

function render3d(dt) {
  V.time += dt;
  if (World.dirty) syncResources();
  syncCamera(dt);
  syncLights();
  syncMonsters(dt);
  syncDynamic(dt);
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
