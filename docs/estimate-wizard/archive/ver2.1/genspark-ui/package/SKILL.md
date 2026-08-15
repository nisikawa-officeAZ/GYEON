---
name: dealeros-gyeon-design
description: DealerOS 見積ウィザード Ver2.0 のデザインシステム。ダーク基調・押しボタン式・7スクリーンウィザードのUIキットとトークンを提供します。
user-invocable: true
---

# DealerOS GYEON Design System

## Quick Map

- `README.md` — 全体の入り口。デザイン哲学 / CONTENT FUNDAMENTALS / VISUAL FOUNDATIONS / ICONOGRAPHY を記載。
- `colors_and_type.css` — **正本トークン**。色・タイポ・余白・角丸・シャドウ・モーションの CSS 変数。全 HTML はここを読み込む。
- `ui_kits/estimate-wizard/` — 見積ウィザード Screen 1〜7 の click-thru プロトタイプ (React + Babel)。
- `preview/` — Design System タブに表示される 22 枚のカード (Type / Colors / Spacing / Components / Brand)。
- `assets/` — GYEON ブランドロゴ・車両ヒーロー画像・LINE 用 SVG。
- `src/` — 参照用の既存 Next.js コードベース (github.com/nisikawa-officeAZ/GYEON より import)。
- `GenSpark_Request_EstimateWizard_Ver2.0.md` — UI 依頼書 Ver2.0 の写し（正本）。

## ブランド固有の設計ルール

### 絶対 binding (Ver2.0 §23 由来 · 変更不可)

1. **ダークモードのみ**。ライトモード不作成。ベース背景 `#080d1a`、カード `#1e293b`。
2. **Screen 3 以降プルダウン全面禁止**。選択は必ず `SelectButton`（押しボタン）で行う。
3. **committing 操作を絶対に増やさない**。破壊的操作にも確認ダイアログは追加しない（間隔・配置・「元に戻す」トーストで対応）。
4. **7 スクリーンの順序・ラベル固定**：顧客 → 車両 → 作業内容 → 見積 → 値引き → 備考 → 確認。統合・分割・並べ替え禁止。
5. **必須未入力は Amber (`#fbbf24`)** で境界・ラベル・微かな tint を強調。入力完了で即座に通常色（白系）に戻す。
6. **タップ最小 48×48px**。モバイル入力は `font-size: 16px`（iOS ズーム防止）。
7. **muscle memory 保持**：新規/編集で見た目・順序・ラベルを一貫させる。
8. **絵文字を UI 表面で使わない**。Lucide 線画に統一（stroke 1.75）。既存 enum の絵文字識別子は破壊しない。

### コアコンポーネント

- **`SelectButton`** — Ver2.0 の中核。プルダウンの代替。selected 状態は塗り (`bg-blue-950/40`) + 境界 (`border-blue-500/60`) + 右上チェックマークで「常に何が選択中か把握できる」を実現。
- **`Field` + `Input`** — 必須項目は Amber ハイライト。入力完了で通常色に戻る自動遷移。
- **`Card`** — 20px padding・14px 角丸・shadow-lg・内側ハイライト。全ステップで統一。
- **`Stepper`** — 7 ノード横並び。全ノードが常時クリック可（未到達もロックしない）。完了は緑チェック、現在は Blue グラデ、未着手はニュートラル。
- **`StickyTotalPanel`** — Desktop 右サイド・320px・sticky。Mobile は下部固定バー + タップで内訳シート。
- **`OCROverlay` / `QROverlay` / `CustomerSearchModal`** — オーバーレイ形式（モーダル入れ子禁止）。閉じるは即時。

### 配色ルール (§17 準拠)

- 選択 ON: `bg: rgba(30,58,138,0.40)` + `border: rgba(29,78,216,0.60)`
- 選択 OFF: `bg: #0f172a` + `border: slate-700` + `text: slate-400`
- プライマリ CTA: `linear-gradient(135deg, #2563eb, #1d4ed8)`
- LINE ボタン: `#06c755`（他 SNS は未実装で拡張プレースホルダのみ）

### コピーライティング

- ですます調（丁寧語）、命令形は使わない。
- operator = 「APU」は内部用語で UI には出さない。顧客 = 「お客様」で確定。
- 金額は必ず 3 桁カンマ + `¥` 前置 + tabular-nums。

### 使用時のヒント

- 新しい画面を作るとき: `ui_kits/estimate-wizard/screens/` の JSX をコピーし、`SelectButton` を軸に組み立てる。
- 色を選ぶとき: `colors_and_type.css` の CSS 変数のみを使う（新色発明禁止）。
- アイコン: Lucide CDN (`<i data-lucide="user">`) を使い、`lucide.createIcons()` を初期化時に 1 回だけ呼ぶ。MutationObserver に接続しない（無限ループ注意）。
- 数字表示: `.ds-numeric` または `.ds-price-total` クラスを付与して tabular-nums を強制。

### 参照リポジトリ

github.com/nisikawa-officeAZ/GYEON — Next.js 15 + React 19 + Tailwind v4 + Supabase の本番コードベース。特に `src/components/estimates/EstimateWizard.tsx`（1503 行の既存実装）、`src/lib/pricing/pricing-data.ts`（コーティング階層データ）、`src/app/globals.css`（RC-10 トークンの本家）を参照。
