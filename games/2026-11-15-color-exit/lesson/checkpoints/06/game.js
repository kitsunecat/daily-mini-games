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
  const SHAPES = [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3], [2, 2]];

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

  let best = 0;

  let state = 'title'; // title | play | clear | over
  let level = 1, score = 0;
  let blocks = [], gates = [], stones = [], leaving = [], particles = [], floats = [];
  let combo = 0, lastExit = -10, now = 0;
  let drag = null;
  let cs = 40, border = 14, ox = 0, oy = 0, W = 0, H = 0, dpr = 1;

  // ---------- audio ----------
  let actx = null;
  function beep(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* no audio */ }
  }

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
  const rnd = (n) => Math.floor(Math.random() * n);
  function sideLen(side) { return side === 'L' || side === 'R' ? ROWS : COLS; }

  function buildOcc(except) {
    const occ = [];
    for (let y = 0; y < ROWS; y++) occ.push(new Array(COLS).fill(false));
    for (const s of stones) occ[s.y][s.x] = true;
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
  function canEscape(b, occ) {
    const seen = new Set(), q = [[b.x, b.y]];
    seen.add(b.x + ',' + b.y);
    while (q.length) {
      const [x, y] = q.shift();
      for (const s of ['L', 'R', 'T', 'B']) if (gateFor(b, x, y, s)) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (!seen.has(k) && fits(occ, nx, ny, b.w, b.h)) { seen.add(k); q.push([nx, ny]); }
      }
    }
    return false;
  }

  function generate() {
    gates = []; stones = []; blocks = []; leaving = [];
    const nColors = Math.min(2 + level, 5);
    const order = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, nColors);
    const sides = ['L', 'R', 'T', 'B'].sort(() => Math.random() - 0.5);
    order.forEach((color, i) => {
      for (let t = 0; t < 50; t++) {
        const side = t < 10 ? sides[i % 4] : sides[rnd(4)];
        const r = Math.random();
        const len = level <= 2 ? (r < 0.5 ? 2 : 3) : (r < 0.2 ? 1 : r < 0.75 ? 2 : 3);
        const start = rnd(sideLen(side) - len + 1);
        const clash = gates.some(g => g.side === side && start < g.start + g.len + 1 && g.start < start + len + 1);
        if (!clash) { gates.push({ side, start, len, color }); break; }
      }
    });
    const nStones = level >= 3 ? Math.min(Math.floor((level - 1) / 2), 5) : 0;
    for (let t = 0; t < 100 && stones.length < nStones; t++) {
      const x = rnd(COLS), y = rnd(ROWS);
      if (!stones.some(s => s.x === x && s.y === y)) stones.push({ x, y });
    }
    const target = Math.min(4 + level, 14);
    for (let t = 0; t < 1500 && blocks.length < target; t++) {
      const g = gates[rnd(gates.length)];
      const vertical = g.side === 'L' || g.side === 'R';
      const options = SHAPES.filter(([w, h]) => (vertical ? h : w) <= g.len);
      const [w, h] = options[rnd(options.length)];
      const b = { x: rnd(COLS - w + 1), y: rnd(ROWS - h + 1), w, h, color: g.color };
      const occ = buildOcc(null);
      if (!fits(occ, b.x, b.y, w, h)) continue;
      if (!canEscape(b, occ)) continue;
      // prefer blocks that are not trivially sitting in front of their gate (after the first few)
      if (blocks.length > 2 && ['L', 'R', 'T', 'B'].some(s => gateFor(b, b.x, b.y, s)) && Math.random() < 0.7) continue;
      b.dx = b.x; b.dy = b.y; b.pop = 0;
      blocks.push(b);
    }
    drag = null;
  }

  // ---------- game flow ----------
  function startGame() {
    level = 1; score = 0; combo = 0;
    particles = []; floats = [];
    overlay.classList.add('hidden');
    generate();
    state = 'play';
    updateHud();
    beep(520, 0.12, 'triangle'); setTimeout(() => beep(780, 0.15, 'triangle'), 90);
  }
  function updateHud() {
    $score.textContent = score; $best.textContent = best; $stageNo.textContent = level;
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
    if (now - lastExit < 3) combo++; else combo = 1;
    lastExit = now;
    const pts = 10 * level * Math.min(combo, 5) + (b.w * b.h - 1) * 5;
    score += pts;
    const c = COLORS[b.color];
    const cx = ox + (b.x + b.w / 2) * cs, cy = oy + (b.y + b.h / 2) * cs;
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 180;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp + dx * 120, vy: Math.sin(a) * sp + dy * 120, life: 0.6, max: 0.6, color: c.fill });
    }
    floats.push({ x: cx, y: cy, text: '+' + pts + (combo > 1 ? `  x${Math.min(combo, 5)}` : ''), life: 1 });
    g.flash = 0.4;
    beep(440 + Math.min(combo, 6) * 90, 0.16, 'triangle', 0.13, 1.5);
    if (drag && drag.b === b) drag = null;
    if (blocks.length === 0) { level++; generate(); }
    updateHud();
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
    b.pop = 1;
    beep(330, 0.05, 'square', 0.05);
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
    // stones
    for (const s of stones) {
      const x = ox + s.x * cs + cs * 0.06, y = oy + s.y * cs + cs * 0.06, w = cs * 0.88;
      ctx.fillStyle = '#5a6475'; rr(x, y + cs * 0.05, w, w, cs * 0.14); ctx.fill();
      ctx.fillStyle = '#7d889b'; rr(x, y, w, w - cs * 0.05, cs * 0.14); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + w * 0.3); ctx.lineTo(x + w * 0.7, y + w * 0.7);
      ctx.moveTo(x + w * 0.7, y + w * 0.3); ctx.lineTo(x + w * 0.3, y + w * 0.7); ctx.stroke();
    }
    // blocks
    for (const b of blocks) if (!drag || drag.b !== b) drawBlock(b, b.dx, b.dy, 1, false);
    if (drag) drawBlock(drag.b, drag.b.dx, drag.b.dy, 1, true);
    for (const l of leaving) {
      const d = l.t * 6;
      drawBlock(l.b, l.b.dx + l.dx * d, l.b.dy + l.dy * d, Math.max(0, 1 - l.t * 3), false);
    }
    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `bold ${f.big ? 18 : 16}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = '#ffe28a'; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
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
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    for (const f of floats) { f.y -= 30 * dt; f.life -= dt; }
    floats = floats.filter(f => f.life > 0);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  generate();
  updateHud();
  requestAnimationFrame(loop);
})();
