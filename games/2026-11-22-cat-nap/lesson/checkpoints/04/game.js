(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level'), timeEl = $('time'), fillEl = $('timefill'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const COLORS = ['#ffb3ba', '#ffdfa3', '#fff3a8', '#b9f0c2', '#a8e4f0', '#b8c4ff', '#dcb8ff', '#ffc4e8'];
  const CAT_COLORS = ['#f4a24c', '#6b6b78', '#f2f2f2', '#2f2f36', '#d9b38c'];

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
  let N = 5, puzzle = null, cells = [], catColor = [];
  let state = 'title', level = 1;
  let conflicts = new Set();

  function newLevel() {
    N = 5;
    puzzle = SAMPLE;
    cells = new Array(N * N).fill(0); // 0 empty, 1 x-mark, 2 cat
    catColor = cells.map(() => CAT_COLORS[Math.random() * CAT_COLORS.length | 0]);
    conflicts = new Set();
    levelEl.textContent = 'ステージ ' + level;
    updateMsg();
  }

  function check() {
    conflicts = new Set();
    const cats = [];
    for (let i = 0; i < N * N; i++) if (cells[i] === 2) cats.push(i);
    for (let a = 0; a < cats.length; a++) for (let b = a + 1; b < cats.length; b++) {
      const i = cats[a], j = cats[b];
      const ri = i / N | 0, ci = i % N, rj = j / N | 0, cj = j % N;
      if (ri === rj || ci === cj || puzzle.reg[i] === puzzle.reg[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        conflicts.add(i); conflicts.add(j);
      }
    }
    updateMsg(cats.length);
    if (cats.length === N && conflicts.size === 0) win();
  }
  function updateMsg(n) {
    if (n === undefined) n = cells.filter((v) => v === 2).length;
    msgEl.textContent = conflicts.size ? 'ぶつかっているねこがいるよ' : 'ねこ ' + n + ' / ' + N;
  }

  function win() {
    state = 'clear';
    msgEl.textContent = 'クリア！';
  }

  function setCell(i, v) {
    if (cells[i] === v) return;
    cells[i] = v;
    check();
  }
  function cycle(i) { setCell(i, (cells[i] + 1) % 3); }

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

  function drawCat(x, y, s, color, bad, scale) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(scale, scale);
    const dark = color === '#2f2f36' || color === '#6b6b78';
    // body (curled)
    ctx.fillStyle = bad ? '#ff6b7a' : color;
    ctx.strokeStyle = 'rgba(40,30,50,.55)'; ctx.lineWidth = s * 0.04;
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.36, s * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // tail
    ctx.beginPath(); ctx.lineWidth = s * 0.08; ctx.strokeStyle = bad ? '#e04a5a' : color;
    ctx.arc(0, s * 0.12, s * 0.34, 0.2, 1.4); ctx.stroke();
    // head
    ctx.lineWidth = s * 0.04; ctx.strokeStyle = 'rgba(40,30,50,.55)';
    ctx.fillStyle = bad ? '#ff6b7a' : color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.26, -s * 0.02);
    ctx.lineTo(-s * 0.24, -s * 0.34); ctx.lineTo(-s * 0.1, -s * 0.22);
    ctx.lineTo(s * 0.1, -s * 0.22); ctx.lineTo(s * 0.24, -s * 0.34);
    ctx.lineTo(s * 0.26, -s * 0.02);
    ctx.quadraticCurveTo(s * 0.26, s * 0.16, 0, s * 0.16);
    ctx.quadraticCurveTo(-s * 0.26, s * 0.16, -s * 0.26, -s * 0.02);
    ctx.fill(); ctx.stroke();
    // sleepy eyes
    ctx.strokeStyle = dark ? '#f5f0ff' : '#3a2f45'; ctx.lineWidth = s * 0.035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.06, s * 0.05, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.06, s * 0.05, 0.2, Math.PI - 0.2); ctx.stroke();
    // nose
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath(); ctx.arc(0, s * 0.03, s * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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
    // marks & cats
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, cx = ox + c * cs + cs / 2, cy = oy + r * cs + cs / 2;
      if (cells[i] === 1) {
        ctx.strokeStyle = 'rgba(70,55,95,.55)'; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.lineCap = 'round';
        const d = cs * 0.14;
        ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
      } else if (cells[i] === 2) {
        drawCat(cx, cy, cs * 0.9, catColor[i], conflicts.has(i), 1);
      }
    }
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
  let drag = null;
  function cellAt(e) {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left - ox, y = e.clientY - r.top - oy;
    if (x < 0 || y < 0 || x >= cs * N || y >= cs * N) return -1;
    return (y / cs | 0) * N + (x / cs | 0);
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    const i = cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    drag = { start: i, moved: false };
  });
  const endDrag = () => {
    if (drag && !drag.moved && state === 'play') cycle(drag.start);
    drag = null;
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', () => { drag = null; });

  startBtn.addEventListener('click', startGame);
  window.addEventListener('resize', resize);

  resize();
  requestAnimationFrame(loop);
})();
