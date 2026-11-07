(() => {
  'use strict';
  const COLS = 7, ROWS = 8, TOP = 0.6, BW = COLS, BH = TOP + ROWS + 1.0;
  const FLOOR = BH - 0.25;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let scale = 40, dpr = 1;
  let state = 'title'; // title | aim | fire | over
  let bricks = null;

  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 8;
    scale = Math.max(10, Math.min(aw / BW, ah / BH));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = (BW * scale) + 'px';
    cv.style.height = (BH * scale) + 'px';
    cv.width = Math.round(BW * scale * dpr);
    cv.height = Math.round(BH * scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- game logic ----
  function startGame() {
    bricks = [];
    state = 'aim';
    overlay.classList.add('hide');
  }

  // ---- render ----
  function draw(time) {
    const s = scale * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#140e28';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // grid dots
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let c = 1; c < COLS; c++) for (let r = 0; r <= ROWS; r++) ctx.fillRect(c - 0.02, TOP + r - 0.02, 0.04, 0.04);
    // danger line
    ctx.strokeStyle = 'rgba(255,90,120,.25)';
    ctx.lineWidth = 0.04; ctx.setLineDash([0.15, 0.12]);
    ctx.beginPath(); ctx.moveTo(0, TOP + ROWS - 1); ctx.lineTo(BW, TOP + ROWS - 1); ctx.stroke();
    ctx.setLineDash([]);
    // floor
    ctx.fillStyle = 'rgba(185,166,255,.25)';
    ctx.fillRect(0, FLOOR, BW, 0.04);

    if (!bricks) return;
  }

  function loop(t) {
    draw(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- input ----
  startBtn.addEventListener('click', e => { e.stopPropagation(); startGame(); });
})();
