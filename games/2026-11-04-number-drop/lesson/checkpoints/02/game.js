(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const W = 360, H = 560;
  const COLS = 5, ROWS = 7, CELL = 64;
  const GX = (W - COLS * CELL) / 2, GY = 92;

  let grid, blocks;
  let state = 'title'; // title | ready | busy | over

  // ---------- helpers ----------
  const cellX = (c) => GX + c * CELL;
  const cellY = (r) => GY + (ROWS - 1 - r) * CELL;
  const exp2 = (v) => Math.round(Math.log2(v));
  function color(v) {
    const e = exp2(v);
    const hue = (200 + e * 41) % 360;
    const light = e > 10 ? 48 : 56;
    return { fill: `hsl(${hue},72%,${light}%)`, dark: `hsl(${hue},70%,${light - 18}%)` };
  }
  function label(v) {
    if (v < 10000) return String(v);
    if (v < 1e6) return Math.floor(v / 1000) + 'K';
    return Math.floor(v / 1e6) + 'M';
  }

  // ---------- game ----------
  function makeBlock(v, c, r) {
    const b = { v, c, r, x: cellX(c), y: cellY(r) };
    blocks.push(b);
    return b;
  }
  function reset() {
    grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
    blocks = [];
    // お試し: いろいろな数字のブロックを並べてみる（ステップ3で消します）
    for (let c = 0; c < COLS; c++) grid[c][0] = makeBlock(2 ** (c + 1), c, 0);
    grid[1][1] = makeBlock(64, 1, 1);
    grid[2][1] = makeBlock(1024, 2, 1);
    grid[2][2] = makeBlock(16384, 2, 2);
  }
  function start() {
    $('overlay').classList.add('hide');
    state = 'ready';
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw();
    requestAnimationFrame(frame);
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
  function drawBlock(v, x, y, scale = 1, alpha = 1) {
    const s = (CELL - 6) * scale;
    const cx = x + CELL / 2, cy = y + CELL / 2;
    const col = color(v);
    ctx.globalAlpha = Math.max(0, alpha);
    roundRect(cx - s / 2, cy - s / 2 + 3, s, s, 12 * scale);
    ctx.fillStyle = col.dark; ctx.fill();
    roundRect(cx - s / 2, cy - s / 2, s, s - 2, 12 * scale);
    ctx.fillStyle = col.fill; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(cx - s / 2 + 5, cy - s / 2 + 4, s - 10, s * 0.28, 8 * scale); ctx.fill();
    const t = label(v);
    const fs = (t.length <= 2 ? 28 : t.length === 3 ? 24 : 19) * scale;
    ctx.font = `800 ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillText(t, cx, cy + 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(t, cx, cy);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // board
    roundRect(GX - 6, GY - 6, COLS * CELL + 12, ROWS * CELL + 12, 14);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        roundRect(cellX(c) + 4, cellY(r) + 4, CELL - 8, CELL - 8, 10);
        ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fill();
      }
    }
    // danger line
    ctx.strokeStyle = 'rgba(255,120,120,.35)';
    ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(GX, GY - 3); ctx.lineTo(GX + COLS * CELL, GY - 3); ctx.stroke();
    ctx.setLineDash([]);
    // blocks
    for (const b of blocks) drawBlock(b.v, b.x, b.y);
  }

  // ---------- input ----------
  $('start').addEventListener('click', (e) => { e.stopPropagation(); start(); });

  reset();
  requestAnimationFrame(frame);
})();
