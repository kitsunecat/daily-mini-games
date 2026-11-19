(() => {
  'use strict';
  const VIEW_W = 360;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const scoreEl = document.getElementById('score');
  const starsEl = document.getElementById('stars');
  const bestEl = document.getElementById('best');

  let scale = 1, H = 640, dpr = 1;
  let running = false;

  // ---------- layout ----------
  function layout() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    scale = r.width / VIEW_W;
    H = r.height / scale;
    if (!running) draw();
  }

  // ---------- world ----------
  function newGame() {
    layout();
    running = true;
    overlay.classList.add('hidden');
  }

  // ---------- render ----------
  function draw() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1d3b6b'); sky.addColorStop(0.6, '#3f6fa8'); sky.addColorStop(1, '#f29e6d');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VIEW_W, H);
  }

  // ---------- input ----------
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); newGame(); });
  window.addEventListener('resize', layout);
  layout();
})();
