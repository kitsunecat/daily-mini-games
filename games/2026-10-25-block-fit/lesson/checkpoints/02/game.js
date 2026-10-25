(() => {
  const N = 8;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let board, playing = false;
  let layout = {};

  // ---- layout ----
  function resize() {
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width, H = rect.height;
    const pad = 14;
    // board takes width, tray needs ~ board*0.42 below
    const boardSize = Math.min(W - pad * 2, (H - pad * 3) / 1.45);
    const cell = boardSize / N;
    const bx = (W - boardSize) / 2;
    const by = pad;
    const trayY = by + boardSize + pad;
    const trayH = Math.max(H - trayY - pad, cell * 3);
    layout = { W, H, cell, bx, by, boardSize, trayY, trayH, mini: cell * 0.55 };
    draw();
  }

  // ---- game logic ----
  function start() {
    board = Array.from({ length: N }, () => Array(N).fill(null));
    playing = true;
    overlay.classList.add('hidden');
  }

  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  // ---- drawing ----
  function block(x, y, s, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    const g = 2;
    ctx.fillStyle = color;
    roundRect(x + g / 2, y + g / 2, s - g, s - g, s * 0.18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(x + s * 0.15, y + s * 0.12, s * 0.7, s * 0.2, s * 0.08);
    ctx.fill();
    ctx.globalAlpha = 1;
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
    const { W, H, cell, bx, by, boardSize } = layout;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    // board bg
    ctx.fillStyle = '#262b52';
    roundRect(bx - 6, by - 6, boardSize + 12, boardSize + 12, 12);
    ctx.fill();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = bx + c * cell, y = by + r * cell;
        if (board && board[r][c]) block(x, y, cell, board[r][c]);
        else {
          ctx.fillStyle = '#323868';
          roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.15);
          ctx.fill();
        }
      }
    }
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
