(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const boardEl = $('board'), wrap = $('board-wrap');

  function setMsg(t) { $('msg').textContent = t; }

  function startStage() {
    $('overlay').classList.add('hide');
    setMsg('同じ絵柄をペアで消そう');
  }

  $('start').addEventListener('click', startStage);
})();
