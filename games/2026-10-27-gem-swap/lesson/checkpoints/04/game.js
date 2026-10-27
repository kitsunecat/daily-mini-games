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
  let state = 'title'; // title, idle, swap, unswap
  let anim = null;
  let selected = null;

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

  function swapCells(a, b) {
    const tmp = grid[a[0]][a[1]];
    grid[a[0]][a[1]] = grid[b[0]][b[1]];
    grid[b[0]][b[1]] = tmp;
  }

  // ---------- 入れかえ ----------
  function trySwap(a, b) {
    if (state !== 'idle') return;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
    selected = null;
    state = 'swap';
    anim = { t: 0, dur: 160, a, b };
  }

  function afterSwap(a, b) {
    swapCells(a, b);
    state = 'idle';
  }

  // ---------- ゲーム進行 ----------
  function start() {
    newBoard();
    selected = null;
    overlay.classList.add('hidden');
    state = 'idle';
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

  function draw(now) {
    ctx.clearRect(0, 0, size, size);
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
    if (selected) {
      ctx.strokeStyle = '#ffe36e'; ctx.lineWidth = 3;
      ctx.strokeRect(selected[1] * cell + 2, selected[0] * cell + 2, cell - 4, cell - 4);
    }
    if (!grid.length) return;
    const sw = (state === 'swap' || state === 'unswap') ? anim : null;
    let p = sw ? Math.min(1, sw.t / sw.dur) : 0;
    if (sw && state === 'unswap') p = 1 - p;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = grid[r][c];
      if (!g) continue;
      let x = c * cell, y = (r + g.dy) * cell;
      if (sw) {
        const ease = p * p * (3 - 2 * p);
        if (r === sw.a[0] && c === sw.a[1]) { x += (sw.b[1] - c) * cell * ease; y += (sw.b[0] - r) * cell * ease; }
        else if (r === sw.b[0] && c === sw.b[1]) { x += (sw.a[1] - c) * cell * ease; y += (sw.a[0] - r) * cell * ease; }
      }
      if (y < -cell) continue;
      drawGem(g, x, y, g.scale);
    }
  }

  // ---------- ループ ----------
  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(50, now - prev); prev = now;
    if (anim && (state === 'swap' || state === 'unswap')) {
      anim.t += dt;
      if (anim.t >= anim.dur) {
        const a = anim; anim = null;
        if (state === 'swap') afterSwap(a.a, a.b);
        else if (state === 'unswap') state = 'idle';
      }
    }
    draw(now);
    requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  let down = null;
  function cellAt(e) {
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const c = Math.floor(x / cell), r = Math.floor(y / cell);
    return inside(r, c) ? [r, c] : null;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'idle') return;
    const p = cellAt(e);
    if (!p) return;
    e.preventDefault();
    down = { p, x: e.clientX, y: e.clientY, used: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!down || down.used || state !== 'idle') return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.35) return;
    down.used = true;
    const [r, c] = down.p;
    const t = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    if (inside(t[0], t[1])) trySwap(down.p, t);
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    const d = down; down = null;
    if (d.used || state !== 'idle') return;
    const p = d.p;
    if (selected && Math.abs(selected[0] - p[0]) + Math.abs(selected[1] - p[1]) === 1) {
      trySwap(selected, p);
    } else if (selected && selected[0] === p[0] && selected[1] === p[1]) {
      selected = null;
    } else {
      selected = p;
    }
  });
  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  resize();
  newBoard();
  requestAnimationFrame(loop);
})();
