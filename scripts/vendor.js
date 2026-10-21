// Copia as bibliotecas de áudio para web/vendor (o módulo roda sem node_modules):
// Mediabunny (MPL-2.0) para M4A/OGG e o codificador MP3 (MPL-2.0, com LAME 3.100 em WASM, LGPL: https://lame.sourceforge.io).
const fs = require("fs");
const path = require("path");
const nm = path.join(__dirname, "..", "node_modules");
const out = path.join(__dirname, "..", "web", "vendor");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(nm, "mediabunny", "dist", "bundles", "mediabunny.min.cjs"), path.join(out, "mediabunny.min.js"));
fs.copyFileSync(path.join(nm, "mediabunny", "LICENSE"), path.join(out, "MEDIABUNNY-LICENSE.txt"));
fs.copyFileSync(path.join(nm, "@mediabunny", "mp3-encoder", "dist", "bundles", "mediabunny-mp3-encoder.min.js"), path.join(out, "mp3-encoder.min.js"));
fs.copyFileSync(path.join(nm, "@mediabunny", "mp3-encoder", "LICENSE"), path.join(out, "MP3-ENCODER-LICENSE.txt"));
fs.writeFileSync(path.join(out, "LAME.txt"), "O codificador MP3 usa o LAME 3.100 (https://lame.sourceforge.io), licença LGPL.\n");
console.log("bibliotecas copiadas para web/vendor");
