(() => {
  'use strict';
  const W = 360, H = 600;
  const LEFT = 12, RIGHT = W - 12, FLOOR = H - 12, DANGER = 112, DROP_Y = 62;

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const nextCv = document.getElementById('next'), nctx = nextCv.getContext('2d');
  const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text'), startBtn = document.getElementById('start');
  const stage = document.getElementById('stage');

  let state = 'title';
  let dangerT = 0, time = 0;
  let scale = 1;

  function resize() {
    const sw = stage.clientWidth - 16, sh = stage.clientHeight - 8;
    scale = Math.min(sw / W, sh / H);
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    draw();
  }
  window.addEventListener('resize', resize);

  function start() {
    state = 'play'; overlay.classList.add('hidden');
  }

  function draw() {
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#24184f'); bg.addColorStop(1, '#3d2a6a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97) % W, sy = (i * 53) % H, tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
      ctx.globalAlpha = 0.2 + tw * 0.4; ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
    // box
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(LEFT, DANGER - 10, RIGHT - LEFT, FLOOR - DANGER + 10);
    ctx.strokeStyle = 'rgba(220,200,255,.6)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(LEFT - 1, DANGER - 10); ctx.lineTo(LEFT - 1, FLOOR + 1); ctx.lineTo(RIGHT + 1, FLOOR + 1); ctx.lineTo(RIGHT + 1, DANGER - 10); ctx.stroke();
    // danger line
    const flash = dangerT > 0 ? 0.5 + 0.5 * Math.sin(time * 20) : 0.5;
    ctx.strokeStyle = `rgba(255,80,90,${flash})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(LEFT, DANGER); ctx.lineTo(RIGHT, DANGER); ctx.stroke(); ctx.setLineDash([]);
  }

  startBtn.addEventListener('click', ev => { ev.stopPropagation(); start(); });
  overlay.addEventListener('click', () => start());

  resize();
})();
