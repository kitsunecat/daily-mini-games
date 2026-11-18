(() => {
  'use strict';

  const COLORS = ['#ff5d73', '#ffd166', '#4cd18a', '#4aa8ff', '#b07cff', '#ff9a3c', '#3fe0d0'];
  const CLEAR_N = 10;
  const RADIUS = 2;
  const SQ3 = Math.sqrt(3);

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elLevel = $('level'), elScore = $('score'), elBest = $('best'), elGoal = $('goal'), elFree = $('free');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let W = 0, H = 0, S = 30, DPR = 1, boardCX = 0, boardCY = 0, trayY = 0;
  let cells = [];
  let playing = false;
  let score = 0, level = 1, cleared = 0, goal = 30;

  // ---------- board ----------
  function buildBoard() {
    cells = [];
    for (let q = -RADIUS; q <= RADIUS; q++) {
      for (let r = -RADIUS; r <= RADIUS; r++) {
        if (Math.abs(q + r) > RADIUS) continue;
        cells.push({ q, r, x: 0, y: 0, stack: [], pending: 0 });
      }
    }
    layout();
  }
  function cellAt(q, r) { return cells.find(c => c.q === q && c.r === r); }
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  function neighbors(c) {
    const out = [];
    for (const [dq, dr] of DIRS) { const n = cellAt(c.q + dq, c.r + dr); if (n) out.push(n); }
    return out;
  }
  const top = (st) => st[st.length - 1];
  function topRun(st) {
    if (!st.length) return 0;
    const t = top(st); let n = 0;
    for (let i = st.length - 1; i >= 0 && st[i] === t; i--) n++;
    return n;
  }

  function numColors() { return Math.min(3 + level, COLORS.length); }
  function randStack() {
    const nc = numColors();
    const size = 2 + Math.floor(Math.random() * (level < 3 ? 4 : 5)); // 2..5 (later 2..6)
    const runs = Math.random() < 0.35 ? 1 : (Math.random() < 0.75 ? 2 : 3);
    const st = [];
    let prev = -1;
    let remain = size;
    for (let k = 0; k < runs && remain > 0; k++) {
      let col;
      do { col = Math.floor(Math.random() * nc); } while (col === prev);
      prev = col;
      const len = k === runs - 1 ? remain : Math.max(1, Math.floor(Math.random() * (remain - (runs - 1 - k))) + 1);
      for (let i = 0; i < len; i++) st.push(col);
      remain -= len;
    }
    return st;
  }

  // ---------- layout ----------
  function layout() {
    const r = stage.getBoundingClientRect();
    W = Math.max(200, Math.floor(r.width));
    H = Math.max(260, Math.floor(r.height));
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = Math.min(W / 8.4, H / 13.6, 46);
    boardCX = W / 2;
    const boardH = 5 * SQ3 * S;
    const trayH = 3.4 * S;
    const total = boardH + 1.6 * S + trayH;
    const top0 = (H - total) / 2 + 1.6 * S;
    boardCY = top0 + boardH / 2;
    trayY = top0 + boardH + trayH * 0.62;
    for (const c of cells) {
      c.x = boardCX + S * 1.5 * c.q;
      c.y = boardCY + S * SQ3 * (c.r + c.q / 2);
    }
  }
  function thick(s) { return s * 0.14; }

  // ---------- drawing ----------
  function hexPath(x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i;
      const px = x + s * Math.cos(a), py = y + s * Math.sin(a) * 0.92;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
    return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
  }
  function drawTile(x, y, s, col, alpha) {
    const th = thick(s);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    hexPath(x, y + th, s * 0.9);
    ctx.fillStyle = shade(COLORS[col], 0.6); ctx.fill();
    hexPath(x, y, s * 0.9);
    ctx.fillStyle = COLORS[col]; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawStack(st, x, y, s, label) {
    const th = thick(s);
    for (let i = 0; i < st.length; i++) drawTile(x, y - i * th, s, st[i]);
    if (label && st.length) {
      const ty = y - (st.length - 1) * th;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.font = `700 ${Math.round(s * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(topRun(st)), x, ty + 1);
    }
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    // board base
    for (const c of cells) {
      hexPath(c.x, c.y + 4, S * 0.97);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
      hexPath(c.x, c.y, S * 0.97);
      let fill = 'rgba(255,255,255,.08)';
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // stacks, back-to-front
    const order = cells.slice().sort((a, b) => a.y - b.y);
    for (const c of order) if (c.stack.length) drawStack(c.stack, c.x, c.y, S, true);

    // tray
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    const tw = Math.min(W - 16, S * 10);
    roundRect(W / 2 - tw / 2, trayY - S * 2.3, tw, S * 3.3, 16); ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop(now) { draw(now); requestAnimationFrame(loop); }

  // ---------- logic ----------
  function newGame() {
    score = 0; level = 1; cleared = 0; goal = 30;
    for (const c of cells) { c.stack = []; c.pending = 0; }
    // a few starter stacks
    const empty = cells.slice().sort(() => Math.random() - .5);
    for (let k = 0; k < 3; k++) {
      const st = randStack();
      empty[k].stack = st.slice(0, Math.max(1, st.length - 1));
    }
    playing = true;
    overlay.classList.add('hidden');
  }

  // ---------- input ----------
  startBtn.addEventListener('click', newGame);
  window.addEventListener('resize', layout);

  buildBoard();
  requestAnimationFrame(loop);
})();
