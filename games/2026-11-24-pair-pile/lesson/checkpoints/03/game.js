(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board'), wrap = $('board-wrap');
  const UX = 22, UY = 29, LX = 4, LY = -5; // half-unit size, per-layer offset

  // ---- shapes (SVG) ----
  const COLORS = ['#d9433a', '#2e8b57', '#2f6fd6', '#c98a10'];
  const SHAPES = [
    (c) => `<circle cx="16" cy="16" r="11" fill="${c}"/>`,
    (c) => `<polygon points="16,4 29,27 3,27" fill="${c}"/>`,
    (c) => `<rect x="6" y="6" width="20" height="20" rx="3" fill="${c}"/>`,
    (c) => `<polygon points="16,2 30,16 16,30 2,16" fill="${c}"/>`,
    (c) => `<polygon points="16,2 19.8,11.6 30,12 22,18.6 24.8,29 16,23 7.2,29 10,18.6 2,12 12.2,11.6" fill="${c}"/>`,
    (c) => `<path d="M16 28 C4 20 2 13 6 8 C10 4 14 6 16 10 C18 6 22 4 26 8 C30 13 28 20 16 28Z" fill="${c}"/>`,
    (c) => `<path d="M12 3h8v9h9v8h-9v9h-8v-9H3v-8h9z" fill="${c}"/>`,
    (c) => `<circle cx="16" cy="16" r="10" fill="none" stroke="${c}" stroke-width="5"/>`,
    (c) => `<polygon points="16,3 28,10 28,22 16,29 4,22 4,10" fill="${c}"/><circle cx="16" cy="16" r="4" fill="#fffaf0"/>`,
  ];
  const kindSvg = (k) => `<svg viewBox="0 0 32 32">${SHAPES[k % 9](COLORS[Math.floor(k / 9) % 4])}</svg>`;

  // ---- layouts (x,y in half units; tile = 2x2) ----
  function rect(out, l, x0, y0, cols, rows) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 2, y: y0 + r * 2, l });
  }
  const LAYOUTS = [
    () => { const o = []; rect(o, 0, 0, 0, 8, 6); rect(o, 1, 2, 2, 6, 4); rect(o, 2, 4, 4, 4, 2); rect(o, 3, 6, 5, 2, 1); return o; },
    () => { const o = []; [4, 6, 8, 8, 6, 4].forEach((w, i) => rect(o, 0, 8 - w, i * 2, w, 1));
      [3, 5, 7, 5, 3].forEach((w, i) => rect(o, 1, 8 - w, 1 + i * 2, w, 1));
      rect(o, 2, 6, 3, 2, 1); rect(o, 2, 6, 5, 2, 1); rect(o, 3, 7, 4, 1, 1); return o; },
    () => { const o = []; rect(o, 0, 0, 0, 8, 6); rect(o, 1, 0, 2, 3, 4); rect(o, 1, 10, 2, 3, 4);
      rect(o, 2, 1, 3, 2, 2); rect(o, 2, 11, 3, 2, 2); rect(o, 3, 2, 4, 1, 1); rect(o, 3, 12, 4, 1, 1); return o; },
    () => { const o = []; rect(o, 0, 0, 0, 8, 2); rect(o, 0, 0, 8, 8, 2); rect(o, 0, 0, 4, 2, 2); rect(o, 0, 12, 4, 2, 2);
      rect(o, 0, 5, 5, 3, 1); rect(o, 1, 1, 1, 7, 1); rect(o, 1, 1, 9, 7, 1); rect(o, 1, 6, 5, 2, 1);
      rect(o, 2, 3, 1, 5, 1); rect(o, 2, 3, 9, 5, 1); rect(o, 2, 7, 5, 1, 1); rect(o, 3, 7, 4, 1, 1); return o; },
  ];

  // ---- state ----
  let tiles = [], stage = 1;

  function buildStage() {
    boardEl.innerHTML = '';
    let list = LAYOUTS[(stage - 1) % LAYOUTS.length]();
    if (list.length % 2) list.pop();
    tiles = list.map((p) => ({ ...p, kind: 0, el: null, alive: true }));
    tiles.forEach((t, i) => { t.kind = Math.floor(i / 2) % 12; }); // 仮の絵柄（ステップ6で作りなおす）
    let maxX = 0, maxY = 0;
    tiles.forEach((t) => { maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); });
    tiles.sort((a, b) => a.l - b.l || a.x - b.x || a.y - b.y);
    tiles.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.left = (t.x * UX + t.l * LX + 6) + 'px';
      el.style.top = (t.y * UY + t.l * LY + 20) + 'px';
      el.style.zIndex = t.l * 1000 + t.x * 10 + (40 - t.y);
      el.innerHTML = kindSvg(t.kind);
      t.el = el;
      boardEl.appendChild(el);
    });
    boardEl.style.width = ((maxX + 2) * UX + 30) + 'px';
    boardEl.style.height = ((maxY + 2) * UY + 30) + 'px';
    fit();
  }

  function fit() {
    const w = parseFloat(boardEl.style.width) || 1, h = parseFloat(boardEl.style.height) || 1;
    const s = Math.min((wrap.clientWidth - 8) / w, (wrap.clientHeight - 8) / h, 1.6);
    boardEl.style.transform = `scale(${s}) translate(-50%,-50%)`;
  }
  window.addEventListener('resize', fit);

  function setMsg(t) { $('msg').textContent = t; }

  function startStage() {
    $('overlay').classList.add('hide');
    setMsg('同じ絵柄をペアで消そう');
  }

  $('start').addEventListener('click', startStage);

  buildStage();
})();
