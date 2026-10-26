(() => {
  'use strict';

  const BEST_KEY = 'lane-dash-best';
  const LANE_GAP = 2.2;      // レーンの間隔（ワールド単位）
  const DEPTH = 28;          // 遠近感の強さ
  const SPAWN_Z = 75;        // 障害物が出現する距離
  const GRAVITY = 32;
  const JUMP_V = 12;
  const SLIDE_TIME = 0.6;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const coinsEl = document.getElementById('coins');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let W = 0, H = 0, dpr = 1;
  let best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  let state = 'title';
  let player, objects, dist, speed, coins, nextSpawn, lastTime, crashT, flash;
  let skyline = [];

  // ---------- サウンド ----------
  let ac = null;
  function beep(freq, dur, type, vol, slide) {
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur);
    } catch (e) { /* ignore */ }
  }
  function initAudio() {
    if (ac) return;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
  }

  // ---------- 画面サイズ ----------
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    skyline = [];
    let x = -10;
    while (x < W + 10) {
      const w = 18 + Math.random() * 34;
      skyline.push({ x, w, h: 20 + Math.random() * 70, lit: Math.random() });
      x += w + 2;
    }
  }
  window.addEventListener('resize', () => { resize(); draw(); });

  // ---------- 投影 ----------
  const horizon = () => H * 0.3;
  const groundY = () => H * 0.86;
  const unitPx = () => Math.min(W, H * 0.6) * 0.3 / LANE_GAP;
  function proj(x, y, z) {
    const t = 1 / (1 + Math.max(z, -DEPTH * 0.4) / DEPTH);
    return {
      x: W / 2 + x * unitPx() * t,
      y: horizon() + (groundY() - horizon()) * t - y * unitPx() * t,
      s: t,
    };
  }

  // ---------- ゲーム開始 ----------
  function reset() {
    player = { lane: 0, x: 0, y: 0, vy: 0, slide: 0, run: 0 };
    objects = [];
    dist = 0;
    speed = 13;
    coins = 0;
    nextSpawn = 12;
    crashT = 0;
    flash = 0;
    updateHud();
  }

  function start() {
    initAudio();
    reset();
    state = 'play';
    spawnRow(45);
    overlay.classList.add('hidden');
    lastTime = performance.now();
  }

  function gameOver() {
    state = 'crash';
    crashT = 0.8;
    flash = 1;
    beep(180, 0.5, 'sawtooth', 0.12, 50);
    const score = calcScore();
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* ignore */ }
    }
    updateHud();
  }

  function showGameOver() {
    state = 'over';
    const score = calcScore();
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = `走った距離 <b>${Math.floor(dist)} m</b>　コイン <b>${coins}</b><br>スコア <b>${score}</b>` +
      (score >= best && score > 0 ? '<br>🎉 ハイスコア更新！' : `<br>ベスト ${best}`);
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hidden');
  }

  const calcScore = () => Math.floor(dist) + coins * 10;
  function updateHud() {
    scoreEl.textContent = calcScore();
    coinsEl.textContent = coins;
    bestEl.textContent = best;
  }

  // ---------- 障害物の生成 ----------
  function spawnRow(z) {
    const lanes = [-1, 0, 1];
    const blocked = Math.random() < 0.35 ? 2 : 1;
    shuffle(lanes);
    const used = lanes.slice(0, blocked);
    const free = lanes.slice(blocked);
    let boxes = 0;
    used.forEach((lane) => {
      const r = Math.random();
      let type = r < 0.38 ? 'fence' : r < 0.68 ? 'gate' : 'box';
      if (type === 'box' && boxes >= 1 && blocked === 2) type = 'fence';
      if (type === 'box') boxes++;
      const len = type === 'box' ? 6 + Math.random() * 6 : 0.5;
      objects.push({ type, lane, z, len });
      if (type === 'fence' && Math.random() < 0.6) {
        // フェンスの上にアーチ状のコイン
        for (let i = 0; i < 5; i++) {
          const k = (i - 2) / 2;
          objects.push({ type: 'coin', lane, z: z + k * 2.2, y: 2.4 - k * k * 1.2 });
        }
      }
    });
    if (free.length && Math.random() < 0.7) {
      const lane = free[Math.floor(Math.random() * free.length)];
      const n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) objects.push({ type: 'coin', lane, z: z - 4 + i * 2.2, y: 0.8 });
    }
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  // ---------- 操作 ----------
  function move(dir) {
    if (state !== 'play') return;
    const n = Math.max(-1, Math.min(1, player.lane + dir));
    if (n !== player.lane) { player.lane = n; beep(520, 0.06, 'triangle', 0.05); }
  }
  function jump() {
    if (state !== 'play') return;
    if (player.y <= 0.001) {
      player.vy = JUMP_V;
      player.slide = 0;
      beep(380, 0.15, 'square', 0.05, 760);
    }
  }
  function slide() {
    if (state !== 'play') return;
    if (player.y > 0.001) player.vy = -JUMP_V * 1.4; // 空中なら急降下
    player.slide = SLIDE_TIME;
    beep(300, 0.12, 'triangle', 0.05, 150);
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (state !== 'play') {
      if (k === 'Enter' || k === ' ') { e.preventDefault(); if (state !== 'crash') start(); }
      return;
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') slide();
    else return;
    e.preventDefault();
  });

  let touch = null;
  cv.addEventListener('pointerdown', (e) => {
    touch = { x: e.clientX, y: e.clientY, done: false };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!touch || touch.done) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < 28) return;
    touch.done = true;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
    else slide();
  });
  const endTouch = (e) => {
    if (touch && !touch.done && state === 'play') {
      // 短いタップは左右半分でレーン移動
      const r = cv.getBoundingClientRect();
      move(e.clientX - r.left < W / 2 ? -1 : 1);
    }
    touch = null;
  };
  cv.addEventListener('pointerup', endTouch);
  cv.addEventListener('pointercancel', () => { touch = null; });
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });

  // ---------- 更新 ----------
  function update(dt) {
    if (state === 'crash') {
      crashT -= dt;
      flash = Math.max(0, flash - dt * 2);
      if (crashT <= 0) showGameOver();
      return;
    }
    if (state !== 'play') return;

    speed = Math.min(34, 13 + dist / 90);
    const dz = speed * dt;
    dist += dz;
    player.run += dz;

    player.x += (player.lane - player.x) * Math.min(1, dt * 14);
    player.vy -= GRAVITY * dt;
    player.y = Math.max(0, player.y + player.vy * dt);
    if (player.y === 0 && player.vy < 0) player.vy = 0;
    player.slide = Math.max(0, player.slide - dt);

    objects.forEach((o) => { o.z -= dz; });

    nextSpawn -= dz;
    if (nextSpawn <= 0) {
      spawnRow(SPAWN_Z);
      nextSpawn = Math.max(13, 24 - dist / 120) + Math.random() * 8;
    }

    const px = player.x;
    for (const o of objects) {
      if (o.hit) continue;
      if (Math.abs(o.lane - px) > 0.45) continue;
      const front = o.z, back = o.z + (o.len || 0.4);
      if (back < -0.4 || front > 0.4) continue;
      if (o.type === 'coin') {
        if (Math.abs((o.y || 0.8) - (player.y + 0.8)) < 1.3) {
          o.hit = true;
          coins++;
          beep(1200, 0.08, 'square', 0.04, 1800);
        }
        continue;
      }
      const sliding = player.slide > 0 && player.y < 0.3;
      if (o.type === 'fence' && player.y < 0.9) return gameOver();
      if (o.type === 'gate' && !sliding) return gameOver();
      if (o.type === 'box') return gameOver();
    }
    objects = objects.filter((o) => !o.hit && o.z + (o.len || 0) > -6);
    updateHud();
  }

  // ---------- 描画 ----------
  function draw() {
    if (!W) return;
    const hz = horizon(), gy = groundY();

    // 空
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#1a1145');
    sky.addColorStop(1, '#ff7aa8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz + 1);
    ctx.fillStyle = 'rgba(255,230,160,0.9)';
    ctx.beginPath();
    ctx.arc(W * 0.78, hz * 0.45, Math.min(W, H) * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // ビル群
    skyline.forEach((b) => {
      ctx.fillStyle = '#2a1d55';
      ctx.fillRect(b.x, hz - b.h, b.w, b.h);
      if (b.lit > 0.4) {
        ctx.fillStyle = 'rgba(255,224,120,0.55)';
        for (let yy = hz - b.h + 6; yy < hz - 6; yy += 10) {
          for (let xx = b.x + 4; xx < b.x + b.w - 4; xx += 8) {
            if (((xx * 7 + yy * 3) | 0) % 5 < 2) ctx.fillRect(xx, yy, 3, 4);
          }
        }
      }
    });

    // 地面
    ctx.fillStyle = '#1e2a3a';
    ctx.fillRect(0, hz, W, H - hz);
        const farL = proj(-LANE_GAP * 1.6, 0, 400), farR = proj(LANE_GAP * 1.6, 0, 400);
    const nearL = proj(-LANE_GAP * 1.6, 0, -6), nearR = proj(LANE_GAP * 1.6, 0, -6);
    ctx.fillStyle = '#3a3f58';
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y); ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y); ctx.lineTo(nearL.x, nearL.y);
    ctx.closePath();
    ctx.fill();

    // 枕木（流れるしま模様）
    const off = (player ? player.run : 0) % 4;
    for (let z = -off; z < 120; z += 4) {
      if (z < -6) continue;
      const a = proj(-LANE_GAP * 1.55, 0, z), b = proj(LANE_GAP * 1.55, 0, z);
      const c = proj(LANE_GAP * 1.55, 0, z + 1.2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(a.x, c.y, b.x - a.x, a.y - c.y);
    }
    // レーン線
    ctx.strokeStyle = 'rgba(120,240,255,0.55)';
    ctx.lineWidth = 2;
    [-0.5, 0.5].forEach((k) => {
      const f = proj(k * LANE_GAP, 0, 400), n = proj(k * LANE_GAP, 0, -6);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(n.x, n.y); ctx.stroke();
    });

    if (!player) return;

    // 奥から順に描く
    const list = objects.filter((o) => o.z < SPAWN_Z + 10).slice();
    list.push({ type: 'player', z: 0.01 });
    list.sort((a, b) => (b.z + (b.len || 0) * 0.5) - (a.z + (a.len || 0) * 0.5));
    list.forEach((o) => {
      if (o.type === 'player') drawPlayer();
      else if (o.type === 'coin') drawCoin(o);
      else drawObstacle(o);
    });

    // 遠景フォグ
    const fog = ctx.createLinearGradient(0, hz, 0, hz + (gy - hz) * 0.25);
    fog.addColorStop(0, 'rgba(255,122,168,0.55)');
    fog.addColorStop(1, 'rgba(255,122,168,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, hz, W, (gy - hz) * 0.25);

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawObstacle(o) {
    const x = o.lane * LANE_GAP, hw = LANE_GAP * 0.42;
    if (o.z + o.len < -5) return;
    const zf = Math.max(o.z, -5);
    if (o.type === 'box') {
      const h = 2.6;
      const fl = proj(x - hw, 0, zf), fr = proj(x + hw, 0, zf);
      const tl = proj(x - hw, h, zf), tr = proj(x + hw, h, zf);
      const bl = proj(x - hw, h, o.z + o.len), br = proj(x + hw, h, o.z + o.len);
      const sl = proj(x - hw, 0, o.z + o.len), sr = proj(x + hw, 0, o.z + o.len);
      // 側面
      ctx.fillStyle = '#8a3a2e';
      const side = x < 0 ? [fr, tr, br, sr] : x > 0 ? [fl, tl, bl, sl] : null;
      if (side) poly(side);
      // 上面
      ctx.fillStyle = '#e8775a';
      poly([tl, tr, br, bl]);
      // 正面
      ctx.fillStyle = '#c94f3a';
      ctx.fillRect(tl.x, tl.y, tr.x - tl.x, fl.y - tl.y);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, 2 * fl.s);
      for (let i = 1; i < 5; i++) {
        const xx = tl.x + (tr.x - tl.x) * i / 5;
        ctx.beginPath(); ctx.moveTo(xx, tl.y + 3); ctx.lineTo(xx, fl.y - 3); ctx.stroke();
      }
    } else if (o.type === 'fence') {
      const h = 0.8;
      const a = proj(x - hw, h, zf), b = proj(x + hw, 0, zf);
      const w = b.x - a.x, hh = b.y - a.y;
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(a.x, a.y, w, hh * 0.35);
      ctx.fillStyle = '#2b2b2b';
      for (let i = 0; i < 4; i++) ctx.fillRect(a.x + w * (i * 0.25 + 0.04), a.y, w * 0.1, hh * 0.35);
      ctx.fillStyle = '#9aa0b5';
      ctx.fillRect(a.x + w * 0.08, a.y + hh * 0.35, w * 0.08, hh * 0.65);
      ctx.fillRect(a.x + w * 0.84, a.y + hh * 0.35, w * 0.08, hh * 0.65);
    } else if (o.type === 'gate') {
      const top = 2.8, low = 1.1;
      const a = proj(x - hw, top, zf), b = proj(x + hw, 0, zf), c = proj(x, low, zf);
      const w = b.x - a.x;
      ctx.fillStyle = '#6c7390';
      ctx.fillRect(a.x, a.y, w * 0.09, b.y - a.y);
      ctx.fillRect(b.x - w * 0.09, a.y, w * 0.09, b.y - a.y);
      ctx.fillStyle = '#5ff0c8';
      ctx.fillRect(a.x, c.y - (c.y - a.y) * 0.55, w, (c.y - a.y) * 0.55);
      ctx.fillStyle = '#0d3b36';
      ctx.font = `bold ${Math.max(8, 30 * c.s)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ LOW', x === 0 ? W / 2 : (a.x + b.x) / 2, c.y - (c.y - a.y) * 0.27);
    }
  }

  function drawCoin(o) {
    if (o.z < -5) return;
    const p = proj(o.lane * LANE_GAP, o.y, o.z);
    const r = 0.38 * unitPx() * p.s;
    const sq = Math.abs(Math.cos((dist + o.z) * 0.4));
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(1, r * (0.35 + 0.65 * sq)), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.15 * sq, p.y - r * 0.2, Math.max(0.5, r * 0.3 * sq), r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    const px = player.x * LANE_GAP;
    const g = proj(px, 0, 0);
    const u = unitPx();
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, u * 0.55 / (1 + player.y * 0.2), u * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    const sliding = player.slide > 0 && player.y < 0.3;
    const base = proj(px, player.y, 0);
    const bob = player.y > 0 || sliding ? 0 : Math.abs(Math.sin(player.run * 1.4)) * u * 0.08;
    const bodyH = sliding ? u * 0.7 : u * 1.5;
    const bodyW = sliding ? u * 1.1 : u * 0.8;
    const by = base.y - bob;

    // 脚
    if (!sliding) {
      const sw = Math.sin(player.run * 1.4) * u * 0.18;
      ctx.fillStyle = '#2c3e8f';
      ctx.fillRect(base.x - u * 0.25 + sw, by - u * 0.45, u * 0.18, u * 0.45);
      ctx.fillRect(base.x + u * 0.07 - sw, by - u * 0.45, u * 0.18, u * 0.45);
    }
    // 胴体
    ctx.fillStyle = '#ff8a3d';
    roundRect(base.x - bodyW / 2, by - bodyH, bodyW, bodyH * (sliding ? 1 : 0.72), u * 0.25);
    ctx.fill();
    // パーカーの帽子と顔
    const hx = sliding ? base.x + bodyW * 0.25 : base.x;
    const hy = sliding ? by - bodyH * 0.6 : by - bodyH * 0.9;
    ctx.fillStyle = '#ffe1c2';
    ctx.beginPath(); ctx.arc(hx, hy, u * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.arc(hx, hy - u * 0.05, u * 0.34, Math.PI, Math.PI * 2); ctx.fill();
    // 耳
    ctx.beginPath();
    ctx.moveTo(hx - u * 0.32, hy - u * 0.12); ctx.lineTo(hx - u * 0.22, hy - u * 0.58); ctx.lineTo(hx - u * 0.05, hy - u * 0.3);
    ctx.moveTo(hx + u * 0.32, hy - u * 0.12); ctx.lineTo(hx + u * 0.22, hy - u * 0.58); ctx.lineTo(hx + u * 0.05, hy - u * 0.3);
    ctx.fill();
    // リュック
    ctx.fillStyle = '#5ff0c8';
    roundRect(base.x - bodyW * 0.32, by - bodyH * (sliding ? 0.9 : 0.68), bodyW * 0.64, bodyH * (sliding ? 0.5 : 0.36), u * 0.1);
    ctx.fill();
  }

  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - (lastTime || now)) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  reset();
  // タイトル画面用に少し障害物を並べておく
  spawnRow(25); spawnRow(50); spawnRow(75);
  requestAnimationFrame(loop);
})();
