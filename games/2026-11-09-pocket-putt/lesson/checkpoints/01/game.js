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

  // ---------- 状態 ----------
  let state = 'title';   // title | aim | roll | sink | over
  let course = null;
  let time = 0;

  function newGame() {
    ui.overlay.classList.add('hide');
    state = 'aim';
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

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    step(dt); draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
