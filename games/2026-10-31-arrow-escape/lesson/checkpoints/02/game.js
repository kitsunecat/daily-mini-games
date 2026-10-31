(() => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), startBtn = $('start');

  // 0:上 1:右 2:下 3:左
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const COLORS = ['#ff7a7a', '#ffc75a', '#5ee0b5', '#6ab8ff'];
  const SHADES = ['#c94f5a', '#c9923a', '#2f9c7b', '#3d82c4'];

  let N = 5, grid = [];
  let W = 0, H = 0, dpr = 1;

  // ---- 盤面生成（仮） ----
  function generate() {
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (Math.random() < 0.6) grid[r][c] = { dir: Math.floor(Math.random() * 4) };
    }
  }

  // ---- レイアウト ----
  function resize() {
    const rect = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function board() {
    const size = Math.min(W, H) * 0.92;
    const cell = size / N;
    return { x: (W - size) / 2, y: (H - size) / 2, size, cell };
  }

  // ---- 描画 ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawTile(cx, cy, s, dir, alpha, flash) {
    const pad = s * 0.08, w = s - pad * 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = SHADES[dir];
    roundRect(cx - w / 2, cy - w / 2 + s * 0.05, w, w, s * 0.18); ctx.fill();
    ctx.fillStyle = flash > 0 ? '#ff4d4d' : COLORS[dir];
    roundRect(cx - w / 2, cy - w / 2, w, w, s * 0.18); ctx.fill();
    // やじるし
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#fff';
    const a = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.lineTo(a * 0.85, -a * 0.05);
    ctx.lineTo(a * 0.3, -a * 0.05);
    ctx.lineTo(a * 0.3, a);
    ctx.lineTo(-a * 0.3, a);
    ctx.lineTo(-a * 0.3, -a * 0.05);
    ctx.lineTo(-a * 0.85, -a * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!W) return;
    const b = board();
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)';
      roundRect(b.x + c * b.cell + 2, b.y + r * b.cell + 2, b.cell - 4, b.cell - 4, b.cell * 0.14);
      ctx.fill();
    }
    // ブロック
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = grid[r][c];
      if (!t) continue;
      drawTile(b.x + (c + 0.5) * b.cell, b.y + (r + 0.5) * b.cell, b.cell, t.dir, 1, 0);
    }
  }

  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  window.addEventListener('resize', () => { resize(); draw(); });
  resize();
  generate();
  draw();
})();
