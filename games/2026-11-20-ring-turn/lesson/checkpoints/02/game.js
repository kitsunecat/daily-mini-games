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
  let grid = [];       // grid[ring][sector] = color index
  let state = 'title'; // title | play | over
  let score = 0, moves = START_MOVES, nColors = 4, chain = 0;

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

  const ringRadius = (i) => R * (0.34 + 0.29 * i);
  const ballRadius = (i) => Math.min(R * 0.12, ringRadius(i) * Math.sin(Math.PI / N) * 0.78);

  function rnd() { return Math.floor(Math.random() * nColors); }

  function newBoard() {
    grid = [];
    for (let i = 0; i < RINGS; i++) {
      grid.push([]);
      for (let k = 0; k < N; k++) grid[i].push(rnd());
    }
  }

  function start() {
    state = 'play';
    $overlay.classList.add('hidden');
    $hint.textContent = '右側タップで時計回り、左側タップで反時計回り';
  }

  function angleOf(k, r) { return (k + r) * (Math.PI * 2 / N) - Math.PI / 2; }

  // input
  $start.addEventListener('click', (e) => { e.stopPropagation(); start(); });

  // drawing
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#33275a'); bg.addColorStop(1, '#1a1330');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // rings
    for (let i = 0; i < RINGS; i++) {
      const rr = ringRadius(i);
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = ballRadius(i) * 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      const br = ballRadius(i);
      for (let k = 0; k < N; k++) {
        const a = angleOf(k, 0);
        ctx.fillStyle = COLORS[grid[i][k]];
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, br, 0, Math.PI * 2); ctx.fill();
      }
    }

    // hub
    const hr = ringRadius(0) * 0.5;
    ctx.fillStyle = '#2a2050';
    ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,74,.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffcf4a';
    ctx.font = 'bold ' + Math.round(hr * 0.42) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', cx + hr * 0.38, cy);
    ctx.fillText('↺', cx - hr * 0.38, cy);
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  newBoard();
  loop();
})();
