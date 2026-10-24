"use strict";
// Input, menus and the main loop.

const $ = s => document.querySelector(s);

const Input = {
  touch: false, locked: false, sens: 0.0026,
  sprintToggle: false, mvId: null, lookId: null, mvO: null, lookP: null,
};

const Settings = { scares: true, sens: 1, labels: "auto", voice: false };
try { Object.assign(Settings, JSON.parse(localStorage.getItem("bp.settings") || "{}")); } catch (e) {}
function saveSettings() { try { localStorage.setItem("bp.settings", JSON.stringify(Settings)); } catch (e) {} }

const UI = {
  modal: null,
  open(id) {
    this.closeAll();
    if (document.pointerLockElement) document.exitPointerLock();
    this.modal = id;
    $("#" + id).hidden = false;
    G.input.attack = false; G.input.interact = false;
  },
  close() { if (this.modal) $("#" + this.modal).hidden = true; this.modal = null; },
  closeAll() { document.querySelectorAll(".panel,.screen").forEach(e => e.hidden = true); this.modal = null; },

  showNote(key) {
    readNote(key);
    const n = NOTES[key];
    $("#note-t").textContent = n.t;
    $("#note-b").textContent = n.b;
    this.open("note");
    Sound.pickup();
  },
  openInv() { this.renderInv(); this.open("inv"); },
  renderInv() {
    const res = $("#inv-res"), use = $("#inv-use"), list = $("#inv-craft");
    res.innerHTML = ""; use.innerHTML = ""; list.innerHTML = "";
    const keys = Object.keys(ITEMS).filter(k => G.inv[k] > 0 && !["campfire", "trap"].includes(k));
    if (!keys.length) res.innerHTML = `<li class="muted">Пусто</li>`;
    for (const k of keys) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${ITEMS[k].icon} ${ITEMS[k].n}</span><b>${G.inv[k]}</b>`;
      res.appendChild(li);
    }
    for (const k of ["bandage", "medkit", "tea", "battery", ...Object.keys(ITEMS).filter(k => ITEMS[k].food)]) {
      if (!(G.inv[k] > 0)) continue;
      const b = document.createElement("button");
      b.className = "btn small"; b.textContent = `${ITEMS[k].food ? "Съесть: " : ""}${ITEMS[k].icon} ${ITEMS[k].n} (${G.inv[k]})`;
      b.onclick = () => { useItem(k); this.renderInv(); };
      use.appendChild(b);
    }
    if (!use.children.length) use.innerHTML = `<span class="muted">Нечего использовать</span>`;
    const bench = nearBench();
    $("#inv-bench").textContent = bench ? "🔨 Ты у верстака — доступен весь крафт" : "Без верстака доступен только простой крафт. Верстаки: дом лесника, хижина охотника.";
    $("#inv-bench").className = bench ? "ok" : "muted";
    const fire = nearCookFire();
    const okWhere = r => r.where === "any" || (r.where === "bench" && bench) || (r.where === "fire" && fire);
    const ready = r => has(r.need) && okWhere(r);
    const recs = RECIPES.filter(r => !(r.w && G.owned.includes(r.out))).sort((a, b) => ready(b) - ready(a));
    for (const r of recs) {
      const can = has(r.need), place = okWhere(r);
      const li = document.createElement("li");
      li.className = "rec" + (can && place ? "" : " off");
      const need = Object.entries(r.need).map(([k, q]) => `<span class="${(G.inv[k] || 0) >= q ? "have" : "lack"}">${ITEMS[k].icon}${ITEMS[k].n} ${G.inv[k] || 0}/${q}</span>`).join(" ");
      li.innerHTML = `<div><b>${r.n}</b>${r.where === "bench" ? ' <small class="tag">верстак</small>' : r.where === "fire" ? ' <small class="tag">огонь</small>' : ""}<div class="need">${need}</div>${r.d ? `<small class="muted">${r.d}</small>` : ""}</div>`;
      const b = document.createElement("button");
      b.className = "btn small"; b.textContent = "Создать"; b.disabled = !(can && place);
      b.onclick = () => { craft(r); if (r.out === "campfire" || r.out === "trap") this.close(); else this.renderInv(); };
      li.appendChild(b);
      list.appendChild(li);
    }
  },
  openBuild() {
    const box = $("#build-list"), head = $("#build-head");
    box.innerHTML = "";
    const here = G.inside && (!G.base || G.base.id !== G.inside.id || G.base.map !== World.map);
    head.innerHTML = G.base && G.base.map === World.map
      ? `<b>⌂ База: ${G.base.name}</b> <span class="muted">— строить можно в радиусе ${Math.round(BASE_R / 40)} м от дома.</span>`
      : `<span class="muted">У тебя нет базы на этой карте. Зайди в любой дом и нажми «Сделать базой».</span>`;
    const claim = $("#claim");
    claim.hidden = !here;
    claim.textContent = G.inside ? `⌂ Сделать базой: ${G.inside.name}` : "";
    for (const d of BUILDS) {
      const li = document.createElement("li");
      const can = has(d.need);
      li.className = "rec" + (can && G.base ? "" : " off");
      const need = Object.entries(d.need).map(([k, q]) => `<span class="${(G.inv[k] || 0) >= q ? "have" : "lack"}">${ITEMS[k].icon}${ITEMS[k].n} ${G.inv[k] || 0}/${q}</span>`).join(" ");
      li.innerHTML = `<div><b>${d.icon} ${d.n}</b><div class="need">${need}</div><small class="muted">${d.d}</small></div>`;
      const b = document.createElement("button");
      b.className = "btn small"; b.textContent = "Ставить"; b.disabled = !(can && G.base && G.base.map === World.map);
      b.onclick = () => { this.close(); startPlace(d.k); requestLock(); };
      li.appendChild(b); box.appendChild(li);
    }
    this.open("build");
  },
  openJournal() {
    const l = $("#journal-list");
    l.innerHTML = "";
    if (!G.notes.length) l.innerHTML = `<li class="muted">Ты ещё не нашёл ни одной записи.</li>`;
    for (const k of G.notes) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "btn ghost"; b.textContent = NOTES[k].t;
      b.onclick = () => this.showNote(k);
      li.appendChild(b); l.appendChild(li);
    }
    this.open("journal");
  },
  showDead() {
    $("#dead-load").hidden = !hasSave();
    this.open("dead");
  },
  showEnd(good) {
    $("#end-t").textContent = good ? "Рассвет" : "Новый Хозяин";
    $("#end-b").textContent = good ? END_GOOD : END_BAD;
    this.open("end");
  },
  fade(fn) {
    const f = $("#fade");
    f.classList.add("on");
    setTimeout(() => { fn(); setTimeout(() => f.classList.remove("on"), 300); }, 900);
  },
  syncSettings() {
    $("#snd-btn").textContent = "Звук: " + (Sound.muted ? "выкл" : "вкл");
    $("#q-btn").textContent = "Графика: " + QUALITY[V.quality].n;
    $("#scare-btn").textContent = "Скримеры: " + (Settings.scares ? "вкл" : "выкл");
    $("#voice-btn").textContent = "Игра слушает тебя: " + (Voice.on ? "вкл 🎙" : "выкл");
    $("#label-btn").textContent = "Подписи кнопок: " + ({ auto: "сначала", on: "всегда", off: "выкл" }[Settings.labels] || "сначала");
    $("#sens").value = Settings.sens;
    $("#sens-v").textContent = Settings.sens.toFixed(1) + "×";
  },
  openGuide() {
    const box = $("#guide-list");
    box.innerHTML = "";
    for (const r of RECIPES) {
      const li = document.createElement("li");
      const need = Object.entries(r.need).map(([k, q]) => `${ITEMS[k].icon} ${ITEMS[k].n} ×${q}`).join(", ");
      li.innerHTML = `<b>${r.n}</b> <small class="tag">${r.where === "bench" ? "верстак" : "где угодно"}</small><div class="need">${need}</div>${r.d ? `<small class="muted">${r.d}</small>` : ""}`;
      box.appendChild(li);
    }
    this.open("guide");
  },
  askExit() { this.open("exit"); },
  pause() {
    if (G.state !== "play") return;
    $("#snd-btn").textContent = "Звук: " + (Sound.muted ? "выкл" : "вкл");
    this.syncSettings();
    this.open("pause");
  },
};

const END_GOOD = `Хозяин рухнул, и вместе с ним будто выдохнул весь лес. Ветви над Капищем разошлись, и впервые за много дней ты увидел небо — серое, рассветное.

Аня сидела у алтаря, бледная, но живая. Она посмотрела на тебя ясными глазами и сказала:
«Ты всё-таки приехал. Дурак».

Вы шли к дороге молча. Лес больше не шептал.

Говорят, этой весной в Чёрной Сосне впервые за сто лет запели птицы.

КОНЕЦ`;

const END_BAD = `Хозяин рухнул… но шёпот не стих. Он стал громче. Ближе. Он звучал изнутри.

Аня поднялась от алтаря и шагнула к тебе — и замерла. В её глазах ты увидел отражение: высокую фигуру, из головы которой прорастали ветви.

«Нет…» — прошептала она и побежала к дороге.

Ты не стал её догонять. Тебе больше не нужно было никуда идти. Лес был тобой, а ты — лесом.

У Чёрной Сосны новый Хозяин. И он очень голоден.

ПЛОХАЯ КОНЦОВКА
(Рассудок был ниже 30. Береги его: костры, отвар из трав, свет.)`;

function exitToTitle(keep) {
  if (keep && G.state === "play") save();
  toTitle();
}

// --- flow between screens ---------------------------------------------------------------

function toTitle() {
  newGame();
  G.state = "title";
  G.p.x = 1310; G.p.y = 2820; G.p.pitch = -0.08;
  UI.closeAll();
  $("#touch").hidden = true;
  $("#title").hidden = false;
  $("#continue").hidden = !hasSave();
}

function startIntro() {
  Sound.init();
  newGame();
  UI.closeAll();
  G.state = "intro";
  let i = 0;
  const box = $("#intro"), txt = $("#intro-t");
  box.hidden = false;
  const lines = STORY_MODE ? INTRO : INTRO_SANDBOX;
  const show = () => { txt.classList.remove("in"); void txt.offsetWidth; txt.textContent = lines[i]; txt.classList.add("in"); };
  show();
  box.onclick = () => {
    i++;
    if (i >= lines.length) { box.onclick = null; startPlay(); return; }
    show();
  };
}

function enterPlay() {
  UI.closeAll();
  if (Settings.voice && !Voice.on) Voice.start();
  G.state = "play";
  $("#touch").hidden = !Input.touch;
  requestLock();
  goFullscreen();
}

function startPlay() {
  enterPlay();
  G.p.a = -Math.PI / 2 + 0.25;
  toast(STORY_MODE ? "Дорога ведёт на север, к дому лесника." : "Найди дом, сделай его базой и продержись.", 4);
  tip("start", Input.touch ? "Левый палец — ходить, правый — осматриваться. ⚔ — удар, ✋ — действие. Что делает каждая кнопка — «?» вверху справа." : "WASD — ходить, мышь — смотреть, ЛКМ — удар, E — действие, Tab — сумка. Esc — пауза и выход в меню.");
}

function continueGame() {
  Sound.init();
  if (!load()) { startIntro(); return; }
  enterPlay();
  toast(`День ${G.day}. Игра загружена.`, 3);
}

// on phones: full screen and landscape when the browser allows it
function goFullscreen() {
  if (!Input.touch) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : null;
    if (p && p.then) p.then(() => { try { screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }).catch(() => {});
  } catch (e) {}
}

function requestLock() {
  if (Input.touch) return;
  const cv = V.renderer.domElement;
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}

// --- keyboard & mouse -----------------------------------------------------------------

function onKey(e, down) {
  const k = e.code;
  if (down) Sound.init();
  const inp = G.input;
  if (["KeyW", "ArrowUp"].includes(k)) inp.up = down ? 1 : 0;
  else if (["KeyS", "ArrowDown"].includes(k)) inp.down = down ? 1 : 0;
  else if (["KeyA", "ArrowLeft"].includes(k)) inp.left = down ? 1 : 0;
  else if (["KeyD", "ArrowRight"].includes(k)) inp.right = down ? 1 : 0;
  else if (k === "ShiftLeft" || k === "ShiftRight") inp.sprint = down;
  else if (k === "KeyE" || k === "Space") { if (G.state === "intro" && down) $("#intro").onclick && $("#intro").onclick(); else inp.interact = down && !UI.modal; }
  if (k === "Tab") e.preventDefault();
  if (!down || e.repeat) return;
  if (k === "Escape") {
    if (G.place) { G.place = null; return; }
    if (G.showMap) { G.showMap = false; requestLock(); return; }
    if (UI.modal && G.state === "play") { UI.close(); return; }
    UI.pause(); return;
  }
  if (G.state !== "play") return;
  if (k === "Tab" || k === "KeyI") { if (UI.modal === "inv") { UI.close(); requestLock(); } else if (!UI.modal) UI.openInv(); return; }
  if (k === "KeyJ") { if (UI.modal === "journal") { UI.close(); requestLock(); } else if (!UI.modal) UI.openJournal(); return; }
  if (k === "KeyM") { if (!UI.modal) G.showMap = !G.showMap; return; }
  if (UI.modal || G.showMap) return;
  if (k === "KeyC") { if (!G.drive) UI.openBuild(); return; }
  if (k === "KeyR" && G.place) { G.place.rot = 1 - G.place.rot; return; }
  if (k === "KeyF") toggleLight();
  else if (k === "KeyX") quickEat();
  else if (k === "KeyR") startReload();
  else if (k === "KeyQ") cycleWeapon(1);
  else if (k === "KeyH") quickHeal();
  else if (k === "KeyG") useItem("tea");
  else if (k === "KeyB") useItem("battery");
  else if (/^Digit[1-8]$/.test(k)) switchWeapon(+k.slice(5) - 1);
}

function toggleLight() {
  const p = G.p;
  if (!p.light && p.bat <= 0) { if (!useItem("battery")) { toast("Батарея села", 1.5); return; } }
  p.light = !p.light; Sound.click();
}

function look(dx, dy, k) {
  const p = G.p;
  k *= Settings.sens;
  p.a += dx * k;
  p.pitch = clamp((p.pitch || 0) - dy * k, -1.1, 0.9);
}

function releaseAll() {
  const inp = G.input;
  inp.attack = false; inp.interact = false; inp.up = inp.down = inp.left = inp.right = 0; inp.mvX = inp.mvY = 0; inp.sprint = false;
}

addEventListener("keydown", e => onKey(e, true));
addEventListener("keyup", e => onKey(e, false));
addEventListener("blur", () => { releaseAll(); UI.pause(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { releaseAll(); UI.pause(); } });

// --- touch ------------------------------------------------------------------------------

function setupTouch() {
  const cv = V.renderer.domElement;
  const sL = $("#stickL");
  const R0 = 60;
  const place = (o, x, y) => {
    sL.hidden = false;
    sL.style.left = o.x + "px"; sL.style.top = o.y + "px";
    const dx = clamp(x - o.x, -R0, R0), dy = clamp(y - o.y, -R0, R0);
    sL.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  };
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    Sound.init();
    if (!Input.touch) { Input.touch = true; if (G.state === "play") $("#touch").hidden = false; }
    if (G.state !== "play" || UI.modal) return;
    if (G.showMap) { G.showMap = false; return; }
    $("#qmenu").hidden = true;
    const hb = R.hotbar;
    if (hb && e.clientY >= hb.y && e.clientY <= hb.y + hb.slot && e.clientX >= hb.x && e.clientX <= hb.x + hb.n * (hb.slot + hb.gap)) {
      const i = Math.floor((e.clientX - hb.x) / (hb.slot + hb.gap));
      if (i === G.wi) startReload(); else switchWeapon(i);
      return;
    }
    if (e.clientX < innerWidth * 0.42 && Input.mvId == null) { Input.mvId = e.pointerId; Input.mvO = { x: e.clientX, y: e.clientY }; place(Input.mvO, e.clientX, e.clientY); }
    else if (Input.lookId == null) { Input.lookId = e.pointerId; Input.lookP = { x: e.clientX, y: e.clientY }; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") return;
    const inp = G.input;
    if (e.pointerId === Input.mvId) {
      const dx = e.clientX - Input.mvO.x, dy = e.clientY - Input.mvO.y, l = Math.hypot(dx, dy);
      const k = Math.min(1, l / R0) / (l || 1);
      inp.mvX = dx * k; inp.mvY = dy * k;
      inp.sprint = Input.sprintToggle || l > R0 * 1.25;
      place(Input.mvO, e.clientX, e.clientY);
    } else if (e.pointerId === Input.lookId && G.state === "play" && !UI.modal) {
      look(e.clientX - Input.lookP.x, e.clientY - Input.lookP.y, 0.0058);
      Input.lookP = { x: e.clientX, y: e.clientY };
    }
  });
  const end = e => {
    const inp = G.input;
    if (e.pointerId === Input.mvId) { Input.mvId = null; inp.mvX = inp.mvY = 0; inp.sprint = Input.sprintToggle; sL.hidden = true; }
    if (e.pointerId === Input.lookId) Input.lookId = null;
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);

  // buttons; the attack button also lets the finger drag to look around while holding it
  const btn = (id, on, off) => {
    const b = $(id);
    b.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation(); Sound.init(); on(e);
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
    });
    if (off) { b.addEventListener("pointerup", off); b.addEventListener("pointercancel", off); }
    b.addEventListener("contextmenu", e => e.preventDefault());
    return b;
  };
  let atkP = null;
  const atk = btn("#t-atk", e => { G.input.attack = true; atkP = { x: e.clientX, y: e.clientY }; }, () => { G.input.attack = false; atkP = null; });
  atk.addEventListener("pointermove", e => { if (atkP && G.state === "play") { look(e.clientX - atkP.x, e.clientY - atkP.y, 0.0045); atkP = { x: e.clientX, y: e.clientY }; } });
  btn("#t-act", () => { G.input.interact = true; }, () => { G.input.interact = false; });
  btn("#t-light", () => toggleLight());
  const qmenu = $("#qmenu");
  const q = (id, fn) => btn(id, () => { qmenu.hidden = true; releaseAll(); fn(); });
  btn("#t-menu", () => { qmenu.hidden = !qmenu.hidden; });
  q("#q-map", () => { G.showMap = !G.showMap; });
  q("#q-inv", () => UI.openInv());
  q("#q-build", () => UI.openBuild());
  q("#q-pause", () => UI.pause());
  q("#q-help", () => { UI.open("help"); UI.helpBack = "play"; });
  q("#q-home", () => UI.askExit());
  btn("#t-ok", () => placeBuild());
  btn("#t-rot", () => { if (G.place) G.place.rot = 1 - G.place.rot; });
  btn("#t-cancel", () => { G.place = null; });
}

// --- boot -------------------------------------------------------------------------------

function boot() {
  Input.touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  // the world has to exist before the 3D scene is built from it
  newGame();
  try { initScene(); } catch (e) {
    document.body.innerHTML = '<p style="padding:24px;font:16px sans-serif;color:#ddd">Не удалось запустить 3D (WebGL). Обнови браузер или включи аппаратное ускорение.</p>';
    return;
  }
  initHud();
  const cv = V.renderer.domElement;
  cv.addEventListener("mousedown", e => {
    Sound.init();
    if (G.state !== "play" || UI.modal) return;
    if (G.showMap) { G.showMap = false; return; }
    if (!Input.locked && !Input.noLock) { requestLock(); return; }
    if (e.button === 0) G.input.attack = true;
    if (e.button === 2) G.input.interact = true;
  });
  addEventListener("mouseup", e => { if (e.button === 0) G.input.attack = false; if (e.button === 2) G.input.interact = false; });
  document.addEventListener("mousemove", e => { if ((Input.locked || Input.noLock) && G.state === "play" && !UI.modal && !Input.touch) look(e.movementX, e.movementY, Input.sens); });
  // some frames refuse pointer lock: then the mouse turns the view without capturing the cursor
  document.addEventListener("pointerlockerror", () => { Input.noLock = true; });
  document.addEventListener("pointerlockchange", () => {
    Input.locked = document.pointerLockElement === cv;
    if (!Input.locked && !Input.noLock) { G.input.attack = false; if (G.state === "play" && !UI.modal && !G.showMap) UI.pause(); }
  });
  cv.addEventListener("wheel", e => { if (G.state === "play" && !UI.modal) cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  setupTouch();

  $("#new").onclick = () => startIntro();
  $("#continue").onclick = continueGame;
  $("#help-btn").onclick = () => { $("#title").hidden = true; UI.open("help"); UI.helpBack = "title"; };
  $("#help-close").onclick = () => { UI.close(); if (UI.helpBack === "title") { $("#title").hidden = false; } else if (UI.helpBack === "play") requestLock(); else UI.pause(); };
  const back = () => { UI.close(); requestLock(); };
  $("#note-close").onclick = back;
  $("#inv-close").onclick = back;
  $("#journal-close").onclick = back;
  $("#resume").onclick = back;
  $("#p-journal").onclick = () => UI.openJournal();
  $("#p-help").onclick = () => { UI.open("help"); UI.helpBack = "pause"; };
  $("#snd-btn").onclick = () => { Sound.init(); Sound.toggleMute(); $("#snd-btn").textContent = "Звук: " + (Sound.muted ? "выкл" : "вкл"); };
  $("#q-btn").onclick = () => { const order = ["low", "mid", "high"]; setQuality(order[(order.indexOf(V.quality) + 1) % 3]); UI.syncSettings(); };
  $("#voice-btn").onclick = () => {
    if (Voice.on) { Voice.stop(); Settings.voice = false; }
    else if (Voice.start()) { Settings.voice = true; toast("🎙 Лес слушает тебя…", 3); }
    saveSettings(); UI.syncSettings();
  };
  $("#label-btn").onclick = () => { const o = ["auto", "on", "off"]; Settings.labels = o[(o.indexOf(Settings.labels) + 1) % 3]; saveSettings(); UI.syncSettings(); };
  $("#scare-btn").onclick = () => { Settings.scares = !Settings.scares; saveSettings(); UI.syncSettings(); };
  $("#sens").oninput = e => { Settings.sens = +e.target.value; saveSettings(); $("#sens-v").textContent = Settings.sens.toFixed(1) + "×"; };
  $("#to-title").onclick = () => UI.askExit();
  $("#exit-save").onclick = () => exitToTitle(true);
  $("#exit-nosave").onclick = () => exitToTitle(false);
  $("#exit-cancel").onclick = () => { UI.close(); if (G.state === "play") requestLock(); };
  $("#guide-btn").onclick = () => UI.openGuide();
  $("#build-close").onclick = () => { UI.close(); requestLock(); };
  $("#claim").onclick = () => { claimBase(); UI.openBuild(); };
  $("#p-guide").onclick = () => UI.openGuide();
  $("#help-guide").onclick = () => UI.openGuide();
  $("#guide-close").onclick = () => { UI.close(); if (G.state === "play") requestLock(); else $("#title").hidden = false; };
  $("#title-guide").onclick = () => { $("#title").hidden = true; UI.openGuide(); };
  $("#dead-load").onclick = () => continueGame();
  $("#dead-new").onclick = () => startIntro();
  $("#end-title").onclick = () => toTitle();

  toTitle();
  const tAct = $("#t-act"), touchRoot = $("#touch"), hintBtns = [...document.querySelectorAll("#touch .tb")];
  const TIP_BTN = { "✋": "t-act", "⚔": "t-atk", "🔨": "t-menu", "🎒": "t-menu", "🔦": "t-light", "🩹": "t-menu", "🍖": "t-menu", "✔": "t-ok", "⛽": "t-act", "🔧": "t-act", "🎣": "t-act", "🌱": "t-menu", "✈": "t-menu" };
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const running = G.state === "play" && !UI.modal && !G.showMap;
    if (running) update(dt);
    else if (G.state === "title" || G.state === "intro") {
      G.night = 1;
      G.p.a += dt * 0.12; G.p.light = true;
      Sound.update(dt, 1, 0, false);
    } else Sound.update(dt, G.night, 0, false);
    if (Input.touch) {
      tAct.classList.toggle("ready", running && (!!G.target || G.drive || (G.fishing && G.fishing.bite > 0)));
      touchRoot.classList.toggle("placing", !!G.place);
      touchRoot.classList.toggle("driving", !!G.drive);
      const hint = G.tip && TIP_BTN[G.tip.icon];
      for (const b of hintBtns) b.classList.toggle("hint", !!hint && b.id === hint);
      // labels under the buttons fade once the player knows them
      touchRoot.classList.toggle("nolabels", Settings.labels === "off" || (Settings.labels !== "on" && (G.clock || 0) > 240));
    }
    render3d(running || G.state === "title" || G.state === "intro" ? dt : 0);
    renderHud(running ? dt : 0);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

addEventListener("DOMContentLoaded", boot);

// installable app: offline cache plus the browser's own install prompt
let installPrompt = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installPrompt = e;
  const b = $("#install");
  if (b) b.hidden = false;
});
addEventListener("appinstalled", () => { installPrompt = null; const b = $("#install"); if (b) b.hidden = true; });
addEventListener("DOMContentLoaded", () => {
  const b = $("#install");
  if (b) b.onclick = () => { if (!installPrompt) return; installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; b.hidden = true; }); };
});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {}); });
}
