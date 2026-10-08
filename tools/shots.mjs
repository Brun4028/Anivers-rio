/* ============================================================
   tools/shots.mjs — HARTEMPORÁRIO (será removido)
   ------------------------------------------------------------
   Roda a experiência em Chrome headless, tira capturas nos
   momentos-chave, converte cada captura em "arte ASCII" de
   luminância (para inspeção) e verifica:
     - erros de console/JS
     - que nenhum botão/toque fica coberto (elementFromPoint)
     - overflow horizontal
     - integridade dos textos oficiais
   Uso: node tools/shots.mjs            (desktop, fluxo completo)
        STOP=scene-animals node tools/shots.mjs 390 844 1
   ============================================================ */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import zlib from "node:zlib";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 9399;

const WIDTH = Number(process.argv[2] || 1440);
const HEIGHT = Number(process.argv[3] || 900);
const MOBILE = process.argv[4] === "1";
const SPEED = Number(process.env.SPEED || 1);
const STOP = process.env.STOP || "scene-final";
const LABEL = process.env.LABEL || (WIDTH + "x" + HEIGHT);

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
];
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) { console.error("Chrome não encontrado."); process.exit(2); }

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "dn-shots-"));

/* ---------------- CDP ---------------- */
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { res, rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
      on(fn) { listeners.push(fn); },
      close() { ws.close(); }
    });
    ws.onerror = (e) => reject(new Error("ws error: " + e.message));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) listeners.forEach((fn) => fn(msg));
    };
  });
}

/* ---------------- driver injetado ---------------- */
function driverSource(speed) {
  return `
(function () {
  window.__errors = [];
  window.__blocked = [];
  window.__overflow = [];
  window.__done = false;
  window.addEventListener('error', function (e) { window.__errors.push('ERR ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    window.__errors.push('REJ ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)));
  });

  var __orig = window.setTimeout;
  window.setTimeout = function (fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    var d = Math.max(0, (Number(delay) || 0) / ${speed});
    return __orig.apply(window, [fn, d].concat(rest));
  };

  /* nada pode ficar por cima do que é clicável (só na cena ativa) */
  function hitTest(el, tag) {
    try {
      var sc = el.closest ? el.closest('.scene') : null;
      if (!sc || !sc.classList.contains('is-active')) return;
      if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') return;
      var r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) {
        var oob = tag + '=>FORA_DA_TELA';
        if (window.__blocked.indexOf(oob) === -1) window.__blocked.push(oob);
        return;
      }
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === el || el.contains(hit))) {
        var name = tag + '=>' + (hit ? (hit.id || hit.className || hit.tagName) : 'null');
        if (window.__blocked.indexOf(name) === -1) window.__blocked.push(name);
      }
    } catch (e) { window.__errors.push('hit ' + e.message); }
  }

  setInterval(function () {
    try {
      if (document.documentElement.scrollWidth > window.innerWidth + 2 ||
          document.body.scrollWidth > window.innerWidth + 2) {
        var a = (document.querySelector('.scene.is-active') || {}).id || '?';
        if (window.__overflow.indexOf(a) === -1) window.__overflow.push(a);
      }
      var btns = document.querySelectorAll('.btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b.hidden && b.classList.contains('is-visible')) hitTest(b, b.id);
      }
      var gift = document.getElementById('gift');
      if (gift && !gift.dataset.opened && !gift.classList.contains('is-gone')) hitTest(gift, 'gift');
      var orbs = document.querySelectorAll('#orbs-scattered .orb');
      for (var j = 0; j < orbs.length; j++) {
        if (orbs[j].style.pointerEvents === 'auto') hitTest(orbs[j], 'orb');
      }
    } catch (err) { window.__errors.push('hit-driver ' + err.message); }
  }, 300);

  /* motor: avança pelos capítulos */
  setInterval(function () {
    try {
      var restart = document.getElementById('btn-restart');
      if (restart && !restart.hidden && restart.classList.contains('is-visible')) {
        window.__done = true; return;
      }
      var btns = document.querySelectorAll('.btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b.hidden && b.classList.contains('is-visible') && !b.classList.contains('is-muted')) {
          if (b.id === 'btn-restart') { window.__done = true; return; }
          b.click(); return;
        }
      }
      var active = document.querySelector('.scene.is-active');
      if (active && active.id === 'scene-spheres') {
        var orbs = document.querySelectorAll('#orbs-scattered .orb');
        for (var j = 0; j < orbs.length; j++) {
          var o = orbs[j];
          if (!o.dataset.taken && o.style.pointerEvents === 'auto') { o.click(); return; }
        }
        return;
      }
      if (active && active.id === 'scene-gift') {
        var gift = document.getElementById('gift');
        if (gift && !gift.dataset.opened) { gift.click(); return; }
      }
    } catch (err) { window.__errors.push('driver ' + err.message); }
  }, 260);
})();`;
}

/* ---------------- PNG → luminância ---------------- */
function decodePNG(buf) {
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels || bitDepth !== 8 || interlace) {
    throw new Error("PNG não suportado: ct=" + colorType + " bd=" + bitDepth + " il=" + interlace);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride); p += stride;
    const off = y * stride;
    const prevOff = off - stride;
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
      } else if (filter !== 0) throw new Error("filtro " + filter);
      out[off + x] = v & 255;
    }
  }
  return { w, h, channels, data: out };
}

function luminanceAt(img, x, y) {
  const i = (y * img.w + x) * img.channels;
  return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
}

function regionStats(img, x0f, y0f, x1f, y1f) {
  const x0 = Math.floor(x0f * img.w), x1 = Math.floor(x1f * img.w);
  const y0 = Math.floor(y0f * img.h), y1 = Math.floor(y1f * img.h);
  let sum = 0, n = 0, min = 255, max = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const l = luminanceAt(img, x, y);
    sum += l; n++; if (l < min) min = l; if (l > max) max = l;
  }
  return { avg: Math.round(sum / n), min: Math.round(min), max: Math.round(max) };
}

function ascii(img, cols, rows) {
  const chars = " .:-=+*#%@";
  const buckets = new Float64Array(cols * rows);
  const counts = new Float64Array(cols * rows);
  for (let y = 0; y < img.h; y++) {
    const r = Math.min(rows - 1, Math.floor((y / img.h) * rows));
    for (let x = 0; x < img.w; x++) {
      const c = Math.min(cols - 1, Math.floor((x / img.w) * cols));
      const k = r * cols + c;
      buckets[k] += luminanceAt(img, x, y);
      counts[k]++;
    }
  }
  let out = "";
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const v = counts[k] ? buckets[k] / counts[k] : 0;
      line += chars[Math.min(chars.length - 1, Math.floor(v / 25.6))];
    }
    out += line + "\n";
  }
  return out;
}

/* recorte em alta densidade: deixa ver a textura das letras */
function asciiCrop(img, x0f, y0f, x1f, y1f, cols, rows) {
  const x0 = Math.floor(x0f * img.w), x1 = Math.floor(x1f * img.w);
  const y0 = Math.floor(y0f * img.h), y1 = Math.floor(y1f * img.h);
  const chars = " .:-=+*#%@";
  const buckets = new Float64Array(cols * rows);
  const counts = new Float64Array(cols * rows);
  for (let y = y0; y < y1; y++) {
    const r = Math.min(rows - 1, Math.floor(((y - y0) / (y1 - y0)) * rows));
    for (let x = x0; x < x1; x++) {
      const c = Math.min(cols - 1, Math.floor(((x - x0) / (x1 - x0)) * cols));
      const k = r * cols + c;
      buckets[k] += luminanceAt(img, x, y);
      counts[k]++;
    }
  }
  let out = "";
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      const v = counts[k] ? buckets[k] / counts[k] : 0;
      line += chars[Math.min(chars.length - 1, Math.floor(v / 25.6))];
    }
    out += line + "\n";
  }
  const st = regionStats(img, x0f, y0f, x1f, y1f);
  return { art: out, stats: st };
}

/* ---------------- execução ---------------- */
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dn-shots-profile-"));
const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + profile,
  "--window-size=" + WIDTH + "," + HEIGHT,
  "--force-device-scale-factor=1",
  "about:blank"
], { stdio: "ignore" });

let cdp = null;
const report = { label: LABEL, errors: [], blocked: [], overflow: [], shots: [], texts: {} };

function expr(e) {
  return cdp.send("Runtime.evaluate", { expression: e, returnByValue: true })
    .then((r) => (r.result && r.result.value));
}

async function waitFor(e, timeoutMs, what) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await expr(e); } catch { /* janela */ }
    if (v) return v;
    if (Date.now() - t0 > (timeoutMs || 30000)) throw new Error("timeout: " + (what || e));
    await sleep(180);
  }
}

async function shot(name, note, crops) {
  const r = await cdp.send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(r.data, "base64");
  const file = path.join(OUT, name + ".png");
  fs.writeFileSync(file, buf);
  const img = decodePNG(buf);
  report.shots.push({ name, note, file });
  console.log("\n### " + name + (note ? " — " + note : "") + " (" + img.w + "x" + img.h + ")");
  console.log(ascii(img, 76, 30));
  if (crops) {
    for (const c of crops) {
      const res = asciiCrop(img, c.box[0], c.box[1], c.box[2], c.box[3], c.cols || 128, c.rows || 40);
      console.log("--- recorte: " + c.label + " [avg " + res.stats.avg +
        " | min " + res.stats.min + " | max " + res.stats.max + "]");
      console.log(res.art);
    }
  }
  return img;
}

try {
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === "page");
    } catch { /* subindo */ }
  }
  if (!target) throw new Error("CDP não respondeu");

  cdp = await connect(target.webSocketDebuggerUrl);
  const events = [];
  cdp.on((m) => events.push(m));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: MOBILE
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: driverSource(SPEED) });
  await cdp.send("Page.navigate", { url: pathToFileURL(path.join(ROOT, "index.html")).href });

  /* espera uma condição de captura; se perder, só avisa */
async function shotWhen(cond, timeout, name, note, crops) {
  try {
    await waitFor(cond, timeout, name);
  } catch (e) {
    console.log("!! captura perdida: " + name + " — " + e.message);
    return;
  }
  return shot(name, note, crops);
}

const scene = `document.querySelector('.scene.is-active')`;
  const inked = (sel) =>
    `(function(){var a=document.querySelectorAll('${sel} .ink-ch').length,
      b=document.querySelectorAll('${sel} .ink-ch:not(.is-pending)').length;
      return [b,a];})()`;

  console.log(`\n===== ${LABEL} — ${WIDTH}x${HEIGHT} — speed ${SPEED} =====`);
  await waitFor(`${scene}.id === 'scene-book'`, 40000, "scene-book");
  console.log("cena: livro");

  await waitFor(`${scene}.id === 'scene-rules'`, 40000, "scene-rules");
  await shotWhen(`(function(){var v=${inked('#rule-content')};return v[0]>=4 && v[1]>v[0];})()`, 20000,
    "1-rules-writing", "regra nº1 no meio da escrita",
    [{ label: "papel + tinta (página direita)", box: [0.5, 0.12, 0.97, 0.62] }]);

  await shotWhen(`(function(){var v=${inked('#rule-content')};return v[0]===v[1] && v[1]>10;})()`, 40000,
    "2-rules-written", "regra nº1 terminada",
    [{ label: "regra inteira", box: [0.5, 0.12, 0.97, 0.62] }]);
  report.texts.rule = await expr(`(document.getElementById('rule-content')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim()`);

  await waitFor(`${scene}.id === 'scene-spheres'`, 120000, "scene-spheres");
  console.log("cena: esferas");
  await waitFor(`${scene}.id === 'scene-dragon'`, 120000, "scene-dragon");
  console.log("cena: dragão");

  await waitFor(`${scene}.id === 'scene-name'`, 120000, "scene-name");
  await shotWhen(`(function(){var e=document.getElementById('written-name');
      return e && e.textContent.length>=3 && document.querySelector('.pen').classList.contains('is-visible');})()`, 60000,
    "3-name-writing", "nome sendo escrito pela pena",
    [{ label: "nome na linha", box: [0.5, 0.2, 0.97, 0.62] }]);

  await shotWhen(`(function(){var l=document.querySelectorAll('.name-meta__line');
      if(l.length<4) return false;
      for(var i=0;i<l.length;i++){ if(!l[i].classList.contains('is-visible')||!l[i].classList.contains('is-wiped')) return false; }
      return true;})()`, 90000,
    "4-name-meta", "registro escrito no papel");
  report.texts.meta = await expr(`[].map.call(document.querySelectorAll('.name-meta__line'),function(l){return l.textContent.trim();})`);

  await waitFor(`${scene}.id === 'scene-sentence'`, 120000, "scene-sentence");
  await shotWhen(`(function(){var v=${inked('.sentence__list')};return v[0]>=6 && v[1]>v[0];})()`, 60000,
    "5-sentence-writing", "itens da sentença sendo escritos");

  await shotWhen(`(function(){var v=${inked('.sentence__list')};var f=${inked('.sentence__forever')};
      return v[0]===v[1] && f[0]===f[1] && f[1]>5;})()`, 120000,
    "6-sentence-done", "sentença inteira escrita",
    [{ label: "lista + firma", box: [0.3, 0.1, 0.7, 0.85] }]);
  report.texts.sentence = await expr(`[].map.call(document.querySelectorAll('#sentence-list li'),function(li){return li.textContent.trim();})`);
  report.texts.forever = await expr(`document.getElementById('sentence-forever').textContent.trim()`);

  await waitFor(`${scene}.id === 'scene-animals'`, 90000, "scene-animals");
  await sleep(2600);
  await shot("7-animals-atmosphere", "cena dos animais — só atmosfera",
    [{ label: "piso iluminado", box: [0.1, 0.7, 0.9, 1.0], cols: 120, rows: 30 },
     { label: "cômodo inteiro (sem textos ainda)", box: [0, 0, 1, 1], cols: 76, rows: 24 }]);
  report.texts.critters = await expr(`document.querySelectorAll('.critter, .critters').length`);

  await shotWhen(`document.getElementById('animal-line-2').textContent.length >= 29`, 60000,
    "8-animals-lines", "falas + botão presente",
    [{ label: "tipografia das falas", box: [0.25, 0.34, 0.75, 0.66], cols: 128, rows: 44 },
     { label: "piso + sombras", box: [0.1, 0.72, 0.9, 1.0], cols: 120, rows: 30 }]);
  report.texts.animals = await expr(`[document.getElementById('animal-line-1').textContent, document.getElementById('animal-line-2').textContent]`);

  if (STOP === "scene-animals") {
    report.texts.done = await expr("true");
  } else {
    await waitFor(`${scene}.id === 'scene-gift'`, 90000, "scene-gift");
    await sleep(1600);
    await shot("9-gift", "o presente");  await shotWhen(`(function(){var v=${inked('#letter-text')};return v[0]>=30 && v[1]>v[0];})()`, 90000,
    "10-letter-writing", "carta sendo escrita à mão");

  await shotWhen(`(function(){var v=${inked('#letter-text')};return v[0]===v[1] && v[1]>400;})()`, 240000,
    "11-letter-done", "carta terminada",
    [{ label: "escrita da carta", box: [0.3, 0.06, 0.7, 0.42] }]);
    report.texts.letter = await expr(`document.getElementById('letter-text').textContent`);

    await waitFor(`${scene}.id === 'scene-final'`, 90000, "scene-final");
    await waitFor(`document.getElementById('final-mark') && !document.getElementById('final-mark').hidden
        && document.getElementById('final-name').textContent.length > 0`, 120000, "marca final");
    await sleep(1500);
    await shot("12-final", "mensagem final");
    await waitFor("window.__done === true", 120000, "fim da experiência");
    report.texts.done = true;
  }

  report.errors = await expr("window.__errors") || [];
  report.blocked = await expr("window.__blocked") || [];
  report.overflow = await expr("window.__overflow") || [];
  for (const m of events) {
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      report.errors.push("exception: " + ((d.exception && d.exception.description) || d.text));
    }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      const text = (m.params.entry.text || "") + " " + (m.params.entry.url || "");
      if (!/ambient\\.mp3|fonts\\.googleapis|fonts\\.gstatic|favicon/i.test(text)) {
        report.errors.push("log: " + text.trim());
      }
    }
  }
} catch (e) {
  report.errors.push("rodada: " + e.message);
  try {
    const pageErrs = await expr("window.__errors") || [];
    report.errors.push("page-errors: " + JSON.stringify(pageErrs));
    const state = await expr(`JSON.stringify({
      scene: (document.querySelector('.scene.is-active')||{}).id,
      btnName: (function(){var b=document.getElementById('btn-name');return b?{hidden:b.hidden,cls:b.className}:null;})(),
      meta: [].map.call(document.querySelectorAll('.name-meta__line'),function(l){return l.className;}),
      written: (document.getElementById('written-name')||{}).textContent,
      pen: (document.querySelector('.pen')||{}).className
    })`);
    report.errors.push("estado: " + state);
  } catch { /* cdp pode estar morto */ }
} finally {
  try { if (cdp) cdp.close(); } catch { /* ok */ }
  try { chrome.kill(); } catch { /* ok */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
}

/* ---------------- saída ---------------- */
console.log("\n================ RESUMO " + LABEL + " ================");
console.log(JSON.stringify({
  errors: report.errors,
  blocked: report.blocked,
  overflow: report.overflow,
  texts: {
    rule: report.texts.rule,
    meta: report.texts.meta,
    sentence: report.texts.sentence,
    forever: report.texts.forever,
    animals: report.texts.animals,
    critters: report.texts.critters,
    done: report.texts.done,
    letterHead: report.texts.letter && report.texts.letter.slice(0, 24),
    letterTail: report.texts.letter && report.texts.letter.slice(-28)
  },
  shots: report.shots.map((s) => s.name + " -> " + s.file)
}, null, 2));
