(() => {
  'use strict';

  // ---- 定数 ----
  const W = 360, H = 640;              // 論理サイズ
  const BOX_Y = 14, BOX_H = 64;        // 箱エリア
  const TRAY_Y = 96, TRAY_H = 44;      // トレイ
  const TRAY_SIZE = 5;
  const BOARD = { x: 14, y: 156, w: W - 28, h: H - 170 };
  const SR = 11;                       // ねじ半径
  const PLANK_W = 34;
  const BEST_KEY = 'daily-mini-games:screw-sort:best';
  const COLORS = [
    { name: 'red', c: '#ff5a5f', d: '#b8282d' },
    { name: 'blue', c: '#4ea8ff', d: '#1d64b5' },
    { name: 'yellow', c: '#ffd23f', d: '#b8901a' },
    { name: 'green', c: '#5ad17a', d: '#24863f' },
    { name: 'purple', c: '#b07cff', d: '#6a3cc0' },
    { name: 'orange', c: '#ff9a3c', d: '#b8601a' },
    { name: 'pink', c: '#ff7ac8', d: '#b83a86' },
  ];
  const WOODS = ['#e8b97a', '#d9a066', '#f0c992', '#cf9a5f', '#e3ad73'];

  // ---- DOM ----
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const levelEl = document.getElementById('level');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  let scale = 1;
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const availW = Math.max(100, r.width - 16), availH = Math.max(100, r.height - 8);
    scale = Math.min(availW / W, availH / H);
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ---- 保存 ----
  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  function saveBest() {
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    bestEl.textContent = best;
  }
  bestEl.textContent = best;

  // ---- 音 ----
  let ac = null;
  function beep(freq, dur, type, vol) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (e) { /* ignore */ }
  }

  // ---- 状態 ----
  let state = 'title';     // title | play | clear | over
  let level = 1, score = 0;
  let planks = [];         // {cx,cy,len,ang,layer,color,screws:[], falling, vy, vr, alpha}
  let screws = [];         // {x,y,plank,color,where:'board'|'fly'|'box'|'tray', ...}
  let boxQueue = [];       // 色インデックスの列
  let boxes = [];          // 表示中の箱 {color, filled, leaving, t, slotScrews:[]}
  let tray = [];           // 長さ TRAY_SIZE、screw or null
  let flyers = [];         // 飛んでいるねじ
  let particles = [];
  let popups = [];
  let shake = null;        // {screw, t}
  let combo = 0, comboT = 0;
  let stateT = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 板の上の点の座標
  function plankPoint(p, t) {
    return { x: p.cx + Math.cos(p.ang) * t, y: p.cy + Math.sin(p.ang) * t };
  }
  function inPlank(p, x, y, pad) {
    const dx = x - p.cx, dy = y - p.cy;
    const c = Math.cos(-p.ang), s = Math.sin(-p.ang);
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) <= p.len / 2 + pad && Math.abs(ly) <= PLANK_W / 2 + pad;
  }

  // ---- レベル生成 ----
  function genLevel() {
    planks = []; screws = []; flyers = []; particles = []; popups = [];
    tray = new Array(TRAY_SIZE).fill(null);
    const nColors = Math.min(3 + Math.floor((level - 1) / 2), COLORS.length);
    const nPlanks = Math.min(4 + Math.floor(level * 1.5), 15);
    const angles = [0, Math.PI / 2, Math.PI / 6, -Math.PI / 6, Math.PI / 4, -Math.PI / 4, Math.PI / 3, -Math.PI / 3];
    const allPts = [];
    let tries = 0;
    while (planks.length < nPlanks && tries < 3000) {
      tries++;
      const len = rand(110, 210);
      const ang = angles[Math.floor(Math.random() * angles.length)];
      const hx = Math.abs(Math.cos(ang)) * len / 2 + PLANK_W / 2;
      const hy = Math.abs(Math.sin(ang)) * len / 2 + PLANK_W / 2;
      if (hx * 2 > BOARD.w || hy * 2 > BOARD.h) continue;
      let cx = rand(BOARD.x + hx, BOARD.x + BOARD.w - hx);
      let cy = rand(BOARD.y + hy, BOARD.y + BOARD.h - hy);
      // 2枚目以降はなるべく既存の板に重ねる
      if (planks.length >= 2 && Math.random() < 0.6 && tries < 2000) {
        const base = planks[Math.floor(Math.random() * planks.length)];
        cx = Math.min(BOARD.x + BOARD.w - hx, Math.max(BOARD.x + hx, base.cx + rand(-100, 100)));
        cy = Math.min(BOARD.y + BOARD.h - hy, Math.max(BOARD.y + hy, base.cy + rand(-100, 100)));
      }
      const p = { cx, cy, len, ang, layer: planks.length, wood: WOODS[planks.length % WOODS.length], screws: [], falling: false, vy: 0, vr: 0, alpha: 1 };
      const m = 16;
      const ts = len > 165 ? [-len / 2 + m, 0, len / 2 - m] : [-len / 2 + m, len / 2 - m];
      const pts = ts.map(t => plankPoint(p, t));
      // ほかのねじと近すぎないこと
      if (pts.some(a => allPts.some(b => Math.hypot(a.x - b.x, a.y - b.y) < SR * 2 + 8))) continue;
      // 既存の板の大半と重なりすぎない程度に（少しは重ねる）
      pts.forEach(pt => allPts.push(pt));
      p.pts = pts;
      planks.push(p);
    }
    // ねじ総数を3の倍数に調整（端数は最後の板から削る）
    let total = planks.reduce((s, p) => s + p.pts.length, 0);
    let k = planks.length - 1;
    while (total % 3 !== 0 && k >= 0) {
      if (planks[k].pts.length === 3) { planks[k].pts.splice(1, 1); total--; }
      k--;
    }
    k = planks.length - 1;
    while (total % 3 !== 0 && k >= 0) {
      // 2本の板を1本にはしない：かわりに板を除く
      total -= planks[k].pts.length; planks.splice(k, 1); k--;
    }
    planks.forEach((p, i) => { p.layer = i; });

    // 解ける順（上の板から）にねじを並べ、3本ずつ色を割り当てる
    const order = [];
    for (let i = planks.length - 1; i >= 0; i--) {
      const p = planks[i];
      const s = shuffle(p.pts.slice());
      s.forEach(pt => order.push({ pt, plank: p }));
    }
    const triples = total / 3;
    const colorSeq = [];
    let last = -1;
    for (let i = 0; i < triples; i++) {
      let c;
      do { c = Math.floor(Math.random() * nColors); } while (c === last && nColors > 1 && Math.random() < 0.7);
      colorSeq.push(c); last = c;
    }
    const screwColors = [];
    colorSeq.forEach(c => { screwColors.push(c, c, c); });
    // 窓の中で少し混ぜて難しくする
    const win = Math.min(6 + level * 3, 40);
    for (let i = 0; i < screwColors.length; i++) {
      const j = Math.min(screwColors.length - 1, i + Math.floor(Math.random() * win));
      [screwColors[i], screwColors[j]] = [screwColors[j], screwColors[i]];
    }
    order.forEach((o, i) => {
      const s = { x: o.pt.x, y: o.pt.y, plank: o.plank, color: screwColors[i], where: 'board' };
      o.plank.screws.push(s);
      screws.push(s);
    });
    boxQueue = colorSeq.slice();
    // 箱の順番も少し入れ替える（レベルが上がるほど大きく）
    const bw = Math.min(1 + Math.floor(level / 2), 5);
    for (let i = 0; i < boxQueue.length; i++) {
      const j = Math.min(boxQueue.length - 1, i + Math.floor(Math.random() * (bw + 1)));
      [boxQueue[i], boxQueue[j]] = [boxQueue[j], boxQueue[i]];
    }
    boxes = [];
    fillBoxes();
  }

  function boxSlotPos(bi, si) {
    const bw = 150, gap = 20;
    const x0 = (W - (bw * 2 + gap)) / 2 + bi * (bw + gap);
    return { x: x0 + 30 + si * 45, y: BOX_Y + 38 };
  }
  function boxRect(bi) {
    const bw = 150, gap = 20;
    return { x: (W - (bw * 2 + gap)) / 2 + bi * (bw + gap), y: BOX_Y, w: bw, h: BOX_H };
  }
  function traySlotPos(i) {
    const sw = 56;
    const x0 = (W - sw * TRAY_SIZE) / 2;
    return { x: x0 + sw * i + sw / 2, y: TRAY_Y + TRAY_H / 2 };
  }

  function fillBoxes() {
    for (let i = 0; i < 2; i++) {
      if (!boxes[i] && boxQueue.length) {
        boxes[i] = { color: boxQueue.shift(), slots: [null, null, null], t: 0, leaving: false, enter: 1 };
        // トレイから合うねじを移す
        pullFromTray(i);
      }
    }
  }

  function pullFromTray(bi) {
    const b = boxes[bi];
    if (!b) return;
    for (let i = 0; i < TRAY_SIZE; i++) {
      const s = tray[i];
      if (s && s.color === b.color) {
        const si = b.slots.indexOf(null);
        if (si < 0) break;
        tray[i] = null;
        b.slots[si] = s;
        const to = boxSlotPos(bi, si);
        launch(s, s.x, s.y, to.x, to.y, () => onArriveBox(bi));
      }
    }
  }

  function launch(s, fx, fy, tx, ty, done) {
    s.where = 'fly';
    flyers.push({ s, fx, fy, tx, ty, t: 0, dur: 0.28, done });
  }

  function onArriveBox(bi) {
    const b = boxes[bi];
    if (!b || b.leaving) return;
    const full = b.slots.every(x => x && x.where === 'box');
    if (full) {
      b.leaving = true; b.t = 0;
      score += 50; addPopup(boxRect(bi).x + 75, BOX_Y + 30, '+50');
      beep(880, 0.12, 'triangle', 0.08); setTimeout(() => beep(1175, 0.15, 'triangle', 0.08), 90);
      updateHud();
    } else {
      checkStuck();
    }
  }

  function addPopup(x, y, text) { popups.push({ x, y, text, t: 0 }); }

  function isCovered(s) {
    const p = s.plank;
    for (const q of planks) {
      if (q.falling || q.layer <= p.layer) continue;
      if (inPlank(q, s.x, s.y, SR * 0.4)) return true;
    }
    return false;
  }

  function boardScrews() { return screws.filter(s => s.where === 'board'); }

  // ---- 入力 ----
  function tap(x, y) {
    if (state !== 'play') return;
    let bestS = null, bestD = 22;
    for (const s of boardScrews()) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestD) { bestD = d; bestS = s; }
    }
    if (!bestS) return;
    // 重なっている候補があれば、外せる方を優先
    if (isCovered(bestS)) {
      const alt = boardScrews().filter(s => Math.hypot(s.x - x, s.y - y) < 22 && !isCovered(s));
      if (alt.length) bestS = alt[0];
      else { shake = { s: bestS, t: 0 }; beep(140, 0.12, 'sawtooth', 0.05); return; }
    }
    pickScrew(bestS);
  }

  function pickScrew(s) {
    // 箱へ
    let bi = -1, si = -1;
    for (let i = 0; i < 2; i++) {
      const b = boxes[i];
      if (b && !b.leaving && b.color === s.color) {
        const k = b.slots.indexOf(null);
        if (k >= 0) { bi = i; si = k; break; }
      }
    }
    if (bi < 0 && tray.indexOf(null) < 0) { shake = { s, t: 0 }; beep(140, 0.12, 'sawtooth', 0.05); return; }
    removeFromPlank(s);
    if (bi >= 0) {
      boxes[bi].slots[si] = s;
      const to = boxSlotPos(bi, si);
      combo++; comboT = 1.6;
      const gain = 10 + Math.min(combo - 1, 10) * 2;
      score += gain;
      addPopup(s.x, s.y - 14, '+' + gain + (combo > 1 ? ' x' + combo : ''));
      beep(520 + Math.min(combo, 10) * 40, 0.08, 'square', 0.05);
      launch(s, s.x, s.y, to.x, to.y, () => onArriveBox(bi));
    } else {
      const ti = tray.indexOf(null);
      tray[ti] = s;
      combo = 0;
      score += 2;
      const to = traySlotPos(ti);
      beep(330, 0.08, 'square', 0.04);
      launch(s, s.x, s.y, to.x, to.y, () => { s.where = 'tray'; checkStuck(); });
    }
    updateHud();
  }

  function removeFromPlank(s) {
    const p = s.plank;
    s.where = 'fly';
    if (p.screws.every(x => x.where !== 'board')) {
      p.falling = true; p.vy = -60; p.vr = rand(-2, 2);
      score += 5;
      setTimeout(() => beep(200, 0.18, 'triangle', 0.06), 60);
    }
  }

  function checkStuck() {
    if (state !== 'play') return;
    if (tray.indexOf(null) >= 0) return;
    if (flyers.length) return;
    // 箱に入れられるねじが盤面にあるか
    const ok = boardScrews().some(s => !isCovered(s) && boxes.some(b => b && !b.leaving && b.color === s.color && b.slots.indexOf(null) >= 0));
    const leavingSoon = boxes.some(b => b && b.leaving);
    if (!ok && !leavingSoon) gameOver();
  }

  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); const p = pos(e); tap(p.x, p.y); });

  function startGame() {
    level = 1; score = 0; combo = 0;
    overlay.classList.add('hidden');
    genLevel();
    state = 'play';
    updateHud();
    beep(660, 0.1, 'triangle', 0.06);
  }
  function nextLevel() {
    level++;
    genLevel();
    state = 'play';
    updateHud();
  }
  function gameOver() {
    state = 'over';
    saveBest();
    beep(220, 0.3, 'sawtooth', 0.06); setTimeout(() => beep(150, 0.4, 'sawtooth', 0.06), 200);
    setTimeout(() => {
      ovTitle.textContent = 'ゲームオーバー';
      ovText.innerHTML = 'トレイがいっぱいで動けなくなった！<br>LEVEL <b class="hl">' + level + '</b>　SCORE <b class="hl">' + score + '</b><br>BEST ' + best;
      startBtn.textContent = 'もう一度';
      overlay.classList.remove('hidden');
    }, 700);
  }
  startBtn.addEventListener('click', startGame);
  window.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !overlay.classList.contains('hidden')) { e.preventDefault(); startGame(); }
  });

  function updateHud() {
    levelEl.textContent = level;
    scoreEl.textContent = score;
    if (score > best) bestEl.textContent = score;
  }

  // ---- 更新 ----
  function update(dt) {
    stateT += dt;
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t += dt / f.dur;
      const t = Math.min(1, f.t), e = 1 - Math.pow(1 - t, 3);
      f.s.x = f.fx + (f.tx - f.fx) * e;
      f.s.y = f.fy + (f.ty - f.fy) * e - Math.sin(t * Math.PI) * 30;
      f.s.spin = (f.s.spin || 0) + dt * 18;
      if (t >= 1) {
        f.s.x = f.tx; f.s.y = f.ty;
        flyers.splice(i, 1);
        if (f.ty < TRAY_Y) f.s.where = 'box';
        f.done && f.done();
      }
    }
    for (const p of planks) {
      if (!p.falling) continue;
      p.vy += 900 * dt; p.cy += p.vy * dt; p.ang += p.vr * dt;
      p.alpha = Math.max(0, p.alpha - dt * 0.8);
    }
    planks = planks.filter(p => !(p.falling && p.cy > H + 200));
    for (let i = 0; i < 2; i++) {
      const b = boxes[i];
      if (!b) continue;
      if (b.enter > 0) b.enter = Math.max(0, b.enter - dt * 4);
      if (b.leaving) {
        b.t += dt;
        if (b.t > 0.45) {
          for (let k = 0; k < 10; k++) particles.push({ x: boxRect(i).x + 75, y: BOX_Y + 32, vx: rand(-120, 120), vy: rand(-160, 40), t: 0, c: COLORS[b.color].c });
          boxes[i] = null;
          fillBoxes();
          if (state === 'play') setTimeout(checkStuck, 400);
        }
      }
    }
    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    particles = particles.filter(p => p.t < 0.8);
    for (const p of popups) { p.t += dt; p.y -= 30 * dt; }
    popups = popups.filter(p => p.t < 0.9);
    if (shake) { shake.t += dt; if (shake.t > 0.3) shake = null; }
    if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

    // クリア判定
    if (state === 'play' && screws.length && screws.every(s => s.where === 'box') && !flyers.length && boxes.every(b => !b)) {
      state = 'clear'; stateT = 0;
      const bonus = 100 + level * 20;
      score += bonus;
      addPopup(W / 2, H / 2, 'CLEAR! +' + bonus);
      beep(784, 0.12, 'triangle', 0.08); setTimeout(() => beep(988, 0.12, 'triangle', 0.08), 120); setTimeout(() => beep(1319, 0.2, 'triangle', 0.08), 240);
      updateHud(); saveBest();
    }
    if (state === 'clear' && stateT > 1.4) nextLevel();
  }

  // ---- 描画 ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawScrew(s, x, y, dim) {
    const col = COLORS[s.color];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.arc(1.5, 2.5, SR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.d;
    ctx.beginPath(); ctx.arc(0, 0, SR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.c;
    ctx.beginPath(); ctx.arc(-0.8, -0.8, SR - 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.rotate((s.spin || 0) + s.color);
    ctx.strokeStyle = col.d; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
    ctx.restore();
    if (dim) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.arc(x, y, SR, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlank(p) {
    ctx.save();
    ctx.globalAlpha = p.alpha * 0.9;
    ctx.translate(p.cx, p.cy);
    ctx.rotate(p.ang);
    const l = p.len, w = PLANK_W;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    roundRect(-l / 2 + 2, -w / 2 + 4, l, w, w / 2); ctx.fill();
    ctx.fillStyle = p.wood;
    roundRect(-l / 2, -w / 2, l, w, w / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,30,.55)'; ctx.lineWidth = 2;
    ctx.stroke();
    // 木目
    ctx.strokeStyle = 'rgba(150,90,40,.25)'; ctx.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath(); ctx.moveTo(-l / 2 + 18, k * 8); ctx.bezierCurveTo(-l / 6, k * 8 + 3, l / 6, k * 8 - 3, l / 2 - 18, k * 8); ctx.stroke();
    }
    ctx.restore();
    // 穴
    ctx.save();
    ctx.globalAlpha = p.alpha;
    for (const pt of p.pts) {
      const has = p.screws.some(s => s.where === 'board' && s.x === pt.x && s.y === pt.y);
      if (!has && !p.falling) {
        ctx.fillStyle = 'rgba(60,35,20,.75)';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, SR - 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // ねじ
    for (const s of p.screws) {
      if (s.where !== 'board') continue;
      let x = s.x;
      if (shake && shake.s === s) x += Math.sin(shake.t * 60) * 3;
      drawScrew(s, x, s.y, false);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 盤面背景
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    roundRect(BOARD.x - 6, BOARD.y - 6, BOARD.w + 12, BOARD.h + 12, 16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let gx = BOARD.x + 12; gx < BOARD.x + BOARD.w; gx += 28)
      for (let gy = BOARD.y + 12; gy < BOARD.y + BOARD.h; gy += 28) { ctx.beginPath(); ctx.arc(gx, gy, 1.4, 0, Math.PI * 2); ctx.fill(); }

    // 板（下から）
    const sorted = planks.slice().sort((a, b) => a.layer - b.layer);
    for (const p of sorted) if (!p.falling) drawPlank(p);

    // 箱
    for (let i = 0; i < 2; i++) {
      const r = boxRect(i);
      const b = boxes[i];
      if (!b) {
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        roundRect(r.x, r.y, r.w, r.h, 12); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      const col = COLORS[b.color];
      ctx.save();
      let oy = -b.enter * 60, sc = 1;
      if (b.leaving) { oy = -Math.max(0, b.t - 0.15) * 260; sc = 1 + Math.min(b.t, 0.15); }
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + oy);
      ctx.scale(sc, sc);
      ctx.globalAlpha = b.leaving ? Math.max(0, 1 - b.t * 2) : 1 - b.enter;
      ctx.fillStyle = col.d;
      roundRect(-r.w / 2, -r.h / 2 + 4, r.w, r.h, 12); ctx.fill();
      ctx.fillStyle = col.c;
      roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 12); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      roundRect(-r.w / 2 + 6, -r.h / 2 + 4, r.w - 12, 10, 5); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const sp = boxSlotPos(i, k);
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath(); ctx.arc(sp.x - r.x - r.w / 2, sp.y - r.y - r.h / 2, SR + 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (!b.leaving) for (const s of b.slots) if (s && s.where === 'box') drawScrew(s, s.x, s.y + oy, false);
    }
    // 次の箱
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('のこり ' + boxQueue.length + ' 箱', W - 16, BOX_Y + BOX_H + 13);
    ctx.textAlign = 'left';
    for (let k = 0; k < Math.min(5, boxQueue.length); k++) {
      ctx.fillStyle = COLORS[boxQueue[k]].c;
      roundRect(16 + k * 18, BOX_Y + BOX_H + 4, 14, 9, 3); ctx.fill();
    }

    // トレイ
    const full = tray.filter(Boolean).length;
    ctx.fillStyle = full >= TRAY_SIZE - 1 ? 'rgba(255,80,80,.22)' : 'rgba(0,0,0,.28)';
    roundRect(traySlotPos(0).x - 28, TRAY_Y, 56 * TRAY_SIZE, TRAY_H, 14); ctx.fill();
    for (let i = 0; i < TRAY_SIZE; i++) {
      const p = traySlotPos(i);
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, SR + 3, 0, Math.PI * 2); ctx.fill();
      const s = tray[i];
      if (s && s.where === 'tray') drawScrew(s, s.x, s.y, false);
    }

    // 落ちる板・飛ぶねじ
    for (const p of planks) if (p.falling) drawPlank(p);
    for (const f of flyers) drawScrew(f.s, f.s.x, f.s.y, false);

    for (const p of particles) {
      ctx.globalAlpha = 1 - p.t / 0.8;
      ctx.fillStyle = p.c; ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const p of popups) {
      ctx.globalAlpha = 1 - p.t / 0.9;
      ctx.font = 'bold ' + (p.text.startsWith('CLEAR') ? 28 : 15) + 'px system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = '#ffe17a'; ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  genLevel();   // タイトル背景用
  requestAnimationFrame(loop);
})();
