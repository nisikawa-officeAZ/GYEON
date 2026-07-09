# DealerOS GYEON — Mobile UI

**GYEON 見積もり APP（DealerOS）— Mobile 版 UI (v2.1)**

スマートフォン (<768px、iPhone 15/16 標準・Pro Max・Android 標準) 向けの見積ウィザード UI キット。
Ver2.0 依頼書 §8「Smartphone UI」に完全準拠。

**PC 版・Tablet 版と同じデザイントークン・7 スクリーン構成・binding ルールを完全継承** した Mobile 最適化版。

---

## 🚀 クイックスタート

まずは **ランディングページ** を開いて iPhone/Android フレームでプレビュー：

```
ui_kits/mobile-preview.html
```

iPhone 15/16 標準 / Pro Max / Android 標準の 3 フレームで切替可能。

Mobile UI 本体を直接開く場合：

```
ui_kits/estimate-wizard-mobile/index.html
```

ブラウザで開くだけで動作します。ビルド不要。

---

## 📁 フォルダ構成

```
mobile-ui/
├── README.md                              このファイル
├── CHANGELOG.md                           変更履歴
├── .gitignore
├── GenSpark_Request_EstimateWizard_Ver2.0.md   Ver2.0 依頼書 (UI の唯一の正本)
├── colors_and_type.css                    正本トークン (PC/Tablet と共通)
├── assets/                                 ブランドロゴ・アイコン
└── ui_kits/
    ├── mobile-preview.html                 👈 3 フレーム比較ランディング
    └── estimate-wizard-mobile/            Mobile 版 UI キット本体
        ├── index.html                     エントリーポイント
        ├── components.jsx                 共通 + Mobile 専用コンポーネント
        ├── shell.jsx                      TopHeader / MobileStepper / MobileTotalBar / HamburgerMenu
        ├── data.js                        マスターデータ (PC/Tablet と同じ)
        └── screens/
            ├── Screen1_Customer.jsx       顧客登録 (ネイティブカメラ OCR)
            ├── Screen2_Vehicle.jsx        車両登録 (ボディサイズ 4×2 grid)
            ├── Screen3_Category.jsx       作業内容選択
            ├── Screen4_Estimate.jsx       見積 (カテゴリカードグリッド + BottomSheet)
            ├── Screen5_Discount.jsx       値引き / クーポン (1 列カード)
            ├── Screen6_Notes.jsx          備考
            └── Screen7_Review.jsx         確認 (単カラム + 2×2 grid)
```

---

## 🎯 対象デバイス

| デバイス | 画面サイズ | 状態 |
|---|---|---|
| iPhone 15/16 標準 | 393×852 | ✅ 主対象 |
| iPhone 15/16 Pro Max | 430×932 | ✅ 対応済 |
| Android 標準 (Pixel/Galaxy) | 360×800 | ✅ 対応済 |
| iPhone SE (2 代目) | 375×667 | ⚠️ 動作するが実機未検証 |
| iPad mini | 768×1024 | ➜ Tablet UI を使用推奨 |

**向き**: 縦向きのみ (基本、横向きはロックしても良い)

---

## ✨ v2.1 で実装された Mobile 固有機能

### レイアウト
- **完全単カラム** — Grid の入れ子を避け、`display: block` ベース
- **ヘッダー 56px 高さ** — iOS/Android のネイティブ Nav Bar 相当
- **下部固定 MobileTotalBar** — [戻る | 合計金額 | 次へ] を 1 行に集約
- **safe-area-inset-*** — ノッチ・Dynamic Island・ホームインジケーターを回避
- **base font-size 16px** — iOS ズーム防止 binding

### 新規コンポーネント
- **`BottomSheet`** — 下からスライドアップ、iOS/Android の Action Sheet 相当
  - Screen 4 の詳細展開、内訳表示、ステッパーシート、メニュー、OCR レビュー等の全てで使用
- **`NativeCameraButton`** — `<input type="file" accept="image/*" capture="environment">` ラッパー
  - iOS/Android のネイティブカメラを直接起動
- **`CategoryGridCard`** — Screen 4 のカテゴリカード
  - 2 列 grid、入力済み緑チェック、選択状態の視覚化
- **`OCRReviewSheet`** — 撮影後の OCR 結果レビュー用 BottomSheet
- **`QRScanSheet`** — LINE QR 認識中の BottomSheet
- **`HamburgerMenu`** — サイドバーの Mobile 代替 (BottomSheet 形式)
- **`CompactStepper`** — 依頼書 §8 準拠のステッパー
  - 「3 / 7 作業内容」 + 7 ドット進捗 + タップで全ステップシート展開
- **`MobileTotalBar`** — 下部固定バー
  - 戻る/合計/次へ を集約、合計タップで内訳シート展開

### Screen 別の Mobile 最適化

#### Screen 1: 顧客登録
- **車検証OCR ボタン** → ネイティブカメラ起動 → 撮影後 BottomSheet でレビュー
- **顧客情報フォーム** → 短いフィールド (郵便番号 + 電話番号) は 2 列、長いフィールド (名前・住所) は 1 列

#### Screen 2: 車両登録
- **車検証OCR ボタン** → ネイティブカメラ起動
- **ボディサイズ 7 ボタン** → 4 列 × 2 行の grid (Mobile では横 7 列は狭すぎる)

#### Screen 4: 見積エディタ
- **カテゴリカードグリッド** (2 列) + タップで詳細 BottomSheet 展開
- **明細プレビュー 2 段構成** — 項目名を全幅で 2 段組 (作業カテゴリ / 商品名)、金額行は下段横並び

#### Screen 5: 値引き / クーポン
- **クーポン** → 1 列横長カード (2 列 grid だと名前が縦割れ)
- **値引き 3 択** → 短縮ラベル (「なし / ¥ 金額 / % 割引」) の 3 列 grid

#### Screen 7: 確認
- **サマリー** → 顧客 / 車両を縦積み 1 列
- **見積明細** → 2 段構成 (Screen 4 と同じ)
- **確定アクション / 通信 / モジュール遷移** → 明示的な `repeat(2, minmax(0, 1fr))` で 2×2 grid

---

## 🎯 依頼書 Ver2.0 §8 遵守状況

| §8 要件 | 遵守 |
|---|:---:|
| 完全単カラム、1 スクリーン分のみ表示 | ✅ |
| ステッパー「3 / 7 作業内容」+ ドット進捗 + タップでシート | ✅ |
| Screen 4 カテゴリカードグリッド + タップで詳細展開 | ✅ |
| Sticky Total 下部固定バー + タップで内訳 | ✅ |
| OCR/QR フルスクリーン集中オーバーレイ | ✅ (ネイティブカメラ + 結果 BottomSheet) |
| タップ 48×48px | ✅ (44-56px を最低ライン) |
| 入力 text-base 相当 (16px) | ✅ (iOS ズーム防止 binding) |
| 縦向き専用 (横向きロック可) | ✅ |

---

## 🎨 デザイン一貫性の維持

### PC/Tablet と完全共通の要素
- ✅ カラートークン (`colors_and_type.css` 共通 link)
- ✅ タイポグラフィ (Geist + Noto Sans JP)
- ✅ Amber 必須ハイライト binding
- ✅ 7 スクリーン構成・順序・ラベル
- ✅ コーティング階層 3-3-2 (スタンダード / 高性能 / INFINITE)
- ✅ PPF 部分施工 6 項目
- ✅ 明細プレビュー 2 段組 (作業カテゴリ / 商品名)
- ✅ LINE ブランドカラー #06c755

### Mobile 固有の差分
- font-size base: 16px (iOS ズーム防止)
- タップターゲット: 44-56px
- サイドバー撤去 → HamburgerMenu
- Sticky Total パネル撤去 → MobileTotalBar + ヘッダーミニピル
- Screen 4 縦タブ / 横タブ撤去 → カテゴリカードグリッド + BottomSheet

---

## 🛠 技術スタック

- **HTML / CSS / JSX**: ビルドなしで動作 (Babel Standalone による on-the-fly transpile)
- **React 18.3.1**: UMD 版を CDN から読み込み
- **Lucide Icons**: CDN 経由
- **Google Fonts**: Geist + Noto Sans JP (CDN)
- **localStorage**: 自動保存 (key: `dealeros-wizard-store-mobile-v1`, `dealeros-wizard-step-mobile-v1`)
- **CSS Media Queries**: 縦向き専用のため使用最小限
- **ネイティブカメラ**: `<input type="file" accept="image/*" capture="environment">`

### 実プロダクションへの移植

このリポジトリの UI キットは、既存の [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON) リポジトリの
`src/components/estimates/EstimateWizard.tsx` と統合可能な設計です。

- 型定義 (`src/types/estimate.ts` / `customer.ts` / `vehicle.ts`) と互換
- 料金計算ロジック (`src/lib/pricing/pricing-engine.ts`) を再利用可能
- カラートークン (`src/app/globals.css` の RC-10) と統合済み
- フォント (`next/font/google`) と互換
- ネイティブカメラは既存の Next.js PWA 化 (`@ducanh2912/next-pwa`) と組み合わせて実運用可

---

## 📚 関連ドキュメント

- **[CHANGELOG.md](./CHANGELOG.md)** — バージョン変更履歴
- **[GenSpark_Request_EstimateWizard_Ver2.0.md](./GenSpark_Request_EstimateWizard_Ver2.0.md)** — UI 依頼書 (正本)
- **PC 版 UI**: 別リポジトリ or `pc-ui/` フォルダを参照
- **Tablet 版 UI**: 別リポジトリ or `tablet-ui/` フォルダを参照

---

## 🚧 v2.2 以降の予定

- 実機検証 (実 iPhone/Android での touch feel)
- 予約カレンダー / 請求書 / 納品書等の後続画面 (依頼書対象外)
- PWA 化 (ホーム画面追加、オフライン対応)

---

## 📞 サポート

質問・修正依頼はリポジトリの Issues へ。
