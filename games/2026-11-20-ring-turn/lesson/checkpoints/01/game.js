(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $score = document.getElementById('score');
  const $moves = document.getElementById('moves');
  const $best = document.getElementById('best');
  const $overlay = document.getElementById('overlay');
  const $title = document.getElementById('ov-title');
  const $text = document.getElementById('ov-text');
  const $start = document.getElementById('start');
  const $hint = document.getElementById('hint');

  const N = 8;           // sectors per ring
  const RINGS = 3;
  const START_MOVES = 20;
  const COLORS = ['#ff5a6e', '#ffc93c', '#4fd18b', '#4aa8ff', '#c77dff', '#ff8f3c'];

  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0;
  let state = 'title'; // title | play | over

  function resize() {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) * 0.46;
  }
  window.addEventListener('resize', resize);

  function start() {
    state = 'play';
    $overlay.classList.add('hidden');
    $hint.textContent = '右側タップで時計回り、左側タップで反時計回り';
  }

  // input
  $start.addEventListener('click', (e) => { e.stopPropagation(); start(); });

  // drawing
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#33275a'); bg.addColorStop(1, '#1a1330');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  loop();
})();
