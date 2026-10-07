/* TradeHush loader. Handles sign-in and the access check only. The app itself sits on the site encrypted;
   the server hands out the decryption key (and the user's watermark) only to members with active access,
   so without a subscription there is nothing readable to copy. */
(() => {
  const CFG = window.SB_CONFIG || {};
  const LANG = document.documentElement.lang === "en" ? "en" : "ru";
  const APP_FILE = "app.6103304f87.bin", WM0 = "wm00000000000000000000000000000000";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const trSrv = t => { for (const [a, b] of Object.entries(window.__SRV || {})) t = t.split(a).join(b); return t; };
  const errText = e => trSrv(String(e?.message || e?.error_description || e || "ошибка").replace(/^.*?ERROR:\s*/, ""));
  const sb = window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY
    ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  // the install prompt can fire before the app is loaded; keep it for the app's "Install on desktop"
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); window.__installPrompt = e; });

  function setLang(l) {
    try { localStorage.setItem("setup-book.lang", l); } catch {}
    if (l !== LANG) location.replace((l === "en" ? "en" : "./") + location.hash);
  }
  async function fn(name, body, jwt) {
    const r = await fetch(`${CFG.SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, ...(jwt ? { Authorization: "Bearer " + jwt } : {}) }, body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "Сервер не ответил"), { data: j });
    return j;
  }

  function gate(mode, msg = "") {
    const g = $("#gate"); if (!g) return;
    document.body.classList.add("gated");
    const T = {
      wait: ["Подключаюсь…", ""],
      config: ["Сайт ещё не настроен", "Заполните файл config.js: адрес Supabase, публичный ключ и имя Telegram-бота."],
      login: ["TradeHush", "Сервис для трейдеров: риск-менеджмент, дисциплина и статистика. Войдите через Telegram — первые 30 дней бесплатно."],
      key: ["Введите ключ доступа", "Ключ выдаёт администратор. Он одноразовый: после ввода работает только для вашего аккаунта, срок отсчитывается с момента активации."],
      pay: [ACC?.trial ? "Пробный период закончился" : ACC?.had_access ? "Подписка закончилась" : "Оформите подписку", "Ваши стратегии, сделки и настройки сохранены — после оплаты всё откроется на том же месте."],
      blocked: ["Доступ закрыт", "Администратор закрыл вам доступ. Если это ошибка — напишите ему."],
    };
    const [h, p] = T[mode];
    g.innerHTML = `<div class="gate-box" role="dialog" aria-modal="true" aria-labelledby="gate-h">
      <div class="gate-mark" aria-hidden="true">${mode === "blocked" ? "✕" : "◆"}</div>
      <h2 id="gate-h">${h}</h2>${p ? `<p>${p}</p>` : ""}
      ${mode === "login" ? `<div class="tg-bot"><a class="btn primary tg-btn" id="tg-go" target="_blank" rel="noopener">Получить код в Telegram</a>
        <div class="tg-wait" id="tg-wait" hidden><p>Откроется бот <b>@${esc(CFG.TELEGRAM_BOT || "")}</b>. Нажмите в нём «Старт» — бот пришлёт 6-значный код.</p>
        <div class="otp" id="otp" data-st="wait" role="group" aria-label="Код из Telegram">${[0, 1, 2, 3, 4, 5].map(i => `<input class="otp-d" inputmode="numeric" pattern="[0-9]*" autocomplete="${i ? "off" : "one-time-code"}" aria-label="Цифра ${i + 1}">`).join("")}<span class="otp-bar" aria-hidden="true"></span></div>
        <p class="hint tg-state" id="tg-state" aria-live="polite">Ждём код из Telegram…</p></div>
        <button type="button" class="linklike tg-alt" id="tg-alt">Другой способ входа</button><div id="tg-login" class="tg-login" hidden></div></div>` : ""}
      ${mode === "pay" ? `<div class="pay-plans" id="pay-plans" aria-busy="true">${[0, 1, 2].map(() => `<div class="pay-card sk"></div>`).join("")}</div>
        <p class="pay-note" id="pay-note">Оплата в USDT или TON через @CryptoBot прямо в Telegram. Доступ откроется сам через несколько секунд после оплаты.</p>
        <button type="button" class="linklike tg-alt" id="pay-key">У меня есть ключ доступа</button>` : ""}
      ${mode === "key" ? `<form id="key-gate" autocomplete="off"><label class="fld"><span>Ключ</span><input class="in key-in" id="g-key" placeholder="SB-XXXX-XXXX-XXXX-XXXX" spellcheck="false" autocapitalize="characters" required></label>
        <button class="btn primary" type="submit">Активировать</button></form>${ACC && !ACC.has_access ? `<button type="button" class="linklike tg-alt" id="pay-back">← Тарифы и оплата</button>` : ""}` : ""}
      <p class="gate-msg" id="gate-msg" role="alert">${esc(msg)}</p>
      ${mode === "wait" ? "" : `<div class="gate-lang" role="group" aria-label="Language">${["ru", "en"].map(l => `<button type="button" data-lang="${l}" aria-pressed="${LANG === l}">${l.toUpperCase()}</button>`).join("")}</div>`}
      ${mode === "key" || mode === "blocked" || mode === "pay" ? `<button class="btn ghost small" type="button" id="gate-logout">Выйти из аккаунта</button>` : ""}
    </div>`;
    g.hidden = false;
    $("#gate-logout")?.addEventListener("click", async () => { try { await sb.auth.signOut(); } catch {} location.reload(); });
    g.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
    if (mode === "login") {
      if (!CFG.TELEGRAM_BOT) { $("#gate-msg").textContent = "Не указано имя бота в config.js."; return; }
      botLogin();
      $("#tg-alt").onclick = () => {
        $("#tg-alt").hidden = true; $("#tg-login").hidden = false;
        const s = document.createElement("script");
        s.async = true; s.src = "https://telegram.org/js/telegram-widget.js?22";
        s.setAttribute("data-telegram-login", CFG.TELEGRAM_BOT);
        s.setAttribute("data-lang", LANG); s.setAttribute("data-size", "large"); s.setAttribute("data-radius", "10");
        s.setAttribute("data-auth-url", location.origin + location.pathname); // redirect mode: no eval, the strict CSP holds
        s.setAttribute("data-request-access", "write");
        $("#tg-login").append(s);
      };
    }
    if (mode === "pay") payGate();
    $("#pay-back")?.addEventListener("click", () => gate("pay"));
    if (mode === "key") {
      $("#g-key").focus();
      $("#key-gate").addEventListener("submit", async e => {
        e.preventDefault();
        const btn = e.target.querySelector("button"), out = $("#gate-msg");
        btn.disabled = true; out.textContent = "Проверяю ключ…";
        const { error } = await sb.rpc("redeem_key", { p_code: $("#g-key").value });
        if (error) { out.textContent = errText(error); btn.disabled = false; return; }
        start();
      });
    }
  }

  // sign-in through the bot: the bot sends a 6-digit code, the user types it here
  function otpWire(send) {
    const box = $("#otp"); if (!box) return;
    const cells = [...box.querySelectorAll(".otp-d")];
    const value = () => cells.map(c => c.value).join("");
    const fill = (from, digits) => { for (const d of digits) { if (from >= cells.length) break; cells[from].value = d; cells[from].classList.remove("pop"); void cells[from].offsetWidth; cells[from].classList.add("pop"); from++; } return from; };
    const done = () => { if (value().length === 6 && box.dataset.st !== "check" && box.dataset.st !== "ok") send(value()); };
    cells.forEach((c, i) => {
      c.addEventListener("input", () => {
        const d = c.value.replace(/\D/g, ""); c.value = "";
        const next = fill(i, d); (cells[Math.min(next, 5)]).focus(); done();
      });
      c.addEventListener("keydown", e => {
        if (e.key === "Backspace" && !c.value && i) { cells[i - 1].value = ""; cells[i - 1].focus(); e.preventDefault(); }
        else if (e.key === "ArrowLeft" && i) cells[i - 1].focus();
        else if (e.key === "ArrowRight" && i < 5) cells[i + 1].focus();
      });
      c.addEventListener("paste", e => {
        const d = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (!d) return;
        e.preventDefault(); cells.forEach(x => x.value = ""); cells[Math.min(fill(0, d), 5)].focus(); done();
      });
      c.addEventListener("focus", () => c.select());
    });
  }
  async function otpSend(me, code) {
    const box = $("#otp"), state = t => { const el = $("#tg-state"); if (el) el.textContent = t; };
    if (!box || !me?.nonce) return;
    box.dataset.st = "check"; state("Проверяю код…");
    box.querySelectorAll(".otp-d").forEach(c => c.blur());
    let j = {}, err = "";
    try { j = await fn("telegram-auth", { action: "code", nonce: me.nonce, code }); } catch (e) { err = errText(e); j = e.data || {}; }
    if (j.token_hash) {
      const { error } = await sb.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" });
      if (error) { box.dataset.st = "err"; state(errText(error)); return; }
      clearTimeout(me.timer); box.dataset.st = "ok"; state("Готово — вход выполнен");
      return setTimeout(start, 900);
    }
    box.dataset.st = "err"; state(err || "Неверный код");
    setTimeout(() => {
      if (me !== L || box.dataset.st !== "err") return;
      if (j.expired) { const m = $("#gate-msg"); if (m) m.textContent = (err || "Код устарел") + "."; return botLogin(); }
      box.dataset.st = "sent"; state("Введите код ещё раз"); box.querySelectorAll(".otp-d").forEach(c => c.value = ""); box.querySelector(".otp-d").focus();
    }, 700);
  }
  let L = null;
  async function botLogin() {
    const go = $("#tg-go"); if (!go) return;
    if (L) clearTimeout(L.timer);
    const me = L = { nonce: null, timer: 0, started: false, until: 0 };
    go.removeAttribute("href"); go.classList.add("loading"); go.textContent = "Получить код в Telegram"; const w = $("#tg-wait"); if (w) { w.hidden = true; w.outerHTML = w.outerHTML.replace(/data-st="\w+"/, 'data-st="wait"'); }
    try {
      const j = await fn("telegram-auth", { action: "init" });
      if (me !== L) return;
      me.nonce = j.nonce; me.until = Date.now() + (j.ttl || 600000) - 15000;
      go.href = `https://t.me/${CFG.TELEGRAM_BOT}?start=${j.nonce}`;
    } catch (e) {
      const m = $("#gate-msg"); if (m) m.textContent = errText(e) + " — воспользуйтесь другим способом входа ниже.";
      return;
    } finally { go.classList.remove("loading"); }
    go.onclick = () => {
      $("#tg-wait").hidden = false; go.textContent = "Открыть бота ещё раз";
      if (!me.started) { me.started = true; me.timer = setTimeout(poll, 1500); otpWire(code => otpSend(me, code)); }
    };
  }
  async function poll() {
    const me = L; if (!me?.nonce || !$("#tg-go")) return;
    const state = t => { const el = $("#tg-state"); if (el) el.textContent = t; }, msg = t => { const el = $("#gate-msg"); if (el) el.textContent = t; };
    if (Date.now() > me.until) { msg("Время входа истекло — нажмите кнопку ещё раз."); return botLogin(); }
    let j = {}; try { j = await fn("telegram-auth", { action: "poll", nonce: me.nonce }); } catch {}
    if (me !== L) return;
    if (j.denied) { msg("Слишком много попыток — получите новый код."); return botLogin(); }
    if (j.expired) { msg("Время входа истекло — нажмите кнопку ещё раз."); return botLogin(); }
    if (j.opened) {
      const box = $("#otp");
      if (box?.dataset.st === "wait") { box.dataset.st = "sent"; state("Код отправлен в Telegram — введите его"); if (!document.activeElement?.classList.contains("otp-d")) box.querySelector(".otp-d")?.focus({ preventScroll: true }); }
    }
    me.timer = setTimeout(poll, document.hidden ? 4000 : j.opened ? 6000 : 2000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && L?.started && $("#tg-go")) { clearTimeout(L.timer); poll(); } });
  // the fallback widget redirects back with signed user data in the query string
  async function widgetAuth(user) {
    gate("wait");
    try {
      const j = await fn("telegram-auth", user);
      if (!j.token_hash) throw new Error("Сервер не подтвердил вход");
      const { error } = await sb.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" });
      if (error) throw error;
      return start();
    } catch (e) { gate("login", errText(e)); }
  }

  // subscription: plans come from the server, the invoice opens in @CryptoBot, access is checked until it opens
  let ACC = null, payTimer = 0;
  async function payGate() {
    const box = $("#pay-plans"), note = $("#pay-note"), out = $("#gate-msg");
    $("#pay-key").onclick = () => gate("key");
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return gate("login");
    let pl;
    try { pl = await fn("billing", { action: "plans" }, session.access_token); }
    catch (e) { box.innerHTML = ""; out.textContent = errText(e); return; }
    const per = p => p.days >= 60 ? ` · $${(p.price / (p.days / 30)).toFixed(2).replace(/\.00$/, "")}/мес` : "";
    box.removeAttribute("aria-busy");
    box.innerHTML = pl.plans.map((p, i) => `<button type="button" class="pay-card${p.id === "year" ? " best" : ""}" data-plan="${esc(p.id)}" style="--d:${i * 70}ms">
      ${p.id === "year" ? `<span class="pay-badge">Выгоднее всего</span>` : ""}
      <span class="pay-name">${esc(LANG === "en" ? p.name_en : p.name)}</span>
      <span class="pay-price">$${p.price}${p.price < p.full ? ` <s>$${p.full}</s>` : ""}</span>
      <span class="pay-sub">${p.days} дней${per(p)}</span></button>`).join("");
    if (pl.founder) note.insertAdjacentHTML("beforebegin", `<p class="pay-founder">🔥 Цена основателя${pl.left ? ` — для первых 20, осталось мест: ${pl.left}` : " — закреплена за вами"}. Сохраняется при продлении.</p>`);
    box.addEventListener("click", async e => {
      const b = e.target.closest("[data-plan]"); if (!b || box.classList.contains("busy")) return;
      box.classList.add("busy"); b.classList.add("on"); out.textContent = "";
      const w = window.open("", "_blank"); // opened right away so the browser does not block it
      try {
        const r = await fn("billing", { action: "invoice", plan: b.dataset.plan }, session.access_token);
        if (w) w.location.href = r.url; else location.href = r.url;
        note.innerHTML = `<span class="pay-wait"></span> Ждём оплату в Telegram… Если окно не открылось — <a href="${esc(r.url)}" target="_blank" rel="noopener">откройте счёт</a>.`;
        clearInterval(payTimer); payTimer = setInterval(payCheck, 4000);
      } catch (err) { if (w) w.close(); out.textContent = errText(err); }
      box.classList.remove("busy"); b.classList.remove("on");
    });
  }
  async function payCheck() {
    if (!$("#pay-plans")) return clearInterval(payTimer);
    try {
      const { data } = await sb.rpc("my_access");
      if (data?.has_access) { clearInterval(payTimer); const n = $("#pay-note"); if (n) n.innerHTML = "✅ Оплата получена — открываю…"; setTimeout(start, 700); }
    } catch {}
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && payTimer) payCheck(); });

  async function loadApp(session) {
    const [k, enc] = await Promise.all([
      fn("app-key", {}, session.access_token),
      fetch(APP_FILE, { cache: "force-cache" }).then(r => { if (!r.ok) throw new Error("app " + r.status); return r.arrayBuffer(); }),
    ]);
    const raw = Uint8Array.from(atob(k.key), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const buf = new Uint8Array(enc);
    const code = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12)));
    const s = document.createElement("script");
    s.src = URL.createObjectURL(new Blob([code.split(WM0).join(k.wm)], { type: "text/javascript" }));
    document.body.append(s);
  }

  async function start() {
    if (!sb) return gate("config");
    const q = new URLSearchParams(location.search);
    if (q.has("hash") && q.has("id") && q.has("auth_date")) {
      const user = {};
      for (const k of ["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]) if (q.has(k)) user[k] = q.get(k);
      history.replaceState(null, "", location.pathname + location.hash);
      return widgetAuth(user);
    }
    gate("wait");
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return gate("login");
    let acc;
    try { const r = await sb.rpc("my_access"); if (r.error) throw r.error; acc = r.data; }
    catch (e) { return gate("login", "Не удалось проверить доступ: " + errText(e)); }
    ACC = acc;
    if (!acc?.has_access) return gate(acc?.blocked ? "blocked" : "pay");
    try { await loadApp(session); }
    catch (e) { gate("login", "Не удалось загрузить приложение: " + errText(e) + ". Обновите страницу."); }
  }
  start();
})();
