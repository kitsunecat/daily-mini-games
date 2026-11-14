(() => {
  'use strict';
  const W = 360, H = 560;
  const CW = 32, CH = 46;
  const HW = 58, HH = 82;
  const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RED = [false, true, true, false];

  const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best');
  const stageEl = document.getElementById('stage-no');
  const overlay = document.getElementById('overlay'), ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text'), startBtn = document.getElementById('start');
  const stage = document.getElementById('stage');

  let state = 'title';
  let time = 0;
  let scale = 1;

  function resize() {
    const sw = stage.clientWidth - 16, sh = stage.clientHeight - 8;
    scale = Math.max(0.3, Math.min(sw / W, sh / H));
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = Math.floor(W * scale) + 'px';
    cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr);
    cv.height = Math.floor(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  // --- deal ---
  function shuffled() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ rank: r, suit: s });
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  const demo = shuffled(); // 見本（ステップ3で消す）

  function start() {
    state = 'play'; overlay.classList.add('hidden');
  }

  // --- input ---
  startBtn.addEventListener('click', start);

  // --- drawing ---
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cardBack(x, y, w, h) {
    rr(x, y, w, h, w * 0.14); ctx.fillStyle = '#fff'; ctx.fill();
    const m = w * 0.09;
    rr(x + m, y + m, w - 2 * m, h - 2 * m, w * 0.1);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2f63c9'); g.addColorStop(1, '#173a8a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (let k = -h; k < w + h; k += w * 0.22) { ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + k + h, y + h); ctx.stroke(); }
    ctx.restore();
  }
  function cardFace(c, x, y, w, h, opt = {}) {
    rr(x, y, w, h, w * 0.14);
    ctx.fillStyle = opt.dim ? '#d9ddd6' : '#fffdf6'; ctx.fill();
    ctx.lineWidth = opt.glow ? 2.5 : 1;
    ctx.strokeStyle = opt.glow ? '#ffd23a' : 'rgba(0,0,0,.25)'; ctx.stroke();
    const col = RED[c.suit] ? '#d33a3a' : '#1f2430';
    ctx.fillStyle = opt.dim ? (RED[c.suit] ? '#b87a7a' : '#6c707a') : col;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = w > 40;
    ctx.font = `bold ${Math.round(w * (big ? 0.36 : 0.44))}px system-ui, sans-serif`;
    ctx.fillText(RANKS[c.rank], x + w / 2, y + h * (big ? 0.3 : 0.32));
    ctx.font = `${Math.round(w * (big ? 0.5 : 0.48))}px system-ui, "Segoe UI Symbol", sans-serif`;
    ctx.fillText(SUITS[c.suit], x + w / 2, y + h * 0.7);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.4, H * 0.8);
    bg.addColorStop(0, '#2c8a5f'); bg.addColorStop(1, '#14553a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 2;
    rr(6, 6, W - 12, H - 12, 12); ctx.stroke();

    // 見本（ステップ3で消す）
    for (let i = 0; i < 9; i++) cardFace(demo[i], 18 + i * 36, 60, CW, CH);
    cardFace(demo[9], 90, 200, HW, HH);
    cardBack(210, 200, HW, HH);
  }

  // --- loop ---
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    render();
    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
