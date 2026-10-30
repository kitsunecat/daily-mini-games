(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const GRAVITY = 1500;
  const BOUNCE = 560;
  const MAX_FALL = 900;
  const BALL_R = 11;
  const FLOOR_Y = 200; // 仮の床（ステップ5で消す）

  let W = 0, H = 0, dpr = 1, R = 120, RY = 38;
  let state = 'title';
  let ball, camY, lastT;

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

  function reset() {
    camY = 0;
    ball = { y: 120, vy: 0, squash: 0 };
  }

  function update(dt) {
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

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // 柱
    const pw = Math.max(16, R * 0.16);
    const grad = ctx.createLinearGradient(W / 2 - pw, 0, W / 2 + pw, 0);
    grad.addColorStop(0, '#5b49c9');
    grad.addColorStop(0.5, '#9d8cff');
    grad.addColorStop(1, '#4a3aa8');
    ctx.fillStyle = grad;
    ctx.fillRect(W / 2 - pw, 0, pw * 2, H);

    // 仮の床
    ctx.fillStyle = '#6fd3ff';
    ctx.fillRect(W / 2 - R, FLOOR_Y - camY, R * 2, 4);

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

  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
