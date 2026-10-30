(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let W = 0, H = 0, dpr = 1, R = 120, RY = 38;

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
  }

  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  window.addEventListener('resize', () => { resize(); draw(); });

  resize();
  draw();
})();
