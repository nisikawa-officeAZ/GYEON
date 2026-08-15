# Changelog — PC UI

## v2.0.0 — 2026-07-08

**PC 版 UI マイルストーンリリース**

### ✨ 新機能

見積ウィザード Screen 1〜7 の完全実装:

- **Screen 1: 顧客登録** — 車検証OCR / 手入力 / 既存顧客検索の 3 択押しボタン、業者・掛売り独立トグル
- **Screen 2: 車両登録** — ボディサイズ 7 ボタン (3M 推定→APU 最終確定 binding)
- **Screen 3: 作業内容選択** — 7 カテゴリ複数選択 (PPF 部分施工は Screen 4 内で分岐)
- **Screen 4: 見積エディタ** — 左サイド縦タブ + コーティング 3-3-2 階層 + PPF 部分施工 6 項目
- **Screen 5: 値引き / クーポン** — 金額 or % の排他選択
- **Screen 6: 備考・メモ** — 顧客向け備考と社内メモを分離
- **Screen 7: 確認** — 確定アクション + 通信 (LINE) + モジュール遷移入口

### 🎨 レイアウト

- サイドバー 280px + フルステッパー 7 ノード + 右 Sticky Total 200px
- Grid の `1fr 罠` を `minmax(0, 1fr)` で解消 → ボタンオーバーラップ完全防止
- 明細プレビュー: 4 列 grid + 項目 2 段組 (作業カテゴリ / 商品名) + 数量×単価縦積み + 小計 bold
- 3 ウィンド (カテゴリ / 見積 / Sticky Total) の上端揃い + スクロール追従

### 🎯 コーティング階層 (3-3-2 データ駆動)

- スタンダード: `Q² CANCOAT EVO / Q² ONE EVO / Q² PURE EVO`
- 高性能: `Q² MOHS EVO / Q² SYNCRO EVO / Q² MATTE EVO`
- INFINITE (最上位): `Q² INFINITE BASE TYPE 1 / TYPE 2`
- ショップランクに応じて表示グループが変化 (shop / detailer / certified)

### 🛡 PPF 部分施工 (6 項目)

- ドアミラー / ドアカップ (位置選択) / Bピラー / Cピラー / ステップ (位置選択) / リアバンパー上部
- ドアカップ・ステップは前右/前左/後右/後左の位置選択サブグリッド

### 🎯 依頼書 Ver2.0 binding 遵守

| 依頼書要件 | 遵守 |
|---|:---:|
| 7 スクリーン固定順序 | ✅ |
| Screen 3 以降プルダウン全面禁止 | ✅ |
| 必須未入力 Amber ハイライト | ✅ |
| committing 操作を増やさない | ✅ |
| 全ステップ 1タップジャンプ | ✅ |
| 自動保存 | ✅ |
| ボディサイズ自動確定しない | ✅ |
| PPF フル/部分は Screen 4 内分岐 | ✅ |
| ダークモードのみ | ✅ |
| タップ 48×48px | ✅ |

### 🏗 アーキテクチャ

- デザイントークン: `colors_and_type.css` を `<link>` 参照
- React 18.3.1 + Babel Standalone (ビルドなし)
- Lucide Icons CDN
- Google Fonts (Geist + Noto Sans JP)
- localStorage による mock 自動保存

### 🚧 未実装 (v2.1 以降)

- Smartphone UI (<768px) — 別スペック
- 予約カレンダー / 請求書 / 納品書 — 依頼書対象外
- WhatsApp / Instagram / X 通信 — 拡張プレースホルダのみ

### 🔗 参照

- 既存コードベース: [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON)
- Tablet UI: 別リポジトリ or `tablet-ui/` を参照
