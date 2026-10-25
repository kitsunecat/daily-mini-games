// ハンズオン教材ページ（lesson.html?id=<id>）の表示スクリプト
// 教材の形式は README.md の「ハンズオン教材」を参照。
(async () => {
  const REPO = 'https://github.com/kitsunecat/daily-mini-games';
  const content = document.getElementById('content');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = new URLSearchParams(location.search).get('id') || '';
  const fail = (msg) => { content.innerHTML = `<p class="error">${esc(msg)}</p>`; };
  if (!/^[\w-]+$/.test(id)) return fail('教材が見つかりませんでした。');

  const base = `games/${id}/`;
  const lessonBase = `${base}lesson/`;
  let game, lesson;
  try {
    const [gr, lr] = await Promise.all([fetch('games.json', { cache: 'no-cache' }), fetch(lessonBase + 'lesson.json', { cache: 'no-cache' })]);
    if (!lr.ok) throw new Error(lr.status);
    lesson = await lr.json();
    if (gr.ok) game = (await gr.json()).find((g) => g.id === id);
  } catch (e) {
    return fail('教材が見つかりませんでした。');
  }
  const steps = lesson.steps || [];
  const bodies = await Promise.all(steps.map(async (s) => {
    try {
      const r = await fetch(lessonBase + s.file, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return await r.text();
    } catch (e) {
      return `${s.file} を読み込めませんでした。`;
    }
  }));

  // ---- 最小限の Markdown 変換（見出し・段落・リスト・引用・コードブロック・インライン装飾） ----
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
    s = esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
        const safe = /^(https?:|\.{0,2}\/|#|[\w-])/.test(u) && !/^javascript:/i.test(u);
        const ext = /^https?:/.test(u);
        return safe ? `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>` : t;
      });
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  }
  function markdown(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if ((m = line.match(/^```\s*([\w+-]*)(?::(\S+))?/))) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(codeBlock(buf.join('\n'), m[1], m[2]));
      } else if ((m = line.match(/^(#{2,4})\s+(.*)/))) {
        const lv = Math.min(m[1].length + 1, 5);
        out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
        i++;
      } else if (/^>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        let kind = 'note', title = 'メモ';
        const t = buf[0] && buf[0].match(/^\[!(NOTE|TIP|CHECK|WARNING)\]\s*(.*)/i);
        if (t) {
          kind = t[1].toLowerCase();
          title = t[2] || { note: 'メモ', tip: 'ヒント', check: '動作チェック', warning: '注意' }[kind];
          buf.shift();
        }
        const icon = { note: 'info', tip: 'lightbulb', check: 'task_alt', warning: 'warning' }[kind];
        out.push(`<aside class="callout callout-${kind}"><div class="callout-title"><span class="icon" aria-hidden="true">${icon}</span>${inline(title)}</div>${markdown(buf.join('\n'))}</aside>`);
      } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          let item = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
          items.push(`<li>${inline(item)}</li>`);
        }
        out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      } else if (/^\s*$/.test(line)) {
        i++;
      } else {
        const buf = [];
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(```|#{2,4}\s|>|\s*([-*]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
        out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
      }
    }
    return out.join('\n');
  }
  const LANG = { js: 'javascript', javascript: 'javascript', html: 'xml', xml: 'xml', css: 'css', json: 'json', sh: 'bash', bash: 'bash' };
  function codeBlock(code, lang, file) {
    const hl = LANG[lang] || 'plaintext';
    let html = esc(code);
    if (window.hljs && hl !== 'plaintext') {
      try { html = hljs.highlight(code, { language: hl }).value; } catch (e) { /* そのまま表示 */ }
    }
    const head = file ? `<span class="file"><span class="icon" aria-hidden="true">description</span>${esc(file)}</span>` : `<span class="file">${esc(lang || 'code')}</span>`;
    return `<figure class="snippet"><figcaption>${head}<button class="copy" type="button" aria-label="コードをコピー"><span class="icon" aria-hidden="true">content_copy</span>コピー</button></figcaption><pre class="code"><code class="hljs language-${hl}">${html}</code></pre></figure>`;
  }

  // ---- 進捗（この端末だけに保存） ----
  const KEY = `lesson-progress:${id}`;
  let done = [];
  try { done = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { /* 保存不可でも表示は続ける */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* 無視 */ } };

  document.title = `${lesson.title || '教材'} | Daily Mini Games`;
  const chips = [lesson.level, lesson.duration, `${steps.length} ステップ`].filter(Boolean).map((c) => `<span class="tag">${esc(c)}</span>`).join('');
  const list = (title, arr, icon) => arr && arr.length ? `<div class="lesson-box"><h3><span class="icon" aria-hidden="true">${icon}</span>${title}</h3><ul>${arr.map((x) => `<li>${inline(x)}</li>`).join('')}</ul></div>` : '';

  content.innerHTML = `
    <section class="lesson-hero">
      <div class="eyebrow"><span class="icon" aria-hidden="true">school</span>ハンズオン教材</div>
      <h1>${esc(lesson.title)}</h1>
      <p>${inline(lesson.summary || '')}</p>
      <div class="meta">${chips}</div>
      <div class="lesson-actions">
        ${game ? `<a class="btn-tonal" href="${base}index.html"><span class="icon" aria-hidden="true">play_arrow</span>完成品で遊ぶ</a>` : ''}
        <a class="btn-text" href="detail.html?id=${encodeURIComponent(id)}"><span class="icon" aria-hidden="true">info</span>ゲームの詳細</a>
      </div>
    </section>
    <div class="lesson-intro">
      ${list('このレッスンで学べること', lesson.goals, 'flag')}
      ${list('準備するもの', lesson.prerequisites, 'checklist')}
    </div>
    ${lesson.setup ? `<section class="lesson-setup">${markdown(lesson.setup)}</section>` : ''}
    <div class="lesson-layout">
      <nav class="toc" aria-label="ステップ一覧">
        <div class="toc-head">ステップ <span id="progress"></span></div>
        <ol>${steps.map((s, n) => `<li><a href="#step-${n + 1}" data-n="${n + 1}"><span class="num">${n + 1}</span><span class="t">${esc(s.title)}</span></a></li>`).join('')}</ol>
      </nav>
      <div class="steps">
        ${steps.map((s, n) => `
          <article class="step" id="step-${n + 1}">
            <header class="step-head">
              <span class="step-num">STEP ${n + 1}</span>
              <h2>${esc(s.title)}</h2>
            </header>
            <div class="prose">${markdown(bodies[n])}</div>
            <footer class="step-foot">
              ${s.checkpoint ? `<a class="btn-tonal" href="${lessonBase}${esc(s.checkpoint)}index.html" target="_blank" rel="noopener"><span class="icon" aria-hidden="true">play_circle</span>ここまでの完成形を動かす</a>
              <a class="btn-text" href="${REPO}/tree/main/${lessonBase}${esc(s.checkpoint)}" target="_blank" rel="noopener"><span class="icon" aria-hidden="true">code</span>ここまでのコード</a>` : ''}
              <label class="done-check"><input type="checkbox" data-n="${n + 1}"><span>できた！</span></label>
            </footer>
          </article>`).join('')}
        <section class="lesson-end">
          <span class="icon" aria-hidden="true">celebration</span>
          <h2>おつかれさまでした！</h2>
          <p>${inline(lesson.outro || 'これでゲームの完成です。数値や色を変えて、自分だけのゲームに改造してみましょう。')}</p>
          ${game ? `<a class="play-btn" href="${base}index.html"><span class="icon" aria-hidden="true">play_arrow</span>完成品で遊ぶ</a>` : ''}
        </section>
      </div>
    </div>`;

  const progress = document.getElementById('progress');
  function render() {
    progress.textContent = `${done.length} / ${steps.length}`;
    content.querySelectorAll('.done-check input').forEach((cb) => { cb.checked = done.includes(+cb.dataset.n); });
    content.querySelectorAll('.toc a').forEach((a) => a.classList.toggle('done', done.includes(+a.dataset.n)));
  }
  content.addEventListener('change', (e) => {
    const cb = e.target.closest('.done-check input');
    if (!cb) return;
    const n = +cb.dataset.n;
    done = cb.checked ? [...new Set([...done, n])] : done.filter((x) => x !== n);
    save();
    render();
  });
  content.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const text = btn.closest('.snippet').querySelector('code').textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.lastChild.textContent = 'コピーしました';
      setTimeout(() => { btn.lastChild.textContent = 'コピー'; }, 1500);
    } catch (err) { /* クリップボード不可の環境では何もしない */ }
  });
  render();

  // 表示中のステップを目次で強調
  if ('IntersectionObserver' in window) {
    const links = [...content.querySelectorAll('.toc a')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) links.forEach((a) => a.classList.toggle('current', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    content.querySelectorAll('.step').forEach((s) => io.observe(s));
  }
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
