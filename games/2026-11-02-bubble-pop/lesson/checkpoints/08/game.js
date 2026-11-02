(() => {
  'use strict';
  const W = 360, H = 600, R = 20, D = R * 2, COLS = 9;
  const RH = R * Math.sqrt(3);
  const DEAD_ROW = 13;                       // 14段目に入ったらアウト
  const DEAD_Y = R + DEAD_ROW * RH + R + 2;
  const SX = W / 2, SY = H - 46;             // 発射台
  const NX = SX - 70, NY = H - 30;           // 次のあわ
  const SPEED = 900;                         // px/s
  const COLORS = [
    { c: '#ff5f7e', g: 'heart' },
    { c: '#ffc94a', g: 'star' },
    { c: '#4fd6a0', g: 'leaf' },
    { c: '#5ab0ff', g: 'drop' },
    { c: '#b98cff', g: 'moon' },
    { c: '#ff9a4a', g: 'dot' },
  ];
  const BEST_KEY = 'bubble-pop-best';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), shotsEl = $('shots');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), toast = $('toast');

  let rows, cur, next, shot, angle, score, best = 0, misses, shotsPerRow, numColors, running = false;
  let particles = [], aiming = false, lastT = 0, shake = 0, totalShots = 0;

  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  // ---------- グリッド ----------
  const rowLen = (row) => (row.off ? COLS - 1 : COLS);
  const cellX = (row, c) => R + c * D + (row.off ? R : 0);
  const cellY = (r) => R + r * RH;

  function makeRow(off, fill) {
    const row = { off, cells: [] };
    for (let c = 0; c < rowLen(row); c++) row.cells.push(fill ? randColor() : -1);
    return row;
  }
  function randColor() { return Math.floor(Math.random() * numColors); }

  function ensureRow(r) {
    while (rows.length <= r) rows.push(makeRow(rows.length ? !rows[rows.length - 1].off : false, false));
  }
  function neighbors(r, c) {
    const row = rows[r];
    const list = [[r, c - 1], [r, c + 1]];
    const d = row.off ? [c, c + 1] : [c - 1, c];
    for (const rr of [r - 1, r + 1]) for (const cc of d) list.push([rr, cc]);
    return list.filter(([rr, cc]) => rr >= 0 && rr < rows.length && cc >= 0 && cc < rowLen(rows[rr]));
  }

  function fillStart() {
    rows = [];
    for (let r = 0; r < 7; r++) {
      const row = makeRow(r % 2 === 1, false);
      for (let c = 0; c < rowLen(row); c++) {
        // 近くの色を引きつぐと塊ができて遊びやすい
        let col = randColor();
        if (Math.random() < 0.3 && c > 0) col = row.cells[c - 1];
        else if (Math.random() < 0.25 && r > 0) col = rows[r - 1].cells[Math.min(c, rowLen(rows[r - 1]) - 1)];
        row.cells[c] = col;
      }
      rows.push(row);
    }
  }

  function pushRow() {
    const off = rows.length ? !rows[0].off : false;
    const row = makeRow(off, true);
    for (let c = 1; c < row.cells.length; c++) if (Math.random() < 0.4) row.cells[c] = row.cells[c - 1];
    rows.unshift(row);
    shake = 0.25;
  }

  function colorsOnBoard() {
    const s = new Set();
    for (const row of rows) for (const v of row.cells) if (v >= 0) s.add(v);
    return [...s];
  }
  function pickColor() {
    const on = colorsOnBoard();
    if (!on.length) return randColor();
    return on[Math.floor(Math.random() * on.length)];
  }
  function trimRows() { while (rows.length && rows[rows.length - 1].cells.every((v) => v < 0)) rows.pop(); }

  // ---------- 進行 ----------
  function start() {
    score = 0; misses = 0; shotsPerRow = 6; numColors = 4; totalShots = 0;
    particles = []; shot = null; angle = -Math.PI / 2;
    fillStart();
    cur = pickColor(); next = pickColor();
    running = true;
    overlay.classList.add('hide');
    updateHud();
  }

  function gameOver() {
    running = false; shot = null;
    let msg = `スコア ${score}`;
    if (score > best) {
      best = score; msg += '<br>ハイスコア更新！';
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    bestEl.textContent = best;
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = msg;
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hide');
    beep(180, 0.4, 'sawtooth');
  }

  function updateHud() {
    scoreEl.textContent = score;
    let h = '';
    for (let i = 0; i < shotsPerRow; i++) h += `<i class="${i < shotsPerRow - misses ? '' : 'used'}"></i>`;
    shotsEl.innerHTML = h;
  }

  let toastTimer = 0;
  function showToast(t) {
    toast.textContent = t; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 900);
  }

  function fire() {
    if (!running || shot) return;
    shot = { x: SX, y: SY, vx: Math.cos(angle) * SPEED, vy: Math.sin(angle) * SPEED, col: cur };
    cur = next; next = pickColor();
    totalShots++;
    beep(520, 0.06, 'triangle');
  }

  function swap() {
    if (!running || shot) return;
    [cur, next] = [next, cur];
    beep(700, 0.05, 'sine');
  }

  function collides(x, y) {
    if (y <= R) return true;
    const r0 = Math.max(0, Math.floor((y - R) / RH) - 1);
    for (let r = r0; r < Math.min(rows.length, r0 + 3); r++) {
      const row = rows[r];
      for (let c = 0; c < row.cells.length; c++) {
        if (row.cells[c] < 0) continue;
        const dx = cellX(row, c) - x, dy = cellY(r) - y;
        if (dx * dx + dy * dy < (D * 0.86) ** 2) return true;
      }
    }
    return false;
  }

  function snap(x, y, col) {
    let r = Math.max(0, Math.round((y - R) / RH));
    ensureRow(r + 1);
    // 近くの空きセルの中から一番近いものを選ぶ
    let bestCell = null, bd = Infinity;
    for (let rr = Math.max(0, r - 1); rr <= r + 1; rr++) {
      const row = rows[rr];
      for (let c = 0; c < row.cells.length; c++) {
        if (row.cells[c] >= 0) continue;
        const attached = rr === 0 || neighbors(rr, c).some(([a, b]) => rows[a].cells[b] >= 0);
        if (!attached) continue;
        const dx = cellX(row, c) - x, dy = cellY(rr) - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bestCell = [rr, c]; }
      }
    }
    if (!bestCell) bestCell = [r, Math.max(0, Math.min(rowLen(rows[r]) - 1, Math.round((x - R - (rows[r].off ? R : 0)) / D)))];
    const [sr, sc] = bestCell;
    rows[sr].cells[sc] = col;
    resolve(sr, sc, col);
  }

  function resolve(r, c, col) {
    // 同じ色の塊
    const group = [[r, c]], seen = new Set([r + ',' + c]);
    for (let i = 0; i < group.length; i++) {
      for (const [a, b] of neighbors(group[i][0], group[i][1])) {
        const k = a + ',' + b;
        if (!seen.has(k) && rows[a].cells[b] === col) { seen.add(k); group.push([a, b]); }
      }
    }
    let popped = 0, dropped = 0;
    if (group.length >= 3) {
      for (const [a, b] of group) {
        burst(cellX(rows[a], b), cellY(a), rows[a].cells[b]);
        rows[a].cells[b] = -1; popped++;
      }
      // 天井につながっていないあわを落とす
      const keep = new Set(), q = [];
      if (rows.length) rows[0].cells.forEach((v, i) => { if (v >= 0) { keep.add('0,' + i); q.push([0, i]); } });
      for (let i = 0; i < q.length; i++) {
        for (const [a, b] of neighbors(q[i][0], q[i][1])) {
          const k = a + ',' + b;
          if (!keep.has(k) && rows[a].cells[b] >= 0) { keep.add(k); q.push([a, b]); }
        }
      }
      rows.forEach((row, a) => row.cells.forEach((v, b) => {
        if (v >= 0 && !keep.has(a + ',' + b)) {
          particles.push({ x: cellX(row, b), y: cellY(a), vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, col: v, life: 2, fall: true });
          row.cells[b] = -1; dropped++;
        }
      }));
      const gain = popped * 10 + dropped * 20 * (dropped >= 5 ? 2 : 1);
      score += gain;
      beep(660 + Math.min(popped + dropped, 12) * 40, 0.12, 'sine');
      if (dropped >= 3) showToast(`${dropped}こ落とした！ +${gain}`);
      else if (popped >= 6) showToast(`ナイス！ +${gain}`);
    } else {
      misses++;
      beep(300, 0.05, 'square');
    }
    trimRows();

    // すべて消えたらボーナス
    if (!rows.length) {
      score += 500;
      showToast('ぜんぶ消した！ +500');
      for (let i = 0; i < 4; i++) pushRow();
      misses = 0;
    }

    if (misses >= shotsPerRow) {
      pushRow();
      misses = 0;
    }
    // 難易度
    numColors = Math.min(COLORS.length, 4 + Math.floor(score / 1500));
    shotsPerRow = Math.max(3, 6 - Math.floor(totalShots / 40));
    misses = Math.min(misses, shotsPerRow - 1);

    // 手持ちの色が盤面から消えていたら入れかえる
    const on = colorsOnBoard();
    if (on.length) {
      if (!on.includes(cur)) cur = pickColor();
      if (!on.includes(next)) next = pickColor();
    }
    updateHud();
    for (let a = DEAD_ROW + 1; a < rows.length; a++) {
      if (rows[a].cells.some((v) => v >= 0)) { gameOver(); return; }
    }
  }

  function burst(x, y, col) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: 0.45, spark: true });
    }
  }

  // ---------- 更新 ----------
  function update(dt) {
    if (shot) {
      const steps = Math.ceil((SPEED * dt) / 6);
      for (let i = 0; i < steps && shot; i++) {
        shot.x += (shot.vx * dt) / steps;
        shot.y += (shot.vy * dt) / steps;
        if (shot.x < R) { shot.x = R; shot.vx = Math.abs(shot.vx); }
        if (shot.x > W - R) { shot.x = W - R; shot.vx = -Math.abs(shot.vx); }
        if (collides(shot.x, shot.y)) { const s = shot; shot = null; snap(s.x, s.y, s.col); }
      }
    }
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.fall) p.vy += 900 * dt; else { p.vx *= 0.92; p.vy *= 0.92; }
    }
    particles = particles.filter((p) => p.life > 0 && p.y < H + 40);
    if (shake > 0) shake -= dt;
  }

  // ---------- 描画 ----------
  function drawGlyph(x, y, g, s) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    switch (g) {
      case 'heart':
        ctx.moveTo(x, y + s * 0.6);
        ctx.bezierCurveTo(x - s * 1.2, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.35);
        ctx.bezierCurveTo(x + s * 0.5, y - s, x + s * 1.2, y - s * 0.2, x, y + s * 0.6);
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.4 : s * 0.9;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        break;
      case 'leaf':
        ctx.ellipse(x, y, s * 0.45, s * 0.85, Math.PI / 4, 0, Math.PI * 2);
        break;
      case 'drop':
        ctx.moveTo(x, y - s * 0.9);
        ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.1, x, y + s * 0.7);
        ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.1, x, y - s * 0.9);
        break;
      case 'moon':
        ctx.arc(x, y, s * 0.75, Math.PI * 0.3, Math.PI * 1.7);
        ctx.arc(x + s * 0.35, y, s * 0.55, Math.PI * 1.6, Math.PI * 0.4, true);
        break;
      default:
        ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawBubble(x, y, col, rad = R - 1, alpha = 1) {
    const k = COLORS[col];
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.25, k.c);
    g.addColorStop(1, shade(k.c));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    drawGlyph(x + rad * 0.1, y + rad * 0.12, k.g, rad * 0.42);
    ctx.globalAlpha = 1;
  }
  const shadeCache = {};
  function shade(hex) {
    if (shadeCache[hex]) return shadeCache[hex];
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.floor(v * 0.55);
    return (shadeCache[hex] = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`);
  }

  function drawGuide() {
    if (shot || !running) return;
    let x = SX, y = SY, vx = Math.cos(angle), vy = Math.sin(angle);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    let dist = 0;
    for (let i = 0; i < 260 && dist < 900; i++) {
      x += vx * 5; y += vy * 5; dist += 5;
      if (x < R) { x = R; vx = -vx; }
      if (x > W - R) { x = W - R; vx = -vx; }
      if (collides(x, y)) break;
      if (i % 4 === 0) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate(0, Math.sin(shake * 60) * 3);

    // デッドライン
    ctx.strokeStyle = 'rgba(255,95,126,.55)';
    ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, DEAD_Y); ctx.lineTo(W, DEAD_Y); ctx.stroke();
    ctx.setLineDash([]);

    if (rows) rows.forEach((row, r) => row.cells.forEach((v, c) => { if (v >= 0) drawBubble(cellX(row, c), cellY(r), v); }));

    drawGuide();

    // 発射台
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(SX, SY, R + 10, 0, Math.PI * 2); ctx.fill();
    if (cur != null) drawBubble(SX, SY, cur);
    if (next != null) {
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('つぎ', NX, NY - 20);
      drawBubble(NX, NY, next, R * 0.7);
      ctx.fillText('⇄ タップで入れかえ', SX + 82, SY + 30);
    }
    if (shot) drawBubble(shot.x, shot.y, shot.col);

    for (const p of particles) {
      if (p.spark) {
        ctx.globalAlpha = Math.max(0, p.life / 0.45);
        ctx.fillStyle = COLORS[p.col].c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else drawBubble(p.x, p.y, p.col, R - 1, 0.9);
    }
    ctx.restore();
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;
    if (running || particles.length) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- 入力 ----------
  function toLocal(e) {
    const rect = cv.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }
  function aimAt(p) {
    let a = Math.atan2(p.y - SY, p.x - SX);
    if (a > 0) a = p.x < SX ? -Math.PI + 0.12 : -0.12;    // 下側をさしたら端に寄せる
    angle = Math.max(-Math.PI + 0.12, Math.min(-0.12, a));
  }
  const onSwapZone = (p) => Math.hypot(p.x - SX, p.y - SY) < R + 12 || Math.hypot(p.x - NX, p.y - NY) < R + 6;

  cv.addEventListener('pointerdown', (e) => {
    if (!running) return;
    e.preventDefault();
    ensureAudio();
    const p = toLocal(e);
    if (onSwapZone(p)) { swap(); aiming = false; return; }
    aiming = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    aimAt(p);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!running) return;
    const p = toLocal(e);
    if (aiming || e.pointerType === 'mouse') { if (p.y < SY - 10 || aiming) aimAt(p); }
  });
  const release = (e) => {
    if (!aiming) return;
    aiming = false;
    aimAt(toLocal(e));
    fire();
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => { aiming = false; });

  window.addEventListener('keydown', (e) => {
    if (!running) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ensureAudio(); start(); }
      return;
    }
    if (e.key === 'ArrowLeft') { angle = Math.max(-Math.PI + 0.12, angle - 0.05); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { angle = Math.min(-0.12, angle + 0.05); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') { fire(); e.preventDefault(); }
    else if (e.key === 'x' || e.key === 'X' || e.key === 'Shift') swap();
  });

  startBtn.addEventListener('click', () => { ensureAudio(); start(); });

  // ---------- 音 ----------
  let ac = null;
  function ensureAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }
  function beep(freq, dur, type) {
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // タイトル画面用に盤面を用意しておく
  numColors = 4; fillStart(); cur = 0; next = 1; angle = -Math.PI / 2; misses = 0; shotsPerRow = 6; score = 0;
  updateHud();
  requestAnimationFrame(loop);
})();
