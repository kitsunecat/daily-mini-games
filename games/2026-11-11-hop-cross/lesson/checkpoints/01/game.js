(() => {
  'use strict';
  const COLS = 9;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  let W = 0, H = 0, CS = 0, DPR = 1, viewRows = 14;
  function resize() {
    const r = stage.getBoundingClientRect();
    const availW = Math.max(200, r.width - 16), availH = Math.max(260, r.height - 8);
    W = Math.floor(Math.min(availW, availH * 0.62));
    H = Math.floor(Math.min(availH, W * 1.9));
    CS = W / COLS;
    viewRows = H / CS;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw();
  }

  // ---------- world ----------
  let camBottom = 0;

  // ---------- input ----------
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', e => { if (e.target !== startBtn) { e.preventDefault(); start(); } });

  function start() {
    overlay.classList.add('hidden');
  }

  // ---------- draw ----------
  const sy = r => H - (r - camBottom + 1) * CS; // top y of row r

  function draw() {
    if (!CS) return;
    ctx.clearRect(0, 0, W, H);
    const r0 = Math.floor(camBottom) - 1, r1 = Math.ceil(camBottom + viewRows) + 1;
    for (let r = r0; r <= r1; r++) {
      ctx.fillStyle = r % 2 ? '#86d073' : '#7cc86a'; ctx.fillRect(0, sy(r), W, CS + 1);
    }
  }

  window.addEventListener('resize', resize);
  resize();
})();
