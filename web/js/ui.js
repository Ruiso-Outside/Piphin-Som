// Piphin Som · interface: transporte, abas, menus, inspetor (instrumento, mixagem e efeitos), teclado do
// computador como piano, gravação, importação, gerador de efeitos, exportação, projetos e pedidos da IA.
"use strict";
(() => {
  const S = PS.state, E = PS.engine;
  const call = async (ch, ...a) => { const r = await piphin.invoke(ch, ...a); if (!r.ok) throw new Error(r.error); return r.data; };
  PS.call = call;

  // ---------------------------------------------------------------- avisos, menus e diálogos
  PS.toast = (text, kind = "", action = null) => {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = `<span class="grow">${esc(text)}</span>` + (action ? `<button class="btn sm">${esc(action.label)}</button>` : "");
    if (action) el.querySelector("button").onclick = () => { action.run(); el.remove(); };
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), action ? 8000 : 3500);
  };
  const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(e); PS.toast(e.message, "err"); } };
  const modal = $("#modal"), box = $("#modalBox");
  let onClose = null;
  const openModal = (html, { cls = "", close, sticky = false } = {}) => { box.className = "modal-box " + cls; box.innerHTML = html; modal.hidden = false; onClose = close || null; modal.dataset.sticky = sticky ? "1" : ""; };
  const closeModal = () => { if (modal.hidden) return; modal.hidden = true; box.innerHTML = ""; const f = onClose; onClose = null; if (f) f(); };
  modal.addEventListener("mousedown", (e) => { if (e.target === modal && !modal.dataset.sticky) closeModal(); });
  const confirmBox = (title, text, buttons, danger) => new Promise((resolve) => {
    openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${i === 0 ? (danger ? "danger solid" : "primary") : ""}" data-i="${i}">${esc(b)}</button>`).join("")}</div>`, { close: () => resolve(buttons.length - 1) });
    box.querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { onClose = null; closeModal(); resolve(Number(b.dataset.i)); }));
  });
  const pop = $("#menuPop");
  let openMenu = null;
  let hubLib = false; // Hub 1.7.0+: Mídia compartilhada entre os módulos
  PS.menu = (x, y, items, idx = -1) => {
    pop.innerHTML = items.map((it) => it === "-" ? `<div class="sep"></div>` : `<button class="mi" data-cmd="${it[0]}" ${it[4] ? "disabled" : ""}><i class="i i-${it[1]}"></i>${esc(it[2])}${it[3] ? `<span class="k">${it[3]}</span>` : ""}</button>`).join("");
    pop.hidden = false;
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.min(x, innerWidth - r.width - 8) + "px"; pop.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
    openMenu = idx;
    $$("#menus button").forEach((b, j) => b.classList.toggle("open", j === idx));
  };
  const hideMenu = () => { pop.hidden = true; openMenu = null; $$("#menus button").forEach((b) => b.classList.remove("open")); };
  document.addEventListener("mousedown", (e) => { if (openMenu !== null && !pop.contains(e.target) && !e.target.closest("#menus")) hideMenu(); });
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-cmd]"); if (!b || b.disabled) return; hideMenu(); PS.cmd(b.dataset.cmd, b.dataset); });

  // ---------------------------------------------------------------- abas
  function setTab(tab) {
    S.tab = tab;
    $("#musicView").hidden = tab !== "music"; $("#sfxView").hidden = tab !== "sfx";
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    if (tab === "sfx") renderSfx(); else PS.arrange.render();
  }
  $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });

  // ---------------------------------------------------------------- transporte
  PS.seek = (b) => { const was = S.playing; if (was) E.stop(); S.beat = Math.max(0, b); PS.emit("beat", S.beat); if (was) E.play(S.beat); };
  PS.on("beat", (b) => { $("#posBar").textContent = PS.posText(b); $("#posTime").textContent = PS.timeText(PS.beatsToSec(b)); });
  PS.on("playing", (p) => { $("#playBtn").innerHTML = `<i class="i i-${p ? "pause" : "play"}"></i>`; if (!p && E.isRecording()) finishRecording(); if (!p && midiRec) finishMidiRec(); });
  PS.on("loop", () => $("#loopBtn").classList.toggle("on", !!S.song.loop.on));
  $("#bpm").addEventListener("change", (e) => { const v = clamp(Math.round(Number(e.target.value) || 110), 40, 240); e.target.value = v; PS.edit("Andamento", () => { S.song.bpm = v; }); });
  // medidor de volume
  (() => {
    const cv = $("#vu"), g = cv.getContext("2d"), data = new Float32Array(2048);
    const draw = () => {
      g.clearRect(0, 0, 90, 26);
      const an = (E.isRecording() && E.recLevel()) || E.analyser;
      let peak = 0;
      if (an) { an.getFloatTimeDomainData(data); for (let i = 0; i < data.length; i += 2) peak = Math.max(peak, Math.abs(data[i])); }
      const w = Math.min(1, peak) * 82;
      const grad = g.createLinearGradient(4, 0, 86, 0); grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.75, "#facc15"); grad.addColorStop(1, "#ef4444");
      g.fillStyle = "#1a1925"; g.fillRect(4, 10, 82, 6);
      g.fillStyle = grad; g.fillRect(4, 10, w, 6);
      requestAnimationFrame(draw);
    };
    draw();
  })();
  // altura do editor: arrastar a borda
  (() => {
    let y0 = null, h0 = 0; const ed = $("#editor");
    ed.addEventListener("mousedown", (e) => { if (e.target === ed && e.offsetY < 5) { y0 = e.clientY; h0 = ed.offsetHeight; e.preventDefault(); } });
    window.addEventListener("mousemove", (e) => { if (y0 !== null) document.documentElement.style.setProperty("--ed-h", clamp(h0 - (e.clientY - y0), 120, innerHeight - 200) + "px"); });
    window.addEventListener("mouseup", () => { y0 = null; });
  })();

  // ---------------------------------------------------------------- inspetor
  const sld = (key, label, min, max, step, val, show) => `<label class="fld"><span>${label}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><b>${show ?? val}</b></label>`;
  function renderInspector() {
    const el = $("#inspector"), t = PS.track(S.selTrack);
    if (!t) {
      const s = S.song;
      el.innerHTML = `<div class="ins-head"><span>Música</span></div><div class="ins-body">
        <label class="fld two"><span>Nome</span><input type="text" data-s="name" value="${esc(s.name)}"></label>
        <label class="fld two"><span>Compasso</span><select data-s="beatsPerBar">${[2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${s.beatsPerBar === n ? "selected" : ""}>${n}/4</option>`).join("")}</select></label>
        <label class="fld two"><span>Compassos</span><input type="number" data-s="bars" min="1" max="999" value="${s.bars}"></label>
        ${sld("master", "Volume geral", 0, 150, 1, Math.round((s.master.volume ?? 0.9) * 100), Math.round((s.master.volume ?? 0.9) * 100) + "%")}
        ${sld("swing", "Swing", 0, 60, 1, s.swing || 0, (s.swing || 0) + "%")}
        <div class="kvs"><span>Faixas</span><span>${s.tracks.length}</span><span>Duração</span><span>${PS.timeText(PS.beatsToSec(PS.contentBeats()))}</span></div>
        <button class="btn sm" data-cmd="demo"><i class="i i-sparkles"></i>Criar uma música de exemplo</button>
        <p class="hint">Clique numa faixa para ver o instrumento, a mixagem e os efeitos dela.<br><br>
          Toque notas com o teclado do computador: <kbd>Z</kbd>…<kbd>M</kbd> e <kbd>Q</kbd>…<kbd>U</kbd> (oitavas com <kbd>PgUp</kbd>/<kbd>PgDn</kbd>). <kbd>Espaço</kbd> toca, <kbd>L</kbd> repete o trecho marcado.</p></div>`;
      return;
    }
    const f = { ...PS.defaultFx(), ...t.fx }, P = t.inst || {};
    let h = `<div class="ins-head"><span>Faixa</span><div class="row-btns">
      <button class="btn sm icon ghost" data-cmd="track-up" title="Subir"><i class="i i-chevron-up"></i></button><button class="btn sm icon ghost" data-cmd="track-down" title="Descer"><i class="i i-chevron-down"></i></button>
      <button class="btn sm icon ghost" data-cmd="track-dup" title="Duplicar faixa"><i class="i i-copy"></i></button><button class="btn sm icon ghost" data-cmd="track-del" title="Apagar faixa"><i class="i i-trash-2"></i></button></div></div>
      <div class="ins-body"><label class="fld two"><span>Nome</span><input type="text" data-k="name" value="${esc(t.name)}"></label>
      <div class="swatches">${PS.COLORS.map((c) => `<button style="background:${c}" class="${t.color === c ? "on" : ""}" data-color="${c}" title="Cor da faixa"></button>`).join("")}</div>`;
    if (t.kind === "inst") {
      h += `<div class="ins-sec"><h4><i class="i i-piano"></i>Instrumento</h4><div class="presets">${Object.entries(PS.PRESETS).map(([k, p]) => `<button class="${P.preset === k ? "on" : ""}" data-preset="${k}"><i class="i i-${p.icon}"></i>${esc(p.name)}</button>`).join("")}</div>
        <details class="more"><summary>Ajustar o som</summary><div class="ins-sec">
          <label class="fld two"><span>Onda</span><select data-k="inst.osc1">${["sawtooth", "square", "triangle", "sine", "pulse"].map((w) => `<option value="${w}" ${P.osc1 === w ? "selected" : ""}>${{ sawtooth: "Serra", square: "Quadrada", triangle: "Triângulo", sine: "Senoide", pulse: "Pulso" }[w]}</option>`).join("")}</select></label>
          ${sld("inst.octave", "Oitava", -2, 2, 1, P.octave || 0)}${sld("inst.attack", "Ataque", 0, 2, 0.005, P.attack, fmt(P.attack, 2) + " s")}${sld("inst.decay", "Queda", 0.01, 4, 0.01, P.decay, fmt(P.decay, 2) + " s")}
          ${sld("inst.sustain", "Sustentação", 0, 1, 0.01, P.sustain, Math.round(P.sustain * 100) + "%")}${sld("inst.release", "Soltura", 0.01, 4, 0.01, P.release, fmt(P.release, 2) + " s")}
          ${sld("inst.cutoff", "Brilho (filtro)", 100, 16000, 10, P.cutoff, Math.round(P.cutoff) + " Hz")}${sld("inst.res", "Ressonância", 0.1, 15, 0.1, P.res, fmt(P.res, 1))}
          ${sld("inst.fenv", "Envelope do filtro", 0, 5, 0.1, P.fenv, fmt(P.fenv, 1))}${sld("inst.unison", "Vozes (uníssono)", 1, 6, 1, P.unison)}${sld("inst.spread", "Abertura", 0, 50, 1, P.spread)}
          ${sld("inst.fm", "FM (metálico)", 0, 10, 0.1, P.fm, fmt(P.fm, 1))}${sld("inst.vibrato", "Vibrato", 0, 40, 1, P.vibrato)}${sld("inst.gain", "Nível", 0.05, 1.2, 0.01, P.gain, Math.round(P.gain * 100) + "%")}
        </div></details></div>`;
    } else if (t.kind === "drums") {
      h += `<div class="ins-sec"><h4><i class="i i-drum"></i>Bateria</h4><label class="fld two"><span>Kit</span><select data-k="kit">${Object.entries(PS.KITS).map(([k, s]) => `<option value="${k}" ${t.kit === k ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>
        <div class="presets">${PS.DRUMS.map(([p, n]) => `<button data-hit="${p}"><i class="i i-drum"></i>${n}</button>`).join("")}</div></div>`;
    } else h += `<div class="ins-sec"><h4><i class="i i-mic"></i>Áudio</h4><p class="hint">Grave com o microfone: selecione esta faixa e aperte o botão vermelho (ou Shift+R). Ou arraste arquivos de áudio para cá.</p>
      <button class="btn sm" data-cmd="import"><i class="i i-import"></i>Importar áudio...</button>${hubLib ? `<button class="btn sm" data-cmd="library"><i class="i i-library"></i>Da Mídia...</button>` : ""}</div>`;
    h += `<div class="ins-sec"><h4><i class="i i-sliders-horizontal"></i>Mixagem</h4>${sld("volume", "Volume", 0, 150, 1, Math.round((t.volume ?? 0.8) * 100), Math.round((t.volume ?? 0.8) * 100) + "%")}
        ${sld("pan", "Esquerda/direita", -100, 100, 1, Math.round((t.pan || 0) * 100), Math.round((t.pan || 0) * 100))}</div>
      <div class="ins-sec"><h4><i class="i i-sparkles"></i>Efeitos</h4>
        ${sld("fx.reverb", "Reverb (sala)", 0, 100, 1, f.reverb, f.reverb + "%")}${sld("fx.delay", "Eco", 0, 100, 1, f.delay, f.delay + "%")}
        <label class="fld two"><span>Tempo do eco</span><select data-k="fx.delayTime">${[[0.25, "1/16"], [0.5, "1/8"], [0.75, "1/8 pontuada"], [1, "1/4"], [1.5, "1/4 pontuada"], [2, "1/2"]].map(([v, n]) => `<option value="${v}" ${f.delayTime === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        ${sld("fx.distortion", "Distorção", 0, 100, 1, f.distortion, f.distortion + "%")}
        ${sld("fx.lowpass", "Corta agudos", 200, 20000, 50, f.lowpass, f.lowpass >= 20000 ? "off" : Math.round(f.lowpass) + " Hz")}${sld("fx.highpass", "Corta graves", 20, 2000, 5, f.highpass, f.highpass <= 20 ? "off" : Math.round(f.highpass) + " Hz")}
        ${sld("fx.eqLow", "Graves", -15, 15, 0.5, f.eqLow, f.eqLow + " dB")}${sld("fx.eqMid", "Médios", -15, 15, 0.5, f.eqMid, f.eqMid + " dB")}${sld("fx.eqHigh", "Agudos", -15, 15, 0.5, f.eqHigh, f.eqHigh + " dB")}
        <label class="chk"><input type="checkbox" data-k="fx.comp" ${f.comp ? "checked" : ""}>Compressor (deixa o volume mais uniforme)</label></div></div>`;
    el.innerHTML = h;
  }
  let liveBefore = null;
  const liveSet = (fn) => { if (!liveBefore) liveBefore = JSON.stringify(S.song); fn(); S.dirty = true; PS.emit("mix"); };
  const liveCommit = (label) => { if (liveBefore && liveBefore !== JSON.stringify(S.song)) { S.past.push({ label, json: liveBefore }); S.future = []; } liveBefore = null; PS.emit("song", { soft: true }); };
  $("#inspector").addEventListener("input", (e) => {
    const k = e.target.dataset.k, sk = e.target.dataset.s, v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (sk) return liveSet(() => { const s = S.song; if (sk === "name") s.name = v; });
    if (!k) return;
    if (k === "master" || k === "swing") { liveSet(() => { if (k === "master") S.song.master.volume = Number(v) / 100; else S.song.swing = Number(v); }); e.target.nextElementSibling.textContent = v + "%"; return; }
    const t = PS.track(S.selTrack); if (!t) return;
    liveSet(() => {
      const num = Number(v), [a, b] = k.split(".");
      if (k === "volume") t.volume = num / 100;
      else if (k === "pan") t.pan = num / 100;
      else if (k === "name") t.name = v;
      else if (k === "kit") t.kit = v;
      else if (b) t[a][b] = typeof v === "boolean" || isNaN(num) || /osc|preset/.test(b) ? v : num;
    });
    const out = e.target.nextElementSibling;
    if (out && out.tagName === "B") out.textContent = /fx\.(reverb|delay|distortion)|volume/.test(k) ? v + "%" : /lowpass/.test(k) && Number(v) >= 20000 ? "off" : /highpass/.test(k) && Number(v) <= 20 ? "off" : /eq/.test(k) ? v + " dB" : /cutoff|pass/.test(k) ? Math.round(v) + " Hz" : fmt(Number(v), 2);
    if (k === "name") $$(".arr-row.sel .tn").forEach((x) => (x.textContent = v));
  });
  $("#inspector").addEventListener("change", (e) => {
    if (e.target.dataset.s === "beatsPerBar" || e.target.dataset.s === "bars") { const k = e.target.dataset.s, v = Math.max(1, Math.round(Number(e.target.value))); PS.edit(k === "bars" ? "Tamanho da música" : "Compasso", () => { S.song[k] = v; }); return; }
    if (e.target.dataset.k || e.target.dataset.s) liveCommit("Ajustes da faixa");
  });
  $("#inspector").addEventListener("click", (e) => {
    const t = PS.track(S.selTrack);
    const pb = e.target.closest("[data-preset]"), cb = e.target.closest("[data-color]"), hb = e.target.closest("[data-hit]");
    if (pb && t) { const key = pb.dataset.preset; PS.edit("Instrumento", () => { t.inst = { preset: key, ...JSON.parse(JSON.stringify(PS.PRESETS[key].params)) }; if (Object.values(PS.PRESETS).some((p) => p.name === t.name) || /^Instrumento/.test(t.name)) t.name = PS.PRESETS[key].name; }); E.noteOn(t, 60); setTimeout(() => E.noteOff(t, 60), 400); }
    if (cb && t) PS.edit("Cor da faixa", () => { t.color = cb.dataset.color; });
    if (hb && t) E.noteOn(t, hb.dataset.hit);
  });
  PS.on("select", renderInspector);
  PS.on("song", (e) => { if (!(e && e.soft)) renderInspector(); $("#bpm").value = S.song.bpm; $("#loopBtn").classList.toggle("on", !!S.song.loop.on); });

  // ---------------------------------------------------------------- comandos
  const selClip = () => S.selClip && PS.findClip(S.selClip);
  function addTrack(kind, opts = {}) {
    return PS.edit("Nova faixa", () => { const t = PS.newTrack(kind, opts); S.song.tracks.push(t); S.selTrack = t.id; S.selClip = null; return t; });
  }
  async function ensureAudioTrack(trackId) {
    let t = trackId ? PS.track(trackId) : PS.track(S.selTrack);
    if (!t || t.kind !== "audio") t = S.song.tracks.find((x) => x.kind === "audio") || addTrack("audio");
    return t;
  }
  // amostra nova a partir de bytes (arquivo importado, gravação ou efeito gerado)
  async function addSample({ name, path, bytes }) {
    const s = { id: PS.uid("s"), name, path };
    S.song.samples.push(s);
    await E.loadSample(s, bytes);
    return s;
  }
  PS.importFiles = guard(async (files, { beat = S.beat, track = null } = {}) => {
    const t = await ensureAudioTrack(track);
    let b = beat;
    for (const f of files) {
      const isFile = f instanceof File;
      const bytes = isFile ? new Uint8Array(await f.arrayBuffer()) : f.bytes;
      let path = isFile ? null : f.path;
      // arquivo arrastado (sem caminho): guarda uma cópia em WAV para o projeto encontrar depois
      let s;
      if (!path) {
        const tmp = { id: PS.uid("s"), name: f.name };
        const buf = await E.ensure().decodeAudioData(bytes.buffer.slice(0));
        const saved = await call("save-sample", PS.wav(buf), f.name.replace(/\.[^.]+$/, ""));
        tmp.path = saved.path; tmp.name = f.name;
        S.song.samples.push(tmp); E.setBuffer(tmp.id, buf); tmp.duration = buf.duration; s = tmp;
      } else s = await addSample({ name: f.name, path, bytes });
      PS.edit("Importar áudio", () => { const c = { id: PS.uid("c"), type: "audio", sample: s.id, start: b, offset: 0, gain: 1, rate: 1 }; t.clips.push(c); S.selClip = c.id; S.selTrack = t.id; });
      b += PS.secToBeats(s.duration || 1);
    }
    PS.emit("samples");
    PS.toast(files.length > 1 ? `${files.length} áudios importados` : "Áudio importado", "ok");
  });
  async function newSampleFromBuffer(buf, name) {
    const saved = await call("save-sample", PS.wav(buf), name);
    const s = { id: PS.uid("s"), name, path: saved.path, duration: buf.duration };
    S.song.samples.push(s); E.setBuffer(s.id, buf);
    return s;
  }
  // processamento de amostra (cria uma amostra nova; a original fica)
  async function processClip(label, fn) {
    const f = selClip(); if (!f || f.c.type !== "audio") return;
    const src = E.bufferOf(f.c.sample); if (!src) throw new Error("Áudio não carregado");
    const out = new AudioBuffer({ numberOfChannels: src.numberOfChannels, length: src.length, sampleRate: src.sampleRate });
    for (let ch = 0; ch < src.numberOfChannels; ch++) out.copyToChannel(fn(new Float32Array(src.getChannelData(ch))), ch);
    const s = await newSampleFromBuffer(out, (PS.sample(f.c.sample) || {}).name || label);
    PS.edit(label, () => { f.c.sample = s.id; if (label === "Inverter") f.c.offset = Math.max(0, out.duration - (f.c.offset || 0) - (f.c.dur ?? out.duration - (f.c.offset || 0))); });
  }
  const CMD = {
    play: () => E.toggle(), stop: () => { E.stop(); PS.seek(S.song.loop.on ? S.song.loop.start : 0); },
    loop: () => { S.song.loop.on = !S.song.loop.on; if (S.song.loop.end <= S.song.loop.start) S.song.loop = { on: true, start: 0, end: PS.barBeats() * 4 }; S.dirty = true; PS.emit("loop"); PS.arrange.render(); },
    metronome: () => { const on = E.metronome(); $("#metroBtn").classList.toggle("on", on); },
    record: () => toggleRecord(),
    undo: () => { const l = PS.undo(); if (l) PS.toast("Desfeito: " + l, "info"); }, redo: () => PS.redo(),
    "add-inst": () => addTrack("inst", { instrument: "piano" }), "add-drums": () => { const t = addTrack("drums"); PS.edit("Batida", () => { const c = PS.writeDrums(t, { style: "pop", startBar: 1, bars: 4 }); S.selClip = c.id; }); }, "add-audio": () => addTrack("audio"),
    import: guard(async () => { const list = await call("import-dialog"); if (list.length) await PS.importFiles(list); }),
    library: guard(async () => { const list = await call("library-pick"); if (list.length) await PS.importFiles(list); }),
    "clip-dup": () => { const f = selClip(); if (f) PS.edit("Duplicar clipe", () => { const c = JSON.parse(JSON.stringify(f.c)); c.id = PS.uid("c"); c.start = f.c.start + PS.clipLen(f.c); f.t.clips.push(c); S.selClip = c.id; }); },
    "clip-del": () => { const f = selClip(); if (f) PS.edit("Apagar clipe", () => { f.t.clips = f.t.clips.filter((x) => x !== f.c); S.selClip = null; }); },
    "clip-split": () => {
      const f = selClip(); if (!f) return;
      const at = Math.round((S.beat - f.c.start) * 4) / 4;
      if (at <= 0 || at >= PS.clipLen(f.c)) return PS.toast("Coloque o cursor dentro do clipe para dividir", "warn");
      PS.edit("Dividir clipe", () => {
        const b = JSON.parse(JSON.stringify(f.c)); b.id = PS.uid("c"); b.start = f.c.start + at;
        if (f.c.type === "notes") { b.notes = f.c.notes.filter((n) => n.s >= at).map((n) => ({ ...n, s: n.s - at })); f.c.notes = f.c.notes.filter((n) => n.s < at); b.len = f.c.len - at; f.c.len = at; }
        else if (f.c.type === "drums") { for (const k of Object.keys(f.c.steps)) { b.steps[k] = f.c.steps[k].slice(at * 4); f.c.steps[k] = f.c.steps[k].slice(0, at * 4); } b.len = f.c.len - at; f.c.len = at; }
        else { const sec = PS.beatsToSec(at) * (f.c.rate || 1), total = f.c.dur ?? ((PS.engine.bufferOf(f.c.sample) || {}).duration || 0) - (f.c.offset || 0); b.offset = (f.c.offset || 0) + sec; b.dur = total - sec; f.c.dur = sec; }
        f.t.clips.push(b);
      });
    },
    "track-del": async () => { const t = PS.track(S.selTrack); if (!t) return; if (t.clips.length && (await confirmBox(`Apagar a faixa "${t.name}"?`, "Os clipes dela também serão apagados (dá para desfazer).", ["Apagar", "Cancelar"], true)) !== 0) return; PS.edit("Apagar faixa", () => { S.song.tracks = S.song.tracks.filter((x) => x !== t); S.selTrack = null; S.selClip = null; }); },
    "track-dup": () => { const t = PS.track(S.selTrack); if (t) PS.edit("Duplicar faixa", () => { const n = JSON.parse(JSON.stringify(t)); n.id = PS.uid("t"); n.name += " (cópia)"; n.clips.forEach((c) => (c.id = PS.uid("c"))); S.song.tracks.splice(S.song.tracks.indexOf(t) + 1, 0, n); S.selTrack = n.id; }); },
    "track-up": () => moveTrack(-1), "track-down": () => moveTrack(1),
    "notes-quantize": () => { const f = selClip(); if (f && f.c.type === "notes") PS.edit("Alinhar notas", () => { for (const n of f.c.notes) { n.s = Math.round(n.s / S.snap) * S.snap; n.l = Math.max(S.snap, Math.round(n.l / S.snap) * S.snap); } }); },
    "notes-clear": () => { const f = selClip(); if (f && f.c.type === "notes") PS.edit("Apagar notas", () => { f.c.notes = []; }); },
    "drums-clear": () => { const f = selClip(); if (f && f.c.type === "drums") PS.edit("Limpar batida", () => { f.c.steps = {}; }); },
    "chords-dialog": () => chordsDialog(),
    "audio-normalize": guard(() => processClip("Normalizar", (d) => { let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); const k = m > 0 ? 0.97 / m : 1; for (let i = 0; i < d.length; i++) d[i] *= k; return d; })),
    "audio-reverse": guard(() => processClip("Inverter", (d) => d.reverse())),
    "audio-play": () => { const f = selClip(); if (f) PS.seek(f.c.start), E.play(f.c.start); },
    new: () => newSongDialog(), open: guard(async () => { if (!(await leaveOk())) return; const r = await call("open-project-dialog"); if (r) await loadProject(r); }),
    save: guard(() => saveProject(false)), "save-as": guard(() => saveProject(true)), export: () => exportDialog(),
    demo: () => demoSong(), shortcuts: () => shortcutsDialog(),
    "zoom-in": () => { S.zoom = clamp(S.zoom * 1.3, 4, 160); PS.arrange.render(); }, "zoom-out": () => { S.zoom = clamp(S.zoom / 1.3, 4, 160); PS.arrange.render(); },
  };
  PS.cmd = (n, d) => { if (CMD[n]) return CMD[n](d); };
  function moveTrack(dir) { const t = PS.track(S.selTrack); if (!t) return; const i = S.song.tracks.indexOf(t), j = i + dir; if (j < 0 || j >= S.song.tracks.length) return; PS.edit("Mover faixa", () => { S.song.tracks.splice(i, 1); S.song.tracks.splice(j, 0, t); }); }

  const MENUS = [
    ["Arquivo", [["new", "file-plus", "Nova música...", "Ctrl+N"], ["open", "folder-open", "Abrir projeto...", "Ctrl+O"], ["save", "save", "Salvar projeto", "Ctrl+S"], ["save-as", "save", "Salvar como...", "Ctrl+Shift+S"], "-",
      ["import", "import", "Importar áudio...", "Ctrl+I"], ["library", "library", "Importar da Mídia do Hub..."], ["export", "download", "Exportar (MP3, WAV...)", "Ctrl+E"]]],
    ["Editar", [["undo", "undo-2", "Desfazer", "Ctrl+Z"], ["redo", "redo-2", "Refazer", "Ctrl+Shift+Z"], "-", ["clip-dup", "copy", "Duplicar clipe", "Ctrl+D"], ["clip-split", "scissors", "Dividir clipe no cursor"],
      ["clip-del", "trash-2", "Apagar clipe", "Delete"], "-", ["shortcuts", "keyboard", "Atalhos e teclado musical"]]],
    ["Inserir", [["add-inst", "piano", "Faixa de instrumento"], ["add-drums", "drum", "Faixa de bateria"], ["add-audio", "mic", "Faixa de áudio"], "-", ["chords-dialog", "music-4", "Acordes na faixa selecionada..."], ["demo", "sparkles", "Música de exemplo"]]],
    ["Exibir", [["zoom-in", "zoom-in", "Aproximar"], ["zoom-out", "zoom-out", "Afastar"], ["metronome", "timer", "Metrônomo", "Shift+M"], ["loop", "repeat", "Repetir trecho", "L"]]],
  ];
  $("#menus").innerHTML = MENUS.map(([n], i) => `<button data-menu="${i}">${n}</button>`).join("");
  $$("#menus button").forEach((b) => {
    const show = () => { const i = Number(b.dataset.menu), r = b.getBoundingClientRect(); PS.menu(r.left, r.bottom + 4, MENUS[i][1], i); };
    b.addEventListener("mousedown", (e) => { e.preventDefault(); openMenu === Number(b.dataset.menu) ? hideMenu() : show(); });
    b.addEventListener("mouseenter", () => { if (openMenu !== null && openMenu >= 0 && openMenu !== Number(b.dataset.menu)) show(); });
  });

  // ---------------------------------------------------------------- diálogos
  function newSongDialog() {
    openModal(`<h3>Nova música</h3><div class="form"><label>Nome<input type="text" id="nN" value="Música nova"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><label>Andamento (BPM)<input type="number" id="nB" value="110" min="40" max="240"></label>
      <label>Compasso<select id="nT">${[3, 4, 6].map((n) => `<option value="${n}" ${n === 4 ? "selected" : ""}>${n}/4</option>`).join("")}</select></label><label>Compassos<input type="number" id="nL" value="16" min="1" max="999"></label></div>
      <label class="chk"><input type="checkbox" id="nS" checked> Começar com bateria, baixo e piano</label></div>
      <div class="modal-actions"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok>Criar</button></div>`);
    box.querySelector("[data-x]").onclick = closeModal;
    box.querySelector("[data-ok]").onclick = guard(async () => {
      const o = { name: $("#nN").value.trim() || "Música nova", bpm: clamp(Number($("#nB").value) || 110, 40, 240), beatsPerBar: Number($("#nT").value), bars: clamp(Number($("#nL").value) || 16, 1, 999) }, starter = $("#nS").checked;
      closeModal();
      if (!(await leaveOk())) return;
      resetSong(PS.newSong(o));
      if (starter) starterTracks();
    });
  }
  function resetSong(song, path = null) {
    E.stop(); S.song = song; S.path = path; S.past = []; S.future = []; S.dirty = false; S.beat = 0; S.selTrack = null; S.selClip = null;
    PS.emit("song", {}); PS.emit("select"); PS.emit("beat", 0); PS.emit("loop");
  }
  function starterTracks() {
    S.song.tracks.push(PS.newTrack("drums"), PS.newTrack("inst", { instrument: "baixo" }), PS.newTrack("inst", { instrument: "piano" }));
    S.selTrack = S.song.tracks[2].id;
    PS.emit("song", {}); PS.emit("select");
  }
  function demoSong() {
    PS.edit("Música de exemplo", () => {
      S.song = { ...PS.newSong({ name: "Exemplo", bpm: 96 }), loop: { on: false, start: 0, end: 16 } };
      const drums = PS.newTrack("drums", { kit: "lofi" }); S.song.tracks.push(drums);
      const bass = PS.newTrack("inst", { instrument: "baixo" }); S.song.tracks.push(bass);
      const keys = PS.newTrack("inst", { instrument: "piano-eletrico" }); keys.fx.reverb = 35; S.song.tracks.push(keys);
      const lead = PS.newTrack("inst", { instrument: "pluck" }); lead.fx.delay = 30; lead.fx.reverb = 25; lead.volume = 0.6; S.song.tracks.push(lead);
      const prog = ["Am7", "Fmaj7", "C", "G"];
      PS.writeDrums(drums, { style: "lofi", startBar: 1, bars: 8, fill: true });
      PS.writeDrums(drums, { style: "lofi", startBar: 9, bars: 8, fill: true });
      PS.writeChords(bass, { chords: prog, startBar: 1, octave: 3, style: "baixo", repeat: 4 });
      PS.writeChords(keys, { chords: prog, startBar: 1, octave: 4, style: "ritmado", repeat: 4 });
      const mel = PS.newClip("notes", 32, 32); mel.name = "Melodia";
      const line = [[76, 0, 1], [74, 1, 0.5], [72, 1.5, 0.5], [69, 2, 2], [72, 4, 1], [74, 5, 1], [76, 6, 2], [77, 8, 1.5], [76, 9.5, 0.5], [74, 10, 2], [72, 12, 1], [71, 13, 1], [74, 14, 2]];
      for (let rep = 0; rep < 2; rep++) for (const [p, s, l] of line) mel.notes.push({ p, s: s + rep * 16, l, v: 0.8 });
      lead.clips.push(mel);
      S.selTrack = lead.id; S.selClip = mel.id;
    });
    PS.emit("select");
    PS.toast("Música de exemplo criada. Aperte Espaço para ouvir!", "ok");
  }
  function chordsDialog() {
    const t = PS.track(S.selTrack);
    if (!t || t.kind !== "inst") return PS.toast("Selecione uma faixa de instrumento", "warn");
    openModal(`<h3>Acordes</h3><p>Escreva os acordes separados por espaço. Ex.: <b>Am F C G</b>, <b>C G Am F</b>, <b>Dm7 G7 Cmaj7</b>.</p>
      <div class="form"><label>Acordes<input type="text" id="cS" value="Am F C G"></label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><label>Começa no compasso<input type="number" id="cB" value="${Math.floor(S.beat / PS.barBeats()) + 1}" min="1"></label>
        <label>Compassos por acorde<input type="number" id="cL" value="1" min="1" max="8"></label><label>Repetir<input type="number" id="cR" value="1" min="1" max="32"></label>
        <label>Oitava<input type="number" id="cO" value="${t.inst && /baixo/.test(t.inst.preset) ? 3 : 4}" min="1" max="7"></label></div>
      <label>Estilo<select id="cY"><option value="bloco">Acordes inteiros</option><option value="ritmado">Ritmado</option><option value="arpejo">Arpejo</option><option value="quebrado">Quebrado (baixo e acorde)</option><option value="baixo">Linha de baixo</option></select></label></div>
      <div class="modal-actions"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok>Escrever</button></div>`, { cls: "wide" });
    box.querySelector("[data-x]").onclick = closeModal;
    box.querySelector("[data-ok]").onclick = guard(() => {
      const chords = $("#cS").value.split(/[\s,|]+/).filter(Boolean);
      chords.forEach((c) => PS.parseChord(c));
      const o = { chords, startBar: Number($("#cB").value) || 1, barsPerChord: Number($("#cL").value) || 1, repeat: Number($("#cR").value) || 1, octave: Number($("#cO").value) || 4, style: $("#cY").value };
      closeModal();
      PS.edit("Acordes", () => { const c = PS.writeChords(t, o); S.selClip = c.id; });
      PS.emit("select");
    });
  }
  function shortcutsDialog() {
    const rows = [["Espaço", "Tocar / pausar"], ["Enter", "Parar e voltar"], ["L", "Repetir o trecho marcado (Shift + arrastar na régua marca)"], ["Shift+R", "Gravar"], ["Shift+M", "Metrônomo"],
      ["Z S X D C V G B H N J M", "Notas (oitava de baixo)"], ["Q 2 W 3 E R 5 T 6 Y 7 U I", "Notas (oitava de cima)"], ["PgUp / PgDn", "Muda a oitava do teclado"], ["Delete", "Apagar clipe ou notas selecionadas"],
      ["↑ / ↓", "Transpor notas selecionadas (Shift: oitava)"], ["Ctrl+D", "Duplicar clipe"], ["Ctrl+Z / Ctrl+Shift+Z", "Desfazer / refazer"], ["Ctrl + rodinha", "Zoom do arranjo"],
      ["Shift ao arrastar clipe", "Mover por tempo (sem prender no compasso)"], ["Alt ao arrastar clipe", "Copiar"]];
    openModal(`<h3>Atalhos e teclado musical</h3><div style="display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin-top:12px;font-size:13px">${rows.map(([k, t]) => `<b class="mono" style="color:var(--sx);font-weight:500">${k}</b><span>${t}</span>`).join("")}</div>
      <div class="modal-actions"><button class="btn primary" data-x>Fechar</button></div>`, { cls: "wide" });
    box.querySelector("[data-x]").onclick = closeModal;
  }

  // ---------------------------------------------------------------- teclado do computador como piano
  const KEYMAP = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ",": 12, q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24, 9: 25, o: 26, 0: 27, p: 28 };
  let octave = 4;
  const held = new Map();
  function keyTrack() { const t = PS.track(S.selTrack); return t && t.kind !== "audio" ? t : S.song.tracks.find((x) => x.kind === "inst"); }

  // gravação de notas tocadas no teclado (com a música tocando)
  let midiRec = null;
  function finishMidiRec() {
    const r = midiRec; midiRec = null;
    if (!r || !r.notes.length) return;
    const t = PS.track(r.track);
    PS.edit("Gravar notas", () => {
      for (const n of r.notes) {
        const b = n.b, c = PS.clipAt(t, b, true, "notes");
        c.notes.push({ p: n.p, s: Math.round((b - c.start) * 4) / 4, l: Math.max(0.25, Math.round(n.l * 4) / 4), v: 0.85 });
      }
    });
    $("#recBtn").classList.remove("on");
    PS.toast(`${r.notes.length} notas gravadas`, "ok");
  }
  async function toggleRecord() {
    if (E.isRecording()) { E.stop(); return; }
    if (midiRec) { E.stop(); return; }
    const t = PS.track(S.selTrack);
    if (t && t.kind === "inst") { // grava o teclado
      midiRec = { track: t.id, notes: [], open: new Map() };
      $("#recBtn").classList.add("on");
      E.metronome(true); $("#metroBtn").classList.add("on");
      PS.toast("Gravando: toque as notas no teclado do computador. Aperte Espaço para parar.", "info");
      E.play(Math.max(0, S.beat - PS.barBeats()));
      return;
    }
    try {
      const at = await ensureAudioTrack(t && t.kind === "audio" ? t.id : null);
      S.selTrack = at.id; PS.emit("select");
      await E.recordStart();
      $("#recBtn").classList.add("on");
      PS.toast("Gravando do microfone. Aperte Espaço ou o botão vermelho para parar.", "info");
      E.play(S.beat);
    } catch (e) { PS.toast("Não deu para usar o microfone: " + e.message, "err"); }
  }
  async function finishRecording() {
    const r = E.recordStop();
    $("#recBtn").classList.remove("on");
    if (!r) return;
    const s = await newSampleFromBuffer(r.buffer, "Gravação");
    const t = PS.track(S.selTrack);
    PS.edit("Gravação", () => { const c = { id: PS.uid("c"), type: "audio", sample: s.id, start: r.startBeat, offset: 0, gain: 1, rate: 1 }; t.clips.push(c); S.selClip = c.id; });
    PS.toast(`Gravação de ${fmt(r.buffer.duration, 1)} s adicionada`, "ok");
  }

  window.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!modal.hidden) { if (e.key === "Escape" && !modal.dataset.sticky) closeModal(); if (e.key === "Enter" && !typing && box.querySelector("[data-ok]")) box.querySelector("[data-ok]").click(); return; }
    if (typing) { if (e.key === "Escape" || e.key === "Enter") document.activeElement.blur(); return; }
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    const run = (c) => { e.preventDefault(); PS.cmd(c); };
    if (ctrl) {
      if (k === "z") return run(e.shiftKey ? "redo" : "undo");
      if (k === "y") return run("redo");
      if (k === "s") return run(e.shiftKey ? "save-as" : "save");
      if (k === "o") return run("open");
      if (k === "n") return run("new");
      if (k === "i") return run("import");
      if (k === "e") return run("export");
      if (k === "d") return run("clip-dup");
      return;
    }
    if (S.tab === "sfx") { if (k === " ") { e.preventDefault(); playSfx(); } return; }
    if (k === " ") return run("play");
    if (k === "enter") return run("stop");
    if (e.shiftKey && k === "r") return run("record");
    if (e.shiftKey && k === "m") return run("metronome");
    if (k === "l" && !e.shiftKey) return run("loop");
    if (k === "pageup") { octave = Math.min(8, octave + 1); PS.toast("Teclado na oitava " + octave, "info"); return e.preventDefault(); }
    if (k === "pagedown") { octave = Math.max(1, octave - 1); PS.toast("Teclado na oitava " + octave, "info"); return e.preventDefault(); }
    if (PS.editorKeys && PS.editorKeys(e)) return e.preventDefault();
    if (k === "delete" || k === "backspace") return run("clip-del");
    if (e.repeat) { if (KEYMAP[k] !== undefined) e.preventDefault(); return; }
    if (KEYMAP[k] !== undefined && !e.shiftKey && !e.altKey) {
      const t = keyTrack(); if (!t) return;
      e.preventDefault();
      const midi = t.kind === "drums" ? PS.DRUMS[KEYMAP[k] % PS.DRUMS.length][0] : (octave - 1) * 12 + 12 + KEYMAP[k] - 12 + 12;
      if (held.has(k)) return;
      held.set(k, { t, midi });
      E.noteOn(t, midi);
      if (midiRec && t.kind === "inst" && S.playing) midiRec.open.set(k, { p: midi, b: S.beat });
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase(), h = held.get(k);
    if (!h) return;
    held.delete(k);
    E.noteOff(h.t, h.midi);
    if (midiRec && midiRec.open.has(k)) { const o = midiRec.open.get(k); midiRec.open.delete(k); midiRec.notes.push({ p: o.p, b: o.b, l: S.beat - o.b }); }
  });
  window.addEventListener("blur", () => { for (const [k, h] of held) { E.noteOff(h.t, h.midi); held.delete(k); } });
  // arrastar arquivos fora do arranjo também importa
  window.addEventListener("dragover", (e) => { if ([...(e.dataTransfer.types || [])].includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) { e.preventDefault(); PS.importFiles([...e.dataTransfer.files]); } });

  // ---------------------------------------------------------------- efeitos sonoros
  let sfxP = PS.sfx.fromPreset("moeda", { seed: 1, variation: 0 }), sfxBuf = null, sfxHist = [];
  function renderSfx() {
    const v = $("#sfxView");
    v.innerHTML = `<aside class="sfx-presets"><h3>Modelos</h3><div class="grid">${Object.entries(PS.sfx.PRESETS).map(([k, [n, ic]]) => `<button data-sp="${k}" class="${sfxP.preset === k ? "on" : ""}"><i class="i i-${ic}"></i>${n}</button>`).join("")}</div></aside>
      <section class="sfx-main"><div class="sfx-wave"><canvas id="sfxCv"></canvas></div>
        <div class="sfx-actions"><button class="btn primary big" data-sx="play"><i class="i i-play"></i>Ouvir</button><button class="btn" data-sx="vary"><i class="i i-dices"></i>Outra variação</button>
          <button class="btn" data-sx="mutate"><i class="i i-shuffle"></i>Mudar um pouco</button><button class="btn" data-sx="random"><i class="i i-wand-sparkles"></i>Surpresa</button>
          <div class="grow"></div><button class="btn" data-sx="media" ${hubLib ? "" : "hidden"} title="Salva o efeito e ele aparece na Mídia do Hub (o Piphin Vídeo usa direto)"><i class="i i-library"></i>Salvar na Mídia</button><button class="btn" data-sx="wav"><i class="i i-download"></i>Salvar WAV</button><button class="btn" data-sx="song"><i class="i i-music-4"></i>Colocar na música</button></div>
        <details class="more" open><summary>Parâmetros</summary><div class="sfx-params" id="sfxParams"></div></details></section>
      <aside class="sfx-side"><h3>Feitos agora</h3><div id="sfxHist"></div><p class="hint">Espaço toca o som. Cada clique em <b>Outra variação</b> sorteia um som novo do mesmo modelo.</p></aside>`;
    renderSfxParams(); drawSfx(); renderSfxHist();
  }
  function renderSfxParams() {
    $("#sfxParams").innerHTML = PS.sfx.FIELDS.map(([k, label, min, max, step]) => min === "select"
      ? `<label class="fld two"><span>${label}</span><select data-sf="${k}">${max.map((w) => `<option value="${w}" ${sfxP[k] === w ? "selected" : ""}>${{ square: "Quadrada", saw: "Serra", sine: "Senoide", triangle: "Triângulo", noise: "Ruído" }[w]}</option>`).join("")}</select></label>`
      : `<label class="fld"><span>${label}</span><input type="range" data-sf="${k}" min="${min}" max="${max}" step="${step}" value="${sfxP[k]}"><b>${fmt(sfxP[k], 2)}</b></label>`).join("");
  }
  function drawSfx() {
    sfxBuf = PS.sfx.render(sfxP);
    const cv = $("#sfxCv"); if (!cv) return;
    const r = cv.getBoundingClientRect(), W = Math.max(200, Math.round(r.width)), H = 170;
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), d = sfxBuf.getChannelData(0);
    g.strokeStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, "#22c55e"); grad.addColorStop(1, "#a3e635"); g.fillStyle = grad;
    for (let x = 0; x < W; x++) { const a = Math.floor((x / W) * d.length), b = Math.floor(((x + 1) / W) * d.length); let mx = 0; for (let i = a; i < b; i++) mx = Math.max(mx, Math.abs(d[i])); const h = Math.max(1, mx * H * 0.9); g.fillRect(x, (H - h) / 2, 1, h); }
    g.fillStyle = "#a9a6c2"; g.font = "12px Segoe UI"; g.fillText(`${fmt(sfxBuf.duration, 2)} s`, 10, 18);
  }
  const playSfx = () => { if (sfxBuf) E.audition(sfxBuf); };
  function renderSfxHist() {
    const el = $("#sfxHist"); if (!el) return;
    el.innerHTML = sfxHist.map((h, i) => `<div class="hist-item" data-h="${i}"><i class="i i-${(PS.sfx.PRESETS[h.preset] || [, "sparkles"])[1]}"></i><span class="grow">${esc((PS.sfx.PRESETS[h.preset] || ["Som"])[0])} #${String(h.seed).slice(-4)}</span><i class="i i-play"></i></div>`).join("") || `<p class="hint">Os sons que você ouvir aparecem aqui.</p>`;
  }
  function pushHist() { sfxHist = [{ ...sfxP }, ...sfxHist.filter((h) => h.seed !== sfxP.seed)].slice(0, 14); renderSfxHist(); }
  $("#sfxView").addEventListener("click", guard(async (e) => {
    const sp = e.target.closest("[data-sp]"), sx = e.target.closest("[data-sx]"), hi = e.target.closest("[data-h]");
    if (sp) { sfxP = PS.sfx.fromPreset(sp.dataset.sp, { seed: Date.now() % 1e9, variation: 25 }); $$("[data-sp]").forEach((b) => b.classList.toggle("on", b === sp)); renderSfxParams(); drawSfx(); playSfx(); pushHist(); }
    if (hi) { sfxP = { ...sfxHist[Number(hi.dataset.h)] }; renderSfxParams(); drawSfx(); playSfx(); }
    if (!sx) return;
    const a = sx.dataset.sx;
    if (a === "play") playSfx();
    if (a === "vary") { sfxP = PS.sfx.fromPreset(sfxP.preset || "blip", { seed: Date.now() % 1e9, variation: 60 }); renderSfxParams(); drawSfx(); playSfx(); pushHist(); }
    if (a === "mutate") { sfxP = PS.sfx.mutate(sfxP, 0.15); sfxP.seed = Date.now() % 1e9; renderSfxParams(); drawSfx(); playSfx(); pushHist(); }
    if (a === "random") { sfxP = PS.sfx.randomAll(Date.now() % 1e9); renderSfx(); playSfx(); pushHist(); }
    if (a === "media") {
      const name = (PS.sfx.PRESETS[sfxP.preset] || ["Efeito"])[0];
      const r = await call("save-effect", { bytes: PS.wav(sfxBuf), name, duration: sfxBuf.duration });
      PS.toast(`"${r.name.replace(/\.wav$/, "")}" está na Mídia do Hub`, "ok", { label: "Mostrar", run: () => call("show-item", r.path) });
    }
    if (a === "wav") { const r = await call("export", { bytes: PS.wav(sfxBuf), path: null, suggested: `${(PS.sfx.PRESETS[sfxP.preset] || ["som"])[0].toLowerCase()}.wav`, ext: "wav",
      meta: { title: (PS.sfx.PRESETS[sfxP.preset] || ["Efeito"])[0], sub: "Efeito sonoro", duration: sfxBuf.duration, tags: ["efeito"] } }); if (r) PS.toast("Efeito salvo: " + r.name, "ok", { label: "Mostrar", run: () => call("show-item", r.path) }); }
    if (a === "song") { await sfxToSong(sfxBuf, (PS.sfx.PRESETS[sfxP.preset] || ["Efeito"])[0], S.beat); setTab("music"); }
  }));
  $("#sfxView").addEventListener("input", (e) => {
    const k = e.target.dataset.sf; if (!k) return;
    sfxP[k] = e.target.tagName === "SELECT" ? e.target.value : Number(e.target.value);
    if (e.target.nextElementSibling && e.target.nextElementSibling.tagName === "B") e.target.nextElementSibling.textContent = fmt(sfxP[k], 2);
    drawSfx();
  });
  $("#sfxView").addEventListener("change", (e) => { if (e.target.dataset.sf) playSfx(); });
  async function sfxToSong(buf, name, beat) {
    const s = await newSampleFromBuffer(buf, name);
    const t = await ensureAudioTrack(null);
    PS.edit("Efeito na música", () => { const c = { id: PS.uid("c"), type: "audio", sample: s.id, start: beat, offset: 0, gain: 1, rate: 1 }; t.clips.push(c); S.selTrack = t.id; S.selClip = c.id; });
    return s;
  }

  // ---------------------------------------------------------------- exportar
  const BITRATE = { mp3: { low: 128000, medium: 192000, high: 320000 }, m4a: { low: 128000, medium: 160000, high: 192000 }, ogg: { low: 96000, medium: 128000, high: 192000 } };
  async function encode(buf, format, quality = "high") {
    if (format === "wav") return PS.wav(buf);
    const MB = window.Mediabunny;
    if (format === "mp3" && !(await MB.canEncodeAudio("mp3"))) window.MediabunnyMp3Encoder.registerMp3Encoder();
    const out = new MB.Output({ format: format === "mp3" ? new MB.Mp3OutputFormat() : format === "ogg" ? new MB.OggOutputFormat() : new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
    const codec = { mp3: "mp3", m4a: "aac", ogg: "opus" }[format];
    // nem todo codificador aceita todas as taxas: tenta a pedida e depois as menores
    let bitrate = BITRATE[format][quality] || BITRATE[format].high;
    for (const b of [bitrate, 192000, 160000, 128000, 96000]) { if (b <= bitrate && (await MB.canEncodeAudio(codec, { numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate, bitrate: b }))) { bitrate = b; break; } }
    const src = new MB.AudioBufferSource({ codec, bitrate });
    out.addAudioTrack(src);
    await out.start(); await src.add(buf); src.close(); await out.finalize();
    return new Uint8Array(out.target.buffer);
  }
  PS.encode = encode;
  async function doExport({ format = "mp3", quality = "high", path = null, dir = null, what = "song" }) {
    if (!S.song.tracks.some((t) => t.clips.length)) throw new Error("A música está vazia");
    E.stop();
    openModal(`<h3>Exportando</h3><p id="xMsg">Mixando a música...</p><div class="prog"><i id="xBar" style="width:20%"></i></div>`, { sticky: true });
    try {
      const lp = S.song.loop;
      const buf = await E.render(what === "loop" && lp.on ? { from: lp.start, to: lp.end, tail: 0.01 } : {});
      $("#xBar").style.width = "65%"; $("#xMsg").textContent = `Codificando ${format.toUpperCase()}...`;
      const bytes = await encode(buf, format, quality);
      $("#xBar").style.width = "95%";
      const name = (S.song.name || "musica").replace(/[\\/:*?"<>|]/g, "_");
      const r = await call("export", { bytes, path: path || (dir ? `${dir}\\${name}.${format}` : null), suggested: `${name}.${format}`, ext: format,
        meta: { title: S.song.name || name, sub: what === "loop" ? "Loop do Piphin Som" : "Música do Piphin Som", duration: buf.duration } });
      closeModal();
      if (r) PS.toast(`Exportado: ${r.name} (${fmt(r.size / 1048576, 1)} MB, ${PS.timeText(buf.duration)})`, "ok", { label: "Mostrar", run: () => call("show-item", r.path) });
      return r && { ...r, duration: buf.duration };
    } catch (e) { closeModal(); throw e; }
  }
  function exportDialog() {
    const pref = S.exportPrefs || { format: "mp3", quality: "high" };
    openModal(`<h3>Exportar música</h3><p>Duração: ${PS.timeText(PS.beatsToSec(PS.contentBeats()))}</p><div class="form">
      <label>Formato<div class="seg" id="xF">${[["mp3", "MP3"], ["wav", "WAV"], ["m4a", "M4A (AAC)"], ["ogg", "OGG (Opus)"]].map(([k, n]) => `<button data-f="${k}" class="${pref.format === k ? "on" : ""}">${n}</button>`).join("")}</div></label>
      <label>Qualidade<select id="xQ"><option value="low" ${pref.quality === "low" ? "selected" : ""}>Menor arquivo</option><option value="medium" ${pref.quality === "medium" ? "selected" : ""}>Média</option><option value="high" ${pref.quality === "high" ? "selected" : ""}>Alta</option></select></label>
      ${S.song.loop.on ? `<label class="chk"><input type="checkbox" id="xL"> Só o trecho repetido (loop)</label>` : ""}
      <p class="note">MP3 toca em qualquer lugar. WAV não perde qualidade (arquivo grande). MP3 usa o codificador LAME (lame.sourceforge.io).</p></div>
      <div class="modal-actions"><button class="btn" data-x>Cancelar</button><button class="btn primary" data-ok><i class="i i-download"></i>Exportar...</button></div>`);
    let f = pref.format;
    box.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { f = b.dataset.f; box.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b)); }));
    box.querySelector("[data-x]").onclick = closeModal;
    box.querySelector("[data-ok]").onclick = guard(async () => {
      S.exportPrefs = { format: f, quality: $("#xQ").value };
      const loopOnly = $("#xL") && $("#xL").checked;
      closeModal();
      call("prefs", { exportPrefs: S.exportPrefs }).catch(() => {});
      await doExport({ ...S.exportPrefs, what: loopOnly ? "loop" : "song" });
    });
  }

  // ---------------------------------------------------------------- projetos
  async function saveProject(as) {
    const r = await call("save-project", { text: JSON.stringify(S.song), path: as ? null : S.path, suggested: (S.song.name || "musica") + ".psom" });
    if (!r) return;
    S.path = r.path; S.dirty = false;
    PS.toast("Projeto salvo: " + r.name, "ok");
  }
  async function loadProject(r) {
    resetSong(r.project, r.path);
    const miss = [];
    for (const s of S.song.samples) { try { await E.loadSample(s); } catch { miss.push(s.name); } }
    PS.emit("samples");
    if (miss.length) PS.toast(`${miss.length} áudio(s) não foram encontrados: ${miss.slice(0, 3).join(", ")}`, "warn");
  }
  async function leaveOk() {
    if (!S.dirty || !S.song.tracks.some((t) => t.clips.length)) return true;
    return (await confirmBox("Descartar as alterações?", "A música atual tem alterações que não foram salvas.", ["Descartar", "Cancelar"], true)) === 0;
  }

  // ---------------------------------------------------------------- pedidos da IA
  const needTrack = (id, kind) => {
    const t = PS.track(id) || S.song.tracks.find((x) => x.name.toLowerCase() === String(id || "").toLowerCase());
    if (!t) throw new Error("Faixa não encontrada: " + id + " (veja project_info)");
    if (kind && t.kind !== kind) throw new Error(`A faixa ${t.name} não é de ${kind === "inst" ? "instrumento" : kind === "drums" ? "bateria" : "áudio"}`);
    return t;
  };
  const info = () => ({ name: S.song.name, bpm: S.song.bpm, time_signature: `${S.song.beatsPerBar}/4`, bars: S.song.bars, length_beats: PS.contentBeats(), playing: S.playing,
    tracks: S.song.tracks.map((t) => ({ id: t.id, name: t.name, kind: { inst: "instrument", drums: "drums", audio: "audio" }[t.kind], instrument: t.inst && t.inst.preset, kit: t.kit,
      volume: Math.round((t.volume ?? 0.8) * 100), mute: t.mute || undefined, effects: Object.fromEntries(Object.entries(t.fx || {}).filter(([k, v]) => v && !(k === "lowpass" && v >= 20000) && !(k === "highpass" && v <= 20) && k !== "delayTime")),
      clips: t.clips.map((c) => ({ type: c.type, start_bar: +(c.start / PS.barBeats() + 1).toFixed(2), bars: +(PS.clipLen(c) / PS.barBeats()).toFixed(2), notes: c.notes ? c.notes.length : undefined, name: c.name })) })) });
  const AI = {
    project_info: () => info(),
    new_song: (a) => { PS.edit("IA: música nova", () => { S.song = PS.newSong({ name: a.name || "Música nova", bpm: clamp(a.bpm || 110, 40, 240), bars: clamp(a.bars || 16, 1, 999), beatsPerBar: clamp(a.beats_per_bar || 4, 2, 12) }); S.selTrack = S.selClip = null; }); PS.emit("select"); return info(); },
    add_track: (a) => { const kind = { instrument: "inst", drums: "drums", audio: "audio" }[a.kind]; if (!kind) throw new Error("kind inválido"); if (a.instrument && !PS.PRESETS[a.instrument]) throw new Error("Instrumento desconhecido: " + a.instrument);
      const t = addTrack(kind, { instrument: a.instrument, name: a.name, kit: a.kit }); return { track: t.id, name: t.name }; },
    edit_track: (a) => { const t = needTrack(a.track); PS.edit("IA: ajustar faixa", () => {
      if (a.volume != null) t.volume = clamp(a.volume, 0, 150) / 100; if (a.pan != null) t.pan = clamp(a.pan, -100, 100) / 100; if (a.mute != null) t.mute = !!a.mute; if (a.name) t.name = a.name;
      if (a.instrument) { if (!PS.PRESETS[a.instrument]) throw new Error("Instrumento desconhecido"); t.inst = { preset: a.instrument, ...JSON.parse(JSON.stringify(PS.PRESETS[a.instrument].params)) }; }
      for (const k of ["reverb", "delay", "distortion", "lowpass"]) if (a[k] != null) t.fx[k] = Number(a[k]); }); return { ok: true }; },
    add_notes: (a) => { const t = needTrack(a.track, "inst"); let n = 0; PS.edit("IA: notas", () => {
      for (const x of a.notes || []) { const b = Number(x.start) || 0, c = PS.clipAt(t, b, true, "notes"); const end = b + Number(x.length || 1); if (end > c.start + c.len) c.len = Math.ceil((end - c.start) / PS.barBeats()) * PS.barBeats();
        c.notes.push({ p: PS.parseNote(x.note), s: b - c.start, l: Math.max(0.05, Number(x.length) || 1), v: clamp((x.velocity || 96) / 127, 0.05, 1) }); n++; } }); return { added: n }; },
    add_chords: (a) => { const t = needTrack(a.track, "inst"); (a.chords || []).forEach((c) => PS.parseChord(c)); const c = PS.edit("IA: acordes", () => PS.writeChords(t, { chords: a.chords, startBar: a.start_bar || 1, barsPerChord: a.bars_per_chord || 1, octave: a.octave || (t.inst && /baixo/.test(t.inst.preset) ? 2 : 4), style: a.style || "bloco", repeat: a.repeat || 1 }));
      return { clip_bars: c.len / PS.barBeats(), notes: c.notes.length }; },
    add_drums: (a) => { const t = needTrack(a.track, "drums"); if (!a.style && !a.pattern) a.style = "pop"; const c = PS.edit("IA: batida", () => PS.writeDrums(t, { style: a.style, pattern: a.pattern, startBar: a.start_bar || 1, bars: a.bars || 4, fill: !!a.fill })); return { bars: c.len / PS.barBeats() }; },
    clear_clip: (a) => { const t = needTrack(a.track); PS.edit("IA: apagar trecho", () => { if (!a.start_bar) { t.clips = []; return; } const s = (a.start_bar - 1) * PS.barBeats(), e = s + (a.bars || 1e6) * PS.barBeats(); t.clips = t.clips.filter((c) => c.start + PS.clipLen(c) <= s || c.start >= e); }); return { ok: true }; },
    make_sound_effect: async (a) => {
      const p = PS.sfx.fromPreset(a.preset, { seed: Date.now() % 1e9, variation: a.variation ?? 30, pitch: a.pitch || 0, length: a.length || 1 });
      const buf = PS.sfx.render(p), name = (PS.sfx.PRESETS[a.preset] || [a.preset])[0];
      const dir = await call("music-dir");
      const r = await call("export", { bytes: PS.wav(buf), path: a.path || `${dir}\\efeitos\\${a.preset}-${String(p.seed).slice(-5)}.wav`, ext: "wav",
        meta: { title: name, sub: "Efeito sonoro", duration: buf.duration, tags: ["efeito"] } });
      if (a.add_to_song) await sfxToSong(buf, name, ((a.start_bar || 1) - 1) * PS.barBeats());
      E.audition(buf);
      return { saved: r.path, seconds: +buf.duration.toFixed(2), added_to_song: !!a.add_to_song };
    },
    import_audio: async ({ file, start_bar }) => { await PS.importFiles([file], { beat: ((start_bar || 1) - 1) * PS.barBeats() }); return info(); },
    play: (a) => { if (a.stop || S.playing) { E.stop(); return { playing: false }; } E.play(((a.from_bar || 1) - 1) * PS.barBeats()); return { playing: true }; },
    export_audio: async (a) => { const r = await doExport({ format: a.format, quality: a.quality || "high", path: a.path, dir: a.dir }); if (!r) throw new Error("Exportação cancelada"); return { path: r.path, size_mb: +(r.size / 1048576).toFixed(2), seconds: +r.duration.toFixed(1) }; },
    undo: () => { const l = PS.undo(); if (!l) throw new Error("Não há nada para desfazer"); return { undone: l }; },
  };
  piphin.on("ai-call", async ({ id, name, args }) => {
    try { const data = await AI[name](args || {}); PS.toast(`A IA usou: ${name.replace(/_/g, " ")}`, "info"); piphin.invoke("ai-reply", id, true, data); }
    catch (e) { piphin.invoke("ai-reply", id, false, e.message); }
  });
  window.addEventListener("beforeunload", () => { piphin.invoke("ui-unload"); });
  // chegou de outro módulo ("Abrir no Piphin Som"): entra na música, no cursor
  piphin.on("open-file", guard(async ({ file, title, from }) => {
    setTab("music");
    await PS.importFiles([file]);
    PS.toast(`"${title || file.name}" chegou do ${from || "Hub"}`, "ok");
  }));

  // ---------------------------------------------------------------- início
  (async () => {
    const prefs = await call("prefs").catch(() => ({}));
    if (prefs.exportPrefs) S.exportPrefs = prefs.exportPrefs;
    starterTracks();
    S.dirty = false;
    const feats = await call("hub-features").catch(() => ({}));
    hubLib = !!(feats && feats.library);
    PS.emit("song", {}); PS.emit("select"); PS.emit("beat", 0); PS.emit("loop");
    piphin.invoke("ui-ready");
  })();
})();
