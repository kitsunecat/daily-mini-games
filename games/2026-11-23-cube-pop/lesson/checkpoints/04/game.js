(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), fillEl = $('risefill'), comboEl = $('combo'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), pushBtn = $('pushbtn');
  const COLS = 8, ROWS = 12, START_ROWS = 5;
  const PALETTE = [
    ['#ff6b7a', '#c93c4f'], ['#ffc94d', '#c8901a'], ['#5fd68a', '#2e9a58'],
    ['#55b6ff', '#2b74c2'], ['#b78cff', '#7a52c9'], ['#ff9ad5', '#c75a9c'],
  ];

  // ---------- state ----------
  let cols = [];          // cols[c] = array of cells from bottom; cell = { k: colorIndex, vy, pop }
  let preview = [];       // next row colors
  let state = 'title';    // title | play | over
  let score = 0, level = 1, rise = 0, popped = 0;
  let combo = 0, comboTimer = 0;
  let particles = [], floats = [];
  let lastT = 0;

  const numColors = () => 4;
  const randColor = () => Math.random() * numColors() | 0;
  const newPreview = () => { preview = Array.from({ length: COLS }, randColor); };

  // ---------- layout ----------
  let W = 0, H = 0, S = 0, ox = 0, oy = 0, dpr = 1;
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.floor(Math.min((W - 16) / COLS, (H - 20) / (ROWS + 0.6)));
    ox = Math.round((W - S * COLS) / 2);
    oy = Math.round((H - S * ROWS) / 2) - Math.round(S * 0.2);
  }
  window.addEventListener('resize', resize);

  const rowBottomY = (vy) => oy + (ROWS - vy) * S;

  // ---------- game logic ----------
  function start() {
    cols = Array.from({ length: COLS }, () => []);
    score = 0; level = 1; rise = 0; popped = 0; combo = 0; comboTimer = 0;
    particles = []; floats = [];
    for (let i = 0; i < START_ROWS; i++) { newPreview(); pushRow(); }
    newPreview();
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '同じ色をまとめて消そう';
    updateHud();
  }

  function pushRow() {
    for (let c = 0; c < COLS; c++) {
      for (const cell of cols[c]) cell.vy += 1;
      cols[c].unshift({ k: preview[c], vy: 0, pop: 0 });
    }
    newPreview();
  }

  function group(c, r) {
    const k = cols[c][r].k, seen = new Set([c * 100 + r]), out = [[c, r]];
    for (let i = 0; i < out.length; i++) {
      const [cc, rr] = out[i];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cc + dc, nr = rr + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= cols[nc].length) continue;
        if (cols[nc][nr].k !== k || seen.has(nc * 100 + nr)) continue;
        seen.add(nc * 100 + nr); out.push([nc, nr]);
      }
    }
    return out;
  }

  function tap(c, r) {
    if (state !== 'play') return;
    if (c < 0 || c >= COLS || r < 0 || r >= cols[c].length) return;
    const cell = cols[c][r];
    const targets = group(c, r);
    if (targets.length < 2) {
      cell.pop = 1; // wiggle
      msgEl.textContent = '1個だけでは消せないよ';
      return;
    }
    const n = targets.length;
    combo = comboTimer > 0 ? combo + 1 : 1;
    comboTimer = 1.6;
    const mult = 1 + (combo - 1) * 0.5;
    const pts = Math.round(n * n * 10 * mult);
    // particles
    for (const [cc, rr] of targets) {
      const t = cols[cc][rr];
      const x = ox + cc * S + S / 2, y = rowBottomY(t.vy) - S / 2;
      const col = PALETTE[t.k][0];
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.6 + Math.random() * 0.3, col, s: S * 0.18 });
      }
    }
    const fx = ox + c * S + S / 2, fy = rowBottomY(cell.vy) - S / 2;
    addFloat(fx, fy, '+' + pts, '#fff');
    // remove (mark then filter)
    const kill = new Set(targets.map(([cc, rr]) => cc * 100 + rr));
    for (let cc = 0; cc < COLS; cc++) cols[cc] = cols[cc].filter((_, rr) => !kill.has(cc * 100 + rr));
    popped += n;
    addScore(pts);
    msgEl.textContent = combo > 1 ? `${combo} コンボ！` : `${n}個 消した！`;
  }

  function addScore(p) {
    score += p;
    updateHud();
  }
  const addFloat = (x, y, text, col) => floats.push({ x, y, text, col, life: 1 });

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = 'Lv ' + level;
  }

  // ---------- input ----------
  function cellAt(x, y) {
    const c = Math.floor((x - ox) / S);
    const r = Math.floor((oy + ROWS * S - y) / S);
    return { c, r };
  }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'play') return;
    const rect = cv.getBoundingClientRect();
    const { c, r } = cellAt(e.clientX - rect.left, e.clientY - rect.top);
    tap(c, r);
  });
  startBtn.addEventListener('click', start);

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawCube(x, y, k, scale, alpha) {
    const pad = S * 0.06, s = (S - pad * 2) * scale, cx = x + S / 2, cy = y + S / 2;
    const x0 = cx - s / 2, y0 = cy - s / 2;
    ctx.globalAlpha = alpha;
    const [base, dark] = PALETTE[k];
    ctx.fillStyle = dark; rr(x0, y0, s, s, s * 0.2); ctx.fill();
    ctx.fillStyle = base; rr(x0, y0, s, s * 0.88, s * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(x0 + s * 0.14, y0 + s * 0.1, s * 0.42, s * 0.16, s * 0.08); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // board bg
    ctx.fillStyle = '#1d2e4d'; rr(ox - 6, oy - 6, S * COLS + 12, S * ROWS + 12, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(ox + c * S, oy); ctx.lineTo(ox + c * S, oy + ROWS * S); ctx.stroke(); }
    // ceiling line
    ctx.strokeStyle = 'rgba(255,107,122,.55)';
    ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(ox - 6, oy); ctx.lineTo(ox + COLS * S + 6, oy); ctx.stroke(); ctx.setLineDash([]);

    ctx.save();
    ctx.beginPath(); ctx.rect(ox - 6, 0, S * COLS + 12, oy + ROWS * S + 6); ctx.clip();
    // preview row (dim, rising from bottom)
    for (let c = 0; c < COLS; c++) drawCube(ox + c * S, rowBottomY(-1) - S, preview[c], 1, 0.35);
    for (let c = 0; c < COLS; c++) {
      cols[c].forEach((cell) => {
        let sc = 1;
        if (cell.pop > 0) sc = 1 + Math.sin(cell.pop * Math.PI) * 0.15;
        drawCube(ox + c * S, rowBottomY(cell.vy) - S, cell.k, sc, 1);
      });
    }
    ctx.restore();
    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.fillStyle = p.col; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = `bold ${Math.round(S * 0.5)}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- loop ----------
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (state === 'play') {
      if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
    }
    for (const col of cols) col.forEach((cell, r) => {
      if (cell.vy > r) cell.vy = Math.max(r, cell.vy - dt * 14 * Math.max(1, cell.vy - r));
      if (cell.pop > 0) cell.pop = Math.max(0, cell.pop - dt * 4);
    });
    particles = particles.filter((p) => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; return p.life > 0; });
    floats = floats.filter((f) => { f.life -= dt; f.y -= 40 * dt; return f.life > 0; });
    comboEl.textContent = combo > 1 ? `${combo} COMBO` : '';
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  newPreview();
  cols = Array.from({ length: COLS }, () => []);
  for (let i = 0; i < START_ROWS; i++) { pushRow(); }
  requestAnimationFrame(frame);
})();
