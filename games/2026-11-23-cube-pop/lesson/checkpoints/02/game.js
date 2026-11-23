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
    for (let i = 0; i < START_ROWS; i++) { newPreview(); pushRow(); }
    newPreview();
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '同じ色をまとめて消そう';
  }

  function pushRow() {
    for (let c = 0; c < COLS; c++) {
      for (const cell of cols[c]) cell.vy += 1;
      cols[c].unshift({ k: preview[c], vy: 0, pop: 0 });
    }
    newPreview();
  }

  // ---------- input ----------
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
        drawCube(ox + c * S, rowBottomY(cell.vy) - S, cell.k, 1, 1);
      });
    }
    ctx.restore();
  }

  // ---------- loop ----------
  function frame() {
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  newPreview();
  cols = Array.from({ length: COLS }, () => []);
  for (let i = 0; i < START_ROWS; i++) { pushRow(); }
  requestAnimationFrame(frame);
})();
