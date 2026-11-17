(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elLevel = $('level'), elScore = $('score'), elBest = $('best'), elMoves = $('moves'), elLives = $('lives');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  // ---------- state ----------
  let state = 'title'; // title | play | clear | over
  let level = 1, score = 0, lives = 3;
  let W = 0, H = 0, grid = null, painted = null, toPaint = 0, paintedCount = 0;
  let hue = 330;
  let cell = 30, ox = 0, oy = 0;

  // ---------- game flow ----------
  function startGame() {
    level = 1; score = 0; lives = 3;
    state = 'play';
    overlay.classList.add('hidden');
  }

  // ---------- render ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    const aw = Math.max(100, r.width - 16), ah = Math.max(100, r.height - 12);
    const gw = W || 7, gh = H || 8;
    cell = Math.floor(Math.min(aw / gw, ah / gh, 56));
    const dpr = window.devicePixelRatio || 1;
    cv.width = gw * cell * dpr; cv.height = gh * cell * dpr;
    cv.style.width = gw * cell + 'px'; cv.style.height = gh * cell + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    // 仮の draw（ステップ2で書きかえる）
    const gw = (W || 7) * cell, gh = (H || 8) * cell;
    ctx.clearRect(0, 0, gw, gh);
    ctx.fillStyle = '#1d4e63';
    roundRect(0, 0, gw, gh, cell * 0.3); ctx.fill();
  }

  // ---------- loop ----------
  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  startBtn.addEventListener('click', startGame);
  window.addEventListener('resize', () => { resize(); });

  resize();
  requestAnimationFrame(loop);
})();
