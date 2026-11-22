(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), timeEl = $('time'), fillEl = $('timefill'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  // ---------- state ----------
  let N = 5;
  let state = 'title';

  function startGame() {
    state = 'play';
    overlay.classList.add('hidden');
  }

  // ---------- layout & drawing ----------
  let W = 0, H = 0, dpr = 1, ox = 0, oy = 0, cs = 40;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function layout() {
    const size = Math.max(100, Math.min(W - 24, H - 24));
    cs = Math.floor(size / N);
    ox = Math.round((W - cs * N) / 2); oy = Math.round((H - cs * N) / 2);
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (state === 'title') return;
    layout();
    // board shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(ox - 6, oy - 2, cs * N + 12, cs * N + 12, 14); ctx.fill();
    ctx.fillStyle = '#3a3154';
    roundRect(ox - 6, oy - 6, cs * N + 12, cs * N + 12, 14); ctx.fill();
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, x = ox + c * cs, y = oy + r * cs;
      ctx.fillStyle = '#f3eeff';
      ctx.fillRect(x, y, cs, cs);
    }
    // thin grid
    ctx.strokeStyle = 'rgba(60,40,80,.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < N; k++) {
      ctx.moveTo(ox + k * cs + 0.5, oy); ctx.lineTo(ox + k * cs + 0.5, oy + N * cs);
      ctx.moveTo(ox, oy + k * cs + 0.5); ctx.lineTo(ox + N * cs, oy + k * cs + 0.5);
    }
    ctx.stroke();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop(t) {
    draw(t);
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  startBtn.addEventListener('click', startGame);
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(loop);
})();
