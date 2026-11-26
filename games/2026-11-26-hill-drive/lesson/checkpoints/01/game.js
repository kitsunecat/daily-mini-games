(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const msgEl = $('msg');
  const overlay = $('overlay'), startBtn = $('start');

  // ---------- flow ----------
  function start() {
    overlay.classList.add('hidden');
    msgEl.textContent = '右でアクセル、左でブレーキ。空中で向きを整えよう';
  }

  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) start(); });
})();
