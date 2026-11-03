(() => {
  'use strict';
  const W = 360, H = 600;
  const CX = 180, CY = 220, R = 74;
  const DART_LEN = 64, EMBED = 14;
  const THROW_Y = 520, THROW_SPEED = 2000;
  const HIT_GAP = 0.16, STAR_GAP = 0.22;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), stageEl = $('stage-no'), dartsEl = $('darts');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start'), toast = $('toast');

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ---- state ----
  let state = 'title'; // title | play | clear | over
  let score = 0, stage = 1;
  let rot = 0, t = 0, spinBase = 1.6, pattern = 0;
  let stuck = [];   // local angles of darts in the wheel
  let stars = [];   // local angles of bonus stars
  let left = 0, total = 0;
  let flying = null; // {y}
  let bounce = null; // {x,y,vx,vy,a,va}
  let parts = [];
  let wheelAlive = true, shake = 0, timer = 0, ready = 0;

  const norm = (a) => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
  const angDiff = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, Math.PI * 2 - d); };

  function setupStage() {
    const boss = stage % 5 === 0;
    total = Math.min(5 + stage, 11) + (boss ? 1 : 0);
    left = total;
    stuck = []; stars = [];
    const pre = Math.min(stage - 1, 5);
    for (let i = 0; i < pre; i++) {
      let a, tries = 0;
      do { a = Math.random() * Math.PI * 2; tries++; } while (tries < 50 && stuck.some((s) => angDiff(s, a) < 0.6));
      stuck.push(a);
    }
    const ns = Math.random() < 0.3 ? 2 : 1;
    for (let i = 0; i < ns; i++) {
      let a, tries = 0;
      do { a = Math.random() * Math.PI * 2; tries++; } while (tries < 50 && (stuck.concat(stars)).some((s) => angDiff(s, a) < 0.5));
      stars.push(a);
    }
    spinBase = (1.4 + Math.min(stage, 12) * 0.12) * (Math.random() < 0.5 ? 1 : -1);
    pattern = boss ? 2 : (stage >= 3 ? (stage % 2) : 0);
    t = 0; wheelAlive = true; flying = null; ready = 0.25;
    stageEl.textContent = stage;
    renderDarts();
    showToast(boss ? 'BOSS STAGE!' : 'STAGE ' + stage);
  }

  function spinSpeed() {
    if (pattern === 0) return spinBase;
    if (pattern === 1) return spinBase * (1 + 0.6 * Math.sin(t * 1.7));
    // boss: speeds up, slows, reverses
    return spinBase * 1.2 * Math.sin(t * 0.9) + spinBase * 0.35 * Math.sin(t * 3.1);
  }

  function renderDarts() {
    let h = '';
    for (let i = 0; i < total; i++) h += '<i class="' + (i < total - left ? 'used' : '') + '"></i>';
    dartsEl.innerHTML = h;
  }

  let toastTimer = 0;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 800);
  }

  function addScore(n) { score += n; scoreEl.textContent = score; }

  function start() {
    score = 0; stage = 1; scoreEl.textContent = 0;
    parts = []; bounce = null; rot = 0;
    overlay.classList.add('hide');
    state = 'play';
    setupStage();
  }

  function throwDart() {
    if (state !== 'play' || flying || left <= 0 || ready > 0 || !wheelAlive) return;
    left--; renderDarts();
    flying = { y: THROW_Y };
  }

  function onHit() {
    const local = norm(Math.PI / 2 - rot);
    if (stuck.some((s) => angDiff(s, local) < HIT_GAP)) {
      // fail
      bounce = { x: CX, y: CY + R + DART_LEN / 2, vx: (Math.random() - 0.5) * 200, vy: 380, a: 0, va: (Math.random() < 0.5 ? -1 : 1) * 12 };
      flying = null; shake = 0.3;
      gameOver();
      return;
    }
    stuck.push(local); flying = null; shake = 0.08;
    addScore(1);
    for (let i = 0; i < 5; i++) parts.push({ x: CX, y: CY + R, vx: (Math.random() - 0.5) * 160, vy: Math.random() * 120 + 40, life: 0.4, c: '#d9a066', s: 3 });
    const si = stars.findIndex((s) => angDiff(s, local) < STAR_GAP);
    if (si >= 0) {
      stars.splice(si, 1); addScore(5);
      for (let i = 0; i < 14; i++) parts.push({ x: CX, y: CY + R + 10, vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320, life: 0.6, c: '#ffd36b', s: 4 });
      showToast('+5 ★');
    }
    if (left === 0) clearStage();
  }

  function clearStage() {
    state = 'clear'; wheelAlive = false; timer = 1.1;
    addScore(stage * 5);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 260;
      parts.push({ x: CX + Math.cos(a) * R * 0.6, y: CY + Math.sin(a) * R * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 1, c: i % 3 ? '#b77b45' : '#ffcf8a', s: 6 + Math.random() * 6, g: 1 });
    }
    // stuck darts fly off too
    stuck.forEach((s) => {
      const a = s + rot;
      parts.push({ x: CX + Math.cos(a) * (R + 20), y: CY + Math.sin(a) * (R + 20), vx: Math.cos(a) * 260, vy: Math.sin(a) * 260 - 100, life: 1, dart: a, va: (Math.random() - 0.5) * 14, g: 1 });
    });
    stuck = [];
    showToast('CLEAR! +' + stage * 5);
  }

  function gameOver() {
    state = 'over'; timer = 0.9;
  }

  function showOver() {
    ovTitle.textContent = 'ゲームオーバー';
    ovText.innerHTML = 'ステージ ' + stage + ' まで到達<br>スコア <b>' + score + '</b>';
    startBtn.textContent = 'もう一度';
    overlay.classList.remove('hide');
  }

  // ---- update / draw ----
  function update(dt) {
    t += dt;
    if (ready > 0) ready -= dt;
    if (state === 'play' || state === 'over' || state === 'title') rot += spinSpeed() * dt;
    if (flying) {
      flying.y -= THROW_SPEED * dt;
      if (flying.y - DART_LEN / 2 <= CY + R - EMBED) onHit();
    }
    if (bounce) {
      bounce.vy += 1400 * dt; bounce.x += bounce.vx * dt; bounce.y += bounce.vy * dt; bounce.a += bounce.va * dt;
      if (bounce.y > H + 80) bounce = null;
    }
    parts.forEach((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ? 900 : 300) * dt; p.life -= dt;
      if (p.dart !== undefined) p.dart += p.va * dt;
    });
    parts = parts.filter((p) => p.life > 0);
    if (shake > 0) shake -= dt;
    if (state === 'clear') { timer -= dt; if (timer <= 0) { stage++; state = 'play'; setupStage(); } }
    if (state === 'over' && timer > 0) { timer -= dt; if (timer <= 0) showOver(); }
  }

  function drawDart(x, y, angle) {
    // angle: direction from tip to tail. Tip at (x,y).
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    // shaft along +x
    ctx.fillStyle = '#e8e8f0'; ctx.fillRect(0, -2, DART_LEN * 0.65, 4);
    ctx.fillStyle = '#9aa0b5'; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(10, -3.5); ctx.lineTo(10, 3.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff6fae'; ctx.fillRect(DART_LEN * 0.4, -3.5, DART_LEN * 0.22, 7);
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath(); ctx.moveTo(DART_LEN * 0.65, 0); ctx.lineTo(DART_LEN, -10); ctx.lineTo(DART_LEN * 0.92, 0); ctx.lineTo(DART_LEN, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);

    if (wheelAlive) {
      // stars on rim
      stars.forEach((s) => {
        const a = s + rot;
        const x = CX + Math.cos(a) * (R + 14), y = CY + Math.sin(a) * (R + 14);
        ctx.fillStyle = '#ffd36b'; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10;
        drawStar(x, y, 11); ctx.shadowBlur = 0;
      });
      // stuck darts (behind wheel face edge)
      stuck.forEach((s) => {
        const a = s + rot;
        drawDart(CX + Math.cos(a) * (R - EMBED), CY + Math.sin(a) * (R - EMBED), a);
      });
      // wheel
      ctx.save(); ctx.translate(CX, CY); ctx.rotate(rot);
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, R);
      g.addColorStop(0, '#e0a86a'); g.addColorStop(1, '#9c6334');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,40,15,.45)'; ctx.lineWidth = 2;
      [0.75, 0.5, 0.25].forEach((k) => { ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); });
      ctx.strokeStyle = 'rgba(80,40,15,.3)';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
      ctx.fillStyle = stage % 5 === 0 ? '#ff5a7a' : '#ff8fc8';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // particles
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.dart !== undefined) drawDart(p.x, p.y, p.dart);
      else { ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    });
    ctx.globalAlpha = 1;

    // flying dart (tip up)
    if (flying) drawDart(CX, flying.y - DART_LEN / 2, Math.PI / 2);
    if (bounce) drawDart(bounce.x, bounce.y, Math.PI / 2 + bounce.a);

    // ready dart
    if (state === 'play' && !flying && left > 0 && wheelAlive) {
      drawDart(CX, THROW_Y - DART_LEN / 2 + (ready > 0 ? ready * 120 : 0), Math.PI / 2);
    }
    ctx.restore();

    // hint
    if (state === 'play' && stuck.length === 0 && left === total) {
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('タップで投げる', CX, H - 20);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  // title preview
  stuck = [0.3, 2.2, 4.1]; stars = [1.2]; total = 0; left = 0;
  requestAnimationFrame(loop);

  // ---- input ----
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  $('stage').addEventListener('pointerdown', (e) => {
    if (e.target === startBtn) return;
    if (state === 'play') { e.preventDefault(); throwDart(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (state === 'play') throwDart(); }
    if (e.code === 'Enter' && !overlay.classList.contains('hide')) { e.preventDefault(); start(); }
  });
})();
