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
  let tray = [null, null, null];
  let selected = null;
  let drag = null;
  let busy = false;
  let playing = false;
  let score = 0, level = 1, cleared = 0, goal = 30;
  let flights = [];
  let pops = [];
  let toasts = [];

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
  const pure = (st) => st.length > 0 && topRun(st) === st.length;

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
  function refillTray() {
    if (tray.every(t => t === null)) tray = [randStack(), randStack(), randStack()];
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
  function trayPos(i) { return { x: W / 2 + (i - 1) * Math.min(W * 0.3, S * 3.2), y: trayY }; }
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

  function hoverCell() {
    if (!drag || !drag.moved) return null;
    return pickCell(drag.x, drag.y - S * 0.6);
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const hc = hoverCell();
    // board base
    for (const c of cells) {
      hexPath(c.x, c.y + 4, S * 0.97);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
      hexPath(c.x, c.y, S * 0.97);
      let fill = 'rgba(255,255,255,.08)';
      if (!c.stack.length && !c.pending && selected !== null && !busy) fill = 'rgba(198,182,255,.18)';
      if (c === hc && !c.stack.length) fill = 'rgba(255,209,102,.45)';
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // stacks, back-to-front
    const order = cells.slice().sort((a, b) => a.y - b.y);
    for (const c of order) if (c.stack.length) drawStack(c.stack, c.x, c.y, S, true);

    // flights
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      const t = Math.min(1, (now - f.t0) / f.dur);
      if (t < 0) continue;
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * t) * S * 1.2;
      drawTile(x, y, S, f.col);
      if (t >= 1) { f.done(); flights.splice(i, 1); }
    }
    // pops
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      const t = (now - p.t0) / 450;
      if (t >= 1) { pops.splice(i, 1); continue; }
      if (t < 0) continue;
      drawTile(p.x, p.y - t * S * 1.4, S * (1 + t * 0.3), p.col, 1 - t);
    }

    // tray
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    const tw = Math.min(W - 16, S * 10);
    roundRect(W / 2 - tw / 2, trayY - S * 2.3, tw, S * 3.3, 16); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const p = trayPos(i);
      if (selected === i) {
        hexPath(p.x, p.y + 2, S * 1.05);
        ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.stroke();
      }
      if (!tray[i]) continue;
      if (drag && drag.i === i && drag.moved) continue;
      drawStack(tray[i], p.x, p.y, S * 0.85, false);
    }
    if (drag && drag.moved && tray[drag.i]) {
      drawStack(tray[drag.i], drag.x, drag.y - S * 0.6, S, false);
    }

    // toasts
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      const k = (now - t.t0) / t.dur;
      if (k >= 1) { toasts.splice(i, 1); continue; }
      ctx.globalAlpha = k < .8 ? 1 : (1 - k) / .2;
      ctx.font = `800 ${t.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,20,60,.9)';
      ctx.strokeText(t.text, t.x, t.y - k * 30);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y - k * 30);
      ctx.globalAlpha = 1;
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop(now) { draw(now); requestAnimationFrame(loop); }

  // ---------- logic ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function transfer(src, dst) {
    const n = topRun(src.stack);
    const col = top(src.stack);
    const th = thick(S);
    const jobs = [];
    for (let k = 0; k < n; k++) {
      src.stack.pop();
      const fromH = src.stack.length;
      const toH = dst.stack.length + dst.pending;
      dst.pending++;
      jobs.push(new Promise(res => {
        flights.push({
          x0: src.x, y0: src.y - fromH * th, x1: dst.x, y1: dst.y - toH * th, col,
          t0: performance.now(), dur: 200,
          done: () => { dst.pending--; dst.stack.push(col); res(); }
        });
      }));
      await sleep(45);
    }
    await Promise.all(jobs);
  }

  function tryClear(c) {
    const n = topRun(c.stack);
    if (n < CLEAR_N) return false;
    const col = top(c.stack);
    const th = thick(S);
    const now = performance.now();
    for (let k = 0; k < n; k++) {
      c.stack.pop();
      pops.push({ x: c.x, y: c.y - c.stack.length * th, col, t0: now + k * 25 });
    }
    const gained = n * level;
    score += gained;
    cleared += n;
    toasts.push({ text: '+' + gained, x: c.x, y: c.y - S, color: COLORS[col], size: Math.round(S * 0.7), t0: now, dur: 900 });
    while (cleared >= goal) levelUp();
    updateHud();
    return true;
  }

  function levelUp() {
    level++;
    goal += 20 + level * 10;
    toasts.push({ text: 'LEVEL ' + level + '!', x: W / 2, y: boardCY, color: '#ffd166', size: Math.round(S * 1.0), t0: performance.now(), dur: 1400 });
  }

  async function resolve(start) {
    const queue = [start];
    let guard = 0;
    while (queue.length && guard++ < 400) {
      const c = queue.shift();
      if (!c.stack.length) continue;
      const col = top(c.stack);
      const ns = neighbors(c).filter(n => n.stack.length && top(n.stack) === col);
      if (!ns.length) {
        if (tryClear(c)) {
          await sleep(320);
          queue.push(c, ...neighbors(c));
        }
        continue;
      }
      let target = c, sources = ns;
      if (ns.length === 1 && pure(c.stack) && !pure(ns[0].stack)) { target = ns[0]; sources = [c]; }
      for (const s of sources) {
        if (!s.stack.length || top(s.stack) !== col) continue;
        await transfer(s, target);
        queue.push(s);
      }
      queue.push(target);
    }
    for (const c of cells) if (tryClear(c)) await sleep(320);
  }

  async function place(i, cell) {
    if (busy || !tray[i] || cell.stack.length) return;
    busy = true;
    cell.stack = tray[i];
    tray[i] = null;
    selected = null;
    drag = null;
    updateHud();
    await resolve(cell);
    refillTray();
    updateHud();
    busy = false;
  }

  function updateHud() {
    elScore.textContent = score;
    elLevel.textContent = level;
    elGoal.textContent = Math.max(0, goal - cleared) + '枚';
    elFree.textContent = cells.filter(c => !c.stack.length).length;
  }

  function newGame() {
    score = 0; level = 1; cleared = 0; goal = 30;
    selected = null; drag = null; busy = false;
    flights = []; pops = []; toasts = [];
    for (const c of cells) { c.stack = []; c.pending = 0; }
    // a few starter stacks
    const empty = cells.slice().sort(() => Math.random() - .5);
    for (let k = 0; k < 3; k++) {
      const st = randStack();
      empty[k].stack = st.slice(0, Math.max(1, st.length - 1));
    }
    tray = [null, null, null];
    refillTray();
    playing = true;
    overlay.classList.add('hidden');
    updateHud();
  }

  // ---------- input ----------
  function pickCell(x, y) {
    let bestC = null, bd = Infinity;
    for (const c of cells) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; bestC = c; }
    }
    return bd < S * 0.95 ? bestC : null;
  }
  function pickTray(x, y) {
    for (let i = 0; i < 3; i++) {
      const p = trayPos(i);
      if (Math.abs(x - p.x) < S * 1.4 && y > p.y - S * 2.2 && y < p.y + S * 1.1) return i;
    }
    return -1;
  }
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  cv.addEventListener('pointerdown', (e) => {
    if (!playing || busy) return;
    e.preventDefault();
    const p = pos(e);
    const ti = pickTray(p.x, p.y);
    if (ti >= 0 && tray[ti]) {
      selected = ti;
      drag = { i: ti, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      return;
    }
    const c = pickCell(p.x, p.y);
    if (c && selected !== null && !c.stack.length) place(selected, c);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 10) drag.moved = true;
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag;
    if (d.moved) {
      const c = pickCell(d.x, d.y - S * 0.6);
      drag = null;
      if (c && !c.stack.length) { place(d.i, c); return; }
    }
    drag = null;
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', () => { drag = null; });

  window.addEventListener('keydown', (e) => {
    if (!playing) return;
    if (['1', '2', '3'].includes(e.key)) {
      const i = +e.key - 1;
      if (tray[i]) selected = i;
    }
  });

  startBtn.addEventListener('click', newGame);
  window.addEventListener('resize', layout);

  buildBoard();
  updateHud();
  requestAnimationFrame(loop);
})();
