/* ============================================================
   FX — partículas em canvas (poeira ambiente e estouro das esferas)
   ============================================================ */

window.DNFX = (function () {
  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0, dpr = 1;
  let raf = null;
  let dust = [];        // partículas de fundo
  let bursts = [];       // partículas de efeito
  let dustAlpha = 0.0;   // intensidade da poeira (0 a 1)
  let dustTarget = 0.0;
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeDust() {
    const count = Math.round(Math.min(90, Math.max(34, (w * h) / 24000)));
    dust = [];
    for (let i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * 0.09,
        vy: -(Math.random() * 0.12 + 0.02),
        a: Math.random() * 0.5 + 0.15,
        ph: Math.random() * Math.PI * 2,
        warm: Math.random() < 0.22
      });
    }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    ctx.clearRect(0, 0, w, h);

    // transição suave da intensidade da poeira
    dustAlpha += (dustTarget - dustAlpha) * 0.012;

    if (dustAlpha > 0.004) {
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i];
        p.x += p.vx;
        p.y += p.vy;
        p.ph += 0.011;
        if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;

        const tw = 0.55 + Math.sin(p.ph) * 0.45;
        const alpha = p.a * tw * dustAlpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.warm
          ? "rgba(217, 154, 32," + alpha.toFixed(3) + ")"
          : "rgba(232, 228, 220," + (alpha * 0.8).toFixed(3) + ")";
        ctx.fill();
      }
    }

    // estouros (bursts)
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= 1;
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.965;
      b.vy *= 0.965;
      b.vy += 0.014;
      const t = b.life / b.max;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = b.color.replace("@A", (t * t * b.a).toFixed(3));
      ctx.fill();
    }
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    makeDust();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  /* intensidade da poeira: 0 (invisible) a 1 */
  function setDust(level) { dustTarget = Math.max(0, Math.min(1, level)); }

  /* explosão de partículas em (x, y) */
  function burst(x, y, opts) {
    opts = opts || {};
    const n = opts.count || 26;
    const color = opts.color || "rgba(255, 214, 140, @A)";
    const speed = opts.speed || 2.6;
    const life = opts.life || 52;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const sp = speed * (0.35 + Math.random() * 0.85);
      bursts.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: Math.random() * 1.9 + 0.7,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
        a: opts.alpha || 0.9,
        color: color
      });
    }
  }

  window.addEventListener("resize", function () {
    if (!running) return;
    resize();
    makeDust();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  return { start: start, stop: stop, setDust: setDust, burst: burst };
})();
