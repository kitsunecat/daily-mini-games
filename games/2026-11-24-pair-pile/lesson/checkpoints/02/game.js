(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board'), wrap = $('board-wrap');

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

  // 仮: 36種類の絵柄を 6×6 に並べて見てみる
  function buildStage() {
    boardEl.innerHTML = '';
    for (let k = 0; k < 36; k++) {
      const el = document.createElement('div');
      el.className = 'tile';
      el.style.left = (k % 6) * 50 + 'px';
      el.style.top = Math.floor(k / 6) * 66 + 'px';
      el.innerHTML = kindSvg(k);
      boardEl.appendChild(el);
    }
    boardEl.style.width = '300px';
    boardEl.style.height = '396px';
    boardEl.style.transform = 'translate(-50%,-50%)';
  }

  function setMsg(t) { $('msg').textContent = t; }

  function startStage() {
    $('overlay').classList.add('hide');
    setMsg('同じ絵柄をペアで消そう');
  }

  $('start').addEventListener('click', startStage);

  buildStage();
})();
