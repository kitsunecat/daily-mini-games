(() => {
  const N = 8;

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText = document.getElementById('ov-text');
  const startBtn = document.getElementById('start');

  let playing = false;

  // ---- game logic ----
  function start() {
    playing = true;
    overlay.classList.add('hidden');
  }

  startBtn.addEventListener('click', start);
})();
