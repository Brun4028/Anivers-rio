/* ============================================================
   APP — direção da experiência (cenas, transições, interações)
   ============================================================ */

(function () {
  "use strict";

  const CFG = window.DN_CONFIG;
  const SFX = window.DNAudio.sfx;
  const FX = window.DNFX;

  /* ---------------- máquina de cenas ---------------- */
  let token = 0;
  let current = null;
  let typingActive = false;
  let skipFlag = false;

  const $ = function (id) { return document.getElementById(id); };

  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function alive(t) { return t === token; }

  async function goTo(id) {
    token++;
    const t = token;
    const next = $(id);
    if (current) current.classList.remove("is-active");
    next.classList.add("is-active");
    current = next;
    const enter = scenes[id];
    if (enter) await enter(t);
  }

  /* ---------------- datilografia ---------------- */
  function type(el, text, t, speed) {
    typingActive = true;
    skipFlag = false;
    const sp = speed || CFG.timing.typeSpeed;
    return new Promise(function (resolve) {
      const target = document.createElement("span");
      const caret = document.createElement("span");
      caret.className = "caret";
      el.textContent = "";
      el.appendChild(target);
      el.appendChild(caret);

      let i = 0;
      function step() {
        if (t !== undefined && t !== token) { typingActive = false; resolve(); return; }
        if (skipFlag) {
          skipFlag = false;
          target.textContent = text;
          caret.remove();
          typingActive = false;
          resolve();
          return;
        }
        if (i >= text.length) {
          caret.remove();
          typingActive = false;
          resolve();
          return;
        }
        const ch = text.charAt(i++);
        target.textContent += ch;
        if (ch !== " " && ch !== "\n" && Math.random() < 0.3) SFX.write();
        let d = sp + (Math.random() * sp * 0.7 - sp * 0.35);
        if (".?!,;".indexOf(ch) > -1) d += 220;
        if (ch === "\n") d += 260;
        setTimeout(step, d);
      }
      step();
    });
  }

  /* toque durante a escrita: completa imediatamente */
  document.addEventListener("pointerdown", function () {
    if (typingActive) skipFlag = true;
  }, true);

  /* ---------------- utilitários de elemento ---------------- */
  function reveal(el) { el.classList.add("is-visible"); }

  function showBtn(btn) {
    btn.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { btn.classList.add("is-visible"); });
    });
  }

  function hideBtn(btn) {
    btn.classList.remove("is-visible");
    setTimeout(function () { btn.hidden = true; }, 700);
  }

  /* ============================================================
     CENA 1 — INTRODUÇÃO
     ============================================================ */
  async function enterIntro(t) {
    FX.setDust(0.5);
    const line = $("intro-line");
    await sleep(2100);
    if (!alive(t)) return;
    await type(line, "Não deveria ser possível escrever o nome de alguém neste livro...", t, CFG.timing.typeSpeed + 8);
    if (!alive(t)) return;
    await sleep(1500);
    if (!alive(t)) return;
    line.style.transition = "opacity 1.4s ease";
    line.style.opacity = "0";
    await sleep(1300);
    if (!alive(t)) return;
    goTo("scene-book");
  }

  /* ============================================================
     CENA 2 — O LIVRO
     ============================================================ */
  async function enterBook(t) {
    FX.setDust(0.42);
    const cover = $("cover-book");
    const note = $("book-note");
    const btn = $("btn-open-book");
    cover.classList.add("is-in");
    await sleep(1500);
    if (!alive(t)) return;
    reveal(note);
    await sleep(1300);
    if (!alive(t)) return;
    showBtn(btn);
  }

  function bindBook() {
    $("btn-open-book").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.open();
      hideBtn(btn);
      const cover = $("cover-book");
      cover.classList.add("is-opening");
      $("book-note").classList.remove("is-visible");
      setTimeout(function () { goTo("scene-rules"); }, 1500);
    });
  }

  /* ============================================================
     CENA 3 — AS NOVAS REGRAS
     ============================================================ */
  const RULES = [
    {
      no: "REGRA Nº 1",
      text: "A pessoa cujo nome for escrito neste livro não morrerá.\nEm vez disso, receberá um desejo."
    },
    {
      no: "REGRA Nº 2",
      text: "O desejo somente poderá ser concedido no dia do aniversário da pessoa."
    },
    {
      no: "REGRA Nº 3",
      text: "Para que o desejo seja concedido, as sete Esferas do Dragão deverão ser reunidas."
    }
  ];
  let ruleIdx = 0;

  async function showRule(i, t, withFlip) {
    const box = $("rule-content");
    const btn = $("btn-rule");
    if (withFlip) {
      const flip = $("page-flip");
      flip.classList.remove("is-turning");
      void flip.offsetWidth;
      flip.classList.add("is-turning");
      SFX.page();
      await sleep(760);
      if (!alive(t)) return;
    }
    box.innerHTML = "";
    const no = document.createElement("span");
    no.className = "rule__no";
    no.textContent = RULES[i].no;
    const tx = document.createElement("span");
    tx.className = "rule__text";
    box.appendChild(no);
    box.appendChild(tx);
    no.style.opacity = "0";
    no.style.transition = "opacity 1.2s ease";
    requestAnimationFrame(function () { no.style.opacity = "1"; });
    await sleep(650);
    if (!alive(t)) return;
    await type(tx, RULES[i].text, t, 62);
    if (!alive(t)) return;

    if (i === RULES.length - 1) {
      /* última regra: pausa, depois iluminação dourada e avanço */
      await sleep(1900);
      if (!alive(t)) return;
      SFX.ink();
      $("page-glow").classList.add("is-on");
      await sleep(3200);
      if (!alive(t)) return;
      goTo("scene-spheres");
    } else {
      showBtn(btn);
    }
  }

  async function enterRules(t) {
    FX.setDust(0.4);
    ruleIdx = 0;
    const book = $("rules-book");
    book.classList.add("is-in");
    $("page-glow").classList.remove("is-on");
    await sleep(1100);
    if (!alive(t)) return;
    await showRule(0, t, false);
  }

  function bindRules() {
    $("btn-rule").addEventListener("click", async function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.click();
      hideBtn(btn);
      ruleIdx++;
      const t = token;

      if (ruleIdx < RULES.length) {
        await showRule(ruleIdx, t, true);
      }
      btn.dataset.busy = "";
    });
  }

  /* ============================================================
     CENA 4 — AS SETE ESFERAS
     ============================================================ */
  const ORB_POS = [
    { x: 16, y: 25 },
    { x: 50, y: 16 },
    { x: 84, y: 26 },
    { x: 27, y: 53 },
    { x: 73, y: 51 },
    { x: 41, y: 38 },
    { x: 61, y: 64 }
  ];
  let orbCount = 0;
  let orbTotal = 0;

  function buildOrb(i, orbitStyle) {
    const o = document.createElement("button");
    o.className = "orb" + (orbitStyle ? " orb--orbit" : "");
    o.type = "button";
    o.setAttribute("aria-label", "Esfera " + (i + 1) + " de 7");

    const core = document.createElement("span");
    core.className = "orb__core";
    o.appendChild(core);

    for (let s = 0; s < 3; s++) {
      const star = document.createElement("span");
      star.className = "orb__star";
      star.style.left = (22 + Math.random() * 54).toFixed(1) + "%";
      star.style.top = (20 + Math.random() * 56).toFixed(1) + "%";
      star.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
      o.appendChild(star);
    }

    if (!orbitStyle) {
      o.style.left = ORB_POS[i].x + "%";
      o.style.top = ORB_POS[i].y + "%";
    }
    return o;
  }

  function burstAt(el, opts) {
    const r = el.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  function collectOrb(orb, i) {
    if (orb.dataset.taken) return;
    orb.dataset.taken = "1";
    SFX.orb(i);
    burstAt(orb, { color: "rgba(255, 214, 140, @A)", count: 30, speed: 2.8 });
    burstAt(orb, { color: "rgba(200, 40, 40, @A)", count: 12, speed: 1.7, alpha: 0.7 });
    orb.classList.add("is-collected");

    orbCount++;
    const countEl = $("orb-count");
    countEl.textContent = String(orbCount);

    if (orbCount >= orbTotal) finishSpheres();
  }

  function buildOrbit(container, dur) {
    container.innerHTML = "";
    const core = document.createElement("span");
    core.className = "orbit__core";
    container.appendChild(core);

    const ring = document.createElement("span");
    ring.className = "orbit__ring";
    container.appendChild(ring);

    const arc = document.createElement("span");
    arc.className = "orbit__arc";
    container.appendChild(arc);

    const radius = container.offsetWidth * 0.4 || 160;

    for (let i = 0; i < 7; i++) {
      const arm = document.createElement("div");
      arm.className = "orbit__arm";
      const d = dur + i * 3;
      arm.style.setProperty("--dur", d + "s");
      arm.style.animationDuration = d + "s";
      arm.style.animationDelay = "-" + ((d / 7) * i).toFixed(2) + "s";
      arm.style.transform = "rotate(0deg)";

      const orb = buildOrb(i, true);
      orb.style.left = radius + "px";
      orb.style.top = "0px";
      arm.appendChild(orb);
      container.appendChild(arm);
    }
  }

  async function finishSpheres() {
    const t = token;
    SFX.gather();
    FX.setDust(1);
    await sleep(1250);
    if (!alive(t)) return;

    $("orbs-scattered").style.transition = "opacity 1s ease";
    $("orbs-scattered").style.opacity = "0";

    const orbit = $("orbs-orbit");
    orbit.hidden = false;
    buildOrbit(orbit, 46);

    const counter = $("orb-counter");
    counter.classList.add("is-complete");
    await sleep(5200);
    if (!alive(t)) return;
    goTo("scene-dragon");
  }

  async function enterSpheres(t) {
    FX.setDust(0.55);
    orbCount = 0;
    $("orb-count").textContent = "0";
    const counter = $("orb-counter");
    counter.classList.remove("is-complete");
    counter.classList.add("is-visible");

    const field = $("orbs-scattered");
    field.innerHTML = "";
    field.style.opacity = "1";
    $("orbs-orbit").hidden = true;

    orbTotal = ORB_POS.length;
    for (let i = 0; i < ORB_POS.length; i++) {
      const orb = buildOrb(i, false);
      orb.style.pointerEvents = "none";
      field.appendChild(orb);
      (function (o, idx) {
        o.addEventListener("click", function () {
          DNAudio.unlock();
          collectOrb(o, idx);
        });
      })(orb, i);
      const delay = 380 + i * 520;
      setTimeout(function () {
        if (!alive(t)) return;
        orb.classList.add("is-in");
        orb.style.pointerEvents = "auto";
        SFX.orb(i);
      }, delay);
    }
  }

  /* ============================================================
     CENA 5 — O DESEJO / DRAGÃO
     ============================================================ */
  async function enterDragon(t) {
    FX.setDust(0.8);
    const dragon = $("dragon");
    dragon.classList.remove("is-in");
    void dragon.offsetWidth;
    dragon.classList.add("is-in");
    SFX.dragon();

    const dobj = $("dragon-orbit");
    dobj.hidden = false;
    dobj.innerHTML = "";
    setTimeout(function () { if (alive(t)) buildOrbit(dobj, 60); }, 400);

    await sleep(2600);
    if (!alive(t)) return;
    await type($("dragon-q"), "Qual é o seu desejo?", t, 74);
    if (!alive(t)) return;
    await sleep(2100);
    if (!alive(t)) return;
    await type($("dragon-a"), "O desejo já foi escolhido.", t, 66);
    if (!alive(t)) return;
    await sleep(900);
    if (!alive(t)) return;
    showBtn($("btn-dragon"));
  }

  function bindDragon() {
    $("btn-dragon").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.click();
      hideBtn(btn);
      setTimeout(function () { goTo("scene-name"); btn.dataset.busy = ""; }, 800);
    });
  }

  /* ============================================================
     CENA 6 — O NOME
     ============================================================ */
  async function enterName(t) {
    FX.setDust(0.5);
    const scene = $("scene-name");
    scene.classList.remove("is-celebrating");
    $("birthday").classList.remove("is-visible");
    $("birthday").textContent = "";
    hideBtn($("btn-name"));

    const book = $("name-book");
    book.classList.remove("is-in");
    void book.offsetWidth;
    book.classList.add("is-in");

    /* metadados */
    const lines = document.querySelectorAll(".name-meta__line");
    lines.forEach(function (l) {
      l.classList.remove("is-visible");
      if (l.classList.contains("name-meta__line--field")) {
        l.textContent = "";
        l.appendChild(document.createTextNode(l.dataset.label + " "));
        if (CFG.birthday) {
          const v = document.createElement("span");
          v.className = "value";
          v.textContent = CFG.birthday;
          l.appendChild(v);
        } else {
          const ph = document.createElement("span");
          ph.className = "date-ph";
          l.appendChild(ph);
        }
      } else {
        l.textContent = l.dataset.text;
      }
    });

    $("written-name").textContent = "";
    await sleep(1300);
    if (!alive(t)) return;

    /* pena aparece e escreve o nome */
    const pen = $("pen");
    const nameEl = $("written-name");
    pen.classList.add("is-visible");
    pen.style.left = "0px";
    await sleep(700);
    if (!alive(t)) return;

    const word = CFG.name;
    for (let i = 0; i < word.length; i++) {
      if (!alive(t)) return;
      nameEl.textContent += word.charAt(i);
      SFX.write();
      /* pena acompanha o ponto de escrita */
      const w = nameEl.getBoundingClientRect().width;
      pen.style.left = w + "px";
      await sleep(360 + Math.random() * 260);
    }
    await sleep(600);
    if (!alive(t)) return;
    pen.style.transition = "opacity 1.2s ease";
    pen.classList.remove("is-visible");
    SFX.ink();

    await sleep(900);
    if (!alive(t)) return;

    /* linhas de registro */
    for (let i = 0; i < lines.length; i++) {
      if (!alive(t)) return;
      lines[i].classList.add("is-visible");
      await sleep(850);
    }

    await sleep(1500);
    if (!alive(t)) return;

    /* mensagem de aniversário */
    scene.classList.add("is-celebrating");
    const b = $("birthday");
    b.textContent = "FELIZ ANIVERSÁRIO, " + CFG.name;
    SFX.reveal();
    FX.setDust(0.85);
    await sleep(600);
    if (!alive(t)) return;
    b.classList.add("is-visible");

    await sleep(3000);
    if (!alive(t)) return;
    showBtn($("btn-name"));
  }

  function bindName() {
    $("btn-name").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.click();
      hideBtn(btn);
      setTimeout(function () { goTo("scene-sentence"); btn.dataset.busy = ""; }, 800);
    });
  }

  /* ============================================================
     CENA 7 — A SENTENÇA
     ============================================================ */
  async function enterSentence(t) {
    FX.setDust(0.45);
    const doc = $("sentence-doc");
    doc.classList.remove("is-in");
    void doc.offsetWidth;
    doc.classList.add("is-in");

    const list = document.querySelectorAll("#sentence-list li");
    list.forEach(function (li) { li.classList.remove("is-visible"); });
    document.querySelectorAll(".sentence .ornament").forEach(function (o) { o.classList.remove("is-visible"); });
    document.querySelectorAll(".sentence__hr").forEach(function (h) { h.classList.remove("is-visible"); });
    document.querySelector(".sentence__lead").classList.remove("is-visible");
    document.querySelector(".sentence__duration").classList.remove("is-visible");
    $("sentence-forever").classList.remove("is-visible");
    hideBtn($("btn-sentence"));

    await sleep(1400);
    if (!alive(t)) return;
    document.querySelector(".ornament--top").classList.add("is-visible");
    await sleep(900);
    if (!alive(t)) return;
    document.querySelector(".sentence__hr").classList.add("is-visible");
    await sleep(700);
    if (!alive(t)) return;
    document.querySelector(".sentence__lead").classList.add("is-visible");

    for (let i = 0; i < list.length; i++) {
      if (!alive(t)) return;
      list[i].classList.add("is-visible");
      if (i % 2 === 0) SFX.write();
      await sleep(760);
    }

    await sleep(900);
    if (!alive(t)) return;
    document.querySelector(".sentence__hr--short").classList.add("is-visible");
    await sleep(800);
    if (!alive(t)) return;
    document.querySelector(".sentence__duration").classList.add("is-visible");
    await sleep(1400);
    if (!alive(t)) return;
    SFX.ink();
    $("sentence-forever").classList.add("is-visible");
    await sleep(2600);
    if (!alive(t)) return;
    document.querySelector(".ornament--bottom").classList.add("is-visible");
    await sleep(1100);
    if (!alive(t)) return;
    showBtn($("btn-sentence"));
  }

  function bindSentence() {
    $("btn-sentence").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.close();
      hideBtn(btn);
      const doc = $("sentence-doc");
      doc.style.transition = "opacity 1.5s ease, transform 1.5s ease";
      doc.style.opacity = "0";
      doc.style.transform = "scaleY(0.86) translateY(10px)";
      setTimeout(function () {
        goTo("scene-animals");
        btn.dataset.busy = "";
      }, 1500);
    });
  }

  /* ============================================================
     CENA 8 — OS ANIMAIS
     ============================================================ */
  async function enterAnimals(t) {
    FX.setDust(0.85);
    $("animal-line-1").textContent = "";
    $("animal-line-2").textContent = "";
    hideBtn($("btn-gift"));

    await sleep(2400);
    if (!alive(t)) return;
    await type($("animal-line-1"), "Ah... quase esqueci.", t, 78);
    if (!alive(t)) return;
    await sleep(1500);
    if (!alive(t)) return;
    await type($("animal-line-2"), "Existe mais uma coisa para você.", t, 70);
    if (!alive(t)) return;
    await sleep(1300);
    if (!alive(t)) return;
    showBtn($("btn-gift"));
  }

  function bindAnimals() {
    $("btn-gift").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.click();
      hideBtn(btn);
      setTimeout(function () { goTo("scene-gift"); btn.dataset.busy = ""; }, 800);
    });
  }

  /* ============================================================
     CENA 9/10 — O PRESENTE E A CARTA
     ============================================================ */
  function letterText() {
    return CFG.letter.join("\n\n");
  }

  async function openGift(t) {
    const gift = $("gift");
    if (gift.dataset.opened) return;
    gift.dataset.opened = "1";
    DNAudio.unlock();
    SFX.gift();
    $("gift-hint").classList.remove("is-visible");
    gift.classList.add("is-opening");
    FX.burst(window.innerWidth / 2, window.innerHeight / 2,
      { color: "rgba(217, 154, 32, @A)", count: 34, speed: 2.4, life: 70 });

    await sleep(2400);
    if (!alive(t)) return;
    gift.classList.add("is-gone");

    await sleep(700);
    if (!alive(t)) return;

    /* carta */
    const letter = $("letter");
    letter.hidden = false;
    const textEl = $("letter-text");
    await sleep(1500);
    if (!alive(t)) return;
    await type(textEl, letterText(), t, 17);
    if (!alive(t)) return;
    document.querySelector(".letter__seal").classList.add("is-visible");
    SFX.ink();
    await sleep(1200);
    if (!alive(t)) return;
    showBtn($("btn-letter"));
  }

  async function enterGift(t) {
    FX.setDust(0.6);
    const gift = $("gift");
    gift.dataset.opened = "";
    gift.classList.remove("is-opening", "is-gone");
    $("gift-hint").classList.add("is-visible");
    $("letter").hidden = true;
    $("letter-text").textContent = "";
    document.querySelector(".letter__seal").classList.remove("is-visible");
    hideBtn($("btn-letter"));

    await sleep(1600);
    if (!alive(t)) return;
    /* aguarda o toque na caixa ("TOCAR") */
  }

  function bindGift() {
    $("gift").addEventListener("click", function () { openGift(token); });
    $("gift-hint").addEventListener("click", function () { openGift(token); });

    $("btn-letter").addEventListener("click", function () {
      const btn = this;
      if (btn.dataset.busy) return;
      btn.dataset.busy = "1";
      DNAudio.unlock();
      SFX.click();
      hideBtn(btn);
      setTimeout(function () { goTo("scene-final"); btn.dataset.busy = ""; }, 800);
    });
  }

  /* ============================================================
     CENA 11 — A MENSAGEM FINAL
     ============================================================ */
  async function enterFinal(t) {
    FX.setDust(0.7);
    const mark = $("final-mark");
    mark.hidden = true;
    mark.classList.remove("is-lit");
    $("final-friendship").classList.remove("is-visible");
    $("final-name").classList.remove("is-visible");
    $("final-birth").classList.remove("is-visible");
    document.querySelector(".ornament--end").classList.remove("is-visible");
    hideBtn($("btn-restart"));
    ["final-1", "final-2", "final-3"].forEach(function (id) { $(id).textContent = ""; });

    $("dragon-ghost").classList.add("is-in");

    await sleep(1600);
    if (!alive(t)) return;
    await type($("final-1"), "As Esferas do Dragão podem realizar desejos...", t, 62);
    if (!alive(t)) return;
    await sleep(1900);
    if (!alive(t)) return;
    await type($("final-2"), "Um livro pode registrar destinos...", t, 62);
    if (!alive(t)) return;
    await sleep(1900);
    if (!alive(t)) return;
    await type($("final-3"), "Mas nenhum dos dois consegue criar algo assim.", t, 62);
    if (!alive(t)) return;
    await sleep(3000);
    if (!alive(t)) return;

    /* transição para a marca final */
    const lines = document.querySelector(".final__lines");
    lines.style.transition = "opacity 1.6s ease";
    lines.style.opacity = "0";
    await sleep(1500);
    if (!alive(t)) return;
    lines.style.display = "none";

    mark.hidden = false;
    SFX.reveal();
    FX.setDust(1);

    await sleep(700);
    if (!alive(t)) return;
    $("final-friendship").textContent = "AMIZADE.";
    $("final-friendship").classList.add("is-visible");

    await sleep(3000);
    if (!alive(t)) return;
    $("final-name").textContent = CFG.name;
    $("final-name").classList.add("is-visible");
    mark.classList.add("is-lit");

    const ring = $("final-orbit");
    ring.hidden = false;
    ring.innerHTML = "";
    buildOrbit(ring, 54);

    SFX.gather();
    await sleep(2400);
    if (!alive(t)) return;
    $("final-birth").textContent = "Feliz aniversário.";
    $("final-birth").classList.add("is-visible");
    SFX.ink();

    await sleep(2600);
    if (!alive(t)) return;
    document.querySelector(".ornament--end").classList.add("is-visible");
    await sleep(900);
    if (!alive(t)) return;
    showBtn($("btn-restart"));
  }

  function bindFinal() {
    $("btn-restart").addEventListener("click", function () { location.reload(); });
  }

  /* ============================================================
     REGISTRO DAS CENAS + INICIALIZAÇÃO
     ============================================================ */
  const scenes = {
    "scene-intro": enterIntro,
    "scene-book": enterBook,
    "scene-rules": enterRules,
    "scene-spheres": enterSpheres,
    "scene-dragon": enterDragon,
    "scene-name": enterName,
    "scene-sentence": enterSentence,
    "scene-animals": enterAnimals,
    "scene-gift": enterGift,
    "scene-final": enterFinal
  };

  function boot() {
    current = $("scene-intro");

    bindBook();
    bindRules();
    bindDragon();
    bindName();
    bindSentence();
    bindAnimals();
    bindGift();
    bindFinal();

    FX.start();

    /* desbloqueio de áudio no primeiro toque + botão de som */
    const soundBtn = $("sound-toggle");
    function firstTouch() {
      DNAudio.unlock();
      soundBtn.hidden = false;
      requestAnimationFrame(function () { soundBtn.classList.add("is-visible"); });
      document.removeEventListener("pointerdown", firstTouch);
    }
    document.addEventListener("pointerdown", firstTouch);

    soundBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const muted = DNAudio.toggle();
      soundBtn.classList.toggle("is-muted", muted);
    });

    /* inicia a introdução */
    setTimeout(function () { enterIntro(0); }, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
