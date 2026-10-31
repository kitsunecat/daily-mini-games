(() => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), startBtn = $('start');

  // 0:上 1:右 2:下 3:左
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const COLORS = ['#ff7a7a', '#ffc75a', '#5ee0b5', '#6ab8ff'];
  const SHADES = ['#c94f5a', '#c9923a', '#2f9c7b', '#3d82c4'];

  let N = 5, grid = [], movers = [];
  let state = 'title'; // title | play
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

  // ---- 操作 ----
  function tapCell(r, c) {
    if (state !== 'play') return;
    const t = grid[r] && grid[r][c];
    if (!t) return;
    const d = t.dir;
    // 進める距離を調べる
    let x = c + DX[d], y = r + DY[d], dist = 0, blocked = false;
    while (x >= 0 && y >= 0 && x < N && y < N) {
      if (grid[y][x]) { blocked = true; break; }
      x += DX[d]; y += DY[d]; dist++;
    }
    if (!blocked) {
      grid[r][c] = null;
      movers.push({ r, c, dir: d, t: 0, dist: dist + 6 });
    }
  }
  function cellAt(px, py) {
    const b = board();
    const c = Math.floor((px - b.x) / b.cell), r = Math.floor((py - b.y) / b.cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return { r, c };
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const hit = cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) tapCell(hit.r, hit.c);
  });
  startBtn.addEventListener('click', start);

  // ---- 進行 ----
  function start() {
    generate();
    state = 'play';
    overlay.classList.add('hidden');
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
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function update(dt) {
    for (const m of movers) m.t += dt;
    movers = movers.filter((m) => m.t < 0.6);
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
    // 飛んでいくブロック
    for (const m of movers) {
      const p = m.t / 0.6;
      const k = (p * p) * m.dist * b.cell;
      drawTile(b.x + (m.c + 0.5) * b.cell + DX[m.dir] * k, b.y + (m.r + 0.5) * b.cell + DY[m.dir] * k, b.cell, m.dir, 1 - p, 0);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  generate();
  requestAnimationFrame(frame);
})();
