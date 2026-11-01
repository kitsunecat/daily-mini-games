(() => {
  'use strict';
  const CAP = 4;
  const COLORS = ['#ff5a7a', '#ffc93c', '#4cd3ff', '#6ee07a', '#b07aff', '#ff9a3c', '#f7f7f7', '#3c6bff', '#ff7ad9', '#27b39b'];

  const $ = (id) => document.getElementById(id);
  const board = $('board'), overlay = $('overlay');

  let tubes = [];

  // ---------- rendering ----------
  function layout() {
    const n = tubes.length;
    const stage = $('stage');
    const W = stage.clientWidth - 12, H = stage.clientHeight - 12;
    const rows = n <= 6 ? 1 : 2;
    const perRow = Math.ceil(n / rows);
    const gapX = 12;
    const tw = Math.max(30, Math.min(54, (W - gapX * (perRow - 1)) / perRow));
    const rowH = (H - 26 * rows) / rows;
    const seg = Math.max(22, Math.min(40, (rowH - 30) / CAP, tw * 0.85));
    board.style.setProperty('--tw', tw + 'px');
    board.style.setProperty('--seg', seg + 'px');
    board.style.maxWidth = (perRow * tw + (perRow - 1) * gapX + 2) + 'px';
  }

  function render() {
    board.innerHTML = '';
    tubes.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tube';
      el.dataset.i = i;
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = (i + 1) % 10;
      el.appendChild(num);
      t.forEach((c) => {
        const s = document.createElement('div');
        s.className = 'seg';
        s.style.background = `linear-gradient(90deg, ${COLORS[c]}, ${COLORS[c]}cc)`;
        el.appendChild(s);
      });
      board.appendChild(el);
    });
  }

  // ---------- game flow ----------
  function startGame() {
    overlay.classList.add('hide');
    tubes = [
      [0, 1, 2, 0],
      [1, 2, 0, 1],
      [2, 0, 1, 2],
      [],
      [],
    ];
    layout(); render();
  }

  // ---------- input ----------
  $('start').addEventListener('click', startGame);

  window.addEventListener('resize', () => { if (tubes.length) { layout(); render(); } });
})();
