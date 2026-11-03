(() => {
  'use strict';
  const W = 360, H = 600;
  const CX = 180, CY = 220, R = 74;

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

  function spinSpeed() {
    return spinBase;
  }

  function start() {
    overlay.classList.add('hide');
    state = 'play';
  }

  // ---- update / draw ----
  function update(dt) {
    t += dt;
    if (state === 'play' || state === 'over' || state === 'title') rot += spinSpeed() * dt;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

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

    ctx.restore();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  // ---- input ----
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
})();
