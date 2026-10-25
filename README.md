# Daily Mini Games

スマホゲームのランキング上位作品を参考に、毎日1本ずつ作っている簡易版ブラウザゲーム集です。

公開ページ: https://kitsunecat.github.io/daily-mini-games/

## 構成

- `index.html` … ゲーム一覧（`games.json` を読み込んで新しい順に表示）
- `detail.html?id=<id>` … ゲーム詳細（スクリーンショット・遊び方・ソースコード）
- `games.json` … ゲームのマニフェスト
- `games/<id>/` … 各ゲーム本体（フォルダ内で完結、ビルド不要）
- `lesson.html?id=<id>` … ハンズオン教材（そのゲームをイチから作る手順）。`assets/lesson.js` が表示を担当
- `lessons.json` … 教材があるゲームの一覧。詳細ページはここに載っている id にだけ教材へのリンクを出す
- `assets/site.css` … 一覧・詳細ページ共通のスタイル（Material Design 3 風。ライト/ダーク対応、Google Fonts の Roboto・Noto Sans JP・Material Symbols を読み込み）

各ゲームはオリジナルの名前・グラフィックで作った非公式の簡易版です。参考作品の権利は各権利者に帰属します。

## ハンズオン教材

毎日 12:00（JST）の定期タスクが、その日のゲームを題材に「イチから作るハンズオン教材」を追加します。`games.json` は変更しません。

```
games/<id>/lesson/
  lesson.json            … 教材のメタ情報とステップ一覧
  steps/01.md, 02.md …   … 各ステップの本文（Markdown のサブセット）
  checkpoints/01/ …      … そのステップ終了時点で動く完成形（index.html・style.css・game.js）
```

`lesson.json`:

```json
{
  "title": "〇〇をイチから作ろう",
  "summary": "1〜2文の紹介",
  "level": "初級〜中級",
  "duration": "約90分",
  "goals": ["学べること", "..."],
  "prerequisites": ["準備するもの", "..."],
  "setup": "最初の準備（Markdown、省略可）",
  "steps": [
    { "title": "ステップ名", "file": "steps/01.md", "checkpoint": "checkpoints/01/" }
  ],
  "outro": "最後のひとこと（省略可）"
}
```

`lessons.json` には新しい順に `{ "id", "title", "steps"（ステップ数）, "duration" }` を追記します。

ステップ本文で使える Markdown: `##`〜`####` 見出し、段落、`-` / `1.` リスト、`**太字**`、`` `コード` ``、`[リンク](url)`、
ファイル名つきコードブロック（` ```js:game.js `）、囲み（`> [!CHECK] 動作チェック`。ほかに `NOTE` / `TIP` / `WARNING`）。
