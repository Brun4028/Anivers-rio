/* tools/debug.mjs — carrega a página e despeja estado + erros */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 9444;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

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
    ws.onerror = (e) => reject(new Error("ws: " + e.message));
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dn-dbg-"));
const chrome = spawn(CHROME, [
  "--headless", "--disable-gpu", "--no-first-run",
  "--remote-allow-origins=*", "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + profile, "about:blank"
], { stdio: "ignore" });

try {
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === "page");
    } catch { /* subindo */ }
  }
  const cdp = await connect(target.webSocketDebuggerUrl);
  const events = [];
  cdp.on((m) => events.push(m));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Runtime.setAsyncCallStackDepth", { maxDepth: 8 });

  /* mesma injeção usada pelo verify.mjs */
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `
(function () {
  window.__errors = [];
  window.__scenes = [];
  window.__overflow = [];
  window.__done = false;
  window.addEventListener('error', function (e) { window.__errors.push('ERR ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) { window.__errors.push('REJ ' + String(e.reason)); });
  var __orig = window.setTimeout;
  window.setTimeout = function (fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    var d = Math.max(0, (Number(delay) || 0) / 8);
    return __orig.apply(window, [fn, d].concat(rest));
  };
  var __iv = setInterval(function () {
    try {
      if (window.__done) return;
      var active = document.querySelector('.scene.is-active');
      if (active && window.__scenes[window.__scenes.length - 1] !== active.id) window.__scenes.push(active.id);
      var restart = document.getElementById('btn-restart');
      if (restart && !restart.hidden && restart.classList.contains('is-visible')) { window.__done = true; clearInterval(__iv); return; }
      var btns = document.querySelectorAll('.btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b.hidden && b.classList.contains('is-visible')) { b.click(); window.__clicked = (window.__clicked||[]).concat(b.id); return; }
      }
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
})();` });

  const url = pathToFileURL(path.join(ROOT, "index.html")).href;
  console.log("navegando:", url);
  await cdp.send("Page.navigate", { url });
  await sleep(8000);

  const expr = `JSON.stringify({
    readyState: document.readyState,
    dnConfig: typeof window.DN_CONFIG,
    dnAudio: typeof window.DNAudio,
    dnFX: typeof window.DNFX,
    errors: window.__errors || null,
    introHTML: (document.getElementById('intro-line')||{}).innerHTML,
    activeScene: (document.querySelector('.scene.is-active')||{}).id,
    scripts: [].map.call(document.scripts, s => s.src.split('/').pop()),
    resources: performance.getEntriesByType('resource').map(r => r.name.split('/').pop() + ':' + r.responseStatus),
    btnOpen: (function(){var b=document.getElementById('btn-open-book');return {hidden:b.hidden, cls:b.className};})(),
    clicked: window.__clicked || null,
    scenes: window.__scenes || null,
    timeoutPatched: window.setTimeout.toString().indexOf('__orig') > -1 || window.setTimeout.name
  }, null, 1)`;
  const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  console.log(r.result.value);

  console.log("--- eventos CDP ---");
  for (const m of events) {
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      console.log("EXCEPTION:", (d.exception && d.exception.description) || d.text, "@", d.url || "", d.lineNumber);
    }
    if (m.method === "Log.entryAdded") {
      const e = m.params.entry;
      console.log("LOG[" + e.level + "]:", e.text, e.url || "");
    }
    if (m.method === "Runtime.consoleAPICalled") {
      console.log("CONSOLE:", m.params.type, JSON.stringify(m.params.args.map(a => a.value || a.description)));
    }
  }
  cdp.close();
} finally {
  try { chrome.kill(); } catch {}
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
