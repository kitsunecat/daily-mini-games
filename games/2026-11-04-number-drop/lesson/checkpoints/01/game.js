(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const W = 360, H = 560;

  let state = 'title'; // title | ready | busy | over

  // ---------- game ----------
  function start() {
    $('overlay').classList.add('hide');
    state = 'ready';
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ここに盤面を描いていくよ', W / 2, H / 2);
  }

  // ---------- input ----------
  $('start').addEventListener('click', (e) => { e.stopPropagation(); start(); });

  requestAnimationFrame(frame);
})();
