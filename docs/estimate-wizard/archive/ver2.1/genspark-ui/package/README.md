# DealerOS GYEON Design System

**GYEON 見積もり APP（DealerOS）UI デザインシステム — 見積ウィザード Ver2.0 準拠版**

> **バージョン**: v2.0 (2026-07-08) — **PC + Tablet UI 完成**
> **次期**: v2.1 で Smartphone UI (<768px) を追加予定
> **変更履歴**: [CHANGELOG.md](./CHANGELOG.md)

## 🚀 クイックスタート

- **PC 版デモ**: [`ui_kits/estimate-wizard/index.html`](./ui_kits/estimate-wizard/index.html) をブラウザで開く
- **Tablet 版デモ (推奨エントリ)**: [`ui_kits/tablet-preview.html`](./ui_kits/tablet-preview.html) で 3 パターン比較

---

## 0. 概要

DealerOS は、全国 GYEON ディーラー向けのマルチテナント SaaS。本デザインシステム
は特に **見積ウィザード（Estimate Wizard）Ver2.0** の UI を、そのブランド／
既存コードベース／依頼書の 3 者と整合する形で提供します。

- **哲学**: プロフェッショナルな業務ツール。ダーク基調のみ。装飾より情報密度・
  操作速度・視認性。**プルダウン禁止／押しボタン式選択／committing 操作を絶対に
  増やさない**。
- **対象範囲**: 見積ウィザード **Screen 1〜7** のみ（予約カレンダー・代車・請求
  書等は別スペック）。
- **正本**: 添付の `GenSpark_Request_EstimateWizard_Ver2.0.md` が唯一の依頼書。
  ラベル・順序・機能は改変不可。デザイン（見た目・レイアウト・配色・アイコン・
  余白・タイポグラフィ・アニメーション）のみ変更可。

### 由来 / Sources

このデザインシステムは以下 3 つのソースを統合したものです。

| ソース | 用途 |
|---|---|
| **GitHub `nisikawa-officeAZ/GYEON`** ([リンク](https://github.com/nisikawa-officeAZ/GYEON)) | 既存 Next.js 15 + React 19 + Tailwind v4 のコードベース。`src/app/globals.css` の RC-10 デザイントークン、`EstimateWizard.tsx` の既存 1503 行の実装、v13 デスクトップトップ画面 (`gyeon_desktop_top_v13.html`)。 |
| **GenSpark_Request_EstimateWizard_Ver2.0.md** | UI の唯一の正本。7 スクリーンの入力順・binding ルール・配色トークン。 |
| **v13 スクリーンショット** (`v13_fold.png`, `v13_full.png`) | ダッシュボードのビジュアル雛形（サイドバー・Hero・カード・ブランド色）。 |

読者がリポジトリを直接探索することを推奨します — 特に:
- `src/components/estimates/EstimateWizard.tsx` （既存の業務ロジック 1503 行）
- `src/lib/pricing/pricing-data.ts`（コーティング・PPF・料金定義）
- `src/app/globals.css`（RC-10 トークンの本家）

---

## 1. Index — この design/ フォルダの案内

| パス | 内容 |
|---|---|
| `README.md` | このファイル。すべての入り口。 |
| `SKILL.md` | 別プロジェクトからこのデザインシステムを attach するための Skill 定義。 |
| `colors_and_type.css` | **正本トークン**。CSS 変数（色・タイポ・余白・角丸・シャドウ・モーション）。全ファイルがこれを読み込む。 |
| `thumbnail.png` | Design System ピッカーで表示されるサムネイル画像。 |
| `assets/` | ブランドロゴ・車両ヒーロー画像・アプリアイコン等の実素材。 |
| `preview/` | Design System タブに表示される 700×N のカード群 (Type / Colors / Spacing / Components / Brand)。 |
| `ui_kits/estimate-wizard/` | 見積ウィザード Screen 1〜7 の高忠実 UI キット。`index.html` が全体プロトタイプ、各 `.jsx` がスクリーン単位のコンポーネント。 |
| `src/` | GitHub からインポートした既存コードベース（読み取り用参照）。 |
| `v13_fold.png`, `v13_full.png` | 既存 v13 ダッシュボードのビジュアルリファレンス。 |
| `GenSpark_Request_EstimateWizard_Ver2.0.md` | UI 依頼書 Ver2.0 の写し（依頼書本文）。 |

---

## 2. CONTENT FUNDAMENTALS — 文言と語彙の作法

**Language**: 日本語（ja）。**依頼書のラベルは operator 向けの実文言。翻訳・改名
禁止。** 例：「新規見積もり作成」「見積確認」「値引き / クーポン」等はそのまま
の表記。

- **敬語レベル**: ですます調（丁寧語）。命令形は使わない。
  - 例）「次へ」「戻る」「保存する」「キャンセルする」「PDF 出力」
  - `**` 誤: 「保存しなさい」「入力せよ」
- **視点**: システム目線ではなく **operator 視点**。「あなたが選んだもの」を
  常に前面に出す（プルダウンを開かずに把握できる、が Ver2.0 の binding）。
- **文体**: 短く、簡潔に。装飾語・マーケコピー的な形容詞は使わない。
  - 例）「入力必須です」「保存しました」「LINE 送信」
- **人称・呼称**:
  - operator を指すとき: **「APU」** は内部用語で、UI には出さない。UI では
    ラベルを省略するか、「担当」「店舗スタッフ」等の日本語に置き換える。
  - operator の客を指すとき: **「顧客」** または **「お客様」**（Screen1 の
    ラベルは「お客様名 / 会社名」で確定）。
- **数字と単位**: 3 桁カンマ区切り。円は `¥` 前置。パーセントは `%` 後置。
  - 例）`¥248,000` `10%OFF`
- **時制**: 完了は過去形（「保存しました」）、進行は現在進行形（「読み取り中」）。
- **エラーメッセージ**: 原因 → 影響 → 対処 の順で、最大 2 行。
  - 例）「郵便番号を認識できませんでした。手動で入力してください。」
- **ステータス表記**: 常に日本語。`DRAFT` → 「下書き」、`SENT` → 「送信済み」。
- **絵文字**: 既存 `EstimateWizard.tsx` はカテゴリ選択で ✨ 🛡 🪟 🔧 🚿 🧹 📋 を
  使用しているが、Ver2.0 依頼書 §13 は「線画中心・過度な装飾を避ける」と規定。
  **本デザインシステムでは絵文字を廃止し、Lucide 系ストロークアイコンに統一**
  する（下記 ICONOGRAPHY）。ただし外部化された既存機能（emoji ID など）は
  破壊しない。
- **必須マーク**: 全角の `*` ではなく、視覚的にわかる `*`（半角）を Amber 色で
  ラベル横に添える。Amber 色は「未入力」の状態表現も兼ねる（binding）。

---

## 3. VISUAL FOUNDATIONS — 目でわかるルール

### 3.1 Color

**ダークモードのみ**（`prefers-color-scheme` 依存なし）。トークンは
`colors_and_type.css` を正本とする。

- **ベース背景**: `#080d1a`（既存 body 由来のダークネイビー）。夜空のような
  深い青みを含む黒。
- **カード / パネル**: `#1e293b`（slate-800）。角丸 `14px`、`shadow-lg`、
  内側に `p-5` 相当。カード面の下には微かな内側ハイライト
  (`inset 0 1px 0 rgba(255,255,255,0.06)`) を敷いてグラスモーフィズム感を出す。
- **入力面**: `#0f172a`（背景より 1 段明るい）、境界 `slate-700`、focus 時に
  `#1d4ed8`。
- **プライマリ**: `#1d4ed8` を軸に `#2563eb` / `#3b82f6` / `#4f8ef7` の階段。
  hover は `#1e40af` へ 1 段落とす。押下は同色に 3px の外向きグロー。
- **選択ボタン ON**: `bg: rgba(30,58,138,0.40)` + `border: rgba(29,78,216,0.60)` +
  `text: slate-100`。**塗り＋境界で明示**（Ver2.0 §14 binding）。
- **選択ボタン OFF**: `bg: #0f172a` + `border: slate-700` + `text: slate-400`。
  hover で境界のみ `slate-500` に上げる（色は変えない）。
- **必須未入力ハイライト**: **Amber (`#fbbf24`)**。ラベルテキスト、境界
  (`rgba(245,158,11,0.40)`)、微かな背景 tint (`rgba(245,158,11,0.10)`) の 3 段。
  入力完了で即座に通常色（白系）に戻す（Ver2.0 §4-5 binding）。
- **成功**: `#22c55e`。「保存しました」トーストや Screen7 の確定表示。
- **エラー / 破壊**: `#ef4444`。赤帯 `border-red-500/30 bg-red-500/10 text-red-400`。
- **LINE ブランド**: `#06c755`。Screen7 の LINE ボタンに限る。

**イメージのトーン**: 車両ヒーロー画像は **クールで暗め**（青みがかった影・ハイ
ライト）。既存 `car_hero_nobg.png`（紫のウラカン）に合わせ、無彩色 or 青寄り。

### 3.2 Typography

- **書体**: `Geist` を主フォントに、`Noto Sans JP` を日本語で補完。数字は同じ
  `Geist` の tabular-nums（`font-variant-numeric: tabular-nums`）で桁を揃える。
- **サイズ階層**: `11 / 12 / 13 / 14 / 16 / 18 / 20 / 24 / 28 / 36`。
  - Desktop 本文 = 14px、Mobile 本文 = 16px（**iOS ズーム防止 binding**）
  - 見出し = 20〜24px、合計金額 = 28〜36px。
- **セクション見出し**: `text-xs`（11px）+ 太字 + 大文字 + tracking `0.14em`。
  控えめだが、境界として強い。例）`STEP 3 / 作業内容選択`。
- **ラベル**: `text-xs` (12px) + `font-medium` + `slate-400`。必須は Amber。
- **プレースホルダ**: `slate-600`（暗め）。入力時は消える。

### 3.3 Spacing

- **4px baseline**。トークンは 4/8/12/16/20/24/32/40/48/64。
- **カード内 `p-5`（20px）**。セクション間は 24px、密度が必要な明細は 12px 段。
- **タップ最小 48×48px**（Ver2.0 §14, §21 binding）。ボタン間隔は最低 8px。
- **視覚的明瞭さ ＞ コンパクトさ**（衝突時は明瞭さ優先。Ver2.0 §2 binding）。

### 3.4 Backgrounds

- **フルブリード画像は使わない**（業務ツールなので）。例外は Screen 1 の顧客登
  録ヒーロー背景に**微かな青のラジアルグラデ**を敷く程度。
- **繰り返しパターン・テクスチャは無し**。清潔なフラット面と、slate 段階の階層
  だけで空間を作る。
- **グラデーション**: プライマリ CTA（新規見積もり作成ボタン）に限り
  `linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)` を使用。それ以外は使わない。

### 3.5 Borders

- 弱境界: `rgba(255,255,255,0.08)` — カード内区切り、テーブル行間。
- 通常入力枠: `#334155`（slate-700）。focus で `#1d4ed8`。
- 選択 ON 枠: `rgba(29,78,216,0.60)`。
- 角丸: 入力 / ボタン `10px`、カード `14px`、モーダル `20px`。

### 3.6 Shadow / Elevation

- **カード**: `0 10px 20px -5px rgba(0,0,0,0.5), 0 4px 8px -4px rgba(0,0,0,0.4)`
- **モーダル / ポップオーバー**: `0 20px 40px -12px rgba(0,0,0,0.6)`
- **フォーカスリング（primary）**: `0 0 0 3px rgba(29,78,216,0.25)`
- **フォーカスリング（amber, 必須）**: `0 0 0 3px rgba(245,158,11,0.20)`
- **内側ハイライト**（カード上端）: `inset 0 1px 0 rgba(255,255,255,0.06)`

### 3.7 Animation

**Ver2.0 §18 準拠 — 控えめ・高速。**

- スクリーン切替: フェード / スライド 150–200ms、`cubic-bezier(0.16, 1, 0.3, 1)`
- 合計金額更新: 短い色パルス（点滅は不可）。150ms 内に完結。
- auto-advance トースト: 1〜1.5 秒。追加操作は付けない。
- ローディング: スピナー（プライマリ色）または段階的スケルトン。
- オーバーレイ（OCR/QR）: フェードイン + 軽い scale(1.02→1.0)。閉じるは即時。
- `prefers-reduced-motion: reduce` を尊重（`colors_and_type.css` で無効化済み）。

### 3.8 Hover / Press states

- **hover**: 境界色を 1 段強く（slate-700 → slate-500）。塗りは変えない。
- **press**: 3px の外向きグロー（プライマリ色）+ 一瞬 scale(0.98)。
- **disabled**: `opacity: 0.45`, `pointer-events: none`, カーソル `not-allowed`。
- **loading**: 内容を保持したままスピナーを内包し、テキストは色を落とす。

### 3.9 Transparency / Blur

- モーダル背景の overlay は `rgba(8,13,26,0.72)` + `backdrop-blur(12px)`。
- Sticky Total Panel の下端に微かな上向きシャドウ + `backdrop-blur(8px)`。
- **多用しない**。業務データが霞むと有害。

### 3.10 Layout Rules（Fixed elements）

- Desktop: 左サイドバー（`280px`, 固定）+ 上部ヘッダー（`64px`, sticky）+ 右
  Sticky Total Panel（`320px`, sticky）+ 中央コンテンツ（`max-w-6xl`）。
- Tablet / Smartphone: 上部ヘッダー（`56px`）+ コンパクトステッパー + 下部固定
  合計バー（`88px`, safe-area 込み）。
- ステッパーは **常時全ステップクリック可**（未到達をロックしない — Ver2.0 §9
  binding）。
- Screen4 のカテゴリ切替は **左サイド縦タブ**（Desktop / Tablet）または上部
  横タブ（Mobile）。**タブ切替はスクロールより速い**。

### 3.11 What "Cards" look like

- 背景 `#1e293b`、境界 `rgba(255,255,255,0.08)`、角丸 `14px`、
  `padding: 20px`、`shadow-lg`、内側ハイライト `inset 0 1px 0 rgba(255,255,255,0.06)`。
- 見出しは overline スタイル（極小・大文字・tracking）で、その下に本文。
- カード同士の間隔は `24px`。

---

## 4. ICONOGRAPHY

### 4.1 選択理由と方針

Ver2.0 §13 は「線画中心・ダーク背景で視認性の高いストローク」を規定。既存
コードベースには svg アイコンとして `public/file.svg`, `globe.svg`, `logo.svg`,
`window.svg` があるが、UI の全アイコンをまかなうには不十分。

**採用**: [Lucide Icons](https://lucide.dev)（CDN 版）に統一。ストローク幅 `1.75`。
色は `currentColor` にして、テキストと同期。

- **なぜ Lucide か**: 業務ツール向けに最適化された 1500+ アイコンで、ストローク
  ベース。Heroicons と比べても意匠が中立的。日本語 UI との相性がよい。
- **利用方法**: CDN `https://unpkg.com/lucide@latest` を各 HTML から読み込み、
  `<i data-lucide="user">` を DOM に置いて `lucide.createIcons()` を 1 回だけ呼
  ぶ（`MutationObserver` に接続しない — 無限ループ注意）。
- **サイズ**: 18px（ラベル横）/ 20px（ボタン内）/ 24px（ヘッダー・大型 CTA）。

### 4.2 依頼書要件との対応（§13）

| 用途 | Lucide アイコン | 備考 |
|---|---|---|
| ステップ 1 顧客 | `user` | |
| ステップ 2 車両 | `car` | |
| ステップ 3 作業 | `sparkles` | 「作業」は sparkles で装飾を含意 |
| ステップ 4 見積 | `receipt` | 明細リスト |
| ステップ 5 値引き | `tag` | クーポン兼務 |
| ステップ 6 備考 | `notepad-text` | |
| ステップ 7 確認 | `check-circle-2` | |
| 保存 | `save` | |
| PDF | `file-text` | |
| LINE | 専用 SVG（LINE ブランド）| CDN では代替不可 |
| 予約カレンダー | `calendar` | |
| 請求書 / 納品書 | `file-invoice`, `truck` | |
| OCR カメラ | `camera` / `scan-line` | |
| QR | `qr-code` | |
| 追加 | `plus` | |
| 削除 | `trash-2` | |
| 編集 | `pencil` | |
| 完了 | `check` | |
| ローディング | `loader-2` （スピン）| |
| エラー | `alert-triangle` | Amber と赤で使い分け |

### 4.3 SNS ブランドアイコン

`LINE` は Lucide にないため、公式ブランドカラー `#06c755` を用いた専用 SVG を
`assets/icons/line.svg` に置く。`WhatsApp` / `Instagram` / `X` は Ver2.0 では
未実装だが、将来追加時に同じアプローチで専用 SVG を追加する。

### 4.4 ブランドロゴ

- `assets/gyeon-detailer-logo.png` — GYEON DETAILER AGENT ロゴ（黒地・幾何学
  的 G ライン）。サイドバー・スクリーン 1 のヘッダーに使用。
- `assets/logo.svg`, `assets/logo-dark.svg` — Next.js デフォルトの残骸（保存
  用）。UI では使用しない。
- `assets/car_hero_nobg.png` — 紫のウラカン。トップページのヒーロー用（見積
  ウィザードでは使用しない）。

### 4.5 絵文字ポリシー

**絵文字は UI 表面では使わない。** 既存の `EstimateWizard.tsx` にはカテゴリ絵
文字（✨🛡🪟🔧🚿🧹📋）があるが、Ver2.0 準拠版 UI キットではすべて Lucide 線画に
置換する。裏側の enum 名や識別子（例: `emoji: "✨"`）は破壊しない。

---

## 5. CAVEATS & NEXT STEPS

- **フォント**: Geist は Google Fonts CDN 経由で読み込んでいます。本番は
  `next/font/google` の self-host が既に `layout.tsx` に組まれているので、UI キ
  ットを移植する際にそのまま流用可能です。
- **アイコン**: Lucide は CDN 使用。オフライン運用や PWA では
  `lucide-static` を npm install して SVG を bundle するのを推奨。
- **LINE / WhatsApp / Instagram / X のブランド SVG**: 本デザインシステム同梱の
  `assets/icons/line.svg` は簡易実装です。ブランドガイドライン準拠版に差し替
  えを推奨。
- **既存 `EstimateWizard.tsx`（1503 行）との統合**: 本 UI キットは JSX で書か
  れていますが、実プロダクションでは既存のロジック層と props を合わせる必要が
  あります。特に `pricing-engine`, `pricing-data`, `dealer-settings-types` の
  型は変えていないので、ビュー層だけ差し替える形が理想です。

---

**質問・修正依頼はお気軽に。**
`ui_kits/estimate-wizard/index.html` を開いて実際に 7 画面を触ってみてください。
