"use strict";
// Procedural sound: everything is synthesized with WebAudio, no files.

const Sound = (() => {
  let ctx = null, master = null, amb = null, ambGain = null, windGain = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("bp.muted") === "1"; } catch (e) {}

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbient();
  }

  function panned(pan) {
    if (!ctx || !pan || !ctx.createStereoPanner) return master;
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master);
    return p;
  }
  function noise(dur, { type = "lowpass", freq = 1000, q = 1, vol = 0.5, attack = 0.005, freqEnd = null, out = master, when = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, { type = "sine", vol = 0.3, freqEnd = null, attack = 0.005, out = master, when = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  function startAmbient() {
    amb = ctx.createGain(); amb.gain.value = 0; amb.connect(master);
    ambGain = ctx.createGain(); ambGain.gain.value = 0.12; ambGain.connect(amb);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220; lp.connect(ambGain);
    [55, 55.6, 82.4].forEach(f => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // wind
    windGain = ctx.createGain(); windGain.gain.value = 0.18; windGain.connect(amb);
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 400; wf.Q.value = 0.6;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.11;
    const wlg = ctx.createGain(); wlg.gain.value = 250; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
    ws.connect(wf); wf.connect(windGain); ws.start();
  }

  let beatT = 0, rainGain = null, eng = null;
  return {
    init,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem("bp.muted", muted ? "1" : "0"); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.7;
      return muted;
    },
    // night: 0..1, fear: 0..1
    update(dt, night, fear, active) {
      if (!ctx) return;
      const t = ctx.currentTime;
      amb.gain.setTargetAtTime(active ? 1 : 0.3, t, 0.5);
      ambGain.gain.setTargetAtTime(0.06 + night * 0.12 + fear * 0.1, t, 1);
      windGain.gain.setTargetAtTime(0.1 + night * 0.12, t, 1);
      if (active && fear > 0.35) {
        beatT -= dt;
        if (beatT <= 0) {
          beatT = 1.1 - fear * 0.6;
          tone(58, 0.16, { type: "sine", vol: 0.5 * fear });
          tone(52, 0.18, { type: "sine", vol: 0.4 * fear, when: 0.18 });
        }
      }
    },
    swing() { noise(0.12, { type: "highpass", freq: 1800, freqEnd: 600, vol: 0.18, attack: 0.03 }); },
    hit() { noise(0.15, { type: "lowpass", freq: 900, vol: 0.5 }); tone(110, 0.12, { type: "square", vol: 0.12, freqEnd: 50 }); },
    chop() { noise(0.09, { type: "bandpass", freq: 700, q: 3, vol: 0.5 }); tone(180, 0.08, { type: "triangle", vol: 0.2, freqEnd: 90 }); },
    mine() { noise(0.07, { type: "bandpass", freq: 2400, q: 6, vol: 0.4 }); tone(900, 0.1, { type: "square", vol: 0.05, freqEnd: 600 }); },
    shot() { noise(0.35, { type: "lowpass", freq: 3000, freqEnd: 200, vol: 0.9, attack: 0.001 }); tone(90, 0.2, { type: "sine", vol: 0.6, freqEnd: 40 }); },
    shotgun() { noise(0.6, { type: "lowpass", freq: 2200, freqEnd: 120, vol: 1, attack: 0.001 }); tone(70, 0.35, { type: "sine", vol: 0.8, freqEnd: 30 }); },
    bow() { tone(300, 0.1, { type: "triangle", vol: 0.2, freqEnd: 120 }); noise(0.15, { type: "highpass", freq: 2500, vol: 0.12 }); },
    click() { tone(1200, 0.03, { type: "square", vol: 0.08 }); },
    reload() { tone(700, 0.05, { type: "square", vol: 0.08 }); tone(500, 0.06, { type: "square", vol: 0.08, when: 0.25 }); },
    pickup() { tone(660, 0.08, { vol: 0.15 }); tone(990, 0.1, { vol: 0.12, when: 0.07 }); },
    craft() { tone(440, 0.1, { type: "triangle", vol: 0.15 }); tone(660, 0.1, { type: "triangle", vol: 0.15, when: 0.1 }); tone(880, 0.14, { type: "triangle", vol: 0.15, when: 0.2 }); },
    hurt() { tone(220, 0.25, { type: "sawtooth", vol: 0.2, freqEnd: 90 }); noise(0.2, { freq: 600, vol: 0.3 }); },
    growl(pitch = 1, vol = 0.3) {
      tone(70 * pitch, 0.7, { type: "sawtooth", vol, freqEnd: 45 * pitch, attack: 0.08 });
      noise(0.6, { type: "bandpass", freq: 300 * pitch, q: 4, vol: vol * 0.8, attack: 0.1 });
    },
    scream() {
      tone(900, 0.8, { type: "sawtooth", vol: 0.12, freqEnd: 1500, attack: 0.05 });
      tone(940, 0.8, { type: "sawtooth", vol: 0.12, freqEnd: 1400, attack: 0.05 });
      noise(0.8, { type: "bandpass", freq: 2500, q: 2, vol: 0.2, attack: 0.05 });
    },
    whisper() {
      for (let i = 0; i < 4; i++) noise(0.25 + Math.random() * 0.3, { type: "bandpass", freq: 1500 + Math.random() * 2500, q: 8, vol: 0.12, attack: 0.08, when: i * 0.22 });
    },
    spit() { noise(0.2, { type: "bandpass", freq: 800, freqEnd: 300, q: 2, vol: 0.3 }); },
    fire() { noise(0.5, { type: "lowpass", freq: 1200, freqEnd: 300, vol: 0.5, attack: 0.02 }); },
    glass() { noise(0.2, { type: "highpass", freq: 4000, vol: 0.3 }); tone(2400, 0.15, { vol: 0.08, freqEnd: 1800 }); },
    step() { noise(0.05, { type: "lowpass", freq: 400, vol: 0.06 }); },
    sting() { tone(110, 2.5, { type: "sawtooth", vol: 0.15, freqEnd: 104, attack: 0.02 }); tone(116.5, 2.5, { type: "sawtooth", vol: 0.15, attack: 0.02 }); noise(1.5, { type: "highpass", freq: 3000, vol: 0.1 }); },
    screech(pitch = 1, vol = 0.3) {
      tone(520 * pitch, 0.9, { type: "sawtooth", vol: vol * 0.5, freqEnd: 300 * pitch, attack: 0.03 });
      tone(555 * pitch, 0.9, { type: "square", vol: vol * 0.25, freqEnd: 330 * pitch, attack: 0.03 });
      noise(0.8, { type: "bandpass", freq: 1800 * pitch, q: 3, vol: vol * 0.7, attack: 0.03 });
    },
    screamer() {
      noise(1.1, { type: "highpass", freq: 900, vol: 1, attack: 0.002 });
      tone(880, 1, { type: "sawtooth", vol: 0.45, freqEnd: 1700, attack: 0.002 });
      tone(933, 1, { type: "square", vol: 0.3, freqEnd: 1500, attack: 0.002 });
      tone(60, 0.8, { type: "sine", vol: 0.8, freqEnd: 30, attack: 0.002 });
    },
    thunder(delay = 0.5) {
      noise(2.8, { type: "lowpass", freq: 900, freqEnd: 60, vol: 0.9, attack: 0.05, when: delay });
      noise(1.2, { type: "lowpass", freq: 2400, freqEnd: 200, vol: 0.4, attack: 0.01, when: delay });
    },
    rain(level) {
      if (!ctx) return;
      if (!rainGain) {
        rainGain = ctx.createGain(); rainGain.gain.value = 0; rainGain.connect(master);
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1200;
        src.connect(f); f.connect(rainGain); src.start();
      }
      rainGain.gain.setTargetAtTime(level * 0.22, ctx.currentTime, 0.8);
    },
    stepsBehind(pan = 0) {
      const out = panned(pan);
      for (let i = 0; i < 4; i++) noise(0.09, { type: "lowpass", freq: 500, vol: 0.16 + i * 0.03, out, when: i * 0.42 });
    },
    snap(pan = 0) { const out = panned(pan); noise(0.06, { type: "highpass", freq: 2500, vol: 0.5, out, attack: 0.001 }); noise(0.12, { type: "bandpass", freq: 900, q: 4, vol: 0.3, out, when: 0.02 }); },
    farScream(pan = 0) {
      const out = panned(pan);
      tone(700, 1.6, { type: "sawtooth", vol: 0.05, freqEnd: 420, attack: 0.2, out });
      tone(740, 1.6, { type: "sawtooth", vol: 0.04, freqEnd: 400, attack: 0.25, out });
      noise(1.4, { type: "bandpass", freq: 1400, q: 5, vol: 0.06, attack: 0.3, out });
    },
    knock(pan = 0) { const out = panned(pan); for (let i = 0; i < 3; i++) { noise(0.08, { type: "lowpass", freq: 300, vol: 0.5, out, when: i * 0.3 }); tone(90, 0.1, { vol: 0.3, out, when: i * 0.3 }); } },
    breath(pan = 0) { const out = panned(pan); for (let i = 0; i < 2; i++) { noise(0.9, { type: "bandpass", freq: 700, q: 1.5, vol: 0.14, attack: 0.5, out, when: i * 1.6 }); noise(0.7, { type: "bandpass", freq: 500, q: 1.5, vol: 0.1, attack: 0.1, out, when: i * 1.6 + 0.9 }); } },
    radio() { noise(0.8, { type: "bandpass", freq: 2200, q: 0.7, vol: 0.18, attack: 0.01 }); tone(60, 0.6, { type: "square", vol: 0.04 }); },
    rattle() { for (let i = 0; i < 5; i++) noise(0.04, { type: "highpass", freq: 3000, vol: 0.15, when: i * 0.09 }); },
    spikes() { noise(0.2, { type: "highpass", freq: 1800, vol: 0.5, attack: 0.001 }); tone(400, 0.15, { type: "square", vol: 0.1, freqEnd: 200 }); },
    trap() { noise(0.15, { type: "highpass", freq: 2000, vol: 0.8, attack: 0.001 }); tone(1600, 0.2, { type: "square", vol: 0.15, freqEnd: 900 }); },
    twang() { tone(220, 0.4, { type: "triangle", vol: 0.25, freqEnd: 180 }); noise(0.25, { type: "highpass", freq: 3000, vol: 0.2, when: 0.05 }); },
    engineStart() { tone(60, 0.8, { type: "sawtooth", vol: 0.25, freqEnd: 110, attack: 0.1 }); noise(0.6, { type: "lowpass", freq: 400, vol: 0.3, attack: 0.1 }); },
    engine(on, speed) {
      if (!ctx) return;
      if (!eng) {
        eng = { g: ctx.createGain(), o1: ctx.createOscillator(), o2: ctx.createOscillator(), f: ctx.createBiquadFilter() };
        eng.g.gain.value = 0; eng.f.type = "lowpass"; eng.f.frequency.value = 500;
        eng.o1.type = "sawtooth"; eng.o2.type = "square";
        eng.o1.connect(eng.f); eng.o2.connect(eng.f); eng.f.connect(eng.g); eng.g.connect(master);
        eng.o1.start(); eng.o2.start();
      }
      const t = ctx.currentTime;
      eng.g.gain.setTargetAtTime(on ? 0.07 + speed * 0.08 : 0, t, 0.15);
      eng.o1.frequency.setTargetAtTime(38 + speed * 90, t, 0.1);
      eng.o2.frequency.setTargetAtTime(19 + speed * 45, t, 0.1);
    },
    carHit() { noise(0.25, { type: "lowpass", freq: 800, vol: 0.7, attack: 0.002 }); tone(70, 0.2, { vol: 0.4, freqEnd: 40 }); },
    turret(d2) { const v = Math.max(0.05, 0.5 - Math.sqrt(d2) / 1400); noise(0.18, { type: "bandpass", freq: 1800, q: 1, vol: v, attack: 0.001 }); tone(140, 0.08, { type: "square", vol: v * 0.3, freqEnd: 60 }); },
    splash() { noise(0.4, { type: "lowpass", freq: 1500, freqEnd: 300, vol: 0.3, attack: 0.01 }); },
    bite() { noise(0.15, { type: "bandpass", freq: 1200, q: 3, vol: 0.4 }); tone(900, 0.12, { vol: 0.15 }); tone(1300, 0.12, { vol: 0.12, when: 0.12 }); },
    plane() { noise(9, { type: "lowpass", freq: 260, vol: 0.35, attack: 2.5 }); tone(85, 9, { type: "sawtooth", vol: 0.05, freqEnd: 70, attack: 2.5 }); },
    piano() {
      // a few wrong notes on an old upright
      const sc = [220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 415.3];
      for (let i = 0; i < 6; i++) { const f = sc[Math.floor(Math.random() * sc.length)] * (Math.random() < 0.3 ? 0.5 : 1); tone(f, 1.4, { type: "triangle", vol: 0.16, when: i * 0.32 }); tone(f * 2.01, 0.9, { vol: 0.05, when: i * 0.32 }); }
    },
    switchClick() { tone(1800, 0.02, { type: "square", vol: 0.1 }); noise(0.03, { type: "highpass", freq: 3000, vol: 0.15 }); },
    hum() { tone(50, 2.5, { type: "sawtooth", vol: 0.12, attack: 0.4 }); tone(100, 2.5, { vol: 0.06, attack: 0.4 }); noise(1.5, { type: "lowpass", freq: 300, vol: 0.2, attack: 0.3 }); },
    tvStatic() { noise(2.2, { type: "highpass", freq: 1500, vol: 0.22, attack: 0.02 }); },
    bossRoar() { tone(45, 2, { type: "sawtooth", vol: 0.5, freqEnd: 30, attack: 0.2 }); noise(2, { type: "lowpass", freq: 500, vol: 0.6, attack: 0.3 }); },
  };
})();
