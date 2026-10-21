// Piphin Som · arranjo: faixas e clipes por compasso (mover, redimensionar, duplicar), régua com trecho de repetição.
"use strict";
PS.arrange = (() => {
  const S = PS.state;
  const scroll = $("#arrScroll"), inner = $("#arrInner"), ruler = $("#arrRuler"), rows = $("#arrRows"), head = $("#arrPlayhead");
  const HEAD_W = 178, ROW = 62, RULER = 28;
  const bw = () => S.zoom; // pixels por tempo
  const xOf = (b) => HEAD_W + b * bw();
  const bOf = (x) => Math.max(0, (x - HEAD_W) / bw());
  const snapB = (b, grid = PS.barBeats(), alt = false) => (alt ? b : Math.round(b / grid) * grid);

  function render() {
    const total = Math.max(PS.songBeats() + PS.barBeats() * 8, (scroll.clientWidth - HEAD_W) / bw() + 4);
    inner.style.width = HEAD_W + total * bw() + "px";
    rows.innerHTML = "";
    for (const t of S.song.tracks) {
      const row = document.createElement("div");
      row.className = `arr-row ${t.id === S.selTrack ? "sel" : ""}`; row.dataset.track = t.id;
      row.innerHTML = `<div class="arr-head" style="--c:${t.color}">
          <div class="h1"><i class="i i-${t.kind === "drums" ? "drum" : t.kind === "audio" ? "audio-waveform" : (PS.PRESETS[(t.inst || {}).preset] || {}).icon || "piano"}"></i><span class="tn">${esc(t.name)}</span></div>
          <div class="h2"><button data-th="mute" class="${t.mute ? "on-m" : ""}" title="Silenciar">M</button><button data-th="solo" class="${t.solo ? "on-s" : ""}" title="Solo">S</button>
            <input type="range" data-th="volume" min="0" max="150" value="${Math.round((t.volume ?? 0.8) * 100)}" title="Volume"></div></div>
        <div class="arr-lane"></div>`;
      const lane = row.querySelector(".arr-lane");
      for (const c of t.clips) lane.appendChild(clipEl(t, c));
      rows.appendChild(row);
    }
    const add = document.createElement("div");
    add.className = "arr-add";
    add.innerHTML = `<div class="arr-head add"><button class="btn sm ghost" data-cmd="add-inst"><i class="i i-piano"></i>Instrumento</button><button class="btn sm ghost" data-cmd="add-drums"><i class="i i-drum"></i>Bateria</button><button class="btn sm ghost" data-cmd="add-audio"><i class="i i-mic"></i>Áudio</button></div>`;
    rows.appendChild(add);
    drawRuler(); placeHead();
  }

  function clipEl(t, c) {
    const el = document.createElement("div"), len = PS.clipLen(c), w = Math.max(6, len * bw());
    el.className = `aclip ${c.type} ${c.id === S.selClip ? "sel" : ""}`;
    el.dataset.clip = c.id;
    el.style.cssText = `left:${c.start * bw()}px;width:${w}px;--c:${t.color}`;
    const s = c.type === "audio" ? PS.sample(c.sample) : null;
    el.innerHTML = `<span class="cn">${esc(c.type === "audio" ? (s ? s.name.replace(/-[0-9a-f]{6}\.wav$/i, "") : "?") : c.name || (c.type === "drums" ? "Batida" : "Notas"))}</span><i class="rs"></i>`;
    const cv = document.createElement("canvas"), W = Math.min(Math.ceil(w), 4000), H = ROW - 24;
    cv.width = W; cv.height = H; cv.style.width = w + "px";
    const g = cv.getContext("2d"); g.fillStyle = "rgba(255,255,255,.85)";
    if (c.type === "notes" && c.notes.length) {
      const ps = c.notes.map((n) => n.p), lo = Math.min(...ps) - 1, hi = Math.max(...ps) + 1, k = W / c.len;
      for (const n of c.notes) { if (n.s >= c.len) continue; const y = H - ((n.p - lo) / (hi - lo)) * H; g.fillRect(n.s * k, Math.max(0, y - 2), Math.max(2, Math.min(n.l, c.len - n.s) * k - 1), 3); }
    } else if (c.type === "drums") {
      const pieces = PS.DRUMS.map((d) => d[0]).filter((p) => c.steps[p] && c.steps[p].some(Boolean)), k = W / (c.len * 4);
      pieces.forEach((p, r) => c.steps[p].forEach((v, i) => { if (v && i < c.len * 4) g.fillRect(i * k + 1, 4 + (r * (H - 8)) / Math.max(1, pieces.length), Math.max(2, k - 2), Math.max(2, (H - 8) / Math.max(1, pieces.length) - 1)); }));
    } else if (c.type === "audio") {
      const buf = PS.engine.bufferOf(c.sample);
      if (buf) {
        const d = buf.getChannelData(0), off = (c.offset || 0) * buf.sampleRate, span = (c.dur ?? buf.duration - (c.offset || 0)) * buf.sampleRate;
        for (let x = 0; x < W; x++) {
          const a = Math.floor(off + (x / W) * span), b = Math.floor(off + ((x + 1) / W) * span);
          let m = 0; for (let i = a; i < b; i += Math.max(1, (b - a) >> 6)) m = Math.max(m, Math.abs(d[i] || 0));
          const h = Math.max(1, m * (c.gain ?? 1) * H); g.fillRect(x, (H - h) / 2, 1, h);
        }
      }
    }
    el.appendChild(cv);
    return el;
  }

  function drawRuler() {
    const w = scroll.clientWidth, dpr = window.devicePixelRatio || 1, x0 = scroll.scrollLeft;
    ruler.width = Math.round(w * dpr); ruler.height = RULER * dpr; ruler.style.width = w + "px"; ruler.style.left = x0 + "px";
    const g = ruler.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0d0c14"; g.fillRect(0, 0, w, RULER);
    const lp = S.song.loop, bb = PS.barBeats();
    if (lp) { // trecho de repetição
      const a = xOf(lp.start) - x0, b = xOf(lp.end) - x0;
      g.fillStyle = lp.on ? "rgba(34,197,94,.35)" : "rgba(255,255,255,.08)"; g.fillRect(a, 0, b - a, 8);
    }
    const every = bw() * bb < 30 ? 4 : bw() * bb < 60 ? 2 : 1;
    g.font = "11px Segoe UI"; g.textBaseline = "top";
    for (let bar = Math.max(0, Math.floor(bOf(x0 + HEAD_W) / bb)); bar * bb <= bOf(x0 + w) + bb; bar++) {
      const x = xOf(bar * bb) - x0;
      if (x < HEAD_W - 1) continue;
      g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(Math.round(x), 12, 1, 16);
      if (bar % every === 0) { g.fillStyle = "#a9a6c2"; g.fillText(String(bar + 1), Math.round(x) + 4, 12); }
      if (bw() >= 14) for (let k = 1; k < bb; k++) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(Math.round(x + k * bw()), 20, 1, 8); }
    }
    g.fillStyle = "#0d0c14"; g.fillRect(0, 0, HEAD_W, RULER);
    g.fillStyle = "#6f6b8b"; g.fillText("Compasso", 12, 9);
  }
  function placeHead() {
    head.style.left = xOf(S.beat) + "px";
    if (S.playing) { const x = xOf(S.beat) - scroll.scrollLeft; if (x > scroll.clientWidth - 30 || x < HEAD_W) scroll.scrollLeft = xOf(S.beat) - HEAD_W - 30; }
  }
  scroll.addEventListener("scroll", drawRuler);
  PS.on("beat", placeHead);
  PS.on("song", render);
  PS.on("select", render);
  PS.on("samples", render);
  new ResizeObserver(render).observe(scroll);
  scroll.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.altKey) { e.preventDefault(); const r = scroll.getBoundingClientRect(), b = bOf(e.clientX - r.left + scroll.scrollLeft), x = e.clientX - r.left;
      S.zoom = clamp(S.zoom * Math.exp(-e.deltaY * 0.0015), 4, 160); render(); scroll.scrollLeft = Math.max(0, xOf(b) - x); }
    else if (e.shiftKey) { e.preventDefault(); scroll.scrollLeft += e.deltaY; }
  }, { passive: false });

  // ---------------------------------------------------------------- mouse
  let drag = null;
  const rowAt = (y) => document.elementsFromPoint(scroll.getBoundingClientRect().left + HEAD_W + 2, y).find((e) => e.classList && e.classList.contains("arr-row"));
  rows.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const row = e.target.closest(".arr-row");
    if (!row) return;
    const t = PS.track(row.dataset.track);
    const th = e.target.closest("[data-th]");
    if (th) {
      if (th.dataset.th === "volume") { S.selTrack = t.id; return; }
      PS.edit(th.dataset.th === "mute" ? "Silenciar faixa" : "Solo", () => { t[th.dataset.th] = !t[th.dataset.th]; });
      return;
    }
    if (S.selTrack !== t.id) { S.selTrack = t.id; PS.emit("select"); }
    if (e.target.closest(".arr-head")) return;
    const r = scroll.getBoundingClientRect(), b = bOf(e.clientX - r.left + scroll.scrollLeft);
    const el = e.target.closest(".aclip");
    if (!el) { if (S.selClip) { S.selClip = null; PS.emit("select"); } return; }
    const { c } = PS.findClip(el.dataset.clip);
    if (S.selClip !== c.id) { S.selClip = c.id; PS.emit("select"); }
    const resize = e.target.classList.contains("rs") && c.type !== "audio";
    drag = { c, t, b0: b, start: c.start, len: c.len, resize, x0: e.clientX, moved: false, copy: e.altKey, track: t.id };
  });
  rows.addEventListener("input", (e) => {
    if (e.target.dataset.th !== "volume") return;
    const t = PS.track(e.target.closest(".arr-row").dataset.track);
    t.volume = Number(e.target.value) / 100; S.dirty = true; PS.emit("mix");
  });
  rows.addEventListener("change", (e) => { if (e.target.dataset.th === "volume") PS.emit("song", { soft: true }); });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x0) < 3) return;
    drag.moved = true;
    const r = scroll.getBoundingClientRect(), b = bOf(e.clientX - r.left + scroll.scrollLeft), grid = e.shiftKey ? 1 : PS.barBeats();
    const el = rows.querySelector(`[data-clip="${drag.c.id}"]`);
    if (drag.resize) { drag.nlen = Math.max(grid === 1 ? 1 : PS.barBeats(), snapB(drag.len + (b - drag.b0), grid)); if (el) el.style.width = drag.nlen * bw() + "px"; }
    else {
      drag.nstart = Math.max(0, snapB(drag.start + (b - drag.b0), grid, e.altKey && e.shiftKey));
      if (el) el.style.left = drag.nstart * bw() + "px";
      const row = rowAt(e.clientY);
      if (row && PS.track(row.dataset.track).kind === drag.t.kind) { drag.track = row.dataset.track; const lane = row.querySelector(".arr-lane"); if (el && el.parentElement !== lane) lane.appendChild(el); }
    }
  });
  window.addEventListener("mouseup", () => {
    const d = drag; drag = null;
    if (!d || !d.moved) return;
    PS.edit(d.resize ? "Redimensionar clipe" : d.copy ? "Copiar clipe" : "Mover clipe", () => {
      if (d.resize) { d.c.len = d.nlen; return; }
      let c = d.c;
      if (d.copy) { c = JSON.parse(JSON.stringify(d.c)); c.id = PS.uid("c"); PS.track(d.track).clips.push(c); }
      else if (d.track !== d.t.id) { d.t.clips = d.t.clips.filter((x) => x !== c); PS.track(d.track).clips.push(c); }
      c.start = d.nstart ?? c.start;
      S.selClip = c.id; S.selTrack = d.track;
    });
  });
  // duplo clique numa área vazia: cria um clipe de 4 compassos e abre no editor
  rows.addEventListener("dblclick", (e) => {
    const row = e.target.closest(".arr-row");
    if (!row || e.target.closest(".arr-head") || e.target.closest(".aclip")) return;
    const t = PS.track(row.dataset.track);
    if (t.kind === "audio") return PS.cmd("import");
    const r = scroll.getBoundingClientRect(), b = Math.floor(bOf(e.clientX - r.left + scroll.scrollLeft) / PS.barBeats()) * PS.barBeats();
    PS.edit("Novo clipe", () => { const c = PS.clipAt(t, b + 0.001); S.selClip = c.id; S.selTrack = t.id; });
  });
  rows.addEventListener("contextmenu", (e) => {
    const el = e.target.closest(".aclip"); if (!el) return;
    e.preventDefault();
    S.selClip = el.dataset.clip; PS.emit("select");
    PS.menu(e.clientX, e.clientY, [["clip-dup", "copy", "Duplicar ao lado", "Ctrl+D"], ["clip-split", "scissors", "Dividir no cursor", "S"], "-", ["clip-del", "trash-2", "Apagar", "Delete"]]);
  });
  // régua: clique leva o cursor; arrastar com Shift marca o trecho de repetição
  ruler.addEventListener("mousedown", (e) => {
    const r = scroll.getBoundingClientRect(), b = bOf(e.clientX - r.left + scroll.scrollLeft);
    if (e.shiftKey || e.offsetY < 9) {
      const a = Math.floor(b / PS.barBeats()) * PS.barBeats();
      const move = (ev) => { const bb = Math.max(a + PS.barBeats(), Math.ceil(bOf(ev.clientX - r.left + scroll.scrollLeft) / PS.barBeats()) * PS.barBeats()); S.song.loop = { on: true, start: a, end: bb }; drawRuler(); PS.emit("loop"); };
      move(e);
      const upf = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", upf); S.dirty = true; };
      window.addEventListener("mousemove", move); window.addEventListener("mouseup", upf);
      return;
    }
    PS.seek(snapB(b, 1 / 4));
    const move = (ev) => PS.seek(snapB(bOf(ev.clientX - r.left + scroll.scrollLeft), 1 / 4));
    const upf = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", upf); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", upf);
  });
  // soltar arquivos de áudio numa faixa
  rows.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  rows.addEventListener("drop", (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); e.stopPropagation();
    const r = scroll.getBoundingClientRect(), b = Math.floor(bOf(e.clientX - r.left + scroll.scrollLeft) / PS.barBeats()) * PS.barBeats();
    const row = e.target.closest(".arr-row");
    PS.importFiles([...e.dataTransfer.files], { beat: b, track: row && PS.track(row.dataset.track).kind === "audio" ? row.dataset.track : null });
  });

  return { render, xOf, bOf };
})();
