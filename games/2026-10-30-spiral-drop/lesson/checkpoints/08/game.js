(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');
  const toastEl = document.getElementById('toast');

  const BEST_KEY = 'spiral-drop-best';
  const SLOTS = 12;
  const SLOT_ANG = Math.PI * 2 / SLOTS;
  const SPACING = 130;
  const GRAVITY = 1500;
  const BOUNCE = 560;
  const MAX_FALL = 900;
  const BALL_R = 11;
  const COLORS = {
    safe: ['#6fd3ff', '#2e7fb8'],
    danger: ['#ff4f6a', '#a3203a'],
  };

  let W = 0, H = 0, dpr = 1, R = 120, RY = 38;
  let state = 'title';
  let rings, ball, camY, rot, score, combo, particles, nextIndex, keyDir, lastT;
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  // ---- sound ----
  let actx = null;
  function beep(freq, dur, type = 'sine', vol = 0.15) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
      o.connect(g).connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    } catch (e) { /* 音が出なくても遊べる */ }
  }

  function resize() {
    const rect = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W * 0.38, 160);
    RY = R * 0.3;
  }

  function makeRing(i) {
    const types = new Array(SLOTS).fill('safe');
    if (i === 0) {
      // 最初のリングは、すき間をボールの真下から少し離す
      types[6] = types[7] = 'gap';
      return { y: 200 + i * SPACING, types, passed: false, broken: false };
    }
    const gapLen = i < 10 ? 3 : 2;
    const g0 = Math.floor(Math.random() * SLOTS);
    for (let k = 0; k < gapLen; k++) types[(g0 + k) % SLOTS] = 'gap';
    const dangerCount = Math.min(5, Math.floor((i + 2) / 4));
    let placed = 0, tries = 0;
    while (placed < dangerCount && tries < 50) {
      tries++;
      const k = Math.floor(Math.random() * SLOTS);
      if (types[k] !== 'safe') continue;
      // すき間のすぐ隣は避けて、少しだけ優しくする
      if (types[(k + 1) % SLOTS] === 'gap' || types[(k + SLOTS - 1) % SLOTS] === 'gap') continue;
      types[k] = 'danger';
      placed++;
    }
    return { y: 200 + i * SPACING, types, passed: false, broken: false };
  }

  function reset() {
    rings = [];
    nextIndex = 0;
    rot = 0;
    camY = 0;
    score = 0;
    combo = 0;
    particles = [];
    keyDir = 0;
    ball = { y: 120, vy: 0, squash: 0 };
    ensureRings();
    scoreEl.textContent = 0;
  }

  function ensureRings() {
    while (nextIndex === 0 || rings[rings.length - 1].y < camY + H + 300) {
      rings.push(makeRing(nextIndex++));
    }
    while (rings.length && rings[0].y < camY - 200) rings.shift();
  }

  function frontSlot() {
    const a = ((Math.PI / 2 - rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return Math.floor(a / SLOT_ANG) % SLOTS;
  }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 600);
  }

  function burst(y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      particles.push({ x: W / 2 + Math.cos(a) * R * 0.6, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 150, life: 0.7, color });
    }
  }

  function addScore(n) {
    score += n;
    scoreEl.textContent = score;
  }

  function update(dt) {
    if (keyDir) rot += keyDir * 3.2 * dt;

    ball.vy = Math.min(ball.vy + GRAVITY * dt, MAX_FALL);
    const prevY = ball.y;
    let newY = ball.y + ball.vy * dt;
    ball.squash = Math.max(0, ball.squash - dt * 5);

    for (const r of rings) {
      if (r.broken || r.passed) continue;
      if (prevY <= r.y && newY >= r.y) {
        const type = r.types[frontSlot()];
        if (type === 'gap') {
          r.passed = true;
          combo++;
          addScore(combo);
          beep(500 + combo * 80, 0.08, 'triangle', 0.08);
          if (combo === 3) toast('スマッシュ準備OK!');
          continue;
        }
        if (combo >= 3) {
          r.broken = true;
          burst(r.y - camY, COLORS[type][0], 26);
          addScore(5);
          toast('スマッシュ! +5');
          beep(180, 0.2, 'square', 0.12);
          combo = 0;
          newY = r.y;
          ball.vy = -BOUNCE;
          ball.squash = 1;
          break;
        }
        if (type === 'danger') {
          newY = r.y;
          ball.y = newY;
          gameOver();
          return;
        }
        combo = 0;
        newY = r.y;
        ball.vy = -BOUNCE;
        ball.squash = 1;
        beep(320, 0.06, 'sine', 0.1);
        break;
      }
    }
    ball.y = newY;

    const target = ball.y - H * 0.35;
    if (target > camY) camY += (target - camY) * Math.min(1, dt * 8);
    ensureRings();

    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function drawRingPart(r, front) {
    const cy = r.y - camY - RY;
    if (cy < -RY * 3 || cy > H + RY * 3) return;
    const lw = Math.max(12, R * 0.13);
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = lw;
      ctx.lineCap = 'butt';
      for (let k = 0; k < SLOTS; k++) {
        const type = r.types[k];
        if (type === 'gap') continue;
        const col = COLORS[type][pass === 0 ? 1 : 0];
        const a0 = k * SLOT_ANG + rot;
        // 1スロットを3分割して、手前/奥を判定
        for (let s = 0; s < 3; s++) {
          const b0 = a0 + s * SLOT_ANG / 3;
          const b1 = b0 + SLOT_ANG / 3 + 0.01;
          const isFront = Math.sin((b0 + b1) / 2) > 0;
          if (isFront !== front) continue;
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.ellipse(W / 2, cy + (pass === 0 ? lw * 0.6 : 0), R, RY, 0, b0, b1);
          ctx.stroke();
        }
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const visible = rings.filter(r => !r.broken);
    for (const r of visible) drawRingPart(r, false);

    // 柱
    const pw = Math.max(16, R * 0.16);
    const grad = ctx.createLinearGradient(W / 2 - pw, 0, W / 2 + pw, 0);
    grad.addColorStop(0, '#5b49c9');
    grad.addColorStop(0.5, '#9d8cff');
    grad.addColorStop(1, '#4a3aa8');
    ctx.fillStyle = grad;
    ctx.fillRect(W / 2 - pw, 0, pw * 2, H);

    for (const r of visible) drawRingPart(r, true);

    // ボール
    const bx = W / 2;
    const by = ball.y - camY - BALL_R;
    const sq = ball.squash * 0.35;
    ctx.save();
    ctx.translate(bx, by + BALL_R * sq);
    ctx.scale(1 + sq, 1 - sq);
    ctx.fillStyle = combo >= 3 ? '#ff9a3c' : '#ffd84d';
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(-BALL_R * 0.35, -BALL_R * 0.35, BALL_R * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (combo >= 3 && state === 'play') {
      ctx.strokeStyle = 'rgba(255,154,60,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by, BALL_R + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.globalAlpha = 1;

    if (state === 'play' && combo > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('COMBO ' + combo, 12, 24);
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000 || 0);
    lastT = t;
    if (state === 'play') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
    beep(660, 0.1, 'triangle', 0.1);
  }

  function gameOver() {
    state = 'over';
    beep(140, 0.4, 'sawtooth', 0.12);
    let msg = 'スコア ' + score;
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 保存できなくても続行 */ }
      bestEl.textContent = best;
      msg += '<br>ハイスコア更新！';
    }
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = msg + '<br>赤い床に当たっちゃった…';
    startBtn.textContent = 'もう一度';
    setTimeout(() => overlay.classList.remove('hidden'), 400);
  }

  // ---- input ----
  let dragging = false, lastX = 0;
  cv.addEventListener('pointerdown', e => {
    dragging = true;
    lastX = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rot -= dx * (2.4 / Math.max(200, W));
  });
  const endDrag = () => { dragging = false; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { keyDir = 1; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { keyDir = -1; e.preventDefault(); }
    else if (e.key === 'Enter' && state !== 'play') start();
  });
  window.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && keyDir === 1) || (e.key === 'ArrowRight' && keyDir === -1)) keyDir = 0;
  });
  startBtn.addEventListener('click', start);
  window.addEventListener('resize', resize);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
