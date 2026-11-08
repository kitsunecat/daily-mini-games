(() => {
  'use strict';
  const W = 360;
  let H = 650;
  const COLS = 6, CELL = 54, GX = (W - COLS * CELL) / 2, GY = 206;
  const BENCH = 5, SEAT_X0 = 36, SEAT_STEP = 72, BENCH_Y = 136, WALK_Y = 184;
  const BUS_X = 22, BUS_Y = 14, BUS_W = 200, BUS_H = 70, CAP = 3;
  const PALETTE = ['#ff5a5f', '#3fa7ff', '#ffd23f', '#3ddc84', '#b06cff', '#ff9a3c', '#ff7ad9'];
  const WALL = -2, EMPTY = -1;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let state = 'title';
  let rows = 5;

  // ---------- helpers ----------
  const seatPos = i => ({ x: SEAT_X0 + i * SEAT_STEP, y: BENCH_Y });

  // ---------- game flow ----------
  function startGame() {
    overlay.classList.add('hide');
    state = 'play';
  }

  // ---------- draw ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // road
    ctx.fillStyle = '#3b4250'; ctx.fillRect(0, 0, W, 100);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.moveTo(0, 96); ctx.lineTo(W, 96); ctx.stroke(); ctx.setLineDash([]);
    // bus stop sign
    ctx.fillStyle = '#ddd'; ctx.fillRect(W - 44, 30, 4, 66);
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(W - 42, 30, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a00'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BUS', W - 42, 31);
    // sidewalk / bench
    ctx.fillStyle = '#c9bfa8'; ctx.fillRect(0, 100, W, 102);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let x = 0; x < W; x += 30) ctx.fillRect(x, 100, 1, 102);
    for (let i = 0; i < BENCH; i++) {
      const p = seatPos(i);
      ctx.fillStyle = '#8a5a34'; rr(p.x - 28, p.y + 4, 56, 14, 5); ctx.fill();
      ctx.fillStyle = '#a8703f'; rr(p.x - 28, p.y + 2, 56, 8, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); rr(p.x - 20, p.y - 24, 40, 40, 10); ctx.stroke(); ctx.setLineDash([]);
    }
    // plaza
    ctx.fillStyle = '#2f6b45'; rr(GX - 6, GY - 6, COLS * CELL + 12, rows * CELL + 12, 12); ctx.fill();
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
      const x = GX + c * CELL, y = GY + r * CELL;
      ctx.fillStyle = (r + c) % 2 ? '#3a7d52' : '#367549'; rr(x + 2, y + 2, CELL - 4, CELL - 4, 8); ctx.fill();
    }
    // exit arrows
    ctx.fillStyle = 'rgba(80,60,30,.35)';
    for (let c = 0; c < COLS; c++) { const x = GX + c * CELL + CELL / 2; ctx.beginPath(); ctx.moveTo(x, 190); ctx.lineTo(x - 6, 198); ctx.lineTo(x + 6, 198); ctx.fill(); }
  }

  // ---------- sizing / input ----------
  function resize() {
    H = GY + rows * CELL + 22;
    const st = $('stage'), aw = st.clientWidth - 16, ah = st.clientHeight - 8;
    const s = Math.max(0.3, Math.min(aw / W, ah / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr); cv.height = Math.floor(H * s * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);

  startBtn.addEventListener('click', startGame);

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  resize();
  requestAnimationFrame(loop);
})();
