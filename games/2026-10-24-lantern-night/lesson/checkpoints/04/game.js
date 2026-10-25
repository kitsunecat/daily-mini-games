// ランタン守りの夜 — 夜明けまで生き延びるサバイバー系アクション
(() => {
  'use strict';

  const WORLD = 3200;        // ワールドの一辺
  const MAX_ENEMIES = 280;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  let W = 0, H = 0, DPR = 1, zoom = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    zoom = clamp(Math.min(W, H) / 620, 0.55, 1.25);
  }
  window.addEventListener('resize', resize);
  resize();

  const ETYPES = {
    blob:  { hp: 12, spd: 52, r: 14, dmg: 8, xp: 1, score: 10 },
    bat:   { hp: 9, spd: 98, r: 11, dmg: 6, xp: 1, score: 12 },
    wisp:  { hp: 26, spd: 66, r: 13, dmg: 12, xp: 2, score: 20 },
    brute: { hp: 80, spd: 36, r: 24, dmg: 20, xp: 5, score: 50 },
  };

  // ---------- 状態 ----------
  let state = 'title'; // title / play
  let P, enemies;
  let t, spawnAcc;

  function reset() {
    P = {
      x: WORLD / 2, y: WORLD / 2, r: 16, baseSpeed: 165,
      face: 1, walk: 0,
    };
    enemies = [];
    t = 0; spawnAcc = 0;
  }
  reset();

  const speed = () => P.baseSpeed;

  // ---------- 入力 ----------
  const keys = new Set();
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    joy.active = true; joy.id = e.pointerId;
    joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    joy.x = e.clientX; joy.y = e.clientY;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) { joy.active = false; joy.id = null; } };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);

  function inputVec() {
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;
    if (joy.active) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
      const len = Math.hypot(dx, dy);
      if (len > 6) { const m = Math.min(1, len / 50); mx = dx / len * m; my = dy / len * m; }
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return [mx, my];
  }

  // ---------- 生成 ----------
  function spawnEnemy(type, x, y) {
    const d = ETYPES[type];
    const hpMul = 1 + t / 100;
    enemies.push({
      type, x, y, r: d.r, hp: d.hp * hpMul, maxHp: d.hp * hpMul, spd: d.spd * (1 + t / 900),
      dmg: d.dmg, xp: d.xp, score: d.score, flash: 0, kx: 0, ky: 0, ph: rand(0, TAU), oh: 0, dead: false,
    });
  }
  function viewRadius() { return Math.hypot(W, H) / 2 / zoom; }
  function spawnRing(type) {
    const a = rand(0, TAU), d = viewRadius() + rand(30, 90);
    spawnEnemy(type, clamp(P.x + Math.cos(a) * d, 20, WORLD - 20), clamp(P.y + Math.sin(a) * d, 20, WORLD - 20));
  }
  function pickType() {
    const r = Math.random();
    if (t > 110 && r < 0.09) return 'brute';
    if (t > 90 && r < 0.3) return 'wisp';
    if (t > 35 && r < 0.55) return 'bat';
    return 'blob';
  }

  // ---------- 更新 ----------
  function update(dt) {
    t += dt;

    // プレイヤー
    const [mx, my] = inputVec();
    const sp = speed();
    P.x = clamp(P.x + mx * sp * dt, P.r, WORLD - P.r);
    P.y = clamp(P.y + my * sp * dt, P.r, WORLD - P.r);
    if (mx > 0.1) P.face = 1; else if (mx < -0.1) P.face = -1;
    P.moving = Math.abs(mx) + Math.abs(my) > 0.1;
    if (P.moving) P.walk += dt * 10;

    // 出現
    spawnAcc += dt * (0.8 + t / 24);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (enemies.length < MAX_ENEMIES) spawnRing(pickType());
    }

    // 敵の移動
    for (const e of enemies) {
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let vx = dx / d * e.spd, vy = dy / d * e.spd;
      if (e.type === 'bat') {
        const w = Math.sin(t * 6 + e.ph) * 60;
        vx += -dy / d * w; vy += dx / d * w;
      }
      e.x += vx * dt;
      e.y += vy * dt;
    }
    // 押し合い（重なり防止）
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        const dx = b.x - a.x, rr = a.r + b.r;
        if (dx > rr || dx < -rr) continue;
        const dy = b.y - a.y;
        if (dy > rr || dy < -rr) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push * 0.5; a.y -= uy * push * 0.5;
          b.x += ux * push * 0.5; b.y += uy * push * 0.5;
        }
      }
    }
  }

  // ---------- 画面遷移 ----------
  function hideOverlays() {
    for (const id of ['title']) $(id).classList.add('hidden');
  }
  function startGame() {
    reset();
    hideOverlays();
    state = 'play';
  }

  $('startBtn').addEventListener('click', startGame);

  // ---------- 描画 ----------
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function drawGround(camX, camY, vw, vh) {
    ctx.fillStyle = 'rgb(20,30,46)';
    ctx.fillRect(camX, camY, vw, vh);
    const T = 64;
    const x0 = Math.floor(camX / T), y0 = Math.floor(camY / T);
    const x1 = Math.ceil((camX + vw) / T), y1 = Math.ceil((camY + vh) / T);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const h = hash(ix, iy);
        const px = ix * T + hash(iy, ix) * 40, py = iy * T + h * 40;
        if (h < 0.35) {
          ctx.strokeStyle = 'rgba(90,140,110,.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 9);
          ctx.moveTo(px + 4, py); ctx.lineTo(px + 5, py - 11);
          ctx.moveTo(px + 8, py); ctx.lineTo(px + 12, py - 8);
          ctx.stroke();
        } else if (h < 0.42) {
          ctx.fillStyle = 'rgba(120,120,150,.35)';
          ctx.beginPath(); ctx.ellipse(px, py, 9, 6, 0, 0, TAU); ctx.fill();
        } else if (h < 0.46) {
          ctx.fillStyle = h < 0.44 ? 'rgba(255,190,220,.55)' : 'rgba(255,240,160,.55)';
          for (let k = 0; k < 5; k++) {
            const a = k * TAU / 5;
            ctx.beginPath(); ctx.arc(px + Math.cos(a) * 3.5, py + Math.sin(a) * 3.5, 2.4, 0, TAU); ctx.fill();
          }
        }
      }
    }
    // ワールドの外側（深い森）
    ctx.fillStyle = 'rgba(5,8,14,.85)';
    if (camX < 0) ctx.fillRect(camX, camY, -camX, vh);
    if (camY < 0) ctx.fillRect(camX, camY, vw, -camY);
    if (camX + vw > WORLD) ctx.fillRect(WORLD, camY, camX + vw - WORLD, vh);
    if (camY + vh > WORLD) ctx.fillRect(camX, WORLD, vw, camY + vh - WORLD);
  }

  function drawPlayer() {
    const x = P.x, y = P.y, f = P.face;
    const bob = P.moving ? Math.sin(P.walk) * 2 : 0;
    ctx.save();
    ctx.translate(x, y + bob);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 16 - bob, 15, 5, 0, 0, TAU); ctx.fill();
    ctx.scale(f, 1);
    // しっぽ
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.ellipse(-16, 4, 11, 6, -0.6 + Math.sin(P.walk * 0.5) * 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(-24, -1, 4, 3.5, -0.6, 0, TAU); ctx.fill();
    // 体
    ctx.fillStyle = '#ff9a4d';
    ctx.beginPath(); ctx.ellipse(0, 4, 12, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(2, 7, 6, 6, 0, 0, TAU); ctx.fill();
    // 頭
    ctx.fillStyle = '#ffa55c';
    ctx.beginPath(); ctx.arc(3, -9, 10, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, -14); ctx.lineTo(-3, -25); ctx.lineTo(3, -17); ctx.fill();
    ctx.beginPath(); ctx.moveTo(5, -17); ctx.lineTo(11, -25); ctx.lineTo(12, -13); ctx.fill();
    ctx.fillStyle = '#fff3e0';
    ctx.beginPath(); ctx.ellipse(8, -6, 5, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.arc(7, -11, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(12.5, -7, 1.6, 0, TAU); ctx.fill();
    // ランタン
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(11, 2); ctx.lineTo(16, -4); ctx.stroke();
    ctx.fillStyle = '#ffd56b';
    ctx.shadowColor = '#ffb030'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(13, -3, 9, 11, 3) : ctx.rect(13, -3, 9, 11); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(12, -4, 11, 2); ctx.fillRect(12, 7, 11, 2);
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    const wob = Math.sin(t * 5 + e.ph);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.9, e.r * 0.9, e.r * 0.3, 0, 0, TAU); ctx.fill();
    if (e.type === 'blob') {
      ctx.fillStyle = flash ? '#fff' : '#4b2f7a';
      ctx.beginPath(); ctx.ellipse(0, 0, e.r * (1 + wob * 0.06), e.r * (1 - wob * 0.06), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#5e3d94';
      ctx.beginPath(); ctx.arc(-4, -5, e.r * 0.45, 0, TAU); ctx.fill();
    } else if (e.type === 'bat') {
      const flap = Math.sin(t * 18 + e.ph) * 0.6;
      ctx.fillStyle = flash ? '#fff' : '#2d2248';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * 16, -10 - flap * 10, s * 22, -2 + flap * 6);
        ctx.quadraticCurveTo(s * 12, 0, s * 4, 5);
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    } else if (e.type === 'wisp') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = flash ? '#fff' : '#2e8f8a';
      ctx.beginPath();
      ctx.arc(0, -2, e.r, Math.PI, 0);
      for (let i = 0; i <= 4; i++) ctx.lineTo(e.r - i * e.r / 2, e.r + (i % 2 ? -4 : 3) + wob * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.type === 'brute') {
      ctx.fillStyle = flash ? '#fff' : '#3c3a4f';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-e.r, -e.r, e.r * 2, e.r * 2, 9) : ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#52506a';
      ctx.fillRect(-e.r + 5, -e.r + 5, e.r * 0.8, e.r * 0.5);
    }
    ctx.restore();
  }

  function drawEyes(e) {
    const s = e.type === 'brute' ? 1.6 : 1;
    const col = e.type === 'brute' ? '#ff5050' : e.type === 'wisp' ? '#c8fff6' : '#ffe14d';
    const dx = clamp((P.x - e.x) * 0.02, -2, 2) * s, dy = e.type === 'bat' ? -1 : -3 * s;
    ctx.fillStyle = col;
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(e.x - 4 * s + dx, e.y + dy, 2.2 * s, 0, TAU);
    ctx.arc(e.x + 4 * s + dx, e.y + dy, 2.2 * s, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vw = W / zoom, vh = H / zoom;
    let camX = P.x - vw / 2, camY = P.y - vh / 2;
    const toWorld = () => ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, -camX * DPR * zoom, -camY * DPR * zoom);
    toWorld();
    drawGround(camX, camY, vw, vh);

    const inView = (x, y, m) => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;

    // 敵（y順）→ プレイヤーは常に手前
    const list = enemies.filter((e) => inView(e.x, e.y, e.r + 30));
    list.sort((a, b) => a.y - b.y);
    for (const e of list) drawEnemy(e);
    drawPlayer();

    // 光るもの
    for (const e of list) drawEyes(e);

    // 仮想スティック
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (joy.active && state === 'play') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, TAU); ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy), m = Math.min(l, 50);
      ctx.fillStyle = 'rgba(255,214,120,.5)';
      ctx.beginPath(); ctx.arc(joy.ox + (l ? dx / l * m : 0), joy.oy + (l ? dy / l * m : 0), 20, 0, TAU); ctx.fill();
    }
  }

  // ---------- ループ ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'title') { P.walk += dt * 4; t += dt * 0.2; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
