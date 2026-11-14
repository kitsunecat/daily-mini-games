(() => {
  'use strict';
  const W = 360, H = 560;

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const stageEl = document.getElementById('stage-no');
  const overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text'), startBtn = document.getElementById('start');
  const stage = document.getElementById('stage');

  let state = 'title';
  let time = 0;
  let scale = 1;

  function resize() {
    const sw = stage.clientWidth - 16, sh = stage.clientHeight - 8;
    scale = Math.max(0.3, Math.min(sw / W, sh / H));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function start() {
    state = 'play'; overlay.classList.add('hidden');
  }

  // --- input ---
  startBtn.addEventListener('click', start);

  // --- drawing ---
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.4, H * 0.8);
    bg.addColorStop(0, '#2c8a5f'); bg.addColorStop(1, '#14553a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
    rr(6, 6, W - 12, H - 12, 12); ctx.stroke();
  }

  // --- loop ---
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    render();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
