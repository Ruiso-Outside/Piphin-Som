// Piphin Som · motor: toca a música com agendamento preciso (um pouco à frente do relógio do áudio),
// repetição (loop), metrônomo, notas ao vivo do teclado, gravação e mixagem final para exportar.
"use strict";
PS.engine = (() => {
  const S = PS.state;
  let ctx = null, master = null, chains = new Map();
  let timer = 0, segs = [], nextBeat = 0, endBeat = 0, metro = false, raf = 0;
  const buffers = new Map(); // id da amostra -> AudioBuffer
  const live = new Map(); // nota tocada no teclado -> handle

  function ensure() {
    if (ctx) return ctx;
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = buildMaster(ctx, ctx.destination);
    rebuild();
    return ctx;
  }
  const SOFT = (() => { const n = 4096, k = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; k[i] = Math.abs(x) < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((Math.abs(x) - 0.8) / 0.2)); } return k; })();
  function buildMaster(c, dest) {
    const m = { input: c.createGain(), lim: c.createDynamicsCompressor(), clip: c.createWaveShaper(), analyser: c.createAnalyser(), rev: c.createConvolver(), revIn: c.createGain() };
    m.lim.threshold.value = -6; m.lim.knee.value = 6; m.lim.ratio.value = 12; m.lim.attack.value = 0.001; m.lim.release.value = 0.1;
    m.clip.curve = SOFT; m.clip.oversample = "2x"; // nunca passa de 100%: o excesso é arredondado, sem estalo
    m.analyser.fftSize = 2048;
    m.input.gain.value = S.song.master.volume ?? 0.9;
    m.input.connect(m.lim).connect(m.clip).connect(m.analyser).connect(dest);
    // um reverb só para todas as faixas (cada faixa manda uma parte do som para ele)
    m.rev.buffer = PS.reverbImpulse(c); m.revIn.connect(m.rev).connect(m.input);
    return m;
  }
  // refaz a cadeia de cada faixa (faixas novas/removidas) e aplica volumes e efeitos
  function rebuild() {
    if (!ctx) return;
    const ids = new Set(S.song.tracks.map((t) => t.id));
    for (const [id, n] of chains) if (!ids.has(id)) { try { n.vol.disconnect(); } catch { /* */ } chains.delete(id); }
    const solo = S.song.tracks.some((t) => t.solo);
    for (const t of S.song.tracks) {
      if (!chains.has(t.id)) chains.set(t.id, PS.trackChain(ctx, master.input, t, master.revIn));
      PS.applyFx(ctx, chains.get(t.id), t, solo && !t.solo);
    }
    master.input.gain.setValueAtTime(S.song.master.volume ?? 0.9, ctx.currentTime);
  }
  PS.on("song", rebuild);
  PS.on("mix", rebuild);

  // ---------------------------------------------------------------- amostras
  async function loadSample(s, bytes = null) {
    if (buffers.has(s.id)) return buffers.get(s.id);
    if (!bytes) { const r = await PS.call("read-audio", s.path); bytes = r.bytes; }
    const c = ensure();
    const b = await c.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    buffers.set(s.id, b);
    s.duration = b.duration;
    return b;
  }
  const bufferOf = (id) => buffers.get(id);

  // ---------------------------------------------------------------- eventos de um trecho
  // chama fn(tipo, faixa, tempo em beats, dados) para tudo que começa entre [a, b)
  function events(a, b, fn, includeRunning = false) {
    const solo = S.song.tracks.some((t) => t.solo);
    for (const t of S.song.tracks) {
      if (t.mute || (solo && !t.solo)) continue;
      for (const c of t.clips) {
        const cs = c.start, ce = c.start + PS.clipLen(c);
        if (ce <= a || cs >= b) { if (!(includeRunning && c.type === "audio" && cs < a && ce > a)) continue; }
        if (c.type === "notes") for (const n of c.notes) { const at = cs + n.s; if (at >= a && at < b && n.s < c.len) fn("note", t, at, { n, len: Math.min(n.l, c.len - n.s) }); }
        else if (c.type === "drums") {
          const steps = Math.round(c.len * 4);
          for (const [piece, arr] of Object.entries(c.steps)) for (let i = 0; i < steps && i < arr.length; i++) {
            if (!arr[i]) continue;
            let at = cs + i / 4;
            if (S.song.swing && i % 2 === 1) at += (S.song.swing / 100) * 0.125;
            if (at >= a && at < b) fn("drum", t, at, { piece, vel: arr[i] });
          }
        } else if (c.type === "audio") {
          if (cs >= a && cs < b) fn("audio", t, cs, { c, skip: 0 });
          else if (includeRunning && cs < a && ce > a) fn("audio", t, a, { c, skip: PS.beatsToSec(a - cs) * (c.rate || 1) });
        }
      }
    }
  }
  function schedule(c, chainsOf, t, at, d, when) {
    const n = chainsOf.get(t.id); if (!n) return;
    if (d.n) { const inst = t.inst || PS.PRESETS.piano.params; PS.playNote(c, n.input, when, d.n.p, PS.beatsToSec(d.len), d.n.v ?? 0.8, inst); }
    else if (d.piece) PS.playDrum(c, n.input, when, d.piece, d.vel, t.kit);
    else if (d.c) {
      const cl = d.c, buf = bufferOf(cl.sample); if (!buf) return;
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.playbackRate.value = cl.rate || 1;
      const off = (cl.offset || 0) + d.skip, len = (cl.dur ?? buf.duration - (cl.offset || 0)) - d.skip;
      if (len <= 0) return;
      const gain = cl.gain ?? 1, real = len / (cl.rate || 1);
      g.gain.setValueAtTime(cl.fadeIn && !d.skip ? 0 : gain, when);
      if (cl.fadeIn && !d.skip) g.gain.linearRampToValueAtTime(gain, when + cl.fadeIn);
      if (cl.fadeOut) { g.gain.setValueAtTime(gain, when + Math.max(0, real - cl.fadeOut)); g.gain.linearRampToValueAtTime(0, when + real); }
      src.connect(g).connect(n.input);
      src.start(when, off, len);
    }
  }

  // ---------------------------------------------------------------- tocar
  const beatAtTime = (time) => {
    for (let i = segs.length - 1; i >= 0; i--) if (time >= segs[i].t0) return segs[i].b0 + (time - segs[i].t0) / PS.secPerBeat();
    return segs.length ? segs[0].b0 : S.beat;
  };
  async function play(from = S.beat) {
    ensure(); await ctx.resume();
    // amostras precisam estar carregadas
    for (const s of S.song.samples) if (!buffers.has(s.id)) await loadSample(s).catch(() => { s.missing = true; });
    stop(false);
    S.playing = true;
    const loop = S.song.loop;
    endBeat = PS.songBeats();
    if (loop.on && (from < loop.start || from >= loop.end)) from = loop.start;
    const t0 = ctx.currentTime + 0.06;
    segs = [{ t0, b0: from }];
    nextBeat = from;
    let first = true;
    const tick = () => {
      const seg = segs[segs.length - 1];
      const horizon = beatAtTime(ctx.currentTime + 0.15);
      let until = Math.max(nextBeat, horizon);
      const lp = S.song.loop;
      const stopAt = lp.on ? lp.end : endBeat;
      const to = Math.min(until, stopAt);
      events(nextBeat, to, (kind, t, at, d) => schedule(ctx, chains, t, at, d, seg.t0 + (at - seg.b0) * PS.secPerBeat()), first);
      if (metro) for (let b = Math.ceil(nextBeat - 1e-9); b < to; b++) click(seg.t0 + (b - seg.b0) * PS.secPerBeat(), b % PS.barBeats() === 0);
      first = false;
      nextBeat = to;
      if (to >= stopAt - 1e-9) {
        if (lp.on) { // volta ao começo do trecho repetido
          segs.push({ t0: seg.t0 + (lp.end - seg.b0) * PS.secPerBeat(), b0: lp.start });
          if (segs.length > 8) segs.shift();
          nextBeat = lp.start; first = true;
        } else if (beatAtTime(ctx.currentTime) >= endBeat) { stop(true); S.beat = 0; PS.emit("beat", 0); }
      }
    };
    tick();
    timer = setInterval(tick, 25);
    PS.emit("playing", true);
    const anim = () => { if (!S.playing) return; S.beat = beatAtTime(ctx.currentTime); PS.emit("beat", S.beat); raf = requestAnimationFrame(anim); };
    raf = requestAnimationFrame(anim);
  }
  function stop(emit = true) {
    clearInterval(timer); timer = 0; cancelAnimationFrame(raf);
    const was = S.playing;
    S.playing = false;
    if (ctx && was) {
      // silencia o que já foi agendado: troca as cadeias por novas
      for (const n of chains.values()) { try { n.vol.disconnect(); } catch { /* */ } }
      chains.clear(); rebuild();
    }
    if (emit && was) PS.emit("playing", false);
  }
  function click(when, strong) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = strong ? 1760 : 1100;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.3, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    o.connect(g).connect(master.input); o.start(when); o.stop(when + 0.08);
  }

  // ---------------------------------------------------------------- ao vivo (teclado do computador, cliques no piano)
  function noteOn(t, midi, vel = 0.85) {
    ensure(); ctx.resume();
    const n = chains.get(t.id) || (rebuild(), chains.get(t.id));
    const key = t.id + ":" + midi;
    if (live.has(key)) return;
    if (t.kind === "drums") { PS.playDrum(ctx, n.input, ctx.currentTime, typeof midi === "string" ? midi : PS.DRUMS[midi % PS.DRUMS.length][0], vel, t.kit); return; }
    live.set(key, PS.playNote(ctx, n.input, ctx.currentTime, midi, null, vel, t.inst));
  }
  function noteOff(t, midi) {
    const key = t.id + ":" + midi, h = live.get(key);
    if (h) { h.release(ctx.currentTime); live.delete(key); }
  }
  // toca um AudioBuffer avulso (prévia de efeito sonoro)
  function audition(buf, gain = 0.9) {
    ensure(); ctx.resume();
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; g.gain.value = gain;
    s.connect(g).connect(master.input); s.start();
    return s;
  }

  // ---------------------------------------------------------------- mixagem final
  async function render({ from = 0, to = null, sampleRate = 48000, tail = 2.5 } = {}) {
    for (const s of S.song.samples) if (!buffers.has(s.id)) await loadSample(s);
    const end = to ?? Math.max(PS.contentBeats(), 0.25);
    const dur = PS.beatsToSec(end - from) + tail;
    const oc = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
    const m = buildMaster(oc, oc.destination), ch = new Map();
    const solo = S.song.tracks.some((t) => t.solo);
    for (const t of S.song.tracks) { const n = PS.trackChain(oc, m.input, t, m.revIn); PS.applyFx(oc, n, t, solo && !t.solo); ch.set(t.id, n); }
    events(from, end, (kind, t, at, d) => schedule(oc, ch, t, at, d, (at - from) * PS.secPerBeat()), true);
    const out = await oc.startRendering();
    return trimTail(out);
  }
  // corta o silêncio do fim (o "rabo" do reverb fica)
  function trimTail(b) {
    const th = 0.0004, sr = b.sampleRate;
    let last = 0;
    for (let ch = 0; ch < b.numberOfChannels; ch++) { const d = b.getChannelData(ch); for (let i = d.length - 1; i > last; i--) if (Math.abs(d[i]) > th) { last = i; break; } }
    const len = Math.min(b.length, last + Math.round(sr * 0.05));
    if (len >= b.length - 10 || len < sr * 0.05) return b;
    const o = new AudioBuffer({ numberOfChannels: b.numberOfChannels, length: len, sampleRate: sr });
    for (let ch = 0; ch < b.numberOfChannels; ch++) o.copyToChannel(b.getChannelData(ch).subarray(0, len), ch);
    return o;
  }

  // ---------------------------------------------------------------- gravação do microfone
  let rec = null;
  async function recordStart() {
    ensure(); await ctx.resume();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 2, 2), chunks = [[], []];
    proc.onaudioprocess = (e) => { for (let c = 0; c < 2; c++) chunks[c].push(new Float32Array(e.inputBuffer.getChannelData(Math.min(c, e.inputBuffer.numberOfChannels - 1)))); };
    const sink = ctx.createGain(); sink.gain.value = 0;
    src.connect(proc).connect(sink).connect(ctx.destination);
    const an = ctx.createAnalyser(); src.connect(an);
    rec = { stream, src, proc, chunks, startBeat: S.beat, t0: ctx.currentTime, analyser: an };
    return rec;
  }
  function recordStop() {
    if (!rec) return null;
    const r = rec; rec = null;
    r.proc.disconnect(); r.src.disconnect(); r.stream.getTracks().forEach((t) => t.stop());
    const len = r.chunks[0].reduce((n, c) => n + c.length, 0);
    if (!len) return null;
    const b = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: ctx.sampleRate });
    for (let c = 0; c < 2; c++) { let o = 0; for (const part of r.chunks[c]) { b.copyToChannel(part, c, o); o += part.length; } }
    return { buffer: b, startBeat: r.startBeat };
  }

  return { ensure, play, stop, toggle: () => (S.playing ? stop() : play()), noteOn, noteOff, audition, render, loadSample, bufferOf, buffers,
    setBuffer: (id, b) => buffers.set(id, b), recordStart, recordStop, isRecording: () => !!rec, recLevel: () => rec && rec.analyser,
    metronome: (on) => (metro = on ?? !metro), get analyser() { return master && master.analyser; }, rebuild, get ctx() { return ctx; } };
})();
