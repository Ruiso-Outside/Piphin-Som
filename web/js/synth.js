// Piphin Som · instrumentos sintetizados, bateria sintetizada e cadeia de efeitos (tudo em Web Audio, sem amostras).
"use strict";
(() => {
  // ---------------------------------------------------------------- instrumentos
  // parâmetros do sintetizador (todos os instrumentos usam o mesmo motor)
  const BASE = { osc1: "sawtooth", osc2: null, detune: 7, mix2: 0.5, sub: 0, unison: 1, spread: 12, noise: 0, fm: 0, fmRatio: 2, fmDecay: 0.6,
    attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.25, cutoff: 6000, res: 0.7, fenv: 0, fdecay: 0.3, vibrato: 0, vibRate: 5, gain: 0.5, octave: 0 };
  const P = (name, icon, p) => ({ name, icon, params: { ...BASE, ...p } });
  PS.PRESETS = {
    piano: P("Piano", "piano", { osc1: "triangle", osc2: "sine", detune: 3, mix2: 0.6, fm: 1.2, fmRatio: 1, fmDecay: 0.25, attack: 0.002, decay: 1.6, sustain: 0.0, release: 0.35, cutoff: 5200, fenv: 1.5, fdecay: 0.5, gain: 0.55 }),
    "piano-eletrico": P("Piano elétrico", "piano", { osc1: "sine", fm: 3.2, fmRatio: 1, fmDecay: 0.9, attack: 0.002, decay: 2.2, sustain: 0.15, release: 0.4, cutoff: 9000, vibrato: 4, vibRate: 5.5, gain: 0.5 }),
    orgao: P("Órgão", "music-2", { osc1: "sine", osc2: "sine", detune: 1200, mix2: 0.55, sub: 0.45, attack: 0.01, decay: 0.1, sustain: 0.95, release: 0.08, cutoff: 7000, vibrato: 8, vibRate: 6.5, gain: 0.32 }),
    cordas: P("Cordas", "music-4", { osc1: "sawtooth", unison: 3, spread: 14, attack: 0.35, decay: 0.4, sustain: 0.85, release: 0.6, cutoff: 3200, res: 0.4, vibrato: 6, vibRate: 5, gain: 0.3 }),
    pad: P("Pad atmosférico", "waves", { osc1: "sawtooth", osc2: "triangle", detune: 12, unison: 4, spread: 22, attack: 0.9, decay: 1, sustain: 0.8, release: 1.6, cutoff: 1800, res: 1.2, fenv: 1.2, fdecay: 1.5, gain: 0.28 }),
    baixo: P("Baixo", "guitar", { osc1: "sawtooth", sub: 0.7, octave: -1, attack: 0.004, decay: 0.25, sustain: 0.55, release: 0.12, cutoff: 900, res: 2, fenv: 2.2, fdecay: 0.18, gain: 0.55 }),
    "baixo-808": P("Baixo 808", "speaker", { osc1: "sine", sub: 0, octave: -1, attack: 0.002, decay: 1.4, sustain: 0.35, release: 0.35, cutoff: 1400, gain: 0.9, glide808: true }),
    lead: P("Lead", "zap", { osc1: "sawtooth", osc2: "square", detune: 9, mix2: 0.4, attack: 0.01, decay: 0.2, sustain: 0.75, release: 0.18, cutoff: 4200, res: 3, fenv: 1.5, fdecay: 0.25, vibrato: 10, vibRate: 5.5, gain: 0.3 }),
    pluck: P("Pluck", "music", { osc1: "sawtooth", osc2: "square", detune: 5, mix2: 0.3, attack: 0.002, decay: 0.35, sustain: 0, release: 0.2, cutoff: 1200, res: 2, fenv: 3.5, fdecay: 0.12, gain: 0.45 }),
    sino: P("Sino", "bell", { osc1: "sine", fm: 5, fmRatio: 3.5, fmDecay: 1.6, attack: 0.002, decay: 2.8, sustain: 0, release: 1.2, cutoff: 12000, gain: 0.4 }),
    chiptune: P("Chiptune (8 bits)", "gamepad-2", { osc1: "square", attack: 0.001, decay: 0.12, sustain: 0.7, release: 0.05, cutoff: 20000, vibrato: 0, gain: 0.22 }),
    flauta: P("Flauta", "wind", { osc1: "sine", osc2: "triangle", detune: 1200, mix2: 0.15, noise: 0.06, attack: 0.08, decay: 0.2, sustain: 0.85, release: 0.15, cutoff: 5000, vibrato: 12, vibRate: 5, gain: 0.45 }),
    brass: P("Metais", "radio", { osc1: "sawtooth", unison: 2, spread: 8, attack: 0.06, decay: 0.25, sustain: 0.7, release: 0.2, cutoff: 1500, res: 1, fenv: 2, fdecay: 0.2, vibrato: 5, vibRate: 5, gain: 0.32 }),
  };

  // toca uma nota; dur = null deixa tocando até release(quando)
  PS.playNote = (ctx, out, when, midi, dur, vel, p) => {
    p = { ...BASE, ...p };
    const f = PS.freq(midi + 12 * (p.octave || 0)), v = clamp(vel ?? 0.8, 0.05, 1);
    const amp = ctx.createGain(); amp.gain.value = 0;
    const flt = ctx.createBiquadFilter(); flt.type = "lowpass"; flt.Q.value = p.res;
    const cut = Math.min(20000, p.cutoff * (0.6 + 0.4 * v));
    flt.frequency.setValueAtTime(cut, when);
    if (p.fenv) { flt.frequency.setValueAtTime(Math.min(20000, cut * Math.pow(2, p.fenv)), when); flt.frequency.exponentialRampToValueAtTime(Math.max(40, cut), when + p.fdecay); }
    flt.connect(amp).connect(out);
    const srcs = [];
    const mkOsc = (type, freq, det, level) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      if (type === "pulse") { o.setPeriodicWave(pulseWave(ctx)); } else o.type = type;
      o.frequency.setValueAtTime(freq, when); o.detune.value = det; g.gain.value = level;
      o.connect(g).connect(flt); srcs.push(o);
      return o;
    };
    const n = Math.max(1, p.unison | 0);
    for (let i = 0; i < n; i++) mkOsc(p.osc1, f, n > 1 ? (i / (n - 1) - 0.5) * 2 * p.spread : 0, (p.osc2 ? 1 - p.mix2 * 0.5 : 1) / Math.sqrt(n));
    if (p.osc2) mkOsc(p.osc2, f, p.detune, p.mix2);
    if (p.sub) mkOsc("sine", f / 2, 0, p.sub);
    if (p.glide808) { for (const o of srcs) { o.frequency.setValueAtTime(f * 2.2, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.06); } }
    if (p.fm) { // modulação de frequência (pianos elétricos, sinos)
      const mod = ctx.createOscillator(), mg = ctx.createGain();
      mod.frequency.value = f * p.fmRatio;
      mg.gain.setValueAtTime(f * p.fm * v, when); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), when + p.fmDecay);
      mod.connect(mg); for (const o of srcs) mg.connect(o.frequency);
      srcs.push(mod);
    }
    if (p.vibrato) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = p.vibRate; lg.gain.value = p.vibrato; l.connect(lg); for (const o of srcs) if (o.detune) lg.connect(o.detune); srcs.push(l); }
    if (p.noise) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = noiseBuffer(ctx); s.loop = true; g.gain.value = p.noise; s.connect(g).connect(flt); srcs.push(s); }
    // envelope de volume (ADSR)
    const peak = p.gain * v, sus = peak * p.sustain;
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(peak, when + p.attack);
    amp.gain.setTargetAtTime(sus, when + p.attack, Math.max(0.01, p.decay / 4));
    for (const s of srcs) s.start(when);
    const release = (t) => {
      amp.gain.cancelScheduledValues(t);
      amp.gain.setValueAtTime(amp.gain.value || sus, t);
      amp.gain.setTargetAtTime(0, t, Math.max(0.01, p.release / 4));
      for (const s of srcs) { try { s.stop(t + p.release * 1.6 + 0.05); } catch { /* já parou */ } }
    };
    if (dur != null) {
      // notas sem sustentação (piano, pluck) somem sozinhas; as outras soltam no fim
      const end = when + Math.max(0.02, dur);
      amp.gain.cancelScheduledValues(end);
      amp.gain.setTargetAtTime(0, end, Math.max(0.01, p.release / 4));
      for (const s of srcs) s.stop(end + p.release * 1.6 + 0.05);
    }
    return { release };
  };

  let _pulse = null;
  const pulseWave = (ctx) => {
    if (_pulse && _pulse.ctx === ctx) return _pulse.w;
    const n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    _pulse = { ctx, w: ctx.createPeriodicWave(re, im) };
    return _pulse.w;
  };
  const noises = new WeakMap();
  const noiseBuffer = (ctx) => {
    if (noises.has(ctx)) return noises.get(ctx);
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noises.set(ctx, b);
    return b;
  };
  PS.noiseBuffer = noiseBuffer;

  // ---------------------------------------------------------------- bateria
  PS.DRUMS = [["kick", "Bumbo"], ["snare", "Caixa"], ["clap", "Palmas"], ["hihat", "Chimbal"], ["openhat", "Chimbal aberto"], ["tom", "Tom"], ["rim", "Aro"], ["crash", "Prato"], ["shaker", "Chocalho"]];
  PS.KITS = {
    "808": { name: "808 (eletrônico clássico)", kick: { f0: 150, f1: 42, decay: 0.9, click: 0.2 }, snare: { tone: 190, decay: 0.22, noise: 0.8 }, hat: { decay: 0.05, tone: 9000 }, color: 1 },
    acustico: { name: "Acústico", kick: { f0: 120, f1: 55, decay: 0.35, click: 0.6 }, snare: { tone: 210, decay: 0.18, noise: 1 }, hat: { decay: 0.04, tone: 7500 }, color: 0.85 },
    lofi: { name: "Lo-fi", kick: { f0: 110, f1: 48, decay: 0.45, click: 0.1 }, snare: { tone: 180, decay: 0.2, noise: 0.6 }, hat: { decay: 0.035, tone: 5500 }, color: 0.55 },
    eletronico: { name: "Eletrônico (house)", kick: { f0: 170, f1: 50, decay: 0.5, click: 0.4 }, snare: { tone: 230, decay: 0.15, noise: 0.9 }, hat: { decay: 0.045, tone: 10000 }, color: 1 },
  };
  PS.playDrum = (ctx, out, when, piece, vel, kitName) => {
    const k = PS.KITS[kitName] || PS.KITS["808"], v = clamp(vel ?? 1, 0.05, 1.2);
    const env = (g, peak, decay) => { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(peak, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, when + decay); };
    const noise = (decay, type, freq, q, peak) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuffer(ctx); f.type = type; f.frequency.value = Math.min(freq, 20000 * k.color + 1000); f.Q.value = q;
      env(g, peak * v, decay); s.connect(f).connect(g).connect(out);
      s.start(when, Math.random()); s.stop(when + decay + 0.05);
    };
    const tone = (f0, f1, decay, peak, type = "sine") => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + Math.min(decay, 0.12));
      env(g, peak * v, decay); o.connect(g).connect(out); o.start(when); o.stop(when + decay + 0.05);
    };
    switch (piece) {
      case "kick": tone(k.kick.f0, k.kick.f1, k.kick.decay, 1); if (k.kick.click) noise(0.02, "highpass", 3000, 0.7, 0.35 * k.kick.click); break;
      case "snare": tone(k.snare.tone, k.snare.tone * 0.8, 0.12, 0.5, "triangle"); noise(k.snare.decay, "highpass", 1500, 0.7, 0.7 * k.snare.noise); break;
      case "clap": for (let i = 0; i < 3; i++) { const t = when + i * 0.011; const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuffer(ctx); f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 1.2; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + (i === 2 ? 0.18 : 0.01)); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.25); } break;
      case "hihat": noise(k.hat.decay, "highpass", k.hat.tone, 1, 0.38); break;
      case "openhat": noise(0.32, "highpass", k.hat.tone * 0.9, 1, 0.3); break;
      case "tom": tone(160, 95, 0.4, 0.8); break;
      case "rim": tone(1700, 1600, 0.04, 0.5, "square"); noise(0.02, "bandpass", 3000, 2, 0.2); break;
      case "crash": noise(1.4, "highpass", 5000 * k.color, 0.5, 0.32); noise(0.5, "bandpass", 9000 * k.color, 0.8, 0.15); break;
      case "shaker": noise(0.07, "bandpass", 8000 * k.color, 1.5, 0.25); break;
    }
  };

  // ---------------------------------------------------------------- efeitos
  const impulses = new WeakMap();
  const reverbImpulse = (ctx) => {
    if (impulses.has(ctx)) return impulses.get(ctx);
    const len = Math.round(ctx.sampleRate * 2.6), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    impulses.set(ctx, b);
    return b;
  };
  const curves = new Map();
  const distCurve = (amt) => {
    const k = Math.round(amt);
    if (curves.has(k)) return curves.get(k);
    const n = 2048, c = new Float32Array(n), a = k * 2;
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + a) * x * 20 * (Math.PI / 180)) / (Math.PI + a * Math.abs(x)); }
    curves.set(k, c);
    return c;
  };
  // cadeia de uma faixa: entrada -> filtros -> EQ -> distorção -> compressor -> pan -> volume -> saída (+ envio para eco e reverb)
  PS.reverbImpulse = reverbImpulse;
  PS.trackChain = (ctx, dest, t, revBus) => {
    const n = {};
    n.input = ctx.createGain();
    n.hp = ctx.createBiquadFilter(); n.hp.type = "highpass";
    n.lp = ctx.createBiquadFilter(); n.lp.type = "lowpass";
    n.low = ctx.createBiquadFilter(); n.low.type = "lowshelf"; n.low.frequency.value = 220;
    n.mid = ctx.createBiquadFilter(); n.mid.type = "peaking"; n.mid.frequency.value = 1200; n.mid.Q.value = 0.8;
    n.high = ctx.createBiquadFilter(); n.high.type = "highshelf"; n.high.frequency.value = 4500;
    n.dist = ctx.createWaveShaper(); n.dist.oversample = "2x";
    n.comp = ctx.createDynamicsCompressor();
    n.pan = ctx.createStereoPanner();
    n.vol = ctx.createGain();
    n.delay = ctx.createDelay(4); n.fb = ctx.createGain(); n.dsend = ctx.createGain();
    n.rsend = ctx.createGain();
    n.input.connect(n.hp).connect(n.lp).connect(n.low).connect(n.mid).connect(n.high).connect(n.dist).connect(n.comp).connect(n.pan).connect(n.vol).connect(dest);
    n.vol.connect(n.dsend).connect(n.delay); n.delay.connect(n.fb).connect(n.delay); n.delay.connect(dest);
    n.vol.connect(n.rsend).connect(revBus || dest);
    PS.applyFx(ctx, n, t);
    return n;
  };
  PS.applyFx = (ctx, n, t, mutedBySolo = false) => {
    const f = { ...PS.defaultFx(), ...(t.fx || {}) }, now = ctx.currentTime;
    n.hp.frequency.setValueAtTime(clamp(f.highpass, 10, 20000), now);
    n.lp.frequency.setValueAtTime(clamp(f.lowpass, 40, 20000), now);
    n.low.gain.setValueAtTime(f.eqLow, now); n.mid.gain.setValueAtTime(f.eqMid, now); n.high.gain.setValueAtTime(f.eqHigh, now);
    n.dist.curve = f.distortion > 0 ? distCurve(f.distortion) : null;
    if (f.comp) { n.comp.threshold.value = -22; n.comp.ratio.value = 4; n.comp.attack.value = 0.005; n.comp.release.value = 0.15; }
    else { n.comp.threshold.value = 0; n.comp.ratio.value = 1; }
    n.pan.pan.setValueAtTime(clamp(t.pan || 0, -1, 1), now);
    n.vol.gain.setValueAtTime(t.mute || mutedBySolo ? 0 : clamp(t.volume ?? 0.8, 0, 1.6), now);
    n.delay.delayTime.setValueAtTime(clamp((f.delayTime || 0.5) * PS.secPerBeat(), 0.01, 3.9), now);
    n.fb.gain.setValueAtTime(clamp(f.delay / 100, 0, 0.85) * 0.75, now);
    n.dsend.gain.setValueAtTime(f.delay / 100 * 0.6, now);
    n.rsend.gain.setValueAtTime(f.reverb / 100 * 0.9, now);
  };
})();
