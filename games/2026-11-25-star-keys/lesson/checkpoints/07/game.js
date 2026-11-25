(() => {
  'use strict';
  const LANES = 4;
  const ROWS = 4; // visible rows
  const KEYS = { d: 0, f: 1, j: 2, k: 3 };

  // オリジナルのメロディー（MIDI ノート番号）。和音の根音を添えて鳴らす
  const MELODY = [
    72, 74, 76, 79, 76, 74, 72, 67, 69, 72, 74, 76, 74, 72, 69, 67,
    65, 67, 69, 72, 69, 67, 65, 64, 62, 64, 65, 67, 69, 71, 72, 74,
    76, 79, 81, 79, 76, 74, 76, 72, 74, 76, 74, 72, 71, 69, 71, 72,
    69, 72, 76, 74, 72, 69, 67, 64, 65, 69, 72, 71, 67, 71, 74, 72,
  ];
  const BASS = [48, 48, 45, 45, 41, 41, 43, 43, 48, 48, 45, 45, 41, 43, 48, 48];

  const $ = (id) => document.getElementById(id);
  const cv = $('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = $('score'), speedEl = $('speed'), msgEl = $('msg');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let W = 0, H = 0, dpr = 1, laneW = 0, rowH = 0;
  let tiles = [], nextRow = 0, scroll = 0, speed = 0, score = 0, hits = 0, noteIdx = 0;
  let state = 'title', lastT = 0, failInfo = null, failTimer = 0;
  let effects = [], bgStars = [];

  // ---------- audio ----------
  let ac = null;
  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function tone(m, dur, vol, type) {
    const a = audio();
    if (!a) return null;
    const t = a.currentTime;
    const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain();
    o.type = type || 'triangle'; o2.type = 'sine';
    o.frequency.value = freq(m); o2.frequency.value = freq(m) * 2;
    const g2 = a.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    return g;
  }
  function playNote(long) {
    const m = MELODY[noteIdx % MELODY.length];
    tone(m, long ? 1.4 : 0.7, 0.28);
    if (noteIdx % 2 === 0) tone(BASS[(noteIdx / 4 | 0) % BASS.length], 1.0, 0.14, 'sine');
    noteIdx++;
  }
  function playFail() {
    tone(40, 0.6, 0.3, 'sawtooth');
    tone(41, 0.6, 0.2, 'sawtooth');
  }

  // ---------- layout ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const oldRowH = rowH;
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    laneW = W / LANES; rowH = H / ROWS;
    if (oldRowH > 0) scroll = scroll / oldRowH * rowH;
    bgStars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6 }));
    draw();
  }
  window.addEventListener('resize', resize);

  // ---------- tiles ----------
  function addRow() {
    const prev = tiles[tiles.length - 1];
    let lane;
    do { lane = Math.floor(Math.random() * LANES); } while (prev && lane === prev.lane && Math.random() < 0.7);
    const len = 1;
    tiles.push({ lane, row: nextRow, len, st: 'pending', flash: 0 });
    nextRow += len;
  }
  // 画面上の y（タイル下端）
  const tileBottom = (t) => H - (t.row * rowH - scroll);
  const tileTop = (t) => tileBottom(t) - t.len * rowH;

  function lowestPending() {
    for (const t of tiles) if (t.st === 'pending') return t;
    return null;
  }

  function reset() {
    tiles = []; nextRow = 0; score = 0; hits = 0; noteIdx = 0; effects = [];
    failInfo = null;
    scroll = -rowH * 0.6; // 最初のタイルが下から少し上に見える
    speed = 1.5;
    while (nextRow < ROWS + 3) addRow();
    tiles[0].start = true;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    speedEl.textContent = 'x' + (speed / 1.5).toFixed(1);
  }

  // ---------- input ----------
  function press(lane, id) {
    if (state !== 'play') return;
    const t = lowestPending();
    if (!t) return;
    if (t.lane !== lane || tileTop(t) > H) {
      // 空振り
      fail({ lane, y: Math.min(H - rowH, Math.max(0, tileBottom(t) - rowH)), miss: true });
      return;
    }
    hits++;
    t.st = 'hit'; t.flash = 1;
    score += 1;
    playNote(t.len > 1);
    effects.push({ x: (lane + 0.5) * laneW, y: (tileBottom(t) + tileTop(t)) / 2, r: 10, a: 1 });
    // 加速
    speed = Math.min(6.5, 1.5 + hits * 0.035);
    updateHud();
  }

  function laneFromX(clientX) {
    const r = cv.getBoundingClientRect();
    return Math.max(0, Math.min(LANES - 1, Math.floor((clientX - r.left) / laneW)));
  }
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'play') return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    press(laneFromX(e.clientX), 'p' + e.pointerId);
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (state !== 'play') return;
    if (k in KEYS) {
      e.preventDefault();
      if (!e.repeat) press(KEYS[k], 'k' + k);
    }
  });

  startBtn.addEventListener('click', start);

  function msg(s) { msgEl.textContent = s; }

  function start() {
    audio();
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    msg('いちばん下のタイルからタップ！');
    lastT = performance.now();
  }

  function fail(info) {
    state = 'fail';
    failInfo = info; failTimer = 0;
    playFail();
  }

  function gameOver() {
    state = 'over';
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = `スコア <b class="hl">${score}</b><br>タップしたタイル ${hits} 枚`;
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hidden');
  }

  // ---------- loop ----------
  function update(dt) {
    if (state === 'play') {
      scroll += speed * rowH * dt;
      for (const t of tiles) {
        if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 3);
      }
      // 見逃し
      const lp = lowestPending();
      if (lp && tileBottom(lp) > H + 2) {
        fail({ tile: lp });
      }
      // 画面外を削除・補充
      while (tiles.length && tileTop(tiles[0]) > H + rowH && tiles[0].st !== 'pending') tiles.shift();
      while (tileBottom(tiles[tiles.length - 1]) > -rowH * 2) addRow();
    } else if (state === 'fail') {
      failTimer += dt;
      if (failInfo.tile) {
        // 見逃したタイルが見える位置まで戻す
        const target = failInfo.tile.row * rowH + failInfo.tile.len * rowH - rowH * 1.1;
        scroll += (target - scroll) * Math.min(1, dt * 10);
      }
      if (failTimer > 1.0) gameOver();
    }
    for (const f of effects) { f.r += dt * 120; f.a -= dt * 2; }
    effects = effects.filter((f) => f.a > 0);
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

  function draw(now) {
    const time = (now || 0) / 1000;
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a2f6b'); g.addColorStop(1, '#f0e9ff');
    ctx.fillStyle = '#f4f1ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.18; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    for (const s of bgStars) {
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + s.p);
      ctx.fillStyle = '#7b86d8';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // レーン線
    ctx.strokeStyle = 'rgba(90,100,170,.25)'; ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath(); ctx.moveTo(i * laneW + 0.5, 0); ctx.lineTo(i * laneW + 0.5, H); ctx.stroke();
    }
    // タイル
    const pad = 2;
    for (const t of tiles) {
      const y0 = tileTop(t), y1 = tileBottom(t);
      if (y1 < -2 || y0 > H + 2) continue;
      const x = t.lane * laneW + pad, w = laneW - pad * 2, h = y1 - y0 - pad * 2;
      const missed = failInfo && failInfo.tile === t;
      if (t.st === 'hit') {
        ctx.fillStyle = `rgba(150,160,220,${0.25 + t.flash * 0.5})`;
        roundRect(x, y0 + pad, w, h, 6); ctx.fill();
        continue;
      }
      const blink = missed && Math.floor(failTimer * 8) % 2 === 0;
      const tg = ctx.createLinearGradient(0, y0, 0, y1);
      if (blink) { tg.addColorStop(0, '#ff5a6e'); tg.addColorStop(1, '#c42c46'); }
      else { tg.addColorStop(0, '#2b2f55'); tg.addColorStop(1, '#14172e'); }
      ctx.fillStyle = tg;
      roundRect(x, y0 + pad, w, h, 6); ctx.fill();
      if (t.start && state === 'play' && t.st === 'pending') {
        ctx.fillStyle = '#ffd56b';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('START', t.lane * laneW + laneW / 2, (y0 + y1) / 2);
      }
    }
    // 空振り表示
    if (failInfo && failInfo.miss && state !== 'play') {
      const blink = Math.floor(failTimer * 8) % 2 === 0;
      if (blink || state === 'over') {
        ctx.fillStyle = 'rgba(255,90,110,.85)';
        roundRect(failInfo.lane * laneW + pad, failInfo.y + pad, laneW - pad * 2, rowH - pad * 2, 6); ctx.fill();
      }
    }
    // エフェクト
    for (const f of effects) {
      ctx.globalAlpha = Math.max(0, f.a);
      ctx.strokeStyle = '#ffd56b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  resize();
  reset();
  requestAnimationFrame((t) => { lastT = t; loop(t); });
})();
