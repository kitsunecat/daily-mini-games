(() => {
  'use strict';
  const COLS = 7, ROWS = 8, TOP = 0.6, BW = COLS, BH = TOP + ROWS + 1.0;
  const FLOOR = BH - 0.25;
  const R = 0.14, SPEED = 0.24, GAP = 5; // ball radius, units per frame, frames between launches
  const MIN_ANG = 8 * Math.PI / 180;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const $ = id => document.getElementById(id);
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');

  let scale = 40, dpr = 1;
  let state = 'title'; // title | aim | fire | over
  let bricks = null, pickups = [], balls = [], ballCount, launchX, nextX, level;
  let aimAng = Math.PI / 2, aiming = false, toLaunch = 0, launchTimer = 0;

  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 8;
    scale = Math.max(10, Math.min(aw / BW, ah / BH));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = (BW * scale) + 'px';
    cv.style.height = (BH * scale) + 'px';
    cv.width = Math.round(BW * scale * dpr);
    cv.height = Math.round(BH * scale * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- game logic ----
  function spawnRow() {
    const cols = [0, 1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
    const n = Math.min(6, 1 + Math.floor(Math.random() * (level < 4 ? 3 : 5)) + (level > 15 ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const hp = Math.random() < 0.25 + Math.min(0.25, level * 0.01) ? level * 2 : level;
      bricks.push({ c: cols[i], r: 0, hp, max: hp, shake: 0 });
    }
    pickups.push({ c: cols[n], r: 0, t: Math.random() * 6 });
  }

  function startGame() {
    bricks = []; pickups = []; balls = [];
    ballCount = 1; level = 1;
    launchX = BW / 2; nextX = null; aimAng = Math.PI / 2;
    spawnRow();
    state = 'aim';
    overlay.classList.add('hide');
  }

  function endTurn() {
    if (nextX != null) launchX = nextX;
    nextX = null;
    state = 'aim';
  }

  function fire() {
    if (state !== 'aim') return;
    state = 'fire';
    balls = []; toLaunch = ballCount; launchTimer = 0;
  }

  function brickRect(b) {
    return { x: b.c + 0.05, y: TOP + b.r + 0.05, w: 0.9, h: 0.9 };
  }

  function stepBall(o) {
    o.x += o.vx; o.y += o.vy;
    if (o.x < R) { o.x = R; o.vx = Math.abs(o.vx); }
    if (o.x > BW - R) { o.x = BW - R; o.vx = -Math.abs(o.vx); }
    if (o.y < R) { o.y = R; o.vy = Math.abs(o.vy); }
    // avoid near-horizontal loops
    if (Math.abs(o.vy) < SPEED * 0.12) o.vy = (o.vy < 0 ? -1 : 1) * SPEED * 0.12;
    if (o.vy > 0 && o.y >= FLOOR - R) {
      o.y = FLOOR - R; o.done = true;
      if (nextX == null) nextX = Math.max(R, Math.min(BW - R, o.x));
    }
  }

  function update() {
    if (state === 'fire') {
      if (toLaunch > 0 && --launchTimer <= 0) {
        balls.push({ x: launchX, y: FLOOR - R, vx: Math.cos(aimAng) * SPEED, vy: -Math.sin(aimAng) * SPEED, done: false });
        toLaunch--; launchTimer = GAP;
      }
      for (const o of balls) {
        if (o.done) {
          if (nextX != null) o.x += (nextX - o.x) * 0.2;
          continue;
        }
        stepBall(o);
      }
      if (toLaunch === 0 && balls.every(o => o.done)) endTurn();
    }
  }

  function brickHue(b) {
    const t = Math.min(1, b.hp / Math.max(1, level * 2));
    return 200 - t * 200;
  }

  // ---- aim prediction ----
  function predict() {
    const pts = [];
    let x = launchX, y = FLOOR - R, vx = Math.cos(aimAng) * 0.12, vy = -Math.sin(aimAng) * 0.12;
    let bounces = 0;
    for (let i = 0; i < 400 && bounces < 1; i++) {
      x += vx; y += vy;
      if (x < R || x > BW - R) { vx = -vx; bounces++; }
      if (y < R) { vy = -vy; bounces++; }
      let hit = false;
      for (const b of bricks) {
        const rc = brickRect(b);
        if (x > rc.x - R && x < rc.x + rc.w + R && y > rc.y - R && y < rc.y + rc.h + R) { hit = true; break; }
      }
      if (hit) break;
      if (i % 4 === 0) pts.push([x, y]);
    }
    return pts;
  }

  // ---- render ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw(time) {
    const s = scale * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#140e28';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // grid dots
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let c = 1; c < COLS; c++) for (let r = 0; r <= ROWS; r++) ctx.fillRect(c - 0.02, TOP + r - 0.02, 0.04, 0.04);
    // danger line
    ctx.strokeStyle = 'rgba(255,90,120,.25)';
    ctx.lineWidth = 0.04; ctx.setLineDash([0.15, 0.12]);
    ctx.beginPath(); ctx.moveTo(0, TOP + ROWS - 1); ctx.lineTo(BW, TOP + ROWS - 1); ctx.stroke();
    ctx.setLineDash([]);
    // floor
    ctx.fillStyle = 'rgba(185,166,255,.25)';
    ctx.fillRect(0, FLOOR, BW, 0.04);

    if (!bricks) return;

    // pickups
    for (const p of pickups) {
      const px = p.c + 0.5, py = TOP + p.r + 0.5, pr = 0.2 + 0.03 * Math.sin(time / 200 + p.t);
      ctx.strokeStyle = '#6ff0a0'; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#6ff0a0';
      ctx.beginPath(); ctx.arc(px, py, 0.08, 0, Math.PI * 2); ctx.fill();
    }
    // bricks
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const b of bricks) {
      const rc = brickRect(b);
      const hue = brickHue(b);
      ctx.fillStyle = `hsl(${hue},85%,58%)`;
      roundRect(rc.x, rc.y, rc.w, rc.h, 0.12); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(rc.x + 0.05, rc.y + rc.h - 0.12, rc.w - 0.1, 0.07);
      ctx.fillStyle = '#1a0f2e';
      ctx.font = `800 ${b.hp >= 100 ? 0.32 : 0.4}px system-ui, sans-serif`;
      ctx.fillText(b.hp, rc.x + rc.w / 2, rc.y + rc.h / 2 + 0.02);
    }

    // aim line
    if (state === 'aim') {
      ctx.fillStyle = aiming ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)';
      for (const [x, y] of predict()) { ctx.beginPath(); ctx.arc(x, y, 0.05, 0, Math.PI * 2); ctx.fill(); }
    }
    // balls
    ctx.fillStyle = '#fff';
    if (state === 'aim' || state === 'over') {
      ctx.beginPath(); ctx.arc(launchX, FLOOR - R, R, 0, Math.PI * 2); ctx.fill();
    }
    if (state === 'fire') {
      for (const o of balls) { ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, Math.PI * 2); ctx.fill(); }
      if (toLaunch > 0) { ctx.beginPath(); ctx.arc(launchX, FLOOR - R, R, 0, Math.PI * 2); ctx.fill(); }
    }
    // ball count label
    const remain = state === 'fire' ? toLaunch : ballCount;
    if (remain > 0 && state !== 'over') {
      ctx.fillStyle = '#ddd3f5'; ctx.font = '700 0.3px system-ui, sans-serif';
      const lx = Math.max(0.4, Math.min(BW - 0.4, launchX));
      ctx.fillText('×' + remain, lx, FLOOR - R - 0.4);
    }
  }

  function loop(t) {
    update();
    draw(t);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- input ----
  function toBoard(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }
  function setAimFrom(p) {
    let dx = p.x - launchX, dy = (FLOOR - R) - p.y;
    let a = Math.atan2(dy, dx);
    if (dy < 0) a = dx < 0 ? Math.PI - MIN_ANG : MIN_ANG;
    aimAng = Math.max(MIN_ANG, Math.min(Math.PI - MIN_ANG, a));
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (state === 'aim') {
      aiming = true; setAimFrom(toBoard(e));
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  cv.addEventListener('pointermove', e => { if (aiming && state === 'aim') setAimFrom(toBoard(e)); });
  cv.addEventListener('pointerup', e => {
    if (aiming && state === 'aim') { aiming = false; setAimFrom(toBoard(e)); fire(); }
    aiming = false;
  });
  cv.addEventListener('pointercancel', () => { aiming = false; });

  startBtn.addEventListener('click', e => { e.stopPropagation(); startGame(); });
})();
