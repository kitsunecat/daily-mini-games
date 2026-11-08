(() => {
  'use strict';
  const W = 360;
  let H = 650;
  const COLS = 6, CELL = 54, GX = (W - COLS * CELL) / 2, GY = 206;
  const BENCH = 5, SEAT_X0 = 36, SEAT_STEP = 72, BENCH_Y = 136, WALK_Y = 184;
  const BUS_X = 22, BUS_Y = 14, BUS_W = 200, BUS_H = 70, CAP = 3;
  const PALETTE = ['#ff5a5f', '#3fa7ff', '#ffd23f', '#3ddc84', '#b06cff', '#ff9a3c', '#ff7ad9'];
  const WALL = -2, EMPTY = -1;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let state = 'title';
  let level = 1, rows = 5;
  let grid = [], bench = [], queue = [], bus = null, walkers = [];

  // ---------- helpers ----------
  const rnd = n => Math.floor(Math.random() * n);
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const cellCenter = (r, c) => ({ x: GX + c * CELL + CELL / 2, y: GY + r * CELL + CELL / 2 });
  const seatPos = i => ({ x: SEAT_X0 + i * SEAT_STEP, y: BENCH_Y });
  const busSeatPos = (i, bx) => ({ x: bx + 50 + i * 46, y: BUS_Y + 30 });
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // cells open to the top road (empty cells connected to row 0)
  function openSet(g) {
    const R = g.length, seen = g.map(row => row.map(() => false)), q = [];
    for (let c = 0; c < COLS; c++) if (g[0][c] === EMPTY) { seen[0][c] = true; q.push([0, c]); }
    while (q.length) {
      const [r, c] = q.shift();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= COLS || seen[nr][nc] || g[nr][nc] !== EMPTY) continue;
        seen[nr][nc] = true; q.push([nr, nc]);
      }
    }
    return seen;
  }
  function reachableMap(g) {
    const open = openSet(g);
    return g.map((row, r) => row.map((v, c) => {
      if (v < 0) return false;
      if (r === 0) return true;
      return DIRS.some(([dr, dc]) => { const nr = r + dr, nc = c + dc; return nr >= 0 && nr < g.length && nc >= 0 && nc < COLS && open[nr][nc]; });
    }));
  }
  function pathOut(g, sr, sc) {
    const R = g.length, prev = g.map(row => row.map(() => null)), q = [[sr, sc]];
    prev[sr][sc] = [-1, -1];
    while (q.length) {
      const [r, c] = q.shift();
      if (r === 0) {
        const out = []; let cur = [r, c];
        while (cur[0] !== -1) { out.unshift(cur); cur = prev[cur[0]][cur[1]]; }
        return out;
      }
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= R || nc < 0 || nc >= COLS || prev[nr][nc] || g[nr][nc] !== EMPTY) continue;
        prev[nr][nc] = [r, c]; q.push([nr, nc]);
      }
    }
    return [[sr, sc]];
  }

  function generate(L) {
    rows = Math.min(4 + L, 8);
    const nColors = Math.min(2 + L, 7);
    const g = Array.from({ length: rows }, () => Array(COLS).fill(EMPTY));
    const nWalls = L < 2 ? 0 : Math.min(1 + Math.floor(L / 2), 6);
    for (let i = 0; i < nWalls; i++) g[1 + rnd(rows - 1)][rnd(COLS)] = WALL;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
      if (g[r][c] !== WALL) cells.push({ r, c });
    }
    const n = Math.floor(cells.length / 3) * 3;
    const busCount = n / 3;
    const buses = [];
    for (let i = 0; i < busCount; i++) buses.push(i % nColors);
    shuffle(buses);
    const seq = shuffle(buses.flatMap(c => [c, c, c]));
    for (let i = 0; i < n; i++) g[cells[i].r][cells[i].c] = seq[i];
    return { g, buses };
  }

  // ---------- game flow ----------
  function startStage() {
    const s = generate(level);
    grid = s.g; queue = s.buses.slice();
    bench = Array(BENCH).fill(null);
    walkers = [];
    bus = null;
    nextBus();
    resize();
    $('stage-no').textContent = level;
    updateNext();
  }
  function nextBus() {
    if (!queue.length) { bus = null; return; }
    bus = { color: queue.shift(), filled: 0, arrived: 0, x: -BUS_W - 20, state: 'arrive' };
    updateNext();
  }
  function updateNext() {
    $('next').innerHTML = queue.length
      ? queue.slice(0, 4).map(c => `<i style="background:${PALETTE[c]}"></i>`).join('') + (queue.length > 4 ? ` +${queue.length - 4}` : '')
      : 'なし（最後のバス）';
  }
  function walkTo(color, pts, onArrive) {
    walkers.push({ color, pts, i: 0, x: pts[0].x, y: pts[0].y, onArrive });
  }

  function tapCell(r, c) {
    if (state !== 'play' || r < 0 || r >= rows || c < 0 || c >= COLS) return;
    const v = grid[r][c];
    if (v < 0) return;
    const reach = reachableMap(grid);
    if (!reach[r][c]) return;
    const toBus = bus && bus.state === 'wait' && bus.color === v && bus.filled < CAP;
    const slot = bench.indexOf(null);
    if (!toBus && slot < 0) return;
    const path = pathOut(grid, r, c).map(([pr, pc]) => cellCenter(pr, pc));
    grid[r][c] = EMPTY;
    path.push({ x: path[path.length - 1].x, y: WALK_Y });
    if (toBus) {
      const seat = bus.filled++;
      const b = bus;
      path.push({ x: busSeatPos(seat, BUS_X).x, y: WALK_Y });
      path.push(busSeatPos(seat, BUS_X));
      walkTo(v, path, () => boarded(b));
    } else {
      bench[slot] = { color: v, here: false };
      const sp = seatPos(slot);
      path.push({ x: sp.x, y: WALK_Y });
      path.push(sp);
      walkTo(v, path, () => { if (bench[slot]) bench[slot].here = true; if (bus && bus.state === 'wait') autoBoard(); });
    }
  }

  function boarded(b) {
    b.arrived++;
    if (b.arrived >= CAP && b.state === 'wait') {
      b.state = 'depart';
    }
  }

  function autoBoard() {
    for (let i = 0; i < BENCH && bus.filled < CAP; i++) {
      const s = bench[i];
      if (s && s.here && s.color === bus.color) {
        bench[i] = null;
        const seat = bus.filled++;
        const b = bus, sp = seatPos(i), bp = busSeatPos(seat, BUS_X);
        walkTo(s.color, [sp, { x: sp.x, y: WALK_Y - 80 }, bp], () => boarded(b));
      }
    }
  }

  function startGame() {
    overlay.classList.add('hide');
    state = 'play';
    startStage();
  }

  // ---------- update ----------
  function update(dt) {
    const speed = 620 * dt;
    for (const w of walkers) {
      let move = speed;
      while (move > 0 && w.i < w.pts.length - 1) {
        const t = w.pts[w.i + 1], dx = t.x - w.x, dy = t.y - w.y, d = Math.hypot(dx, dy);
        if (d <= move) { w.x = t.x; w.y = t.y; w.i++; move -= d; }
        else { w.x += dx / d * move; w.y += dy / d * move; move = 0; }
      }
      if (w.i >= w.pts.length - 1 && !w.done) { w.done = true; w.onArrive(); }
    }
    walkers = walkers.filter(w => !w.done);
    if (bus) {
      if (bus.state === 'arrive') {
        bus.x += (BUS_X - bus.x) * Math.min(1, dt * 7) + 60 * dt;
        if (bus.x >= BUS_X) { bus.x = BUS_X; bus.state = 'wait'; autoBoard(); }
      } else if (bus.state === 'depart') {
        bus.x += 520 * dt;
        if (bus.x > W + 20) nextBus();
      }
    }
  }

  // ---------- draw ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function person(x, y, color, alpha = 1, s = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 16 * s, 13 * s, 4 * s, 0, 0, 7); ctx.fill();
    ctx.fillStyle = color;
    rr(x - 11 * s, y - 2 * s, 22 * s, 18 * s, 9 * s); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 10 * s, 8.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(x - 3 * s, y - 13 * s, 3 * s, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath(); ctx.arc(x - 3 * s, y - 9 * s, 1.4 * s, 0, 7); ctx.arc(x + 3 * s, y - 9 * s, 1.4 * s, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawBus(b) {
    const x = b.x, y = BUS_Y, col = PALETTE[b.color];
    ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(x + 4, y + 8, BUS_W, BUS_H, 14); ctx.fill();
    ctx.fillStyle = col; rr(x, y, BUS_W, BUS_H, 14); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(x, y + BUS_H - 16, BUS_W, 16, [0, 0, 14, 14]); ctx.fill();
    // front window
    ctx.fillStyle = '#cfefff'; rr(x + BUS_W - 30, y + 10, 22, 32, 6); ctx.fill();
    for (let i = 0; i < CAP; i++) {
      const p = busSeatPos(i, x);
      ctx.fillStyle = '#e8f7ff'; rr(p.x - 18, p.y - 20, 36, 32, 6); ctx.fill();
      if (i < b.arrived) person(p.x, p.y - 2, col, 1, 0.75);
    }
    ctx.fillStyle = '#222';
    [x + 38, x + BUS_W - 42].forEach(wx => { ctx.beginPath(); ctx.arc(wx, y + BUS_H, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(wx, y + BUS_H, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; });
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${b.arrived}/${CAP}`, x + 22, y + 62);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // road
    ctx.fillStyle = '#3b4250'; ctx.fillRect(0, 0, W, 100);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
    ctx.beginPath(); ctx.moveTo(0, 96); ctx.lineTo(W, 96); ctx.stroke(); ctx.setLineDash([]);
    // bus stop sign
    ctx.fillStyle = '#ddd'; ctx.fillRect(W - 44, 30, 4, 66);
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(W - 42, 30, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a2a00'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BUS', W - 42, 31);
    if (bus) drawBus(bus);
    // sidewalk / bench
    ctx.fillStyle = '#c9bfa8'; ctx.fillRect(0, 100, W, 102);
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let x = 0; x < W; x += 30) ctx.fillRect(x, 100, 1, 102);
    for (let i = 0; i < BENCH; i++) {
      const p = seatPos(i);
      ctx.fillStyle = '#8a5a34'; rr(p.x - 28, p.y + 4, 56, 14, 5); ctx.fill();
      ctx.fillStyle = '#a8703f'; rr(p.x - 28, p.y + 2, 56, 8, 4); ctx.fill();
      if (!bench[i]) { ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); rr(p.x - 20, p.y - 24, 40, 40, 10); ctx.stroke(); ctx.setLineDash([]); }
      else if (bench[i].here) person(p.x, p.y - 6, PALETTE[bench[i].color]);
    }
    const used = bench.filter(Boolean).length;
    ctx.fillStyle = used >= BENCH - 1 ? '#c0392b' : '#5b4630';
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`ベンチ ${used}/${BENCH}`, 8, 110);
    // plaza
    ctx.fillStyle = '#2f6b45'; rr(GX - 6, GY - 6, COLS * CELL + 12, rows * CELL + 12, 12); ctx.fill();
    const reach = state === 'title' ? null : reachableMap(grid);
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
      const x = GX + c * CELL, y = GY + r * CELL, v = grid[r] ? grid[r][c] : EMPTY;
      if (v === WALL) {
        ctx.fillStyle = '#245236'; rr(x + 3, y + 3, CELL - 6, CELL - 6, 10); ctx.fill();
        ctx.fillStyle = '#4caf6a'; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2 - 3, 15, 0, 7); ctx.fill();
        ctx.fillStyle = '#6fd08a'; ctx.beginPath(); ctx.arc(x + CELL / 2 - 5, y + CELL / 2 - 8, 6, 0, 7); ctx.fill();
        continue;
      }
      ctx.fillStyle = (r + c) % 2 ? '#3a7d52' : '#367549'; rr(x + 2, y + 2, CELL - 4, CELL - 4, 8); ctx.fill();
      if (v >= 0) {
        const ok = reach && reach[r][c];
        if (ok) { ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(x + 4, y + 4, CELL - 8, CELL - 8, 8); ctx.fill(); }
        person(x + CELL / 2, y + CELL / 2 + 2, PALETTE[v], ok ? 1 : 0.62);
      }
    }
    // exit arrows
    ctx.fillStyle = 'rgba(80,60,30,.35)';
    for (let c = 0; c < COLS; c++) { const x = GX + c * CELL + CELL / 2; ctx.beginPath(); ctx.moveTo(x, 190); ctx.lineTo(x - 6, 198); ctx.lineTo(x + 6, 198); ctx.fill(); }
    walkers.forEach(w => person(w.x, w.y, PALETTE[w.color]));
  }

  // ---------- sizing / input ----------
  function resize() {
    H = GY + rows * CELL + 22;
    const st = $('stage'), aw = st.clientWidth - 16, ah = st.clientHeight - 8;
    const s = Math.max(0.3, Math.min(aw / W, ah / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr); cv.height = Math.floor(H * s * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  }
  window.addEventListener('resize', resize);

  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W, y = (e.clientY - rect.top) / rect.height * H;
    tapCell(Math.floor((y - GY) / CELL), Math.floor((x - GX) / CELL));
  });
  startBtn.addEventListener('click', startGame);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state !== 'title') update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  resize();
  requestAnimationFrame(loop);
})();
