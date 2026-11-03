(() => {
  'use strict';
  const W = 360, H = 600;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), stageEl = $('stage-no'), dartsEl = $('darts');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), toast = $('toast');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ---- state ----
  let state = 'title'; // title | play | clear | over

  function start() {
    overlay.classList.add('hide');
    state = 'play';
  }

  // ---- update / draw ----
  function update(dt) {
    // ステップ2から、ここで動きを計算する
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ここに まと を描いていくよ', W / 2, H / 2);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // ---- input ----
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
})();
