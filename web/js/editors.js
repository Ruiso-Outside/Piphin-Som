// Piphin Som · editores do clipe selecionado: piano roll (notas), sequenciador de bateria (passos) e áudio.
// Também ficam aqui os ritmos prontos e o escritor de acordes (usados pela tela e pela IA).
"use strict";
(() => {
  const S = PS.state;

  // ---------------------------------------------------------------- ritmos prontos (16 passos por compasso)
  PS.STYLES = {
    pop: { name: "Pop", kick: "x.......x.x.....", snare: "....x.......x...", hihat: "x.x.x.x.x.x.x.x." },
    rock: { name: "Rock", kick: "x.......x.x.....", snare: "....x.......x...", hihat: "x.x.x.x.x.x.x.x.", crash: "x..............." },
    hiphop: { name: "Hip-hop", kick: "x......x.x......", snare: "....x.......x...", hihat: "x.x.x.x.x.x.xxx.", openhat: "..............x." },
    trap: { name: "Trap", kick: "x.........x.....", snare: "........x.......", hihat: "x.xxx.x.xx.xxx.x", openhat: ".......x........" },
    house: { name: "House", kick: "x...x...x...x...", clap: "....x.......x...", hihat: "..x...x...x...x.", openhat: "..o...o...o...o." },
    lofi: { name: "Lo-fi", kick: "x.....x..x......", snare: "....x.......x..o", hihat: "x.o.x.o.x.o.x.o.", shaker: "o.o.o.o.o.o.o.o." },
    funk: { name: "Funk", kick: "x..x..x...x..x..", snare: "....x..o.o..x...", hihat: "xxxxxxxxxxxxxxxx", openhat: "..............x." },
    reggaeton: { name: "Reggaeton", kick: "x...x...x...x...", snare: "...x..x....x..x.", hihat: "x.x.x.x.x.x.x.x." },
    disco: { name: "Disco", kick: "x...x...x...x...", snare: "....x.......x...", openhat: "..x...x...x...x.", hihat: "x...x...x...x..." },
    bossa: { name: "Bossa nova", kick: "x..x..x.x..x..x.", rim: "x..x..x...x..x..", shaker: "xoxoxoxoxoxoxoxo" },
  };
  const FILL = { snare: "....x.x.xxxxxxxx", tom: "........x.x.x...", kick: "x.......x.......", crash: "" };
  const stepVal = (ch) => (ch === "x" || ch === "X" ? 1 : ch === "o" || ch === "O" ? 0.5 : 0);
  // escreve um ritmo num clipe de bateria a partir do compasso inicial
  PS.writeDrums = (t, { style = null, pattern = null, startBar = 1, bars = 4, fill = false } = {}) => {
    const bb = PS.barBeats(), start = (startBar - 1) * bb, len = bars * bb;
    t.clips = t.clips.filter((c) => c.start + PS.clipLen(c) <= start || c.start >= start + len);
    const c = PS.newClip("drums", start, len);
    const pat = pattern || PS.STYLES[style || "pop"];
    if (!pat) throw new Error("Ritmo desconhecido: " + style);
    const steps = Math.round(len * 4), per = bb * 4;
    for (const [piece] of PS.DRUMS) {
      const src = pat[piece]; c.steps[piece] = new Array(steps).fill(0);
      for (let i = 0; i < steps; i++) {
        const lastBar = fill && i >= steps - per;
        const str = lastBar && FILL[piece] !== undefined ? FILL[piece] || (piece === "crash" ? "" : src || "") : src || "";
        if (str) c.steps[piece][i] = stepVal(str[i % str.length]);
      }
      if (piece === "crash" && fill && steps > per) c.steps.crash[0] = Math.max(c.steps.crash[0], 1);
    }
    c.name = pattern ? "Batida" : PS.STYLES[style].name;
    t.clips.push(c);
    return c;
  };
  // escreve acordes num clipe de instrumento
  PS.writeChords = (t, { chords, startBar = 1, barsPerChord = 1, octave = 4, style = "bloco", repeat = 1 }) => {
    const bb = PS.barBeats(), seq = [];
    for (let r = 0; r < Math.max(1, repeat); r++) seq.push(...chords);
    const start = (startBar - 1) * bb, len = seq.length * barsPerChord * bb;
    t.clips = t.clips.filter((c) => c.start + PS.clipLen(c) <= start || c.start >= start + len);
    const c = PS.newClip("notes", start, len); c.name = chords.join(" ");
    seq.forEach((name, i) => {
      const ch = PS.parseChord(name, octave), at = i * barsPerChord * bb, dur = barsPerChord * bb;
      const add = (p, s, l, v = 0.75) => c.notes.push({ p, s: at + s, l, v });
      if (style === "arpejo") { const pat = [...ch.notes, ch.notes[1] + 12, ...ch.notes.slice(1).reverse()]; for (let k = 0; k * 0.5 < dur; k++) add(pat[k % pat.length], k * 0.5, 0.5, 0.7); }
      else if (style === "quebrado") { for (let k = 0; k < dur; k++) { add(ch.bass, k, 0.9, 0.8); ch.notes.slice(1).forEach((p) => add(p, k + 0.5, 0.45, 0.6)); } }
      else if (style === "ritmado") { for (let k = 0; k < dur; k += 0.5) { if ([0, 1.5, 2, 3].includes(k % 4)) ch.notes.forEach((p) => add(p, k, 0.45, k % 4 === 0 ? 0.85 : 0.65)); } }
      else if (style === "baixo") { for (let k = 0; k < dur; k++) add(ch.root - 12 * (octave >= 3 ? 2 : 1) + (k % 2 && k % 4 === 3 ? 7 : 0), k, 0.9, k % bb === 0 ? 0.9 : 0.7); }
      else ch.notes.forEach((p) => add(p, 0, dur - 0.05, 0.72));
    });
    t.clips.push(c);
    return c;
  };

  // ---------------------------------------------------------------- escalas (ajuda para quem não sabe teoria)
  PS.SCALES = { off: ["Nenhuma", []], maior: ["Maior", [0, 2, 4, 5, 7, 9, 11]], menor: ["Menor", [0, 2, 3, 5, 7, 8, 10]], penta: ["Pentatônica maior", [0, 2, 4, 7, 9]],
    pentam: ["Pentatônica menor", [0, 3, 5, 7, 10]], blues: ["Blues", [0, 3, 5, 6, 7, 10]], dorica: ["Dórica", [0, 2, 3, 5, 7, 9, 10]] };

  // ---------------------------------------------------------------- painel do editor
  const host = $("#editorBody"), title = $("#editorTitle"), tools = $("#editorTools");
  let view = { beatW: 56, rowH: 15, lo: 24, hi: 96 }; // piano roll
  let sel = new Set(); // notas selecionadas (índices)
  let lastLen = 1;

  function render() {
    const f = S.selClip && PS.findClip(S.selClip);
    if (!f) {
      const t = PS.track(S.selTrack);
      title.innerHTML = t ? `<i class="i i-info"></i> ${esc(t.name)}` : "Editor";
      tools.innerHTML = "";
      host.innerHTML = `<div class="ed-empty">${t ? (t.kind === "audio" ? "Grave com o microfone (botão vermelho) ou importe um áudio para esta faixa." : `Dê dois cliques na faixa <b>${esc(t.name)}</b> (no arranjo, acima) para criar um clipe, ou selecione um clipe para editar aqui.`) : "Selecione um clipe no arranjo para editar as notas, a batida ou o áudio."}</div>`;
      return;
    }
    if (f.c.type === "notes") pianoRoll(f.t, f.c);
    else if (f.c.type === "drums") drumGrid(f.t, f.c);
    else audioEditor(f.t, f.c);
  }
  PS.on("select", () => { sel.clear(); render(); });
  PS.on("song", (e) => { if (!e || !e.fromEditor) render(); });
  PS.on("beat", () => { const ph = $("#edPlayhead"); const f = S.selClip && PS.findClip(S.selClip); if (ph && f) { const x = (S.beat - f.c.start) * (f.c.type === "drums" ? cellW() / 0.25 : view.beatW); ph.style.left = x + (f.c.type === "notes" ? 52 : 120) + "px"; ph.hidden = x < 0 || S.beat > f.c.start + PS.clipLen(f.c); } });

  // ---------------------------------------------------------------- piano roll
  function pianoRoll(t, c) {
    title.innerHTML = `<i class="i i-piano"></i> ${esc(t.name)} · ${esc(c.name || "Notas")} <span class="dim">compassos ${Math.floor(c.start / PS.barBeats()) + 1}–${Math.floor((c.start + c.len) / PS.barBeats())}</span>`;
    const sc = S.scale || { root: 0, type: "off" };
    tools.innerHTML = `<label class="opt">Grade <select id="edSnap">${[[1, "1 tempo"], [0.5, "1/2"], [0.25, "1/4"], [0.125, "1/8"], [1 / 3, "tercina"]].map(([v, n]) => `<option value="${v}" ${Math.abs(S.snap - v) < 1e-6 ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="opt">Escala <select id="edRoot">${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].map((n, i) => `<option value="${i}" ${sc.root === i ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select id="edScale">${Object.entries(PS.SCALES).map(([k, [n]]) => `<option value="${k}" ${sc.type === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <button class="btn sm ghost" data-cmd="chords-dialog"><i class="i i-music-4"></i>Acordes...</button>
      <button class="btn sm ghost" data-cmd="notes-quantize" title="Alinhar as notas à grade"><i class="i i-magnet"></i>Alinhar</button>
      <button class="btn sm ghost" data-cmd="notes-clear" title="Apagar todas as notas"><i class="i i-trash-2"></i></button>
      <span class="opt-hint">Clique: nota · arraste: mover · ponta: duração · botão direito: apagar</span>`;
    $("#edSnap").onchange = (e) => { S.snap = Number(e.target.value); };
    $("#edRoot").onchange = $("#edScale").onchange = () => { S.scale = { root: Number($("#edRoot").value), type: $("#edScale").value }; render(); };
    const rows = view.hi - view.lo + 1, W = c.len * view.beatW, H = rows * view.rowH, scale = PS.SCALES[sc.type][1];
    host.innerHTML = `<div class="pr" id="pr"><div class="pr-keys" id="prKeys" style="height:${H}px"></div><div class="pr-grid"><canvas id="prCv" width="${Math.ceil(W)}" height="${H}"></canvas><i id="edPlayhead" class="ed-ph" hidden></i></div></div>`;
    const keys = $("#prKeys");
    for (let m = view.hi; m >= view.lo; m--) {
      const k = document.createElement("div");
      k.className = `pk ${PS.isBlack(m) ? "b" : "w"} ${m % 12 === 0 ? "c" : ""} ${scale.length && scale.includes(((m - sc.root) % 12 + 12) % 12) ? "in" : ""}`;
      k.style.height = view.rowH + "px"; k.dataset.m = m;
      k.textContent = m % 12 === 0 ? PS.noteName(m) : "";
      keys.appendChild(k);
    }
    keys.onmousedown = (e) => { const m = Number(e.target.dataset.m); if (!m) return; PS.engine.noteOn(t, m); const up = () => { PS.engine.noteOff(t, m); window.removeEventListener("mouseup", up); }; window.addEventListener("mouseup", up); };
    const cv = $("#prCv"), g = cv.getContext("2d");
    const yOf = (m) => (view.hi - m) * view.rowH, mOf = (y) => view.hi - Math.floor(y / view.rowH), bOf = (x) => x / view.beatW;
    function draw() {
      g.clearRect(0, 0, W, H);
      for (let m = view.hi; m >= view.lo; m--) {
        const inS = scale.length && scale.includes(((m - sc.root) % 12 + 12) % 12);
        g.fillStyle = PS.isBlack(m) ? "#0c0b12" : "#12111a"; if (inS) g.fillStyle = PS.isBlack(m) ? "#0f1f16" : "#13261b";
        g.fillRect(0, yOf(m), W, view.rowH);
        g.fillStyle = m % 12 === 0 ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.035)"; g.fillRect(0, yOf(m) + view.rowH - 1, W, 1);
      }
      const bb = PS.barBeats();
      for (let b = 0; b <= c.len; b += 0.25) { g.fillStyle = b % bb === 0 ? "rgba(255,255,255,.28)" : b % 1 === 0 ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.035)"; g.fillRect(Math.round(b * view.beatW), 0, 1, H); }
      c.notes.forEach((n, i) => {
        if (n.s >= c.len) return;
        const x = n.s * view.beatW, y = yOf(n.p), w = Math.max(3, Math.min(n.l, c.len - n.s) * view.beatW - 1);
        g.globalAlpha = 0.55 + 0.45 * (n.v ?? 0.8);
        g.fillStyle = sel.has(i) ? "#fff" : t.color; g.fillRect(x + 0.5, y + 1, w, view.rowH - 2);
        g.globalAlpha = 1; g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x + w - 3, y + 2, 2, view.rowH - 4);
      });
    }
    draw();
    // começa com a área das notas (ou dó central) à vista
    const ps = c.notes.map((n) => n.p);
    $("#pr").scrollTop = Math.max(0, yOf(ps.length ? Math.max(...ps) + 4 : 72) - 20);
    let dragN = null;
    cv.oncontextmenu = (e) => e.preventDefault();
    cv.onmousedown = (e) => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = bOf(x), m = mOf(y);
      const hit = c.notes.findIndex((n) => m === n.p && b >= n.s && b < n.s + n.l);
      if (e.button === 2) { if (hit >= 0) PS.edit("Apagar nota", () => { c.notes.splice(hit, 1); sel.clear(); }); return; }
      if (hit >= 0) {
        const n = c.notes[hit];
        if (!e.shiftKey && !sel.has(hit)) sel.clear();
        sel.add(hit);
        const edge = (n.s + n.l) * view.beatW - x < 7;
        dragN = { mode: edge ? "len" : "move", b0: b, m0: m, before: JSON.stringify(S.song), orig: [...sel].map((i) => ({ i, s: c.notes[i].s, p: c.notes[i].p, l: c.notes[i].l })) };
        PS.engine.noteOn(t, n.p); setTimeout(() => PS.engine.noteOff(t, n.p), 180);
        draw(); return;
      }
      // nota nova
      const s = Math.floor(b / S.snap) * S.snap;
      PS.edit("Nova nota", () => { c.notes.push({ p: m, s, l: lastLen, v: 0.8 }); });
      sel = new Set([c.notes.length - 1]);
      dragN = { mode: "len", b0: s, m0: m, before: null, orig: [{ i: c.notes.length - 1, s, p: m, l: lastLen }], fresh: true };
      PS.engine.noteOn(t, m); setTimeout(() => PS.engine.noteOff(t, m), 180);
      draw();
    };
    const mm = (e) => {
      if (!dragN || !document.body.contains(cv)) return;
      const r = cv.getBoundingClientRect(), b = bOf(e.clientX - r.left), m = mOf(e.clientY - r.top);
      for (const o of dragN.orig) {
        const n = c.notes[o.i]; if (!n) continue;
        if (dragN.mode === "len") n.l = Math.max(S.snap, Math.round((o.l + (b - (dragN.fresh ? o.s + o.l : dragN.b0))) / S.snap) * S.snap) || S.snap;
        else { n.s = clamp(Math.round((o.s + b - dragN.b0) / S.snap) * S.snap, 0, c.len - S.snap); n.p = clamp(o.p + (m - dragN.m0), view.lo, view.hi); }
      }
      draw();
    };
    const mu = () => {
      if (!dragN) return;
      const d = dragN; dragN = null;
      const n = c.notes[d.orig[0].i]; if (n) lastLen = n.l;
      if (d.before !== null && d.before !== JSON.stringify(S.song)) { S.past.push({ label: "Editar notas", json: d.before }); S.future = []; }
      S.dirty = true; PS.emit("song", { fromEditor: true });
    };
    window.onmousemove = mm; window.onmouseup = mu;
    host.onkeydown = null;
    PS.editorKeys = (e) => {
      if (!sel.size) return false;
      if (e.key === "Delete" || e.key === "Backspace") { PS.edit("Apagar notas", () => { c.notes = c.notes.filter((_, i) => !sel.has(i)); }); sel.clear(); return true; }
      const dir = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (dir) { PS.edit("Transpor", () => { for (const i of sel) c.notes[i].p = clamp(c.notes[i].p + dir * (e.shiftKey ? 12 : 1), 0, 127); }); return true; }
      return false;
    };
  }
  const cellW = () => 26;

  // ---------------------------------------------------------------- bateria
  function drumGrid(t, c) {
    title.innerHTML = `<i class="i i-drum"></i> ${esc(t.name)} · ${esc(c.name || "Batida")} <span class="dim">compassos ${Math.floor(c.start / PS.barBeats()) + 1}–${Math.floor((c.start + c.len) / PS.barBeats())}</span>`;
    tools.innerHTML = `<label class="opt">Ritmo pronto <select id="edStyle"><option value="">Escolher...</option>${Object.entries(PS.STYLES).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join("")}</select></label>
      <label class="opt">Kit <select id="edKit">${Object.entries(PS.KITS).map(([k, s]) => `<option value="${k}" ${t.kit === k ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
      <label class="opt">Swing <input type="range" id="edSwing" min="0" max="60" value="${S.song.swing || 0}"></label>
      <button class="btn sm ghost" data-cmd="drums-clear"><i class="i i-trash-2"></i>Limpar</button>
      <span class="opt-hint">Clique: batida forte · Shift + clique: fraca · arraste para pintar</span>`;
    $("#edStyle").onchange = (e) => { if (!e.target.value) return; const style = e.target.value; PS.edit("Ritmo pronto", () => { const bars = Math.round(c.len / PS.barBeats()), startBar = c.start / PS.barBeats() + 1; t.clips = t.clips.filter((x) => x !== c); const n = PS.writeDrums(t, { style, startBar, bars }); S.selClip = n.id; }); };
    $("#edKit").onchange = (e) => PS.edit("Kit da bateria", () => { t.kit = e.target.value; });
    $("#edSwing").onchange = (e) => PS.edit("Swing", () => { S.song.swing = Number(e.target.value); });
    const steps = Math.round(c.len * 4), per = PS.barBeats() * 4;
    let h = `<div class="dg" style="--cw:${cellW()}px"><i id="edPlayhead" class="ed-ph" hidden></i>`;
    for (const [piece, name] of PS.DRUMS) {
      const arr = c.steps[piece] || [];
      h += `<div class="dg-row"><button class="dg-name" data-piece="${piece}">${name}</button><div class="dg-cells">`;
      for (let i = 0; i < steps; i++) h += `<i class="cell ${arr[i] >= 1 ? "on" : arr[i] > 0 ? "soft" : ""} ${i % 4 === 0 ? "beat" : ""} ${i % per === 0 ? "bar" : ""}" data-p="${piece}" data-i="${i}"></i>`;
      h += `</div></div>`;
    }
    host.innerHTML = h + `</div>`;
    let paint = null;
    host.onmousedown = (e) => {
      const nm = e.target.closest(".dg-name");
      if (nm) { PS.engine.noteOn(t, nm.dataset.piece); return; }
      const cell = e.target.closest(".cell"); if (!cell) return;
      const p = cell.dataset.p, i = Number(cell.dataset.i), cur = (c.steps[p] || [])[i] || 0;
      const val = cur ? 0 : e.shiftKey ? 0.5 : 1;
      paint = { val, before: JSON.stringify(S.song) };
      setCell(p, i, val, cell);
      if (val) PS.engine.noteOn(t, p, val);
    };
    host.onmouseover = (e) => { if (!paint) return; const cell = e.target.closest(".cell"); if (cell) setCell(cell.dataset.p, Number(cell.dataset.i), paint.val, cell); };
    window.onmouseup = () => { if (!paint) return; const p = paint; paint = null; if (p.before !== JSON.stringify(S.song)) { S.past.push({ label: "Editar batida", json: p.before }); S.future = []; } S.dirty = true; PS.emit("song", { fromEditor: true }); };
    window.onmousemove = null;
    function setCell(p, i, v, el) { (c.steps[p] ||= new Array(steps).fill(0))[i] = v; el.className = `cell ${v >= 1 ? "on" : v > 0 ? "soft" : ""} ${i % 4 === 0 ? "beat" : ""} ${i % per === 0 ? "bar" : ""}`; }
    PS.editorKeys = () => false;
  }

  // ---------------------------------------------------------------- áudio
  function audioEditor(t, c) {
    const s = PS.sample(c.sample), buf = PS.engine.bufferOf(c.sample);
    title.innerHTML = `<i class="i i-audio-waveform"></i> ${esc(t.name)} · ${esc(s ? s.name : "?")}`;
    tools.innerHTML = `<button class="btn sm ghost" data-cmd="audio-normalize"><i class="i i-activity"></i>Normalizar</button>
      <button class="btn sm ghost" data-cmd="audio-reverse"><i class="i i-flip-horizontal-2"></i>Inverter</button>
      <button class="btn sm ghost" data-cmd="audio-play"><i class="i i-play"></i>Ouvir</button>`;
    const dur = buf ? buf.duration : s ? s.duration || 1 : 1;
    const row = (k, label, min, max, step, v, unit) => `<label class="fld"><span>${label}</span><input type="range" data-ak="${k}" min="${min}" max="${max}" step="${step}" value="${v}"><b>${fmt(v, 2)}${unit}</b></label>`;
    host.innerHTML = `<div class="ae"><canvas id="aeCv"></canvas><div class="ae-ctl">
      ${row("gain", "Volume", 0, 2, 0.01, c.gain ?? 1, "×")}${row("rate", "Velocidade/altura", 0.5, 2, 0.01, c.rate || 1, "×")}
      ${row("offset", "Começo (s)", 0, Math.max(0, dur - 0.05), 0.01, c.offset || 0, " s")}${row("dur", "Duração (s)", 0.05, dur, 0.01, c.dur ?? dur - (c.offset || 0), " s")}
      ${row("fadeIn", "Entrada suave (s)", 0, Math.min(5, dur), 0.01, c.fadeIn || 0, " s")}${row("fadeOut", "Saída suave (s)", 0, Math.min(5, dur), 0.01, c.fadeOut || 0, " s")}</div></div>`;
    const cv = $("#aeCv"), box = cv.getBoundingClientRect(), W = Math.max(300, Math.round(box.width)), H = 140;
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const drawWave = () => {
      g.clearRect(0, 0, W, H); g.fillStyle = "#0d0c14"; g.fillRect(0, 0, W, H);
      if (!buf) return;
      const d = buf.getChannelData(0);
      const a = (c.offset || 0) / dur * W, b = ((c.offset || 0) + (c.dur ?? dur - (c.offset || 0))) / dur * W;
      g.fillStyle = "rgba(34,197,94,.10)"; g.fillRect(a, 0, b - a, H);
      for (let x = 0; x < W; x++) {
        const i0 = Math.floor((x / W) * d.length), i1 = Math.floor(((x + 1) / W) * d.length);
        let m = 0; for (let i = i0; i < i1; i += Math.max(1, (i1 - i0) >> 6)) m = Math.max(m, Math.abs(d[i]));
        const h = Math.max(1, m * (c.gain ?? 1) * H * 0.9);
        g.fillStyle = x >= a && x <= b ? t.color : "rgba(255,255,255,.2)"; g.fillRect(x, (H - h) / 2, 1, h);
      }
    };
    drawWave();
    let before = null;
    host.oninput = (e) => {
      const k = e.target.dataset.ak; if (!k) return;
      if (!before) before = JSON.stringify(S.song);
      c[k] = Number(e.target.value);
      if (k === "offset" && (c.dur ?? 0) + c.offset > dur) c.dur = dur - c.offset;
      e.target.nextElementSibling.textContent = fmt(c[k], 2) + (k === "gain" || k === "rate" ? "×" : " s");
      drawWave();
    };
    host.onchange = () => { if (before && before !== JSON.stringify(S.song)) { S.past.push({ label: "Editar áudio", json: before }); S.future = []; } before = null; S.dirty = true; PS.emit("song", {}); };
    host.onmousedown = null; window.onmousemove = null; window.onmouseup = null;
    PS.editorKeys = () => false;
  }

  PS.editor = { render };
})();
