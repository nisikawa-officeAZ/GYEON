# DESIGN_GUIDE — DealerOS GYEON Design System 統合ガイド

**このドキュメントは色・タイポ・スペーシング・コンポーネント・アニメーションを
1 箇所で参照できるようにした統合版デザインガイドです。**
`README.md` の内容を再構成し、実装しやすい形にまとめています。

---

## 目次

1. [デザイン哲学](#1-デザイン哲学)
2. [Color System — 色の正本](#2-color-system--色の正本)
3. [Typography — 書体とサイズ階層](#3-typography--書体とサイズ階層)
4. [Spacing — 余白の 4px baseline](#4-spacing--余白の-4px-baseline)
5. [Borders & Radius — 境界と角丸](#5-borders--radius--境界と角丸)
6. [Shadow & Elevation — シャドウ体系](#6-shadow--elevation--シャドウ体系)
7. [Animation — モーション設計](#7-animation--モーション設計)
8. [Layout — 画面構成ルール](#8-layout--画面構成ルール)
9. [Components — 中核コンポーネント](#9-components--中核コンポーネント)
10. [Iconography — アイコン方針](#10-iconography--アイコン方針)
11. [State — 状態表現](#11-state--状態表現)
12. [Copywriting — 文言の作法](#12-copywriting--文言の作法)
13. [Accessibility — アクセシビリティ](#13-accessibility--アクセシビリティ)
14. [Do / Don't 早見表](#14-do--dont-早見表)

---

## 1. デザイン哲学

> **プロフェッショナルな業務ツール。装飾より情報密度・操作速度・視認性。**

- 対象ユーザは **operator（店舗スタッフ）**。1 日に何十件も見積を作成する。
- **muscle memory の保持** が最優先。新規と編集で見た目・順序を変えない。
- **committing 操作を絶対に増やさない**。確認ダイアログ・追加ボタン・
  ステップ追加は原則禁止。
- **押しボタン式選択**（プルダウン禁止）で「今何が選ばれているか」を常に可視化。
- **視覚的明瞭さ ＞ コンパクトさ**（衝突時は明瞭さ優先）。
- **ダークモードのみ**。ライトモードは作らない。

---

## 2. Color System — 色の正本

**正本ファイル**: `colors_and_type.css`
**新色の発明は禁止**。以下のトークンを組み合わせて使う。

### 2.1 Surface（背景階層）

| トークン | 値 | 用途 |
|---|---|---|
| `--ds-bg-base` | `#080d1a` | body 背景（ダークネイビー、夜空調） |
| `--ds-bg-card` | `#1e293b` (slate-800) | カード / パネル |
| `--ds-bg-input` | `#0f172a` | 入力フィールド背景 |
| `--ds-bg-selected` | `rgba(30, 58, 138, 0.40)` | 選択 ON の塗り |

### 2.2 Primary（プライマリ階段）

| トークン | 値 | 用途 |
|---|---|---|
| `--ds-primary-500` | `#3b82f6` | ボタン既定 |
| `--ds-primary-600` | `#2563eb` | ボタン強調・CTA 開始色 |
| `--ds-primary-700` | `#1d4ed8` | フォーカスリング・CTA 終了色 |
| `--ds-primary-800` | `#1e40af` | hover |

**プライマリ CTA のグラデーション**（新規見積もり作成ボタンのみ）:
```css
background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
```

### 2.3 Semantic（意味付き色）

| 意味 | 色 | 用途 |
|---|---|---|
| **Amber (必須)** | `#fbbf24` | 必須未入力ハイライト（境界 + tint + ラベル） |
| **Success** | `#22c55e` | 「保存しました」トースト・Screen7 確定 |
| **Error** | `#ef4444` | 破壊操作・エラー帯 |
| **LINE** | `#06c755` | Screen7 の LINE ボタンのみ |

**必須未入力ハイライトの 3 段**（Amber）:
- ラベルテキスト: `#fbbf24`
- 境界: `rgba(245, 158, 11, 0.40)`
- 背景 tint: `rgba(245, 158, 11, 0.10)`
- フォーカスリング: `0 0 0 3px rgba(245, 158, 11, 0.20)`

**入力完了で即座に通常色（白系）に戻す**。これは **binding**。

### 2.4 選択ボタン ON/OFF

| 状態 | 塗り | 境界 | テキスト |
|---|---|---|---|
| **ON** | `rgba(30, 58, 138, 0.40)` | `rgba(29, 78, 216, 0.60)` | `slate-100` |
| **OFF** | `#0f172a` | `slate-700` | `slate-400` |
| **OFF hover** | 変えない | `slate-500` | 変えない |

塗り＋境界＋右上チェックマークで「常に何が選択中か把握できる」を実現。

### 2.5 弱境界

- `rgba(255, 255, 255, 0.08)` — カード内区切り、テーブル行間

---

## 3. Typography — 書体とサイズ階層

### 3.1 書体

| 用途 | 書体 |
|---|---|
| Primary | **Geist** |
| 日本語補完 | **Noto Sans JP** |
| 数字 | Geist の **tabular-nums**（`font-variant-numeric: tabular-nums`） |

### 3.2 サイズ階層（10 段）

`11 / 12 / 13 / 14 / 16 / 18 / 20 / 24 / 28 / 36`

| 用途 | Desktop | Mobile |
|---|---|---|
| セクション見出し（overline） | 11px | 11px |
| ラベル | 12px | 12px |
| 本文 | **14px** | **16px** (iOS ズーム防止 binding) |
| 見出し | 20-24px | 20-24px |
| 合計金額 | 28-36px | 28-36px |

### 3.3 スタイルパターン

**セクション見出し（overline）**:
```css
font-size: 11px;
font-weight: bold;
text-transform: uppercase;
letter-spacing: 0.14em;
color: var(--ds-text-tertiary);
```

**ラベル**:
```css
font-size: 12px;
font-weight: 500;
color: var(--ds-text-secondary);  /* slate-400 */
/* 必須の場合は Amber: color: #fbbf24; */
```

**プレースホルダ**:
```css
color: var(--ds-text-placeholder);  /* slate-600 (暗め) */
```

**数字表示**（`.ds-numeric` または `.ds-price-total`）:
```css
font-variant-numeric: tabular-nums;
```

---

## 4. Spacing — 余白の 4px baseline

### 4.1 スケール

`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64` px

### 4.2 用途

| 場面 | 値 |
|---|---|
| カード内 padding | **20px** (p-5) |
| セクション間 | 24px |
| 密度必要な明細 | 12px 段 |
| ボタン間隔 | 最低 8px |
| **タップターゲット最小** | **48×48px** (Tablet では 56px+ 推奨) |

**視覚的明瞭さ ＞ コンパクトさ**。詰め込みたい欲求より、間隔を確保。

---

## 5. Borders & Radius — 境界と角丸

### 5.1 境界

| 種類 | 値 |
|---|---|
| 弱境界 | `rgba(255, 255, 255, 0.08)` |
| 通常入力枠 | `#334155` (slate-700) |
| 入力 focus | `#1d4ed8` |
| 選択 ON 枠 | `rgba(29, 78, 216, 0.60)` |

### 5.2 角丸

| 対象 | 角丸 |
|---|---|
| 入力 / ボタン | **10px** |
| カード | **14px** |
| モーダル | **20px** |

---

## 6. Shadow & Elevation — シャドウ体系

| 対象 | シャドウ |
|---|---|
| **カード** | `0 10px 20px -5px rgba(0,0,0,0.5), 0 4px 8px -4px rgba(0,0,0,0.4)` |
| **モーダル / ポップオーバー** | `0 20px 40px -12px rgba(0,0,0,0.6)` |
| **フォーカスリング (primary)** | `0 0 0 3px rgba(29, 78, 216, 0.25)` |
| **フォーカスリング (amber, 必須)** | `0 0 0 3px rgba(245, 158, 11, 0.20)` |
| **内側ハイライト**（カード上端） | `inset 0 1px 0 rgba(255, 255, 255, 0.06)` |

**カードには必ず内側ハイライト**を敷いてグラスモーフィズム感を出す。

---

## 7. Animation — モーション設計

**Ver2.0 §18 準拠 — 控えめ・高速。**

| 場面 | 時間 | イージング |
|---|---|---|
| スクリーン切替 | 150-200ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| 合計金額更新 | ≤150ms | 短い色パルス（点滅不可） |
| auto-advance トースト | 1-1.5s | 追加操作なし |
| ローディング | - | スピナー（primary）または段階的スケルトン |
| オーバーレイ（OCR/QR） | - | フェードイン + `scale(1.02→1.0)`。閉じるは即時 |

**`prefers-reduced-motion: reduce` を尊重**（`colors_and_type.css` で無効化済み）。

### hover / press states

- **hover**: 境界色を 1 段強く（slate-700 → slate-500）。塗りは変えない。
- **press**: 3px の外向きグロー（primary）+ 一瞬 `scale(0.98)`。
- **disabled**: `opacity: 0.45`, `pointer-events: none`, cursor `not-allowed`。
- **loading**: 内容を保持したままスピナーを内包、テキストは色を落とす。

---

## 8. Layout — 画面構成ルール

### 8.1 Desktop (1024px+)

```
┌────────────────────────────────────────────────────────┐
│ Sidebar (280px, 固定)          Header (64px, sticky)  │
│                        ────────────────────────────────│
│                        Content         Sticky Total   │
│  logo                  (max-w-6xl)     (320px, sticky)│
│  nav                   Screen 1-7                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 8.2 Tablet (768-1023px)

- **Landscape**: PC 準拠の右 Sticky Total 220px 維持
- **Portrait**: ヘッダーミニピル常設 + 中央全幅（右パネル非表示）
- **Adaptive**: 向きに応じて自動切替（推奨）

### 8.3 Mobile (<768px)

- 上部ヘッダー 56px
- コンパクトステッパー
- 下部固定合計バー **88px**（safe-area 込み）

### 8.4 ステッパー

- **7 ノード横並び**（PC / Tablet Landscape）
- **常時全ノードクリック可** — 未到達をロックしない（**binding**）
- 完了: 緑チェック / 現在: Blue グラデ / 未着手: ニュートラル

### 8.5 Screen 4 のカテゴリ切替

- Desktop / Tablet: **左サイド縦タブ**
- Mobile: **上部横タブ（SegmentedControl）**

**タブ切替はスクロールより速い**。スクロールで到達させない。

---

## 9. Components — 中核コンポーネント

### 9.1 SelectButton ★ Ver2.0 の中核

**プルダウンの代替。**

```jsx
<SelectButton
  selected={value === 'option1'}
  onClick={() => setValue('option1')}
>
  選択肢名
  {/* selected 時に右上に✓チェック */}
</SelectButton>
```

- ON: `bg-blue-950/40` + `border-blue-500/60` + 右上チェック
- OFF: `bg-slate-900` + `border-slate-700`
- タップ 48×48px 以上（Tablet は 56px+）

### 9.2 Field + Input

```jsx
<Field label="お客様名" required>
  <Input value={name} onChange={...} placeholder="山田 太郎" />
</Field>
```

- 必須未入力: Amber ハイライト
- 入力完了: 通常色に戻る（自動遷移）
- Mobile 入力: `font-size: 16px`（iOS ズーム防止）

### 9.3 Card

```jsx
<Card>
  <CardHeading>セクション名</CardHeading>
  <CardBody>...</CardBody>
</Card>
```

- 背景 `#1e293b`、角丸 14px、padding 20px、shadow-lg
- 内側ハイライト `inset 0 1px 0 rgba(255,255,255,0.06)`
- カード同士は 24px 間隔

### 9.4 Stepper

```jsx
<Stepper current={3} nodes={7} onClick={i => setStep(i)} />
```

- 7 ノード固定
- 全ノードクリック可
- 完了は緑チェック / 現在は Blue グラデ / 未着手はニュートラル

### 9.5 StickyTotalPanel

- Desktop: 右サイド 320px, sticky
- Tablet Landscape: 220px
- Mobile: 下部固定バー 88px + タップで内訳シート

### 9.6 オーバーレイ系

- **OCROverlay**: 車検証 OCR カメラ（フェードイン + scale）
- **QROverlay**: QR 読み取り
- **CustomerSearchModal**: 顧客検索

**モーダル入れ子は禁止**。閉じるは即時。

---

## 10. Iconography — アイコン方針

**Lucide Icons**（CDN）に統一。ストローク幅 `1.75`、色は `currentColor`。

```html
<script src="https://unpkg.com/lucide@latest"></script>
<i data-lucide="user"></i>
<script>lucide.createIcons();  /* ⚠ 初期化時 1 回だけ。MutationObserver 禁止 */</script>
```

### サイズ

- ラベル横: 18px
- ボタン内: 20px
- ヘッダー・大型 CTA: 24px

### ステップアイコン対応表

| ステップ | Lucide |
|---|---|
| 1 顧客 | `user` |
| 2 車両 | `car` |
| 3 作業 | `sparkles` |
| 4 見積 | `receipt` |
| 5 値引き | `tag` |
| 6 備考 | `notepad-text` |
| 7 確認 | `check-circle-2` |

### 主要操作アイコン

| 操作 | Lucide |
|---|---|
| 保存 | `save` |
| PDF | `file-text` |
| LINE | 専用 SVG (`assets/icons/line.svg`) |
| 予約カレンダー | `calendar` |
| OCR カメラ | `camera` / `scan-line` |
| QR | `qr-code` |
| 追加 | `plus` |
| 削除 | `trash-2` |
| 編集 | `pencil` |
| 完了 | `check` |
| ローディング | `loader-2` (spin) |
| エラー | `alert-triangle` |

### 絵文字ポリシー

**UI 表面では使わない**。既存 `EstimateWizard.tsx` のカテゴリ絵文字
（✨🛡🪟🔧🚿🧹📋）はすべて Lucide 線画に置換。
**enum の裏側 (`emoji: "✨"`) は破壊しない**。

---

## 11. State — 状態表現

### 11.1 必須未入力（Amber）

3 段のうち **少なくとも 2 段** を使う：
- ラベルテキストを Amber
- 境界を Amber (40% 透過)
- 背景に微かな Amber tint (10% 透過)

**入力完了で即座に通常色（白系）に戻す**（binding）。

### 11.2 保存中 / 保存完了

- 保存中: スピナー（primary）+ テキスト色ダウン
- 完了: Success (`#22c55e`) トースト「保存しました」1-1.5s auto-hide

### 11.3 エラー

```css
border: 1px solid rgba(239, 68, 68, 0.30);
background: rgba(239, 68, 68, 0.10);
color: #f87171;  /* red-400 */
```

原因 → 影響 → 対処 の順で最大 2 行。

### 11.4 disabled

```css
opacity: 0.45;
pointer-events: none;
cursor: not-allowed;
```

---

## 12. Copywriting — 文言の作法

### 12.1 敬語レベル

- **ですます調（丁寧語）**。命令形禁止。
- 良: 「次へ」「戻る」「保存する」「PDF 出力」
- 悪: 「保存しなさい」「入力せよ」

### 12.2 人称

- operator = **「担当」「店舗スタッフ」**（「APU」は内部用語で UI に出さない）
- 客 = **「お客様」**（Screen 1 の「お客様名 / 会社名」で確定）

### 12.3 数字と単位

- 3 桁カンマ区切り
- 円: `¥` **前置**（例: `¥248,000`）
- パーセント: `%` **後置**（例: `10%OFF`）
- 必ず `tabular-nums`

### 12.4 時制

- 完了 → 過去形（「保存しました」）
- 進行 → 現在進行形（「読み取り中」）

### 12.5 ステータス表記

- 常に日本語
- `DRAFT` → 「下書き」
- `SENT` → 「送信済み」

### 12.6 必須マーク

- 全角ではなく半角 `*` を Amber 色でラベル横に

---

## 13. Accessibility — アクセシビリティ

- **タップ最小 48×48px**（Tablet は 56px+）
- **モバイル入力 `font-size: 16px`**（iOS ズーム防止 binding）
- **フォーカスリング** を全インタラクティブ要素に付与
- **`prefers-reduced-motion: reduce`** を尊重
- **色のみで情報伝達しない** — Amber は色 + `*` マーク + ラベル文言
- **キーボードナビゲーション**: Tab / Enter / Esc に対応

---

## 14. Do / Don't 早見表

### Do ✅

- ✅ `colors_and_type.css` の CSS 変数のみで着色
- ✅ 押しボタン式選択（`SelectButton`）でプルダウンを置換
- ✅ 必須未入力を Amber 3 段でハイライト、入力完了で即座に通常色に戻す
- ✅ ステッパーを全ノードクリック可にする
- ✅ Lucide 線画で全アイコンを統一（stroke 1.75）
- ✅ ですます調で統一
- ✅ 3 桁カンマ + `¥` 前置 + `tabular-nums` で金額表示
- ✅ タップ 48×48px 以上
- ✅ ダークモードのみで作る

### Don't ❌

- ❌ 新色を発明する
- ❌ ライトモードを追加する
- ❌ ステップを 7 個から増減する
- ❌ ラベルを翻訳・改名・省略する
- ❌ プルダウン `<select>` を使う（Screen 3 以降）
- ❌ committing 操作を増やす（確認ダイアログ・追加ボタン）
- ❌ 絵文字を UI 表面に出す
- ❌ 命令形（「保存しなさい」）を使う
- ❌ MutationObserver で `lucide.createIcons()` を呼ぶ（無限ループ）
- ❌ フルブリード画像を業務画面に敷く
- ❌ ヘッダーで内部用語「APU」を露出させる

---

**このガイドは `colors_and_type.css` と `ui_kits/estimate-wizard/` を
一次ソースとして参照しています。齟齬があればソースを優先してください。**
