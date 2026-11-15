(() => {
  'use strict';
  const COLS = 6, ROWS = 7;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const $score = document.getElementById('score');
  const $best = document.getElementById('best');
  const $stageNo = document.getElementById('stage-no');
  const $fill = document.getElementById('timefill');
  const $ttext = document.getElementById('timetext');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let state = 'title'; // title | play | clear | over
  let now = 0;
  let cs = 40, border = 14, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;

  // ---------- layout ----------
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 8;
    cs = Math.floor(Math.min(aw / (COLS + 0.8), ah / (ROWS + 0.8)));
    border = Math.max(10, Math.round(cs * 0.36));
    W = cs * COLS + border * 2; H = cs * ROWS + border * 2;
    dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ox = border; oy = border;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---------- game flow ----------
  function startGame() {
    overlay.classList.add('hidden');
    state = 'play';
  }

  // ---------- input ----------
  startBtn.addEventListener('click', startGame);

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // frame
    ctx.fillStyle = '#3c4f6b'; rr(0, 0, W, H, border); ctx.fill();
    ctx.fillStyle = '#16263d'; ctx.fillRect(ox, oy, COLS * cs, ROWS * cs);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#1c2f4a' : '#1a2b44';
      ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2);
    }
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; now += dt;
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
