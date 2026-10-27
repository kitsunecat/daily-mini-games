(() => {
  'use strict';

  const N = 8;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  let size = 0, cell = 0, dpr = 1;

  // ---------- 描画 ----------
  function resize() {
    const rect = stage.getBoundingClientRect();
    const avail = Math.min(rect.width - 16, rect.height - 16);
    cell = Math.max(24, Math.floor(avail / N));
    size = cell * N;
    dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }

  startBtn.addEventListener('click', () => { overlay.classList.add('hidden'); });
  window.addEventListener('resize', () => { resize(); draw(); });

  resize();
  draw();
})();
