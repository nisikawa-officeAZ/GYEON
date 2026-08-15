# DealerOS GYEON — Tablet UI

**GYEON 見積もり APP（DealerOS）— Tablet 版 UI (v2.0)**

タブレット (iPad Pro 11" 主対象、768〜1023px 帯) 向けの見積ウィザード UI キット。
Ver2.0 依頼書 (`GenSpark_Request_EstimateWizard_Ver2.0.md`) に完全準拠。

**3 パターン並行提供** — 実運用に応じて選択可能。

---

## 🚀 クイックスタート

まずは **ランディングページ** を開いて 3 パターンを比較：

```
ui_kits/tablet-preview.html
```

iPad Pro 11" フレーム内で 3 パターン × 縦横向きの計 6 通りを切り替えられます。

各パターンを直接開く場合：

```
ui_kits/estimate-wizard-tablet-adaptive/index.html    ← 推奨 (両向き対応)
ui_kits/estimate-wizard-tablet-landscape/index.html   ← 横向き最適
ui_kits/estimate-wizard-tablet-portrait/index.html    ← 縦向き最適
```

---

## 📁 フォルダ構成

```
tablet-ui/
├── README.md                              このファイル
├── CHANGELOG.md                           変更履歴
├── GenSpark_Request_EstimateWizard_Ver2.0.md   Ver2.0 依頼書 (UI の唯一の正本)
├── colors_and_type.css                    正本トークン (CSS 変数)
├── assets/                                 ブランドロゴ・アイコン
└── ui_kits/
    ├── tablet-preview.html                 👈 3 パターン比較ランディング
    │
    ├── estimate-wizard-tablet-landscape/  【A】横向き最適
    │   ├── index.html                     エントリーポイント
    │   ├── components.jsx / shell.jsx / data.js
    │   └── screens/Screen1〜7.jsx
    │
    ├── estimate-wizard-tablet-portrait/   【B】縦向き最適
    │   └── (同構成)
    │
    └── estimate-wizard-tablet-adaptive/   【C】両対応 Adaptive ⭐推奨
        └── (同構成 + Screen 4 は縦タブと SegmentedControl のハイブリッド)
```

---

## 🎨 3 パターンの詳細

### A. 横向き最適 (Landscape)
**対象**: iPad Pro 11" 横向き 1194×834

PC 版に最も近い体験。カウンター受付や資料参照時の使用に最適。

- サイドバー 240px 常時表示
- フルステッパー 7 ノード
- Screen 4: 左サイド縦タブ (200px)
- 右 Sticky Total 220px
- OCR/QR: 右半分スライドパネル

### B. 縦向き最適 (Portrait)
**対象**: iPad Pro 11" 縦向き 834×1194

片手でボディを支えつつ操作する / 顧客と対面で説明するシーンに最適。

- サイドバー非表示 (幅を全幅活用)
- Screen 4: 上部 SegmentedControl (iOS/Android 標準風)
- **合計金額はヘッダーミニピル常設** (右 Sticky Total 廃止で中央全幅、オーバーラップゼロ)
- タップで内訳ドロワー展開
- OCR/QR: 右半分スライドパネル

### C. 両対応 Adaptive ⭐推奨
**対象**: iPad Pro 11" 両向き

向きに応じて自動切替。iPad を回転させても違和感なく操作可能。**実運用ではこのパターンを推奨**。

- **Landscape 時**: A と同じ (サイドバー + 縦タブ + 右 Sticky Total)
- **Portrait 時**: B と同じ (単カラム + SegmentedControl + ヘッダーピル)
- 切替は CSS メディアクエリのみで実現 → **回転しても状態保持** (React state を破壊しない)

---

## 🎯 v2.0 で実装されたタブレット固有機能

### タッチ最適化
- SelectButton サイズ拡大: sm 44 / md **56** / lg 68px (+8px)
- base font-size 15px (iOS ズーム防止 & タッチ可読性)
- 全ボタンタップターゲット 48×48px 以上確保

### 新規コンポーネント
- **`SegmentedControl`** — iOS/Android 標準風の水平タブ (Screen 4 カテゴリ切替に使用)
- **`SlidePanel`** — 右半分スライドイン (OCR/QR を顧客と画面共有可能)
- **`OCRSlidePanel` / `QRSlidePanel`** — SlidePanel の車検証 OCR / LINE QR 特化版

### 依頼書 Ver2.0 §7 遵守
- ✅ 単カラム主体 (Portrait) / 2 カラム (Landscape)
- ✅ ステッパー横型・幅に応じてラベル短縮
- ✅ Screen 4: 縦タブ (Landscape) or 上部横タブ SegmentedControl (Portrait)
- ✅ Sticky Total は右サイド (Landscape) or ヘッダーピル (Portrait)
- ✅ タップ 48×48px、入力 text-base 相当
- ✅ OCR/QR: 集中スライドパネル (顧客共有想定でモーダルではなく slide)

---

## 🛠 技術スタック

- **HTML / CSS / JSX**: ビルドなしで動作 (Babel Standalone による on-the-fly transpile)
- **React 18.3.1**: UMD 版を CDN から読み込み
- **Lucide Icons**: CDN 経由
- **Google Fonts**: Geist + Noto Sans JP (CDN)
- **localStorage**: 各パターン独立キー (`dealeros-wizard-store-tablet-{l|p|a}-v1`)
- **CSS Media Queries**: `(orientation: landscape/portrait)` で Adaptive を実現

### iPad プレビュー用フレーム (`tablet-preview.html`)
- 3 パターンを iPad Pro 11" フレーム内で並列比較
- パターン切替時に推奨向きへ自動追従
- 不整合な組み合わせ (A × Portrait 等) で警告バナー + ワンタップ修正ボタン
- iframe が実寸 (1194×834 or 834×1194) で描画されるよう 3 層構造 (slot/outer/frame + `transform: scale`)

---

## 📊 パターン比較

| 項目 | A. Landscape | B. Portrait | C. Adaptive |
|---|---|---|---|
| サイドバー | 常時表示 | 非表示 | 向きで切替 |
| ステッパー | Full 7 ノード | Compact | 向きで切替 |
| Screen 4 タブ | 左サイド縦 | 上部 Segmented | 向きで切替 |
| Sticky Total | 右 220px | ヘッダーピル | 向きで切替 |
| 推奨シーン | カウンター受付 | 現場・対面説明 | **汎用** |

---

## 📚 関連ドキュメント

- **[CHANGELOG.md](./CHANGELOG.md)** — バージョン変更履歴
- **[GenSpark_Request_EstimateWizard_Ver2.0.md](./GenSpark_Request_EstimateWizard_Ver2.0.md)** — UI 依頼書 (正本)
- **PC 版 UI**: 別リポジトリ or `pc-ui/` フォルダを参照

---

## 🚧 次期リリース予定

- **v2.1**: Smartphone UI (<768px) — 現在設計中
- **v2.2 以降**: 予約カレンダー・請求書・納品書等の後続画面 (依頼書対象外)

---

## 📞 サポート

質問・修正依頼はリポジトリの Issues へ。
