(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), timeEl = $('time'), fillEl = $('timefill'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const COLORS = ['#ffb3ba', '#ffdfa3', '#fff3a8', '#b9f0c2', '#a8e4f0', '#b8c4ff', '#dcb8ff', '#ffc4e8'];

  // sample puzzle (step 5 で自動生成に置きかえる)
  const SAMPLE = {
    sol: [0, 3, 1, 4, 2],
    reg: [
      0, 0, 0, 0, 0,
      0, 1, 1, 1, 2,
      0, 2, 2, 2, 2,
      4, 4, 2, 3, 3,
      4, 4, 4, 4, 3,
    ],
  };

  // ---------- state ----------
  let N = 5, puzzle = null;
  let state = 'title', level = 1;

  function newLevel() {
    N = 5;
    puzzle = SAMPLE;
    levelEl.textContent = 'ステージ ' + level;
  }

  function startGame() {
    level = 1;
    newLevel();
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
    if (!puzzle) {
      // title backdrop: a sleeping cat pattern
      return;
    }
    layout();
    const reg = puzzle.reg;
    // board shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(ox - 6, oy - 2, cs * N + 12, cs * N + 12, 14); ctx.fill();
    ctx.fillStyle = '#3a3154';
    roundRect(ox - 6, oy - 6, cs * N + 12, cs * N + 12, 14); ctx.fill();
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, x = ox + c * cs, y = oy + r * cs;
      ctx.fillStyle = COLORS[reg[i]];
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
    // thick region borders
    ctx.strokeStyle = '#3a3154'; ctx.lineWidth = Math.max(2.5, cs * 0.06); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = r * N + c, x = ox + c * cs, y = oy + r * cs;
      if (c < N - 1 && reg[i] !== reg[i + 1]) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
      if (r < N - 1 && reg[i] !== reg[i + N]) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
    }
    ctx.stroke();
    ctx.strokeRect(ox, oy, cs * N, cs * N);
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
