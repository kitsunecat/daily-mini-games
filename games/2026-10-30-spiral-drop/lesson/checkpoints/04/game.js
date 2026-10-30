(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const SLOTS = 12;
  const SLOT_ANG = Math.PI * 2 / SLOTS;
  const SPACING = 130;
  const GRAVITY = 1500;
  const BOUNCE = 560;
  const MAX_FALL = 900;
  const BALL_R = 11;
  const COLORS = {
    safe: ['#6fd3ff', '#2e7fb8'],
    danger: ['#ff4f6a', '#a3203a'],
  };
  const FLOOR_Y = 200; // 仮の床（ステップ5で消す）

  let W = 0, H = 0, dpr = 1, R = 120, RY = 38;
  let state = 'title';
  let rings, ball, camY, rot, nextIndex, keyDir, lastT;

  function resize() {
    const rect = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W * 0.38, 160);
    RY = R * 0.3;
  }

  function makeRing(i) {
    const types = new Array(SLOTS).fill('safe');
    if (i === 0) {
      // 最初のリングは、すき間をボールの真下から少し離す
      types[6] = types[7] = 'gap';
      return { y: 200 + i * SPACING, types, passed: false, broken: false };
    }
    const gapLen = i < 10 ? 3 : 2;
    const g0 = Math.floor(Math.random() * SLOTS);
    for (let k = 0; k < gapLen; k++) types[(g0 + k) % SLOTS] = 'gap';
    return { y: 200 + i * SPACING, types, passed: false, broken: false };
  }

  function reset() {
    rings = [];
    nextIndex = 0;
    rot = 0;
    camY = 0;
    keyDir = 0;
    ball = { y: 120, vy: 0, squash: 0 };
    ensureRings();
  }

  function ensureRings() {
    while (nextIndex === 0 || rings[rings.length - 1].y < camY + H + 300) {
      rings.push(makeRing(nextIndex++));
    }
    while (rings.length && rings[0].y < camY - 200) rings.shift();
  }

  function update(dt) {
    if (keyDir) rot += keyDir * 3.2 * dt;

    ball.vy = Math.min(ball.vy + GRAVITY * dt, MAX_FALL);
    const prevY = ball.y;
    let newY = ball.y + ball.vy * dt;
    ball.squash = Math.max(0, ball.squash - dt * 5);

    if (prevY <= FLOOR_Y && newY >= FLOOR_Y) {
      newY = FLOOR_Y;
      ball.vy = -BOUNCE;
      ball.squash = 1;
    }
    ball.y = newY;
  }

  function drawRingPart(r, front) {
    const cy = r.y - camY - RY;
    if (cy < -RY * 3 || cy > H + RY * 3) return;
    const lw = Math.max(12, R * 0.13);
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = lw;
      ctx.lineCap = 'butt';
      for (let k = 0; k < SLOTS; k++) {
        const type = r.types[k];
        if (type === 'gap') continue;
        const col = COLORS[type][pass === 0 ? 1 : 0];
        const a0 = k * SLOT_ANG + rot;
        // 1スロットを3分割して、手前/奥を判定
        for (let s = 0; s < 3; s++) {
          const b0 = a0 + s * SLOT_ANG / 3;
          const b1 = b0 + SLOT_ANG / 3 + 0.01;
          const isFront = Math.sin((b0 + b1) / 2) > 0;
          if (isFront !== front) continue;
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.ellipse(W / 2, cy + (pass === 0 ? lw * 0.6 : 0), R, RY, 0, b0, b1);
          ctx.stroke();
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const visible = rings.filter(r => !r.broken);
    for (const r of visible) drawRingPart(r, false);

    // 柱
    const pw = Math.max(16, R * 0.16);
    const grad = ctx.createLinearGradient(W / 2 - pw, 0, W / 2 + pw, 0);
    grad.addColorStop(0, '#5b49c9');
    grad.addColorStop(0.5, '#9d8cff');
    grad.addColorStop(1, '#4a3aa8');
    ctx.fillStyle = grad;
    ctx.fillRect(W / 2 - pw, 0, pw * 2, H);

    for (const r of visible) drawRingPart(r, true);

    // ボール
    const bx = W / 2;
    const by = ball.y - camY - BALL_R;
    const sq = ball.squash * 0.35;
    ctx.save();
    ctx.translate(bx, by + BALL_R * sq);
    ctx.scale(1 + sq, 1 - sq);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(-BALL_R * 0.35, -BALL_R * 0.35, BALL_R * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;
    if (state === 'play') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
  }

  // ---- input ----
  let dragging = false, lastX = 0;
  cv.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rot -= dx * (2.4 / Math.max(200, W));
  });
  const endDrag = () => { dragging = false; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { keyDir = 1; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { keyDir = -1; e.preventDefault(); }
    else if (e.key === 'Enter' && state !== 'play') start();
  });
  window.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && keyDir === 1) || (e.key === 'ArrowRight' && keyDir === -1)) keyDir = 0;
  });
  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
