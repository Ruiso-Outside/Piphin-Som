// Piphin Som como módulo do Piphin Hub. O som é gerado e mixado na tela (Web Audio); aqui ficam os arquivos:
// ler áudios importados, guardar amostras (gravações do microfone e efeitos gerados), projetos, exportação,
// recentes e a ponte das ferramentas da IA (Piphin LLM).
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const AUDIO = ["wav", "mp3", "ogg", "opus", "m4a", "aac", "flac", "webm", "mp4"];
const MAX = 400 * 1024 * 1024;

exports.activate = (ctx) => {
  const SAMPLES = path.join(ctx.dataDir, "amostras");
  const RECENT_FILE = path.join(ctx.dataDir, "recent.json");
  const PREFS_FILE = path.join(ctx.dataDir, "prefs.json");
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  let recent = readJson(RECENT_FILE, []);
  const musicDir = () => path.join(os.homedir(), "Music", "Piphin Som");
  const remember = (file) => {
    recent = [file, ...recent.filter((f) => f.toLowerCase() !== file.toLowerCase())].slice(0, 12);
    try { fs.writeFileSync(RECENT_FILE, JSON.stringify(recent, null, 1)); } catch { /* sem disco */ }
  };
  const readAudio = (file) => {
    const st = fs.statSync(file);
    if (st.size > MAX) throw new Error("Arquivo grande demais (mais de 400 MB)");
    return { path: file, name: path.basename(file), bytes: new Uint8Array(fs.readFileSync(file)) };
  };

  ctx.handle("import-dialog", async () => {
    const list = await ctx.host.openDialog({ title: "Importar áudio", properties: ["openFile", "multiSelections"],
      filters: [{ name: "Áudio", extensions: AUDIO }, { name: "Todos os arquivos", extensions: ["*"] }] });
    return (list || []).map(readAudio);
  });
  ctx.handle("read-audio", (file) => readAudio(String(file)));
  ctx.handle("locate-dialog", async (name) => {
    const list = await ctx.host.openDialog({ title: `Onde está "${name}"?`, properties: ["openFile"], filters: [{ name: "Áudio", extensions: AUDIO }] });
    return list && list[0] ? readAudio(list[0]) : null;
  });
  // amostras novas (gravações e efeitos gerados) viram arquivos WAV guardados pelo módulo
  ctx.handle("save-sample", (bytes, name) => {
    fs.mkdirSync(SAMPLES, { recursive: true });
    const file = path.join(SAMPLES, `${String(name || "amostra").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}-${crypto.randomBytes(3).toString("hex")}.wav`);
    fs.writeFileSync(file, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return { path: file, name: path.basename(file) };
  });

  // ---------------------------------------------------------------- projetos
  async function openProject(file) {
    const project = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!project || project.schema !== 1) throw new Error("Projeto do Piphin Som inválido");
    remember(file);
    return { path: file, name: path.basename(file), project };
  }
  ctx.handle("open-project-dialog", async () => {
    const list = await ctx.host.openDialog({ title: "Abrir projeto", properties: ["openFile"], filters: [{ name: "Projeto do Piphin Som", extensions: ["psom"] }] });
    return list && list[0] ? openProject(list[0]) : null;
  });
  ctx.handle("open-project", (file) => openProject(String(file)));
  ctx.handle("save-project", async ({ text, path: file, suggested }) => {
    if (!file) {
      fs.mkdirSync(musicDir(), { recursive: true });
      file = await ctx.host.saveDialog({ title: "Salvar projeto", defaultPath: path.join(musicDir(), suggested || "musica.psom"), filters: [{ name: "Projeto do Piphin Som", extensions: ["psom"] }] });
      if (!file) return null;
    }
    fs.writeFileSync(file, text);
    remember(file);
    return { path: file, name: path.basename(file) };
  });
  ctx.handle("recent", () => recent.filter((f) => fs.existsSync(f)).map((f) => ({ path: f, name: path.basename(f), dir: path.dirname(f) })));

  // ---------------------------------------------------------------- exportar
  ctx.handle("export", async ({ bytes, path: file, suggested, ext }) => {
    if (!file) {
      fs.mkdirSync(musicDir(), { recursive: true });
      file = await ctx.host.saveDialog({ title: "Exportar áudio", defaultPath: path.join(musicDir(), suggested || "musica." + ext), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
      if (!file) return null;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return { path: file, name: path.basename(file), size: bytes.byteLength };
  });
  ctx.handle("show-item", (file) => ctx.host.showItem(file));
  ctx.handle("music-dir", () => musicDir());
  ctx.handle("prefs", (patch) => {
    let prefs = readJson(PREFS_FILE, {});
    if (patch) { prefs = { ...prefs, ...patch }; fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 1)); }
    return prefs;
  });

  // ---------------------------------------------------------------- ferramentas para a IA (module.json "tools")
  let uiReady = false;
  const readyWaiters = [], pending = new Map();
  let aiSeq = 0;
  ctx.handle("ui-ready", () => { uiReady = true; readyWaiters.splice(0).forEach((f) => f()); return true; });
  ctx.handle("ui-unload", () => { uiReady = false; for (const p of pending.values()) p.reject(new Error("A tela do Piphin Som foi fechada")); pending.clear(); return true; });
  ctx.handle("ai-reply", (id, ok, data) => { const p = pending.get(id); if (p) { pending.delete(id); ok ? p.resolve(data) : p.reject(new Error(data)); } return true; });
  async function toUi(name, args, timeout = 180000) {
    if (!uiReady) {
      await ctx.host.focus().catch(() => {});
      await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("A tela do Piphin Som não abriu")), 20000); readyWaiters.push(() => { clearTimeout(t); resolve(); }); });
    }
    const id = ++aiSeq;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { pending.delete(id); reject(new Error("O Piphin Som não respondeu")); }, timeout);
      pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      ctx.emit("ai-call", { id, name, args: args || {} });
    });
  }
  for (const name of ["project_info", "new_song", "add_track", "edit_track", "add_notes", "add_chords", "add_drums", "clear_clip", "make_sound_effect", "play", "undo"])
    ctx.handle("tool:" + name, (args) => toUi(name, args));
  ctx.handle("tool:import_audio", async (args = {}) => {
    const file = String(args.path || "");
    if (!fs.existsSync(file)) throw new Error("Arquivo não encontrado: " + file);
    return toUi("import_audio", { file: readAudio(file), start_bar: args.start_bar });
  });
  ctx.handle("tool:export_audio", async (args = {}) => {
    const format = ["wav", "mp3", "m4a", "ogg"].includes(args.format) ? args.format : "mp3";
    const r = await toUi("export_audio", { format, quality: args.quality, path: args.path || null, dir: musicDir(), what: args.what }, 30 * 60 * 1000);
    ctx.host.notify("Piphin Som", "A IA exportou o áudio: " + r.path).catch(() => {});
    return r;
  });
};
