// 新しく games.json に追加されたゲームを X（Twitter）に投稿する。
// 依存パッケージなし（Node 20+ の fetch / crypto だけを使う）。
//
// 環境変数:
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET … X API の認証情報（OAuth 1.0a）
//   BEFORE_SHA … push 前のコミット（新規ゲームの判定に使う）
//   GAME_IDS   … 手動実行用。カンマ区切りで id を指定すると、そのゲームを投稿する
//   DRY_RUN    … "true" なら投稿せず本文を表示するだけ
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';

const SITE = 'https://kitsunecat.github.io/daily-mini-games/';
const DRY_RUN = process.env.DRY_RUN === 'true';
const creds = {
  apiKey: process.env.X_API_KEY,
  apiSecret: process.env.X_API_SECRET,
  token: process.env.X_ACCESS_TOKEN,
  tokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
};

function loadGames(ref) {
  if (!ref) return JSON.parse(readFileSync('games.json', 'utf8'));
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:games.json`], { encoding: 'utf8' }));
  } catch {
    return [];
  }
}

function pickTargets() {
  const current = loadGames();
  const manual = (process.env.GAME_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (manual.length) return current.filter(g => manual.includes(g.id));
  const before = process.env.BEFORE_SHA;
  if (!before || /^0+$/.test(before)) return [];
  const known = new Set(loadGames(before).map(g => g.id));
  return current.filter(g => !known.has(g.id)).reverse(); // 古い順に投稿
}

// ---- OAuth 1.0a ----
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(method, url, extraParams = {}) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.token,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...extraParams };
  const paramStr = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramStr)].join('&');
  const key = `${enc(creds.apiSecret)}&${enc(creds.tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function uploadImage(path) {
  const url = 'https://api.x.com/2/media/upload';
  const form = new FormData();
  form.append('media', new Blob([readFileSync(path)], { type: 'image/png' }), 'screenshot.png');
  form.append('media_category', 'tweet_image');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: authHeader('POST', url) }, body: form });
  const body = await res.json().catch(() => ({}));
  const id = body?.data?.id || body?.media_id_string;
  if (!res.ok || !id) throw new Error(`media upload failed: ${res.status} ${JSON.stringify(body)}`);
  return id;
}

async function postTweet(text, mediaId) {
  const url = 'https://api.x.com/2/tweets';
  const payload = { text };
  if (mediaId) payload.media = { media_ids: [mediaId] };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`tweet failed: ${res.status} ${JSON.stringify(body)}`);
  return body.data.id;
}

// GitHub Pages の反映を待つ（リンク切れのまま投稿しないため）
async function waitForPage(url, timeoutMs = 10 * 60 * 1000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 20000));
  }
  return false;
}

function buildText(g) {
  const url = `${SITE}games/${g.id}/`;
  const genre = g.genre ? `ジャンル：${g.genre}\n` : '';
  return `🎮 今日の新作ミニゲーム「${g.title}」\n${genre}\nブラウザですぐ遊べます👇\n${url}\n\n#DailyMiniGames #ブラウザゲーム`;
}

const targets = pickTargets();
if (!targets.length) {
  console.log('新しいゲームはありません。投稿をスキップします。');
  process.exit(0);
}
if (!DRY_RUN && Object.values(creds).some(v => !v)) {
  console.log('::warning::X API の Secrets が未登録のため投稿をスキップしました（X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET）。');
  process.exit(0);
}

let failed = false;
for (const g of targets) {
  const text = buildText(g);
  console.log(`--- ${g.id}\n${text}`);
  if (DRY_RUN) continue;
  try {
    const gameUrl = `${SITE}games/${g.id}/`;
    if (!(await waitForPage(gameUrl))) console.log(`::warning::${gameUrl} がまだ公開されていませんが投稿します。`);
    let mediaId;
    const shot = g.screenshot;
    if (shot && existsSync(shot)) {
      try { mediaId = await uploadImage(shot); }
      catch (e) { console.log(`::warning::画像のアップロードに失敗したので、画像なしで投稿します: ${e.message}`); }
    }
    const id = await postTweet(text, mediaId);
    console.log(`投稿しました: https://x.com/i/status/${id}`);
  } catch (e) {
    failed = true;
    console.log(`::error::${g.id} の投稿に失敗しました: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
