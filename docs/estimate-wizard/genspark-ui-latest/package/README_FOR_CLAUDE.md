# README_FOR_CLAUDE — Claude へのエントリーポイント

**このファイルを最初に読んでください。** Zip 内の残りのファイルへの案内と、
本デザインシステムを扱う際の絶対ルールをまとめています。

---

## 1. これは何？

**DealerOS GYEON Design System v2.0** の完全一式です。
GYEON 見積もり APP（全国 GYEON ディーラー向けマルチテナント SaaS）の
**見積ウィザード Screen 1〜7** の UI デザインシステムと、その UI キット
（PC / Tablet / Mobile）を格納しています。

- **ソース**: `GenSpark_Request_EstimateWizard_Ver2.0.md`（唯一の正本依頼書）
- **既存コードベース**: [github.com/nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON)
  - Next.js 15 + React 19 + Tailwind v4 + Supabase
- **本パッケージのバージョン**: v2.0（PC + Tablet 完成 / Smartphone v2.1 予定）
- **パッケージング日**: 2026-07-09

---

## 2. あなた（Claude）に期待する読み順

```
1. README_FOR_CLAUDE.md         ← いま読んでいるファイル
2. DESIGN_GUIDE.md              ← 統合ガイド（色・タイポ・binding ルール）
3. GenSpark_Request_EstimateWizard_Ver2.0.md   ← UI の唯一の正本依頼書
4. README.md                    ← デザインシステム全体の詳解
5. SKILL.md                     ← 別プロジェクトから attach する用の定義
6. CHANGELOG.md                 ← v2.0 リリースノート
7. colors_and_type.css          ← 全 CSS 変数の正本
8. ui_kits/estimate-wizard/index.html   ← PC 版デモを実際に触る
9. src/components/estimates/EstimateWizard.tsx  ← 既存 1503 行の本番実装
```

**タスクを受けたら、上記 1〜3 は必ず全文読んでから着手してください。**
4〜6 は必要に応じて、7〜9 は該当タスクに関わる場合のみ。

---

## 3. フォルダ構成（Zip 内マップ）

```
GYEON_DealerOS_DesignSystem/
├── README_FOR_CLAUDE.md          ★ このファイル
├── DESIGN_GUIDE.md               ★ 統合デザインガイド（新規追加）
├── README.md                     デザインシステム全体の詳解
├── SKILL.md                      別プロジェクト attach 用の Skill 定義
├── CHANGELOG.md                  v2.0 リリースノート
├── GenSpark_Request_EstimateWizard_Ver2.0.md   ★ 正本依頼書
├── colors_and_type.css           ★ CSS 変数の正本（色・型・余白・角丸・影・モーション）
├── thumbnail.png                 デザインシステムのカバー画像
├── v13_fold.png                  v13 ダッシュボードのビジュアルリファレンス
├── v13_full.png                  同上（フル版）
│
├── assets/                       ブランドアセット
│   ├── car_hero_nobg.png         紫のウラカン（Hero 用）
│   ├── gyeon-detailer-logo.png   GYEON DETAILER AGENT ロゴ
│   ├── icon-192.png              アプリアイコン
│   ├── logo.svg / logo-dark.svg  Next.js 残骸（UI では未使用）
│   └── icons/
│       └── line.svg              LINE ブランドカラー SVG
│
├── public/                       Next.js public/（assets/ のミラー）
│
├── preview/                      Design System タブ用カード（21 枚）
│   ├── brand-*.html              ロゴ / アイコン / 必須マーク / 本文サイズ
│   ├── color-*.html              Primary / Semantic / Surface / Text
│   ├── comp-*.html               Button / Card / Input / SelectButton / Stepper / Total / Badge
│   ├── spacing-*.html            Radius / Scale / Shadow
│   └── type-*.html               Body / Headline / Numeric
│
├── ui_kits/                      ★ UI キット本体
│   ├── estimate-wizard/          PC 版（1024px+）
│   │   ├── index.html            ← エントリ HTML
│   │   ├── shell.jsx             サイドバー + ヘッダー + Sticky Total
│   │   ├── components.jsx        共通コンポーネント（SelectButton, Field, Card 等）
│   │   ├── data.js               モックデータ
│   │   └── screens/
│   │       ├── Screen1_Customer.jsx      顧客登録
│   │       ├── Screen2_Vehicle.jsx       車両登録
│   │       ├── Screen3_Category.jsx      作業内容選択
│   │       ├── Screen4_Estimate.jsx      見積（★最重要・42KB）
│   │       ├── Screen5_Discount.jsx      値引き / クーポン
│   │       ├── Screen6_Notes.jsx         備考
│   │       └── Screen7_Review.jsx        確認
│   ├── estimate-wizard-mobile/           Mobile 版（<768px）
│   ├── estimate-wizard-tablet-adaptive/  ⭐ Tablet Adaptive（推奨）
│   ├── estimate-wizard-tablet-landscape/ Tablet 横向き最適
│   ├── estimate-wizard-tablet-portrait/  Tablet 縦向き最適
│   ├── mobile-preview.html               iPhone フレームプレビュー
│   └── tablet-preview.html               iPad Pro 11" 3 パターン比較
│
├── src/                          ★ 既存本番コードベース（read-only 参照）
│   ├── app/
│   │   └── globals.css           RC-10 デザイントークンの本家
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── customers/
│   │   │   └── CustomerForm.tsx
│   │   └── estimates/
│   │       ├── EstimateWizard.tsx        ★ 1503 行の本番実装
│   │       ├── EstimateForm.tsx
│   │       └── EstimateSummary.tsx
│   └── types/
│       ├── customer.ts / estimate.ts / vehicle.ts
│
├── pc-ui/                        プラットフォーム別リリース（README のみ）
├── mobile-ui/                    同上
├── tablet-ui/                    同上
│
└── screenshots/                  代表スクリーンショット（20 枚選定）
    ├── 01-final_pc_full_ppf.png          PC 版 Screen4 完成形
    ├── 01-final_pc_full_with_partial.png PC 版 PPF 部分施工含む
    ├── mobile_screen4.png                Mobile Screen4
    ├── tablet_adaptive_s4.png            Tablet Adaptive Screen4
    └── ...
```

---

## 4. 絶対 binding — これだけは必ず守ってください

Ver2.0 依頼書 §23 と本デザインシステムで確定した、**破ることが許されない**
ルールです。デザインを変更する余地はありますが、以下は不可変です。

### 4.1 UI 構造の binding

| # | ルール | 由来 |
|---|---|---|
| 1 | **ダークモードのみ**。ライトモード不作成 | Ver2.0 §17 |
| 2 | **7 スクリーン固定順序** — 顧客 → 車両 → 作業内容 → 見積 → 値引き → 備考 → 確認。統合・分割・並べ替え・削除 **禁止** | Ver2.0 §5 |
| 3 | **Screen 3 以降プルダウン全面禁止**。選択は必ず `SelectButton`（押しボタン）で行う | Ver2.0 §14 |
| 4 | **committing 操作を絶対に増やさない**。確認ダイアログ・追加ボタン・ステップの追加 **禁止** | Ver2.0 §2 |
| 5 | **必須未入力 = Amber (#fbbf24) ハイライト**。入力完了で即座に通常色に戻す | Ver2.0 §4-5 |
| 6 | **全ステップ 1 タップジャンプ可**。ステッパーは未到達もロックしない | Ver2.0 §9 |
| 7 | **muscle memory 保持** — 新規/編集で見た目・順序・ラベルを一貫させる | Ver2.0 §21 |
| 8 | **タップ最小 48×48px**、モバイル入力 `font-size: 16px`（iOS ズーム防止） | Ver2.0 §14, §21 |

### 4.2 ラベル・文言の binding

**依頼書のラベルは operator 向けの実文言。翻訳・改名・省略は不可。**
以下は特に頻出：

- 「新規見積もり作成」「見積確認」「値引き / クーポン」「お客様名 / 会社名」
- ですます調（丁寧語）。命令形は使わない。
- 「APU」は内部用語で UI には出さない → 「担当」「店舗スタッフ」に置き換え
- 客の呼称は「顧客」または「お客様」

### 4.3 コード上の binding

- **既存の型は変えない**: `pricing-engine`, `pricing-data`, `dealer-settings-types`
- **既存 enum の絵文字識別子は破壊しない**: `emoji: "✨"` 等の内部識別子は残す
  （ただし UI 表面では Lucide 線画に置換）
- **絵文字を UI 表面で使わない**（Lucide 線画に統一、stroke 1.75）
- **色は `colors_and_type.css` の CSS 変数のみを使う** — 新色の発明禁止

---

## 5. デザイン変更が **可能な** 範囲

以下はデザイナー / Claude の裁量で調整可能：

- 見た目（配色階調・余白・シャドウ強度）
- レイアウト構造（カード配置・グリッド）
- タイポグラフィ（サイズ階層内での調整）
- アニメーション（Ver2.0 §18 の枠内で）
- アイコンの選定（Lucide の中から）

**ただし**: 上記 4.1〜4.3 の binding は絶対に守ってください。

---

## 6. よくある作業パターン

### 6.1 新規画面を追加する場合

**NG**: Screen 8 を追加する → 7 スクリーン binding 違反
**OK**: 既存画面のオーバーレイ（OCR / QR / モーダル）として組み込む

### 6.2 コンポーネントを新設する場合

1. まず `ui_kits/estimate-wizard/components.jsx` に既存があるか確認
2. なければ既存の `SelectButton` / `Field` / `Card` / `Stepper` から派生させる
3. `colors_and_type.css` の CSS 変数のみで着色
4. Lucide アイコンで統一（`<i data-lucide="xxx">`）

### 6.3 色を追加したい場合

**NG**: 新色を発明する
**OK**: `colors_and_type.css` の既存トークンを組み合わせる

### 6.4 レイアウトを変える場合

- Desktop: 左サイドバー 280px + Sticky Total 320px を維持
- Tablet: adaptive / portrait / landscape の 3 パターンを崩さない
- Mobile: 下部固定バー（88px, safe-area 込み）を維持

---

## 7. 実装スタック（既存本番）

- **フレームワーク**: Next.js 15 (App Router) + React 19
- **CSS**: Tailwind v4（`src/app/globals.css` で RC-10 トークン定義）
- **DB**: Supabase (PostgreSQL + RLS)
- **フォント**: `next/font/google` で Geist + Noto Sans JP を self-host
- **アイコン**: Lucide（CDN 版は本 UI キット、本番は `lucide-react` 想定）
- **State**: React Context + useReducer（見積フォームは 1 巨大ステート）
- **バリデーション**: Zod（型定義は `src/types/`）

---

## 8. 未実装 / TODO（v2.1 以降）

- **Smartphone UI (<768px)** — 依頼書 §8。次期リリース対象
- **予約カレンダー / 代車 / 請求書 / 納品書** — 依頼書対象外（別スペック）
- **保証書** — 施工完了後の別モジュール
- **WhatsApp / Instagram / X 通信** — API 登録時に自動追加のプレースホルダのみ

---

## 9. 質問・不明点があれば

以下を優先度順に確認してください：

1. `GenSpark_Request_EstimateWizard_Ver2.0.md` — 依頼書本文（binding）
2. `README.md` — CONTENT FUNDAMENTALS / VISUAL FOUNDATIONS / ICONOGRAPHY
3. `DESIGN_GUIDE.md` — 本パッケージで新規統合したガイド
4. `src/components/estimates/EstimateWizard.tsx` — 既存の 1503 行実装

**それでも不明な場合は、勝手に判断せず、必ずユーザに確認してください。**
特にラベル文言・スクリーン順序・ダークモード方針は **勝手に変更しない**。

---

## 10. 品質チェックリスト（実装後）

以下を **必ず** すべてクリアしてから納品してください：

- [ ] 4.1 の 8 つの binding をすべて満たしている
- [ ] 新色を発明していない（`colors_and_type.css` のみ使用）
- [ ] プルダウンを追加していない（Screen 3 以降）
- [ ] タップ 48×48px 以上
- [ ] ダークモードのみで動作確認
- [ ] Amber ハイライトが必須未入力で機能している
- [ ] ステッパーが全ノード 1 タップジャンプ可
- [ ] 絵文字が UI 表面に出ていない（enum の裏側は OK）
- [ ] ですます調で統一（命令形なし）
- [ ] 3 桁カンマ + `¥` 前置 + tabular-nums で金額表示
- [ ] `EstimateWizard.tsx` (1503 行) と型が互換
- [ ] `prefers-reduced-motion` を尊重

---

**このパッケージは 2026-07-09 時点の v2.0 スナップショットです。**
最新版は [github.com/nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON) を確認してください。
