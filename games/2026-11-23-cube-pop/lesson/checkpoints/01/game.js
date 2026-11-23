(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), fillEl = $('risefill'), comboEl = $('combo'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), pushBtn = $('pushbtn');
  const COLS = 8, ROWS = 12;

  // ---------- state ----------
  let state = 'title';    // title | play | over

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

  // ---------- game logic ----------
  function start() {
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '同じ色をまとめて消そう';
  }

  // ---------- input ----------
  startBtn.addEventListener('click', start);

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
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
  }

  // ---------- loop ----------
  function frame() {
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
