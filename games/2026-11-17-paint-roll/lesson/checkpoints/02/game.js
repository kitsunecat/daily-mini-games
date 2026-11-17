(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elLevel = $('level'), elScore = $('score'), elBest = $('best'), elMoves = $('moves'), elLives = $('lives');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  // 仮の迷路（# が壁、. が床、S がスタート。ステップ6で自動生成に置きかえる）
  const MAP = [
    '#######',
    '#S...##',
    '#.##..#',
    '#.#...#',
    '#.#.#.#',
    '#...#.#',
    '##....#',
    '#######',
  ];

  // ---------- state ----------
  let state = 'title'; // title | play | clear | over
  let level = 1, score = 0, lives = 3;
  let W = 0, H = 0, grid = null, painted = null, toPaint = 0, paintedCount = 0;
  let ball = { x: 0, y: 0, px: 0, py: 0 };
  let start = { x: 0, y: 0 };
  let hue = 330;
  let cell = 30, ox = 0, oy = 0;

  // ---------- level generation ----------
  function loadLevel() {
    H = MAP.length; W = MAP[0].length;
    grid = new Uint8Array(W * H);
    let sx = 1, sy = 1, count = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = MAP[y][x];
      if (ch !== '#') { grid[y * W + x] = 1; count++; }
      if (ch === 'S') { sx = x; sy = y; }
    }
    painted = new Uint8Array(W * H);
    toPaint = count; paintedCount = 0;
    start = { x: sx, y: sy };
    ball = { x: sx, y: sy, px: sx, py: sy };
    paint(sx, sy);
    resize();
  }

  function paint(x, y) {
    const i = y * W + x;
    if (!painted[i]) {
      painted[i] = 1; paintedCount++;
      return true;
    }
    return false;
  }

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
    const gw = W * cell, gh = H * cell;
    ctx.clearRect(0, 0, gw, gh);
    // walls background
    ctx.fillStyle = '#1d4e63';
    roundRect(0, 0, gw, gh, cell * 0.3); ctx.fill();
    // wall pattern
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!grid[y * W + x] && (x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    const pad = Math.max(1, cell * 0.04);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!grid[i]) continue;
      ctx.fillStyle = painted[i] ? `hsl(${hue},80%,62%)` : '#e9eef1';
      roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.18);
      ctx.fill();
      if (painted[i]) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x * cell + pad * 2, y * cell + pad * 2, cell - pad * 4, (cell - pad * 4) * 0.3);
      }
    }
    // ball
    const bx = (ball.px + 0.5) * cell, by = (ball.py + 0.5) * cell, br = cell * 0.36;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(bx, by + br * 0.75, br * 0.85, br * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const grad = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
    grad.addColorStop(0, `hsl(${hue},100%,85%)`);
    grad.addColorStop(1, `hsl(${hue},75%,42%)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- loop ----------
  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (grid) draw();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  startBtn.addEventListener('click', startGame);
  window.addEventListener('resize', () => { if (grid) resize(); });

  // title background: show a sample level
  level = 1; loadLevel();
  requestAnimationFrame(loop);
})();
