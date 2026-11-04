(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const W = 360, H = 560;
  const COLS = 5, ROWS = 7, CELL = 64;
  const GX = (W - COLS * CELL) / 2, GY = 92;
  const PREVIEW_Y = 22;

  let grid, blocks, maxV, cur, selCol = 2;
  let state = 'title'; // title | ready | busy | over
  let waiters = [];

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
  function height(c) {
    let h = 0;
    while (h < ROWS && grid[c][h]) h++;
    return h;
  }
  function randValue() {
    const top = Math.max(3, Math.min(8, exp2(maxV) - 2));
    // smaller numbers more often
    let total = 0;
    const ws = [];
    for (let e = 1; e <= top; e++) { const w = 1 / e; ws.push(w); total += w; }
    let r = Math.random() * total;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return 2 ** (i + 1); }
    return 2;
  }
  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }
  function settled() { return new Promise((res) => waiters.push(res)); }

  // ---------- game ----------
  function makeBlock(v, c, r, y) {
    const b = { v, c, r, x: cellX(c), y: y == null ? cellY(r) : y, tx: cellX(c), ty: cellY(r), pop: 0, dying: false, alpha: 1 };
    blocks.push(b);
    return b;
  }
  function reset() {
    grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
    blocks = [];
    maxV = 2;
    cur = randValue();
  }
  function start() {
    reset();
    $('overlay').classList.add('hide');
    state = 'ready';
  }

  async function drop(c) {
    if (state !== 'ready') return;
    const h = height(c);
    if (h >= ROWS) return;
    state = 'busy';
    const b = makeBlock(cur, c, h, PREVIEW_Y);
    grid[c][h] = b;
    await settled();
    await resolve([b]);
    cur = randValue();
    state = 'ready';
  }

  async function resolve(active) {
    while (active.length) {
      const b = active.pop();
      if (b.dying) continue;
      const nb = [];
      for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const c = b.c + dc, r = b.r + dr;
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        const o = grid[c][r];
        if (o && o.v === b.v) nb.push(o);
      }
      if (!nb.length) continue;
      for (const o of nb) {
        grid[o.c][o.r] = null;
        o.dying = true; o.tx = b.tx; o.ty = b.ty;
      }
      b.v *= 2 ** nb.length;
      b.pop = 1;
      await sleep(160);
      const moved = gravity();
      await settled();
      active.push(...moved, b);
    }
  }

  function gravity() {
    const moved = [];
    for (let c = 0; c < COLS; c++) {
      let w = 0;
      for (let r = 0; r < ROWS; r++) {
        const b = grid[c][r];
        if (!b) continue;
        if (r !== w) {
          grid[c][w] = b; grid[c][r] = null;
          b.r = w; b.ty = cellY(w);
          moved.push(b);
        }
        w++;
      }
    }
    return moved;
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    for (const b of blocks) {
      const sp = 1600 * dt;
      const dx = b.tx - b.x, dy = b.ty - b.y;
      const d = Math.hypot(dx, dy);
      if (b.dying) {
        b.alpha -= dt * 7;
        if (d > 0.5) { const k = Math.min(1, (900 * dt) / d); b.x += dx * k; b.y += dy * k; }
        moving = true;
      } else if (d > 0.5) {
        const k = Math.min(1, sp / d);
        b.x += dx * k; b.y += dy * k;
        moving = true;
      } else { b.x = b.tx; b.y = b.ty; }
      if (b.pop > 0) b.pop = Math.max(0, b.pop - dt * 5);
    }
    blocks = blocks.filter((b) => !(b.dying && b.alpha <= 0));
    if (!moving && waiters.length) { const ws = waiters; waiters = []; ws.forEach((f) => f()); }
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
      if (c === selCol && state !== 'title' && state !== 'over') {
        ctx.fillStyle = 'rgba(126,224,255,.10)';
        ctx.fillRect(cellX(c), GY, CELL, ROWS * CELL);
      }
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
    for (const b of blocks) if (b.dying) drawBlock(b.v, b.x, b.y, 0.9, b.alpha);
    for (const b of blocks) if (!b.dying) drawBlock(b.v, b.x, b.y, 1 + Math.sin(b.pop * Math.PI) * 0.12);
    // preview
    if (state === 'ready') {
      const px = cellX(selCol);
      const h = height(selCol);
      const ly = h >= ROWS ? GY : cellY(h);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(px + CELL / 2, PREVIEW_Y + CELL); ctx.lineTo(px + CELL / 2, ly + 4); ctx.stroke();
      ctx.setLineDash([]);
      drawBlock(cur, px, PREVIEW_Y, 0.92 + Math.sin(performance.now() / 250) * 0.03);
    }
  }

  // ---------- input ----------
  function colFromEvent(e) {
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(COLS - 1, Math.floor((x - GX) / CELL)));
  }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'ready') return;
    selCol = colFromEvent(e);
    drop(selCol);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') selCol = colFromEvent(e);
  });
  $('start').addEventListener('click', (e) => { e.stopPropagation(); start(); });
  window.addEventListener('keydown', (e) => {
    if (!$('overlay').classList.contains('hide')) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
      return;
    }
    if (e.key === 'ArrowLeft') { selCol = Math.max(0, selCol - 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { selCol = Math.min(COLS - 1, selCol + 1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); drop(selCol); }
    else if (e.key >= '1' && e.key <= '5') { selCol = +e.key - 1; drop(selCol); }
  });

  reset();
  requestAnimationFrame(frame);
})();
