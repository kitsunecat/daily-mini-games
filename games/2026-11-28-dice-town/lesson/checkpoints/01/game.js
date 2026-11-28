(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const stage = $('stage');
  const ui = {
    score: $('score'), best: $('best'), coins: $('coins'), dice: $('dice'), msg: $('msg'),
    mult: $('mult'), roll: $('roll'), build: $('build'), cost: $('cost'),
    overlay: $('overlay'), ovTitle: $('ov-title'), ovText: $('ov-text'), start: $('start'),
  };

  // ---- 状態 ----
  const S = { playing: false, busy: false };

  function setMsg(t) { ui.msg.textContent = t; }

  // ---- 進行 ----
  function start() {
    Object.assign(S, { playing: true, busy: false });
    ui.overlay.classList.add('hidden');
    setMsg('「ふる！」でサイコロをふろう');
  }

  ui.start.addEventListener('click', start);
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (!S.playing) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!ui.overlay.classList.contains('hidden')) start(); } return; }
  });
})();
