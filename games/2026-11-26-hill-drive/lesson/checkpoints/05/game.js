(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const msgEl = $('msg');
  const overlay = $('overlay'), startBtn = $('start');
  const pdGas = $('pd-gas'), pdBrake = $('pd-brake');

  // ---------- canvas size ----------
  let W = 0, H = 0, DPR = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- terrain ----------
  const PX_PER_M = 20;
  const START_X = 120;
  let ph = [0, 0, 0, 0];
  function ground(x) {
    if (x < 400) return 0;
    const t = x - 400;
    const ramp = Math.min(1, t / 500);
    const a = Math.min(140, 30 + t / 60);
    return ramp * (
      0.6 * a * Math.sin(t * 0.004 + ph[0]) - 0.6 * a * Math.sin(ph[0]) +
      0.4 * a * Math.sin(t * 0.011 + ph[1]) - 0.4 * a * Math.sin(ph[1]) +
      Math.min(22, 6 + t / 400) * Math.sin(t * 0.023 + ph[2]) - Math.min(22, 6 + t / 400) * Math.sin(ph[2])
    );
  }
  function slope(x) { return (ground(x + 1) - ground(x - 1)) / 2; }

  // ---------- state ----------
  const R = 15, L = 64, G = 0.36;
  let A, B, state = 'title', camX = 0, camY = 0;
  let gas = false, brake = false, groundedA = false, groundedB = false;

  function wheel(x) { const y = ground(x) - R; return { x, y, px: x, py: y, rot: 0 }; }

  function reset() {
    ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
    A = wheel(START_X); B = wheel(START_X + L);
    camX = START_X; camY = ground(START_X);
  }

  // ---------- physics ----------
  function collide(w) {
    const gy = ground(w.x);
    if (w.y + R <= gy) return false;
    const s = slope(w.x);
    const len = Math.hypot(s, 1);
    const nx = s / len, ny = -1 / len;
    const pen = (w.y + R - gy) / len;
    w.x += nx * pen; w.y += ny * pen;
    let vx = w.x - w.px, vy = w.y - w.py;
    const vn = vx * nx + vy * ny;
    if (vn < 0) { vx -= nx * vn * 1.15; vy -= ny * vn * 1.15; }
    w.px = w.x - vx; w.py = w.y - vy;
    return true;
  }

  function constrain() {
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 1;
    const diff = (d - L) / d / 2;
    A.x += dx * diff; A.y += dy * diff; B.x -= dx * diff; B.y -= dy * diff;
  }

  function carFrame() {
    const dx = (B.x - A.x) / L, dy = (B.y - A.y) / L;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    return { dx, dy, nx: dy, ny: -dx, mx, my };
  }

  function step() {
    const onGround = groundedA || groundedB;
    const f = carFrame();
    // drive
    for (const [w, g] of [[A, groundedA], [B, groundedB]]) {
      if (!g) continue;
      const s = slope(w.x), len = Math.hypot(1, s);
      const tx = 1 / len, ty = s / len;
      const vt = (w.x - w.px) * tx + (w.y - w.py) * ty;
      if (gas && vt < 11) { w.x += tx * 0.2; w.y += ty * 0.2; }
      if (brake) {
        if (vt > 0.3) { w.px += (w.x - w.px) * 0.07; w.py += (w.y - w.py) * 0.07; }
        else if (vt > -4) { w.x -= tx * 0.12; w.y -= ty * 0.12; }
      }
      if (!gas && !brake) { w.px += (w.x - w.px) * 0.004; w.py += (w.y - w.py) * 0.004; }
    }
    // air control / tilt
    const tilt = onGround ? 0.035 : 0.09;
    if (gas) { B.x += f.nx * tilt; B.y += f.ny * tilt; A.x -= f.nx * tilt; A.y -= f.ny * tilt; }
    if (brake) { B.x -= f.nx * tilt; B.y -= f.ny * tilt; A.x += f.nx * tilt; A.y += f.ny * tilt; }
    // integrate
    for (const w of [A, B]) {
      const vx = (w.x - w.px) * 0.998, vy = (w.y - w.py) * 0.998;
      w.px = w.x; w.py = w.y;
      w.x += vx; w.y += vy + G;
    }
    groundedA = groundedB = false;
    for (let i = 0; i < 4; i++) {
      constrain();
      if (collide(A)) groundedA = true;
      if (collide(B)) groundedB = true;
    }
    // wheel spin
    for (const w of [A, B]) w.rot += (w.x - w.px) / R;
  }

  // ---------- drawing ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6fc3ff'); g.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // sun
    ctx.fillStyle = 'rgba(255,240,180,.9)';
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.14, 26, 0, Math.PI * 2); ctx.fill();
    // far hills (parallax)
    const layers = [[0.15, '#a9d8c0', 0.55, 50], [0.35, '#8cc7a4', 0.65, 40]];
    for (const [p, col, base, amp] of layers) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) {
        const wx = x + camX * p;
        ctx.lineTo(x, H * base + Math.sin(wx * 0.006) * amp + Math.sin(wx * 0.017) * amp * 0.3);
      }
      ctx.lineTo(W, H); ctx.fill();
    }
  }

  function toScreen(x, y) { return [x - camX + W * 0.32, y - camY + H * 0.58]; }

  function drawTerrain() {
    const x0 = camX - W * 0.32 - 20, x1 = x0 + W + 40;
    ctx.beginPath();
    let [sx, sy] = toScreen(x0, ground(x0));
    ctx.moveTo(sx, H + 10);
    for (let x = x0; x <= x1; x += 6) { [sx, sy] = toScreen(x, ground(x)); ctx.lineTo(sx, sy); }
    ctx.lineTo(sx, H + 10); ctx.closePath();
    ctx.fillStyle = '#9a6a3e'; ctx.fill();
    // grass
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 6) { [sx, sy] = toScreen(x, ground(x)); x === x0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); }
    ctx.strokeStyle = '#4dbb4f'; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.strokeStyle = '#7ad66a'; ctx.lineWidth = 3; ctx.stroke();
    // distance posts every 50m
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const step50 = 50 * PX_PER_M;
    for (let x = Math.ceil((x0 - START_X) / step50) * step50 + START_X; x < x1; x += step50) {
      const m = Math.round((x - START_X) / PX_PER_M);
      if (m <= 0) continue;
      const [px, py] = toScreen(x, ground(x));
      ctx.fillStyle = '#5b3d22'; ctx.fillRect(px - 2, py - 34, 4, 34);
      ctx.fillStyle = '#fff'; ctx.fillRect(px - 18, py - 48, 36, 16);
      ctx.fillStyle = '#333'; ctx.fillText(m + 'm', px, py - 36);
    }
  }

  function drawWheel(w) {
    const [x, y] = toScreen(w.x, w.y);
    ctx.save(); ctx.translate(x, y); ctx.rotate(w.rot);
    ctx.fillStyle = '#26272b'; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9ced8'; ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6c7280'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-R * 0.5, 0); ctx.lineTo(R * 0.5, 0); ctx.stroke(); }
    ctx.restore();
  }

  function drawCar() {
    const c = carFrame();
    const [mx, my] = toScreen(c.mx, c.my);
    const ang = Math.atan2(c.dy, c.dx);
    // suspension
    ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
    for (const w of [A, B]) {
      const [wx, wy] = toScreen(w.x, w.y);
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + c.nx * 12, wy + c.ny * 12); ctx.stroke();
    }
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    // body (local: x forward, y down)
    ctx.fillStyle = '#ff7a2f'; ctx.strokeStyle = '#a8411a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -8); ctx.lineTo(-42, -22); ctx.lineTo(10, -22); ctx.lineTo(30, -16); ctx.lineTo(46, -14);
    ctx.lineTo(48, -4); ctx.lineTo(-44, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // roll bar
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(-10, -44); ctx.lineTo(4, -44); ctx.lineTo(8, -22); ctx.stroke();
    // driver
    ctx.fillStyle = '#3e6fd8'; ctx.fillRect(-10, -36, 12, 14);
    ctx.fillStyle = '#ffd9b0'; ctx.beginPath(); ctx.arc(-4, -40, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8453c'; ctx.beginPath(); ctx.arc(-4, -42, 8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(-1, -41, 3, 3);
    // headlight
    ctx.fillStyle = '#fff6b0'; ctx.fillRect(43, -13, 5, 5);
    ctx.restore();
    drawWheel(A); drawWheel(B);
  }

  function render() {
    drawBackground();
    drawTerrain();
    drawCar();
  }

  // ---------- loop ----------
  let last = 0, acc = 0;
  function loop(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0);
    last = ts;
    if (state === 'play') {
      acc += dt;
      while (acc >= 1 / 60 && state === 'play') { step(); acc -= 1 / 60; }
    }
    if (A) {
      const c = carFrame();
      camX += (c.mx - camX) * 0.2;
      camY += (c.my - camY) * 0.08;
      render();
    }
    requestAnimationFrame(loop);
  }

  // ---------- flow ----------
  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '右でアクセル、左でブレーキ。空中で向きを整えよう';
    acc = 0;
  }

  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) start(); });

  // ---------- input ----------
  const pointers = new Map();
  let keyGas = false, keyBrake = false;
  function refreshInput() {
    let g = keyGas, b = keyBrake;
    for (const side of pointers.values()) { if (side === 'g') g = true; else b = true; }
    gas = g; brake = b;
    pdGas.classList.toggle('on', gas); pdBrake.classList.toggle('on', brake);
  }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    pointers.set(e.pointerId, (e.clientX - r.left) > r.width / 2 ? 'g' : 'b');
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    refreshInput();
  });
  const up = (e) => { pointers.delete(e.pointerId); refreshInput(); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('lostpointercapture', up);
  window.addEventListener('blur', () => { pointers.clear(); keyGas = keyBrake = false; refreshInput(); });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'd') { keyGas = true; e.preventDefault(); }
    else if (k === 'arrowleft' || k === 'a') { keyBrake = true; e.preventDefault(); }
    refreshInput();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'd') keyGas = false;
    else if (k === 'arrowleft' || k === 'a') keyBrake = false;
    refreshInput();
  });

  reset();
  requestAnimationFrame(loop);
})();
