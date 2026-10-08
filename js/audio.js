/* ============================================================
   ÁUDIO — efeitos sonoros sintetizados + música ambiente
   ------------------------------------------------------------
   Todos os efeitos são gerados por WebAudio (sem arquivos),
   o que mantém o projeto offline e sem direitos autorais.
   A música ambiente usa um arquivo local opcional em
   assets/audio/ambient.mp3 (definido em config.js).
   ============================================================ */

window.DNAudio = (function () {
  const cfg = window.DN_CONFIG;
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let started = false;
  let muted = false;
  let musicEl = null;

  function init() {
    if (started) return;
    started = true;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = cfg.sfx.enabled ? 1 : 0;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = cfg.sfx.volume;
    sfxBus.connect(master);

    // Música ambiente (arquivo local opcional)
    if (cfg.music.enabled && cfg.music.src) {
      musicEl = document.getElementById("music");
      if (musicEl) {
        musicEl.src = cfg.music.src;
        musicEl.volume = cfg.music.volume;
        musicEl.addEventListener("error", function () {
          musicEl = null; // sem arquivo: segue só com os efeitos
        });
        const tryPlay = musicEl.play();
        if (tryPlay && typeof tryPlay.catch === "function") {
          tryPlay.catch(function () { /* espera um gesto do usuário */ });
        }
      }
    }
  }

  /* ---------- utilitários ---------- */
  function now() { return ctx.currentTime; }

  function env(node, t0, attack, peak, decay, sustain, end) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + attack + decay);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay + end);
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function tone(freq, type, t0, dur, vol, dest) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env(g, t0, 0.01, vol, dur * 0.55, vol * 0.25, dur * 0.45);
    osc.connect(g).connect(dest || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
    return osc;
  }

  function noise(t0, dur, vol, filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.2);
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = freq;
    flt.Q.value = q || 1;
    const g = ctx.createGain();
    env(g, t0, 0.02, vol, dur * 0.6, vol * 0.2, dur * 0.4);
    src.connect(flt).connect(g).connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.3);
    return { flt: flt, g: g };
  }

  function ready() { return started && ctx && !muted; }

  /* ---------- efeitos ---------- */
  const sfx = {
    /* abertura do livro */
    open: function () {
      if (!ready()) return;
      const t = now();
      const n = noise(t, 1.0, 0.16, "bandpass", 900, 0.8);
      n.flt.frequency.exponentialRampToValueAtTime(2400, t + 0.8);
      tone(84, "sine", t, 1.0, 0.10);
    },

    /* virar página */
    page: function () {
      if (!ready()) return;
      const t = now();
      const n = noise(t, 0.5, 0.13, "highpass", 1600, 0.7);
      n.flt.frequency.exponentialRampToValueAtTime(5200, t + 0.35);
    },

    /* escrita (pena no papel) */
    write: function () {
      if (!ready()) return;
      const t = now();
      noise(t, 0.12, 0.05, "bandpass", 3200 + Math.random() * 2200, 2.4);
    },

    /* clique nas esferas — sino suave */
    orb: function (index) {
      if (!ready()) return;
      const t = now();
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
      const f = scale[(index || 0) % scale.length];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      env(g, t, 0.008, 0.22, 0.9, 0.02, 1.1);
      osc.connect(g).connect(sfxBus);
      osc.start(t);
      osc.stop(t + 2.2);

      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = f * 2.01;
      env(g2, t, 0.008, 0.07, 0.6, 0.01, 0.7);
      osc2.connect(g2).connect(sfxBus);
      osc2.start(t);
      osc2.stop(t + 1.5);
    },

    /* reunião das sete esferas */
    gather: function () {
      if (!ready()) return;
      const t = now();
      const chord = [261.63, 329.63, 392.0, 523.25];
      chord.forEach(function (f, i) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f * 0.5, t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 2.2);
        env(g, t + i * 0.16, 0.9, 0.12, 1.8, 0.03, 1.6);
        osc.connect(g).connect(sfxBus);
        osc.start(t + i * 0.16);
        osc.stop(t + 5);
      });
      const n = noise(t, 3.2, 0.05, "lowpass", 400, 0.6);
      n.flt.frequency.exponentialRampToValueAtTime(1800, t + 2.6);
    },

    /* aparição do dragão — ressonância grave */
    dragon: function () {
      if (!ready()) return;
      const t = now();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(32, t);
      osc.frequency.exponentialRampToValueAtTime(49, t + 2.6);
      const flt = ctx.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = 240;
      env(g, t, 1.4, 0.16, 2.2, 0.04, 2.2);
      osc.connect(flt).connect(g).connect(sfxBus);
      osc.start(t);
      osc.stop(t + 6);

      const n = noise(t, 3.4, 0.05, "lowpass", 180, 0.5);
      n.flt.frequency.exponentialRampToValueAtTime(600, t + 3);
    },

    /* fechar o livro */
    close: function () {
      if (!ready()) return;
      const t = now();
      noise(t, 0.3, 0.14, "lowpass", 700, 0.8);
      tone(66, "sine", t, 0.7, 0.16);
    },

    /* abrir o presente */
    gift: function () {
      if (!ready()) return;
      const t = now();
      const n = noise(t, 0.8, 0.1, "bandpass", 1400, 1.2);
      n.flt.frequency.exponentialRampToValueAtTime(3600, t + 0.6);
      [659.25, 880, 1174.66].forEach(function (f, i) {
        tone(f, "sine", t + 0.3 + i * 0.14, 1.4, 0.07);
      });
    },

    /* revelação final */
    reveal: function () {
      if (!ready()) return;
      const t = now();
      const chord = [196.0, 246.94, 293.66, 392.0];
      chord.forEach(function (f, i) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        env(g, t + i * 0.3, 1.6, 0.1, 2.4, 0.03, 3);
        osc.connect(g).connect(sfxBus);
        osc.start(t + i * 0.3);
        osc.stop(t + 9);
      });
    },

    /* clique discreto em botões */
    click: function () {
      if (!ready()) return;
      const t = now();
      noise(t, 0.09, 0.05, "highpass", 3000, 1);
      tone(1180, "sine", t, 0.1, 0.03);
    },

    /* estalar de tinta / confirmação */
    ink: function () {
      if (!ready()) return;
      const t = now();
      tone(196, "sine", t, 0.5, 0.07);
      noise(t, 0.18, 0.05, "lowpass", 900, 1);
    }
  };

  /* ---------- controle ---------- */
  function unlock() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
    if (musicEl && musicEl.paused) {
      const p = musicEl.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function toggle() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : (cfg.sfx.enabled ? 1 : 0);
    if (musicEl) musicEl.muted = muted;
    return muted;
  }

  function isMuted() { return muted; }

  return {
    init: init,
    unlock: unlock,
    toggle: toggle,
    isMuted: isMuted,
    sfx: sfx
  };
})();
