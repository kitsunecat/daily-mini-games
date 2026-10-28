(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const shuffleBtn = document.getElementById('shuffle');
  const shuffleLeftEl = document.getElementById('shuffle-left');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const stageNoEl = document.getElementById('stage-no');
  const toast = document.getElementById('toast');

  const BEST_KEY = 'tile-trio-best';
  const TRAY_SIZE = 7;
  const COLS = 6, ROWS = 7; // 1段目のマス数（座標は半マス単位）

  // 各段の候補位置（半マス単位、タイルは 2x2 を占める）
  const LAYER_SLOTS = [
    grid(0, 10, 0, 12),
    grid(1, 9, 1, 11),
    grid(2, 8, 2, 10),
    grid(3, 7, 3, 9),
  ];
  function grid(x0, x1, y0, y1) {
    const out = [];
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) out.push({ x, y });
    return out;
  }

  // 絵柄（色と描画関数）
  const TYPES = [
    { c: '#e5484d', draw: (r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); } },
    { c: '#f08c2b', draw: (r) => { poly(3, r * 1.15, -Math.PI / 2, 0.22 * r); } },
    { c: '#e8b500', draw: (r) => { star(5, r * 1.1, r * 0.48); } },
    { c: '#3aa45c', draw: (r) => { ctx.save(); ctx.rotate(-Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } },
    { c: '#2f7de1', draw: (r) => { poly(4, r * 1.15, -Math.PI / 2, 0); } },
    { c: '#9b5de5', draw: (r) => { heart(r); } },
    { c: '#e05fa8', draw: (r) => { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill(); } },
    { c: '#16a3a3', draw: (r) => { roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.3); ctx.fill(); } },
    { c: '#a0673a', draw: (r) => { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75, false); ctx.arc(r * 0.45, -r * 0.1, r * 0.75, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); ctx.fill(); } },
    { c: '#2c3e8f', draw: (r) => { const w = r * 0.62; ctx.fillRect(-w / 2, -r, w, r * 2); ctx.fillRect(-r, -w / 2, r * 2, w); } },
  ];
  function poly(n, r, rot, round) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i * Math.PI * 2 / n;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (round) { ctx.lineJoin = 'round'; ctx.lineWidth = round; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
    ctx.fill();
  }
  function star(n, ro, ri) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const r = i % 2 ? ri : ro;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  function heart(r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.4, 0, -r * 0.9, -r * 1.2, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.9, -r * 1.2, r * 1.4, 0, 0, r * 0.95);
    ctx.fill();
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

  // ---- 状態 ----
  let T = 50, W = 0, H = 0, PAD = 0, dpr = 1;
  let tiles = [];      // { x, y, layer, type, shake }
  let tray = [];       // { type, x, y, dieAt }
  let pops = [];       // { type, x, y, t }
  let state = 'title'; // title | play | over
  let stage = 1, score = 0, best = 0, combo = 0, lastMatch = 0, shuffles = 1;
  let endTimer = 0;

  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  // ---- 音 ----
  let audio = null;
  function beep(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* 音が出せない環境は無視 */ }
  }

  // ---- レイアウト ----
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 12;
    T = Math.max(20, Math.min(aw / 6.5, ah / 9.15));
    PAD = T * 0.25;
    W = Math.floor(T * 6.5); H = Math.floor(T * 9.15);
    dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  }
  const trayY = () => PAD + ROWS * T + T * 0.4;
  const slotW = () => (W - PAD * 2) / TRAY_SIZE;
  function tileCenter(t) {
    return { x: PAD + (t.x + 1) * T / 2, y: PAD + (t.y + 1) * T / 2 - t.layer * T * 0.07 };
  }
  function slotCenter(i) {
    return { x: PAD + slotW() * (i + 0.5), y: trayY() + T * 0.62 };
  }

  // ---- ステージ生成 ----
  const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
  function isBlocked(t) {
    for (const o of tiles) if (o.layer > t.layer && overlaps(o, t)) return true;
    return false;
  }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function buildStage(n) {
    const total = Math.min(27 + (n - 1) * 9, 66);
    const typeCount = Math.min(4 + n, TYPES.length);
    const ratios = [0.42, 0.3, 0.18, 0.1];
    const placed = [];
    let left = total;
    for (let L = 0; L < LAYER_SLOTS.length && left > 0; L++) {
      const want = L === LAYER_SLOTS.length - 1 ? left : Math.min(left, Math.round(total * ratios[L]));
      let cands = shuffled(LAYER_SLOTS[L]);
      if (L > 0) cands = cands.filter((s) => placed.some((p) => p.layer === L - 1 && overlaps(p, s)));
      const take = cands.slice(0, want);
      take.forEach((s) => placed.push({ x: s.x, y: s.y, layer: L, type: -1, shake: 0 }));
      left -= take.length;
    }
    // 端数は1段目から足りない分を補う
    if (left > 0) {
      const used = new Set(placed.filter((p) => p.layer === 0).map((p) => p.x + ',' + p.y));
      for (const s of shuffled(LAYER_SLOTS[0])) {
        if (left <= 0) break;
        if (!used.has(s.x + ',' + s.y)) { placed.push({ x: s.x, y: s.y, layer: 0, type: -1, shake: 0 }); left--; }
      }
    }
    // 数を3の倍数にそろえる
    while (placed.length % 3) placed.pop();
    tiles = placed;
    assignTypes(typeCount);
  }

  // 取れる順番を1つシミュレーションし、その順で3枚ずつ同じ絵柄を割り当てる（必ず解ける配置になる）
  function assignTypes(typeCount) {
    const rest = tiles.slice();
    const order = [];
    const saved = tiles;
    while (rest.length) {
      tiles = rest;
      const free = rest.filter((t) => !isBlocked(t));
      const pick = free[Math.random() * free.length | 0];
      order.push(pick);
      rest.splice(rest.indexOf(pick), 1);
    }
    tiles = saved;
    const triples = order.length / 3;
    const types = shuffled(Array.from({ length: triples }, (_, i) => i % typeCount));
    for (let i = 0; i < triples; i++) for (let k = 0; k < 3; k++) order[i * 3 + k].type = types[i];
  }

  // ---- 進行 ----
  function startGame() {
    stage = 1; score = 0; combo = 0;
    state = 'play';
    beginStage();
    overlay.classList.add('hidden');
    beep(520, 0.12, 'triangle'); beep(780, 0.16, 'triangle', 0.08);
  }
  function beginStage() {
    tray = []; pops = []; shuffles = 1;
    buildStage(stage);
    updateHud();
    showToast('STAGE ' + stage);
  }
  function updateHud() {
    scoreEl.textContent = score;
    stageNoEl.textContent = stage;
    shuffleLeftEl.textContent = shuffles;
    shuffleBtn.disabled = state !== 'play' || shuffles <= 0;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 保存できなくても続行 */ }
    }
  }
  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 900);
  }

  function pickTile(t) {
    const from = tileCenter(t);
    tiles.splice(tiles.indexOf(t), 1);
    // 同じ絵柄の後ろに差しこむ
    let idx = tray.length;
    for (let i = tray.length - 1; i >= 0; i--) if (tray[i].type === t.type && !tray[i].dieAt) { idx = i + 1; break; }
    tray.splice(idx, 0, { type: t.type, x: from.x, y: from.y, dieAt: 0 });
    beep(660 + Math.random() * 80, 0.07, 'square', 0.05);

    const same = tray.filter((it) => it.type === t.type && !it.dieAt);
    const now = performance.now();
    if (same.length >= 3) {
      same.slice(0, 3).forEach((it) => { it.dieAt = now + 200; });
      combo = now - lastMatch < 2500 ? combo + 1 : 1;
      lastMatch = now;
      score += 100 * combo;
      if (combo >= 2) showToast(combo + ' COMBO!');
      setTimeout(() => { beep(880, 0.1, 'triangle', 0.1); beep(1320, 0.18, 'triangle', 0.07); }, 180);
    }
    updateHud();

    const alive = tray.filter((it) => !it.dieAt).length;
    if (alive >= TRAY_SIZE) {
      state = 'ending';
      endTimer = setTimeout(gameOver, 500);
    } else if (tiles.length === 0) {
      state = 'ending';
      endTimer = setTimeout(stageClear, 600);
    }
  }

  function stageClear() {
    score += 300 * stage;
    stage++;
    state = 'play';
    beep(523, 0.12, 'triangle'); setTimeout(() => beep(659, 0.12, 'triangle'), 110); setTimeout(() => beep(784, 0.25, 'triangle'), 220);
    beginStage();
    showToast('CLEAR! +' + 300 * (stage - 1));
    setTimeout(() => showToast('STAGE ' + stage), 1000);
  }

  function gameOver() {
    state = 'over';
    updateHud();
    beep(330, 0.35, 'sawtooth', 0.08, 0.5);
    ovTitle.textContent = 'トレイがいっぱい！';
    ovText.innerHTML = 'ステージ ' + stage + ' まで進みました<br>スコア <b>' + score + '</b>（ベスト ' + best + '）';
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hidden');
  }

  function doShuffle() {
    if (state !== 'play' || shuffles <= 0 || tiles.length === 0) return;
    shuffles--;
    const types = shuffled(tiles.map((t) => t.type));
    tiles.forEach((t, i) => { t.type = types[i]; t.shake = 1; });
    beep(400, 0.25, 'triangle', 0.08, 2);
    updateHud();
  }

  // ---- 入力 ----
  function hitTest(px, py) {
    let hit = null;
    for (const t of tiles) {
      const c = tileCenter(t);
      if (Math.abs(px - c.x) <= T / 2 && Math.abs(py - c.y) <= T / 2) {
        if (!hit || t.layer > hit.layer) hit = t;
      }
    }
    return hit;
  }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'play') return;
    const r = cv.getBoundingClientRect();
    const t = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (!t) return;
    if (isBlocked(t)) { t.shake = 1; beep(160, 0.08, 'square', 0.04); return; }
    pickTile(t);
  });
  startBtn.addEventListener('click', startGame);
  shuffleBtn.addEventListener('click', doShuffle);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (state === 'title' || state === 'over')) startGame();
    else if (e.key === 's' || e.key === 'S') doShuffle();
  });
  window.addEventListener('resize', resize);

  // ---- 描画 ----
  function drawTile(cx, cy, size, type, dim) {
    const s = size * 0.94;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    roundRect(-s / 2, -s / 2 + size * 0.07, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = '#c9b48a';
    roundRect(-s / 2, -s / 2 + size * 0.035, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = '#fff8e8';
    roundRect(-s / 2, -s / 2, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = TYPES[type].c;
    TYPES[type].draw(s * 0.28);
    if (dim) {
      ctx.fillStyle = 'rgba(20,40,38,.5)';
      roundRect(-s / 2, -s / 2, s, s + size * 0.035, s * 0.18); ctx.fill();
    }
    ctx.restore();
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 盤面
    const order = tiles.slice().sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x);
    for (const t of order) {
      const c = tileCenter(t);
      let dx = 0;
      if (t.shake > 0) { dx = Math.sin(t.shake * 30) * T * 0.06 * t.shake; t.shake = Math.max(0, t.shake - 0.06); }
      drawTile(c.x + dx, c.y, T, t.type, isBlocked(t));
    }

    // トレイ
    const ty = trayY();
    ctx.fillStyle = '#0c2422';
    roundRect(PAD * 0.6, ty, W - PAD * 1.2, T * 1.25, T * 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < TRAY_SIZE; i++) {
      const c = slotCenter(i);
      roundRect(c.x - slotW() * 0.44, c.y - slotW() * 0.44, slotW() * 0.88, slotW() * 0.88, T * 0.12); ctx.fill();
    }
    const alive = tray.filter((it) => !it.dieAt).length;
    if (alive >= TRAY_SIZE - 2 && state === 'play') {
      ctx.strokeStyle = 'rgba(255,90,90,' + (0.5 + 0.4 * Math.sin(now / 120)) + ')';
      ctx.lineWidth = 3;
      roundRect(PAD * 0.6, ty, W - PAD * 1.2, T * 1.25, T * 0.25); ctx.stroke();
    }

    // 消える組をはずしてポップへ
    for (let i = tray.length - 1; i >= 0; i--) {
      const it = tray[i];
      if (it.dieAt && now >= it.dieAt) { pops.push({ type: it.type, x: it.x, y: it.y, t: 0 }); tray.splice(i, 1); }
    }
    const sw = slotW();
    tray.forEach((it, i) => {
      const c = slotCenter(i);
      it.x += (c.x - it.x) * 0.3;
      it.y += (c.y - it.y) * 0.3;
      drawTile(it.x, it.y, sw * 0.95, it.type, false);
    });

    // ポップ演出
    pops = pops.filter((p) => p.t < 1);
    for (const p of pops) {
      p.t += 0.06;
      ctx.save();
      ctx.globalAlpha = 1 - p.t;
      ctx.translate(p.x, p.y);
      ctx.scale(1 + p.t * 0.6, 1 + p.t * 0.6);
      drawTile(0, 0, sw * 0.95, p.type, false);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = '#ffe27a';
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * sw * p.t, p.y + Math.sin(a) * sw * p.t, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  // タイトル画面の背景にも盤面を見せる
  resize();
  buildStage(1);
  updateHud();
  requestAnimationFrame(render);
})();
