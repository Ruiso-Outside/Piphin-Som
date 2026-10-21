// Piphin Som · núcleo: música (faixas e clipes), teoria musical (notas e acordes) e histórico.
// Tempo em "tempos" (beats, semínimas): compasso 1 começa no tempo 0; em 4/4 o compasso 2 começa no tempo 4.
"use strict";
const PS = (window.PS = {});
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const PT = "pt-BR";
const fmt = (v, d = 0) => Number(v).toLocaleString(PT, { maximumFractionDigits: d });
let _uid = Date.now() % 100000;
PS.uid = (p = "") => p + (++_uid).toString(36);

const _ev = new Map();
PS.on = (n, f) => { if (!_ev.has(n)) _ev.set(n, []); _ev.get(n).push(f); };
PS.emit = (n, d) => { for (const f of _ev.get(n) || []) { try { f(d); } catch (e) { console.error(e); } } };

// ------------------------------------------------------------------ teoria musical
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PT_NAMES = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
PS.noteName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
PS.notePt = (m) => PT_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
PS.isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
PS.freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, DO: 0, "DÓ": 0, RE: 2, "RÉ": 2, MI: 4, FA: 5, "FÁ": 5, SOL: 7, LA: 9, "LÁ": 9, SI: 11 };
// "C4", "D#5", "Bb3", "Sol4", 60 -> número MIDI
PS.parseNote = (n, octave = 4) => {
  if (typeof n === "number") return clamp(Math.round(n), 0, 127);
  const m = /^\s*([A-Ga-g]|d[oó]|r[eé]|mi|f[aá]|sol|l[aá]|si)\s*([#b♯♭]*)\s*(-?\d+)?\s*$/i.exec(String(n));
  if (!m) { const k = Number(n); if (Number.isFinite(k)) return clamp(Math.round(k), 0, 127); throw new Error("Nota inválida: " + n); }
  let pc = PC[m[1].toUpperCase()];
  for (const a of m[2]) pc += a === "#" || a === "♯" ? 1 : -1;
  const oct = m[3] != null ? Number(m[3]) : octave;
  return clamp((oct + 1) * 12 + pc, 0, 127);
};
// acordes: "Am", "F#m7", "Cmaj7", "G7", "Dsus4", "Bdim", "C/E" -> notas MIDI
const QUAL = [
  [/^(maj7|M7|7M)/, [0, 4, 7, 11]], [/^(m7b5|ø)/, [0, 3, 6, 10]], [/^(m7|min7|-7)/, [0, 3, 7, 10]], [/^(mmaj7)/, [0, 3, 7, 11]],
  [/^(dim7|°7)/, [0, 3, 6, 9]], [/^(dim|°)/, [0, 3, 6]], [/^(aug|\+)/, [0, 4, 8]], [/^(sus2)/, [0, 2, 7]], [/^(sus4|sus)/, [0, 5, 7]],
  [/^(add9)/, [0, 4, 7, 14]], [/^(m9)/, [0, 3, 7, 10, 14]], [/^(maj9)/, [0, 4, 7, 11, 14]], [/^9/, [0, 4, 7, 10, 14]], [/^(m6)/, [0, 3, 7, 9]], [/^6/, [0, 4, 7, 9]],
  [/^7/, [0, 4, 7, 10]], [/^(m|min|-)/, [0, 3, 7]], [/^5/, [0, 7]], [/^/, [0, 4, 7]],
];
PS.parseChord = (name, octave = 4) => {
  const m = /^\s*([A-G])([#b]?)(.*?)(?:\/([A-G][#b]?))?\s*$/.exec(String(name));
  if (!m) throw new Error("Acorde inválido: " + name);
  const root = PS.parseNote(m[1] + m[2] + octave);
  const q = QUAL.find(([re]) => re.test(m[3]));
  let notes = q[1].map((i) => root + i);
  if (m[4]) { let b = PS.parseNote(m[4] + (octave - 1)); while (b >= root) b -= 12; notes = [b, ...notes]; }
  return { root, notes, bass: m[4] ? notes[0] : root - 12 };
};

// ------------------------------------------------------------------ música
PS.COLORS = ["#22c55e", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa", "#facc15", "#2dd4bf", "#f87171", "#818cf8", "#a3e635"];
PS.defaultFx = () => ({ reverb: 0, delay: 0, delayTime: 0.5, distortion: 0, lowpass: 20000, highpass: 20, eqLow: 0, eqMid: 0, eqHigh: 0, comp: false });
PS.newSong = ({ name = "Música nova", bpm = 110, bars = 16, beatsPerBar = 4 } = {}) => ({
  schema: 1, name, bpm, beatsPerBar, bars, swing: 0, master: { volume: 0.9, limiter: true },
  loop: { on: false, start: 0, end: beatsPerBar * 4 },
  samples: [], tracks: [],
});
PS.newTrack = (kind, opts = {}) => {
  const n = PS.state.song.tracks.length;
  const t = { id: PS.uid("t"), kind, name: opts.name || { inst: "Instrumento", drums: "Bateria", audio: "Áudio" }[kind], color: PS.COLORS[n % PS.COLORS.length],
    volume: 0.8, pan: 0, mute: false, solo: false, fx: PS.defaultFx(), clips: [] };
  if (kind === "inst") { t.inst = { preset: opts.instrument || "piano", ...(PS.PRESETS ? JSON.parse(JSON.stringify(PS.PRESETS[opts.instrument || "piano"].params)) : {}) }; t.name = opts.name || PS.PRESETS[t.inst.preset].name; }
  if (kind === "drums") t.kit = opts.kit || "808";
  return t;
};

PS.state = { song: PS.newSong(), path: null, dirty: false, beat: 0, playing: false, selTrack: null, selClip: null, past: [], future: [], zoom: 28, snap: 0.25, tab: "music" };
const S = PS.state;
PS.song = () => S.song;
PS.track = (id) => S.song.tracks.find((t) => t.id === id);
PS.findClip = (id) => { for (const t of S.song.tracks) { const c = t.clips.find((x) => x.id === id); if (c) return { t, c }; } return null; };
PS.sample = (id) => S.song.samples.find((s) => s.id === id);
PS.secPerBeat = () => 60 / S.song.bpm;
PS.beatsToSec = (b) => b * PS.secPerBeat();
PS.secToBeats = (s) => s / PS.secPerBeat();
PS.barBeats = () => S.song.beatsPerBar;
PS.songBeats = () => {
  let end = S.song.bars * S.song.beatsPerBar;
  for (const t of S.song.tracks) for (const c of t.clips) end = Math.max(end, c.start + PS.clipLen(c));
  return end;
};
// fim real da música (o último som), para exportar sem silêncio sobrando
PS.contentBeats = () => {
  let end = 0;
  for (const t of S.song.tracks) for (const c of t.clips) {
    if (c.type === "notes") for (const n of c.notes) end = Math.max(end, c.start + n.s + n.l);
    else end = Math.max(end, c.start + PS.clipLen(c));
  }
  return end;
};
PS.clipLen = (c) => (c.type === "audio" ? PS.secToBeats(Math.max(0.01, (c.dur ?? ((PS.sample(c.sample) || {}).duration || 1)) / (c.rate || 1))) : c.len);
PS.newClip = (type, start, len) => {
  const c = { id: PS.uid("c"), type, start, len };
  if (type === "notes") c.notes = [];
  if (type === "drums") c.steps = {};
  return c;
};
// clipe que cobre o tempo b numa faixa (ou cria um novo, alinhado ao compasso)
PS.clipAt = (t, b, create = true, type = null) => {
  let c = t.clips.find((x) => b >= x.start && b < x.start + PS.clipLen(x));
  if (c || !create) return c;
  const bb = PS.barBeats(), start = Math.floor(b / bb) * bb;
  c = PS.newClip(type || (t.kind === "drums" ? "drums" : "notes"), start, bb * 4);
  const next = t.clips.filter((x) => x.start > start).sort((a, z) => a.start - z.start)[0];
  if (next) c.len = Math.max(bb, Math.min(c.len, next.start - start));
  t.clips.push(c);
  return c;
};

// ------------------------------------------------------------------ histórico
const snap = () => JSON.stringify(S.song);
PS.edit = (label, fn) => {
  const before = snap();
  const r = fn();
  if (snap() === before) return r;
  S.past.push({ label, json: before }); if (S.past.length > 120) S.past.shift();
  S.future = []; S.dirty = true;
  PS.emit("song", { label });
  return r;
};
PS.undo = () => { const e = S.past.pop(); if (!e) return null; S.future.push({ label: e.label, json: snap() }); S.song = JSON.parse(e.json); S.dirty = true; PS.emit("song", { undo: true }); return e.label; };
PS.redo = () => { const e = S.future.pop(); if (!e) return null; S.past.push({ label: e.label, json: snap() }); S.song = JSON.parse(e.json); S.dirty = true; PS.emit("song", { redo: true }); return e.label; };

// "1.2.3" (compasso.tempo.dezesseis avos) para a barra de tempo
PS.posText = (b) => {
  const bb = PS.barBeats(), bar = Math.floor(b / bb) + 1, beat = Math.floor(b % bb) + 1, six = Math.floor((b % 1) * 4) + 1;
  return `${bar}.${beat}.${six}`;
};
PS.timeText = (sec) => { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
