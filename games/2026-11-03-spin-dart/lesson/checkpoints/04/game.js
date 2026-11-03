(() => {
  'use strict';
  const W = 360, H = 600;
  const CX = 180, CY = 220, R = 74;
  const DART_LEN = 64, EMBED = 14;
  const THROW_Y = 520, THROW_SPEED = 2000;

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
  let rot = 0, t = 0, spinBase = 1.6;
  let score = 0;
  let stuck = [];   // local angles of darts in the wheel
  let flying = null; // {y}

  const norm = (a) => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };

  function spinSpeed() {
    return spinBase;
  }

  function addScore(n) { score += n; scoreEl.textContent = score; }

  function start() {
    score = 0; scoreEl.textContent = 0;
    stuck = []; rot = 0;
    overlay.classList.add('hide');
    state = 'play';
  }

  function throwDart() {
    if (state !== 'play' || flying) return;
    flying = { y: THROW_Y };
  }

  function onHit() {
    const local = norm(Math.PI / 2 - rot);
    stuck.push(local); flying = null;
    addScore(1);
  }

  // ---- update / draw ----
  function update(dt) {
    t += dt;
    if (state === 'play' || state === 'over' || state === 'title') rot += spinSpeed() * dt;
    if (flying) {
      flying.y -= THROW_SPEED * dt;
      if (flying.y - DART_LEN / 2 <= CY + R - EMBED) onHit();
    }
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

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

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
    ctx.fillStyle = '#ff8fc8';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a3416'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // flying dart (tip up)
    if (flying) drawDart(CX, flying.y - DART_LEN / 2, Math.PI / 2);

    // ready dart
    if (state === 'play' && !flying) {
      drawDart(CX, THROW_Y - DART_LEN / 2, Math.PI / 2);
    }
    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  // title preview
  stuck = [0.3, 2.2, 4.1];
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
