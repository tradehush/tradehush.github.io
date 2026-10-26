// MoscSpace — вся логика сайта: меню, формы, поиск, карта, AI-помощник, оплата.
// Сайт статический: данные пользователя и брони хранятся только в браузере (localStorage).
// Данные банковских карт никуда не отправляются и не сохраняются — оплата демонстрационная.
(function () {
  "use strict";

  // ---------- объекты недвижимости ----------
  var TYPES = {
    office: "Офис",
    coworking: "Рабочее место",
    hall: "Зал для встреч",
    warehouse: "Склад",
    shop: "Торговое помещение",
    catering: "Общепит",
    production: "Производство",
    podcast: "Студия подкастов"
  };
  var TYPE_COLORS = {
    office: "#4f7cff", coworking: "#7c2f3e", hall: "#f4e45a", warehouse: "#c98a3a",
    shop: "#5a9a3c", catering: "#e0607e", production: "#9a9a9a", podcast: "#a35cff"
  };
  var TYPE_PICS = {
    office: "pic-office", coworking: "pic-coworking", hall: "pic-hall", warehouse: "pic-warehouse",
    shop: "pic-office", catering: "pic-hall", production: "pic-warehouse", podcast: "pic-podcast"
  };

  // lat, lng — координаты на карте; hourPrice — цена часа для краткосрочной аренды офисов
  var LISTINGS = [
    { id: "office-center", hourPrice: 3500, lat: 55.7495, lng: 37.5395, pic: "pic-o-city", type: "office", title: "Офис в Москва-Сити с панорамным видом", price: 350000, unit: "мес", area: 120, people: 20, metro: "Выставочная", district: "ЦАО", metroMin: 3, highwayKm: 0.5, power: 30, ceiling: 3.2, water: 2, vent: true, heat: true },
    { id: "office-tverskaya", hourPrice: 2800, lat: 55.7652, lng: 37.6058, pic: "pic-o-premium", type: "office", title: "Офис на Тверской, 21", price: 280000, unit: "мес", area: 85, people: 14, metro: "Пушкинская", district: "ЦАО", metroMin: 2, highwayKm: 1.2, power: 20, ceiling: 3.4, water: 1, vent: true, heat: true },
    { id: "office-chistye", hourPrice: 1500, lat: 55.7642, lng: 37.6402, pic: "pic-o-classic", type: "office", title: "Офис у Чистых прудов", price: 150000, unit: "мес", area: 55, people: 10, metro: "Чистые пруды", district: "ЦАО", metroMin: 4, highwayKm: 1.5, power: 15, ceiling: 3, water: 1, vent: true, heat: true },
    { id: "office-savelovskaya", hourPrice: 1200, lat: 55.793, lng: 37.5862, pic: "pic-o-green", type: "office", title: "Офис в БЦ класса B", price: 120000, unit: "мес", area: 70, people: 12, metro: "Савёловская", district: "САО", metroMin: 6, highwayKm: 0.8, power: 15, ceiling: 3, water: 1, vent: true, heat: true },
    { id: "office-chkalovskaya", hourPrice: 1900, lat: 55.757, lng: 37.6615, pic: "pic-o-small", type: "office", title: "Офис на 10–15 человек у Курского вокзала", price: 190000, unit: "мес", area: 75, people: 15, metro: "Чкаловская", district: "ЦАО", metroMin: 2, highwayKm: 0.6, power: 20, ceiling: 3.1, water: 1, vent: true, heat: true },
    { id: "coworking", lat: 55.7768, lng: 37.5845, type: "coworking", title: "Рабочее место в коворкинге", price: 18000, unit: "мес", area: 6, people: 30, metro: "Белорусская", district: "ЦАО", metroMin: 5, highwayKm: 0.3, power: 1, ceiling: 3.2, water: 0, vent: true, heat: true },
    { id: "hall-12", lat: 55.7548, lng: 37.6572, pic: "pic-h-small", type: "hall", title: "Переговорная на 12 человек", price: 2500, unit: "час", area: 30, people: 12, metro: "Чкаловская", district: "ЦАО", metroMin: 3, highwayKm: 0.6, power: 5, ceiling: 3, water: 0, vent: true, heat: true },
    { id: "hall-40", lat: 55.7305, lng: 37.6385, pic: "pic-h-big", type: "hall", title: "Конференц-зал на 40 человек", price: 6000, unit: "час", area: 90, people: 40, metro: "Павелецкая", district: "ЦАО", metroMin: 4, highwayKm: 0.4, power: 10, ceiling: 4, water: 1, vent: true, heat: true },
    { id: "warehouse-a", lat: 55.634, lng: 37.66, pic: "pic-w-a", type: "warehouse", title: "Склад класса A, 1200 м²", price: 900000, unit: "мес", area: 1200, people: 0, metro: "Кантемировская", district: "ЮАО", metroMin: 15, highwayKm: 1, power: 150, ceiling: 12, water: 2, vent: true, heat: true },
    { id: "warehouse-b", lat: 55.7565, lng: 37.755, pic: "pic-w-b", type: "warehouse", title: "Склад класса B, 400 м²", price: 260000, unit: "мес", area: 400, people: 0, metro: "Шоссе Энтузиастов", district: "ВАО", metroMin: 10, highwayKm: 0.5, power: 60, ceiling: 8, water: 1, vent: true, heat: false },
    { id: "warehouse-c", lat: 55.8885, lng: 37.664, pic: "pic-w-c", type: "warehouse", title: "Склад класса C, 250 м²", price: 110000, unit: "мес", area: 250, people: 0, metro: "Медведково", district: "СВАО", metroMin: 12, highwayKm: 0.7, power: 30, ceiling: 6, water: 0, vent: false, heat: false },
    { id: "shop-arbat", lat: 55.7505, lng: 37.596, pic: "pic-s-arbat", type: "shop", title: "Торговое помещение на Арбате", price: 450000, unit: "мес", area: 90, people: 0, metro: "Арбатская", district: "ЦАО", metroMin: 3, highwayKm: 1, power: 25, ceiling: 3.6, water: 1, vent: true, heat: true },
    { id: "shop-sokol", lat: 55.8058, lng: 37.516, pic: "pic-s-street", type: "shop", title: "Стрит-ритейл у метро Сокол", price: 210000, unit: "мес", area: 65, people: 0, metro: "Сокол", district: "САО", metroMin: 1, highwayKm: 0.2, power: 15, ceiling: 3.3, water: 1, vent: true, heat: true },
    { id: "shop-cheremushki", lat: 55.6705, lng: 37.556, pic: "pic-s-mall", type: "shop", title: "Помещение в ТЦ, 60 м²", price: 140000, unit: "мес", area: 60, people: 0, metro: "Новые Черёмушки", district: "ЮЗАО", metroMin: 5, highwayKm: 1.3, power: 15, ceiling: 3.5, water: 1, vent: true, heat: true },
    { id: "catering-novoslob", lat: 55.7805, lng: 37.6025, pic: "pic-cafe", type: "catering", title: "Помещение под кафе, 110 м²", price: 320000, unit: "мес", area: 110, people: 0, metro: "Новослободская", district: "ЦАО", metroMin: 2, highwayKm: 0.9, power: 40, ceiling: 3.8, water: 2, vent: true, heat: true },
    { id: "production-tekst", lat: 55.708, lng: 37.734, pic: "pic-production", type: "production", title: "Производственное помещение, 600 м²", price: 380000, unit: "мес", area: 600, people: 0, metro: "Текстильщики", district: "ЮВАО", metroMin: 9, highwayKm: 0.6, power: 200, ceiling: 6, water: 2, vent: true, heat: true },
    { id: "office-krylatskoe", hourPrice: 2000, lat: 55.758, lng: 37.406, pic: "pic-o-park", type: "office", title: "Офис в бизнес-парке, 140 м²", price: 210000, unit: "мес", area: 140, people: 25, metro: "Крылатское", district: "ЗАО", metroMin: 8, highwayKm: 1.1, power: 35, ceiling: 3.2, water: 1, vent: true, heat: true },
    { id: "warehouse-szao", lat: 55.862, lng: 37.433, pic: "pic-w-cold", type: "warehouse", title: "Склад с рампой, 700 м²", price: 420000, unit: "мес", area: 700, people: 0, metro: "Планерная", district: "СЗАО", metroMin: 14, highwayKm: 0.4, power: 80, ceiling: 9, water: 1, vent: true, heat: true },
    { id: "podcast-mayak", pic: "pic-pc-18", lat: 55.7702, lng: 37.5948, type: "podcast", title: "Подкаст-студия на 2 голоса, 18 м²", price: 2500, unit: "час", area: 18, people: 3, metro: "Маяковская", district: "ЦАО", metroMin: 3, highwayKm: 0.3, power: 5, ceiling: 3, water: 0, vent: true, heat: true, equip: "2 студийных микрофона, микшер, мониторы, звукорежиссёр на записи" },
    { id: "podcast-bauman", pic: "pic-pc-28", lat: 55.7731, lng: 37.6802, type: "podcast", title: "Видеоподкаст-студия на 4 гостей, 28 м²", price: 3500, unit: "час", area: 28, people: 5, metro: "Бауманская", district: "ЦАО", metroMin: 4, highwayKm: 0.9, power: 8, ceiling: 3.2, water: 0, vent: true, heat: true, equip: "4 микрофона, 3 камеры 4K, студийный свет, монтаж записи" },
    { id: "podcast-dinamo", pic: "pic-pc-45", lat: 55.7905, lng: 37.5575, type: "podcast", title: "Студия подкастов и стримов, 45 м²", price: 4500, unit: "час", area: 45, people: 8, metro: "Динамо", district: "САО", metroMin: 5, highwayKm: 0.4, power: 12, ceiling: 3.6, water: 1, vent: true, heat: true, equip: "6 микрофонов, 4 камеры, хромакей, трансляция в эфир" }
  ];

  // тарифы: fee — сервисная комиссия сайта, limit — сколько броней может быть активно одновременно,
  // whDiscount — доп. скидка на долгосрочную аренду складов
  var PLANS = {
    free: { name: "Бесплатно", price: 0, fee: 0.10, limit: 1, whDiscount: 0 },
    basic: { name: "Базовый", price: 149, fee: 0.05, limit: 2, whDiscount: 0 },
    optimal: { name: "Оптимальный", price: 299, fee: 0, limit: 3, whDiscount: 0.10 },
    premium: { name: "Премиум", price: 499, fee: 0, limit: Infinity, whDiscount: 0.10, freeCancel: true, legalDocs: true }
  };
  var LONG_TERM_MONTHS = 6, LONG_TERM_DISCOUNT = 0.20;

  // ---------- утилиты ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(n) { return n.toLocaleString("ru-RU") + " ₽"; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Однофайловая версия: все страницы лежат в <template data-page> внутри одного index.html,
  // а адрес страницы хранится в хеше: #/booking?item=office-center или #/halls/book (book — якорь).
  var SPA = !!document.querySelector("template[data-page]");
  var route = { page: "index", anchor: "", query: "" };
  function toHash(url) {
    var m = String(url).match(/^([a-z-]+)\.html(\?[^#]*)?(?:#(.*))?$/);
    return m ? "#/" + m[1] + (m[3] ? "/" + m[3] : "") + (m[2] || "") : null;
  }
  function parseHash() {
    var h = location.hash.slice(1);
    if (h.indexOf("/") !== 0) return { page: "index", anchor: h, query: "" };
    h = h.slice(1);
    var q = "", qi = h.indexOf("?");
    if (qi >= 0) { q = h.slice(qi); h = h.slice(0, qi); }
    var parts = h.split("/");
    return { page: parts[0] || "index", anchor: parts[1] || "", query: q };
  }
  function go(url, replace) {
    if (!SPA) { if (replace) location.replace(url); else location.href = url; return; }
    var h = toHash(url) || "#/index";
    if (h === location.hash) render();
    else if (replace) location.replace(h);
    else location.hash = h;
  }
  function param(name) { return new URLSearchParams(SPA ? route.query : location.search).get(name); }
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, "е"); }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("ms_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("ms_" + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("ms_" + k); } catch (e) {} }
  };
  function user() { return store.get("user", null); }
  function accounts() {
    var list = store.get("accounts", []), u = user();
    if (u && !list.some(function (a) { return a.email === u.email; })) { list.push(u); store.set("accounts", list); }
    return list;
  }
  function activePlan() {
    var p = store.get("plan", null);
    if (!p || !PLANS[p.key] || p.key === "free") return null;
    if (new Date(p.until) < new Date()) return null;
    return p;
  }
  function planKey() { var p = activePlan(); return p ? p.key : "free"; }
  function plan() { return PLANS[planKey()]; }
  function planLimitText(k) { var l = PLANS[k].limit; return l === Infinity ? "без лимита" : l + " " + (l === 1 ? "бронь" : "брони"); }

  // брони и заявки; «активная» бронь — оплаченная и ещё не закончившаяся
  function bookings() { return store.get("bookings", []); }
  function isBooking(b) { return !!b.until && !b.cancelled; }
  function activeBookings() {
    var now = Date.now();
    return bookings().filter(function (b) { return isBooking(b) && new Date(b.until).getTime() > now; });
  }
  function limitReached() { return activeBookings().length >= plan().limit; }
  function limitMessage() {
    var k = planKey(), p = PLANS[k];
    var up = k === "optimal" ? "Перейдите на Премиум для безлимита." : k === "premium" ? "" : "Перейдите на тариф выше, чтобы бронировать больше.";
    return "Достигнут лимит тарифа «" + p.name + "» (" + planLimitText(k) + "). " + up;
  }

  function toast(text) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- тема: светлая / тёмная ----------
  function initTheme() {
    var btn = $(".theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") !== "dark";
      if (dark) document.documentElement.setAttribute("data-theme", "dark");
      else document.documentElement.removeAttribute("data-theme");
      try { localStorage.setItem("ms_theme", dark ? "dark" : "light"); } catch (e) {}
    });
  }

  // ---------- шапка ----------
  function initBurger() {
    var burger = $(".burger"), nav = $(".main-nav");
    if (burger && nav) burger.addEventListener("click", function () {
      nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
  }
  function initHeader() {
    var page = SPA ? route.page : (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "");
    $$(".main-nav a").forEach(function (a) {
      var href = a.getAttribute("href"), target = SPA && href.indexOf("#/") === 0 ? href.slice(2).split(/[/?]/)[0] : href.replace(/\.html.*$/, "");
      a.classList.toggle("active", target === page);
    });
    var u = user(), acc = $(".account-link");
    if (acc) {
      var parts = u ? u.name.split(" ") : [];
      acc.textContent = u ? parts[1] || parts[0] || "Кабинет" : "Войти";
      acc.classList.toggle("logged", !!u);
    }
  }

  // ---------- валидация ----------
  var validators = {
    required: function (v) { return v.trim().length > 0 || "Заполните поле"; },
    name: function (v) { return v.trim().length >= 2 || "Введите имя"; },
    fio: function (v) { return v.trim().split(/\s+/).length >= 2 || "Введите фамилию и имя"; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Введите корректный email"; },
    phone: function (v) { return v.replace(/\D/g, "").length >= 10 || "Введите номер телефона полностью"; },
    card: function (v) { return luhn(v.replace(/\D/g, "")) || "Проверьте номер карты"; },
    expiry: function (v) {
      var m = v.match(/^(\d{2})\s*\/\s*(\d{2})$/);
      if (!m) return "Формат ММ/ГГ";
      var mm = +m[1], yy = 2000 + +m[2];
      if (mm < 1 || mm > 12) return "Неверный месяц";
      var now = new Date();
      if (yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) return "Срок действия карты истёк";
      return true;
    },
    cvc: function (v) { return /^\d{3}$/.test(v.trim()) || "3 цифры с обратной стороны карты"; },
    date: function (v) {
      if (!v) return "Выберите дату";
      var d = new Date(v + "T23:59:59");
      return d >= new Date() || "Дата уже прошла";
    },
    consent: function (v, el) { return el.checked || "Нужно согласие"; }
  };
  function luhn(num) {
    if (!/^\d{13,19}$/.test(num)) return false;
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = +num[i];
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function validateForm(form) {
    var ok = true, first = null;
    $$("[data-v]", form).forEach(function (el) {
      if (el.closest(".hidden")) return;
      var res = validators[el.dataset.v](el.value, el);
      var err = el.parentElement.querySelector(".error-text") || el.closest(".field") && el.closest(".field").querySelector(".error-text");
      if (res !== true) {
        ok = false; el.classList.add("invalid");
        if (err) err.textContent = res;
        if (!first) first = el;
      } else {
        el.classList.remove("invalid");
        if (err) err.textContent = "";
      }
    });
    if (first) first.focus();
    return ok;
  }

  // маски ввода
  function initMasks(root) {
    $$("[data-mask=card]", root).forEach(function (el) {
      el.addEventListener("input", function () {
        el.value = el.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
      });
    });
    $$("[data-mask=expiry]", root).forEach(function (el) {
      el.addEventListener("input", function () {
        var d = el.value.replace(/\D/g, "").slice(0, 4);
        el.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
      });
    });
    $$("[data-mask=cvc]", root).forEach(function (el) {
      el.addEventListener("input", function () { el.value = el.value.replace(/\D/g, "").slice(0, 3); });
    });
    $$("[data-mask=phone]", root).forEach(function (el) {
      el.addEventListener("input", function () {
        var d = el.value.replace(/\D/g, "");
        if (d[0] === "7" || d[0] === "8") d = d.slice(1);
        d = d.slice(0, 10);
        var out = "";
        if (d.length) out = "(" + d.slice(0, 3);
        if (d.length >= 3) out += ") " + d.slice(3, 6);
        if (d.length >= 6) out += "-" + d.slice(6, 8);
        if (d.length >= 8) out += "-" + d.slice(8, 10);
        el.value = out;
      });
    });
    $$(".input", root).forEach(function (el) {
      el.addEventListener("input", function () { el.classList.remove("invalid"); });
    });
    // при входе подставляем данные пользователя
    var u = user();
    if (u) {
      $$("[data-fill]", root).forEach(function (el) { if (!el.value && u[el.dataset.fill]) el.value = u[el.dataset.fill]; });
    }
  }

  function showSuccess(form, html) {
    var box = document.createElement("div");
    box.className = "success-box";
    box.innerHTML = html;
    form.classList.add("hidden");
    form.parentNode.insertBefore(box, form.nextSibling);
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    return box;
  }
  function clearCard(form) {
    $$("[data-mask=card],[data-mask=expiry],[data-mask=cvc]", form).forEach(function (el) { el.value = ""; });
  }
  function addBooking(b) {
    var list = bookings();
    b.created = new Date().toISOString();
    b.id = b.id || "b" + Date.now().toString(36);
    b.docNo = b.docNo || 1400 + list.length + 1;
    list.unshift(b);
    store.set("bookings", list.slice(0, 40));
    return b;
  }
  function updateBooking(id, patch) {
    var list = bookings();
    list.forEach(function (b) { if (b.id === id) for (var k in patch) b[k] = patch[k]; });
    store.set("bookings", list);
  }
  function addMonths(n) { var d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString(); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }

  // ---------- формы ----------
  var handlers = {
    // регистрация в окне MoscSpace ID
    register: function (form) {
      var u = { name: form.fio.value.trim(), email: form.email.value.trim().toLowerCase(), phone: "+7 " + form.phone.value.trim(), since: new Date().toISOString() };
      var list = accounts().filter(function (a) { return a.email !== u.email; });
      list.push(u);
      store.set("accounts", list);
      signIn(u, "Аккаунт создан. Добро пожаловать, " + (u.name.split(" ")[1] || u.name) + "!");
    },

    // вход по почте или телефону
    login: function (form) {
      var q = form.login.value.trim().toLowerCase(), digits = q.replace(/\D/g, "").slice(-10);
      var found = accounts().filter(function (a) {
        return a.email === q || (digits.length === 10 && a.phone.replace(/\D/g, "").slice(-10) === digits);
      })[0];
      if (!found) {
        var err = form.querySelector(".error-text");
        err.textContent = "Аккаунт не найден на этом устройстве — зарегистрируйтесь, это займёт минуту.";
        return;
      }
      signIn(found, "С возвращением, " + (found.name.split(" ")[1] || found.name) + "!");
    },

    // заявка на подбор помещения (главная)
    lead: function (form) {
      addBooking({ kind: "Заявка на подбор", title: "3 варианта помещения", note: "перезвоним по номеру +7 " + form.phone.value });
      showSuccess(form, "<h3>Заявка принята</h3><p>Менеджер позвонит по номеру +7 " + esc(form.phone.value) + " и пришлёт 3 варианта под ваш бюджет.</p>");
    },

    // бронирование зала
    hall: function (form) {
      if (limitReached()) { toast(limitMessage()); showLimit(form); return; }
      var slot = $(".slot.picked", form), item = findItem(form.hall.value);
      var h0 = slot ? parseInt(slot.textContent, 10) : 9, h1 = slot ? h0 + 1 : 21;
      var start = new Date(form.date.value + "T" + pad(h0) + ":00:00"), until = new Date(form.date.value + "T" + pad(h1) + ":00:00");
      var b = { kind: TYPES[item.type], type: item.type, itemId: item.id, title: item.title, metro: item.metro, mode: "hours", hours: h1 - h0, start: start.toISOString(), until: until.toISOString(),
        date: form.date.value, time: slot ? slot.textContent : "весь день, время уточнит менеджер", name: form.name.value.trim(), phone: "+7 " + form.phone.value.trim(), email: form.email.value.trim() };
      addBooking(b);
      showSuccess(form, "<h3>Заявка принята</h3><p>" + esc(b.title) + "<br>" + new Date(b.date).toLocaleDateString("ru-RU") + ", " + esc(b.time) + "</p><p class='small'>Менеджер свяжется с вами по номеру " + esc(b.phone) + " для подтверждения.</p>");
    },

    // шаг 1 бронирования помещения — контакты
    contacts: function (form) {
      if (limitReached()) { showLimit(form); toast(limitMessage()); return; }
      store.set("contact", { name: form.name.value.trim(), phone: "+7 " + form.phone.value.trim(), email: form.email.value.trim() });
      var pay = $("#pay-form");
      pay.classList.remove("hidden");
      form.querySelector("button[type=submit]").textContent = "Данные сохранены — оплатите ниже";
      pay.scrollIntoView({ behavior: "smooth", block: "center" });
    },

    // шаг 2 бронирования помещения — оплата (демо)
    bookpay: function (form) {
      if (limitReached()) { showLimit($("#booking-form")); toast(limitMessage()); return; }
      var item = currentItem(), sel = bookingSelection(), q = quote(item, sel.mode, sel.qty), c = store.get("contact", {});
      clearCard(form);
      var b = addBooking({ kind: TYPES[item.type], type: item.type, itemId: item.id, title: item.title, metro: item.metro, mode: sel.mode,
        hours: sel.mode === "hours" ? sel.qty : 0, months: sel.mode === "months" ? sel.qty : 0, start: sel.start.toISOString(), until: sel.until.toISOString(),
        rent: q.rent, discounts: q.discounts, feePct: q.feePct, fee: q.fee, paid: q.payNow, total: q.total, plan: planKey(), name: c.name, phone: c.phone, email: c.email });
      $("#booking-form").classList.add("hidden");
      showSuccess(form, "<h3>Оплата прошла успешно</h3><p>«" + esc(item.title) + "» забронировано: " + esc(periodText(b)) + ".<br>Оплачено: <b>" + money(q.payNow) + "</b></p><p class='small'>Договор №" + b.docNo + " и акт уже в личном кабинете, там же цифровой ключ.</p><a class='btn black' href='account.html'>Открыть личный кабинет</a>");
    },

    // оплата подписки (демо)
    plan: function (form) {
      var key = paidPlanKey(), p = PLANS[key];
      clearCard(form);
      store.set("plan", { key: key, name: p.name, price: p.price, until: addMonths(1), paid: new Date().toISOString() });
      showSuccess(form, "<h3>Тариф «" + p.name + "» подключён</h3><p>Оплачено " + money(p.price) + " за месяц. Действует до " + fmtDate(addMonths(1)) + ", дальше — автопродление, отключить можно в кабинете.</p><a class='btn black' href='account.html'>Личный кабинет</a>");
      initHeader();
    }
  };

  // ---------- окно MoscSpace ID (вход и регистрация) ----------
  var authNext = null;
  function signIn(u, message) {
    store.set("user", u);
    closeAuth();
    initHeader();
    toast(message);
    var next = authNext;
    authNext = null;
    if (next) go(next);
    else if (SPA) render();
    else setTimeout(function () { location.reload(); }, 700);
  }
  var LOGO_YA = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='12' fill='#fc3f1d'/><path d='M13.3 6.5h-1.2c-2.1 0-3.2 1.1-3.2 2.7 0 1.8.8 2.7 2.4 3.8l1.3.9-3.7 5.6H6.2l3.4-5c-1.9-1.4-3-2.6-3-4.9 0-2.8 2-4.7 5.5-4.7h3.6V19h-2.4z' fill='#fff'/></svg>";
  var LOGO_SBP = "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M3 4l4 7v6l-4 3z' fill='#5b57a2'/><path d='M7 11l4-7h9l-9 7z' fill='#d90751'/><path d='M7 17l4-6h9l-9 6z' fill='#fab718'/><path d='M3 20l8-3 9 0-9 3z' fill='#1d9f4c'/><path d='M7 11h4v6H7z' fill='#0f8ddb'/></svg>";
  function authHtml() {
    var phone = "<div class='field'><div class='phone-wrap'><span class='cc'>+7</span><input class='input' name='phone' type='tel' inputmode='tel' placeholder='(000) 000-00-00' data-v='phone' data-mask='phone' autocomplete='tel-national'></div><div class='error-text'></div></div>";
    return "<div class='modal-backdrop' data-close></div>" +
      "<div class='modal-panel' role='dialog' aria-modal='true' aria-labelledby='auth-title'>" +
      "<button class='modal-close' type='button' data-close aria-label='Закрыть'>×</button>" +
      "<div class='id-logo' id='auth-title'>MoscSpace <b>ID</b></div>" +
      "<p class='id-sub'>Один аккаунт для броней, документов и цифровых ключей</p>" +
      "<div class='auth-tabs' role='tablist'><button type='button' role='tab' data-tab='login'>Вход</button><button type='button' role='tab' data-tab='register'>Регистрация</button></div>" +
      "<form class='auth-form' data-form='login' data-pane='login'>" +
        "<div class='field'><input class='input' name='login' type='text' placeholder='Почта или телефон' data-v='required' autocomplete='username'><div class='error-text'></div></div>" +
        "<button class='btn full neon-btn' type='submit'>Войти</button></form>" +
      "<form class='auth-form' data-form='register' data-pane='register'>" +
        "<div class='field'><input class='input' name='fio' type='text' placeholder='Фамилия и имя' data-v='fio' autocomplete='name'><div class='error-text'></div></div>" +
        "<div class='field'><input class='input' name='email' type='email' placeholder='Электронная почта' data-v='email' autocomplete='email'><div class='error-text'></div></div>" +
        phone +
        "<label class='switch-row'><input class='switch' type='checkbox' name='agree' data-v='consent' checked><span>Согласен с <a href='privacy.html' data-close>политикой конфиденциальности</a></span></label>" +
        "<button class='btn full neon-btn' type='submit'>Создать аккаунт</button></form>" +
      "<div class='auth-alt'><span class='auth-or'>или быстрый вход</span>" +
        "<button type='button' class='alt-btn' data-alt='Яндекс ID'>" + LOGO_YA + "Войти с Яндекс ID</button>" +
        "<button type='button' class='alt-btn' data-alt='СБП / T-ID'>" + LOGO_SBP + "Войти по СБП / T-ID</button></div>" +
      "</div>";
  }
  function openAuth(tab, next) {
    authNext = next || null;
    var m = $("#auth-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "auth-modal";
      m.className = "modal";
      m.innerHTML = authHtml();
      document.body.appendChild(m);
      $$("form[data-form]", m).forEach(bindForm);
      initMasks(m);
      m.addEventListener("click", function (e) {
        if (e.target.closest("[data-close]")) { closeAuth(); return; }
        var t = e.target.closest("[data-tab]");
        if (t) switchTab(t.dataset.tab);
        var alt = e.target.closest("[data-alt]");
        if (alt) toast("Вход через " + alt.dataset.alt + " заработает после подключения сервиса. Пока войдите по почте или телефону.");
      });
    }
    switchTab(tab === "register" ? "register" : "login");
    m.classList.add("open");
    document.body.classList.add("modal-lock");
    setTimeout(function () { var f = $(".auth-form:not(.hidden) .input", m); if (f) f.focus(); }, 320);
  }
  function switchTab(tab) {
    var m = $("#auth-modal");
    $$("[data-tab]", m).forEach(function (b) { b.classList.toggle("active", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab); });
    $$("[data-pane]", m).forEach(function (f) { f.classList.toggle("hidden", f.dataset.pane !== tab); });
  }
  function closeAuth() {
    var m = $("#auth-modal");
    if (m) m.classList.remove("open");
    document.body.classList.remove("modal-lock");
  }
  function initAuth() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-auth]");
      if (!a || (user() && a.dataset.auth !== "register")) return;
      e.preventDefault();
      e.stopPropagation();
      openAuth(a.dataset.auth || "login", a.dataset.next);
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAuth(); });
  }

  function bindForm(form) {
    {
      form.setAttribute("novalidate", "");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        var btn = form.querySelector("button[type=submit]");
        if (btn) { btn.disabled = true; btn.dataset.text = btn.textContent; btn.textContent = "Отправка…"; }
        setTimeout(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.text; }
          handlers[form.dataset.form](form);
        }, 600);
      });
    }
  }
  function initForms() {
    $$("main form[data-form]").forEach(bindForm);
  }

  // ---------- свободные часы для зала ----------
  function initSlots() {
    var btn = $("#show-slots");
    if (!btn) return;
    var form = btn.closest("form"), box = $("#slots");
    var dateEl = form.date;
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    dateEl.min = today.toISOString().slice(0, 10);
    function render() {
      var res = validators.date(dateEl.value);
      if (res !== true) { dateEl.classList.add("invalid"); box.innerHTML = "<p class='small'>" + res + "</p>"; return; }
      var seed = 0, key = dateEl.value + form.hall.value;
      for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) % 9973;
      var html = "";
      for (var h = 9; h <= 20; h++) {
        var busy = ((seed + h * 7) % 5) === 0 || ((seed + h) % 7) === 0 || (dateEl.value === today() && h <= new Date().getHours());
        html += "<button type='button' class='slot" + (busy ? " busy" : "") + "'" + (busy ? " disabled" : "") + ">" + h + ":00–" + (h + 1) + ":00</button>";
      }
      box.innerHTML = "<p class='small' style='margin:10px 0 0'>Свободные часы на " + new Date(dateEl.value).toLocaleDateString("ru-RU") + ":</p><div class='slots'>" + html + "</div>";
    }
    btn.addEventListener("click", render);
    dateEl.addEventListener("change", function () { if (box.innerHTML) render(); });
    form.hall.addEventListener("change", function () { if (box.innerHTML) render(); });
    box.addEventListener("click", function (e) {
      var s = e.target.closest(".slot");
      if (!s || s.disabled) return;
      $$(".slot", box).forEach(function (x) { x.classList.remove("picked"); });
      s.classList.add("picked");
    });
  }

  // ---------- страница бронирования ----------
  function findItem(id) {
    for (var i = 0; i < LISTINGS.length; i++) if (LISTINGS[i].id === id) return LISTINGS[i];
    return null;
  }
  function currentItem() { return findItem(param("item")) || LISTINGS[0]; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hourPrice(item) { return item.unit === "час" ? item.price : item.hourPrice || 0; }
  function modesOf(item) { return item.unit === "час" ? ["hours"] : item.hourPrice ? ["hours", "months"] : ["months"]; }
  function periodText(b) {
    var d = new Date(b.start);
    if (b.mode === "hours") return d.toLocaleDateString("ru-RU") + ", " + pad(d.getHours()) + ":00–" + pad(new Date(b.until).getHours()) + ":00 (" + b.hours + " ч)";
    if (b.months) return b.months + " мес. с " + d.toLocaleDateString("ru-RU");
    return b.time ? new Date(b.date).toLocaleDateString("ru-RU") + ", " + b.time : "";
  }

  // цена брони: скидка 20% от 6 месяцев на все типы, ещё 10% на склады для «Оптимального» и «Премиума», сбор по тарифу
  function quote(item, mode, qty) {
    var p = plan(), unitPrice = mode === "hours" ? hourPrice(item) : item.price;
    var base = unitPrice * qty, discounts = [];
    if (mode === "months" && qty >= LONG_TERM_MONTHS) {
      discounts.push({ label: "Скидка за срок от " + LONG_TERM_MONTHS + " мес.", pct: LONG_TERM_DISCOUNT });
      if (item.type === "warehouse" && p.whDiscount) discounts.push({ label: "Склады на тарифе «" + p.name + "»", pct: p.whDiscount });
    }
    var pct = discounts.reduce(function (a, d) { return a + d.pct; }, 0);
    var rent = Math.round(base * (1 - pct));
    var firstRent = mode === "months" ? Math.round(rent / qty) : rent;
    var fee = Math.round(firstRent * p.fee), feeTotal = Math.round(rent * p.fee);
    return { unitPrice: unitPrice, qty: qty, base: base, discounts: discounts, rent: rent, feePct: p.fee, fee: fee, payNow: firstRent + fee, total: rent + feeTotal };
  }
  function bookingSelection() {
    var form = $("#booking-form"), mode = form.dataset.mode;
    if (mode === "hours") {
      var h = +form.hours.value, d = form.hdate.value, st = +form.hstart.value;
      var start = new Date((d || today()) + "T" + pad(st) + ":00:00");
      return { mode: mode, qty: h, start: start, until: new Date(start.getTime() + h * 3600000) };
    }
    var m = +form.term.value, s = new Date((form.mdate.value || today()) + "T09:00:00"), u = new Date(s);
    u.setMonth(u.getMonth() + m);
    return { mode: mode, qty: m, start: s, until: u };
  }
  function today() { var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); }
  function showLimit(form) {
    var box = $("#limit-alert") || $(".limit-alert", form);
    if (!box) {
      box = document.createElement("div");
      box.className = "limit-alert";
      box.setAttribute("role", "alert");
      form.insertBefore(box, form.querySelector("button[type=submit]"));
    }
    box.innerHTML = "<b>" + esc(limitMessage()) + "</b><br>Активные брони: " + activeBookings().length + ". Освободить место можно в личном кабинете." +
      "<div><a class='btn black' href='subscriptions.html'>Сменить тариф</a> <a class='btn outline' href='account.html'>Мои брони</a></div>";
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function initBooking() {
    var form = $("#booking-form");
    if (!form) return;
    var item = currentItem(), modes = modesOf(item), box = $("#booking-item");
    var hp = hourPrice(item);
    box.innerHTML = "<div class='listing booking-item'><div class='pic " + (item.pic || TYPE_PICS[item.type]) + "'><span class='tag'>" + TYPES[item.type] + "</span></div><div class='body'><h4>" + esc(item.title) + "</h4><div class='meta'>м. " + item.metro + " (" + item.metroMin + " мин) · " + item.district + " · " + item.area + " м²</div>" + (item.equip ? "<div class='equip'>" + esc(item.equip) + "</div>" : "") + "<div class='price'>" + (item.unit === "час" ? money(item.price) + " / час" : money(item.price) + " / мес" + (hp ? " <span class='hour-price'>или " + money(hp) + " / час</span>" : "")) + "</div></div></div>";
    var hs = form.hstart, hrs = form.hours;
    for (var h = 8; h <= 21; h++) hs.insertAdjacentHTML("beforeend", "<option value='" + h + "'>" + pad(h) + ":00</option>");
    hs.value = "10";
    for (var n = 1; n <= 12; n++) hrs.insertAdjacentHTML("beforeend", "<option value='" + n + "'>" + n + " ч</option>");
    hrs.value = "2";
    form.hdate.min = form.mdate.min = today();
    form.hdate.value = form.mdate.value = today();
    if (param("term")) form.term.value = param("term");

    function setMode(m) {
      form.dataset.mode = m;
      $$("[data-mode]", form).forEach(function (b) { b.classList.toggle("active", b.dataset.mode === m); b.setAttribute("aria-checked", b.dataset.mode === m); });
      $$("[data-pane]", form).forEach(function (p) { p.classList.toggle("hidden", p.dataset.pane !== m); });
      upd();
    }
    function upd() {
      // сегодня нельзя начать в прошедший час; если на сегодня поздно — переносим на завтра
      var isToday = form.hdate.value === today(), nowH = new Date().getHours();
      $$("option", hs).forEach(function (o) { o.disabled = isToday && +o.value <= nowH; });
      if (hs.selectedOptions[0] && hs.selectedOptions[0].disabled) {
        var free = $$("option", hs).filter(function (o) { return !o.disabled; })[0];
        if (free) hs.value = free.value;
        else { var t = new Date(); t.setDate(t.getDate() + 1); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); form.hdate.value = t.toISOString().slice(0, 10); return upd(); }
      }
      // часы не должны выходить за 23:00
      var maxH = 23 - +hs.value;
      $$("option", hrs).forEach(function (o) { o.disabled = +o.value > maxH; });
      if (+hrs.value > maxH) hrs.value = String(maxH);
      var sel = bookingSelection(), q = quote(item, sel.mode, sel.qty), p = plan();
      var rows = "<dt>Аренда</dt><dd>" + money(q.unitPrice) + " × " + q.qty + (sel.mode === "hours" ? " ч" : " мес") + "</dd>";
      q.discounts.forEach(function (d) { rows += "<dt>" + esc(d.label) + "</dt><dd class='minus'>−" + Math.round(d.pct * 100) + "%</dd>"; });
      rows += "<dt>Сервисный сбор " + Math.round(q.feePct * 100) + "%</dt><dd>" + (q.fee ? "+" + money(q.fee) : "0 ₽") + "</dd>";
      if (sel.mode === "months") rows += "<dt>Итого за " + q.qty + " мес</dt><dd>" + money(q.total) + "</dd>";
      rows += "<dt class='total'>" + (sel.mode === "months" ? "К оплате сейчас (1-й месяц)" : "К оплате") + "</dt><dd class='total'>" + money(q.payNow) + "</dd>";
      $("#quote").innerHTML = rows;
      $$(".pay-sum").forEach(function (el) { el.textContent = money(q.payNow); });
      var note = $("#discount-note");
      if (sel.mode === "months") {
        var on = sel.qty >= LONG_TERM_MONTHS;
        note.className = "discount-note show " + (on ? "on" : "hint");
        note.innerHTML = on ? "✓ <b>Скидка 20% за долгосрочную аренду применена.</b> Аренда от 6 месяцев дешевле на пятую часть каждый месяц" + (q.discounts.length > 1 ? ", а на складах вашего тарифа — ещё минус 10%." : ".") : "Выберите 6 месяцев и больше — получите скидку 20% на всё время аренды.";
      } else {
        note.className = "discount-note";
        note.innerHTML = "";
      }
      $("#plan-line").innerHTML = "Ваш тариф: <b>" + esc(p.name) + "</b> — сбор " + Math.round(p.fee * 100) + "%, одновременно " + planLimitText(planKey()) + ". Активных сейчас: " + activeBookings().length + ". <a href='subscriptions.html'>Сменить</a>";
    }
    if (modes.length > 1) {
      $("#mode-switch").classList.remove("hidden");
      $("#mode-switch").addEventListener("click", function (e) { var b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); });
    }
    form.addEventListener("change", upd);
    setMode(param("mode") === "hours" && modes.indexOf("hours") >= 0 ? "hours" : modes.indexOf("months") >= 0 ? "months" : "hours");
    if (limitReached()) showLimit(form);
  }

  // ---------- страница оплаты подписки ----------
  function paidPlanKey() { var k = param("plan"); return PLANS[k] && k !== "free" ? k : "optimal"; }
  function initPlanPage() {
    var el = $("#plan-info");
    if (!el) return;
    var key = paidPlanKey(), p = PLANS[key];
    $("#plan-title").textContent = "Подключение тарифа «" + p.name + "»";
    el.innerHTML = "Сервисная комиссия " + Math.round(p.fee * 100) + "%, одновременно " + planLimitText(key) + ".<br>Цена — " + money(p.price) + " в месяц";
    $$(".pay-sum").forEach(function (s) { s.textContent = money(p.price); });
    $$("[data-plan-switch]").forEach(function (a) { if (a.dataset.planSwitch === key) a.classList.add("hidden"); });
    if (!user()) {
      $("#need-login").classList.remove("hidden");
      $("#need-login-link").dataset.next = "pay.html?plan=" + key;
    }
  }
  function initPlans() {
    var grid = $(".tariff-grid");
    if (!grid) return;
    var page = grid.closest("section");
    page.addEventListener("click", function (e) {
      var b = e.target.closest(".more-btn");
      if (!b) return;
      var box = document.getElementById(b.getAttribute("aria-controls")), open = !box.classList.contains("open");
      box.classList.toggle("open", open);
      b.setAttribute("aria-expanded", open);
      b.textContent = open ? "Свернуть" : "Показать полностью";
    });
    var p = activePlan();
    $("#free-status").textContent = p ? "" : "✓ Ваш текущий тариф";
    if (!p) return;
    $$(".tariff[data-plan]").forEach(function (el) {
      if (el.dataset.plan !== p.key) return;
      el.classList.add("current");
      var b = $(".btn", el);
      b.textContent = "Ваш тариф до " + new Date(p.until).toLocaleDateString("ru-RU");
      b.classList.add("is-current");
    });
  }

  // ---------- личный кабинет ----------
  var TYPE_EMOJI = { office: "🏢", coworking: "💻", hall: "🤝", warehouse: "📦", shop: "🛍️", catering: "☕", production: "🏭", podcast: "🎙️" };
  function shortDate(iso) { var d = new Date(iso); return pad(d.getDate()) + "." + pad(d.getMonth() + 1); }
  function leftText(ms) {
    var m = Math.round(ms / 60000);
    if (m < 60) return m + " мин";
    var h = Math.round(m / 60);
    if (h < 48) return h + " " + (h % 10 === 1 && h % 100 !== 11 ? "час" : h % 10 >= 2 && h % 10 <= 4 && (h % 100 < 10 || h % 100 >= 20) ? "часа" : "часов");
    var d = Math.round(h / 24);
    return d + " " + (d % 10 === 1 && d % 100 !== 11 ? "день" : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 10 || d % 100 >= 20) ? "дня" : "дней");
  }
  function bookingWhere(b) { var it = findItem(b.itemId); return (TYPES[b.type] || b.kind || "Помещение").toLowerCase() + (b.metro ? " у м. " + b.metro : it ? " у м. " + it.metro : ""); }

  // PDF: страница рисуется на canvas (кириллица берётся из системного шрифта), затем кладётся в PDF как JPEG
  function pdfFromCanvas(canvas) {
    var jpeg = atob(canvas.toDataURL("image/jpeg", 0.92).split(",")[1]);
    var W = canvas.width, H = canvas.height, parts = [], offsets = [], length = 0;
    function push(str) { var b = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) b[i] = str.charCodeAt(i) & 255; parts.push(b); length += b.length; }
    function obj(n, body) { offsets[n] = length; push(n + " 0 obj\n" + body + "\nendobj\n"); }
    push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
    obj(4, "<< /Type /XObject /Subtype /Image /Width " + W + " /Height " + H + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n" + jpeg + "\nendstream");
    var content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q";
    obj(5, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    var xref = length, table = "xref\n0 6\n0000000000 65535 f \n";
    for (var n = 1; n <= 5; n++) table += ("0000000000" + offsets[n]).slice(-10) + " 00000 n \n";
    push(table + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
    return new Blob(parts, { type: "application/pdf" });
  }
  function drawDoc(title, subtitle, sections) {
    var c = document.createElement("canvas"), W = 1240, H = 1754, x = 110, y = 140, maxW = W - 220;
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 6); g.fillStyle = "rgba(108,92,255,.07)"; g.font = "bold 120px Arial, sans-serif"; g.textAlign = "center"; g.fillText("ОБРАЗЕЦ · ДЕМО", 0, 0); g.restore();
    g.fillStyle = "#6c5cff"; g.font = "bold 30px Arial, sans-serif"; g.fillText("MoscSpace", x, 90);
    g.fillStyle = "#888"; g.font = "22px Arial, sans-serif"; g.textAlign = "right"; g.fillText("Сформировано в личном кабинете " + new Date().toLocaleDateString("ru-RU"), W - x, 90); g.textAlign = "left";
    g.fillStyle = "#111"; g.font = "bold 40px Arial, sans-serif"; g.fillText(title, x, y + 40);
    g.font = "26px Arial, sans-serif"; g.fillStyle = "#555"; g.fillText(subtitle, x, y + 84);
    y += 150;
    function wrap(text, font, color, lh) {
      g.font = font; g.fillStyle = color;
      var words = String(text).split(" "), line = "";
      words.forEach(function (w) {
        var t = line ? line + " " + w : w;
        if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = t;
      });
      if (line) { g.fillText(line, x, y); y += lh; }
    }
    sections.forEach(function (s) {
      wrap(s[0], "bold 27px Arial, sans-serif", "#111", 40);
      s.slice(1).forEach(function (p) { wrap(p, "25px Arial, sans-serif", "#333", 36); });
      y += 18;
    });
    y = Math.max(y + 40, H - 260);
    g.strokeStyle = "#999"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y + 60); g.lineTo(x + 420, y + 60); g.moveTo(W - x - 420, y + 60); g.lineTo(W - x, y + 60); g.stroke();
    g.fillStyle = "#555"; g.font = "22px Arial, sans-serif"; g.fillText("Арендодатель", x, y + 95); g.fillText("Арендатор", W - x - 420, y + 95);
    g.fillStyle = "#999"; g.font = "20px Arial, sans-serif"; g.fillText("Учебный проект MoscSpace: документ сформирован автоматически и не имеет юридической силы.", x, H - 70);
    return c;
  }
  function docFor(b, kind) {
    var it = findItem(b.itemId) || {}, u = user() || {}, no = "№" + b.docNo, where = (it.title || b.title) + (it.area && !/м²/.test(it.title || b.title) ? ", " + it.area + " м²" : "") + ", м. " + (b.metro || it.metro || "") + (it.district ? ", " + it.district : "");
    var money2 = function (v) { return v != null ? money(v) : "—"; };
    if (kind === "act") return drawDoc("Акт приёма-передачи", "к договору аренды " + no + " · г. Москва", [
      ["1. Помещение", where],
      ["2. Срок пользования", periodText(b)],
      ["3. Состояние", "Помещение передано в чистом виде после профессиональной уборки. Инженерные сети, электричество, вентиляция и связь исправны.", "Арендатору выдан цифровой смарт-ключ для бесконтактного доступа на весь срок аренды."],
      ["4. Претензии", "Стороны претензий друг к другу не имеют."]
    ]);
    var tenant = kind === "legal" ? "Арендатор: ООО «__________», ИНН __________, ОГРН __________, в лице " + (u.name || b.name || "представителя") + ", действующего на основании устава." : "Арендатор: " + (u.name || b.name || "—") + ", тел. " + (u.phone || b.phone || "—") + ", e-mail " + (u.email || b.email || "—") + ".";
    return drawDoc(kind === "legal" ? "Договор аренды (юридическое лицо)" : "Договор аренды", no + " · г. Москва · " + new Date(b.created).toLocaleDateString("ru-RU"), [
      ["1. Стороны", "Арендодатель: собственник помещения, действующий через сервис MoscSpace.", tenant],
      ["2. Предмет договора", "Арендодатель передаёт во временное пользование помещение: " + where + "."],
      ["3. Срок аренды", periodText(b) + "."],
      ["4. Стоимость", "Аренда: " + money2(b.rent) + (b.discounts && b.discounts.length ? " с учётом скидок: " + b.discounts.map(function (d) { return d.label + " −" + Math.round(d.pct * 100) + "%"; }).join(", ") : "") + ".", "Сервисный сбор MoscSpace: " + Math.round((b.feePct || 0) * 100) + "%. Оплачено при бронировании: " + money2(b.paid) + "."],
      ["5. Доступ и обслуживание", "Доступ в помещение — по цифровому смарт-ключу из личного кабинета. Регулярная уборка включена в стоимость."],
      ["6. Отмена", PLANS[b.plan] && PLANS[b.plan].freeCancel ? "Бесплатная отмена не позднее чем за 24 часа до начала аренды." : "Отмена бронирования — по правилам тарифа в личном кабинете."]
    ]);
  }
  function fileName(b, kind) {
    var type = (TYPES[b.type] || "Помещение").replace(/\s+/g, "_"), metro = (b.metro || "").replace(/\s+/g, "_");
    if (kind === "act") return "Акт_приема_передачи_" + type + "_" + metro + ".pdf";
    return (kind === "legal" ? "Договор_аренды_ЮЛ_" : "Договор_аренды_") + type + "_" + metro + "_№" + b.docNo + ".pdf";
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function initAccount() {
    var box = $("#account");
    if (!box) return;
    var u = user();
    if (!u) { $("#account-guest").classList.remove("hidden"); return; }
    box.classList.remove("hidden");
    var pk = planKey(), p = PLANS[pk], ap = activePlan(), now = Date.now();
    var all = bookings(), active = activeBookings();
    active.sort(function (a, b) { return new Date(a.start) - new Date(b.start); });
    var current = active.filter(function (b) { return new Date(b.start).getTime() <= now; })[0];
    var upcoming = active.filter(function (b) { return new Date(b.start).getTime() > now; })[0];
    var focus = current || upcoming;

    // смарт-уведомление: одно главное действие
    var w = $("#smart-widget"), it;
    if (current) {
      w.innerHTML = "<span class='sw-dot green'></span><p>Ваш " + esc(bookingWhere(current)) + " открыт. Бесконтактный доступ активен ещё " + leftText(new Date(current.until) - now) + ".</p><button type='button' class='btn neon-btn' id='sw-pin'>Сгенерировать PIN</button>";
      $("#sw-pin").addEventListener("click", function () {
        var pin = String(Math.floor(100000 + Math.random() * 900000));
        this.outerHTML = "<span class='pin' aria-label='PIN-код'>" + pin.slice(0, 3) + " " + pin.slice(3) + "</span>";
        toast("PIN действует 10 минут");
      });
    } else if (upcoming) {
      it = findItem(upcoming.itemId);
      w.innerHTML = "<span class='sw-dot yellow'></span><p>До начала аренды: " + esc(bookingWhere(upcoming)) + " — осталось " + leftText(new Date(upcoming.start) - now) + ".</p>" + (it ? "<a class='btn neon-btn' target='_blank' rel='noopener' href='https://yandex.ru/maps/?rtext=~" + it.lat + "," + it.lng + "&rtt=mt'>Маршрут</a>" : "");
    } else {
      w.innerHTML = "<span class='sw-dot gray'></span><p>Активных бронирований нет — подберите помещение за 5 минут.</p><a class='btn neon-btn' href='index.html#search'>Подобрать</a>";
    }

    // профиль
    var initials = u.name.split(" ").map(function (x) { return x.charAt(0); }).slice(0, 2).join("").toUpperCase();
    $("#profile").innerHTML = "<div class='ava'>" + esc(initials) + "</div><h3>" + esc(u.name) + "</h3><p class='small muted'>" + esc(u.email) + "<br>" + esc(u.phone) + "<br>С нами с " + fmtDate(u.since) + "</p>" +
      "<div class='plan-pill pill-" + pk + "'>Тариф «" + esc(p.name) + "»" + (ap ? " до " + shortDate(ap.until) : "") + "</div>" +
      "<p class='small muted'>Комиссия " + Math.round(p.fee * 100) + "% · " + planLimitText(pk) + " одновременно</p>" +
      "<div class='profile-actions'><a class='btn black' href='subscriptions.html'>" + (ap ? "Сменить тариф" : "Подключить тариф") + "</a>" + (ap ? "<button type='button' class='link-btn' id='plan-off'>Отключить подписку</button>" : "") + "<button type='button' class='link-btn' id='logout'>Выйти</button></div>";
    $("#logout").addEventListener("click", function () { store.del("user"); toast("Вы вышли из аккаунта"); go("index.html"); });
    if (ap) $("#plan-off").addEventListener("click", function () {
      if (this.dataset.sure) { store.del("plan"); toast("Подписка отключена — вы на бесплатном тарифе"); initAccount(); return; }
      this.dataset.sure = "1"; this.textContent = "Точно отключить? Нажмите ещё раз";
    });

    // цифровой смарт-ключ с QR-кодом
    var code = "MS-" + (u.email.length * 7919 % 9000 + 1000) + "-" + (focus ? focus.docNo : "0000");
    $("#key-code").textContent = code;
    $("#key-note").textContent = focus ? "Ключ к: " + (focus.title) + ". Покажите QR на входе или используйте PIN." : "Ключ активируется, когда появится бронь. Тариф: «" + p.name + "».";
    var qb = $("#qr-box");
    if (window.qrcode) {
      var qr = qrcode(0, "M");
      qr.addData("https://moscspace.example/key/" + code + "?plan=" + pk);
      qr.make();
      var n = qr.getModuleCount(), path = "";
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) path += "M" + c + " " + r + "h1v1h-1z";
      qb.innerHTML = "<svg viewBox='-2 -2 " + (n + 4) + " " + (n + 4) + "' role='img' aria-label='QR-код смарт-ключа'><rect x='-2' y='-2' width='" + (n + 4) + "' height='" + (n + 4) + "' fill='#fff'/><path d='" + path + "' fill='#111'/></svg>";
    }
    qb.classList.toggle("inactive", !focus);

    // слоты активных броней
    var limit = p.limit, slots = limit === Infinity ? active.length + 1 : Math.max(limit, active.length);
    $("#slots-count").textContent = active.length + " из " + (limit === Infinity ? "∞" : limit);
    var caps = "";
    for (var i = 0; i < slots; i++) {
      var b = active[i];
      if (b) {
        caps += "<div class='capsule on'><span class='cap-emoji'>" + (TYPE_EMOJI[b.type] || "📍") + "</span><div><b>" + esc(TYPES[b.type] || b.kind) + " · " + esc(b.metro || "") + "</b><span class='small'>" + (new Date(b.start).getTime() > now ? "Начнётся " + shortDate(b.start) : "Активен до " + shortDate(b.until)) + "</span><span class='small muted cap-title'>" + esc(b.title) + "</span></div><button type='button' class='cap-cancel' data-cancel='" + b.id + "'>Отменить</button></div>";
      } else {
        caps += "<a class='capsule empty' href='index.html#search' data-add-slot>+ Добавить бронирование</a>";
      }
    }
    var cap = $("#capsules");
    cap.innerHTML = caps + (limit !== Infinity && active.length >= limit ? "<div class='limit-alert'>Все слоты заняты. " + esc(limitMessage()) + " <a href='subscriptions.html'>Тарифы</a></div>" : "");
    cap.onclick = function (e) {
      var x = e.target.closest("[data-cancel]");
      if (!x) return;
      if (!x.dataset.sure) { x.dataset.sure = "1"; x.textContent = "Точно отменить?"; return; }
      var bk = all.filter(function (q) { return q.id === x.dataset.cancel; })[0];
      var free = p.freeCancel && new Date(bk.start).getTime() - Date.now() >= 24 * 3600000;
      updateBooking(bk.id, { cancelled: true, cancelledAt: new Date().toISOString() });
      toast(free ? "Бронь отменена бесплатно, вернём " + money(bk.paid || 0) : "Бронь отменена. Бесплатная отмена за 24 часа — на тарифе «Премиум»");
      initAccount();
    };

    // история: прошлые и отменённые брони, заявки
    var hist = all.filter(function (b) { return active.indexOf(b) < 0 && !activeBookings().some(function (a) { return a.id === b.id; }); });
    $("#history").innerHTML = hist.length ? hist.slice(0, 8).map(function (b) {
      return "<div class='hist-row'><b>" + esc(b.kind) + "</b><span class='small muted'>" + esc(b.title) + (b.cancelled ? " · отменена" : b.until ? " · завершена " + shortDate(b.until) : b.note ? " · " + esc(b.note) : "") + "</span></div>";
    }).join("") : "<p class='small muted'>Здесь появятся завершённые брони и заявки на подбор помещения.</p>";

    // калькулятор выгоды
    var cnt = $("#sv-count"), avg = $("#sv-avg");
    function calc() {
      var n = +cnt.value, a = +avg.value, spend = n * a;
      $("#sv-count-val").textContent = n;
      $("#sv-avg-val").textContent = money(a);
      var costs = ["free", "basic", "optimal", "premium"].map(function (k) { return { k: k, cost: Math.round(spend * PLANS[k].fee) + PLANS[k].price }; });
      var freeFee = costs[0].cost, save = freeFee - PLANS.optimal.price;
      $("#sv-result").innerHTML = "Без подписки вы бы отдали комиссии на <b>" + money(freeFee) + "</b>. " +
        (save > 0 ? "С подпиской «Оптимальный» (299 ₽) ваша чистая экономия: <b class='save'>" + money(save) + " в месяц!</b>" : "При таком объёме подписка «Оптимальный» пока не окупается — выгоднее остаться на бесплатном тарифе.");
      var max = Math.max.apply(null, costs.map(function (x) { return x.cost; })) || 1, best = costs.reduce(function (m, x) { return x.cost < m.cost ? x : m; });
      $("#sv-bars").innerHTML = costs.map(function (x) {
        return "<div class='bar-row" + (x === best ? " best" : "") + (x.k === pk ? " mine" : "") + "'><span>" + PLANS[x.k].name + "</span><div class='bar'><i style='width:" + Math.max(3, x.cost / max * 100) + "%'></i></div><b>" + money(x.cost) + "</b></div>";
      }).join("") + "<p class='small muted'>Комиссия + цена подписки в месяц. Зелёным — самый выгодный вариант.</p>";
    }
    cnt.oninput = avg.oninput = calc;
    calc();

    // сейф документов
    var docs = [];
    all.filter(isBooking).forEach(function (b) {
      docs.push({ b: b, kind: "contract" }, { b: b, kind: "act" });
      if (PLANS[pk].legalDocs) docs.push({ b: b, kind: "legal" });
    });
    $("#docs-count").textContent = docs.length ? docs.length + " " + (docs.length < 5 ? "документа" : "документов") : "пока пусто";
    $("#docs-items").innerHTML = (docs.length ? docs.map(function (d, i) {
      return "<div class='doc-row'><span class='doc-ic'>📄</span><span class='doc-name'>" + esc(fileName(d.b, d.kind)) + "</span><button type='button' class='mini-btn' data-doc='" + i + "'>Скачать</button></div>";
    }).join("") : "<p class='small muted'>Договор и акт появятся сразу после первого бронирования.</p>") +
      (PLANS[pk].legalDocs ? "" : "<div class='doc-row locked'><span class='doc-ic'>🔒</span><span class='doc-name'>Договоры для юридических лиц — на тарифе «Премиум»</span><a class='mini-btn ghost' href='subscriptions.html'>Подробнее</a></div>");
    $("#docs-items").onclick = function (e) {
      var d = e.target.closest("[data-doc]");
      if (!d) return;
      var doc = docs[+d.dataset.doc];
      download(pdfFromCanvas(docFor(doc.b, doc.kind)), fileName(doc.b, doc.kind));
    };
    var docsBtn = $("#docs-btn");
    docsBtn.onclick = function () {
      var open = !$("#docs").classList.contains("open");
      $("#docs").classList.toggle("open", open);
      docsBtn.setAttribute("aria-expanded", open);
    };

    // быстрые действия
    var renew = $("#renew-panel");
    $(".quick-actions").onclick = function (e) {
      var q = e.target.closest("[data-qa]");
      if (!q) return;
      var a = q.dataset.qa;
      if (a === "lock") {
        if (current) { q.classList.add("done"); toast("Замок открыт: " + current.title + ". Дверь закроется сама через 30 секунд."); setTimeout(function () { q.classList.remove("done"); }, 3000); }
        else if (upcoming) toast("Замок откроется в начале аренды — " + new Date(upcoming.start).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }));
        else toast("Нет активной брони — открывать нечего");
      } else if (a === "chat") openConcierge(pk);
      else if (a === "docs") { $("#docs").classList.add("open"); docsBtn.setAttribute("aria-expanded", true); $("#docs").scrollIntoView({ behavior: "smooth", block: "center" }); }
      else if (a === "renew") {
        if (!focus) { toast("Продлевать пока нечего — сначала забронируйте помещение"); return; }
        var itm = findItem(focus.itemId) || {}, hp = hourPrice(itm) || Math.round((itm.price || 0) / 160), dp = itm.unit === "час" ? hp * 8 : Math.round((itm.price || 0) / 30);
        renew.innerHTML = "<p>Продлить «" + esc(focus.title) + "» (сейчас до " + new Date(focus.until).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + "):</p>" +
          "<div class='btn-row'><button type='button' class='btn black' data-ext='1'>+1 час · " + money(hp) + "</button><button type='button' class='btn outline' data-ext='24'>+1 день · " + money(dp) + "</button></div>";
        renew.classList.remove("hidden");
        renew.onclick = function (ev) {
          var x = ev.target.closest("[data-ext]");
          if (!x) return;
          var hrs = +x.dataset.ext, cost = hrs === 1 ? hp : dp, until = new Date(new Date(focus.until).getTime() + hrs * 3600000);
          updateBooking(focus.id, { until: until.toISOString(), paid: (focus.paid || 0) + cost, extended: (focus.extended || 0) + hrs });
          toast("Аренда продлена до " + until.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + " · списано " + money(cost));
          initAccount();
        };
      }
    };
  }

  // консьерж-чат: на «Премиум» — личный менеджер, на «Оптимальном» — быстрый бот
  function openConcierge(pk) {
    var box = $("#concierge"), chat = $("#cc-chat"), form = $("#cc-form");
    var who = pk === "premium" ? ["Анна, личный менеджер", "отвечает за 1 минуту"] : pk === "optimal" ? ["Быстрый бот MoscSpace", "отвечает мгновенно"] : ["Поддержка MoscSpace", "отвечает в течение 15 минут"];
    $("#cc-title").textContent = who[0];
    $("#cc-sub").textContent = who[1];
    function say(cls, text) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = esc(text) + "<span class='msg-time'>" + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) + "</span>";
      chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
      return d;
    }
    if (!chat.children.length) say("bot", pk === "premium" ? "Здравствуйте! Я ваш персональный менеджер. Продлить аренду, заказать уборку или подобрать зал — напишите, всё сделаю." : "Здравствуйте! Чем помочь: продление, доступ в помещение, документы?");
    box.classList.remove("hidden");
    form.q.focus();
    form.onsubmit = function (e) {
      e.preventDefault();
      var q = form.q.value.trim();
      if (!q) return;
      form.q.value = "";
      say("user", q);
      var t = say("bot", "");
      t.innerHTML = "<span class='typing'><span></span><span></span><span></span></span>";
      setTimeout(function () {
        var low = norm(q);
        var ans = /продл/.test(low) ? "Продлить можно кнопкой «Продлить» в кабинете: +1 час или +1 день в один клик." :
          /замок|доступ|ключ|pin|пин/.test(low) ? "Доступ — по QR смарт-ключа слева или по PIN из верхнего уведомления. Если замок не открывается, перезвоним за 2 минуты." :
          /договор|документ|акт/.test(low) ? "Договор и акт по каждой брони лежат в блоке «Документы и договоры аренды» — их можно скачать в PDF." :
          /отмен/.test(low) ? (pk === "premium" ? "Отмена за 24 часа до начала бесплатная — нажмите «Отменить» на карточке брони." : "Отменить можно на карточке брони. Бесплатная отмена за 24 часа — на тарифе «Премиум».") :
          "Принял! " + (pk === "premium" ? "Займусь прямо сейчас и напишу вам в течение минуты." : "Передал запрос специалисту, ответ придёт на почту и сюда в чат.");
        t.innerHTML = esc(ans) + "<span class='msg-time'>" + pad(new Date().getHours()) + ":" + pad(new Date().getMinutes()) + "</span>";
        chat.scrollTop = chat.scrollHeight;
      }, pk === "premium" || pk === "optimal" ? 700 : 1300);
    };
    box.onclick = function (e) { if (e.target.closest("[data-cc-close]")) box.classList.add("hidden"); };
  }

  // ---------- поиск ----------
  function listingCard(l) {
    var price = money(l.price) + " / " + l.unit + (l.hourPrice ? " <span class='hour-price'>или " + money(l.hourPrice) + " / час</span>" : "");
    var href = "booking.html?item=" + l.id;
    return "<div class='listing' data-id='" + l.id + "'><div class='pic " + (l.pic || TYPE_PICS[l.type]) + "'><span class='tag'>" + TYPES[l.type] + "</span></div><div class='body'><h4>" + esc(l.title) + "</h4><div class='price'>" + price + "</div>" + (l.equip ? "<div class='equip'>" + esc(l.equip) + "</div>" : "") + "<div class='meta'>м. " + l.metro + " (" + l.metroMin + " мин пешком) · " + l.district + "</div><div class='meta'>" + l.area + " м² · " + l.power + " кВт · потолки " + l.ceiling + " м" + (l.people ? " · до " + l.people + " чел." : "") + "</div><a class='btn black' href='" + href + "'>Забронировать</a></div></div>";
  }
  function initSearch() {
    var form = $("#search-form");
    if (!form) return;
    var advBtn = $(".adv-toggle", form), adv = $("#adv-filters");
    advBtn.addEventListener("click", function () {
      var open = !adv.classList.contains("open");
      adv.classList.toggle("open", open);
      advBtn.setAttribute("aria-expanded", open);
    });
    function num(el) { var v = parseFloat(String(el.value).replace(/\s/g, "")); return isNaN(v) ? null : v; }
    function fmt(n) { return n.toLocaleString("ru-RU"); }

    // Каждый фильтр — отдельная проверка. Варианты в любом фильтре считаются по объектам,
    // которые проходят все ОСТАЛЬНЫЕ фильтры: выбрали «Офис» — в списке метро только станции с офисами.
    function current() {
      var f = {
        type: form.type.value, price: num(form.price), areaMin: num(form.areaMin), areaMax: num(form.areaMax),
        metro: form.metro.value, district: form.district.value, metroMin: num(form.metroMin), highway: num(form.highway)
      };
      f.power = num(form.power); f.ceiling = num(form.ceiling); f.water = num(form.water); f.vent = form.vent.checked; f.heat = form.heat.checked;
      return f;
    }
    var CHECKS = {
      type: function (l, f) { return !f.type || l.type === f.type; },
      price: function (l, f) { return f.price == null || l.price <= f.price; },
      area: function (l, f) { return (f.areaMin == null || l.area >= f.areaMin) && (f.areaMax == null || l.area <= f.areaMax); },
      metro: function (l, f) { return !f.metro || l.metro === f.metro; },
      district: function (l, f) { return !f.district || l.district === f.district; },
      metroMin: function (l, f) { return f.metroMin == null || l.metroMin <= f.metroMin; },
      highway: function (l, f) { return f.highway == null || l.highwayKm <= f.highway; },
      power: function (l, f) { return f.power == null || l.power >= f.power; },
      ceiling: function (l, f) { return f.ceiling == null || l.ceiling >= f.ceiling; },
      water: function (l, f) { return f.water == null || l.water >= f.water; },
      vent: function (l, f) { return !f.vent || l.vent; },
      heat: function (l, f) { return !f.heat || l.heat; }
    };
    function matching(f, except) {
      return LISTINGS.filter(function (l) {
        for (var k in CHECKS) if (k !== except && !CHECKS[k](l, f)) return false;
        return true;
      });
    }

    // выпадающие списки: только значения, которые есть среди подходящих объектов, с количеством
    function fillSelect(sel, anyLabel, values, counts) {
      var cur = sel.value, html = "<option value=''>" + anyLabel + "</option>";
      values.forEach(function (v) {
        var n = counts[v.value] || 0;
        if (!n && v.value !== cur) return;
        html += "<option value='" + esc(v.value) + "'>" + esc(v.label) + " (" + n + ")</option>";
      });
      sel.innerHTML = html;
      sel.value = cur;
    }
    function countBy(list, key) {
      var c = {};
      list.forEach(function (l) { c[l[key]] = (c[l[key]] || 0) + 1; });
      return c;
    }
    var allMetros = Object.keys(countBy(LISTINGS, "metro")).sort(function (a, b) { return a.localeCompare(b, "ru"); });

    // числовые поля: в подсказке — диапазон, который реально есть среди подходящих объектов
    function range(list, key) {
      if (!list.length) return null;
      var vals = list.map(function (l) { return l[key]; });
      return [Math.min.apply(null, vals), Math.max.apply(null, vals)];
    }
    function hint(el, r, unit) {
      el.placeholder = r ? (r[0] === r[1] ? fmt(r[0]) : fmt(r[0]) + " – " + fmt(r[1])) + (unit ? " " + unit : "") : "нет вариантов";
    }

    function updateFilters(f) {
      fillSelect(form.type, "Любой", Object.keys(TYPES).map(function (k) { return { value: k, label: TYPES[k] }; }), countBy(matching(f, "type"), "type"));
      fillSelect(form.metro, "Любая", allMetros.map(function (m) { return { value: m, label: m }; }), countBy(matching(f, "metro"), "metro"));
      fillSelect(form.district, "Любой", DISTRICTS.map(function (d) { return { value: d, label: d }; }), countBy(matching(f, "district"), "district"));
      hint(form.price, range(matching(f, "price"), "price"), "₽");
      var ar = range(matching(f, "area"), "area");
      hint(form.areaMin, ar, "м²"); hint(form.areaMax, ar, "м²");
      hint(form.metroMin, range(matching(f, "metroMin"), "metroMin"), "мин");
      hint(form.highway, range(matching(f, "highway"), "highwayKm"), "км");
      hint(form.power, range(matching(f, "power"), "power"), "кВт");
      hint(form.ceiling, range(matching(f, "ceiling"), "ceiling"), "м");
      hint(form.water, range(matching(f, "water"), "water"), "");
      [["vent", "vent"], ["heat", "heat"]].forEach(function (p) {
        var el = form[p[0]], any = matching(f, p[0]).some(function (l) { return l[p[1]]; });
        el.disabled = !any && !el.checked;
        el.parentElement.style.opacity = el.disabled ? ".4" : "";
      });
    }

    function run(scroll) {
      var f = current(), res = matching(f, null);
      updateFilters(f);
      $("#results-count").textContent = "Найдено объектов: " + res.length;
      $("#results").innerHTML = res.length ? res.map(listingCard).join("") : "<div class='empty' style='grid-column:1/-1'>Ничего не найдено — попробуйте смягчить условия.</div>";
      if (scroll) $("#results-count").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); run(true); });
    form.addEventListener("change", function () { run(false); });
    var typing;
    form.addEventListener("input", function (e) {
      if (e.target.type !== "number") return;
      clearTimeout(typing); typing = setTimeout(function () { run(false); }, 350);
    });
    form.addEventListener("reset", function () { setTimeout(function () { run(false); }, 0); });
    var t = param("type");
    if (t && TYPES[t]) { updateFilters(current()); form.type.value = t; }
    run(false);
  }

  // ---------- карта ----------
  function initMap() {
    var box = $("#leaflet-map");
    if (!box || !window.L) return;
    var popup = $("#map-popup"), hidden = {}, markers = {};
    var map = L.map(box, { zoomControl: true, scrollWheelZoom: true }).setView([55.751, 37.618], 11);
    map.attributionControl.setPrefix("<a href='https://leafletjs.com' target='_blank' rel='noopener'>Leaflet</a>");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noopener'>участники OpenStreetMap</a>"
    }).on("tileerror", function () {
      // подложка не загрузилась (нет интернета или хостинг запрещает внешние картинки) — точки всё равно работают
      var n = $("#map-note");
      if (n) n.classList.remove("hidden");
    }).addTo(map);
    LISTINGS.forEach(function (l) {
      var m = L.circleMarker([l.lat, l.lng], { radius: 9, color: "#fff", weight: 2, fillColor: TYPE_COLORS[l.type], fillOpacity: 1 })
        .bindTooltip(esc(l.title) + "<br><b>" + money(l.price) + " / " + l.unit + "</b>", { direction: "top", offset: [0, -8] })
        .on("click", function () { show(l.id); })
        .addTo(map);
      markers[l.id] = m;
    });
    map.fitBounds(L.featureGroup(Object.keys(markers).map(function (k) { return markers[k]; })).getBounds(), { padding: [30, 30] });

    // легенда = переключатели типов
    var legend = $("#map-legend");
    legend.innerHTML = Object.keys(TYPES).map(function (k) {
      return "<button type='button' class='legend-item' data-type='" + k + "'><i style='background:" + TYPE_COLORS[k] + "'></i>" + TYPES[k] + "</button>";
    }).join("");
    legend.addEventListener("click", function (e) {
      var b = e.target.closest(".legend-item");
      if (!b) return;
      var t = b.dataset.type;
      hidden[t] = !hidden[t];
      b.classList.toggle("off", hidden[t]);
      LISTINGS.forEach(function (l) {
        if (l.type !== t) return;
        if (hidden[t]) map.removeLayer(markers[l.id]); else markers[l.id].addTo(map);
      });
    });

    function show(id) {
      var l = LISTINGS.filter(function (x) { return x.id === id; })[0];
      if (!l) return;
      if (hidden[l.type]) { hidden[l.type] = false; markers[l.id].addTo(map); var b = $(".legend-item[data-type='" + l.type + "']"); if (b) b.classList.remove("off"); }
      Object.keys(markers).forEach(function (k) { markers[k].setStyle({ radius: k === id ? 13 : 9, weight: k === id ? 4 : 2 }); });
      map.setView([l.lat, l.lng], Math.max(map.getZoom(), 13), { animate: true });
      var href = "booking.html?item=" + l.id;
      popup.innerHTML = "<button class='close' type='button' aria-label='Закрыть'>×</button><div class='pop-pic " + (l.pic || TYPE_PICS[l.type]) + "'></div><div class='pop-body'><span class='small muted'>" + TYPES[l.type] + "</span><h4>" + esc(l.title) + "</h4><div><b>" + money(l.price) + " / " + l.unit + "</b> · " + l.area + " м²</div><div class='small muted'>м. " + l.metro + " (" + l.metroMin + " мин) · " + l.district + "</div><a class='btn black' style='margin-top:10px;padding:10px 18px' href='" + href + "'>Забронировать</a></div>";
      popup.classList.remove("hidden");
    }
    popup.addEventListener("click", function (e) {
      if (e.target.closest(".close")) {
        popup.classList.add("hidden");
        Object.keys(markers).forEach(function (k) { markers[k].setStyle({ radius: 9, weight: 2 }); });
      }
    });
    window.MS_showOnMap = show;
  }

  // ---------- AI-помощник (подбор по ключевым словам) ----------
  var TYPE_WORDS = [
    ["podcast", /подкаст|студи|запис|стрим/],
    ["coworking", /коворк|рабоч\w* мест|место для работы/],
    ["hall", /переговор|конференц|зал|встреч|презентац|тренинг/],
    ["office", /офис/],
    ["warehouse", /склад|хранен/],
    ["catering", /кафе|ресторан|общепит|кофейн/],
    ["shop", /магазин|торгов|бутик|ритейл/],
    ["production", /производ|цех/]
  ];
  var DISTRICTS = ["ЦАО", "САО", "СВАО", "ВАО", "ЮВАО", "ЮАО", "ЮЗАО", "ЗАО", "СЗАО"];
  function assistantAnswer(q) {
    var t = norm(q), crit = [], res = LISTINGS.slice();
    var type = null;
    for (var i = 0; i < TYPE_WORDS.length; i++) if (TYPE_WORDS[i][1].test(t)) { type = TYPE_WORDS[i][0]; break; }
    if (type) { res = res.filter(function (l) { return l.type === type; }); crit.push(TYPES[type].toLowerCase()); }

    var people = t.match(/(\d+)\s*(человек|чел|сотрудник|мест)/);
    if (people) {
      var n = +people[1];
      res = res.filter(function (l) { return l.people >= n || (!l.people && l.area >= n * 5); });
      crit.push("от " + n + " человек");
    }
    var area = t.match(/(\d+)\s*(м2|м²|кв|метр)/);
    if (area && !people) { res = res.filter(function (l) { return l.area >= +area[1] * 0.8; }); crit.push("от " + area[1] + " м²"); }

    var price = t.match(/до\s*(\d[\d\s]*)\s*(к|тыс|т\.|000|руб|₽)?/);
    if (price) {
      var p = +price[1].replace(/\s/g, "");
      if (price[2] && /к|тыс|т\./.test(price[2])) p *= 1000;
      if (p >= 1000) { res = res.filter(function (l) { return l.price <= p; }); crit.push("до " + money(p)); }
    }

    var metroHit = null;
    LISTINGS.forEach(function (l) { var stem = norm(l.metro).slice(0, 6); if (t.indexOf(stem) >= 0) metroHit = l.metro; });
    if (metroHit) {
      var exact = res.filter(function (l) { return l.metro === metroHit; });
      if (exact.length) res = exact;
      else {
        var ref = LISTINGS.filter(function (l) { return l.metro === metroHit; })[0];
        res.sort(function (a, b) { return Math.hypot(a.lat - ref.lat, a.lng - ref.lng) - Math.hypot(b.lat - ref.lat, b.lng - ref.lng); });
      }
      crit.push("рядом с м. " + metroHit);
    }
    DISTRICTS.forEach(function (d) {
      if (new RegExp("(^|[^а-я])" + norm(d) + "([^а-я]|$)").test(t)) { res = res.filter(function (l) { return l.district === d; }); crit.push(d); }
    });
    if (/центр/.test(t)) { res = res.filter(function (l) { return l.district === "ЦАО"; }); crit.push("в центре"); }

    var when = t.match(/(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]|завтра|сегодня)/);
    if (!crit.length) {
      return { text: "Пока не понял, что именно ищем. Напишите тип помещения (офис, склад, магазин, переговорная, коворкинг, студия подкастов), количество человек или площадь, бюджет и метро — например: «Склад от 300 м² до 400 тыс. в ВАО».", items: [] };
    }
    var top = res.slice(0, 3);
    if (!top.length) return { text: "По запросу (" + crit.join(", ") + ") свободных помещений нет. Попробуйте увеличить бюджет или убрать часть условий.", items: [] };
    var txt = "Нашёл " + top.length + " " + (top.length === 1 ? "вариант" : "варианта") + ": " + crit.join(", ") + "." + (when ? " Бронь на «" + when[1] + "» можно оформить прямо из карточки." : "") + " Первый уже подсветил на карте.";
    return { text: txt, items: top };
  }
  function initAssistant() {
    var form = $("#chat-form");
    if (!form) return;
    var chat = $("#chat");
    function time() { var d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    $$(".msg-time", chat).forEach(function (t) { t.textContent = time(); });
    function add(cls, html) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = html + "<span class='msg-time'>" + time() + "</span>";
      chat.appendChild(d);
      chat.scrollTop = chat.scrollHeight;
      return d;
    }
    function miniCard(l) {
      return "<div class='mini-card'><div class='mini-pic " + (l.pic || TYPE_PICS[l.type]) + "'></div><div><b>" + esc(l.title) + "</b>" +
        "<div class='mini-meta'>" + money(l.price) + " / " + l.unit + " · м. " + esc(l.metro) + " · " + l.area + " м²</div>" +
        "<div class='mini-actions'><button type='button' class='mini-btn' data-show='" + l.id + "'>Показать на карте</button><a class='mini-btn ghost' href='booking.html?item=" + l.id + "'>Забронировать</a></div></div></div>";
    }
    function ask(q) {
      q = q.trim();
      if (!q) return;
      add("user", esc(q));
      // нейросеть «печатает»: бегущие точки, потом плавно появляется ответ
      var wait = add("bot", "<span class='typing' aria-label='Печатает'><span></span><span></span><span></span></span>");
      var a = assistantAnswer(q);
      setTimeout(function () {
        wait.innerHTML = "<div class='fade-in'>" + esc(a.text) + "</div>" + a.items.map(miniCard).join("") + "<span class='msg-time'>" + time() + "</span>";
        chat.scrollTop = chat.scrollHeight;
        if (a.items[0] && window.MS_showOnMap) window.MS_showOnMap(a.items[0].id);
      }, 900 + Math.min(a.items.length, 3) * 250);
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); ask(form.q.value); form.q.value = ""; });
    chat.addEventListener("click", function (e) {
      var r = e.target.closest("[data-show]");
      if (r && window.MS_showOnMap) { window.MS_showOnMap(r.dataset.show); if (innerWidth < 900) $("#map-box").scrollIntoView({ behavior: "smooth" }); }
    });
    $$(".assistant .chip").forEach(function (c) { c.addEventListener("click", function () { ask(c.textContent); }); });
  }

  // ---------- слайдер ----------
  function initSliders() {
    $$(".slider").forEach(function (sl) {
      var slides = $$(".slide", sl), dots = $(".dots", sl), i = 0, timer;
      dots.innerHTML = slides.map(function (_, k) { return "<button type='button' aria-label='Слайд " + (k + 1) + "'></button>"; }).join("");
      function go(n) {
        i = (n + slides.length) % slides.length;
        slides.forEach(function (s, k) { s.classList.toggle("active", k === i); });
        $$("button", dots).forEach(function (d, k) { d.classList.toggle("active", k === i); });
        clearInterval(timer); timer = setInterval(function () { go(i + 1); }, 6000);
      }
      $(".prev", sl).addEventListener("click", function () { go(i - 1); });
      $(".next", sl).addEventListener("click", function () { go(i + 1); });
      $$("button", dots).forEach(function (d, k) { d.addEventListener("click", function () { go(k); }); });
      go(0);
    });
  }

  // ---------- аккордеон ----------
  function initAccordions() {
    $$(".acc-head").forEach(function (h) {
      h.addEventListener("click", function () { h.parentElement.classList.toggle("open"); });
    });
  }

  function initPage() {
    initHeader();
    initMasks($("main"));
    initForms();
    initSlots();
    initBooking();
    initPlanPage();
    initPlans();
    initAccount();
    initSearch();
    initMap();
    initAssistant();
    initSliders();
    initAccordions();
  }

  // показать страницу из шаблона (однофайловая версия)
  function render() {
    route = parseHash();
    var tpl = $("template[data-page='" + route.page + "']") || $("template[data-page='index']");
    if (tpl.dataset.page !== route.page) route = { page: "index", anchor: route.anchor, query: route.query };
    var main = $("main");
    main.innerHTML = "";
    main.appendChild(tpl.content.cloneNode(true));
    document.title = tpl.dataset.title;
    var nav = $(".main-nav");
    if (nav) nav.classList.remove("open");
    initPage();
    var t = route.anchor && document.getElementById(route.anchor);
    if (t) t.scrollIntoView(); else window.scrollTo(0, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initBurger();
    initTheme();
    initAuth();
    if (!SPA) { initPage(); return; }
    // ссылки вида page.html и #якорь работают внутри одного файла
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[href]");
      if (!a || a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (href.charAt(0) === "#" && href.indexOf("#/") !== 0) {
        var el = href.length > 1 && document.getElementById(href.slice(1));
        e.preventDefault();
        if (el) el.scrollIntoView({ behavior: "smooth" });
        return;
      }
      var h = toHash(href);
      if (h) { e.preventDefault(); go(href); }
    });
    window.addEventListener("hashchange", render);
    render();
  });
})();
