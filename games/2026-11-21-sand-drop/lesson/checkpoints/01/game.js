(() => {
  'use strict';
  const W = 40, H = 76, B = 4;          // grid size in grains, block = 4x4 grains
  const SPAWN = 16;                       // rows above the red line

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const nextCv = document.getElementById('nextcv');
  const nctx = nextCv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const rotBtn = document.getElementById('rot');

  let state = 'title';
  let view = { x: 0, y: 0, s: 1 };

  function start() {
    state = 'play';
    overlay.classList.add('hidden');
  }

  // --- input ---
  startBtn.addEventListener('click', start);

  // --- render ---
  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const s = Math.min(cv.width / W, cv.height / H);
    view = { s: s / dpr, x: (r.width - W * s / dpr) / 2, y: (r.height - H * s / dpr) / 2, dpr };
  }
  window.addEventListener('resize', resize);

  function render(time) {
    const dpr = view.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = view.s;
    // field background (step 2 で砂の絵に置きかえる)
    ctx.fillStyle = 'rgb(44,34,22)';
    ctx.fillRect(view.x, view.y, W * s, SPAWN * s);
    ctx.fillStyle = 'rgb(58,48,36)';
    ctx.fillRect(view.x, view.y + SPAWN * s, W * s, (H - SPAWN) * s);

    // red danger line
    ctx.strokeStyle = 'rgba(255,80,80,.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(view.x, view.y + SPAWN * s);
    ctx.lineTo(view.x + W * s, view.y + SPAWN * s);
    ctx.stroke();
    ctx.setLineDash([]);

    // frame
    ctx.strokeStyle = '#6b5136';
    ctx.lineWidth = 2;
    ctx.strokeRect(view.x - 1, view.y - 1, W * s + 2, H * s + 2);
  }

  function loop(now) {
    render(now);
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
