// Desenha o ícone do Piphin Som: icons/som.png (256). Uso: npm run icon (usa o Electron do Piphin Hub).
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("about:blank");
  const b64 = await win.webContents.executeJavaScript(`(() => {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const g = c.getContext("2d");
    g.beginPath(); g.roundRect(8, 8, 240, 240, 56);
    const bg = g.createLinearGradient(0, 0, s, s); bg.addColorStop(0, "#0d2a1a"); bg.addColorStop(1, "#0b0a12");
    g.fillStyle = bg; g.fill();
    g.lineWidth = 3; g.strokeStyle = "rgba(34,197,94,.55)"; g.stroke();
    const grad = g.createLinearGradient(40, 200, 216, 56); grad.addColorStop(0, "#22c55e"); grad.addColorStop(.6, "#4ade80"); grad.addColorStop(1, "#a3e635");
    // barras de equalizador
    g.save(); g.shadowColor = "#22c55e"; g.shadowBlur = 18; g.fillStyle = grad;
    const bars = [70, 120, 92, 150, 104, 132, 80];
    bars.forEach((h, i) => { const x = 48 + i * 24; g.beginPath(); g.roundRect(x, 196 - h, 14, h, 7); g.fill(); });
    g.restore();
    // nota musical por cima
    g.save(); g.shadowColor = "#a3e635"; g.shadowBlur = 16; g.fillStyle = "#f0fdf4";
    g.beginPath(); g.ellipse(150, 170, 22, 16, -0.4, 0, Math.PI * 2); g.fill();
    g.fillRect(168, 70, 9, 100);
    g.beginPath(); g.moveTo(177, 70); g.quadraticCurveTo(212, 84, 204, 118); g.quadraticCurveTo(198, 96, 177, 96); g.closePath(); g.fill();
    g.restore();
    return c.toDataURL("image/png").split(",")[1];
  })()`);
  fs.mkdirSync(path.join(__dirname, "..", "icons"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "icons", "som.png"), Buffer.from(b64, "base64"));
  console.log("ícone: icons/som.png");
  app.quit();
});
