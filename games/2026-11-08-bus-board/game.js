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

  let best = 0;
  try { best = parseInt(localStorage.getItem('busBoardBest') || '0', 10) || 0; } catch (e) {}
  $('best').textContent = best;

  let state = 'title';
  let level = 1, score = 0, rows = 5;
  let grid = [], bench = [], queue = [], bus = null, walkers = [], pops = [];
  let cursor = { r: 0, c: 0, show: false }, banner = null, shake = 0;

  // ---------- audio ----------
  let ac = null;
  function beep(f, d = 0.08, type = 'sine', v = 0.12) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(v, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + d);
    } catch (e) {}
  }

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

  // greedy solver used to make sure a generated stage is clearable
  function solvable(g0, buses) {
    const g = g0.map(r => r.slice());
    let b = [], bi = 0, filled = 0;
    const left = () => g.some(r => r.some(v => v >= 0));
    let guard = 0;
    while (bi < buses.length && guard++ < 999) {
      const col = buses[bi];
      // bench to bus
      for (let i = 0; i < b.length && filled < CAP; i++) if (b[i] === col) { b.splice(i, 1); i--; filled++; }
      if (filled === CAP) { bi++; filled = 0; continue; }
      if (!left()) return false;
      const reach = reachableMap(g);
      let pick = null, pickScore = Infinity;
      for (let r = 0; r < g.length; r++) for (let c = 0; c < COLS; c++) {
        if (!reach[r][c]) continue;
        const v = g[r][c];
        let s = v === col ? -1 : buses.indexOf(v, bi);
        if (s < 0 && v !== col) s = 999;
        if (s < pickScore) { pickScore = s; pick = [r, c]; }
      }
      if (!pick) return false;
      const v = g[pick[0]][pick[1]]; g[pick[0]][pick[1]] = EMPTY;
      if (v === col) filled++; else { if (b.length >= BENCH) return false; b.push(v); }
      if (b.length >= BENCH && filled < CAP && !b.includes(col)) {
        const reach2 = reachableMap(g);
        if (!g.some((row, r) => row.some((x, c) => x === col && reach2[r][c]))) return false;
      }
    }
    return bi >= buses.length;
  }

  function generate(L) {
    rows = Math.min(4 + L, 8);
    const nColors = Math.min(2 + L, 7);
    for (let tries = 0; tries < 80; tries++) {
      const g = Array.from({ length: rows }, () => Array(COLS).fill(EMPTY));
      const nWalls = L < 2 ? 0 : Math.min(1 + Math.floor(L / 2), 6);
      for (let i = 0; i < nWalls; i++) g[1 + rnd(rows - 1)][rnd(COLS)] = WALL;
      // distance from top through non-wall cells
      const dist = g.map(row => row.map(() => Infinity)), q = [];
      for (let c = 0; c < COLS; c++) if (g[0][c] !== WALL) { dist[0][c] = 0; q.push([0, c]); }
      while (q.length) {
        const [r, c] = q.shift();
        for (const [dr, dc] of DIRS) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= COLS || g[nr][nc] === WALL || dist[nr][nc] !== Infinity) continue;
          dist[nr][nc] = dist[r][c] + 1; q.push([nr, nc]);
        }
      }
      const cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
        if (g[r][c] === WALL) continue;
        if (dist[r][c] === Infinity) { g[r][c] = WALL; continue; }
        cells.push({ r, c, d: dist[r][c] + Math.random() * 2.2 });
      }
      cells.sort((a, b) => a.d - b.d);
      const n = Math.floor(cells.length / 3) * 3;
      const busCount = n / 3;
      const buses = [];
      for (let i = 0; i < busCount; i++) buses.push(i % nColors);
      shuffle(buses);
      const seq = buses.flatMap(c => [c, c, c]);
      const win = Math.min(5 + L, 12);
      for (let i = 0; i < seq.length; i++) {
        const j = i + rnd(Math.min(win, seq.length - i));
        [seq[i], seq[j]] = [seq[j], seq[i]];
      }
      for (let i = 0; i < n; i++) g[cells[i].r][cells[i].c] = seq[i];
      if (solvable(g, buses)) return { g, buses };
    }
    // fallback: no mixing at all
    const g = Array.from({ length: rows }, () => Array(COLS).fill(EMPTY));
    const total = Math.floor(rows * COLS / 3) * 3, buses = [];
    for (let i = 0; i < total / 3; i++) buses.push(i % nColors);
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (k < total) { g[r][c] = buses[Math.floor(k / 3)]; k++; }
    return { g, buses };
  }

  // ---------- game flow ----------
  function startStage() {
    const s = generate(level);
    grid = s.g; queue = s.buses.slice();
    bench = Array(BENCH).fill(null);
    walkers = []; pops = [];
    bus = null;
    nextBus();
    cursor = { r: 0, c: 0, show: cursor.show };
    resize();
    $('stage-no').textContent = level;
    banner = { text: 'STAGE ' + level, t: 1.2 };
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
  function addScore(v, x, y) {
    score += v; $('score').textContent = score;
    if (x !== undefined) pops.push({ text: '+' + v, x, y, t: 0.8 });
    if (score > best) {
      best = score; $('best').textContent = best;
      try { localStorage.setItem('busBoardBest', String(best)); } catch (e) {}
    }
  }

  function walkTo(color, pts, onArrive) {
    walkers.push({ color, pts, i: 0, x: pts[0].x, y: pts[0].y, onArrive });
  }

  function tapCell(r, c) {
    if (state !== 'play' || r < 0 || r >= rows || c < 0 || c >= COLS) return;
    const v = grid[r][c];
    if (v < 0) return;
    const reach = reachableMap(grid);
    if (!reach[r][c]) { beep(140, 0.12, 'square', 0.06); shake = 0.25; return; }
    const toBus = bus && bus.state === 'wait' && bus.color === v && bus.filled < CAP;
    const slot = bench.indexOf(null);
    if (!toBus && slot < 0) { beep(140, 0.12, 'square', 0.06); return; }
    const path = pathOut(grid, r, c).map(([pr, pc]) => cellCenter(pr, pc));
    grid[r][c] = EMPTY;
    path.push({ x: path[path.length - 1].x, y: WALK_Y });
    if (toBus) {
      const seat = bus.filled++;
      const b = bus;
      path.push({ x: busSeatPos(seat, BUS_X).x, y: WALK_Y });
      path.push(busSeatPos(seat, BUS_X));
      walkTo(v, path, () => boarded(b));
      beep(520 + seat * 120, 0.08);
    } else {
      bench[slot] = { color: v, here: false };
      const sp = seatPos(slot);
      path.push({ x: sp.x, y: WALK_Y });
      path.push(sp);
      walkTo(v, path, () => { if (bench[slot]) bench[slot].here = true; if (bus && bus.state === 'wait') autoBoard(); });
      beep(330, 0.07, 'triangle');
    }
  }

  function boarded(b) {
    b.arrived++;
    const p = busSeatPos(b.arrived - 1, b.x);
    addScore(10, p.x, p.y - 20);
    if (b.arrived >= CAP && b.state === 'wait') {
      b.state = 'depart';
      addScore(30, b.x + BUS_W / 2, BUS_Y + 10);
      beep(660, 0.1); setTimeout(() => beep(880, 0.14), 90);
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

  function checkEnd() {
    if (state !== 'play' || walkers.length) return;
    if (!bus) {
      if (!queue.length) {
        state = 'clear';
        addScore(100 * level, W / 2, 120);
        banner = { text: 'STAGE CLEAR!', t: 1.6 };
        beep(660, 0.12); setTimeout(() => beep(880, 0.12), 120); setTimeout(() => beep(1100, 0.2), 240);
        setTimeout(() => { if (state === 'clear') { level++; state = 'play'; startStage(); } }, 1600);
      }
      return;
    }
    if (bus.state !== 'wait') return;
    if (bench.some(s => s && !s.here)) return;
    const full = bench.every(s => s);
    if (!full || bus.filled >= CAP) return;
    if (bench.some(s => s.color === bus.color)) return;
    const reach = reachableMap(grid);
    const can = grid.some((row, r) => row.some((v, c) => v === bus.color && reach[r][c]));
    if (!can) gameOver();
  }

  function gameOver() {
    state = 'over';
    beep(220, 0.25, 'sawtooth', 0.08); setTimeout(() => beep(160, 0.35, 'sawtooth', 0.08), 200);
    setTimeout(() => {
      ovTitle.textContent = 'ゲームオーバー';
      ovText.innerHTML = `ベンチが満席で、もう誰も乗れない…<br>ステージ <b class="hl">${level}</b> ・ スコア <b class="hl">${score}</b><br>ベスト ${best}`;
      startBtn.textContent = 'もう一度';
      overlay.classList.remove('hide');
    }, 700);
  }

  function startGame() {
    overlay.classList.add('hide');
    level = 1; score = 0; $('score').textContent = 0;
    state = 'play';
    startStage();
    beep(440, 0.05);
  }

  // ---------- update ----------
  function update(dt) {
    if (shake > 0) shake -= dt;
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    pops.forEach(p => { p.t -= dt; p.y -= 30 * dt; }); pops = pops.filter(p => p.t > 0);
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
        if (bus.x >= BUS_X) { bus.x = BUS_X; bus.state = 'wait'; beep(300, 0.06, 'triangle'); autoBoard(); }
      } else if (bus.state === 'depart') {
        bus.x += 520 * dt;
        if (bus.x > W + 20) nextBus();
      }
    }
    checkEnd();
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
    const ox = shake > 0 ? Math.sin(shake * 80) * 3 : 0;
    ctx.save(); ctx.translate(ox, 0);
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
    if (cursor.show && state === 'play') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      rr(GX + cursor.c * CELL + 2, GY + cursor.r * CELL + 2, CELL - 4, CELL - 4, 9); ctx.stroke();
    }
    ctx.restore();
    // exit arrows
    ctx.fillStyle = 'rgba(80,60,30,.35)';
    for (let c = 0; c < COLS; c++) { const x = GX + c * CELL + CELL / 2; ctx.beginPath(); ctx.moveTo(x, 190); ctx.lineTo(x - 6, 198); ctx.lineTo(x + 6, 198); ctx.fill(); }
    walkers.forEach(w => person(w.x, w.y, PALETTE[w.color]));
    ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3; ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y); });
    ctx.globalAlpha = 1;
    if (banner) {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, GY + rows * CELL / 2 - 30, W, 60);
      ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(banner.text, W / 2, GY + rows * CELL / 2 + 1);
      ctx.globalAlpha = 1;
    }
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
    cursor.show = false;
    tapCell(Math.floor((y - GY) / CELL), Math.floor((x - GX) / CELL));
  });
  window.addEventListener('keydown', e => {
    if (state === 'title' || state === 'over') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); }
      return;
    }
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (mv) {
      e.preventDefault(); cursor.show = true;
      cursor.r = Math.max(0, Math.min(rows - 1, cursor.r + mv[0]));
      cursor.c = Math.max(0, Math.min(COLS - 1, cursor.c + mv[1]));
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); cursor.show = true; tapCell(cursor.r, cursor.c);
    }
  });
  startBtn.addEventListener('click', startGame);

  // title backdrop
  const demo = generate(2); grid = demo.g; queue = demo.buses.slice(1);
  bench = Array(BENCH).fill(null); bus = { color: demo.buses[0], filled: 0, arrived: 0, x: BUS_X, state: 'wait' };
  updateNext();

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
