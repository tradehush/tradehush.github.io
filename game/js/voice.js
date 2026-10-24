"use strict";
// The forest listens. With the player's permission the game hears speech (Web Speech API)
// and answers some phrases with something unpleasant. Nothing is stored or sent anywhere by the game;
// the browser's own speech service does the recognition.

const Voice = {
  on: false, rec: null, heard: "", heardT: 0, lastReact: -999,
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast("Этот браузер не умеет распознавать речь", 3); return false; }
    try {
      const r = this.rec = new SR();
      r.lang = "ru-RU"; r.continuous = true; r.interimResults = false; r.maxAlternatives = 1;
      r.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) this.hear(e.results[i][0].transcript);
      };
      r.onerror = e => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") { this.on = false; Settings.voice = false; saveSettings(); toast("Нет доступа к микрофону", 3); UI.syncSettings && UI.syncSettings(); }
      };
      // recognition stops on its own after silence: keep it going while enabled
      r.onend = () => { if (this.on) setTimeout(() => { try { this.rec.start(); } catch (err) {} }, 400); };
      r.start();
      this.on = true;
      return true;
    } catch (err) { this.on = false; return false; }
  },
  stop() { this.on = false; try { this.rec && this.rec.stop(); } catch (err) {} },

  hear(text) {
    const t = text.toLowerCase().replace(/ё/g, "е");
    this.heard = text; this.heardT = 3;
    if (G.state !== "play") return;
    const now = G.clock || 0;
    if (now - this.lastReact < 20) return;
    const R = [
      [/(давно|долго|нет|не было).*(твар|монстр|чудищ|никого)|(твар|монстр|чудищ|зомби).*(давно|долго|не было|нет|где)|никого нет|скучно|ничего не происходит|где (все|твари|монстры)|тихо как-то|не страшно|слишком тихо/, "bored"],
      [/кто (здесь|тут|там)|есть кто|ау\b|эй\b/, "who"],
      [/страшно|боюсь|помогите|мне жутко/, "afraid"],
      [/(уходи|отстань|оставь меня)/, "go"],
      [/хозяин|аня/, "name"],
    ];
    for (const [re, kind] of R) if (re.test(t)) { this.lastReact = now; this.react(kind); return; }
  },

  react(kind) {
    const p = G.p, dark = World.indoor || G.night > 0.5;
    const eyesAround = n => {
      for (let i = 0; i < n; i++) {
        const s = freeSpot(p.x, p.y, 220, 420, World.indoor, false);
        if (s) G.watchers.push({ x: s.x, y: s.y, h: 40 + Math.random() * 80, t: 5 + Math.random() * 4, blink: 0, col: Math.random() < 0.7 ? "#ff2a10" : "#e8f0ff", seen: 0 });
      }
    };
    const later = (ms, fn) => setTimeout(() => { if (G.state === "play") fn(); }, ms);
    if (kind === "bored") {
      // "it's been quiet" — not for long
      Sound.whisper();
      if (Math.random() < 0.5) { eyesAround(3); later(2500 + Math.random() * 2000, () => { G.scareCd = 0; screamer("voice"); }); }
      else { eyesAround(2); later(1500, () => { const s = freeSpot(p.x, p.y, 420, 600, false, false); if (s) for (let i = 0; i < 2 + G.day; i++) { const m = spawnMonster(pickType(), s.x + (Math.random() - 0.5) * 80, s.y + (Math.random() - 0.5) * 80); m.aggro = 10; } Sound.farScream(0); }); }
      G.lightOff = Math.max(G.lightOff, 0.6);
    } else if (kind === "who") {
      Sound.knock((Math.random() - 0.5) * 2);
      later(1200, () => { Sound.whisper(); eyesAround(dark ? 2 : 1); });
    } else if (kind === "afraid") {
      Sound.breath(Math.sin(Math.PI));
      later(1800, () => { if (!World.indoor) { const a = p.a + (Math.random() - 0.5) * 0.8; G.figure = { x: p.x + Math.cos(a) * 500, y: p.y + Math.sin(a) * 500, t: 12, lit: 0 }; } else eyesAround(2); });
    } else if (kind === "go") {
      Sound.stepsBehind(-0.6);
      later(2000, () => { Sound.stepsBehind(0.6); if (Math.random() < 0.4) { G.scareCd = 0; screamer("voice"); } });
    } else if (kind === "name") {
      G.lightOff = Math.max(G.lightOff, 1.2);
      Sound.radio();
      later(1300, () => { Sound.whisper(); eyesAround(4); });
    }
  },
};
