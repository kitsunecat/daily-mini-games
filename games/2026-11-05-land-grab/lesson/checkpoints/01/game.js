(() => {
  'use strict';
  const N = 40;                 // grid size (N x N)
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), btnStart = $('start');

  let state = 'title', lastT = 0;

  // ---------- canvas sizing ----------
  let S = 360, C = S / N;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    const px = Math.max(200, Math.round(Math.min(r.width, r.height || r.width)));
    cv.width = cv.height = Math.round(px * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = px; C = S / N;
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  // ---------- game flow ----------
  function start() {
    resize();
    state = 'play';
    overlay.classList.add('hide');
    lastT = performance.now();
  }

  // ---------- loop ----------
  function draw() {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < N; k++) {
      ctx.moveTo(k * C, 0); ctx.lineTo(k * C, S);
      ctx.moveTo(0, k * C); ctx.lineTo(S, k * C);
    }
    ctx.stroke();
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- input ----------
  btnStart.addEventListener('click', start);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) start(); });
  document.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });

  resize();
  requestAnimationFrame((t) => { lastT = t; frame(t); });
})();
