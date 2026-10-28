(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let W = 0, H = 0, dpr = 1;

  // ---------- 画面サイズ ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    draw();
  }
  window.addEventListener('resize', resize);

  // ---------- 描画 ----------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0d1a26';
    ctx.fillRect(0, 0, W, H);
    // 仮の目印：画面のまん中に円
    ctx.strokeStyle = '#4fd1ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));

  resize();
})();
