# DealerOS GYEON — PC UI

**GYEON 見積もり APP（DealerOS）— PC 版 UI (v2.0)**

デスクトップ (1024px+) 向けの見積ウィザード UI キット。
Ver2.0 依頼書 (`GenSpark_Request_EstimateWizard_Ver2.0.md`) に完全準拠。

---

## 🚀 クイックスタート

```
ui_kits/estimate-wizard/index.html
```

をブラウザで開くだけで動作します。ビルド不要。

---

## 📁 フォルダ構成

```
pc-ui/
├── README.md                              このファイル
├── CHANGELOG.md                           変更履歴
├── GenSpark_Request_EstimateWizard_Ver2.0.md   Ver2.0 依頼書 (UI の唯一の正本)
├── colors_and_type.css                    正本トークン (CSS 変数)
├── assets/                                 ブランドロゴ・アイコン
│   ├── gyeon-detailer-logo.png            GYEON DETAILER AGENT ロゴ
│   ├── car_hero_nobg.png                  車両ヒーロー画像 (紫のウラカン)
│   ├── icon-192.png                       アプリアイコン
│   ├── icons/line.svg                     LINE ブランド SVG
│   └── logo.svg, logo-dark.svg
├── ui_kits/estimate-wizard/               見積ウィザード UI キット
│   ├── index.html                         👈 エントリーポイント
│   ├── components.jsx                     共通コンポーネント
│   ├── shell.jsx                          サイドバー・ヘッダー・ステッパー・Sticky Total
│   ├── data.js                            マスターデータ (コーティング階層・PPF 等)
│   ├── screens/
│   │   ├── Screen1_Customer.jsx           顧客登録
│   │   ├── Screen2_Vehicle.jsx            車両登録
│   │   ├── Screen3_Category.jsx           作業内容選択
│   │   ├── Screen4_Estimate.jsx           見積エディタ (最も複雑)
│   │   ├── Screen5_Discount.jsx           値引き / クーポン
│   │   ├── Screen6_Notes.jsx              備考
│   │   └── Screen7_Review.jsx             確認
│   └── README.md
└── preview/                                デザインシステム参照カード群 (22 枚)
    ├── color-*.html                        カラーパレット
    ├── type-*.html                          タイポグラフィ
    ├── spacing-*.html                       余白・角丸・シャドウ
    ├── comp-*.html                          コンポーネント (ボタン・入力・カード等)
    └── brand-*.html                         ブランド (ロゴ・アイコン・必須ハイライト等)
```

---

## 🎯 v2.0 で実装された機能

### 見積ウィザード Screen 1〜7
- Screen 1: 顧客登録 (車検証OCR / 手入力 / 既存顧客検索の 3 択押しボタン)
- Screen 2: 車両登録 (ボディサイズ 7 ボタン・3M 推定→APU 確定)
- Screen 3: 作業内容選択 (7 カテゴリ複数選択)
- Screen 4: 見積エディタ (左サイド縦タブ + コーティング階層 3-3-2 + PPF 部分施工)
- Screen 5: 値引き / クーポン
- Screen 6: 備考・メモ
- Screen 7: 確認 + 通信 + モジュール遷移

### レイアウト
- サイドバー 280px + フルステッパー 7 ノード + 右 Sticky Total 200px
- Grid の 1fr 罠を `minmax(0, 1fr)` で解消 (ボタンオーバーラップ完全防止)
- 明細プレビュー: 4 列 grid + 項目 2 段組 (作業カテゴリ / 商品名) + 数量×単価縦積み + 小計 bold

### コーティング階層 (3-3-2 データ駆動)
- スタンダード: `Q² CANCOAT EVO / Q² ONE EVO / Q² PURE EVO`
- 高性能: `Q² MOHS EVO / Q² SYNCRO EVO / Q² MATTE EVO`
- INFINITE (最上位): `Q² INFINITE BASE TYPE 1 / TYPE 2`

### PPF 部分施工 (6 項目)
- ドアミラー / ドアカップ (位置選択) / Bピラー / Cピラー / ステップ (位置選択) / リアバンパー上部
- ドアカップ・ステップは前右/前左/後右/後左の位置選択サブグリッド展開

### 依頼書 Ver2.0 binding 遵守
- ✅ 7 スクリーン固定順序
- ✅ Screen 3 以降プルダウン全面禁止 (SelectButton で置換)
- ✅ 必須未入力 Amber ハイライト (入力完了で通常色復帰)
- ✅ committing 操作を増やさない
- ✅ ステッパー全ステップ 1 タップジャンプ
- ✅ 自動保存 (localStorage で mock)
- ✅ ボディサイズは自動確定しない (推奨→APU 最終決定)
- ✅ PPF フル/部分は Screen 4 内で分岐
- ✅ ダークモードのみ
- ✅ タップ 48×48px

---

## 🛠 技術スタック

- **HTML / CSS / JSX**: ビルドなしで動作 (Babel Standalone による on-the-fly transpile)
- **React 18.3.1**: UMD 版を CDN から読み込み
- **Lucide Icons**: CDN 経由 (`https://unpkg.com/lucide@latest`)
- **Google Fonts**: Geist + Noto Sans JP (CDN)
- **localStorage**: 見積状態の自動保存 (key: `dealeros-wizard-store-v1`)

### 実プロダクションへの移植

このリポジトリの UI キットは、既存の [nisikawa-officeAZ/GYEON](https://github.com/nisikawa-officeAZ/GYEON) リポジトリの
`src/components/estimates/EstimateWizard.tsx` (1503 行) と統合可能な設計です。

- 型定義は `src/types/estimate.ts` / `customer.ts` / `vehicle.ts` と互換
- 料金計算ロジックは `src/lib/pricing/pricing-engine.ts` を再利用可能
- カラートークンは `src/app/globals.css` の RC-10 と統合済み
- フォントは既に `next/font/google` で self-host 済み

---

## 📚 関連ドキュメント

- **[CHANGELOG.md](./CHANGELOG.md)** — バージョン変更履歴
- **[GenSpark_Request_EstimateWizard_Ver2.0.md](./GenSpark_Request_EstimateWizard_Ver2.0.md)** — UI 依頼書 (正本)

---

## 🚧 次期リリース予定

- **v2.1**: Smartphone UI (<768px) — 現在設計中
- **v2.2 以降**: 予約カレンダー・請求書・納品書等の後続画面 (依頼書対象外)

---

## 📞 サポート

質問・修正依頼はリポジトリの Issues へ。
