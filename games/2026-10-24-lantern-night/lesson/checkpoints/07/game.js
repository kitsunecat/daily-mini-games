// ランタン守りの夜 — 夜明けまで生き延びるサバイバー系アクション
(() => {
  'use strict';

  const WORLD = 3200;        // ワールドの一辺
  const RUN_TIME = 300;      // 夜明けまでの秒数
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

  const BOLT = { count: [0, 1, 2, 2, 2, 3, 3], dmg: [0, 15, 15, 21, 21, 24, 28], cd: [0, .7, .66, .62, .58, .54, .4] };

  const ETYPES = {
    blob:  { hp: 12, spd: 52, r: 14, dmg: 8, xp: 1, score: 10 },
    bat:   { hp: 9, spd: 98, r: 11, dmg: 6, xp: 1, score: 12 },
    wisp:  { hp: 26, spd: 66, r: 13, dmg: 12, xp: 2, score: 20 },
    brute: { hp: 80, spd: 36, r: 24, dmg: 20, xp: 5, score: 50 },
  };

  // ---------- 状態 ----------
  let state = 'title'; // title / play / over
  let P, enemies, bullets, gems, effects, texts;
  let t, kills, score, spawnAcc, pendingLevels, shake;

  function xpNeed(lv) { return Math.floor(3 + lv * 2.5 + lv * lv * 0.55); }

  function reset() {
    P = {
      x: WORLD / 2, y: WORLD / 2, r: 16, hp: 100, maxHp: 100, baseSpeed: 165, inv: 0,
      level: 1, xp: 0, next: xpNeed(1), face: 1, walk: 0,
      lv: { bolt: 1 },
      boltCd: 0.5,
    };
    enemies = []; bullets = []; gems = []; effects = []; texts = [];
    t = 0; kills = 0; score = 0; spawnAcc = 0;
    pendingLevels = 0; shake = 0;
  }
  reset();

  const speed = () => P.baseSpeed;
  const magnet = () => 95;

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

  function addText(x, y, str, color) {
    if (texts.length > 70) texts.shift();
    texts.push({ x, y, str, color, life: 0.7 });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(40, 180);
      effects.push({ kind: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), color });
    }
  }

  // ---------- ダメージ ----------
  function hitEnemy(e, dmg, kx, ky, kb) {
    if (e.dead) return;
    dmg = Math.round(dmg);
    e.hp -= dmg;
    e.flash = 0.1;
    const res = e.type === 'brute' ? 0.35 : 1;
    const l = Math.hypot(kx, ky) || 1;
    e.kx += kx / l * kb * res;
    e.ky += ky / l * kb * res;
    addText(e.x + rand(-6, 6), e.y - e.r, String(dmg), '#fff');
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true;
    kills++;
    score += e.score;
    burst(e.x, e.y, e.type === 'wisp' ? '#7ff3e0' : '#b28cff', 7);
    gems.push({ x: e.x, y: e.y, v: e.xp, kind: 'gem' });
    if (Math.random() < 0.012) gems.push({ x: e.x + 8, y: e.y, v: 25, kind: 'heart' });
  }
  function hurtPlayer(dmg) {
    if (P.inv > 0) return;
    P.hp -= dmg;
    P.inv = 0.75;
    shake = 0.25;
    addText(P.x, P.y - 26, '-' + dmg, '#ff7b7b');
    if (P.hp <= 0) { P.hp = 0; endGame(false); }
  }

  // ---------- 武器 ----------
  function nearestEnemies(n, range) {
    const r2 = range * range;
    const list = [];
    for (const e of enemies) {
      if (e.dead) continue;
      const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2;
      if (d < r2) list.push([d, e]);
    }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((v) => v[1]);
  }

  function updateWeapons(dt) {
    const L = P.lv;
    // ひかり弾
    P.boltCd -= dt;
    if (P.boltCd <= 0) {
      const n = BOLT.count[L.bolt];
      const targets = nearestEnemies(n, 560);
      if (targets.length) {
        for (let i = 0; i < n; i++) {
          const tg = targets[i % targets.length];
          let a = Math.atan2(tg.y - P.y, tg.x - P.x);
          if (i >= targets.length) a += (i % 2 ? 0.25 : -0.25);
          bullets.push({ x: P.x, y: P.y - 6, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: BOLT.dmg[L.bolt], pierce: L.bolt >= 4 ? 3 : 1, life: 1.3, hit: [] });
        }
        P.boltCd = BOLT.cd[L.bolt];
      } else P.boltCd = 0.1;
    }
  }

  // ---------- 更新 ----------
  function update(dt) {
    t += dt;
    if (shake > 0) shake -= dt;

    // プレイヤー
    const [mx, my] = inputVec();
    const sp = speed();
    P.x = clamp(P.x + mx * sp * dt, P.r, WORLD - P.r);
    P.y = clamp(P.y + my * sp * dt, P.r, WORLD - P.r);
    if (mx > 0.1) P.face = 1; else if (mx < -0.1) P.face = -1;
    P.moving = Math.abs(mx) + Math.abs(my) > 0.1;
    if (P.moving) P.walk += dt * 10;
    if (P.inv > 0) P.inv -= dt;

    // 出現
    spawnAcc += dt * (0.8 + t / 24);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (enemies.length < MAX_ENEMIES) spawnRing(pickType());
    }

    updateWeapons(dt);

    // 敵の移動
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = P.x - e.x, dy = P.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let vx = dx / d * e.spd, vy = dy / d * e.spd;
      if (e.type === 'bat') {
        const w = Math.sin(t * 6 + e.ph) * 60;
        vx += -dy / d * w; vy += dx / d * w;
      }
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      const decay = Math.pow(0.02, dt);
      e.kx *= decay; e.ky *= decay;
      if (e.flash > 0) e.flash -= dt;
      if (d < e.r + P.r - 4) hurtPlayer(e.dmg);
      if (state !== 'play') return;
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

    // 弾
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const e of enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        const rr = e.r + 6;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          b.hit.push(e);
          hitEnemy(e, b.dmg, b.vx, b.vy, 120);
          if (--b.pierce <= 0) { b.life = 0; break; }
        }
      }
    }
    bullets = bullets.filter((b) => b.life > 0);

    // かけら
    const mg = magnet(), mg2 = mg * mg;
    for (const g of gems) {
      const dx = P.x - g.x, dy = P.y - g.y, d2 = dx * dx + dy * dy;
      if (d2 < mg2 || g.pull) {
        g.pull = true;
        const d = Math.sqrt(d2) || 1;
        g.spd = (g.spd || 120) + dt * 900;
        g.x += dx / d * g.spd * dt; g.y += dy / d * g.spd * dt;
        if (d < P.r + 6) {
          g.got = true;
          if (g.kind === 'heart') {
            P.hp = Math.min(P.maxHp, P.hp + g.v);
            addText(P.x, P.y - 30, '+' + g.v, '#7dffb0');
          } else gainXp(g.v);
        }
      }
    }
    gems = gems.filter((g) => !g.got);
    if (gems.length > 400) {
      // 遠くのかけらはまとめる
      const far = gems.splice(0, 100);
      const sum = far.reduce((s, g) => s + (g.kind === 'gem' ? g.v : 0), 0);
      gems.push({ x: far[0].x, y: far[0].y, v: sum, kind: 'gem' });
    }

    enemies = enemies.filter((e) => !e.dead);
    for (const fx of effects) {
      fx.life -= dt;
      if (fx.kind === 'spark') { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vx *= 0.92; fx.vy *= 0.92; }
    }
    effects = effects.filter((fx) => fx.life > 0);
    for (const tx of texts) { tx.life -= dt; tx.y -= 40 * dt; }
    texts = texts.filter((tx) => tx.life > 0);

    if (t >= RUN_TIME) { endGame(true); return; }
  }

  function gainXp(v) {
    P.xp += v;
    while (P.xp >= P.next) {
      P.xp -= P.next;
      P.level++;
      P.next = xpNeed(P.level);
      pendingLevels++;
    }
  }

  // ---------- 画面遷移 ----------
  function hideOverlays() {
    for (const id of ['title']) $(id).classList.add('hidden');
  }
  function startGame() {
    reset();
    hideOverlays();
    $('hud').classList.remove('hidden');
    state = 'play';
  }
  function endGame(cleared) {
    state = 'over';
    joy.active = false;
    setTimeout(() => $('title').classList.remove('hidden'), cleared ? 300 : 700);
  }
  function fmt(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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
    if (P.inv > 0 && Math.floor(P.inv * 20) % 2) return;
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
    if (shake > 0) { camX += rand(-5, 5) * shake * 4; camY += rand(-5, 5) * shake * 4; }
    const toWorld = () => ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, -camX * DPR * zoom, -camY * DPR * zoom);
    toWorld();
    drawGround(camX, camY, vw, vh);

    const inView = (x, y, m) => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;

    // かけら
    for (const g of gems) {
      if (!inView(g.x, g.y, 20)) continue;
      if (g.kind === 'heart') {
        ctx.fillStyle = '#ff6b8a';
        ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♥', g.x, g.y);
      } else {
        const s = g.v >= 5 ? 7 : g.v >= 2 ? 5.5 : 4.5;
        ctx.fillStyle = g.v >= 5 ? '#9c8bff' : g.v >= 2 ? '#5affc8' : '#5ad1ff';
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x + s * 0.7, g.y); ctx.lineTo(g.x, g.y + s); ctx.lineTo(g.x - s * 0.7, g.y);
        ctx.fill();
      }
    }
    // 敵（y順）→ プレイヤーは常に手前
    const list = enemies.filter((e) => inView(e.x, e.y, e.r + 30));
    list.sort((a, b) => a.y - b.y);
    for (const e of list) drawEnemy(e);
    drawPlayer();

    // 光るもの
    for (const e of list) drawEyes(e);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      ctx.fillStyle = 'rgba(255,220,120,.35)';
      ctx.beginPath(); ctx.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff4c2';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, TAU); ctx.fill();
    }
    for (const fx of effects) {
      if (fx.kind === 'spark') {
        ctx.globalAlpha = clamp(fx.life * 2, 0, 1);
        ctx.fillStyle = fx.color;
        ctx.fillRect(fx.x - 2, fx.y - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // ダメージ数字
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const tx of texts) {
      ctx.globalAlpha = clamp(tx.life * 2, 0, 1);
      ctx.fillStyle = '#000';
      ctx.fillText(tx.str, tx.x + 1, tx.y + 1);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.str, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;

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

  // ---------- HUD ----------
  const hudCache = {};
  function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function updateHud() {
    $('hpfill').style.width = (P.hp / P.maxHp * 100) + '%';
    $('xpfill').style.width = (P.xp / P.next * 100) + '%';
    setText('hptext', Math.ceil(P.hp) + ' / ' + P.maxHp);
    setText('timer', '夜明けまで ' + fmt(RUN_TIME - t));
    setText('lv', String(P.level));
    setText('kills', String(kills));
  }

  // ---------- ループ ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'title') { P.walk += dt * 4; t += dt * 0.2; }
    render();
    if (state !== 'title') updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
