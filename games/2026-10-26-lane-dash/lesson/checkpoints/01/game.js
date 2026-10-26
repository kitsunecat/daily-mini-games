(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let W = 0, H = 0, dpr = 1;

  // ---------- 画面サイズ ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  const horizon = () => H * 0.3;

  // ---------- 描画 ----------
  function draw() {
    if (!W) return;
    const hz = horizon();

    // 空
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1a1145');
    sky.addColorStop(1, '#ff7aa8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz + 1);
    ctx.fillStyle = 'rgba(255,230,160,0.9)';
    ctx.beginPath();
    ctx.arc(W * 0.78, hz * 0.45, Math.min(W, H) * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // 地面
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(0, hz, W, H - hz);
  }

  startBtn.addEventListener('click', () => { overlay.classList.add('hidden'); });

  resize();
  draw();
})();
