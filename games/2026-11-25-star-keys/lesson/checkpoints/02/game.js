(() => {
  'use strict';
  const LANES = 4;
  const ROWS = 4; // visible rows

  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const msgEl = $('msg');
  const overlay = $('overlay'), startBtn = $('start');

  let W = 0, H = 0, dpr = 1, laneW = 0, rowH = 0;
  let bgStars = [];

  // ---------- layout ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    laneW = W / LANES; rowH = H / ROWS;
    bgStars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
    draw();
  }
  window.addEventListener('resize', resize);

  startBtn.addEventListener('click', start);

  function msg(s) { msgEl.textContent = s; }

  function start() {
    overlay.classList.add('hidden');
    msg('いちばん下のタイルからタップ！');
  }

  function draw(now) {
    const time = (now || 0) / 1000;
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2f6b'); g.addColorStop(1, '#f0e9ff');
    ctx.fillStyle = '#f4f1ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.18; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    for (const s of bgStars) {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + s.p);
      ctx.fillStyle = '#7b86d8';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // レーン線
    ctx.strokeStyle = 'rgba(90,100,170,.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath(); ctx.moveTo(i * laneW + 0.5, 0); ctx.lineTo(i * laneW + 0.5, H); ctx.stroke();
    }
  }

  resize();
})();
