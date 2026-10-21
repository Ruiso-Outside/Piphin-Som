// Piphin Som · gerador de efeitos sonoros (estilo jogos clássicos): síntese amostra por amostra a partir de
// parâmetros simples (onda, envelope, deslize de altura, vibrato, arpejo, filtros, repetição, flanger).
"use strict";
PS.sfx = (() => {
  const SR = 44100;
  // gerador de números aleatórios com semente (o mesmo "seed" gera o mesmo som)
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; };

  // parâmetros (todos com faixa conhecida para os controles da tela)
  const FIELDS = [
    ["wave", "Onda", "select", ["square", "saw", "sine", "triangle", "noise"]],
    ["attack", "Ataque (s)", 0, 1, 0.005], ["sustain", "Sustentação (s)", 0, 2, 0.01], ["punch", "Impacto", 0, 1, 0.01], ["decay", "Queda (s)", 0, 3, 0.01],
    ["freq", "Altura inicial (Hz)", 20, 3000, 1], ["minFreq", "Altura mínima (Hz)", 0, 1000, 1], ["slide", "Deslize (oitavas/s)", -20, 20, 0.1], ["dslide", "Aceleração do deslize", -40, 40, 0.1],
    ["vibDepth", "Vibrato (profundidade)", 0, 0.5, 0.005], ["vibSpeed", "Vibrato (velocidade Hz)", 0, 40, 0.1],
    ["arpTime", "Arpejo (passo s)", 0, 0.5, 0.005], ["duty", "Largura do pulso", 0.05, 0.95, 0.01], ["dutySweep", "Varredura do pulso", -2, 2, 0.01],
    ["repeat", "Repetir a cada (s)", 0, 1, 0.005], ["flanger", "Flanger (ms)", 0, 20, 0.1], ["flangerSweep", "Varredura do flanger", -20, 20, 0.1],
    ["lpf", "Filtro grave (Hz)", 100, 22050, 10], ["lpfSweep", "Varredura do filtro", -6, 6, 0.05], ["res", "Ressonância", 0, 0.95, 0.01], ["hpf", "Filtro agudo (Hz)", 0, 8000, 10],
    ["volume", "Volume", 0, 1, 0.01],
  ];
  const BASE = { wave: "square", attack: 0, sustain: 0.1, punch: 0, decay: 0.2, freq: 440, minFreq: 0, slide: 0, dslide: 0, vibDepth: 0, vibSpeed: 6, arp: [1], arpTime: 0,
    duty: 0.5, dutySweep: 0, repeat: 0, flanger: 0, flangerSweep: 0, lpf: 22050, lpfSweep: 0, res: 0, hpf: 0, volume: 0.6 };

  // modelos: cada um sorteia variações dentro de faixas que soam como o efeito
  const PRESETS = {
    moeda: ["Moeda", "coins", (r) => ({ wave: pick(r, ["square", "square", "saw"]), sustain: 0.02 + r() * 0.05, punch: 0.3 + r() * 0.4, decay: 0.15 + r() * 0.2, freq: 700 + r() * 600, arp: [1, 1.33 + r() * 0.3], arpTime: 0.05 + r() * 0.05 })],
    pulo: ["Pulo", "footprints", (r) => ({ wave: "square", duty: 0.2 + r() * 0.3, sustain: 0.05 + r() * 0.1, decay: 0.15 + r() * 0.1, freq: 250 + r() * 300, slide: 3 + r() * 4, lpf: 4000 + r() * 6000 })],
    laser: ["Laser", "zap", (r) => ({ wave: pick(r, ["saw", "square", "sine"]), sustain: 0.05 + r() * 0.1, decay: 0.1 + r() * 0.2, freq: 900 + r() * 1400, slide: -(6 + r() * 10), minFreq: 60, duty: 0.2 + r() * 0.3, dutySweep: r() * 0.5, hpf: r() * 300 })],
    explosao: ["Explosão", "bomb", (r) => ({ wave: "noise", sustain: 0.1 + r() * 0.3, punch: 0.4 + r() * 0.4, decay: 0.6 + r() * 1.2, freq: 60 + r() * 120, slide: -(0.5 + r() * 2), lpf: 3000 + r() * 5000, lpfSweep: -(1 + r() * 2), flanger: r() < 0.4 ? 3 + r() * 6 : 0, flangerSweep: -r() * 5, volume: 0.8 })],
    "power-up": ["Power-up", "rocket", (r) => ({ wave: pick(r, ["square", "triangle", "saw"]), sustain: 0.2 + r() * 0.2, decay: 0.2 + r() * 0.2, freq: 200 + r() * 200, slide: 2 + r() * 3, vibDepth: r() < 0.5 ? 0.05 + r() * 0.1 : 0, vibSpeed: 8 + r() * 12, repeat: r() < 0.5 ? 0.1 + r() * 0.15 : 0, duty: 0.3 + r() * 0.4 })],
    dano: ["Dano", "heart", (r) => ({ wave: pick(r, ["noise", "square", "saw"]), sustain: 0.02 + r() * 0.05, punch: 0.3, decay: 0.1 + r() * 0.15, freq: 200 + r() * 400, slide: -(4 + r() * 6), lpf: 3000 + r() * 4000, hpf: r() * 400 })],
    blip: ["Blip", "circle-dot", (r) => ({ wave: pick(r, ["square", "sine", "triangle"]), sustain: 0.03 + r() * 0.04, decay: 0.03 + r() * 0.05, freq: 500 + r() * 900, duty: 0.25 + r() * 0.5, hpf: 100 })],
    clique: ["Clique", "mouse-pointer-click", (r) => ({ wave: pick(r, ["noise", "sine", "square"]), sustain: 0.005 + r() * 0.01, decay: 0.01 + r() * 0.02, freq: 1200 + r() * 1500, hpf: 800 + r() * 1200 })],
    selecao: ["Seleção", "check", (r) => ({ wave: pick(r, ["sine", "triangle", "square"]), sustain: 0.04, decay: 0.12 + r() * 0.08, freq: 600 + r() * 400, arp: [1, 1.5], arpTime: 0.06 + r() * 0.03, duty: 0.4 })],
    erro: ["Erro", "x", (r) => ({ wave: pick(r, ["square", "saw"]), sustain: 0.18 + r() * 0.1, decay: 0.1, freq: 160 + r() * 80, arp: [1, 0.75], arpTime: 0.13 + r() * 0.05, duty: 0.5, lpf: 2500 + r() * 2000 })],
    sucesso: ["Sucesso", "sparkles", (r) => ({ wave: pick(r, ["square", "triangle", "sine"]), sustain: 0.32 + r() * 0.1, decay: 0.3 + r() * 0.2, freq: 400 + r() * 200, arp: [1, 1.26, 1.5, 2], arpTime: 0.075 + r() * 0.03, duty: 0.35, vibDepth: 0.01, vibSpeed: 7 })],
    sirene: ["Sirene", "siren", (r) => ({ wave: pick(r, ["sine", "triangle", "square"]), sustain: 1.4 + r(), decay: 0.3, freq: 600 + r() * 300, vibDepth: 0.25 + r() * 0.1, vibSpeed: 1 + r() * 2, volume: 0.45 })],
    passo: ["Passo", "footprints", (r) => ({ wave: "noise", sustain: 0.01, punch: 0.6, decay: 0.08 + r() * 0.06, freq: 80 + r() * 80, lpf: 600 + r() * 900, volume: 0.8 })],
    tiro: ["Tiro", "crosshair", (r) => ({ wave: "noise", sustain: 0.03 + r() * 0.05, punch: 0.6 + r() * 0.3, decay: 0.2 + r() * 0.25, freq: 400 + r() * 600, slide: -(1 + r() * 3), lpf: 5000 + r() * 8000, lpfSweep: -(1 + r() * 2), volume: 0.8 })],
    magia: ["Magia", "wand-sparkles", (r) => ({ wave: pick(r, ["sine", "triangle"]), sustain: 0.5 + r() * 0.4, decay: 0.6 + r() * 0.5, freq: 700 + r() * 600, arp: [1, 1.5, 2, 1.5], arpTime: 0.05 + r() * 0.03, vibDepth: 0.03, vibSpeed: 12 + r() * 10, flanger: 2 + r() * 5, flangerSweep: 2 })],
    vento: ["Vento", "wind", (r) => ({ wave: "noise", attack: 0.4 + r() * 0.5, sustain: 1.5 + r() * 1.5, decay: 1 + r(), freq: 400, lpf: 500 + r() * 900, res: 0.6 + r() * 0.3, lpfSweep: (r() - 0.5) * 0.8, vibDepth: 0, volume: 0.7 })],
    chuva: ["Chuva", "cloud-rain", (r) => ({ wave: "noise", attack: 0.3, sustain: 2.5 + r() * 2, decay: 0.8, freq: 2000, lpf: 6000 + r() * 6000, hpf: 1500 + r() * 1500, volume: 0.45 })],
    notificacao: ["Notificação", "bell", (r) => ({ wave: "sine", sustain: 0.12, punch: 0.2, decay: 0.45 + r() * 0.3, freq: 800 + r() * 300, arp: [1, pick(r, [1.25, 1.33, 1.5])], arpTime: 0.11 + r() * 0.05 })],
    teleporte: ["Teletransporte", "sparkles", (r) => ({ wave: pick(r, ["sine", "square"]), sustain: 0.4 + r() * 0.3, decay: 0.3, freq: 200 + r() * 200, slide: 5 + r() * 4, vibDepth: 0.15 + r() * 0.15, vibSpeed: 18 + r() * 14, duty: 0.3 })],
    zumbido: ["Zumbido", "activity", (r) => ({ wave: pick(r, ["saw", "square"]), attack: 0.05, sustain: 1 + r(), decay: 0.3, freq: 80 + r() * 60, vibDepth: 0.03 + r() * 0.05, vibSpeed: 4 + r() * 8, lpf: 1200 + r() * 1500, res: 0.4, volume: 0.45 })],
  };
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  function fromPreset(name, { seed = Date.now(), variation = 30, pitch = 0, length = 1 } = {}) {
    const p = PRESETS[name];
    if (!p) throw new Error("Efeito desconhecido: " + name);
    // variação: mistura o modelo "do meio" (semente fixa) com um sorteio novo
    const mid = p[2](rng(12345)), rnd = p[2](rng(seed));
    const v = clamp(variation, 0, 100) / 100, out = { ...BASE, ...mid };
    for (const k of Object.keys(rnd)) {
      if (typeof rnd[k] === "number") out[k] = mid[k] + (rnd[k] - mid[k]) * v;
      else if (v > 0.5) out[k] = rnd[k];
    }
    out.freq *= Math.pow(2, pitch / 12);
    for (const k of ["attack", "sustain", "decay"]) out[k] *= clamp(length, 0.2, 4);
    out.preset = name; out.seed = seed;
    return out;
  }
  function mutate(p, amount = 0.1, seed = Date.now()) {
    const r = rng(seed), out = { ...p };
    for (const [k, , min, max] of FIELDS) if (typeof min === "number" && typeof out[k] === "number" && k !== "volume") out[k] = clamp(out[k] + (r() - 0.5) * 2 * amount * (max - min) * 0.25, min, max);
    return out;
  }
  function randomAll(seed = Date.now()) { const names = Object.keys(PRESETS), r = rng(seed); return fromPreset(names[Math.floor(r() * names.length)], { seed, variation: 100 }); }

  // ---------------------------------------------------------------- síntese
  function render(p) {
    p = { ...BASE, ...p };
    const total = p.attack + p.sustain + p.decay, n = Math.max(1, Math.ceil(total * SR) + 64), out = new Float32Array(n);
    const rnd = rng(p.seed || 7);
    let phase = 0, noiseVal = 0, lastCycle = -1, lp = 0, lpv = 0, hp = 0, hpPrev = 0;
    const flBuf = new Float32Array(2048); let flPos = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, tr = p.repeat > 0 ? t % p.repeat : t;
      // envelope
      let env;
      if (t < p.attack) env = t / Math.max(1e-4, p.attack);
      else if (t < p.attack + p.sustain) env = 1 + p.punch * (1 - (t - p.attack) / Math.max(1e-4, p.sustain));
      else env = Math.max(0, 1 - (t - p.attack - p.sustain) / Math.max(1e-4, p.decay));
      // altura: deslize, aceleração, arpejo, vibrato
      let f = p.freq * Math.pow(2, p.slide * tr + 0.5 * p.dslide * tr * tr);
      if (p.minFreq > 0 && f < p.minFreq) { if (p.slide < 0) env = 0; f = p.minFreq; }
      const arp = p.arp && p.arp.length > 1 && p.arpTime > 0 ? p.arp[Math.min(p.arp.length - 1, Math.floor(tr / p.arpTime))] : 1;
      f *= arp * (1 + p.vibDepth * Math.sin(2 * Math.PI * p.vibSpeed * t));
      f = clamp(f, 1, SR / 2.2);
      phase += f / SR;
      const ph = phase % 1, duty = clamp(p.duty + p.dutySweep * t, 0.02, 0.98);
      let s;
      switch (p.wave) {
        case "square": s = ph < duty ? 0.6 : -0.6; break;
        case "saw": s = (1 - ph * 2) * 0.6; break;
        case "sine": s = Math.sin(ph * 2 * Math.PI) * 0.7; break;
        case "triangle": s = (ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4) * 0.7; break;
        default: { // ruído com "altura": troca de valor a cada ciclo da onda
          const cyc = Math.floor(phase * 2);
          if (cyc !== lastCycle) { lastCycle = cyc; noiseVal = rnd() * 2 - 1; }
          s = noiseVal * 0.7;
        }
      }
      // filtro grave com ressonância (dois polos) e filtro agudo (um polo)
      const cut = clamp(p.lpf * Math.pow(2, p.lpfSweep * t), 40, SR / 2.05);
      if (cut < SR / 2.1) {
        const w = 2 * Math.sin((Math.PI * cut) / SR), q = 1 - p.res;
        lpv += w * (s - lp) - lpv * q * 0.5 * w; lp += lpv; s = lp;
        lpv *= 0.995;
      }
      if (p.hpf > 0) { const a = 1 / (1 + (2 * Math.PI * p.hpf) / SR); const y = a * (hp + s - hpPrev); hpPrev = s; hp = y; s = y; }
      // flanger
      if (p.flanger > 0 || p.flangerSweep) {
        flBuf[flPos & 2047] = s;
        const d = clamp(Math.round(((p.flanger + p.flangerSweep * t) / 1000) * SR), 0, 2000);
        s = (s + flBuf[(flPos - d) & 2047]) * 0.6; flPos++;
      }
      out[i] = s * Math.max(0, env) * p.volume;
    }
    // passou de 90%? abaixa tudo por igual (em vez de cortar os picos)
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0.9) { const k = 0.9 / peak; for (let i = 0; i < n; i++) out[i] *= k; }
    // micro-fade no fim (sem estalo)
    for (let i = 0; i < 64 && i < n; i++) out[n - 1 - i] *= i / 64;
    const buf = new AudioBuffer({ numberOfChannels: 1, length: n, sampleRate: SR });
    buf.copyToChannel(out, 0);
    return buf;
  }

  return { PRESETS, FIELDS, BASE, fromPreset, mutate, randomAll, render };
})();

// ------------------------------------------------------------------ WAV (PCM 16 bits)
PS.wav = (buf) => {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); str(8, "WAVE"); str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, ch, true); data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, "data"); data.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const v = clamp(chans[c][i], -1, 1); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(data.buffer);
};
