(() => {
  'use strict';
  const COLS = 9;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  let W = 0, H = 0, CS = 0, DPR = 1, viewRows = 14;
  function resize() {
    const r = stage.getBoundingClientRect();
    const availW = Math.max(200, r.width - 16), availH = Math.max(260, r.height - 8);
    W = Math.floor(Math.min(availW, availH * 0.62));
    H = Math.floor(Math.min(availH, W * 1.9));
    CS = W / COLS;
    viewRows = H / CS;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    draw();
  }

  // ---------- world ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  let rows, genRow, seg, camBottom;

  function makeRow(r) {
    if (r < 5) return { type: 'grass', trees: r === 0 ? new Set([0, 8]) : new Set() };
    if (seg.left <= 0) {
      const opts = seg.type === 'grass' ? ['road', 'river', 'road'] : ['grass'];
      seg.type = opts[Math.floor(Math.random() * opts.length)];
      const diff = Math.min(1, r / 160);
      seg.left = seg.type === 'grass' ? 1 + Math.floor(Math.random() * 2)
        : seg.type === 'road' ? 1 + Math.floor(Math.random() * (2 + diff * 3))
          : 1 + Math.floor(Math.random() * (2 + diff * 2));
    }
    seg.left--;
    const diff = Math.min(1, r / 160);
    if (seg.type === 'grass') {
      const trees = new Set();
      const n = Math.floor(rand(0, 3 + diff * 2));
      for (let i = 0; i < n; i++) trees.add(Math.floor(Math.random() * COLS));
      return { type: 'grass', trees };
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const items = [];
    if (seg.type === 'road') return { type: 'road', dir, items };
    return { type: 'river', dir, items };
  }

  function ensureRows() {
    while (genRow < camBottom + viewRows + 3) { rows.set(genRow, makeRow(genRow)); genRow++; }
    for (const k of rows.keys()) if (k < camBottom - 3) rows.delete(k);
  }

  function reset() {
    rows = new Map(); genRow = 0; seg = { type: 'grass', left: 0 };
    camBottom = 0;
    ensureRows();
  }

  // ---------- input ----------
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', e => { if (e.target !== startBtn) { e.preventDefault(); start(); } });

  function start() {
    reset();
    overlay.classList.add('hidden');
    draw();
  }

  // ---------- draw ----------
  const sy = r => H - (r - camBottom + 1) * CS; // top y of row r

  function drawRow(r, row) {
    const y = sy(r);
    if (row.type === 'grass') {
      ctx.fillStyle = r % 2 ? '#86d073' : '#7cc86a'; ctx.fillRect(0, y, W, CS + 1);
      for (const c of row.trees) {
        const x = c * CS;
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(x + CS * 0.55, y + CS * 0.8, CS * 0.36, CS * 0.14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + CS * 0.43, y + CS * 0.5, CS * 0.14, CS * 0.32);
        ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.arc(x + CS / 2, y + CS * 0.42, CS * 0.34, 0, 7); ctx.fill();
        ctx.fillStyle = '#45ad4e'; ctx.beginPath(); ctx.arc(x + CS * 0.42, y + CS * 0.34, CS * 0.18, 0, 7); ctx.fill();
      }
    } else if (row.type === 'road') {
      ctx.fillStyle = '#4b5060'; ctx.fillRect(0, y, W, CS + 1);
      const below = rows.get(r - 1);
      if (below && below.type === 'road') {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let x = CS * 0.2; x < W; x += CS * 1.2) ctx.fillRect(x, y + CS - 1.5, CS * 0.6, 3);
      }
    } else {
      ctx.fillStyle = '#3d9be0'; ctx.fillRect(0, y, W, CS + 1);
    }
  }

  function draw() {
    if (!rows || !CS) return;
    ctx.clearRect(0, 0, W, H);
    const r0 = Math.floor(camBottom) - 1, r1 = Math.ceil(camBottom + viewRows) + 1;
    for (let r = r0; r <= r1; r++) { const row = rows.get(r); if (row) drawRow(r, row); }
  }

  reset();
  window.addEventListener('resize', resize);
  resize();
})();
