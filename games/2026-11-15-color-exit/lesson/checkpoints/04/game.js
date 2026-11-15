(() => {
  'use strict';
  const COLS = 6, ROWS = 7;
  const COLORS = [
    { fill: '#ff5d6c', dark: '#b8303f', name: 'circle' },
    { fill: '#4da3ff', dark: '#2061b0', name: 'square' },
    { fill: '#ffd23f', dark: '#b98c00', name: 'triangle' },
    { fill: '#43d17a', dark: '#1d8a48', name: 'diamond' },
    { fill: '#b07cff', dark: '#6d3fc0', name: 'star' },
  ];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const $score = document.getElementById('score');
  const $best = document.getElementById('best');
  const $stageNo = document.getElementById('stage-no');
  const $fill = document.getElementById('timefill');
  const $ttext = document.getElementById('timetext');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let state = 'title'; // title | play | clear | over
  let blocks = [], gates = [], leaving = [];
  let now = 0;
  let drag = null;
  let cs = 40, border = 14, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;

  // ---------- layout ----------
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 8;
    cs = Math.floor(Math.min(aw / (COLS + 0.8), ah / (ROWS + 0.8)));
    border = Math.max(10, Math.round(cs * 0.36));
    W = cs * COLS + border * 2; H = cs * ROWS + border * 2;
    dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ox = border; oy = border;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---------- level generation ----------
  function buildOcc(except) {
    const occ = [];
    for (let y = 0; y < ROWS; y++) occ.push(new Array(COLS).fill(false));
    for (const b of blocks) {
      if (b === except) continue;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) occ[b.y + y][b.x + x] = true;
    }
    return occ;
  }
  function fits(occ, x, y, w, h) {
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return false;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (occ[y + j][x + i]) return false;
    return true;
  }
  // gate on the given side that matches the block's color and lines up with it
  function gateFor(b, x, y, side) {
    for (const g of gates) {
      if (g.color !== b.color || g.side !== side) continue;
      if (side === 'L' && x === 0 && y >= g.start && y + b.h <= g.start + g.len) return g;
      if (side === 'R' && x + b.w === COLS && y >= g.start && y + b.h <= g.start + g.len) return g;
      if (side === 'T' && y === 0 && x >= g.start && x + b.w <= g.start + g.len) return g;
      if (side === 'B' && y + b.h === ROWS && x >= g.start && x + b.w <= g.start + g.len) return g;
    }
    return null;
  }

  function generate() {
    gates = [
      { side: 'L', start: 1, len: 2, color: 0 },
      { side: 'R', start: 4, len: 3, color: 1 },
      { side: 'T', start: 2, len: 2, color: 2 },
      { side: 'B', start: 0, len: 3, color: 3 },
    ];
    blocks = [
      { x: 1, y: 1, w: 1, h: 2, color: 0 },
      { x: 4, y: 2, w: 1, h: 3, color: 1 },
      { x: 0, y: 3, w: 2, h: 1, color: 2 },
      { x: 2, y: 0, w: 3, h: 1, color: 3 },
      { x: 5, y: 0, w: 1, h: 1, color: 3 },
    ];
    for (const b of blocks) { b.dx = b.x; b.dy = b.y; }
    drag = null;
  }

  // ---------- game flow ----------
  function startGame() {
    overlay.classList.add('hidden');
    state = 'play';
  }

  // ---------- moving ----------
  function tryMove(b, dx, dy) {
    const nx = b.x + dx, ny = b.y + dy;
    if (nx < 0 || ny < 0 || nx + b.w > COLS || ny + b.h > ROWS) {
      const side = nx < 0 ? 'L' : nx + b.w > COLS ? 'R' : ny < 0 ? 'T' : 'B';
      const g = gateFor(b, b.x, b.y, side);
      if (g) { exitBlock(b, dx, dy, g); return 'exit'; }
      return false;
    }
    if (!fits(buildOcc(b), nx, ny, b.w, b.h)) return false;
    b.x = nx; b.y = ny;
    return true;
  }

  function exitBlock(b, dx, dy, g) {
    const i = blocks.indexOf(b);
    if (i < 0) return;
    blocks.splice(i, 1);
    leaving.push({ b, dx, dy, t: 0 });
    g.flash = 0.4;
    if (drag && drag.b === b) drag = null;
    if (blocks.length === 0) generate();
  }

  function stepToward(b, tx, ty) {
    for (let n = 0; n < 24; n++) {
      if (!blocks.includes(b)) return;
      const ddx = tx - b.x, ddy = ty - b.y;
      if (ddx === 0 && ddy === 0) return;
      const ax = [Math.sign(ddx), 0], ay = [0, Math.sign(ddy)];
      const first = Math.abs(ddx) >= Math.abs(ddy) ? ax : ay;
      const second = first === ax ? ay : ax;
      let r = false;
      if (first[0] || first[1]) r = tryMove(b, first[0], first[1]);
      if (r === 'exit') return;
      if (!r && (second[0] || second[1])) r = tryMove(b, second[0], second[1]);
      if (r === 'exit' || !r) return;
    }
  }

  // ---------- input ----------
  function toCell(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left - ox) / cs, y: (e.clientY - r.top - oy) / cs };
  }
  function blockAt(px, py) {
    const cx = Math.floor(px), cy = Math.floor(py);
    return blocks.find(b => cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h);
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    const p = toCell(e);
    const b = blockAt(p.x, p.y);
    if (!b) return;
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    drag = { b, offX: p.x - b.x, offY: p.y - b.y, id: e.pointerId };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || state !== 'play' || e.pointerId !== drag.id) return;
    const p = toCell(e);
    stepToward(drag.b, Math.round(p.x - drag.offX), Math.round(p.y - drag.offY));
  });
  const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  startBtn.addEventListener('click', startGame);

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function symbol(name, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (name === 'circle') ctx.arc(x, y, s, 0, Math.PI * 2);
    else if (name === 'square') ctx.rect(x - s * 0.85, y - s * 0.85, s * 1.7, s * 1.7);
    else if (name === 'triangle') { ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); }
    else if (name === 'diamond') { ctx.moveTo(x, y - s * 1.1); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.1); ctx.lineTo(x - s, y); }
    else {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.45 : s * 1.1;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
    }
    ctx.closePath(); ctx.fill();
  }
  function drawBlock(b, px, py, alpha, lifted) {
    const c = COLORS[b.color];
    const pad = cs * 0.06, x = ox + px * cs + pad, y = oy + py * cs + pad;
    const w = b.w * cs - pad * 2, h = b.h * cs - pad * 2, r = cs * 0.18;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (lifted) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; }
    ctx.fillStyle = c.dark; rr(x, y + cs * 0.06, w, h, r); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = c.fill; rr(x, y, w, h - cs * 0.04, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(x + cs * 0.1, y + cs * 0.07, w - cs * 0.2, cs * 0.16, cs * 0.08); ctx.fill();
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
      symbol(c.name, ox + (px + i + 0.5) * cs, oy + (py + j + 0.52) * cs, cs * 0.16, 'rgba(255,255,255,.75)');
    }
    ctx.restore();
  }
  function gateRect(g) {
    const t = border, p = 3;
    if (g.side === 'L') return [0, oy + g.start * cs + p, t, g.len * cs - p * 2];
    if (g.side === 'R') return [ox + COLS * cs, oy + g.start * cs + p, t, g.len * cs - p * 2];
    if (g.side === 'T') return [ox + g.start * cs + p, 0, g.len * cs - p * 2, t];
    return [ox + g.start * cs + p, oy + ROWS * cs, g.len * cs - p * 2, t];
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // frame
    ctx.fillStyle = '#3c4f6b'; rr(0, 0, W, H, border); ctx.fill();
    ctx.fillStyle = '#16263d'; ctx.fillRect(ox, oy, COLS * cs, ROWS * cs);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#1c2f4a' : '#1a2b44';
      ctx.fillRect(ox + x * cs + 1, oy + y * cs + 1, cs - 2, cs - 2);
    }
    // gates
    for (const g of gates) {
      const c = COLORS[g.color];
      const [x, y, w, h] = gateRect(g);
      ctx.fillStyle = c.dark; rr(x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = g.flash > 0 ? '#ffffff' : c.fill; rr(x + 2, y + 2, w - 4, h - 4, 3); ctx.fill();
      const vertical = g.side === 'L' || g.side === 'R';
      for (let i = 0; i < g.len; i++) {
        const sx = vertical ? x + w / 2 : ox + (g.start + i + 0.5) * cs;
        const sy = vertical ? oy + (g.start + i + 0.5) * cs : y + h / 2;
        symbol(c.name, sx, sy, border * 0.26, 'rgba(0,0,0,.35)');
      }
    }
    // blocks
    for (const b of blocks) if (!drag || drag.b !== b) drawBlock(b, b.dx, b.dy, 1, false);
    if (drag) drawBlock(drag.b, drag.b.dx, drag.b.dy, 1, true);
    for (const l of leaving) {
      const d = l.t * 6;
      drawBlock(l.b, l.b.dx + l.dx * d, l.b.dy + l.dy * d, Math.max(0, 1 - l.t * 3), false);
    }
  }

  // ---------- loop ----------
  let last = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; now += dt;
    const k = 1 - Math.pow(0.0005, dt);
    for (const b of blocks) { b.dx += (b.x - b.dx) * k; b.dy += (b.y - b.dy) * k; }
    for (const l of leaving) l.t += dt;
    leaving = leaving.filter(l => l.t < 0.4);
    for (const g of gates) if (g.flash > 0) g.flash -= dt;
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  generate();
  requestAnimationFrame(loop);
})();
