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
  let state = 'title';
  let view = { x: 0, y: 0, s: 1 };

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

  function start() {
    grid = new Uint8Array(W * H);
    // テスト用: 赤と青の砂のかたまりを置く（ステップ4で消す）
    for (let y = 40; y < 52; y++) for (let x = 4; x < 16; x++) grid[y * W + x] = 1 * 4 + Math.floor(Math.random() * 4);
    for (let y = 4; y < 14; y++) for (let x = 22; x < 34; x++) grid[y * W + x] = 3 * 4 + Math.floor(Math.random() * 4);
    state = 'play';
    overlay.classList.add('hidden');
  }

  // --- input ---
  startBtn.addEventListener('click', start);

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

  const SHADE = [1.0, 0.9, 0.8, 1.1];
  function render(time) {
    const d = img.data;
    for (let i = 0; i < W * H; i++) {
      const v = grid[i], o = i * 4;
      if (!v) {
        const y = (i / W) | 0;
        const base = y < SPAWN ? 44 : 58;
        d[o] = base; d[o + 1] = base - 10; d[o + 2] = base - 22; d[o + 3] = 255;
        continue;
      }
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

    // frame
    ctx.strokeStyle = '#6b5136';
    ctx.lineWidth = 2;
    ctx.strokeRect(view.x - 1, view.y - 1, W * s + 2, H * s + 2);
  }

  function loop(now) {
    if (state === 'play') {
      simStep();
      simStep();
    }
    render(now);
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
