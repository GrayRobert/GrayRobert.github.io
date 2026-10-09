// Factory sound, synthesised with WebAudio. No audio files.
// Browsers only allow sound after a click or key press, so nothing plays until start().

const VOLUME = 0.55;
const KEY = 'factory.muted';

export function createAudio() {
  let ctx = null;
  let master, weldGain, noise;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage blocked: default to sound on */ }

  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    master.connect(ctx.destination);

    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    hum();
    weldLoop();
    sweep(55, 220, 1.6, 0.05);

    // Started without a click (a deep link): the browser keeps it silent until the
    // visitor first interacts, then it carries on.
    if (ctx.state === 'suspended') {
      const resume = () => ctx.resume();
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    }
  }

  // A low machine hum: two detuned saws through a lowpass that slowly breathes.
  function hum() {
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(0.07, ctx.currentTime + 0.4, 1.2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
    for (const f of [55, 55.6, 110.3]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    }
    lp.connect(out).connect(master);
  }

  function weldLoop() {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 0.7;
    weldGain = ctx.createGain();
    weldGain.gain.value = 0;
    src.connect(bp).connect(weldGain).connect(master);
    src.start();
  }

  function sweep(from, to, dur, vol) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(vol, t + 0.1);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  function burstNoise(dur, freq, vol) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    const gn = ctx.createGain();
    const t = ctx.currentTime;
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(gn).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur);
  }

  function tone(freq, dur, vol, type = 'sine', at = 0) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    const t = ctx.currentTime + at;
    o.type = type;
    o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  return {
    start,
    get muted() { return muted; },
    // Current output level, for checking the mute actually took.
    get level() { return ctx ? master.gain.value : 0; },
    get state() { return ctx?.state ?? 'none'; },
    // Power off silences everything by suspending the audio engine itself.
    sleep() { ctx?.suspend(); },
    wake() { if (ctx?.state === 'suspended') ctx.resume(); },

    setMuted(m) {
      muted = m;
      try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* not remembered, fine */ }
      if (ctx) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.05);
    },

    // A heavy lever: a thump plus a short burst of grit.
    clunk() {
      if (!ctx) return;
      sweep(140, 45, 0.25, 0.35);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const gn = ctx.createGain();
      const t = ctx.currentTime;
      gn.gain.setValueAtTime(0.25, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(lp).connect(gn).connect(master);
      src.start(t);
      src.stop(t + 0.1);
    },

    // Robot chatter, one blip per couple of letters.
    blip() {
      if (!ctx) return;
      tone(500 + Math.random() * 700, 0.04, 0.025, 'square');
    },

    ship() {
      if (!ctx) return;
      tone(660, 0.18, 0.05);
      tone(990, 0.3, 0.05, 'sine', 0.12);
    },

    // One question on the WHY board: a high tick for yes, a low one for no.
    tick(pass) {
      if (!ctx) return;
      tone(pass ? 1320 : 220, 0.06, 0.04, pass ? 'sine' : 'square');
    },
    approve() {
      if (!ctx) return;
      tone(523, 0.12, 0.05);
      tone(784, 0.25, 0.05, 'sine', 0.1);
    },
    zap() {
      if (!ctx) return;
      sweep(1800, 90, 0.35, 0.09);
      burstNoise(0.25, 2500, 0.2);
    },
    thunk() {
      if (!ctx) return;
      sweep(110, 40, 0.18, 0.3);
    },
    chime() {
      if (!ctx) return;
      tone(880, 0.2, 0.03);
      tone(1175, 0.3, 0.03, 'sine', 0.08);
    },
    alarm() {
      if (!ctx) return;
      for (let i = 0; i < 3; i++) tone(i % 2 ? 440 : 660, 0.16, 0.035, 'square', i * 0.18);
    },
    shield() {
      if (!ctx) return;
      sweep(200, 900, 0.6, 0.05);
    },
    fizz() {
      if (!ctx) return;
      burstNoise(0.12, 4000, 0.08);
    },
    buzz() {
      if (!ctx) return;
      tone(150, 0.25, 0.05, 'sawtooth');
    },
    launch() {
      if (!ctx) return;
      sweep(80, 600, 1.1, 0.07);
      burstNoise(0.9, 900, 0.12);
    },

    // Welding crackle, level 0 to 1, updated every frame.
    weld(level) {
      if (!ctx) return;
      weldGain.gain.setTargetAtTime(level * 0.06, ctx.currentTime, 0.02);
    },
  };
}
