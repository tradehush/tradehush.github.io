"use strict";
// Input, menus and the main loop.

const $ = s => document.querySelector(s);

const Input = {
  mx: 0, my: 0, mouseActive: false, touch: false, keys: new Set(),
  sprintToggle: false, mvId: null, aimId: null, mvO: null, aimO: null,
};

const UI = {
  modal: null,
  open(id) {
    this.closeAll();
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
    for (const k of ["bandage", "medkit", "tea", "battery"]) {
      if (!(G.inv[k] > 0)) continue;
      const b = document.createElement("button");
      b.className = "btn small"; b.textContent = `${ITEMS[k].icon} ${ITEMS[k].n} (${G.inv[k]})`;
      b.onclick = () => { useItem(k); this.renderInv(); };
      use.appendChild(b);
    }
    if (!use.children.length) use.innerHTML = `<span class="muted">Нечего использовать</span>`;
    const bench = nearBench();
    $("#inv-bench").textContent = bench ? "🔨 Ты у верстака — доступен весь крафт" : "Без верстака доступен только простой крафт. Верстаки: дом лесника, хижина охотника.";
    $("#inv-bench").className = bench ? "ok" : "muted";
    const ready = r => has(r.need) && (r.where === "any" || bench);
    const recs = RECIPES.filter(r => !(r.w && G.owned.includes(r.out))).sort((a, b) => ready(b) - ready(a));
    for (const r of recs) {
      const can = has(r.need), place = r.where === "any" || bench;
      const li = document.createElement("li");
      li.className = "rec" + (can && place ? "" : " off");
      const need = Object.entries(r.need).map(([k, q]) => `<span class="${(G.inv[k] || 0) >= q ? "have" : "lack"}">${ITEMS[k].icon}${ITEMS[k].n} ${G.inv[k] || 0}/${q}</span>`).join(" ");
      li.innerHTML = `<div><b>${r.n}</b>${r.where === "bench" ? ' <small class="tag">верстак</small>' : ""}<div class="need">${need}</div>${r.d ? `<small class="muted">${r.d}</small>` : ""}</div>`;
      const b = document.createElement("button");
      b.className = "btn small"; b.textContent = "Создать"; b.disabled = !(can && place);
      b.onclick = () => { craft(r); if (r.out === "campfire" || r.out === "trap") this.close(); else this.renderInv(); };
      li.appendChild(b);
      list.appendChild(li);
    }
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
  pause() {
    if (G.state !== "play") return;
    $("#snd-btn").textContent = "Звук: " + (Sound.muted ? "выкл" : "вкл");
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

// --- flow between screens ---------------------------------------------------------------

function toTitle() {
  newGame();
  G.state = "title";
  G.p.x = 1300; G.p.y = 2800;
  R.cam.x = G.p.x; R.cam.y = G.p.y;
  UI.closeAll();
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
  const show = () => { txt.classList.remove("in"); void txt.offsetWidth; txt.textContent = INTRO[i]; txt.classList.add("in"); };
  show();
  box.onclick = () => {
    i++;
    if (i >= INTRO.length) { box.onclick = null; startPlay(); return; }
    show();
  };
}

function startPlay() {
  UI.closeAll();
  G.state = "play";
  R.cam.x = G.p.x; R.cam.y = G.p.y;
  $("#touch").hidden = !Input.touch;
  toast("Дорога ведёт на север, к дому лесника.", 4);
  toast(Input.touch ? "Левый стик — идти, правый — целиться и бить" : "WASD — идти, мышь — целиться, ЛКМ — бить, E — действие", 5);
}

function continueGame() {
  Sound.init();
  if (!load()) { startIntro(); return; }
  UI.closeAll();
  G.state = "play";
  R.cam.x = G.p.x; R.cam.y = G.p.y;
  $("#touch").hidden = !Input.touch;
  toast(`День ${G.day}. Игра загружена.`, 3);
}

// --- keyboard & mouse -----------------------------------------------------------------

function onKey(e, down) {
  const k = e.code;
  if (down && Sound) Sound.init();
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
    if (G.showMap) { G.showMap = false; return; }
    if (UI.modal && G.state === "play") { UI.close(); return; }
    UI.pause(); return;
  }
  if (G.state !== "play") return;
  if (k === "Tab" || k === "KeyI") { if (UI.modal === "inv") UI.close(); else if (!UI.modal) UI.openInv(); return; }
  if (k === "KeyJ") { if (UI.modal === "journal") UI.close(); else if (!UI.modal) UI.openJournal(); return; }
  if (k === "KeyM") { if (!UI.modal) G.showMap = !G.showMap; return; }
  if (UI.modal || G.showMap) return;
  if (k === "KeyF") toggleLight();
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

addEventListener("keydown", e => onKey(e, true));
addEventListener("keyup", e => onKey(e, false));
addEventListener("blur", () => { G.input.attack = false; G.input.interact = false; G.input.up = G.input.down = G.input.left = G.input.right = 0; G.input.sprint = false; UI.pause(); });

function updateAim() {
  const w = screenToWorld(Input.mx, Input.my);
  G.input.aimX = w.x; G.input.aimY = w.y;
}

// --- touch ------------------------------------------------------------------------------

function setupTouch() {
  const cv = R.cv;
  const sL = $("#stickL"), sR = $("#stickR");
  const R0 = 60;
  const place = (el, o, x, y) => {
    el.hidden = false;
    el.style.left = o.x + "px"; el.style.top = o.y + "px";
    const dx = clamp(x - o.x, -R0, R0), dy = clamp(y - o.y, -R0, R0);
    el.firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  };
  cv.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    Sound.init();
    if (!Input.touch) { Input.touch = true; if (G.state === "play") $("#touch").hidden = false; }
    Input.mouseActive = false;
    if (G.state !== "play" || UI.modal) return;
    if (G.showMap) { G.showMap = false; return; }
    if (e.clientX < innerWidth / 2 && Input.mvId == null) { Input.mvId = e.pointerId; Input.mvO = { x: e.clientX, y: e.clientY }; place(sL, Input.mvO, e.clientX, e.clientY); }
    else if (Input.aimId == null) { Input.aimId = e.pointerId; Input.aimO = { x: e.clientX, y: e.clientY }; place(sR, Input.aimO, e.clientX, e.clientY); }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") return;
    const inp = G.input;
    if (e.pointerId === Input.mvId) {
      const dx = e.clientX - Input.mvO.x, dy = e.clientY - Input.mvO.y, l = Math.hypot(dx, dy);
      const k = Math.min(1, l / R0) / (l || 1);
      inp.mvX = dx * k; inp.mvY = dy * k;
      inp.sprint = Input.sprintToggle || l > R0 * 1.15;
      place(sL, Input.mvO, e.clientX, e.clientY);
    } else if (e.pointerId === Input.aimId) {
      const dx = e.clientX - Input.aimO.x, dy = e.clientY - Input.aimO.y, l = Math.hypot(dx, dy);
      if (l > 12) { inp.touchAim = true; inp.aimDX = dx; inp.aimDY = dy; }
      inp.attack = l > R0 * 0.55;
      place(sR, Input.aimO, e.clientX, e.clientY);
    }
  });
  const end = e => {
    const inp = G.input;
    if (e.pointerId === Input.mvId) { Input.mvId = null; inp.mvX = inp.mvY = 0; inp.sprint = Input.sprintToggle; sL.hidden = true; }
    if (e.pointerId === Input.aimId) {
      // a short tap on the right side is a single attack
      if (!inp.attack && G.state === "play") { const was = inp.touchAim; inp.attack = true; setTimeout(() => { inp.attack = false; }, 60); inp.touchAim = was; }
      else inp.attack = false;
      Input.aimId = null; inp.touchAim = false; sR.hidden = true;
    }
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);

  const hold = (id, on, off) => {
    const b = $(id);
    b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); Sound.init(); on(); });
    if (off) { b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); }
  };
  hold("#t-act", () => { G.input.interact = true; }, () => { G.input.interact = false; });
  hold("#t-light", () => toggleLight());
  hold("#t-reload", () => startReload());
  hold("#t-swap", () => cycleWeapon(1));
  hold("#t-heal", () => quickHeal());
  hold("#t-inv", () => UI.openInv());
  hold("#t-map", () => { G.showMap = !G.showMap; });
  hold("#t-pause", () => UI.pause());
  hold("#t-run", () => { Input.sprintToggle = !Input.sprintToggle; G.input.sprint = Input.sprintToggle; $("#t-run").classList.toggle("on", Input.sprintToggle); });
}

// --- boot -------------------------------------------------------------------------------

function boot() {
  initRender();
  Input.touch = matchMedia("(pointer: coarse)").matches;
  const cv = R.cv;
  cv.addEventListener("mousemove", e => { Input.mx = e.clientX; Input.my = e.clientY; Input.mouseActive = true; });
  cv.addEventListener("mousedown", e => { if (e.button === 0 && G.state === "play" && !UI.modal) { if (G.showMap) G.showMap = false; else G.input.attack = true; } Sound.init(); });
  addEventListener("mouseup", e => { if (e.button === 0) G.input.attack = false; });
  cv.addEventListener("wheel", e => { if (G.state === "play" && !UI.modal) cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  cv.addEventListener("contextmenu", e => e.preventDefault());
  setupTouch();

  $("#new").onclick = () => { if (hasSave() && !confirm("Начать заново? Сохранение будет перезаписано.")) return; startIntro(); };
  $("#continue").onclick = continueGame;
  $("#help-btn").onclick = () => { $("#title").hidden = true; UI.open("help"); UI.helpBack = "title"; };
  $("#help-close").onclick = () => { UI.close(); if (UI.helpBack === "title") { $("#title").hidden = false; } else UI.pause(); };
  $("#note-close").onclick = () => UI.close();
  $("#inv-close").onclick = () => UI.close();
  $("#journal-close").onclick = () => UI.close();
  $("#resume").onclick = () => UI.close();
  $("#p-journal").onclick = () => UI.openJournal();
  $("#p-help").onclick = () => { UI.open("help"); UI.helpBack = "pause"; };
  $("#snd-btn").onclick = () => { Sound.init(); Sound.toggleMute(); $("#snd-btn").textContent = "Звук: " + (Sound.muted ? "выкл" : "вкл"); };
  $("#to-title").onclick = () => toTitle();
  $("#dead-load").onclick = () => continueGame();
  $("#dead-new").onclick = () => startIntro();
  $("#end-title").onclick = () => toTitle();

  toTitle();
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const running = G.state === "play" && !UI.modal && !G.showMap;
    if (Input.mouseActive) updateAim();
    if (running) update(dt);
    else if (G.state === "title" || G.state === "intro") {
      G.night = 1;
      G.p.a += dt * 0.25; G.p.light = true;
      computeRays();
      Sound.update(dt, 1, 0, false);
    } else Sound.update(dt, G.night, 0, false);
    if (G.p) render(running || G.state === "title" ? dt : 0);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

addEventListener("DOMContentLoaded", boot);
