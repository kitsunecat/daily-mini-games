(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const elScore = $('score'), elAmmo = $('ammo');
  const overlay = $('overlay'), btnStart = $('start');

  const MAX_AMMO = 6, RELOAD_TIME = 1.2, ZOOM = 3;

  let W = 0, H = 0, dpr = 1;
  let stars = [], backBldg = [], bldg = [], windows = [];
  let targets = [], particles = [], popups = [];
  let state = 'title';
  let score = 0, combo = 0, ammo = MAX_AMMO, reload = 0;
  let elapsed = 0, spawnTimer = 0, muzzle = 0, t = 0;

  // aim
  let aiming = false, aimX = 0, aimY = 0, touchOffset = 0;

  // ---------- city ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  function buildCity() {
    stars = [];
    for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.5, r: Math.random() * 1.2 + 0.3, p: Math.random() * 6 });
    backBldg = [];
    for (let x = -10; x < W + 10;) {
      const w = rand(30, 70), h = rand(H * 0.35, H * 0.7);
      backBldg.push({ x, w, top: H - h });
      x += w + rand(0, 6);
    }
    bldg = []; windows = [];
    const ground = H - 18;
    for (let x = rand(-20, 0); x < W + 10;) {
      const w = Math.round(rand(56, 96));
      const h = Math.round(rand(H * 0.28, H * 0.7));
      const b = { x: Math.round(x), w, top: ground - h, hue: rand(215, 245) };
      bldg.push(b);
      const cols = Math.floor((w - 8) / 18), rows = Math.floor((h - 26) / 28);
      const ox = b.x + (w - cols * 18) / 2 + 3;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const win = { x: ox + c * 18, y: b.top + 14 + r * 28, w: 12, h: 20, lit: Math.random() < 0.55, busy: false };
        if (win.x > 2 && win.x + win.w < W - 2 && win.y > 30) windows.push(win);
        b.wins = (b.wins || 0) + 1;
      }
      x += w + rand(4, 12);
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height));
    cv.width = W * dpr; cv.height = H * dpr;
    targets = [];
    buildCity();
    aimX = W / 2; aimY = H / 2;
  }

  // ---------- drawing ----------
  function drawFigure(f) {
    const x = f.x, y = f.y;
    const enemy = f.kind === 'enemy';
    ctx.fillStyle = enemy ? '#e8323c' : '#3ba3ff';
    ctx.fillRect(x - 3, y - 11, 6, 11);
    ctx.fillStyle = enemy ? '#2b0b10' : '#0d2340';
    ctx.fillRect(x - 3, y - 4, 6, 4);
    ctx.fillStyle = '#f1c9a5';
    ctx.beginPath(); ctx.arc(x, y - 14, 3, 0, Math.PI * 2); ctx.fill();
    if (enemy) {
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 3, y - 17.5, 6, 2); // cap
      // gun
      ctx.fillStyle = '#222';
      ctx.fillRect(x + 2, y - 9, 6, 2);
    }
  }

  function drawWorld() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a1c'); g.addColorStop(0.6, '#1a1f48'); g.addColorStop(1, '#3a2a5c');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3);
    for (const s of stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff4d0';
    ctx.beginPath(); ctx.arc(W * 0.8, H * 0.12, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e1b40';
    for (const b of backBldg) ctx.fillRect(b.x, b.top, b.w, H);
    for (const b of bldg) {
      ctx.fillStyle = `hsl(${b.hue},30%,13%)`;
      ctx.fillRect(b.x, b.top, b.w, H);
      ctx.fillStyle = `hsl(${b.hue},30%,20%)`;
      ctx.fillRect(b.x, b.top, b.w, 3);
    }
    for (const w of windows) {
      ctx.fillStyle = w.lit ? '#f7d58a' : '#18213d';
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    // targets in windows (clipped), roof walkers free
    for (const f of targets) {
      if (f.win) {
        ctx.save();
        ctx.beginPath(); ctx.rect(f.win.x, f.win.y, f.win.w, f.win.h); ctx.clip();
        drawFigure(f);
        ctx.restore();
        ctx.fillStyle = 'rgba(40,30,20,.35)';
        ctx.fillRect(f.win.x, f.win.y + f.win.h / 2 - 0.5, f.win.w, 1);
      } else drawFigure(f);
    }
    ctx.fillStyle = '#0a0c18'; ctx.fillRect(-W, H - 18, W * 3, H);
    ctx.fillStyle = '#ff6fd8';
    ctx.fillRect(0, H - 18, W, 1.5);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function sway() {
    return {
      x: aimX + Math.sin(t * 1.3) * 2.2 + Math.sin(t * 3.1) * 0.8,
      y: aimY + Math.cos(t * 1.7) * 1.8 + Math.sin(t * 2.3) * 0.7,
    };
  }

  function scopeR() { return Math.min(W, H) * 0.24; }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWorld();
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.c; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    if (state === 'play' && aiming) {
      const s = sway(), R = scopeR();
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath(); ctx.arc(aimX, aimY, R, 0, Math.PI * 2); ctx.clip();
      ctx.translate(aimX, aimY); ctx.scale(ZOOM, ZOOM); ctx.translate(-s.x, -s.y);
      drawWorld();
      ctx.restore();
      const vg = ctx.createRadialGradient(aimX, aimY, R * 0.7, aimX, aimY, R);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(aimX, aimY, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(aimX, aimY, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = reload > 0 ? 'rgba(150,170,200,.8)' : 'rgba(255,60,80,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(aimX - R, aimY); ctx.lineTo(aimX - 6, aimY);
      ctx.moveTo(aimX + 6, aimY); ctx.lineTo(aimX + R, aimY);
      ctx.moveTo(aimX, aimY - R); ctx.lineTo(aimX, aimY - 6);
      ctx.moveTo(aimX, aimY + 6); ctx.lineTo(aimX, aimY + R);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(aimX, aimY, 1.5, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      if (reload > 0) {
        ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(aimX, aimY, R - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - reload / RELOAD_TIME)); ctx.stroke();
      }
    }
    if (muzzle > 0) { ctx.fillStyle = `rgba(255,240,200,${muzzle * 2})`; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- game ----------
  function hud() {
    elScore.textContent = score;
    if (reload > 0) { elAmmo.textContent = 'リロード中…'; elAmmo.classList.add('reload'); }
    else { elAmmo.textContent = '●'.repeat(ammo) + '○'.repeat(MAX_AMMO - ammo); elAmmo.classList.remove('reload'); }
  }

  function spawn() {
    const civ = Math.random() < Math.min(0.4, 0.2 + elapsed * 0.004);
    const kind = civ ? 'civ' : 'enemy';
    const lifeT = civ ? rand(2.5, 4.5) : Math.max(2.0, 5.2 - elapsed * 0.045) + rand(0, 0.8);
    if (Math.random() < 0.25 && bldg.length) {
      const b = bldg[Math.floor(Math.random() * bldg.length)];
      if (b.x < 4 || b.x + b.w > W - 4) return;
      targets.push({ kind, x: rand(b.x + 6, b.x + b.w - 6), y: b.top, minX: b.x + 5, maxX: b.x + b.w - 5, vx: rand(12, 26) * (Math.random() < 0.5 ? -1 : 1), life: lifeT, max: lifeT });
    } else {
      const free = windows.filter((w) => w.lit && !w.busy);
      if (!free.length) return;
      const w = free[Math.floor(Math.random() * free.length)];
      w.busy = true;
      targets.push({ kind, win: w, x: w.x + w.w / 2, y: w.y + w.h + 18, rise: 18, life: lifeT, max: lifeT, vx: 0 });
    }
  }

  function burst(x, y, c, n) {
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: rand(-40, 40), vy: rand(-60, 10), life: rand(0.3, 0.6), max: 0.6, c });
  }

  function removeTarget(f) {
    if (f.win) f.win.busy = false;
    targets.splice(targets.indexOf(f), 1);
  }

  function fire() {
    if (state !== 'play' || reload > 0 || ammo <= 0) return;
    ammo--; muzzle = 0.12;
    const s = sway();
    let hit = null, head = false;
    for (let i = targets.length - 1; i >= 0; i--) {
      const f = targets[i];
      if (f.win && (s.x < f.win.x || s.x > f.win.x + f.win.w || s.y < f.win.y || s.y > f.win.y + f.win.h)) continue;
      const dx = s.x - f.x;
      if (Math.hypot(dx, s.y - (f.y - 14)) <= 3.8) { hit = f; head = true; break; }
      if (Math.abs(dx) <= 3.8 && s.y >= f.y - 11.5 && s.y <= f.y) { hit = f; break; }
    }
    if (hit) {
      burst(s.x, s.y, hit.kind === 'enemy' ? '#ff4d5a' : '#7cc8ff', 10);
      removeTarget(hit);
      if (hit.kind === 'enemy') {
        combo++;
        const pts = (head ? 200 : 100) + (combo - 1) * 20;
        score += pts;
        popups.push({ x: s.x, y: s.y - 20, text: (head ? 'HEAD +' : '+') + pts, c: head ? '#ffe27a' : '#fff', life: 1 });
      } else {
        combo = 0; // 市民に当てたときのペナルティはステップ6で
      }
    } else {
      combo = 0;
      burst(s.x, s.y, '#ccc', 5);
    }
    if (ammo <= 0) reload = RELOAD_TIME;
    hud();
  }

  function update(dt) {
    t += dt;
    if (muzzle > 0) muzzle -= dt;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].life -= dt; popups[i].y -= 20 * dt; if (popups[i].life <= 0) popups.splice(i, 1); }
    if (state !== 'play') return;
    elapsed += dt;
    if (reload > 0) { reload -= dt; if (reload <= 0) { reload = 0; ammo = MAX_AMMO; hud(); } }
    spawnTimer -= dt;
    const maxActive = Math.min(7, 2 + Math.floor(elapsed / 12));
    if (spawnTimer <= 0 && targets.length < maxActive) {
      spawn();
      spawnTimer = Math.max(0.55, 1.8 - elapsed * 0.018) * rand(0.7, 1.3);
    }
    for (let i = targets.length - 1; i >= 0; i--) {
      const f = targets[i];
      f.life -= dt;
      if (f.win) {
        const goingOut = f.life < 0.25;
        f.rise = goingOut ? Math.min(18, f.rise + 80 * dt) : Math.max(0, f.rise - 80 * dt);
        f.y = f.win.y + f.win.h + f.rise;
      } else {
        f.x += f.vx * dt;
        if (f.x < f.minX || f.x > f.maxX) { f.vx *= -1; f.x = Math.max(f.minX, Math.min(f.maxX, f.x)); }
      }
      if (f.life <= 0) removeTarget(f);
    }
  }

  function start() {
    resize();
    state = 'play'; score = 0; combo = 0; ammo = MAX_AMMO; reload = 0;
    elapsed = 0; spawnTimer = 0.6; particles = []; popups = []; aiming = false;
    overlay.classList.add('hide');
    hud();
  }

  // ---------- input ----------
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function setAim(p) {
    aimX = Math.max(0, Math.min(W, p.x));
    aimY = Math.max(0, Math.min(H, p.y - touchOffset));
  }
  cv.addEventListener('pointerdown', (e) => {
    if (state !== 'play') return;
    e.preventDefault();
    touchOffset = e.pointerType === 'touch' ? Math.min(90, H * 0.12) : 0;
    aiming = true;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    setAim(pos(e));
  });
  cv.addEventListener('pointermove', (e) => { if (aiming) setAim(pos(e)); });
  cv.addEventListener('pointerup', (e) => { if (!aiming) return; setAim(pos(e)); aiming = false; fire(); });
  cv.addEventListener('pointercancel', () => { aiming = false; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  btnStart.addEventListener('click', start);
  window.addEventListener('resize', () => { if (state !== 'play') resize(); });

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }
  resize(); hud();
  requestAnimationFrame(loop);
})();
