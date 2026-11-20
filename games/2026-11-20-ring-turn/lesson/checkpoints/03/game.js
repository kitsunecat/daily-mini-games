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
  const SHAPES = ['circle', 'tri', 'square', 'diamond', 'star', 'plus'];

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
  function drawShape(shape, x, y, r) {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (shape === 'tri') { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.05 + r * 0.12); } ctx.closePath(); }
    else if (shape === 'square') ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
    else if (shape === 'diamond') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else if (shape === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    else { const t = r * 0.35; ctx.rect(x - t, y - r, t * 2, r * 2); ctx.rect(x - r, y - t, r * 2, t * 2); }
    ctx.fill();
  }

  function drawBall(x, y, r, c) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.3, COLORS[c]);
    g.addColorStop(1, shade(COLORS[c]));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    drawShape(SHAPES[c], x, y, r * 0.42);
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.55);
    return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#33275a'); bg.addColorStop(1, '#1a1330');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // sector guide lines
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 2;
    for (let k = 0; k < N; k++) {
      const a = angleOf(k, 0);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * ringRadius(0) * 0.6, cy + Math.sin(a) * ringRadius(0) * 0.6);
      ctx.lineTo(cx + Math.cos(a) * (ringRadius(2) + R * 0.16), cy + Math.sin(a) * (ringRadius(2) + R * 0.16));
      ctx.stroke();
    }

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
        drawBall(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, br, grid[i][k]);
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
