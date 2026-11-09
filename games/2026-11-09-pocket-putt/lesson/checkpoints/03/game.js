(() => {
  'use strict';
  const W = 360, H = 600;           // 論理サイズ
  const M = 16;                     // コースの外枠
  const BALL_R = 7, CUP_R = 11;
  const MAX_SPEED = 950, MAX_PULL = 150;
  const START_BALLS = 10;
  const BEST_KEY = 'pocket-putt-best';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = {
    hole: $('hole'), balls: $('balls'), score: $('score'), best: $('best'),
    par: $('par'), strokes: $('strokes'), overlay: $('overlay'),
    title: $('ov-title'), text: $('ov-text'), start: $('start'), toast: $('toast'),
  };

  // ---------- 乱数 ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));

  // ---------- 状態 ----------
  let state = 'title';   // title | aim | roll | sink | over
  let hole = 1, balls = START_BALLS, score = 0, strokes = 0, par = 2;
  let course = null;
  const ball = { x: 0, y: 0, vx: 0, vy: 0, lastX: 0, lastY: 0, scale: 1 };
  let aim = { active: false, sx: 0, sy: 0, dx: 0, dy: 0 };
  let time = 0;

  function makeCourse(n) {
    const c = { walls: [], water: [], sand: [], movers: [] };
    c.tee = { x: rnd(M + 50, W - M - 50), y: H - M - 50 };
    c.cup = { x: rnd(M + 40, W - M - 40), y: rnd(M + 50, M + 120) };
    c.par = 2 + (n >= 3 ? 1 : 0);
    return c;
  }

  function startHole() {
    course = makeCourse(hole);
    par = course.par; strokes = 0;
    ball.x = ball.lastX = course.tee.x; ball.y = ball.lastY = course.tee.y;
    ball.vx = ball.vy = 0; ball.scale = 1;
    state = 'aim';
    updateHud();
  }

  function newGame() {
    hole = 1; balls = START_BALLS; score = 0;
    ui.overlay.classList.add('hide');
    startHole();
  }

  function updateHud() {
    ui.hole.textContent = hole; ui.balls.textContent = balls; ui.score.textContent = score;
    ui.par.textContent = 'PAR ' + par; ui.strokes.textContent = '今の打数 ' + strokes;
  }

  function shoot(dx, dy, power) {
    if (state !== 'aim' || balls <= 0) return;
    const len = Math.hypot(dx, dy) || 1;
    const sp = Math.pow(power, 1.6) * MAX_SPEED; // 弱いパットを細かく調整できるように
    ball.vx = dx / len * sp; ball.vy = dy / len * sp;
    ball.lastX = ball.x; ball.lastY = ball.y;
    balls--; strokes++;
    state = 'roll';
    updateHud();
  }

  // ---------- 物理 ----------
  function step(dt) {
    time += dt;
    if (state !== 'roll') return;

    const sub = 6, h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const k = Math.exp(-0.95 * h);               // 指数減衰
      ball.vx *= k; ball.vy *= k;
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 0) {                                  // 一定の転がり抵抗
        const dec = Math.min(sp, 70 * h);
        ball.vx -= ball.vx / sp * dec; ball.vy -= ball.vy / sp * dec;
      }
      ball.x += ball.vx * h; ball.y += ball.vy * h;

      // 外枠
      if (ball.x < M + BALL_R) { ball.x = M + BALL_R; ball.vx = Math.abs(ball.vx) * 0.8; }
      if (ball.x > W - M - BALL_R) { ball.x = W - M - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.8; }
      if (ball.y < M + BALL_R) { ball.y = M + BALL_R; ball.vy = Math.abs(ball.vy) * 0.8; }
      if (ball.y > H - M - BALL_R) { ball.y = H - M - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.8; }
    }
    if (Math.hypot(ball.vx, ball.vy) < 6) { ball.vx = ball.vy = 0; endRoll(); }
  }

  function endRoll() {
    state = 'aim';
  }

  // ---------- 描画 ----------
  function rrect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 外枠（木）
    ctx.fillStyle = '#7a4b25'; rrect(0, 0, W, H, 14); ctx.fill();
    ctx.fillStyle = '#a5683a'; rrect(4, 4, W - 8, H - 8, 11); ctx.fill();
    // 芝
    ctx.save(); rrect(M, M, W - 2 * M, H - 2 * M, 6); ctx.clip();
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? '#3a9a50' : '#349148';
      ctx.fillRect(M, M + i * (H - 2 * M) / 14, W - 2 * M, (H - 2 * M) / 14 + 1);
    }
    if (course) {
      // ティー
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(course.tee.x, course.tee.y, 16, 0, Math.PI * 2); ctx.fill();
      // カップ
      const c = course.cup;
      ctx.fillStyle = '#2a7a3c'; ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R + 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(c.x, c.y, CUP_R, 0, Math.PI * 2); ctx.fill();
      // ボール
      if (ball.scale > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.arc(ball.x + 2, ball.y + 3, BALL_R * ball.scale, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfd6dc');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R * ball.scale, 0, Math.PI * 2); ctx.fill();
      }
      // 旗
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 42); ctx.stroke();
      const wave = Math.sin(time * 4) * 3;
      ctx.fillStyle = '#ff5a4f';
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 42); ctx.lineTo(c.x + 24, c.y - 35 + wave); ctx.lineTo(c.x, c.y - 28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(hole, c.x + 9, c.y - 32 + wave / 2);

      if (state === 'aim') drawAim();
    }
    ctx.restore();
  }

  function currentAim() {
    if (aim.active) {
      const dx = aim.sx - aim.dx, dy = aim.sy - aim.dy, len = Math.hypot(dx, dy);
      return { dx, dy, power: Math.min(1, len / MAX_PULL), ok: len > 8 };
    }
    return null;
  }

  function drawAim() {
    const a = currentAim();
    if (!a) {
      // 待機中のガイド
      const p = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.strokeStyle = `rgba(255,255,255,${0.3 + p * 0.4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R + 6 + p * 4, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    if (!a.ok) return;
    const len = Math.hypot(a.dx, a.dy) || 1, ux = a.dx / len, uy = a.dy / len;
    const L = 30 + a.power * 150;
    const col = a.power < 0.5 ? `rgb(${Math.round(120 + a.power * 270)},230,90)` : `rgb(255,${Math.round(230 - (a.power - 0.5) * 360)},70)`;
    ctx.fillStyle = col;
    for (let d = BALL_R + 8; d < L; d += 11) {
      ctx.globalAlpha = 1 - d / (L + 30);
      ctx.beginPath(); ctx.arc(ball.x + ux * d, ball.y + uy * d, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 引っぱり側の線
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(ball.x - ux * a.power * 50, ball.y - uy * a.power * 50); ctx.stroke();
    // パワーバー
    const bx = W - M - 14, by = H - M - 110;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(bx, by, 8, 100, 4); ctx.fill();
    ctx.fillStyle = col; rrect(bx, by + 100 * (1 - a.power), 8, 100 * a.power, 4); ctx.fill();
  }

  // ---------- 入力 ----------
  function toLogical(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', e => {
    if (state !== 'aim') return;
    e.preventDefault();
    const p = toLogical(e);
    aim = { active: true, sx: p.x, sy: p.y, dx: p.x, dy: p.y };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!aim.active) return;
    const p = toLogical(e); aim.dx = p.x; aim.dy = p.y;
  });
  function release() {
    if (!aim.active) return;
    const a = currentAim(); aim.active = false;
    if (a && a.ok && a.power > 0.06) shoot(a.dx, a.dy, a.power);
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => { aim.active = false; });

  ui.start.addEventListener('click', newGame);
  ui.overlay.addEventListener('pointerdown', e => { if (e.target === ui.overlay) newGame(); });

  // ---------- サイズ ----------
  function resize() {
    const stage = $('stage');
    const aw = stage.clientWidth - 16, ah = stage.clientHeight - 8;
    const s = Math.max(0.3, Math.min(aw / W, ah / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.round(W * s * dpr); cv.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // タイトル背景用のコース
  course = makeCourse(4);
  ball.x = course.tee.x; ball.y = course.tee.y;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    step(dt); draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
