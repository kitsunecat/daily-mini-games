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

  // ---------- 物理 ----------
  function step(dt) {
    time += dt;
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
    }
    ctx.restore();
  }

  // ---------- 入力 ----------
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
