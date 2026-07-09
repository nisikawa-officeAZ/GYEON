# Changelog

## v2.0.0 — 2026-07-08

**GYEON 見積もり APP UI デザインシステム v2.0 リリース**

PC + Tablet UI を完成させたマイルストーンリリース。
Ver2.0 依頼書 (`GenSpark_Request_EstimateWizard_Ver2.0.md`) に完全準拠。

### ✨ 完成した成果物

#### PC UI (Desktop 1024+)
- **`ui_kits/estimate-wizard/`** — 見積ウィザード Screen 1〜7 の完全実装
- サイドバー 280px + フルステッパー 7 ノード + 右 Sticky Total 200px
- Screen 4 内側 grid の `1fr 罠` を `minmax(0, 1fr)` で解消
- 3-3-2 コーティング階層 (スタンダード / 高性能 / INFINITE)
- PPF 部分施工 6 項目 + 施工箇所選択サブグリッド (ドアカップ・ステップに位置選択)
- 明細プレビュー 2 段組 (作業カテゴリ / 商品名) + 数量×単価縦積み + 小計 bold
- ヘッダー合計ミニピル (Tablet Narrow 帯でパネル畳み時の代替表示)
- 動作幅: 1024px 〜 1400px+
- 破壊的変更なし。既存の `nisikawa-officeAZ/GYEON` の `EstimateWizard.tsx` (1503 行) と統合可能

#### Tablet UI (768-1023, iPad Pro 11" 主対象)
3 パターン並行提供:

| パターン | パス | 対象 |
|---|---|---|
| A. 横向き最適 | `ui_kits/estimate-wizard-tablet-landscape/` | iPad Pro 11" 横向き 1194×834 |
| B. 縦向き最適 | `ui_kits/estimate-wizard-tablet-portrait/` | iPad Pro 11" 縦向き 834×1194 |
| **C. 両対応 Adaptive** ⭐推奨 | `ui_kits/estimate-wizard-tablet-adaptive/` | 向きに応じて自動切替 |

- **`ui_kits/tablet-preview.html`** — 3 パターン比較 + iPad Pro 11" フレームプレビューランディング
- タッチ最適化: SelectButton 56px+, font 15px, タップターゲット拡大
- SegmentedControl コンポーネント (Portrait / Adaptive Portrait 時の Screen 4 カテゴリ切替)
- SlidePanel コンポーネント (OCR/QR を右半分スライドで表示、顧客と画面共有可能)
- Portrait/Adaptive Portrait: ヘッダーミニピル常設 + 中央全幅 (右パネル非表示でオーバーラップ完全回避)
- Landscape/Adaptive Landscape: PC 準拠の右 Sticky Total 220px 維持
- iPad フレーム内で iframe が実寸描画されるように 3 層構造 (slot/outer/frame)

### 🏗 アーキテクチャ

- **デザイントークン**: `colors_and_type.css` を全ファイルが `<link>` 参照 (単一の出典)
- **CSS 変数**: 色 / タイポ / 余白 / 角丸 / シャドウ / モーション を統一管理
- **Google Fonts CDN**: Geist + Noto Sans JP (実プロダクションでは既存 `next/font/google` 移植可)
- **Lucide Icons CDN**: ストローク 1.75、業務ツール向け中立的アイコン
- **React 18.3.1 + Babel Standalone**: 単一 HTML でクリックスルー可能

### 📚 ドキュメント

- `README.md` — デザインシステム全体の入り口、CONTENT FUNDAMENTALS / VISUAL FOUNDATIONS / ICONOGRAPHY
- `SKILL.md` — 別プロジェクトから attach するための Skill 定義
- `GenSpark_Request_EstimateWizard_Ver2.0.md` — Ver2.0 依頼書 (UI の唯一の正本)
- `preview/` — Design System タブに表示される 22 枚のトークンカード

### 🎯 Ver2.0 依頼書 binding 遵守状況

| 依頼書要件 | 遵守状態 |
|---|---|
| 7 スクリーン固定順序 | ✅ 顧客→車両→作業→見積→値引→備考→確認 |
| Screen 3 以降プルダウン全面禁止 | ✅ SelectButton / SegmentedControl で置換 |
| 必須未入力 Amber ハイライト | ✅ 入力完了で通常色に戻る binding 実装 |
| committing 操作を増やさない | ✅ 確認ダイアログ追加なし |
| 全ステップ 1タップジャンプ可 | ✅ ステッパー任意ノードクリック可 |
| 自動保存 | ✅ localStorage で mock 実装 |
| auto-advance | ✅ 既存顧客選択 / OCR 適用時にトースト+遷移 |
| ボディサイズ 7 ボタン (自動確定しない) | ✅ 3M推定→APU 最終決定 binding |
| PPF フル/部分は Screen 4 内で分岐 | ✅ Screen 3 では独立カテゴリにしない |
| 店舗オプション動的 | ✅ 「例題」注記付きで動的前提のレイアウト |
| Sticky Total 常時可視 | ✅ PC/Tablet Landscape: 右サイドパネル / Portrait: ヘッダーピル |
| 通信は Screen 7 集約 | ✅ LINE 状態出し分け + 未実装 SNS 拡張プレースホルダ |
| ダークモードのみ | ✅ 全画面 `#080d1a` ベース |
| タップ 48×48px | ✅ Tablet では 56px+ に拡張 |

### 🚧 未実装 (v2.1 以降)

- **Smartphone UI (<768px)** — 依頼書 §8。次期リリースで対応予定
- **予約カレンダー / 代車 / 請求書 / 納品書** — 依頼書対象外 (別スペック)
- **保証書** — 施工完了後の別モジュール
- **WhatsApp / Instagram / X 通信** — API 登録時に自動追加できる拡張プレースホルダのみ

### 🔗 参照リポジトリ

- 既存コードベース: [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON)
  - `src/components/estimates/EstimateWizard.tsx` (1503 行の既存実装)
  - `src/lib/pricing/pricing-data.ts` (料金定義)
  - `src/app/globals.css` (RC-10 トークン本家)
