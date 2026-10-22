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
    production: "Производство"
  };
  var TYPE_COLORS = {
    office: "#4f7cff", coworking: "#7c2f3e", hall: "#f4e45a", warehouse: "#c98a3a",
    shop: "#5a9a3c", catering: "#e0607e", production: "#9a9a9a"
  };
  var TYPE_PICS = {
    office: "pic-office", coworking: "pic-coworking", hall: "pic-hall", warehouse: "pic-warehouse",
    shop: "pic-office", catering: "pic-hall", production: "pic-warehouse"
  };

  // x, y — положение на схеме карты (0–100), центр Москвы ≈ 50,50
  var LISTINGS = [
    { id: "office-center", lat: 55.7495, lng: 37.5395, pic: "pic-o-city", type: "office", title: "Офис в Москва-Сити с панорамным видом", price: 350000, unit: "мес", area: 120, people: 20, metro: "Выставочная", district: "ЦАО", metroMin: 3, highwayKm: 0.5, power: 30, ceiling: 3.2, water: 2, vent: true, heat: true, x: 37, y: 47 },
    { id: "office-tverskaya", lat: 55.7652, lng: 37.6058, pic: "pic-o-premium", type: "office", title: "Офис на Тверской, 21", price: 280000, unit: "мес", area: 85, people: 14, metro: "Пушкинская", district: "ЦАО", metroMin: 2, highwayKm: 1.2, power: 20, ceiling: 3.4, water: 1, vent: true, heat: true, x: 48, y: 45 },
    { id: "office-chistye", lat: 55.7642, lng: 37.6402, pic: "pic-o-classic", type: "office", title: "Офис у Чистых прудов", price: 150000, unit: "мес", area: 55, people: 10, metro: "Чистые пруды", district: "ЦАО", metroMin: 4, highwayKm: 1.5, power: 15, ceiling: 3, water: 1, vent: true, heat: true, x: 54, y: 46 },
    { id: "office-savelovskaya", lat: 55.793, lng: 37.5862, pic: "pic-o-green", type: "office", title: "Офис в БЦ класса B", price: 120000, unit: "мес", area: 70, people: 12, metro: "Савёловская", district: "САО", metroMin: 6, highwayKm: 0.8, power: 15, ceiling: 3, water: 1, vent: true, heat: true, x: 48, y: 36 },
    { id: "office-chkalovskaya", lat: 55.757, lng: 37.6615, pic: "pic-o-small", type: "office", title: "Офис на 10–15 человек у Курского вокзала", price: 190000, unit: "мес", area: 75, people: 15, metro: "Чкаловская", district: "ЦАО", metroMin: 2, highwayKm: 0.6, power: 20, ceiling: 3.1, water: 1, vent: true, heat: true, x: 58, y: 49 },
    { id: "coworking", lat: 55.7768, lng: 37.5845, type: "coworking", title: "Рабочее место в коворкинге", price: 18000, unit: "мес", area: 6, people: 1, metro: "Белорусская", district: "ЦАО", metroMin: 5, highwayKm: 0.3, power: 1, ceiling: 3.2, water: 0, vent: true, heat: true, x: 44, y: 41 },
    { id: "hall-12", lat: 55.7548, lng: 37.6572, pic: "pic-h-small", type: "hall", title: "Переговорная на 12 человек", price: 2500, unit: "час", area: 30, people: 12, metro: "Чкаловская", district: "ЦАО", metroMin: 3, highwayKm: 0.6, power: 5, ceiling: 3, water: 0, vent: true, heat: true, x: 59, y: 50 },
    { id: "hall-40", lat: 55.7305, lng: 37.6385, pic: "pic-h-big", type: "hall", title: "Конференц-зал на 40 человек", price: 6000, unit: "час", area: 90, people: 40, metro: "Павелецкая", district: "ЦАО", metroMin: 4, highwayKm: 0.4, power: 10, ceiling: 4, water: 1, vent: true, heat: true, x: 54, y: 56 },
    { id: "warehouse-a", lat: 55.634, lng: 37.66, pic: "pic-w-a", type: "warehouse", title: "Склад класса A, 1200 м²", price: 900000, unit: "мес", area: 1200, people: 0, metro: "Кантемировская", district: "ЮАО", metroMin: 15, highwayKm: 1, power: 150, ceiling: 12, water: 2, vent: true, heat: true, x: 53, y: 75 },
    { id: "warehouse-b", lat: 55.7565, lng: 37.755, pic: "pic-w-b", type: "warehouse", title: "Склад класса B, 400 м²", price: 260000, unit: "мес", area: 400, people: 0, metro: "Шоссе Энтузиастов", district: "ВАО", metroMin: 10, highwayKm: 0.5, power: 60, ceiling: 8, water: 1, vent: true, heat: false, x: 70, y: 49 },
    { id: "warehouse-c", lat: 55.8885, lng: 37.664, pic: "pic-w-c", type: "warehouse", title: "Склад класса C, 250 м²", price: 110000, unit: "мес", area: 250, people: 0, metro: "Медведково", district: "СВАО", metroMin: 12, highwayKm: 0.7, power: 30, ceiling: 6, water: 0, vent: false, heat: false, x: 60, y: 18 },
    { id: "shop-arbat", lat: 55.7505, lng: 37.596, pic: "pic-s-arbat", type: "shop", title: "Торговое помещение на Арбате", price: 450000, unit: "мес", area: 90, people: 0, metro: "Арбатская", district: "ЦАО", metroMin: 3, highwayKm: 1, power: 25, ceiling: 3.6, water: 1, vent: true, heat: true, x: 46, y: 49 },
    { id: "shop-sokol", lat: 55.8058, lng: 37.516, pic: "pic-s-street", type: "shop", title: "Стрит-ритейл у метро Сокол", price: 210000, unit: "мес", area: 65, people: 0, metro: "Сокол", district: "САО", metroMin: 1, highwayKm: 0.2, power: 15, ceiling: 3.3, water: 1, vent: true, heat: true, x: 39, y: 33 },
    { id: "shop-cheremushki", lat: 55.6705, lng: 37.556, pic: "pic-s-mall", type: "shop", title: "Помещение в ТЦ, 60 м²", price: 140000, unit: "мес", area: 60, people: 0, metro: "Новые Черёмушки", district: "ЮЗАО", metroMin: 5, highwayKm: 1.3, power: 15, ceiling: 3.5, water: 1, vent: true, heat: true, x: 41, y: 66 },
    { id: "catering-novoslob", lat: 55.7805, lng: 37.6025, pic: "pic-cafe", type: "catering", title: "Помещение под кафе, 110 м²", price: 320000, unit: "мес", area: 110, people: 0, metro: "Новослободская", district: "ЦАО", metroMin: 2, highwayKm: 0.9, power: 40, ceiling: 3.8, water: 2, vent: true, heat: true, x: 47, y: 40 },
    { id: "production-tekst", lat: 55.708, lng: 37.734, pic: "pic-w-open", type: "production", title: "Производственное помещение, 600 м²", price: 380000, unit: "мес", area: 600, people: 0, metro: "Текстильщики", district: "ЮВАО", metroMin: 9, highwayKm: 0.6, power: 200, ceiling: 6, water: 2, vent: true, heat: true, x: 66, y: 63 },
    { id: "office-krylatskoe", lat: 55.758, lng: 37.406, pic: "pic-o-park", type: "office", title: "Офис в бизнес-парке, 140 м²", price: 210000, unit: "мес", area: 140, people: 25, metro: "Крылатское", district: "ЗАО", metroMin: 8, highwayKm: 1.1, power: 35, ceiling: 3.2, water: 1, vent: true, heat: true, x: 24, y: 52 },
    { id: "warehouse-szao", lat: 55.862, lng: 37.433, pic: "pic-w-cold", type: "warehouse", title: "Склад с рампой, 700 м²", price: 420000, unit: "мес", area: 700, people: 0, metro: "Планерная", district: "СЗАО", metroMin: 14, highwayKm: 0.4, power: 80, ceiling: 9, water: 1, vent: true, heat: true, x: 28, y: 26 }
  ];

  var PLANS = {
    basic: { name: "Базовый", price: 499, period: "1 месяц", months: 1 },
    optimal: { name: "Оптимальный", price: 2490, period: "6 месяцев", months: 6 },
    premium: { name: "Премиум", price: 4990, period: "12 месяцев", months: 12 }
  };

  // ---------- утилиты ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(n) { return n.toLocaleString("ru-RU") + " ₽"; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function param(name) { return new URLSearchParams(location.search).get(name); }
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, "е"); }

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("ms_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("ms_" + k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem("ms_" + k); } catch (e) {} }
  };
  function user() { return store.get("user", null); }
  function activePlan() {
    var p = store.get("plan", null);
    if (!p) return null;
    if (new Date(p.until) < new Date()) return null;
    return p;
  }

  function toast(text) {
    var t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  // ---------- шапка ----------
  function initHeader() {
    var burger = $(".burger"), nav = $(".main-nav");
    if (burger && nav) burger.addEventListener("click", function () {
      nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", nav.classList.contains("open"));
    });
    var page = location.pathname.split("/").pop() || "index.html";
    $$(".main-nav a").forEach(function (a) { if (a.getAttribute("href") === page) a.classList.add("active"); });
    var u = user(), acc = $(".account-link");
    if (acc && u) {
      var parts = u.name.split(" ");
      acc.textContent = parts[1] || parts[0] || "Кабинет";
      acc.href = "account.html";
      acc.classList.add("logged");
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
  function initMasks() {
    $$("[data-mask=card]").forEach(function (el) {
      el.addEventListener("input", function () {
        el.value = el.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
      });
    });
    $$("[data-mask=expiry]").forEach(function (el) {
      el.addEventListener("input", function () {
        var d = el.value.replace(/\D/g, "").slice(0, 4);
        el.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
      });
    });
    $$("[data-mask=cvc]").forEach(function (el) {
      el.addEventListener("input", function () { el.value = el.value.replace(/\D/g, "").slice(0, 3); });
    });
    $$("[data-mask=phone]").forEach(function (el) {
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
    $$(".input").forEach(function (el) {
      el.addEventListener("input", function () { el.classList.remove("invalid"); });
    });
    // при входе подставляем данные пользователя
    var u = user();
    if (u) {
      $$("[data-fill]").forEach(function (el) { if (!el.value && u[el.dataset.fill]) el.value = u[el.dataset.fill]; });
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
    var list = store.get("bookings", []);
    b.created = new Date().toISOString();
    list.unshift(b);
    store.set("bookings", list.slice(0, 30));
  }
  function addMonths(n) { var d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString(); }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }

  // ---------- формы ----------
  var handlers = {
    // регистрация (страница «Регистрация» и блок «Доп. возможности» на главной)
    register: function (form) {
      var u = { name: form.fio.value.trim(), email: form.email.value.trim(), phone: "+7 " + form.phone.value.trim(), since: new Date().toISOString() };
      store.set("user", u);
      var next = param("next");
      if (next && /^[a-z-]+\.html(\?[\w=&-]*)?$/.test(next)) { location.href = next; return; }
      initHeader();
      showSuccess(form, "<h3>Готово, " + esc(u.name.split(" ")[1] || u.name) + "!</h3><p>Аккаунт создан. Теперь вам доступны расширенные фильтры поиска (мощность, высота потолков, коммуникации) и личный кабинет.</p><div class='btn-row' style='justify-content:center'><a class='btn black' href='index.html#search'>К поиску</a><a class='btn outline' href='account.html'>Личный кабинет</a></div>");
      unlockAdvanced();
    },

    // заявка на ипотеку
    mortgage: function (form) {
      var c = window.MS_mortgage || {};
      addBooking({ kind: "Заявка на ипотеку", title: c.price ? "квартира за " + money(c.price) : "консультация", note: c.payment ? "кредит " + money(c.loan) + " на " + c.years + " лет под " + c.rate + "%, платёж ≈ " + money(c.payment) + "/мес" : "" });
      showSuccess(form, "<h3>Заявка отправлена</h3><p>Менеджер позвонит по номеру +7 " + esc(form.phone.value) + " и расскажет, какие банки готовы одобрить ипотеку." + (c.payment ? "<br>Ваш расчёт: платёж ≈ <b>" + money(c.payment) + "</b> в месяц." : "") + "</p>");
    },

    // заявка на трейд-ин
    tradein: function (form) {
      var c = window.MS_tradein || {};
      addBooking({ kind: "Заявка на трейд-ин", title: c.rooms + ", " + c.area + " м², " + c.district, note: "предварительная оценка " + money(c.value) + ", новая квартира " + money(c.target) });
      showSuccess(form, "<h3>Заявка принята</h3><p>Оценщик свяжется с вами по номеру +7 " + esc(form.phone.value) + " и договорится о выезде.<br>Предварительная оценка вашей квартиры: <b>" + money(c.value) + "</b>.</p>");
    },

    // бронирование зала
    hall: function (form) {
      var slot = $(".slot.picked", form);
      var b = { kind: "Зал для встреч", title: form.hall.options[form.hall.selectedIndex].text, date: form.date.value, time: slot ? slot.textContent : "время уточнит менеджер", name: form.name.value.trim(), phone: "+7 " + form.phone.value.trim(), email: form.email.value.trim() };
      addBooking(b);
      showSuccess(form, "<h3>Заявка принята</h3><p>" + esc(b.title) + "<br>" + new Date(b.date).toLocaleDateString("ru-RU") + ", " + esc(b.time) + "</p><p class='small'>Менеджер свяжется с вами по номеру " + esc(b.phone) + " для подтверждения.</p>");
    },

    // шаг 1 бронирования помещения — контакты
    contacts: function (form) {
      var pay = $("#pay-form");
      store.set("contact", { name: form.name.value.trim(), phone: "+7 " + form.phone.value.trim(), email: form.email.value.trim() });
      form.querySelector("button[type=submit]").disabled = true;
      $(".step-done", form.parentNode).classList.remove("hidden");
      pay.closest("section").classList.remove("hidden");
      pay.closest("section").scrollIntoView({ behavior: "smooth" });
    },

    // шаг 2 бронирования помещения — оплата (демо)
    bookpay: function (form) {
      var item = currentItem(), months = +($("#term") ? $("#term").value : 1), c = store.get("contact", {});
      var sum = bookingSum(item, months);
      clearCard(form);
      addBooking({ kind: TYPES[item.type], title: item.title, months: months, sum: sum, name: c.name, phone: c.phone, email: c.email });
      showSuccess(form, "<h3>Оплата прошла успешно</h3><p>Помещение «" + esc(item.title) + "» забронировано на " + months + " мес.<br>Сумма первого платежа: <b>" + money(sum.first) + "</b></p><p class='small'>Договор и счёт придут на " + esc(c.email || "вашу почту") + ".</p><a class='btn black' href='account.html'>Мои бронирования</a>");
    },

    // оплата подписки (демо)
    plan: function (form) {
      var key = PLANS[param("plan")] ? param("plan") : "optimal", p = PLANS[key];
      clearCard(form);
      store.set("plan", { key: key, name: p.name, price: p.price, until: addMonths(p.months), paid: new Date().toISOString() });
      showSuccess(form, "<h3>Подписка «" + p.name + "» активна</h3><p>Оплачено " + money(p.price) + ". Действует до " + fmtDate(addMonths(p.months)) + ".</p><a class='btn black' href='account.html'>Личный кабинет</a>");
      initHeader();
    }
  };

  function initForms() {
    $$("form[data-form]").forEach(function (form) {
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
    });
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
        var busy = ((seed + h * 7) % 5) === 0 || ((seed + h) % 7) === 0;
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
  function currentItem() {
    var id = param("item");
    for (var i = 0; i < LISTINGS.length; i++) if (LISTINGS[i].id === id) return LISTINGS[i];
    return LISTINGS[0];
  }
  function bookingSum(item, months) {
    var disc = item.type === "coworking" && months >= 3 ? 0.2 : 0;
    var monthly = Math.round(item.price * (1 - disc));
    return { monthly: monthly, first: monthly, disc: disc, total: monthly * months };
  }
  function initBooking() {
    var box = $("#booking-item");
    if (!box) return;
    var item = currentItem();
    if (item.unit === "час") { location.replace("halls.html#book"); return; }
    var term = $("#term");
    function upd() {
      var m = +term.value, s = bookingSum(item, m);
      box.innerHTML = "<div class='listing'><div class='pic " + (item.pic || TYPE_PICS[item.type]) + "'><span class='tag'>" + TYPES[item.type] + "</span></div><div class='body'><h4>" + esc(item.title) + "</h4><div class='meta'>м. " + item.metro + " · " + item.district + " · " + item.area + " м²</div><div class='price'>" + money(s.monthly) + " / мес" + (s.disc ? " <span class='small' style='color:#5a9a3c'>−20%</span>" : "") + "</div></div></div>";
      $$(".pay-sum").forEach(function (el) { el.textContent = money(s.first); });
      var hint = $("#term-hint");
      if (hint) hint.textContent = item.type === "coworking" ? (m >= 3 ? "Скидка 20% применена" : "При аренде от 3 месяцев — скидка 20%") : "Итого за срок: " + money(s.total);
    }
    term.addEventListener("change", upd);
    if (item.type === "coworking" && !param("term")) term.value = "3";
    if (param("term")) term.value = param("term");
    upd();
  }

  // ---------- страница оплаты подписки ----------
  function initPlanPage() {
    var el = $("#plan-info");
    if (!el) return;
    var key = PLANS[param("plan")] ? param("plan") : "optimal", p = PLANS[key];
    $("#plan-title").textContent = key === "optimal" ? "Оплата подписки" : "Оформите подписку";
    el.innerHTML = "Доступ к тарифу «" + p.name + "» на " + p.period + ".<br>Цена — " + money(p.price);
    $$(".pay-sum").forEach(function (s) { s.textContent = money(p.price); });
    $$("[data-plan-switch]").forEach(function (a) { if (a.dataset.planSwitch === key) a.classList.add("hidden"); });
    if (!user()) {
      $("#need-login").classList.remove("hidden");
      $("#need-login a").href = "register.html?next=" + encodeURIComponent("pay.html?plan=" + key);
    }
  }
  function initPlans() {
    var p = activePlan();
    if (!p) return;
    $$(".plan[data-plan]").forEach(function (el) {
      if (el.dataset.plan === p.key) {
        el.classList.add("current");
        var b = $(".btn", el); b.textContent = "Ваш тариф до " + new Date(p.until).toLocaleDateString("ru-RU");
      }
    });
  }

  // ---------- личный кабинет ----------
  function initAccount() {
    var box = $("#account");
    if (!box) return;
    var u = user();
    if (!u) { $("#account-guest").classList.remove("hidden"); box.classList.add("hidden"); return; }
    $("#acc-name").textContent = u.name;
    $("#acc-email").textContent = u.email;
    $("#acc-phone").textContent = u.phone;
    $("#acc-since").textContent = fmtDate(u.since);
    var p = activePlan();
    $("#acc-plan").innerHTML = p ? "«" + esc(p.name) + "» до " + fmtDate(p.until) : "нет — <a href='subscriptions.html'>выбрать тариф</a>";
    var list = store.get("bookings", []);
    $("#acc-bookings").innerHTML = list.length ? list.map(function (b) {
      return "<div class='card soft' style='margin-bottom:12px'><b>" + esc(b.kind) + ":</b> " + esc(b.title) + "<div class='small muted'>" +
        (b.note != null ? esc(b.note) : b.date ? new Date(b.date).toLocaleDateString("ru-RU") + ", " + esc(b.time) : "срок " + b.months + " мес., первый платёж " + money(b.sum.first)) +
        " · оформлено " + new Date(b.created).toLocaleDateString("ru-RU") + "</div></div>";
    }).join("") : "<p class='muted'>Бронирований и заявок пока нет. <a href='offers.html'>Посмотреть спецпредложения</a></p>";
    $("#logout").addEventListener("click", function () {
      store.del("user"); store.del("plan"); store.del("bookings"); store.del("contact");
      location.href = "index.html";
    });
  }

  // ---------- поиск ----------
  function listingCard(l) {
    var price = money(l.price) + " / " + l.unit;
    var href = l.unit === "час" ? "halls.html#book" : "booking.html?item=" + l.id;
    return "<div class='listing' data-id='" + l.id + "'><div class='pic " + (l.pic || TYPE_PICS[l.type]) + "'><span class='tag'>" + TYPES[l.type] + "</span></div><div class='body'><h4>" + esc(l.title) + "</h4><div class='price'>" + price + "</div><div class='meta'>м. " + l.metro + " (" + l.metroMin + " мин пешком) · " + l.district + "</div><div class='meta'>" + l.area + " м² · " + l.power + " кВт · потолки " + l.ceiling + " м" + (l.people ? " · до " + l.people + " чел." : "") + "</div><a class='btn black' href='" + href + "'>Забронировать</a></div></div>";
  }
  function unlockAdvanced() {
    var adv = $("#adv-filters");
    if (!adv) return;
    adv.classList.remove("locked");
    var msg = $(".lock-msg", adv);
    if (msg) msg.remove();
  }
  function initSearch() {
    var form = $("#search-form");
    if (!form) return;
    if (user()) unlockAdvanced();
    function num(el) { var v = parseFloat(String(el.value).replace(/\s/g, "")); return isNaN(v) ? null : v; }
    function fmt(n) { return n.toLocaleString("ru-RU"); }

    // Каждый фильтр — отдельная проверка. Варианты в любом фильтре считаются по объектам,
    // которые проходят все ОСТАЛЬНЫЕ фильтры: выбрали «Офис» — в списке метро только станции с офисами.
    function current() {
      var f = {
        type: form.type.value, price: num(form.price), areaMin: num(form.areaMin), areaMax: num(form.areaMax),
        metro: form.metro.value, district: form.district.value, metroMin: num(form.metroMin), highway: num(form.highway)
      };
      if (user()) { f.power = num(form.power); f.ceiling = num(form.ceiling); f.water = num(form.water); f.vent = form.vent.checked; f.heat = form.heat.checked; }
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

  // ---------- ипотечный калькулятор ----------
  function annuity(loan, ratePct, years) {
    var n = years * 12, r = ratePct / 100 / 12;
    return r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
  }
  function initMortgage() {
    var form = $("#mortgage-calc");
    if (!form) return;
    var p = +param("price"), d = param("down");
    if (p > 0) form.price.value = Math.round(p);
    if (d != null && +d >= 0) form.down.value = Math.round(+d);
    function calc() {
      var price = +form.price.value, down = +form.down.value, years = +form.years.value, rate = +form.rate.value;
      $("#m-years-val").textContent = years;
      var err = "";
      if (!(price > 0)) err = "Укажите стоимость квартиры";
      else if (down < 0 || down >= price) err = "Первоначальный взнос должен быть меньше стоимости квартиры";
      else if (!(rate > 0)) err = "Укажите ставку";
      $("#m-error").textContent = err;
      $("#m-down-pct").textContent = price > 0 ? Math.round(down / price * 100) + "% от стоимости" + (down / price < 0.2 ? " — многие банки просят от 20%" : "") : "";
      if (err) { ["#m-payment", "#m-loan", "#m-over", "#m-total", "#m-income"].forEach(function (id) { $(id).textContent = "—"; }); window.MS_mortgage = null; return; }
      var loan = price - down, pay = Math.round(annuity(loan, rate, years)), total = pay * years * 12;
      $("#m-payment").textContent = money(pay);
      $("#m-loan").textContent = money(loan);
      $("#m-over").textContent = money(total - loan);
      $("#m-total").textContent = money(total);
      $("#m-income").textContent = "от " + money(Math.ceil(pay * 2 / 1000) * 1000) + " в месяц";
      window.MS_mortgage = { price: price, loan: loan, years: years, rate: rate, payment: pay };
    }
    form.addEventListener("input", calc);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    $("#m-programs").addEventListener("click", function (e) {
      var b = e.target.closest(".chip");
      if (!b) return;
      $$(".chip", this).forEach(function (x) { x.classList.toggle("active", x === b); });
      form.rate.value = b.dataset.rate;
      calc();
    });
    form.rate.addEventListener("input", function () { $$("#m-programs .chip").forEach(function (x) { x.classList.toggle("active", x.dataset.rate === form.rate.value); }); });
    calc();
  }

  // ---------- трейд-ин ----------
  // примерные средние цены за м² вторичного жилья по округам (для демонстрации)
  var M2 = { "ЦАО": 600000, "ЗАО": 380000, "ЮЗАО": 370000, "СЗАО": 340000, "САО": 340000, "СВАО": 310000, "ЮАО": 300000, "ВАО": 290000, "ЮВАО": 270000, "НАО": 220000 };
  var ROOMS = ["Студия", "1-комнатная", "2-комнатная", "3-комнатная", "4+ комнатная"];
  function initTradein() {
    var form = $("#tradein-calc");
    if (!form) return;
    function calc() {
      var area = +form.area.value, target = +form.target.value;
      var m2 = Math.round(M2[form.district.value] * +form.cond.value * +form.age.value / 1000) * 1000;
      var value = area > 0 ? Math.round(m2 * area / 10000) * 10000 : 0;
      var diff = target - value;
      $("#t-m2").textContent = money(m2);
      $("#t-value").textContent = value ? money(value) : "—";
      $("#t-new").textContent = target > 0 ? money(target) : "—";
      $("#t-diff-label").textContent = diff >= 0 ? "Доплата" : "Вы получите разницу";
      $("#t-diff").textContent = target > 0 && value ? money(Math.abs(diff)) : "—";
      var link = $("#t-mortgage");
      link.classList.toggle("hidden", !(diff > 0 && value));
      link.href = "mortgage.html?price=" + target + "&down=" + value + "#calc";
      window.MS_tradein = { district: form.district.value, rooms: ROOMS[+form.rooms.value], area: area, value: value, target: target };
    }
    form.addEventListener("input", calc);
    form.addEventListener("change", calc);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    calc();
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
      var href = l.unit === "час" ? "halls.html#book" : "booking.html?item=" + l.id;
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
      crit.push("от " + n + " чел.");
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
        res.sort(function (a, b) { return Math.hypot(a.x - ref.x, a.y - ref.y) - Math.hypot(b.x - ref.x, b.y - ref.y); });
      }
      crit.push("рядом с м. " + metroHit);
    }
    DISTRICTS.forEach(function (d) {
      if (new RegExp("(^|[^а-я])" + norm(d) + "([^а-я]|$)").test(t)) { res = res.filter(function (l) { return l.district === d; }); crit.push(d); }
    });
    if (/центр/.test(t)) { res = res.filter(function (l) { return l.district === "ЦАО"; }); crit.push("в центре"); }

    var when = t.match(/(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресень[ея]|завтра|сегодня)/);
    if (!crit.length) {
      return { text: "Пока не понял, что именно ищем. Напишите тип помещения (офис, склад, магазин, переговорная, коворкинг), количество человек или площадь, бюджет и метро — например: «Склад от 300 м² до 400 тыс. в ВАО».", items: [] };
    }
    var top = res.slice(0, 3);
    if (!top.length) return { text: "По запросу (" + crit.join(", ") + ") свободных помещений нет. Попробуйте увеличить бюджет или убрать часть условий.", items: [] };
    var txt = "Подобрал варианты: " + crit.join(", ") + "." + (when ? " Бронь на «" + when[1] + "» можно оформить по кнопке на карточке." : "") + " Нажмите на вариант, чтобы увидеть его на карте:";
    return { text: txt, items: top };
  }
  function initAssistant() {
    var form = $("#chat-form");
    if (!form) return;
    var chat = $("#chat");
    function add(cls, html) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = html;
      chat.appendChild(d);
      chat.scrollTop = chat.scrollHeight;
      return d;
    }
    function ask(q) {
      q = q.trim();
      if (!q) return;
      add("user", esc(q));
      var wait = add("bot", "Подбираю варианты…");
      setTimeout(function () {
        var a = assistantAnswer(q);
        wait.innerHTML = esc(a.text) + a.items.map(function (l) {
          return "<a class='res' data-id='" + l.id + "'><b>" + esc(l.title) + "</b><br>" + money(l.price) + " / " + l.unit + " · м. " + l.metro + " · " + l.area + " м²</a>";
        }).join("");
        chat.scrollTop = chat.scrollHeight;
        if (a.items[0] && window.MS_showOnMap) window.MS_showOnMap(a.items[0].id);
      }, 700);
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); ask(form.q.value); form.q.value = ""; });
    chat.addEventListener("click", function (e) {
      var r = e.target.closest(".res");
      if (r && window.MS_showOnMap) { window.MS_showOnMap(r.dataset.id); if (innerWidth < 900) $("#map-box").scrollIntoView({ behavior: "smooth" }); }
    });
    $$(".chip").forEach(function (c) { c.addEventListener("click", function () { ask(c.textContent); }); });
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

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initMasks();
    initForms();
    initSlots();
    initBooking();
    initPlanPage();
    initPlans();
    initAccount();
    initSearch();
    initMortgage();
    initTradein();
    initMap();
    initAssistant();
    initSliders();
    initAccordions();
  });
})();
