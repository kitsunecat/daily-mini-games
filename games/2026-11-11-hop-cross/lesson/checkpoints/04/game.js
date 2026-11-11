(() => {
  'use strict';
  const COLS = 9;
  const HOP_T = 0.13;        // hop duration (s)

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

  // ---------- audio ----------
  let ac = null;
  function beep(freq, dur, type = 'square', vol = 0.06, slide = 0) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  // ---------- world ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  let rows, genRow, seg, player, camBottom, score, state;

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
    player = { x: 4.5, row: 1, fx: 4.5, fr: 1, hop: 0, face: 0 };
    camBottom = 0; score = 0;
    scoreEl.textContent = 0;
    ensureRows();
  }

  // ---------- input ----------
  function tryMove(dx, dr) {
    if (state !== 'play' || player.hop > 0) return;
    const tr = player.row + dr;
    const row = rows.get(tr);
    if (!row) return;
    let tx = player.x + dx;
    if (row.type !== 'river') tx = Math.floor(tx) + 0.5;
    if (tx < 0.3 || tx > COLS - 0.3) return;
    if (row.type === 'grass' && row.trees.has(Math.floor(tx))) { player.face = dx; return; }
    player.fx = player.x; player.fr = player.row;
    player.x = tx; player.row = tr; player.hop = HOP_T; player.face = dx;
    beep(520 + dr * 80, 0.06, 'square', 0.04, 200);
    if (tr - 1 > score) { score = tr - 1; scoreEl.textContent = score; }
  }

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (state !== 'play') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); start(); }
      return;
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') tryMove(0, 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') tryMove(0, -1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') tryMove(-1, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') tryMove(1, 0);
    else return;
    e.preventDefault();
  });
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', e => { if (e.target !== startBtn) { e.preventDefault(); start(); } });

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    beep(660, 0.08, 'triangle', 0.05, 300);
  }

  // ---------- update ----------
  function update(dt) {
    if (state !== 'play') return;

    if (player.hop > 0) player.hop = Math.max(0, player.hop - dt);

    // camera
    const target = player.row - 3;
    if (target > camBottom) camBottom += (target - camBottom) * Math.min(1, dt * 4);
    ensureRows();
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

  function drawPlayer() {
    let px = player.x, pr = player.row, lift = 0;
    if (player.hop > 0) {
      const t = 1 - player.hop / HOP_T;
      px = player.fx + (player.x - player.fx) * t;
      pr = player.fr + (player.row - player.fr) * t;
      lift = Math.sin(t * Math.PI) * CS * 0.35;
    }
    const cx = px * CS, cy = sy(pr) + CS * 0.55;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(cx, cy + CS * 0.28, CS * 0.3, CS * 0.1, 0, 0, 7); ctx.fill();
    ctx.translate(cx, cy - lift);
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.ellipse(0, 0, CS * 0.3, CS * 0.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath(); ctx.ellipse(-player.face * CS * 0.05, CS * 0.05, CS * 0.16, CS * 0.12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff6f3c';
    ctx.beginPath(); ctx.moveTo(-CS * 0.06, -CS * 0.28); ctx.lineTo(CS * 0.02, -CS * 0.42); ctx.lineTo(CS * 0.08, -CS * 0.27); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    const ex = player.face * CS * 0.06;
    ctx.beginPath(); ctx.arc(ex - CS * 0.1, -CS * 0.06, CS * 0.04, 0, 7); ctx.arc(ex + CS * 0.1, -CS * 0.06, CS * 0.04, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath(); ctx.moveTo(ex - CS * 0.06, CS * 0.0); ctx.lineTo(ex + CS * 0.06, CS * 0.0); ctx.lineTo(ex, CS * 0.08); ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!rows || !CS) return;
    ctx.clearRect(0, 0, W, H);
    const r0 = Math.floor(camBottom) - 1, r1 = Math.ceil(camBottom + viewRows) + 1;
    for (let r = r0; r <= r1; r++) { const row = rows.get(r); if (row) drawRow(r, row); }
    drawPlayer();
  }

  let last = 0;
  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  state = 'title';
  reset();
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(loop);
})();
