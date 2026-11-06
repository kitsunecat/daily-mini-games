(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), btnStart = $('start');

  let W = 0, H = 0, dpr = 1;
  let state = 'title';
  let t = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = W * dpr; cv.height = H * dpr;
  }

  // ---------- drawing ----------
  function drawWorld() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a1c'); g.addColorStop(0.6, '#1a1f48'); g.addColorStop(1, '#3a2a5c');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    ctx.fillStyle = '#0a0c18'; ctx.fillRect(-W, H - 18, W * 3, H);
    ctx.fillStyle = '#ff6fd8';
    ctx.fillRect(0, H - 18, W, 1.5);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
  }

  // ---------- game ----------
  function update(dt) {
    t += dt;
  }

  function start() {
    resize();
    state = 'play';
    overlay.classList.add('hide');
  }

  // ---------- input ----------
  btnStart.addEventListener('click', start);
  window.addEventListener('resize', () => { if (state !== 'play') resize(); });

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  resize();
  requestAnimationFrame(loop);
})();
