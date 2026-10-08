/* HARTEMPORÁRIO — sonda a cena dos animais: geometria das sombras e
   diff de pixels com/sem as sombras, para provar que elas renderizam.
   Uso: node tools/probe.mjs [largura] [altura] [mobile]              */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import zlib from "node:zlib";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 9398;
const W = Number(process.argv[2] || 1440);
const H = Number(process.argv[3] || 900);
const MOBILE = process.argv[4] === "1";

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].find((p) => fs.existsSync(p));

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      close() { ws.close(); }
    });
    ws.onerror = (e) => reject(new Error("ws " + e.message));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    };
  });
}

function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const off = y * stride, prevOff = off - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[off + x - channels] : 0;
      const b = y > 0 ? out[prevOff + x] : 0;
      const c = (y > 0 && x >= channels) ? out[prevOff + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      out[off + x] = v & 255;
    }
  }
  return { w, h, channels, data: out };
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dn-probe-"));
const chrome = spawn(CHROME, [
  "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--remote-allow-origins=*", "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + profile, "--window-size=" + W + "," + H,
  "--force-device-scale-factor=1", "about:blank"
], { stdio: "ignore" });

let cdp = null;
const evalJs = (e) => cdp.send("Runtime.evaluate", { expression: e, returnByValue: true })
  .then((r) => r.result && r.result.value);

try {
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === "page");
    } catch { /* subindo */ }
  }
  cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE });

  /* driver mínimo (velocidade 8) */
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
(function () {
  var __orig = window.setTimeout;
  window.setTimeout = function (fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    return __orig.apply(window, [fn, Math.max(0, (Number(delay) || 0) / 8)].concat(rest));
  };
  setInterval(function () {
    try {
      if (window.__stop) return;
      var btns = document.querySelectorAll('.btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b.hidden && b.classList.contains('is-visible') && !b.classList.contains('is-muted')) { b.click(); return; }
      }
      var a = document.querySelector('.scene.is-active');
      if (a && a.id === 'scene-spheres') {
        var os = document.querySelectorAll('#orbs-scattered .orb');
        for (var j = 0; j < os.length; j++) {
          if (!os[j].dataset.taken && os[j].style.pointerEvents === 'auto') { os[j].click(); return; }
        }
      }
      if (a && a.id === 'scene-gift') {
        var g = document.getElementById('gift');
        if (g && !g.dataset.opened) g.click();
      }
    } catch (e) {}
  }, 240);
})();` });

  await cdp.send("Page.navigate", { url: pathToFileURL(path.join(ROOT, "index.html")).href });

  const t0 = Date.now();
  for (;;) {
    const s = await evalJs(`(document.querySelector('.scene.is-active')||{}).id`);
    if (s === "scene-animals") { await evalJs(`window.__stop = true`); break; }
    if (Date.now() - t0 > 180000) throw new Error("não chegou em scene-animals (em " + s + ")");
    await sleep(300);
  }
  await sleep(3600); /* espera as falas terminarem e congela tudo */
  await evalJs(`document.getAnimations().forEach(function (a) { try { a.pause(); } catch (e) {} });
                if (window.DNFX) window.DNFX.stop();`);
  await sleep(600);

  const geo = await evalJs(`JSON.stringify({
    room: (function(){var r=document.querySelector('.room').getBoundingClientRect();return [r.x,r.y,r.width,r.height];})(),
    casts: [].map.call(document.querySelectorAll('.room__cast'), function (e) {
      var r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { cls: e.className, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
               opacity: cs.opacity, visibility: cs.visibility, display: cs.display,
               filter: cs.filter, transform: cs.transform, anim: cs.animationName,
               bg: cs.backgroundImage.slice(0, 90), zi: cs.zIndex, pos: cs.position };
    }),
    pool: (function(){var e=document.querySelector('.room__pool');var r=e.getBoundingClientRect();var cs=getComputedStyle(e);
      return {rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], opacity: cs.opacity};})(),
    beam: (function(){var e=document.querySelector('.room__beam');var r=e.getBoundingClientRect();var cs=getComputedStyle(e);
      return {rect:[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], opacity: cs.opacity};})()
  })`);
  console.log("--- geometria ---\n" + JSON.stringify(JSON.parse(geo), null, 2));

  const shot = async () => {
    const r = await cdp.send("Page.captureScreenshot", { format: "png" });
    return decodePNG(Buffer.from(r.data, "base64"));
  };

  const A = await shot();
  await evalJs(`[].forEach.call(document.querySelectorAll('.room__cast'), function (e) { e.style.visibility = 'hidden'; })`);
  await sleep(400);
  const B = await shot();

  /* diff sobre a área das sombras */
  let maxDiff = 0, sumDiff = 0, n = 0, changed = 0;
  for (const c of JSON.parse(geo).casts) {
    const [x, y, w, h] = c.rect;
    for (let yy = Math.max(0, y); yy < Math.min(A.h, y + h); yy += 2) {
      for (let xx = Math.max(0, x); xx < Math.min(A.w, x + w); xx += 2) {
        const ia = (yy * A.w + xx) * A.channels, ib = (yy * B.w + xx) * B.channels;
        const la = 0.299 * A.data[ia] + 0.587 * A.data[ia + 1] + 0.114 * A.data[ia + 2];
        const lb = 0.299 * B.data[ib] + 0.587 * B.data[ib + 1] + 0.114 * B.data[ib + 2];
        const d = Math.abs(la - lb);
        if (d > maxDiff) maxDiff = d;
        if (d > 2) changed++;
        sumDiff += d; n++;
      }
    }
  }
  console.log("--- diff com/sem sombras ---");
  console.log(JSON.stringify({
    pixels: n, changedOver2: changed, maxDiff: Math.round(maxDiff),
    meanDiff: +(sumDiff / n).toFixed(2)
  }));

  /* luminância média do piso, com e sem sombras */
  const lum = (img, x0f, y0f, x1f, y1f) => {
    let s = 0, k = 0, mn = 255, mx = 0;
    for (let y = Math.floor(y0f * img.h); y < y1f * img.h; y++) {
      for (let x = Math.floor(x0f * img.w); x < x1f * img.w; x++) {
        const i = (y * img.w + x) * img.channels;
        const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
        s += l; k++; if (l < mn) mn = l; if (l > mx) mx = l;
      }
    }
    return { avg: Math.round(s / k), min: Math.round(mn), max: Math.round(mx) };
  };
  console.log("--- piso (com sombras) ---", JSON.stringify(lum(A, 0.15, 0.8, 0.85, 1)));
  console.log("--- piso (sem sombras) ---", JSON.stringify(lum(B, 0.15, 0.8, 0.85, 1)));

  const chars = " .:-=+*#%@";
  const art = (img, x0f, y0f, x1f, y1f, cols, rows) => {
    const out = [];
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const gx0 = Math.floor((x0f + (x1f - x0f) * (c / cols)) * img.w);
        const gx1 = Math.floor((x0f + (x1f - x0f) * ((c + 1) / cols)) * img.w);
        const gy0 = Math.floor((y0f + (y1f - y0f) * (r / rows)) * img.h);
        const gy1 = Math.floor((y0f + (y1f - y0f) * ((r + 1) / rows)) * img.h);
        let s = 0, n = 0;
        for (let y = gy0; y < gy1; y++) for (let x = gx0; x < gx1; x++) {
          const i = (y * img.w + x) * img.channels;
          s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]; n++;
        }
        line += chars[Math.min(9, Math.floor((s / Math.max(1, n)) / 25.6))];
      }
      out.push(line);
    }
    return out.join("\n");
  };
  console.log("--- piso COM sombras ---\n" + art(A, 0.1, 0.72, 0.9, 1, 110, 24));
  console.log("--- piso SEM sombras ---\n" + art(B, 0.1, 0.72, 0.9, 1, 110, 24));
} catch (e) {
  console.error("ERRO:", e.message);
} finally {
  try { if (cdp) cdp.close(); } catch { /* ok */ }
  try { chrome.kill(); } catch { /* ok */ }
  await sleep(250);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
}
