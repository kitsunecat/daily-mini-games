(() => {
  'use strict';
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), kcEl = $('kc'), boardEl = $('board');
  const overlay = $('overlay'), ovTitle = $('ov-title'), ovText = $('ov-text'), startBtn = $('start');
  const boostBtn = $('boost'), msgEl = $('msg');

  let state = 'title';   // title | play | dying | over

  // ---- flow ----
  function start() {
    state = 'play';
    overlay.classList.add('hidden');
    msgEl.textContent = '進みたい方向をタッチ！';
  }

  // ---- input ----
  startBtn.addEventListener('click', start);
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) { e.preventDefault(); start(); } });
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if ((k === 'Enter' || k === ' ') && state !== 'play' && state !== 'dying') { e.preventDefault(); start(); return; }
  });
})();
