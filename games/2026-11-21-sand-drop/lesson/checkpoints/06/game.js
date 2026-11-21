(() => {
  'use strict';
  const W = 40, H = 76, B = 4;          // grid size in grains, block = 4x4 grains
  const SPAWN = 16;                       // rows above the red line
  const COLORS = [
    null,
    [232, 76, 61],   // red
    [246, 196, 52],  // yellow
    [64, 140, 230],  // blue
    [76, 190, 110],  // green
    [170, 100, 220], // purple
  ];
  const SHAPES = [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [0, 1]],
  ];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const nextCv = document.getElementById('nextcv');
  const nctx = nextCv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const rotBtn = document.getElementById('rot');

  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  const img = octx.createImageData(W, H);

  // grid value: 0 empty, otherwise color*4 + shade (shade 0..3)
  let grid = new Uint8Array(W * H);
  let flashMask = null, flashT = 0;
  let state = 'title';
  let score = 0;
  let piece = null, nextPiece = null, px = 0;
  let cooldown = 0, numColors = 3;
  let view = { x: 0, y: 0, s: 1 };

  function randPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = 1 + Math.floor(Math.random() * numColors);
    return { cells: shape.map(c => c.slice()), color };
  }
  function pieceSize(p) {
    let w = 0, h = 0;
    for (const [x, y] of p.cells) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); }
    return { w: w * B, h: h * B };
  }
  function rotate() {
    if (state !== 'play' || !piece) return;
    const cx = px + pieceSize(piece).w / 2;
    let cells = piece.cells.map(([x, y]) => [-y, x]);
    const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
    piece.cells = cells.map(([x, y]) => [x - mx, y - my]);
    px = Math.round(cx - pieceSize(piece).w / 2);
    clampPx();
  }
  function clampPx() {
    if (!piece) return;
    px = Math.max(0, Math.min(W - pieceSize(piece).w, px));
  }

  function dropPiece() {
    if (state !== 'play' || !piece || cooldown > 0) return;
    const sz = pieceSize(piece);
    const top = SPAWN - sz.h;
    for (const [bx, by] of piece.cells) {
      for (let dy = 0; dy < B; dy++) for (let dx = 0; dx < B; dx++) {
        const x = px + bx * B + dx, y = top + by * B + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (!grid[y * W + x]) grid[y * W + x] = piece.color * 4 + Math.floor(Math.random() * 4);
      }
    }
    piece = nextPiece;
    nextPiece = randPiece();
    clampPx();
    cooldown = 0.3;
    drawNext();
  }

  let flip = false;
  function simStep() {
    let moved = false;
    flip = !flip;
    for (let y = H - 2; y >= 0; y--) {
      const row = y * W, below = row + W;
      for (let i = 0; i < W; i++) {
        const x = flip ? i : W - 1 - i;
        const v = grid[row + x];
        if (!v) continue;
        if (!grid[below + x]) { grid[below + x] = v; grid[row + x] = 0; moved = true; continue; }
        const d = Math.random() < 0.5 ? -1 : 1;
        const x1 = x + d, x2 = x - d;
        if (x1 >= 0 && x1 < W && !grid[below + x1] && !grid[row + x1]) {
          grid[below + x1] = v; grid[row + x] = 0; moved = true;
        } else if (x2 >= 0 && x2 < W && !grid[below + x2] && !grid[row + x2]) {
          grid[below + x2] = v; grid[row + x] = 0; moved = true;
        }
      }
    }
    return moved;
  }

  // Find colors connected from left wall to right wall.
  function findClear() {
    const seen = new Uint8Array(W * H);
    const stack = [];
    for (let y0 = SPAWN; y0 < H; y0++) {
      const start = y0 * W;
      const v0 = grid[start];
      if (!v0 || seen[start]) continue;
      const c = v0 >> 2;
      const comp = [];
      let reachRight = false;
      stack.push(start); seen[start] = 1;
      while (stack.length) {
        const i = stack.pop();
        comp.push(i);
        const x = i % W, y = (i / W) | 0;
        if (x === W - 1) reachRight = true;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const n of nb) {
          if (n < 0 || seen[n]) continue;
          const v = grid[n];
          if (v && (v >> 2) === c) { seen[n] = 1; stack.push(n); }
        }
      }
      if (reachRight) return comp;
    }
    return null;
  }

  function startFlash(comp) {
    flashMask = comp;
    flashT = 0.4;
    const gained = Math.round(comp.length / 4) * 10;
    score += gained;
    scoreEl.textContent = score;
  }

  function start() {
    grid = new Uint8Array(W * H);
    score = 0;
    flashMask = null; flashT = 0; cooldown = 0.2;
    scoreEl.textContent = '0';
    piece = randPiece(); nextPiece = randPiece();
    px = Math.round((W - pieceSize(piece).w) / 2 / B) * B;
    drawNext();
    state = 'play';
    overlay.classList.add('hidden');
  }

  // --- input ---
  let dragging = false;
  function pointerToPx(clientX) {
    const r = cv.getBoundingClientRect();
    const gx = (clientX - r.left - view.x) / view.s;
    if (!piece) return;
    px = Math.round(gx - pieceSize(piece).w / 2);
    clampPx();
  }
  cv.addEventListener('pointerdown', e => {
    if (state !== 'play') return;
    e.preventDefault();
    dragging = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pointerToPx(e.clientX);
  });
  cv.addEventListener('pointermove', e => {
    if (state !== 'play') return;
    if (dragging || e.pointerType === 'mouse') pointerToPx(e.clientX);
  });
  cv.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    pointerToPx(e.clientX);
    dropPiece();
  });
  cv.addEventListener('pointercancel', () => { dragging = false; });
  rotBtn.addEventListener('click', e => { e.preventDefault(); rotate(); });
  startBtn.addEventListener('click', start);
  document.addEventListener('keydown', e => {
    if (state !== 'play') return;
    if (e.key === 'ArrowLeft') { px -= 2; clampPx(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { px += 2; clampPx(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') { rotate(); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowDown') { dropPiece(); e.preventDefault(); }
  });

  // --- render ---
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const s = Math.min(cv.width / W, cv.height / H);
    view = { s: s / dpr, x: (r.width - W * s / dpr) / 2, y: (r.height - H * s / dpr) / 2, dpr };
  }
  window.addEventListener('resize', resize);

  function drawNext() {
    nctx.clearRect(0, 0, 64, 64);
    if (!nextPiece) return;
    const sz = pieceSize(nextPiece);
    const u = 56 / Math.max(sz.w, sz.h, 12) * B;
    const ox = (64 - sz.w / B * u) / 2, oy = (64 - sz.h / B * u) / 2;
    const [r, g, b] = COLORS[nextPiece.color];
    nctx.fillStyle = `rgb(${r},${g},${b})`;
    for (const [x, y] of nextPiece.cells) nctx.fillRect(ox + x * u + 1, oy + y * u + 1, u - 2, u - 2);
  }

  const SHADE = [1.0, 0.9, 0.8, 1.1];
  function render(time) {
    const d = img.data;
    const flashOn = flashMask && Math.floor(time / 70) % 2 === 0;
    let fm = null;
    if (flashOn) { fm = new Uint8Array(W * H); for (const i of flashMask) fm[i] = 1; }
    for (let i = 0; i < W * H; i++) {
      const v = grid[i], o = i * 4;
      if (!v) {
        const y = (i / W) | 0;
        const base = y < SPAWN ? 44 : 58;
        d[o] = base; d[o + 1] = base - 10; d[o + 2] = base - 22; d[o + 3] = 255;
        continue;
      }
      if (fm && fm[i]) { d[o] = 255; d[o + 1] = 255; d[o + 2] = 240; d[o + 3] = 255; continue; }
      const c = COLORS[v >> 2], k = SHADE[v & 3];
      d[o] = Math.min(255, c[0] * k); d[o + 1] = Math.min(255, c[1] * k); d[o + 2] = Math.min(255, c[2] * k); d[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);

    const dpr = view.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, view.x, view.y, W * view.s, H * view.s);

    const s = view.s;
    // red danger line
    ctx.strokeStyle = 'rgba(255,80,80,.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(view.x, view.y + SPAWN * s);
    ctx.lineTo(view.x + W * s, view.y + SPAWN * s);
    ctx.stroke();
    ctx.setLineDash([]);

    // hovering piece + guide
    if (state === 'play' && piece) {
      const sz = pieceSize(piece);
      const top = SPAWN - sz.h;
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(view.x + px * s, view.y + SPAWN * s, sz.w * s, (H - SPAWN) * s);
      const [r, g, b] = COLORS[piece.color];
      ctx.globalAlpha = cooldown > 0 ? 0.45 : 1;
      for (const [bx, by] of piece.cells) {
        const x = view.x + (px + bx * B) * s, y = view.y + (top + by * B) * s;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 1, y + 1, B * s - 2, B * s - 2);
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fillRect(x + 1, y + 1, B * s - 2, s);
      }
      ctx.globalAlpha = 1;
    }

    // frame
    ctx.strokeStyle = '#6b5136';
    ctx.lineWidth = 2;
    ctx.strokeRect(view.x - 1, view.y - 1, W * s + 2, H * s + 2);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') {
      if (cooldown > 0) cooldown -= dt;
      if (flashMask) {
        flashT -= dt;
        if (flashT <= 0) {
          for (const i of flashMask) grid[i] = 0;
          flashMask = null;
        }
      } else {
        simStep();
        simStep();
        const comp = findClear();
        if (comp) startFlash(comp);
      }
    }
    render(now);
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
