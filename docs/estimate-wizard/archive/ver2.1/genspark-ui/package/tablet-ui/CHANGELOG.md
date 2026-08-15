# Changelog — Tablet UI

## v2.0.0 — 2026-07-08

**Tablet 版 UI マイルストーンリリース**

iPad Pro 11" (834×1194 / 1194×834) を主対象とした 3 パターン並行提供。

### ✨ 新機能

#### 3 パターンの UI キット

| パターン | 対象 | パス |
|---|---|---|
| **A. Landscape** | iPad Pro 11" 横向き 1194×834 | `ui_kits/estimate-wizard-tablet-landscape/` |
| **B. Portrait** | iPad Pro 11" 縦向き 834×1194 | `ui_kits/estimate-wizard-tablet-portrait/` |
| **C. Adaptive** ⭐推奨 | 両向き自動切替 | `ui_kits/estimate-wizard-tablet-adaptive/` |

#### プレビューランディング
- `ui_kits/tablet-preview.html` — 3 パターン比較 + iPad Pro 11" フレームプレビュー
- パターン切替時に推奨向きへ自動追従
- 不整合な組み合わせで警告バナー + ワンタップ修正ボタン
- iframe が実寸 (1194×834 or 834×1194) で描画される 3 層構造 (slot/outer/frame)

### 🎨 タッチ最適化

- SelectButton サイズ拡大: sm 44 / md **56** / lg 68px (PC 版 +8px)
- base font-size 15px (iOS ズーム防止 & タッチ可読性)
- 全ボタンタップターゲット 48×48px 以上

### 🧩 新規コンポーネント

- **`SegmentedControl`** — iOS/Android 標準風水平タブ (Screen 4 カテゴリ切替)
- **`SlidePanel`** — 右半分スライドイン (顧客と画面共有可能)
- **`OCRSlidePanel` / `QRSlidePanel`** — 車検証 OCR / LINE QR 特化版

### 🎯 各パターン固有機能

#### A. Landscape
- サイドバー 240px 常時表示
- フルステッパー 7 ノード
- Screen 4: 左サイド縦タブ (200px)
- 右 Sticky Total 220px

#### B. Portrait
- サイドバー非表示 → 全幅活用
- Screen 4: 上部 SegmentedControl
- **合計金額ヘッダーミニピル常設** (右 Sticky Total 廃止でオーバーラップゼロ)
- タップで内訳ドロワー展開

#### C. Adaptive
- Landscape 時: A と同じ
- Portrait 時: B と同じ
- **CSS メディアクエリ `(orientation)` のみで実現** — React state を破壊しない (回転しても選択保持)
- Screen 4 は縦タブと SegmentedControl の両 DOM をハイブリッド出力

### 🎯 依頼書 Ver2.0 §7 遵守

| §7 要件 | 遵守 |
|---|:---:|
| 単カラム主体 (Portrait) | ✅ |
| ステッパー横型・ラベル短縮 | ✅ |
| Screen 4 縦タブ or 上部横タブ | ✅ |
| Sticky Total 下部固定 or ヘッダー | ✅ (Portrait はヘッダーピル、Landscape は右) |
| タップ 48×48px | ✅ |
| 入力 text-base 相当 | ✅ (15px base) |
| OCR/QR 集中オーバーレイ | ✅ (右半分 SlidePanel) |

### 🏗 アーキテクチャ

- デザイントークン: `colors_and_type.css` (PC 版と共通)
- localStorage キー: 各パターン独立 (`dealeros-wizard-store-tablet-{l|p|a}-v1`)
- CSS: `@media (orientation: landscape/portrait)` で Adaptive を実現
- iPad フレーム内 iframe 実寸描画のための `transform: scale()` + 3 層 wrapper 構造

### 🐛 修正した重要バグ

- **Grid `1fr` の罠**: `minmax(0, 1fr)` に変更してボタンオーバーラップ解消
- **明細プレビュー枠外飛び出し**: `minmax(0, 1fr) 88px 96px 28px` に列幅圧縮
- **iPad フレーム内 iframe の orientation 誤判定**: 実寸描画構造で解決

### 🚧 未実装 (v2.1 以降)

- Smartphone UI (<768px) — 別スペック
- iPad Pro 12.9" (1024×1366 / 1366×1024) — Adaptive で概ね対応済、実機検証未実施

### 🔗 参照

- 既存コードベース: [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON)
- PC 版 UI: 別リポジトリ or `pc-ui/` を参照
