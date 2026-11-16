(() => {
  'use strict';

  // ---- 定数 ----
  const W = 360, H = 640;              // 論理サイズ
  const BOX_Y = 14, BOX_H = 64;        // 箱エリア
  const TRAY_Y = 96, TRAY_H = 44;      // トレイ
  const TRAY_SIZE = 5;
  const BOARD = { x: 14, y: 156, w: W - 28, h: H - 170 };
  const SR = 11;                       // ねじ半径
  const PLANK_W = 34;
  const COLORS = [
    { name: 'red', c: '#ff5a5f', d: '#b8282d' },
    { name: 'blue', c: '#4ea8ff', d: '#1d64b5' },
    { name: 'yellow', c: '#ffd23f', d: '#b8901a' },
    { name: 'green', c: '#5ad17a', d: '#24863f' },
    { name: 'purple', c: '#b07cff', d: '#6a3cc0' },
    { name: 'orange', c: '#ff9a3c', d: '#b8601a' },
    { name: 'pink', c: '#ff7ac8', d: '#b83a86' },
  ];
  const WOODS = ['#e8b97a', '#d9a066', '#f0c992', '#cf9a5f', '#e3ad73'];

  // ---- DOM ----
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const levelEl = document.getElementById('level');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  let scale = 1;
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const availW = Math.max(100, r.width - 16), availH = Math.max(100, r.height - 8);
    scale = Math.min(availW / W, availH / H);
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---- 状態 ----
  let state = 'title';     // title | play | clear | over
  let level = 1, score = 0;

  function startGame() {
    level = 1; score = 0;
    overlay.classList.add('hidden');
    state = 'play';
    updateHud();
  }
  startBtn.addEventListener('click', startGame);

  function updateHud() {
    levelEl.textContent = level;
    scoreEl.textContent = score;
  }

  // ---- 更新 ----
  function update(dt) {
    // ステップ3から動きを足していく
  }

  // ---- 描画 ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 盤面背景
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    roundRect(BOARD.x - 6, BOARD.y - 6, BOARD.w + 12, BOARD.h + 12, 16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let gx = BOARD.x + 12; gx < BOARD.x + BOARD.w; gx += 28)
      for (let gy = BOARD.y + 12; gy < BOARD.y + BOARD.h; gy += 28) { ctx.beginPath(); ctx.arc(gx, gy, 1.4, 0, Math.PI * 2); ctx.fill(); }
  }

  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
