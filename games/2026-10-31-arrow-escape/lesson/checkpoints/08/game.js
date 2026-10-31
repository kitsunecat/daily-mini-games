(() => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), levelEl = $('level');
  const livesEl = $('lives'), timeFill = $('timefill');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text');
  const startBtn = $('start'), toast = $('toast');

  // 0:上 1:右 2:下 3:左
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const COLORS = ['#ff7a7a', '#ffc75a', '#5ee0b5', '#6ab8ff'];
  const SHADES = ['#c94f5a', '#c9923a', '#2f9c7b', '#3d82c4'];
  const MAX_LIVES = 3;
  const BEST_KEY = 'arrow-escape-best';

  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) {}
  bestEl.textContent = best;

  let N = 5, grid = [], movers = [], particles = [];
  let level = 1, score = 0, lives = MAX_LIVES;
  let timeLimit = 30, timeLeft = 30;
  let state = 'title'; // title | play | clear | over
  let cursor = null; // キーボード用 {r, c}
  let shake = 0;
  let W = 0, H = 0, dpr = 1;

  // ---- 効果音（Web Audio） ----
  let actx = null;
  function beep(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }

  // ---- 盤面生成：必ず解ける配置をつくる ----
  function pathClear(g, r, c, d) {
    let x = c + DX[d], y = r + DY[d];
    while (x >= 0 && y >= 0 && x < N && y < N) {
      if (g[y][x]) return false;
      x += DX[d]; y += DY[d];
    }
    return true;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function generate() {
    N = Math.min(8, 4 + Math.ceil(level / 2));
    const fill = Math.min(0.92, 0.5 + level * 0.06);
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([r, c]);
    shuffle(cells);
    const count = Math.max(6, Math.round(N * N * fill));
    for (let i = 0; i < count; i++) {
      const [r, c] = cells[i];
      grid[r][c] = { dir: Math.floor(Math.random() * 4) };
    }
    // 取り除ける順番を貪欲にたどり、詰まったら向きを直す
    const sim = grid.map((row) => row.map((t) => t));
    let left = count;
    while (left > 0) {
      const free = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = sim[r][c];
        if (t && pathClear(sim, r, c, t.dir)) free.push([r, c]);
      }
      if (free.length) {
        for (const [r, c] of free) { sim[r][c] = null; left--; }
        continue;
      }
      const rest = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (sim[r][c]) rest.push([r, c]);
      shuffle(rest);
      for (const [r, c] of rest) {
        const ok = [0, 1, 2, 3].filter((d) => pathClear(sim, r, c, d));
        if (ok.length) { sim[r][c].dir = ok[Math.floor(Math.random() * ok.length)]; break; }
      }
    }
    timeLimit = Math.round(10 + count * 1.6);
    timeLeft = timeLimit;
    movers = [];
    if (cursor) cursor = { r: Math.floor(N / 2), c: Math.floor(N / 2) };
  }

  // ---- レイアウト ----
  function resize() {
    const rect = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function board() {
    const size = Math.min(W, H) * 0.92;
    const cell = size / N;
    return { x: (W - size) / 2, y: (H - size) / 2, size, cell };
  }

  // ---- 操作 ----
  function tapCell(r, c) {
    if (state !== 'play') return;
    const t = grid[r] && grid[r][c];
    if (!t) return;
    const d = t.dir;
    // 進める距離を調べる
    let x = c + DX[d], y = r + DY[d], dist = 0, blocked = false;
    while (x >= 0 && y >= 0 && x < N && y < N) {
      if (grid[y][x]) { blocked = true; break; }
      x += DX[d]; y += DY[d]; dist++;
    }
    if (!blocked) {
      grid[r][c] = null;
      movers.push({ r, c, dir: d, t: 0, dist: dist + 6 });
      score += 10;
      updateHud();
      beep(520 + Math.random() * 80, 0.12, 'triangle', 0.1, 1.8);
      if (isEmpty()) levelClear();
    } else {
      t.bump = { t: 0, dist: dist + 0.25 };
      t.flash = 1;
      lives--;
      shake = 8;
      beep(140, 0.25, 'square', 0.08, 0.6);
      updateHud();
      if (lives <= 0) gameOver();
    }
  }
  function isEmpty() {
    for (const row of grid) for (const t of row) if (t) return false;
    return true;
  }
  function cellAt(px, py) {
    const b = board();
    const c = Math.floor((px - b.x) / b.cell), r = Math.floor((py - b.y) / b.cell);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    return { r, c };
  }

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const hit = cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) tapCell(hit.r, hit.c);
  });
  window.addEventListener('keydown', (e) => {
    if (state !== 'play') {
      if ((e.key === 'Enter' || e.key === ' ') && state !== 'clear') { e.preventDefault(); start(); }
      return;
    }
    const map = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
    if (e.key in map) {
      e.preventDefault();
      if (!cursor) cursor = { r: Math.floor(N / 2), c: Math.floor(N / 2) };
      else {
        const d = map[e.key];
        cursor.r = Math.max(0, Math.min(N - 1, cursor.r + DY[d]));
        cursor.c = Math.max(0, Math.min(N - 1, cursor.c + DX[d]));
      }
    } else if ((e.key === ' ' || e.key === 'Enter') && cursor) {
      e.preventDefault();
      tapCell(cursor.r, cursor.c);
    }
  });
  startBtn.addEventListener('click', start);

  // ---- 進行 ----
  function start() {
    level = 1; score = 0; lives = MAX_LIVES;
    particles = [];
    generate();
    state = 'play';
    overlay.classList.add('hidden');
    updateHud();
    beep(660, 0.1, 'triangle');
  }
  function levelClear() {
    state = 'clear';
    const bonus = Math.ceil(timeLeft) * 5 + level * 20;
    score += bonus;
    if (lives < MAX_LIVES) lives++;
    updateHud();
    showToast(`LEVEL ${level} クリア！ +${bonus}`);
    burst();
    [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'triangle', 0.1), i * 90));
    setTimeout(() => {
      if (state !== 'clear') return;
      level++;
      generate();
      state = 'play';
      updateHud();
    }, 1200);
  }
  function gameOver() {
    state = 'over';
    let isBest = false;
    if (score > best) {
      best = score; isBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    updateHud();
    setTimeout(() => {
      ovTitle.textContent = 'ゲームオーバー';
      ovText.innerHTML = `LEVEL ${level} まで到達<br>スコア <b>${score}</b>${isBest ? '<br>🎉 ハイスコア更新！' : ''}`;
      startBtn.textContent = 'もう一度';
      overlay.classList.remove('hidden');
    }, 700);
  }
  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score);
    levelEl.textContent = level;
    let h = '';
    for (let i = 0; i < MAX_LIVES; i++) h += `<span class="${i < lives ? '' : 'off'}">❤️</span>`;
    livesEl.innerHTML = h;
  }
  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1000);
  }
  function burst() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      particles.push({ x: W / 2, y: H / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: COLORS[i % 4] });
    }
  }

  // ---- 描画 ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawTile(cx, cy, s, dir, alpha, flash) {
    const pad = s * 0.08, w = s - pad * 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = SHADES[dir];
    roundRect(cx - w / 2, cy - w / 2 + s * 0.05, w, w, s * 0.18); ctx.fill();
    ctx.fillStyle = flash > 0 ? '#ff4d4d' : COLORS[dir];
    roundRect(cx - w / 2, cy - w / 2, w, w, s * 0.18); ctx.fill();
    // やじるし
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#fff';
    const a = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, -a);
    ctx.lineTo(a * 0.85, -a * 0.05);
    ctx.lineTo(a * 0.3, -a * 0.05);
    ctx.lineTo(a * 0.3, a);
    ctx.lineTo(-a * 0.3, a);
    ctx.lineTo(-a * 0.3, -a * 0.05);
    ctx.lineTo(-a * 0.85, -a * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function update(dt) {
    if (state === 'play') {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        lives--;
        shake = 8;
        beep(110, 0.35, 'sawtooth', 0.07, 0.5);
        showToast('時間切れ！ ハート -1');
        timeLeft = timeLimit * 0.5;
        updateHud();
        if (lives <= 0) { timeLeft = 0; gameOver(); }
      }
    }
    timeFill.style.width = `${Math.max(0, timeLeft / timeLimit) * 100}%`;
    for (const m of movers) m.t += dt;
    movers = movers.filter((m) => m.t < 0.6);
    for (const row of grid) for (const t of row) {
      if (!t) continue;
      if (t.bump) { t.bump.t += dt; if (t.bump.t > 0.35) t.bump = null; }
      if (t.flash > 0) t.flash -= dt * 2.5;
    }
    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt * 1.2; }
    particles = particles.filter((p) => p.life > 0);
    shake *= 0.85;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!W) return;
    const b = board();
    ctx.save();
    if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)';
      roundRect(b.x + c * b.cell + 2, b.y + r * b.cell + 2, b.cell - 4, b.cell - 4, b.cell * 0.14);
      ctx.fill();
    }
    // ブロック
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = grid[r][c];
      if (!t) continue;
      let ox = 0, oy = 0;
      if (t.bump) {
        const p = t.bump.t / 0.35;
        const k = Math.sin(Math.min(1, p) * Math.PI) * t.bump.dist * b.cell;
        ox = DX[t.dir] * k; oy = DY[t.dir] * k;
      }
      drawTile(b.x + (c + 0.5) * b.cell + ox, b.y + (r + 0.5) * b.cell + oy, b.cell, t.dir, 1, t.flash || 0);
    }
    // 飛んでいくブロック
    for (const m of movers) {
      const p = m.t / 0.6;
      const k = (p * p) * m.dist * b.cell;
      drawTile(b.x + (m.c + 0.5) * b.cell + DX[m.dir] * k, b.y + (m.r + 0.5) * b.cell + DY[m.dir] * k, b.cell, m.dir, 1 - p, 0);
    }
    // キーボードカーソル
    if (cursor && state === 'play') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      roundRect(b.x + cursor.c * b.cell + 1, b.y + cursor.r * b.cell + 1, b.cell - 2, b.cell - 2, b.cell * 0.18);
      ctx.stroke();
    }
    ctx.restore();
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', resize);
  resize();
  generate();
  updateHud();
  requestAnimationFrame(frame);
})();
