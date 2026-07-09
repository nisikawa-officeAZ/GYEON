# Changelog — Mobile UI

## v2.1.0 — 2026-07-09

**Mobile UI マイルストーンリリース**

iPhone 15/16 標準 (393×852), Pro Max (430×932), Android 標準 (360×800) 対応。
Ver2.0 依頼書 §8「Smartphone UI」に完全準拠。
PC (v2.0) / Tablet (v2.0) と同じデザイントークン・7 スクリーン構成・binding ルールを完全継承。

### ✨ 新機能

#### レイアウト
- **完全単カラム** — `display: block` ベースで Grid 入れ子を避ける
- **ヘッダー 56px** — iOS/Android のネイティブ Nav Bar 相当
- **下部固定 MobileTotalBar** — [戻る | 合計 | 次へ] を集約
- **safe-area-inset-*** — ノッチ・Dynamic Island・ホームインジケーター回避
- **base font-size 16px** — iOS ズーム防止 binding
- **ヘッダーミニピル常設** — 合計金額をヘッダー右上にも常時表示

#### 新規コンポーネント
- **`BottomSheet`** — iOS/Android Action Sheet 相当のボトムシート
- **`NativeCameraButton`** — ネイティブカメラ起動 `<input type="file" capture>` ラッパー
- **`CategoryGridCard`** — 2 列カテゴリカード (入力済み緑チェック付き)
- **`OCRReviewSheet`** — 車検証 OCR 結果レビュー BottomSheet
- **`QRScanSheet`** — LINE QR 認識中 BottomSheet
- **`HamburgerMenu`** — サイドバー代替 (BottomSheet 形式)
- **`CompactStepper` (刷新)** — 「3 / 7 作業内容」+ 7 ドット + タップでシート展開
- **`MobileTotalBar` (刷新)** — 戻る/合計/次へ 集約、合計タップで内訳シート

### 🎯 Screen 別 Mobile 最適化

#### Screen 1: 顧客登録
- 車検証OCR ボタン → **ネイティブカメラ起動** → 撮影後 BottomSheet レビュー
- 顧客情報フォーム → **短いフィールドは 2 列、長いフィールドは 1 列**
- LINE ID 入力欄 → **QR ボタンもネイティブカメラ起動**

#### Screen 2: 車両登録
- 車検証OCR → ネイティブカメラ起動
- 車両情報フォーム → **メーカー + 車名 / 型式 + ボディカラー 等の関連フィールドを 2 列**
- **ボディサイズ 7 ボタン → 4 列 × 2 行 grid** (Mobile では横 7 列は狭すぎる)

#### Screen 4: 見積エディタ
- **カテゴリカードグリッド** (2 列) + タップで **詳細 BottomSheet 展開**
- 入力済みカテゴリに **緑チェックバッジ**
- **明細プレビュー 2 段構成**:
  - 上段: 項目名を全幅で 2 段組 (作業カテゴリ / 商品名)
  - 下段: 数量 × 単価 (左) + 小計 bold (右) + 削除ボタン

#### Screen 5: 値引き / クーポン
- クーポン → **1 列横長カード** (2 列 grid だと名前が縦割れ)
- 値引き 3 択 → **短縮ラベル** (「なし / ¥ 金額 / % 割引」) の 3 列 grid

#### Screen 7: 確認
- サマリー → **顧客 / 車両を縦積み 1 列** (2 列だと項目名が縦割れ)
- 車両サマリー → **メーカー / 車名を独立行に分離**
- 見積明細 → **2 段構成** (Screen 4 と同じ)
- 確定アクション / 通信 / モジュール遷移 → **明示的な `repeat(2, minmax(0, 1fr))`** で 2×2 grid

### 🐛 修正した重要バグ

- **Mobile 版 Screen 7 (確認画面) 真っ黒問題**: step 遷移時に scroll 位置がリセットされず、長い content の中間空白域が表示されていた
  - `useEffect` に `requestAnimationFrame` + `window.scrollTo(0, 0)` の確実なリセット追加
  - 初回マウント時にも明示的に top へスクロール

- **明細プレビュー縦一列崩れ**: `minmax(0, 1fr) 88px 96px 28px` の grid で項目列が 55-90px に圧縮され、日本語が 1 文字ずつ縦割れ
  - 明細行を 2 段構成に再設計 → 項目名に全幅を割り当て

- **Screen 5 クーポン縦割れ**: 2 列 grid で 5 個のクーポン名が 4 文字ずつ縦割れ
  - 1 列横長カード ([アイコン | 名前 | 金額 | ✓]) に再設計

- **Screen 5 値引き 3 択縦割れ**: 「値引き無し」「金額で指定」「% で指定」が縦 4 文字ずつ縦割れ
  - 短縮ラベル (「なし / ¥ 金額 / % 割引」) + 縦積みボタンに再設計

- **Screen 7 サマリー縦割れ**: 2 列 grid (133px × 2) で「テスト太郎」「メーカー / 車名」が縦割れ
  - 単カラム縦積みに変更、メーカー / 車名を独立行に分離

- **Screen 7 確定アクション不安定**: `repeat(auto-fit, minmax(180px, 1fr))` は Android 360px で 1 列に落ちる不安定さ
  - 明示的な `repeat(2, minmax(0, 1fr))` で全 Mobile 幅で一貫した 2×2 grid

### 🏗 アーキテクチャ

- デザイントークン: `colors_and_type.css` (PC/Tablet と共通)
- localStorage キー: 独立 (`dealeros-wizard-store-mobile-v1`, `dealeros-wizard-step-mobile-v1`)
- ネイティブカメラ: `<input type="file" accept="image/*" capture="environment">`
- safe-area 対応: `env(safe-area-inset-*)` を header / bottom-bar / bottom-sheet で使用

### 🎯 依頼書 Ver2.0 §8 遵守状況

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

### 🚧 未実装 (v2.2 以降)

- 実機検証 (実 iPhone/Android での touch feel)
- 予約カレンダー / 請求書 / 納品書等の後続画面 (依頼書対象外)
- PWA 化 (ホーム画面追加、オフライン対応)
- iPhone SE (375×667) 実機検証

### 🔗 参照

- 既存コードベース: [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON)
- PC 版 UI: 別リポジトリ or `pc-ui/` を参照
- Tablet 版 UI: 別リポジトリ or `tablet-ui/` を参照
