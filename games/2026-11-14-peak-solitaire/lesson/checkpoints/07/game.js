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

  let state = 'title', board = [], stock = [], waste = [], flying = [], popups = [], sparks = [];
  let score = 0, streak = 0, maxStreak = 0, cleared = 0, time = 0;
  let stuckT = 0, scale = 1;

  // --- sound ---
  let ac = null;
  function beep(freq, dur, type = 'sine', vol = 0.1, delay = 0) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur);
    } catch (e) {}
  }

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
      ...d[i], row: s.row, cov: s.cov, removed: false, shake: 0, flip: 1,
      x: OX + s.x * STEP, y: OY + s.row * ROWY
    }));
    waste = [d[28]];
    stock = d.slice(29);
    flying = []; streak = 0; stuckT = 0;
  }

  function faceUp(c) { return !c.removed && c.cov.every(i => board[i].removed); }
  function top() { return waste[waste.length - 1]; }
  function fits(c) { const d = Math.abs(c.rank - top().rank); return d === 1 || d === 12; }
  function playable() { return board.filter(c => faceUp(c) && fits(c)); }

  function start() {
    score = 0; maxStreak = 0; cleared = 0; scoreEl.textContent = 0;
    popups = []; sparks = [];
    deal(); state = 'play'; overlay.classList.add('hidden');
    beep(523, 0.1, 'triangle'); beep(784, 0.14, 'triangle', 0.1, 0.08);
  }

  function addScore(n, x, y, text) {
    score += n; scoreEl.textContent = score;
    popups.push({ x, y, text: text || ('+' + n), t: 0 });
  }

  function playCard(c) {
    if (state !== 'play' || !faceUp(c)) return;
    if (!fits(c)) {
      c.shake = 0.35; beep(150, 0.12, 'square', 0.05); return;
    }
    c.removed = true; cleared++;
    waste.push(c);
    flying.push({ card: c, fx: c.x, fy: c.y, fw: CW, fh: CH, t: 0 });
    streak++; maxStreak = Math.max(maxStreak, streak);
    let pts = 10 * streak;
    let label = streak >= 2 ? `${streak}コンボ +${pts}` : `+${pts}`;
    if (c.row === 0) { pts += 150; label += ' 山頂!'; }
    addScore(pts, c.x + CW / 2, c.y);
    for (let i = 0; i < 8; i++) sparks.push({ x: c.x + CW / 2, y: c.y + CH / 2, vx: (Math.random() - .5) * 160, vy: (Math.random() - .8) * 160, t: 0 });
    // rising pitch combo
    beep(330 * Math.pow(2, Math.min(streak - 1, 18) / 12), 0.13, 'triangle', 0.1);
    // newly revealed cards flip
    for (const b of board) if (!b.removed && b.flip >= 1 && faceUp(b) && b._wasDown) { b.flip = 0; b._wasDown = false; }
  }

  function draw1() {
    if (state !== 'play' || !stock.length) { if (state === 'play') beep(150, 0.1, 'square', 0.04); return; }
    const c = stock.pop();
    waste.push(c);
    flying.push({ card: c, fx: STOCK_X, fy: HAND_Y, fw: HW, fh: HH, t: 0, fromStock: true });
    if (streak >= 3) popups.push({ x: W / 2, y: HAND_Y - 20, text: 'コンボ終了', t: 0, dim: true });
    streak = 0; stuckT = 0;
    beep(440, 0.06, 'sine', 0.07);
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
    // board (front rows first)
    const open = board.filter(faceUp).sort((a, b) => b.row - a.row);
    for (const c of open) {
      if (p.x >= c.x - 1 && p.x <= c.x + CW + 1 && p.y >= c.y && p.y <= c.y + CH) { playCard(c); return; }
    }
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

  function drawCard(c, x, y, w, h, opt) {
    const f = opt.flip === undefined ? 1 : opt.flip;
    if (f < 1) {
      const s = Math.abs(Math.cos(f * Math.PI));
      ctx.save(); ctx.translate(x + w / 2, 0); ctx.scale(Math.max(0.02, s), 1); ctx.translate(-(x + w / 2), 0);
      if (f < 0.5) cardBack(x, y, w, h); else cardFace(c, x, y, w, h, opt);
      ctx.restore();
    } else if (opt.back) cardBack(x, y, w, h);
    else cardFace(c, x, y, w, h, opt);
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

    const pl = state === 'play' ? playable() : [];
    const hintOn = state === 'play' && stuckT > 4 && pl.length;
    // board
    for (const c of board) {
      if (c.removed) continue;
      const up = faceUp(c);
      let x = c.x;
      if (c.shake > 0) x += Math.sin(c.shake * 60) * 3;
      const glow = up && hintOn && pl.includes(c) && Math.sin(time * 6) > 0;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
      drawCard(c, x, c.y, CW, CH, { back: !up, flip: up ? c.flip : 1, glow });
      ctx.restore();
    }

    // cards remaining label
    const left = board.filter(c => !c.removed).length;
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`のこり ${left} 枚`, W / 2, OY + ROWY * 3 + CH + 24);

    // streak meter
    const my = 290;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; rr(40, my, W - 80, 14, 7); ctx.fill();
    const sw = Math.min(1, streak / 15) * (W - 84);
    if (sw > 0) {
      const g = ctx.createLinearGradient(40, 0, W - 40, 0);
      g.addColorStop(0, '#ffe17a'); g.addColorStop(1, '#ff7a3a');
      ctx.fillStyle = g; rr(42, my + 2, Math.max(10, sw), 10, 5); ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(streak >= 2 ? `${streak} コンボ！` : 'コンボ', W / 2, my - 14);

    // stock
    const stuck = state === 'play' && !pl.length && stock.length;
    if (stock.length) {
      const n = Math.min(4, Math.ceil(stock.length / 6));
      for (let i = n - 1; i >= 0; i--) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
        cardBack(STOCK_X - i * 2, HAND_Y - i * 2, HW, HH); ctx.restore();
      }
      if (stuck) {
        ctx.strokeStyle = `rgba(255,225,122,${0.5 + 0.5 * Math.sin(time * 6)})`; ctx.lineWidth = 3;
        rr(STOCK_X - 4, HAND_Y - 4, HW + 8, HH + 8, 10); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2;
      rr(STOCK_X, HAND_Y, HW, HH, 8); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`山札 ${stock.length}`, STOCK_X + HW / 2, HAND_Y + HH + 16);
    ctx.fillText('手札', WASTE_X + HW / 2, HAND_Y + HH + 16);

    // waste: show topmost non-flying card, then flying
    const flyingSet = new Set(flying.map(f => f.card));
    let base = null;
    for (let i = waste.length - 1; i >= 0; i--) if (!flyingSet.has(waste[i])) { base = waste[i]; break; }
    if (base) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      cardFace(base, WASTE_X, HAND_Y, HW, HH); ctx.restore();
    }
    for (const f of flying) {
      const t = Math.min(1, f.t / 0.22), e = 1 - Math.pow(1 - t, 3);
      const x = f.fx + (WASTE_X - f.fx) * e, y = f.fy + (HAND_Y - f.fy) * e - Math.sin(t * Math.PI) * 30;
      const w = f.fw + (HW - f.fw) * e, h = f.fh + (HH - f.fh) * e;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      drawCard(f.card, x, y, w, h, { flip: f.fromStock ? t : 1 }); ctx.restore();
    }

    // arrows between
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('→', W / 2, HAND_Y + HH / 2);

    // sparks & popups
    for (const s of sparks) {
      ctx.fillStyle = `rgba(255,230,120,${1 - s.t / 0.6})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.9);
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)';
      const px = Math.min(W - 60, Math.max(60, p.x));
      ctx.strokeText(p.text, px, p.y - p.t * 40);
      ctx.fillStyle = p.dim ? '#cfe' : '#ffe17a';
      ctx.fillText(p.text, px, p.y - p.t * 40);
      ctx.globalAlpha = 1;
    }
  }

  // --- loop ---
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    for (const c of board) {
      if (c.shake > 0) c.shake = Math.max(0, c.shake - dt);
      if (c.flip < 1) c.flip = Math.min(1, c.flip + dt / 0.25);
      if (!c.removed && !faceUp(c)) c._wasDown = true;
    }
    for (const f of flying) f.t += dt;
    flying = flying.filter(f => f.t < 0.22);
    for (const s of sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 400 * dt; }
    sparks = sparks.filter(s => s.t < 0.6);
    for (const p of popups) p.t += dt;
    popups = popups.filter(p => p.t < 0.9);

    if (state === 'play') {
      stuckT += dt;
    }
    render();
    requestAnimationFrame(loop);
  }

  resize();
  deal(); // background deal for title screen
  requestAnimationFrame(loop);
})();
