# GenSpark UI — Latest Package (index)

| 項目 | 値 |
|---|---|
| **Package** | GenSpark Revised UI Package（post‑v2.1 デルタ反映） |
| **Delivered** | 2026-07-09（ファイル日付 07-09-2026）※パッケージ内部マーカーに `v2.2` 表記あり |
| **Status** | 🔵 **UI Reference only**（実装は未着手） |
| **Canonical spec** | `../GenSpark_Request_EstimateWizard_Ver2.0.md` ＋ Architect デルタ v2.1 |
| **Previous version** | `../archive/genspark-ui-v2.0-before-revision/`（保全済み・削除していません） |
| **Source archive** | `./package_staging.zip`（受領物そのまま・provenance） |
| **Extracted tree** | `./package/`（138ファイル） |

## 含まれるファイル（概要）
- **UIキット `package/ui_kits/`**：`estimate-wizard`（PC）/ `-mobile` / `-tablet-adaptive` / `-tablet-landscape` / `-tablet-portrait`（各 Screen1〜7・shell・components・data.js・index.html）＋ `mobile-preview.html` / `tablet-preview.html`
- **参考ソース `package/src/`**（GenSpark 製の React/TSX 雛形）：`components/estimates/EstimateWizard.tsx` / `EstimateForm.tsx` / `EstimateSummary.tsx` / `components/customers/CustomerForm.tsx` / `Header.tsx` / `Sidebar.tsx` / `types/*` / `app/globals.css`
- **ドキュメント**：`README.md`(パッケージ付属) / `README_FOR_CLAUDE.md` / `DESIGN_GUIDE.md` / `SKILL.md` / `CHANGELOG.md`
- **トークン/資産**：`colors_and_type.css`（ダークトークン）/ `assets/` / `public/` / `preview/`（コンポーネント/カラー/タイポ プレビュー）
- **スクリーンショット `package/screenshots/`**：PPF v2・Window v2・OCR v22・PC full/partial・tablet 各向き・mobile 等
- （梱包由来の副次ファイル：`thumbnail.png` / `v13_fold.png` / `v13_full.png`）

## 旧版（v2.0）との差分
共通して **`data.js` と `Screen4_Estimate.jsx` が全デバイスキットで変更**（Window/PPF の段階フロー・エリア拡張）。PC キットは加えて **`Screen1_Customer.jsx`（OCR）と `components.jsx`** も変更。他画面（Screen2/3/5/6/7・shell）はほぼ同一。

- **追加（新規）**：`src/`（実TSX雛形一式）、`DESIGN_GUIDE.md`、`SKILL.md`、`README_FOR_CLAUDE.md`、`.gitattributes`、`public/`、多数の `screenshots/`（v2 検証画像）。
- **構成変更**：旧版は「pc-ui.zip / tablet-ui.zip / mobile-ui.zip」の3分割zip → 新版は**統合展開ツリー**（全キット＋src＋資料を1パッケージ）。
- **主なUI変更**：
  - **Window Film**：施工部位選択 → フィルム種類 → 店舗価格（`data.js` にエリア別価格 std/high/ultra、フロントガラス/三角窓/サンルーフ 等を追加）。
  - **PPF**：Screen4 内で **フル施工 / 部分施工** の scope 選択。`data.js` に PPF部位（サンルーフ等）追加。内部コメントに「v2.2：フル・部分を並行選択可（加算）」。
  - **OCR**：camera 入力（`capture="environment"`）＋「カメラで撮影」ボタン＋ファイル入力（画像/PDF）。
  - **スワイプ・ナビは無し（Back/Next のみ）** を維持。

## 承認仕様との整合・要確認点
- ✅ スワイプ無効（Back/Next のみ）維持。
- ✅ プルダウン不使用（押しボタン）維持。
- ⚠️ **PPFエリアモード**：v2.1 は「フル/部分/フロントガラス/サンルーフ/パノラマの5モード」。本パッケージは Screen4 で **full/partial の scope 選択＋部位**を採用（内部 v2.2 で並行選択可）。フロントガラス/サンルーフ/パノラマが**独立モードか部位扱いか**を実装前に仕様と突き合わせる必要あり。
- ⚠️ **OCR 3方式**：v2.1 は「写真を撮影 / 写真から読み込み / PDF読み込み」の明示3択。本パッケージは「カメラで撮影＋画像・PDFアップロード」構成。**明示3択への一致**を実装時に確認。
- ⚠️ **`package/src/` の雛形**：GenSpark 製の参考実装であり、**そのまま app へ投入しない**（Claude の実装は `src/components/estimates/wizard/` 側。統合は Phase 2・Architect 承認後）。

## 確認事項
- **これは UI 参照専用**です。
- **実装は開始していません**（コード・EstimateEditor・app・DB・migration いずれも未変更）。
