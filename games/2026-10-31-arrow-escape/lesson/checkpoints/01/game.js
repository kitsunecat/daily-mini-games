(() => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), startBtn = $('start');

  let N = 5;
  let W = 0, H = 0, dpr = 1;

  // ---- レイアウト ----
  function resize() {
    const rect = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function board() {
    const size = Math.min(W, H) * 0.92;
    const cell = size / N;
    return { x: (W - size) / 2, y: (H - size) / 2, size, cell };
  }

  // ---- 描画 ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!W) return;
    const b = board();
    // マス目
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)';
      roundRect(b.x + c * b.cell + 2, b.y + r * b.cell + 2, b.cell - 4, b.cell - 4, b.cell * 0.14);
      ctx.fill();
    }
  }

  startBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  window.addEventListener('resize', () => { resize(); draw(); });
  resize();
  draw();
})();
