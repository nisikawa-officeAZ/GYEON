# Estimate Wizard — UI Kit

**DealerOS 見積ウィザード Ver2.0 の高忠実 UI キット**

## 概要

7 スクリーンの押しボタン式ウィザード UI を **単一の `index.html`** で
click-thru できるようにしたプロトタイプです。データは同梱の Mock（`data.js`）
で駆動され、実際のバックエンドとは接続されていません。**見た目・UX の検証専用**。

- ステッパー・サイドバー・Sticky Total Panel は共通 Shell。
- Screen 1〜7 はそれぞれ `screens/ScreenN_*.jsx` に切り分け。
- 状態管理は最小限（`useState` のみ）。ロジックは cosmetic レイヤ。

## ファイル構成

```
ui_kits/estimate-wizard/
├── README.md              ← このファイル
├── index.html             ← エントリ。ブラウザで開くだけで動く
├── shell.jsx              ← サイドバー・ヘッダー・ステッパー・Sticky Total
├── components.jsx         ← Button / Field / SelectButton / Amber ハイライト等
├── data.js                ← カテゴリ・コーティング階層・PPF 種別 等の mock
├── screens/
│   ├── Screen1_Customer.jsx     ← 顧客登録
│   ├── Screen2_Vehicle.jsx      ← 車両登録
│   ├── Screen3_Category.jsx     ← 作業内容選択
│   ├── Screen4_Estimate.jsx     ← 見積エディタ（コーティング・PPF 等）
│   ├── Screen5_Discount.jsx     ← 値引き / クーポン
│   ├── Screen6_Notes.jsx        ← 備考 / メモ
│   └── Screen7_Review.jsx       ← 確認・通信・PDF・予約カレンダー等
└── (overlays are inline in components.jsx: OCR / QR / SearchModal)
```

## 動作確認

`index.html` をブラウザで開く。ステッパーの任意ノードをクリックすれば **1 タッ
プジャンプ**（Ver2.0 §10 binding）。フッターの「次へ / 戻る」でも移動可。
`localStorage` に現在のスクリーン番号が保存されるので、リロードしても同じ画面
に戻ります。

## 開発上のルール

- **プルダウン禁止**（Screen3 以降）。選択は必ず `<SelectButton>` で。
- **committing 操作を増やさない**。確認ダイアログを追加しない（`<AmberField>`
  の "必須未入力ハイライト" と "元に戻すトースト" で対応）。
- **muscle memory**: ラベル・順序を Ver2.0 §5 通りに厳守。
- **タップ 48×48px**（`--ds-tap-min`）を各ボタンで満たす。

## 状態管理

グローバル `WizardStore` オブジェクト（`shell.jsx` 内）で 7 画面を横断する見積
データを保持します。フィールド更新のたびに自動保存（mock: `localStorage`）。
`clean = true / dirty = false` の遷移で Sticky Total を再計算します。

## 実プロダクションへの移植

- ロジックは `nisikawa-officeAZ/GYEON` の `src/lib/pricing/*` を再利用可能。
- 型は `src/types/estimate.ts`, `customer.ts`, `vehicle.ts` と互換に設計。
- Amber ハイライトは `data-required` 属性と `.ds-required-empty` クラスで実現し
  ているため、React に移す際は `validationState` prop に置換可能。
