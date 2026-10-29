(() => {
  'use strict';

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stageEl = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');

  const TRAY_SIZE = 7;
  const COLS = 6, ROWS = 7; // 1段目のマス数（座標は半マス単位）

  // 各段の候補位置（半マス単位、タイルは 2x2 を占める）
  const LAYER_SLOTS = [
    grid(0, 10, 0, 12),
    grid(1, 9, 1, 11),
    grid(2, 8, 2, 10),
    grid(3, 7, 3, 9),
  ];
  function grid(x0, x1, y0, y1) {
    const out = [];
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) out.push({ x, y });
    return out;
  }

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
  let tiles = [];      // { x, y, layer, type, shake }

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
  function tileCenter(t) {
    return { x: PAD + (t.x + 1) * T / 2, y: PAD + (t.y + 1) * T / 2 - t.layer * T * 0.07 };
  }
  function slotCenter(i) {
    return { x: PAD + slotW() * (i + 0.5), y: trayY() + T * 0.62 };
  }

  // ---- ステージ生成 ----
  const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
  function isBlocked(t) {
    for (const o of tiles) if (o.layer > t.layer && overlaps(o, t)) return true;
    return false;
  }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function buildStage(n) {
    const total = Math.min(27 + (n - 1) * 9, 66);
    const typeCount = Math.min(4 + n, TYPES.length);
    const ratios = [0.42, 0.3, 0.18, 0.1];
    const placed = [];
    let left = total;
    for (let L = 0; L < LAYER_SLOTS.length && left > 0; L++) {
      const want = L === LAYER_SLOTS.length - 1 ? left : Math.min(left, Math.round(total * ratios[L]));
      let cands = shuffled(LAYER_SLOTS[L]);
      if (L > 0) cands = cands.filter((s) => placed.some((p) => p.layer === L - 1 && overlaps(p, s)));
      const take = cands.slice(0, want);
      take.forEach((s) => placed.push({ x: s.x, y: s.y, layer: L, type: -1, shake: 0 }));
      left -= take.length;
    }
    // 端数は1段目から足りない分を補う
    if (left > 0) {
      const used = new Set(placed.filter((p) => p.layer === 0).map((p) => p.x + ',' + p.y));
      for (const s of shuffled(LAYER_SLOTS[0])) {
        if (left <= 0) break;
        if (!used.has(s.x + ',' + s.y)) { placed.push({ x: s.x, y: s.y, layer: 0, type: -1, shake: 0 }); left--; }
      }
    }
    // 数を3の倍数にそろえる
    while (placed.length % 3) placed.pop();
    tiles = placed;
    assignTypes(typeCount);
  }

  // 仮：絵柄をランダムに割り当てる（ステップ6で「必ず解ける」割り当てに置きかえる）
  function assignTypes(typeCount) {
    tiles.forEach((t) => { t.type = Math.random() * typeCount | 0; });
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

    // 盤面（下の段から順に描く）
    const order = tiles.slice().sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x);
    for (const t of order) {
      const c = tileCenter(t);
      drawTile(c.x, c.y, T, t.type, isBlocked(t));
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
  }

  resize();
  buildStage(1);
  render();
})();
