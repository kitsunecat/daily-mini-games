(() => {
  'use strict';
  const W = 360, H = 600;
  const LEFT = 12, RIGHT = W - 12, FLOOR = H - 12, DANGER = 112, DROP_Y = 62;
  const RADII = [13, 17, 23, 29, 36, 44, 53, 62, 72, 83, 96];
  const NAMES = ['ちり', 'すな', 'いし', 'こおり', 'つき', 'みずぼし', 'あかぼし', 'わくせい', 'わっか', 'あおぼし', 'たいよう'];
  const COLORS = [
    ['#d9d4ff', '#8c84c9'], ['#ffd0e6', '#d4729f'], ['#c9f1ff', '#4aa7d4'], ['#e8fff1', '#59c28a'],
    ['#fff6c9', '#d8b84a'], ['#bfe0ff', '#3a6fd8'], ['#ffc2a8', '#d6542e'], ['#f3dcb6', '#b07a3c'],
    ['#ffe9b3', '#c9902e'], ['#c6f0ff', '#2f8fc9'], ['#fff3a0', '#ff8a1c']
  ];

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const nextCv = document.getElementById('next'), nctx = nextCv.getContext('2d');
  const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text'), startBtn = document.getElementById('start');
  const stage = document.getElementById('stage');

  let state = 'title';
  let cur = 0, nxt = 0, dangerT = 0, time = 0;
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

  function randLevel() { const r = Math.random(); return r < 0.3 ? 0 : r < 0.55 ? 1 : r < 0.78 ? 2 : r < 0.93 ? 3 : 4; }

  function reset() {
    cur = randLevel(); nxt = randLevel();
    drawNext();
  }

  function start() {
    reset(); state = 'play'; overlay.classList.add('hidden');
  }

  function drawOrb(c, x, y, r, lv) {
    const [hi, base] = COLORS[lv];
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, hi); g.addColorStop(1, base);
    if (lv === 10) { c.save(); c.shadowColor = '#ffb020'; c.shadowBlur = 18; }
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    if (lv === 10) c.restore();
    if (lv === 8) { // ring
      c.strokeStyle = 'rgba(255,240,200,.85)'; c.lineWidth = r * 0.12;
      c.beginPath(); c.ellipse(x, y, r * 1.0, r * 0.28, -0.35, 0, Math.PI * 2); c.stroke();
    }
    if (lv === 4 || lv === 7) { // craters
      c.fillStyle = 'rgba(0,0,0,.12)';
      c.beginPath(); c.arc(x + r * 0.3, y + r * 0.2, r * 0.18, 0, 7); c.fill();
      c.beginPath(); c.arc(x - r * 0.25, y + r * 0.42, r * 0.11, 0, 7); c.fill();
    }
    // face
    c.fillStyle = 'rgba(40,20,60,.75)';
    const er = Math.max(1.4, r * 0.08);
    c.beginPath(); c.arc(x - r * 0.28, y - r * 0.02, er, 0, 7); c.arc(x + r * 0.28, y - r * 0.02, er, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,20,60,.75)'; c.lineWidth = Math.max(1, r * 0.06);
    c.beginPath(); c.arc(x, y + r * 0.12, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }

  function drawNext() {
    nctx.clearRect(0, 0, 64, 64);
    const r = Math.min(28, RADII[nxt] * 1.2);
    drawOrb(nctx, 32, 32, r, nxt);
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
    // aim
    if (state === 'play') {
      drawOrb(ctx, W / 2, DROP_Y, RADII[cur], cur);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000); last = now; time += dt;
    draw();
    requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', ev => { ev.stopPropagation(); start(); });
  overlay.addEventListener('click', () => start());

  reset(); resize(); requestAnimationFrame(loop);
})();
