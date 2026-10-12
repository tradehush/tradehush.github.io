(function () {
  if (window.top !== window.self) { try { window.top.location = window.location.href; } catch (e) { document.documentElement.style.display = "none"; } } // never inside someone else's frame
/* LOOK-APPLY */
var LOOK_PRESETS = {
  classic: { n: "Классика", bg: "#0B0B0C", panel: "#141415", ink: "#ECEAE4", accent: "#F2C230" },
  mono: { n: "Монохром", bg: "#000000", panel: "#0E0E0E", ink: "#EDEDED", accent: "#FFFFFF" },
  indigo: { n: "Индиго", bg: "#080B16", panel: "#10152A", ink: "#E6E8F2", accent: "#8B9BFF" },
  mint: { n: "Мята", bg: "#0B0D0C", panel: "#141816", ink: "#E8EEEA", accent: "#3DDC97" },
  sand: { n: "Песок", bg: "#0F0E0C", panel: "#1A1815", ink: "#EEE8DD", accent: "#D9C3A0" },
  wine: { n: "Бордо", bg: "#160B0E", panel: "#221318", ink: "#F1E6E8", accent: "#F2B8A0" },
  graphite: { n: "Графит", bg: "#16181B", panel: "#1F2226", ink: "#E9EBEE", accent: "#7FD1C1" },
  paper: { n: "Бумага", bg: "#F3EEE4", panel: "#FBF8F2", ink: "#1E1B16", accent: "#2F5D50" },
  light: { n: "Светлая", bg: "#EEF1F5", panel: "#FFFFFF", ink: "#141821", accent: "#3B5BDB" }
};
function lookGet() { try { return JSON.parse(localStorage.getItem("th.look") || "null") || {}; } catch (e) { return {}; } }
function lookApply(l) {
  l = l || lookGet();
  var d = document.documentElement, st = d.style, p = LOOK_PRESETS[l.preset] || LOOK_PRESETS.classic;
  var rgb = function (h) { h = String(h).replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  var mix = function (a, b, t) { var x = rgb(a), y = rgb(b); return "#" + x.map(function (v, i) { return ("0" + Math.round(v * t + y[i] * (1 - t)).toString(16)).slice(-2); }).join(""); };
  var lum = function (h) { var c = rgb(h); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  var bg = l.bg || p.bg, pn = l.panel || p.panel, ink = l.ink || p.ink, ac = l.accent || p.accent, light = lum(bg) > 0.5;
  var v = { bg: bg, panel: pn, ink: ink, accent: ac, muted: mix(ink, bg, 0.58), line: mix(ink, pn, 0.13), soft: mix(ink, pn, 0.05), grid: mix(ink, bg, 0.07),
    "accent-soft": mix(ac, bg, 0.16), "on-accent": lum(ac) > 0.55 ? "#111110" : "#FFFFFF" };
  for (var k in v) st.setProperty("--" + k, v[k]);
  st.colorScheme = light ? "light" : "dark";
  d.setAttribute("data-pat", l.pat || "waves");
  st.setProperty("--pat-o", String(Math.round((l.int == null ? 40 : l.int) * 1.2) / 1000));
  d.setAttribute("data-look", (light ? "light" : "dark") + bg + pn + ink + ac);
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", bg);
}
lookApply();

  var en = document.documentElement.lang === "en", l = null;
  try { l = localStorage.getItem("setup-book.lang"); } catch (e) {}
  if (!l && !en) { var n = (navigator.languages || [navigator.language || ""]).join(",").toLowerCase(); if (!/(^|,)(ru|uk|be|kk|uz|ky|tg|az|hy)/.test(n)) l = "en"; }
  if (l === "en" && !en) location.replace("en" + location.search + location.hash);
  else if (l === "ru" && en) location.replace("./" + location.search + location.hash);
  if ("serviceWorker" in navigator) addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
})();
