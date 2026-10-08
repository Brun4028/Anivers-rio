/* ============================================================
   tools/verify.mjs — verificação automática da experiência
   ------------------------------------------------------------
   Abre o projeto no Chrome headless (CDP), acelera os
   temporizadores, clica sozinho pelos 11 capítulos e verifica:
     - erros de console/JS
     - textos exatos das falas obrigatórias
     - todas as cenas visitadas
     - overflow horizontal (desktop e celular)

   Uso:  node tools/verify.mjs
   ============================================================ */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 9333;
const SPEED = 8; // divide todos os setTimeout por este valor

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
];
const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) { console.error("Chrome não encontrado."); process.exit(2); }

/* ---------------- cliente CDP mínimo ---------------- */
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
      } else if (msg.method) {
        listeners.forEach((fn) => fn(msg));
      }
    };
  });
}

/* ---------------- script injetado na página ---------------- */
function injectedSource(speed, label) {
  return `
(function () {
  window.__errors = [];
  window.__scenes = [];
  window.__overflow = [];
  window.__geom = [];
  window.__done = false;
  window.addEventListener('error', function (e) {
    window.__errors.push('[${label}] ' + (e.message || 'error'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    window.__errors.push('[${label}] unhandled: ' + (r && r.message ? r.message : String(r)));
  });

  // acelera os temporizadores da experiência
  var __orig = window.setTimeout;
  window.setTimeout = function (fn, delay) {
    var rest = Array.prototype.slice.call(arguments, 2);
    var d = Math.max(0, (Number(delay) || 0) / ${speed});
    return __orig.apply(window, [fn, d].concat(rest));
  };

  // motor automático: clica pelos capítulos
  var __iv = setInterval(function () {
    try {
      if (window.__done) return;
      var active = document.querySelector('.scene.is-active');
      if (active) {
        if (window.__scenes[window.__scenes.length - 1] !== active.id) window.__scenes.push(active.id);
        if (document.documentElement.scrollWidth > window.innerWidth + 2 ||
            document.body.scrollWidth > window.innerWidth + 2) {
          window.__overflow.push(active.id);
        }

        // geometria: elementos-chave precisam caber na tela
        var KEY = ['intro-line','cover-book','rules-book','name-book','sentence-doc','gift',
                   'letter','final-mark','dragon-q','animal-line-1','orb-counter','birthday',
                   'final-name','written-name','sentence-forever','final-friendship','counter',
                   'rule-content','name-meta','letter-text'];
        for (var k = 0; k < KEY.length; k++) {
          var el = document.getElementById(KEY[k]) || document.querySelector('.' + KEY[k]);
          if (!el) continue;
          var sc = el.closest('.scene');
          if (!sc || !sc.classList.contains('is-active')) continue;
          if (el.hasAttribute('hidden')) continue;
          if (!el.getClientRects().length) continue;

          // acha o ancestral de recorte: rolagem => alcançável; hidden => limite real
          var clipped = null, scrollable = false, p = el.parentElement;
          while (p && p !== document.documentElement) {
            var cs = getComputedStyle(p);
            var oy = cs.overflowY;
            if (oy === 'auto' || oy === 'scroll') { scrollable = true; break; }
            if (oy === 'hidden' || oy === 'clip') { clipped = p; break; }
            p = p.parentElement;
          }
          if (scrollable) continue;
          var bound = clipped ? clipped.getBoundingClientRect()
                              : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

          var r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          if (r.left < bound.left - 2 || r.right > bound.right + 2) {
            var mh = active.id + '#' + KEY[k] + ' h[' + Math.round(r.left) + ',' + Math.round(r.right) + '/' + Math.round(bound.right) + ']';
            if (window.__geom.indexOf(mh) === -1) window.__geom.push(mh);
          }
          if (r.top < bound.top - 2 || r.bottom > bound.bottom + 2) {
            var mv = active.id + '#' + KEY[k] + ' v[' + Math.round(r.top) + ',' + Math.round(r.bottom) + '/' + Math.round(bound.bottom) + ']';
            if (window.__geom.indexOf(mv) === -1) window.__geom.push(mv);
          }
        }
      }
      var restart = document.getElementById('btn-restart');
      if (restart && !restart.hidden && restart.classList.contains('is-visible')) {
        window.__done = true;
        clearInterval(__iv);
        return;
      }
      var btns = document.querySelectorAll('.btn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b.hidden && b.classList.contains('is-visible') &&
            !b.classList.contains('is-muted')) {
          if (b.id === 'btn-restart') { window.__done = true; clearInterval(__iv); return; }
          b.click();
          return;
        }
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
    } catch (err) {
      window.__errors.push('[${label}] driver: ' + err.message);
    }
  }, 260);
})();
`;
}

/* ---------------- rodada de verificação ---------------- */
async function runPass(opts) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dn-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--window-size=" + opts.width + "," + opts.height,
    "--force-device-scale-factor=1",
    "about:blank"
  ], { stdio: "ignore" });

  try {
    /* espera o CDP responder */
    let target = null;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      try {
        const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
        target = list.find((t) => t.type === "page");
        if (target) break;
      } catch { /* ainda subindo */ }
    }
    if (!target) throw new Error("CDP não respondeu");

    const cdp = await connect(target.webSocketDebuggerUrl);
    const events = [];
    cdp.on((m) => events.push(m));

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: opts.width, height: opts.height,
      deviceScaleFactor: 1, mobile: opts.mobile
    });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: injectedSource(SPEED, opts.label)
    });

    const url = pathToFileURL(path.join(ROOT, "index.html")).href;
    await cdp.send("Page.navigate", { url });

    /* espera o motor terminar (ou estourar o tempo) */
    let state = null;
    const deadline = Date.now() + (opts.timeout || 300000);
    let ticks = 0;
    console.log("  deadline:", Math.round(opts.timeout / 1000) + "s");
    while (Date.now() < deadline) {
      await sleep(1000);
      try {
        const r = await cdp.send("Runtime.evaluate", {
          expression: "JSON.stringify({e:window.__errors,s:window.__scenes,o:window.__overflow,g:window.__geom,d:window.__done})",
          returnByValue: true
        });
        state = JSON.parse(r.result.value);
        if (state.d) break;
        ticks++;
        if (process.env.VERBOSE && ticks % 5 === 0) {
          console.log(`  [t+${ticks}s] scenes:`, (state.s || []).join(","), "| errs:", JSON.stringify(state.e), "| geom:", JSON.stringify((state.g || []).slice(0, 6)));
        }
      } catch (err) {
        console.log("  poll error:", err.message);
      }
    }

    /* coleta final: textos + erros de console */
    const finalExpr = `JSON.stringify((function(){
      var t = function(id){ var el = document.getElementById(id); return el ? el.textContent.trim() : null; };
      var lis = [].map.call(document.querySelectorAll('#sentence-list li'), function(li){ return li.textContent.trim(); });
      var meta = [].map.call(document.querySelectorAll('.name-meta__line'), function(l){ return l.textContent.trim(); });
      return {
        done: window.__done,
        errors: window.__errors,
        scenes: window.__scenes,
        overflow: window.__overflow,
        geom: window.__geom,
        intro: t('intro-line'),
        writtenName: t('written-name'),
        meta: meta,
        sentence: lis,
        forever: t('sentence-forever'),
        animal1: t('animal-line-1'),
        animal2: t('animal-line-2'),
        final1: t('final-1'),
        final2: t('final-2'),
        final3: t('final-3'),
        friendship: t('final-friendship'),
        finalName: t('final-name'),
        birth: t('final-birth'),
        rule: (document.getElementById('rule-content')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim(),
        birthday: t('birthday'),
        dragonQ: t('dragon-q'),
        dragonA: t('dragon-a'),
        note: t('book-note'),
        count: t('orb-count'),
        letter: (document.getElementById('letter-text')||{textContent:''}).textContent,
        spheresActive: document.querySelectorAll('#orbs-orbit .orb').length
      };
    })())`;

    let final = {};
    try {
      const r = await cdp.send("Runtime.evaluate", { expression: finalExpr, returnByValue: true });
      final = JSON.parse(r.result.value);
    } catch (e) { final = { evalError: String(e) } };

    /* erros de console/log via CDP */
    const consoleErrors = [];
    for (const m of events) {
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        consoleErrors.push("exception: " + (d.exception && d.exception.description || d.text));
      }
      if (m.method === "Log.entryAdded" && ["error"].includes(m.params.entry.level)) {
        const e = m.params.entry;
        const text = (e.text || "") + " " + (e.url || "");
        const ignorable = /ambient\.mp3|fonts\.googleapis|fonts\.gstatic|favicon/i.test(text);
        if (!ignorable) consoleErrors.push("log: " + text.trim());
      }
    }

    cdp.close();
    return { final, consoleErrors, timedOut: !final.done };
  } finally {
    try { chrome.kill(); } catch { /* já morto */ }
    await sleep(400);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ok */ }
  }
}

/* ---------------- asserções ---------------- */
function check(results, label, failures) {
  const f = (cond, msg) => { if (!cond) failures.push(label + ": " + msg); };

  f(results.timedOut === false, "experiência não terminou a tempo (done=false)");

  const errs = (results.final.errors || []).concat(results.consoleErrors || []);
  f(errs.length === 0, "erros de JS/console: " + JSON.stringify(errs, null, 2));

  const scenes = results.final.scenes || [];
  const expected = [
    "scene-intro", "scene-book", "scene-rules", "scene-spheres", "scene-dragon",
    "scene-name", "scene-sentence", "scene-animals", "scene-gift", "scene-final"
  ];
  for (const s of expected) f(scenes.includes(s), "cena não visitada: " + s);

  f((results.final.overflow || []).length === 0,
    "overflow horizontal em: " + JSON.stringify(results.final.overflow));

  f((results.final.geom || []).length === 0,
    "elemento fora da tela: " + JSON.stringify((results.final.geom || []).slice(0, 12)));

  f(results.final.intro === "Não deveria ser possível escrever o nome de alguém neste livro...",
    "intro incorreta: " + JSON.stringify(results.final.intro));

  f(/REGRA Nº 1/.test(results.final.rule || "") ||
     /REGRA Nº 3/.test(results.final.rule || ""),
    "regras não exibidas: " + JSON.stringify(results.final.rule));

  f(results.final.writtenName === "ISADORA",
    "nome escrito: " + JSON.stringify(results.final.writtenName));

  const meta = results.final.meta || [];
  f(meta[0] === "Nome registrado.", "meta[0]: " + JSON.stringify(meta[0]));
  f((meta[1] || "").startsWith("Data de nascimento:"), "meta[1]: " + JSON.stringify(meta[1]));
  f(meta[2] === "Status: Aniversariante", "meta[2]: " + JSON.stringify(meta[2]));
  f(meta[3] === "Destino: Felicidade", "meta[3]: " + JSON.stringify(meta[3]));

  const wantList = [
    "receber carinho",
    "rir até a barriga doer",
    "receber amor de animais",
    "ter muitos momentos felizes",
    "continuar criando coisas incríveis",
    "deixar sua marca no mundo",
    "realizar seus sonhos"
  ];
  f(JSON.stringify(results.final.sentence) === JSON.stringify(wantList),
    "sentença incorreta: " + JSON.stringify(results.final.sentence));

  f(results.final.forever === "O resto da vida.", "forever: " + JSON.stringify(results.final.forever));
  f(results.final.animal1 === "Ah... quase esqueci.", "animal1: " + JSON.stringify(results.final.animal1));
  f(results.final.animal2 === "Existe mais uma coisa para você.", "animal2: " + JSON.stringify(results.final.animal2));
  f(results.final.final1 === "As Esferas do Dragão podem realizar desejos...", "final1: " + JSON.stringify(results.final.final1));
  f(results.final.final2 === "Um livro pode registrar destinos...", "final2: " + JSON.stringify(results.final.final2));
  f(results.final.final3 === "Mas nenhum dos dois consegue criar algo assim.", "final3: " + JSON.stringify(results.final.final3));
  f(results.final.friendship === "AMIZADE.", "friendship: " + JSON.stringify(results.final.friendship));
  f(results.final.finalName === "ISADORA", "finalName: " + JSON.stringify(results.final.finalName));
  f(results.final.birth === "Feliz aniversário.", "birth: " + JSON.stringify(results.final.birth));
  f(results.final.birthday === "FELIZ ANIVERSÁRIO, ISADORA",
    "mensagem de aniversário: " + JSON.stringify(results.final.birthday));
  f(results.final.dragonQ === "Qual é o seu desejo?", "dragonQ: " + JSON.stringify(results.final.dragonQ));
  f(results.final.dragonA === "O desejo já foi escolhido.", "dragonA: " + JSON.stringify(results.final.dragonA));
  f(results.final.note === "Uma nova regra foi adicionada.", "book note: " + JSON.stringify(results.final.note));
  f(/REGRA Nº 3/.test(results.final.rule || ""),
    "última regra não é a Nº 3: " + JSON.stringify(results.final.rule));
  f(/sete Esferas do Dragão deverão ser reunidas/.test(results.final.rule || ""),
    "texto da REGRA Nº 3: " + JSON.stringify(results.final.rule));
  f(results.final.count === "7", "contador de esferas: " + JSON.stringify(results.final.count));
  f(results.final.spheresActive === 7, "esferas em órbita: " + results.final.spheresActive);
  f((results.final.letter || "").startsWith("[Isadora,"),
    "carta placeholder ausente");
  f((results.final.letter || "").endsWith("Que o melhor ainda esteja por vir.]"),
    "carta não termina como esperado");
}

/* ---------------- execução ---------------- */
const passes = [
  { label: "desktop", width: 1440, height: 900, mobile: false, timeout: Number(process.env.TIMEOUT || 300) * 1000 },
  { label: "mobile", width: 390, height: 844, mobile: true, timeout: Number(process.env.TIMEOUT || 300) * 1000 },
  { label: "tablet", width: 768, height: 1024, mobile: true, timeout: Number(process.env.TIMEOUT || 300) * 1000 },
  { label: "paisagem", width: 844, height: 390, mobile: true, timeout: Number(process.env.TIMEOUT || 300) * 1000 }
];

const failures = [];
for (const p of passes) {
  if (process.env.PASS && !process.env.PASS.split(",").includes(p.label)) continue;
  console.log(`\n=== passagem ${p.label} (${p.width}x${p.height}) ===`);
  try {
    const res = await runPass(p);
    console.log("cenas visitadas:", (res.final.scenes || []).join(" -> "));
    console.log("tempo esgotado:", res.timedOut);
    check(res, p.label, failures);
  } catch (e) {
    failures.push(p.label + ": falha da rodada: " + e.message);
  }
}

console.log("\n========================================");
if (failures.length === 0) {
  console.log("OK — todas as verificações passaram.");
  process.exit(0);
} else {
  console.log("FALHAS (" + failures.length + "):");
  failures.forEach((f) => console.log(" - " + f));
  process.exit(1);
}
