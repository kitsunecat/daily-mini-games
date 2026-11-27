(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), kcEl = $('kc'), boardEl = $('board');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const boostBtn = $('boost'), msgEl = $('msg');

  let W = 0, H = 0, DPR = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- world ----
  const R = 1300;               // arena radius

  let state = 'title';   // title | play | dying | over
  let lastT = 0;
  let camX = 0, camY = 0, camS = 1;

  // ---- simulation ----
  function update(dt) {
    const want = Math.min(W, H * 0.8) / 380;
    camS += (want - camS) * Math.min(1, dt * 2);
  }

  // ---- drawing ----
  function draw(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#1a1d3a';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(camS, camS);
    ctx.translate(-camX, -camY);
    const vw = W / 2 / camS + 40, vh = H / 2 / camS + 40;
    const x0 = camX - vw, x1 = camX + vw, y0 = camY - vh, y1 = camY + vh;

    // arena floor
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = '#20244a'; ctx.fill();
    // hex dot grid
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(140, 150, 230, .16)';
    const g = 46;
    for (let y = Math.floor(y0 / g) * g; y < y1; y += g) {
      const off = (Math.round(y / g) & 1) ? g / 2 : 0;
      for (let x = Math.floor(x0 / g) * g + off; x < x1; x += g) { ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    ctx.restore();
    // wall
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255, 80, 90, .75)';
    ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ---- flow ----
  function start() {
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '進みたい方向をタッチ！';
  }

  // ---- input ----
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) { e.preventDefault(); start(); } });
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && state !== 'play' && state !== 'dying') { e.preventDefault(); start(); return; }
  });

  // ---- loop ----
  function frame(t) {
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    if (W !== stage.clientWidth || H !== stage.clientHeight) resize();
    update(dt);
    draw(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
