(() => {
  'use strict';
  const W = 360, H = 560;
  const CW = 32, CH = 46, STEP = 34, ROWY = 28, OX = (W - (STEP * 9 + CW)) / 2, OY = 56;
  const HW = 58, HH = 82, HAND_Y = 372;
  const STOCK_X = 54, WASTE_X = W - 54 - HW;
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED = [false, true, true, false];

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const stageEl = document.getElementById('stage-no');
  const overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text'), startBtn = document.getElementById('start');
  const stage = document.getElementById('stage');

  let state = 'title', board = [], stock = [], waste = [];
  let time = 0;
  let scale = 1;

  function resize() {
    const sw = stage.clientWidth - 16, sh = stage.clientHeight - 8;
    scale = Math.max(0.3, Math.min(sw / W, sh / H));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // --- deal ---
  function shuffled() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ rank: r, suit: s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  function layout() {
    // rows: 0 = peak tops (3), 1 = (6), 2 = (9), 3 = bottom (10)
    const slots = [];
    for (let p = 0; p < 3; p++) slots.push({ row: 0, x: 1.5 + 3 * p, cov: [3 + 2 * p, 4 + 2 * p] });
    for (let p = 0; p < 3; p++) for (let j = 0; j < 2; j++) {
      const i = 3 * p + j;
      slots.push({ row: 1, x: 1 + 3 * p + j, cov: [9 + i, 10 + i] });
    }
    for (let i = 0; i < 9; i++) slots.push({ row: 2, x: 0.5 + i, cov: [18 + i, 19 + i] });
    for (let i = 0; i < 10; i++) slots.push({ row: 3, x: i, cov: [] });
    return slots;
  }
  const SLOTS = layout();

  function deal() {
    const d = shuffled();
    board = SLOTS.map((s, i) => ({
      ...d[i], row: s.row, cov: s.cov, removed: false,
      x: OX + s.x * STEP, y: OY + s.row * ROWY
    }));
    waste = [d[28]];
    stock = d.slice(29);
  }

  function faceUp(c) { return !c.removed && c.cov.every(i => board[i].removed); }
  function top() { return waste[waste.length - 1]; }

  function start() {
    deal(); state = 'play'; overlay.classList.add('hidden');
  }

  function draw1() {
    if (state !== 'play' || !stock.length) return;
    const c = stock.pop();
    waste.push(c);
  }

  // --- input ---
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (state !== 'play') return;
    const p = toLocal(e);
    if (p.x >= STOCK_X - 10 && p.x <= STOCK_X + HW + 10 && p.y >= HAND_Y - 10 && p.y <= HAND_Y + HH + 10) { draw1(); return; }
  });
  startBtn.addEventListener('click', start);

  // --- drawing ---
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cardBack(x, y, w, h) {
    rr(x, y, w, h, w * 0.14); ctx.fillStyle = '#fff'; ctx.fill();
    const m = w * 0.09;
    rr(x + m, y + m, w - 2 * m, h - 2 * m, w * 0.1);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2f63c9'); g.addColorStop(1, '#173a8a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (let k = -h; k < w + h; k += w * 0.22) { ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + k + h, y + h); ctx.stroke(); }
    ctx.restore();
  }
  function cardFace(c, x, y, w, h, opt = {}) {
    rr(x, y, w, h, w * 0.14);
    ctx.fillStyle = opt.dim ? '#d9ddd6' : '#fffdf6'; ctx.fill();
    ctx.lineWidth = opt.glow ? 2.5 : 1;
    ctx.strokeStyle = opt.glow ? '#ffd23a' : 'rgba(0,0,0,.25)'; ctx.stroke();
    const col = RED[c.suit] ? '#d33a3a' : '#1f2430';
    ctx.fillStyle = opt.dim ? (RED[c.suit] ? '#b87a7a' : '#6c707a') : col;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = w > 40;
    ctx.font = `bold ${Math.round(w * (big ? 0.36 : 0.44))}px system-ui, sans-serif`;
    ctx.fillText(RANKS[c.rank], x + w / 2, y + h * (big ? 0.3 : 0.32));
    ctx.font = `${Math.round(w * (big ? 0.5 : 0.48))}px system-ui, "Segoe UI Symbol", sans-serif`;
    ctx.fillText(SUITS[c.suit], x + w / 2, y + h * 0.7);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.4, H * 0.8);
    bg.addColorStop(0, '#2c8a5f'); bg.addColorStop(1, '#14553a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
    rr(6, 6, W - 12, H - 12, 12); ctx.stroke();

    // mountains silhouette
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let p = 0; p < 3; p++) {
      const cx = OX + (1.5 + 3 * p) * STEP + CW / 2;
      ctx.beginPath(); ctx.moveTo(cx - 62, OY + ROWY * 3 + CH + 8); ctx.lineTo(cx, OY - 16); ctx.lineTo(cx + 62, OY + ROWY * 3 + CH + 8); ctx.fill();
    }

    // board
    for (const c of board) {
      if (c.removed) continue;
      const up = faceUp(c);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
      if (up) cardFace(c, c.x, c.y, CW, CH); else cardBack(c.x, c.y, CW, CH);
      ctx.restore();
    }

    // cards remaining label
    const left = board.filter(c => !c.removed).length;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`のこり ${left} 枚`, W / 2, OY + ROWY * 3 + CH + 24);

    // stock
    if (stock.length) {
      const n = Math.min(4, Math.ceil(stock.length / 6));
      for (let i = n - 1; i >= 0; i--) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
        cardBack(STOCK_X - i * 2, HAND_Y - i * 2, HW, HH); ctx.restore();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      rr(STOCK_X, HAND_Y, HW, HH, 8); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`山札 ${stock.length}`, STOCK_X + HW / 2, HAND_Y + HH + 16);
    ctx.fillText('手札', WASTE_X + HW / 2, HAND_Y + HH + 16);

    // waste
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    cardFace(top(), WASTE_X, HAND_Y, HW, HH); ctx.restore();

    // arrows between
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('→', W / 2, HAND_Y + HH / 2);
  }

  // --- loop ---
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    render();
    requestAnimationFrame(loop);
  }

  resize();
  deal(); // background deal for title screen
  requestAnimationFrame(loop);
})();
