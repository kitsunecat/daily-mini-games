(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const TRAY_SIZE = 7;
  const COLS = 6, ROWS = 7; // 1段目のマス数（座標は半マス単位）

  // 絵柄（色と描画関数）
  const TYPES = [
    { c: '#e5484d', draw: (r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); } },
    { c: '#f08c2b', draw: (r) => { poly(3, r * 1.15, -Math.PI / 2, 0.22 * r); } },
    { c: '#e8b500', draw: (r) => { star(5, r * 1.1, r * 0.48); } },
    { c: '#3aa45c', draw: (r) => { ctx.save(); ctx.rotate(-Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } },
    { c: '#2f7de1', draw: (r) => { poly(4, r * 1.15, -Math.PI / 2, 0); } },
    { c: '#9b5de5', draw: (r) => { heart(r); } },
    { c: '#e05fa8', draw: (r) => { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill(); } },
    { c: '#16a3a3', draw: (r) => { roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.3); ctx.fill(); } },
    { c: '#a0673a', draw: (r) => { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75, false); ctx.arc(r * 0.45, -r * 0.1, r * 0.75, Math.PI * 1.6, Math.PI * 0.4, true); ctx.closePath(); ctx.fill(); } },
    { c: '#2c3e8f', draw: (r) => { const w = r * 0.62; ctx.fillRect(-w / 2, -r, w, r * 2); ctx.fillRect(-r, -w / 2, r * 2, w); } },
  ];
  function poly(n, r, rot, round) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i * Math.PI * 2 / n;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (round) { ctx.lineJoin = 'round'; ctx.lineWidth = round; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
    ctx.fill();
  }
  function star(n, ro, ri) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const r = i % 2 ? ri : ro;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  function heart(r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.95);
    ctx.bezierCurveTo(-r * 1.4, 0, -r * 0.9, -r * 1.2, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.9, -r * 1.2, r * 1.4, 0, 0, r * 0.95);
    ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- 状態 ----
  let T = 50, W = 0, H = 0, PAD = 0, dpr = 1;

  // ---- レイアウト ----
  function resize() {
    const r = stageEl.getBoundingClientRect();
    const aw = r.width - 16, ah = r.height - 12;
    T = Math.max(20, Math.min(aw / 6.5, ah / 9.15));
    PAD = T * 0.25;
    W = Math.floor(T * 6.5); H = Math.floor(T * 9.15);
    dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
  }
  const trayY = () => PAD + ROWS * T + T * 0.4;
  const slotW = () => (W - PAD * 2) / TRAY_SIZE;
  function slotCenter(i) {
    return { x: PAD + slotW() * (i + 0.5), y: trayY() + T * 0.62 };
  }

  // ---- 入力 ----
  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  window.addEventListener('resize', () => { resize(); render(); });

  // ---- 描画 ----
  function drawTile(cx, cy, size, type, dim) {
    const s = size * 0.94;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    roundRect(-s / 2, -s / 2 + size * 0.07, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = '#c9b48a';
    roundRect(-s / 2, -s / 2 + size * 0.035, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = '#fff8e8';
    roundRect(-s / 2, -s / 2, s, s, s * 0.18); ctx.fill();
    ctx.fillStyle = TYPES[type].c;
    TYPES[type].draw(s * 0.28);
    if (dim) {
      ctx.fillStyle = 'rgba(20,40,38,.5)';
      roundRect(-s / 2, -s / 2, s, s + size * 0.035, s * 0.18); ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 仮の目印：盤面になる範囲
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, COLS * T, ROWS * T);

    // 仮：10種類のタイルを並べて表示（暗いタイルは「取れない」表示の見本）
    for (let i = 0; i < TYPES.length; i++) {
      const x = PAD + T * (0.75 + (i % 5) * 1.25);
      const y = PAD + T * (1 + Math.floor(i / 5) * 1.5);
      drawTile(x, y, T, i, i === TYPES.length - 1);
    }

    // トレイ
    const ty = trayY();
    ctx.fillStyle = '#0c2422';
    roundRect(PAD * 0.6, ty, W - PAD * 1.2, T * 1.25, T * 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < TRAY_SIZE; i++) {
      const c = slotCenter(i);
      roundRect(c.x - slotW() * 0.44, c.y - slotW() * 0.44, slotW() * 0.88, slotW() * 0.88, T * 0.12); ctx.fill();
    }
    // 仮：トレイにも小さいタイルを3枚
    for (let i = 0; i < 3; i++) {
      const c = slotCenter(i);
      drawTile(c.x, c.y, slotW() * 0.95, i, false);
    }
  }

  resize();
  render();
})();
