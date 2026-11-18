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
    playing = true;
    overlay.classList.add('hidden');
  }

  // ---------- input ----------
  startBtn.addEventListener('click', newGame);
  window.addEventListener('resize', layout);

  buildBoard();
  requestAnimationFrame(loop);
})();
