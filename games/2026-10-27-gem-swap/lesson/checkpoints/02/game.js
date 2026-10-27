(() => {
  'use strict';

  const N = 8;
  const COLORS = 6;
  const PALETTE = [
    ['#ff5f7e', '#c2184b'], // ハート系の赤（丸）
    ['#ffb238', '#c76a00'], // オレンジ（ひし形）
    ['#ffe45c', '#b49b00'], // 黄（星）
    ['#4cd97b', '#14843d'], // 緑（四角）
    ['#4cb8ff', '#1462b4'], // 青（しずく型の三角）
    ['#c27dff', '#6b2fb3'], // 紫（六角形）
  ];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let size = 0, cell = 0, dpr = 1;
  let grid = [];

  // ---------- 盤面 ----------
  const rnd = (n) => Math.floor(Math.random() * n);
  const gem = (t, s) => ({ t, s: s || 0, dy: 0, scale: 1 });
  const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

  function newBoard() {
    grid = [];
    for (let r = 0; r < N; r++) {
      grid.push([]);
      for (let c = 0; c < N; c++) {
        let t;
        do { t = rnd(COLORS); } while (
          (c >= 2 && grid[r][c - 1].t === t && grid[r][c - 2].t === t) ||
          (r >= 2 && grid[r - 1][c].t === t && grid[r - 2][c].t === t)
        );
        grid[r].push(gem(t));
      }
    }
  }

  // ---------- 描画 ----------
  function resize() {
    const rect = stage.getBoundingClientRect();
    const avail = Math.min(rect.width - 16, rect.height - 16);
    cell = Math.max(24, Math.floor(avail / N));
    size = cell * N;
    dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function shapePath(t, cx, cy, R) {
    ctx.beginPath();
    if (t === 0) { ctx.arc(cx, cy, R, 0, Math.PI * 2); }
    else if (t === 1) { ctx.moveTo(cx, cy - R); ctx.lineTo(cx + R, cy); ctx.lineTo(cx, cy + R); ctx.lineTo(cx - R, cy); }
    else if (t === 2) {
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? R * 0.48 : R * 1.05;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
    }
    else if (t === 3) { const s = R * 0.85; roundRect(cx - s, cy - s, s * 2, s * 2, R * 0.3); }
    else if (t === 4) { ctx.moveTo(cx, cy - R); ctx.lineTo(cx + R * 0.95, cy + R * 0.75); ctx.lineTo(cx - R * 0.95, cy + R * 0.75); }
    else {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
    }
    ctx.closePath();
  }
  function roundRect(x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  }

  function drawGem(g, x, y, scale) {
    const cx = x + cell / 2, cy = y + cell / 2;
    const R = cell * 0.38 * scale;
    if (R <= 0.5) return;
    const [light, dark] = PALETTE[g.t];
    const grad = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
    grad.addColorStop(0, light); grad.addColorStop(1, dark);
    shapePath(g.t, cx, cy, R);
    ctx.fillStyle = grad; ctx.fill();
    ctx.lineWidth = Math.max(1, cell * 0.03);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
    // ツヤ
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(cx - R * 0.3, cy - R * 0.4, R * 0.28, R * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
    if (!grid.length) return;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = grid[r][c];
      if (!g) continue;
      const x = c * cell, y = (r + g.dy) * cell;
      drawGem(g, x, y, g.scale);
    }
  }

  startBtn.addEventListener('click', () => { overlay.classList.add('hidden'); });
  window.addEventListener('resize', () => { resize(); draw(); });

  resize();
  newBoard();
  draw();
})();
