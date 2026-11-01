(() => {
  'use strict';
  const CAP = 4;
  const COLORS = ['#ff5a7a', '#ffc93c', '#4cd3ff', '#6ee07a', '#b07aff', '#ff9a3c', '#f7f7f7', '#3c6bff', '#ff7ad9', '#27b39b'];

  const $ = (id) => document.getElementById(id);
  const board = $('board'), overlay = $('overlay');

  let tubes = [];
  let sel = -1;

  // ---------- puzzle logic ----------
  const top = (t) => t[t.length - 1];
  function runLen(t) {
    let n = 0; const c = top(t);
    for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
    return n;
  }
  function canPour(a, b) {
    if (a === b || !a.length || b.length >= CAP) return false;
    return !b.length || top(b) === top(a);
  }

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

  function render(pourTo = -1, pourN = 0) {
    board.innerHTML = '';
    tubes.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'tube' + (i === sel ? ' sel' : '');
      el.dataset.i = i;
      const num = document.createElement('span');
      num.className = 'num'; num.textContent = (i + 1) % 10;
      el.appendChild(num);
      t.forEach((c, k) => {
        const s = document.createElement('div');
        s.className = 'seg' + (i === pourTo && k >= t.length - pourN ? ' new' : '');
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
    sel = -1;
    layout(); render();
  }

  function tap(i) {
    if (i < 0 || i >= tubes.length) return;
    if (sel < 0) {
      if (!tubes[i].length) { shake(i); return; }
      sel = i; render(); return;
    }
    if (sel === i) { sel = -1; render(); return; }
    const a = tubes[sel], b = tubes[i];
    if (!canPour(a, b)) {
      // switch selection if tapping another pourable tube
      if (b.length) { sel = i; render(); }
      else { shake(i); }
      return;
    }
    const n = Math.min(runLen(a), CAP - b.length);
    for (let m = 0; m < n; m++) b.push(a.pop());
    sel = -1;
    render(i, n);
  }

  function shake(i) {
    const el = board.children[i];
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // ---------- input ----------
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.tube');
    if (!el) return;
    tap(+el.dataset.i);
  });
  $('start').addEventListener('click', startGame);

  window.addEventListener('resize', () => { if (tubes.length) { layout(); render(); } });
})();
