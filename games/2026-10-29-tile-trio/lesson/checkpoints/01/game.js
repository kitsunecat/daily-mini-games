(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const TRAY_SIZE = 7;
  const COLS = 6, ROWS = 7; // 1段目のマス数（座標は半マス単位）

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
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 仮の目印：盤面になる範囲
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, COLS * T, ROWS * T);

    // トレイ
    const ty = trayY();
    ctx.fillStyle = '#0c2422';
    roundRect(PAD * 0.6, ty, W - PAD * 1.2, T * 1.25, T * 0.25); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < TRAY_SIZE; i++) {
      const c = slotCenter(i);
      roundRect(c.x - slotW() * 0.44, c.y - slotW() * 0.44, slotW() * 0.88, slotW() * 0.88, T * 0.12); ctx.fill();
    }
  }

  resize();
  render();
})();
