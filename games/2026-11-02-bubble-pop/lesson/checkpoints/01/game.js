(() => {
  'use strict';
  const W = 360, H = 600, R = 20;
  const SX = W / 2, SY = H - 46;             // 発射台

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), shotsEl = $('shots');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), toast = $('toast');

  let running = false;

  // ---------- 進行 ----------
  function start() {
    running = true;
    overlay.classList.add('hide');
  }

  // ---------- 描画 ----------
  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    // 発射台
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(SX, SY, R + 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  startBtn.addEventListener('click', () => { start(); });

  requestAnimationFrame(loop);
})();
