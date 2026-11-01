(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const board = $('board'), overlay = $('overlay');

  // ---------- game flow ----------
  function startGame() {
    overlay.classList.add('hide');
  }

  // ---------- input ----------
  $('start').addEventListener('click', startGame);
})();
