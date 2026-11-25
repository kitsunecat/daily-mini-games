(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const msgEl = $('msg');
  const overlay = $('overlay'), startBtn = $('start');

  startBtn.addEventListener('click', start);

  function msg(s) { msgEl.textContent = s; }

  function start() {
    overlay.classList.add('hidden');
    msg('いちばん下のタイルからタップ！');
  }
})();
