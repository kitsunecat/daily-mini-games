# Daily Mini Games

スマホゲームのランキング上位作品を参考に、毎日1本ずつ作っている簡易版ブラウザゲーム集です。

公開ページ: https://kitsunecat.github.io/daily-mini-games/

## 構成

- `index.html` … ゲーム一覧（`games.json` を読み込んで新しい順に表示）
- `detail.html?id=<id>` … ゲーム詳細（スクリーンショット・遊び方・ソースコード）
- `games.json` … ゲームのマニフェスト
- `games/<id>/` … 各ゲーム本体（フォルダ内で完結、ビルド不要）
- `assets/site.css` … 一覧・詳細ページ共通のスタイル（Material Design 3 風。ライト/ダーク対応、Google Fonts の Roboto・Noto Sans JP・Material Symbols を読み込み）

各ゲームはオリジナルの名前・グラフィックで作った非公式の簡易版です。参考作品の権利は各権利者に帰属します。
