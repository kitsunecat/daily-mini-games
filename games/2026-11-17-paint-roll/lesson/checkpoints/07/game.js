(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const elLevel = $('level'), elScore = $('score'), elBest = $('best'), elMoves = $('moves'), elLives = $('lives');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const DIR_LIST = Object.values(DIRS);
  const HUES = [330, 200, 45, 140, 270, 15, 175, 300];

  // ---------- state ----------
  let state = 'title'; // title | play | clear | over
  let level = 1, score = 0, lives = 3;
  let W = 0, H = 0, grid = null, painted = null, toPaint = 0, paintedCount = 0;
  let ball = { x: 0, y: 0, px: 0, py: 0 };
  let start = { x: 0, y: 0 };
  let movesLeft = 0, moveLimit = 0;
  let anim = null; // {dx,dy,tx,ty,t,dist}
  let queued = null;
  let hue = 330;
  let cell = 30, ox = 0, oy = 0;
  let flash = 0;

  // ---------- level generation ----------
  function rnd(n) { return Math.floor(Math.random() * n); }

  function slide(g, w, h, x, y, dx, dy, cb) {
    while (true) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !g[ny * w + nx]) break;
      x = nx; y = ny;
      if (cb) cb(x, y);
    }
    return [x, y];
  }

  function generate(lv) {
    const iw = Math.min(5 + Math.floor((lv - 1) / 2), 9);
    const ih = Math.min(6 + Math.floor((lv - 1) / 2), 12);
    const w = iw + 2, h = ih + 2;
    const steps = Math.min(5 + lv * 2, 26);
    let bestLv = null, bestVal = -1;
    for (let attempt = 0; attempt < 60; attempt++) {
      const g = new Uint8Array(w * h);
      const sx = 1 + rnd(iw), sy = 1 + rnd(ih);
      g[sy * w + sx] = 1;
      let x = sx, y = sy, last = null;
      const seq = [];
      for (let s = 0; s < steps; s++) {
        let d;
        do { d = DIR_LIST[rnd(4)]; } while (last && d[0] === -last[0] && d[1] === -last[1]);
        const len = 1 + rnd(Math.max(2, Math.floor(Math.max(iw, ih) * 0.7)));
        let cx = x, cy = y;
        for (let k = 0; k < len; k++) {
          const nx = cx + d[0], ny = cy + d[1];
          if (nx < 1 || ny < 1 || nx > iw || ny > ih) break;
          cx = nx; cy = ny; g[cy * w + cx] = 1;
        }
        const [ex, ey] = slide(g, w, h, x, y, d[0], d[1]);
        if (ex === x && ey === y) continue;
        x = ex; y = ey; last = d; seq.push(d);
      }
      // replay on final grid: only the cells the ball actually rolls over stay as floor
      const p = new Uint8Array(w * h);
      p[sy * w + sx] = 1;
      let rx = sx, ry = sy, moves = 0;
      for (const d of seq) {
        const [ex, ey] = slide(g, w, h, rx, ry, d[0], d[1], (cx, cy) => { p[cy * w + cx] = 1; });
        if (ex !== rx || ey !== ry) moves++;
        rx = ex; ry = ey;
      }
      let count = 0;
      for (let i = 0; i < p.length; i++) count += p[i];
      const val = count + moves * 3;
      if (count >= Math.min(iw * ih * 0.45, 8 + lv * 4) && moves >= 3 && val > bestVal) {
        bestVal = val; bestLv = { w, h, g: p, sx, sy, moves, count };
      }
    }
    if (!bestLv) return generate(Math.max(1, lv - 1));
    return bestLv;
  }

  function loadLevel(fresh) {
    if (fresh || !loadLevel.cache) loadLevel.cache = generate(level);
    const L = loadLevel.cache;
    W = L.w; H = L.h; grid = L.g;
    painted = new Uint8Array(W * H);
    toPaint = L.count; paintedCount = 0;
    start = { x: L.sx, y: L.sy };
    ball = { x: L.sx, y: L.sy, px: L.sx, py: L.sy };
    paint(L.sx, L.sy);
    moveLimit = L.moves + Math.max(2, 6 - Math.floor(level / 3));
    movesLeft = moveLimit;
    anim = null; queued = null;
    hue = HUES[(level - 1) % HUES.length];
    resize();
    updateHud();
  }

  function paint(x, y) {
    const i = y * W + x;
    if (!painted[i]) {
      painted[i] = 1; paintedCount++;
      return true;
    }
    return false;
  }

  // ---------- game flow ----------
  function startGame() {
    level = 1; score = 0; lives = 3;
    state = 'play';
    overlay.classList.add('hidden');
    loadLevel(true);
  }

  function tryMove(name) {
    if (state !== 'play') return;
    if (anim) { queued = name; return; }
    const [dx, dy] = DIRS[name];
    const [ex, ey] = slide(grid, W, H, ball.x, ball.y, dx, dy);
    if (ex === ball.x && ey === ball.y) return;
    movesLeft--;
    const dist = Math.abs(ex - ball.x) + Math.abs(ey - ball.y);
    anim = { dx, dy, sx: ball.x, sy: ball.y, tx: ex, ty: ey, t: 0, dist };
    updateHud();
  }

  function finishMove() {
    ball.x = anim.tx; ball.y = anim.ty; ball.px = ball.x; ball.py = ball.y;
    const a = anim; anim = null;
    if (paintedCount >= toPaint) { levelClear(); return; }
    if (movesLeft <= 0) { loseLife(); return; }
    if (queued) { const q = queued; queued = null; tryMove(q); }
    void a;
  }

  function levelClear() {
    state = 'clear';
    flash = 1;
    updateHud();
    setTimeout(() => {
      if (state !== 'clear') return;
      level++; state = 'play'; loadLevel(true);
    }, 1100);
  }

  function loseLife(manual) {
    lives--;
    if (lives <= 0) { gameOver(); return; }
    loadLevel(false);
    showToast(manual ? 'やり直し！' : '手数切れ！');
  }

  function gameOver() {
    state = 'over';
    updateHud();
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = `レベル <b class="hl">${level}</b> まで到達`;
    startBtn.textContent = 'もう一度あそぶ';
    overlay.classList.remove('hidden');
  }

  let toast = null;
  function showToast(text) { toast = { text, t: 1.2 }; }

  function updateHud() {
    elLevel.textContent = level;
    elMoves.textContent = Math.max(0, movesLeft);
    elLives.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  }

  // ---------- render ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    const aw = Math.max(100, r.width - 16), ah = Math.max(100, r.height - 12);
    const gw = W || 7, gh = H || 8;
    cell = Math.floor(Math.min(aw / gw, ah / gh, 56));
    const dpr = window.devicePixelRatio || 1;
    cv.width = gw * cell * dpr; cv.height = gh * cell * dpr;
    cv.style.width = gw * cell + 'px'; cv.style.height = gh * cell + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    const gw = W * cell, gh = H * cell;
    ctx.clearRect(0, 0, gw, gh);
    // walls background
    ctx.fillStyle = '#1d4e63';
    roundRect(0, 0, gw, gh, cell * 0.3); ctx.fill();
    // wall pattern
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!grid[y * W + x] && (x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    const pad = Math.max(1, cell * 0.04);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!grid[i]) continue;
      ctx.fillStyle = painted[i] ? `hsl(${hue},80%,62%)` : '#e9eef1';
      roundRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.18);
      ctx.fill();
      if (painted[i]) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x * cell + pad * 2, y * cell + pad * 2, cell - pad * 4, (cell - pad * 4) * 0.3);
      }
    }
    // ball
    const bx = (ball.px + 0.5) * cell, by = (ball.py + 0.5) * cell, br = cell * 0.36;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(bx, by + br * 0.75, br * 0.85, br * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const grad = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
    grad.addColorStop(0, `hsl(${hue},100%,85%)`);
    grad.addColorStop(1, `hsl(${hue},75%,42%)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    // progress bar
    const prog = toPaint ? paintedCount / toPaint : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cell * 0.3, cell * 0.35, gw - cell * 0.6, cell * 0.22);
    ctx.fillStyle = `hsl(${hue},85%,65%)`;
    ctx.fillRect(cell * 0.3, cell * 0.35, (gw - cell * 0.6) * prog, cell * 0.22);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, gw, gh);
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, flash * 2)})`;
      ctx.font = `bold ${Math.floor(cell * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('CLEAR!', gw / 2, gh / 2);
    }
    if (toast) {
      ctx.globalAlpha = Math.min(1, toast.t * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(gw / 2 - cell * 2.4, gh / 2 - cell * 0.6, cell * 4.8, cell * 1.2, cell * 0.3); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold ${Math.floor(cell * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(toast.text, gw / 2, gh / 2);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- loop ----------
  let lastT = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
    if (anim) {
      const speed = 16; // cells per second
      anim.t += dt * speed;
      const d = Math.min(anim.t, anim.dist);
      ball.px = anim.sx + anim.dx * d; ball.py = anim.sy + anim.dy * d;
      const passed = Math.floor(d + 0.5);
      for (let k = 1; k <= passed; k++) paint(anim.sx + anim.dx * k, anim.sy + anim.dy * k);
      if (anim.t >= anim.dist) finishMove();
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 0.9);
    if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
    if (grid) draw();
    requestAnimationFrame(loop);
  }

  // ---------- input ----------
  let touchStart = null;
  function onDown(x, y) { touchStart = { x, y }; }
  function onUp(x, y) {
    if (!touchStart) return;
    const dx = x - touchStart.x, dy = y - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 'right' : 'left');
    else tryMove(dy > 0 ? 'down' : 'up');
  }
  stage.addEventListener('pointerdown', (e) => { if (state === 'play') { onDown(e.clientX, e.clientY); } });
  window.addEventListener('pointerup', (e) => onUp(e.clientX, e.clientY));
  window.addEventListener('pointercancel', () => { touchStart = null; });
  // also handle swipe mid-drag for snappier feel
  window.addEventListener('pointermove', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 40) onUp(e.clientX, e.clientY);
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (state !== 'play') return;
    const map = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    if (map[k]) { e.preventDefault(); tryMove(map[k]); }
    else if (k === 'r' || k === 'R') retry();
  });

  function retry() {
    if (state !== 'play' || anim) return;
    if (paintedCount <= 1 && movesLeft === moveLimit) return;
    loseLife(true);
  }
  $('retry').addEventListener('click', retry);
  startBtn.addEventListener('click', startGame);
  window.addEventListener('resize', () => { if (grid) resize(); });

  // title background: show a sample level
  level = 1; loadLevel(true);
  requestAnimationFrame(loop);
})();
