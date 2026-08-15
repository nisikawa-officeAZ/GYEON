# GenSpark 修正依頼 — Estimate Wizard 改訂 UI パッケージ

| 項目 | 値 |
|---|---|
| **Document** | GenSpark Correction Request — Estimate Wizard UI |
| **対象パッケージ** | 改訂版（`genspark-ui-latest/package/`・commit `d76b67f` で保全済み） |
| **正本仕様** | `../GenSpark_Request_EstimateWizard_Ver2.0.md` ＋ Architect デルタ **v2.1** |
| **Status** | 🟠 修正依頼（Architect 承認後に GenSpark へ送付） |
| **Date** | 2026-07-09 |

改訂版パッケージは概ね良好ですが、**実装前に以下3点の修正が必要**です。Window Film の段階フロー・スワイプ無効（Back/Next のみ）・プルダウン禁止（押しボタン）・ダークモードのみ・7ステップ構成は**現状維持**でお願いします。

---

## 修正1｜PPF 施工エリアモードを「5モード」に（必須）

**現状**：`Screen4_Estimate.jsx` の PPF は **`full`（フル施工）/ `partial`（部分施工）の2 scope のみ**。
- 該当：`package/ui_kits/estimate-wizard/screens/Screen4_Estimate.jsx` 付近 L282–283（`scope === 'full'` / `'partial'` の SelectButton）
- `サンルーフ` は部分施工パーツ扱い（`package/ui_kits/estimate-wizard/data.js` L164 `id:'sunroof'`）、`パノラマルーフ` は**パッケージ内に存在しません**。

**あるべき姿（v2.1）**：PPF 施工エリアを **独立した5モードの押しボタン**にする：
1. **フル施工**
2. **部分施工**
3. **フロントガラス**
4. **サンルーフ**
5. **パノラマルーフ**

**要件**：
- 5モードを Screen4 の PPF セクション先頭に押しボタンで提示（プルダウン不可・選択状態を明示）。
- フロー：**施工エリア選択 →（部分施工なら）部位選択 → PPF種類選択 → 店舗係数適用 → 見積明細**。
- 部分施工の部位リストは**店舗設定で拡張可能（動的）**な前提。
- バックエンド未対応のエリアは **disabled/グレーアウト**で表示可（要マーク）。価格の捏造はしない。
- **全デバイスキットに反映**：`estimate-wizard`（PC）/ `-mobile` / `-tablet-adaptive` / `-tablet-landscape` / `-tablet-portrait`、および `data.js`。
- 参考スクショ：`package/screenshots/01-ppf_v2_pc.png` / `01-final_pc_full_ppf.png` / `01-verify_ppf_partial.png`。

---

## 修正2｜OCR 入力ラベルを正確に統一（必須）

**現状**：`components.jsx` の OCR 3ボタンは独立実装済みだが**ラベルが仕様と不一致**。
- 該当：`package/ui_kits/estimate-wizard/components.jsx` L685–687
  - 現：「カメラで撮影」/「ファイル選択」/「PDF を選ぶ」

**あるべき姿（v2.1・完全一致）**：
1. **写真を撮影**
2. **写真から読み込み**
3. **PDF読み込み**

**要件**：
- 3ボタンのラベルを上記に**文言完全一致**で変更（機能・入力は現状維持：`capture=environment` / `image/*` / `application/pdf`）。
- 3方式は全デバイス（PC/タブレット/スマホ）で同一表示。
- OCR パイプライン／プロンプト／モデルは**変更しない**（ラベルのみ）。
- 参考スクショ：`package/screenshots/01-ocr_v22_pc.png`。

---

## 修正3｜`package/src` は参照専用（明記依頼）

- `package/src/`（`components/estimates/EstimateWizard.tsx` 等の TSX 雛形）は **UI 参照専用**です。
- **Claude が app ソースへ直接コピーする前提にしないでください。** 実装は DealerOS の承認済み構造（`src/components/estimates/wizard/`）で別途行います。
- 依頼：パッケージの README/CHANGELOG に「`src/` は reference-only（直接投入不可）」の注記を追加してください。

---

## 変更してはいけない（維持）
- 7ステップ構成・順序、プルダウン禁止（押しボタン）、**スワイプ無効（Back/Next のみ）**、ダークモードのみ、配色トークン、Window Film 段階フロー、必須項目 Amber。

## 納品
- 修正版パッケージ（現行と同じ統合ツリー形式）＋変更点の CHANGELOG。screenshots は任意。

> 本書は修正依頼のみ。実装コードの変更・投入は含みません。**Architect 承認後に GenSpark へ送付してください。**
