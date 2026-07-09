# Estimate Wizard — Ver2.2 GenSpark Handoff（公式受け渡し場所）

| 項目 | 値 |
|---|---|
| **役割** | Estimate Wizard **Ver2.2** の GenSpark 公式ハンドオフ場所 |
| **Status** | 🟠 準備中 — **Ver2.2 仕様ファイル未配置**（Architect 提供待ち） |
| **Date** | 2026-07-09 |

## このフォルダについて
- 本フォルダは **Estimate Wizard Ver2.2** の **GenSpark 公式ハンドオフ場所**です。
- **GenSpark は、本フォルダ内のファイルのみを最新の UI/仕様リファレンスとして使用**してください。
- **旧 Ver2.0 / Ver2.1 のファイルは参照専用（reference only）**です（下記「旧ファイルの所在」）。最新の正は常に本フォルダの Ver2.2 とします。
- **Claude は、GenSpark 成果物を Architect が承認するまで実装しません。**

## 収録予定 / 現状
- `Estimate_Wizard_Ver2.2_Spec.md`（**未配置**）— 最新 Ver2.2 仕様。**Architect による提供が必要**です（本タスク時点でローカルに Ver2.2 仕様ファイルは存在しません）。
- （提供後）GenSpark 向け補足資料・修正依頼（Ver2.2版）を随時追加。

> **注記**：Ver2.2 の仕様本文はチャットにインラインで提示済みですが、**正本ファイルは未配置**です。転記差異を避けるため、正本は Architect 提供、またはご承認のうえ当方がインラインテキストから `Estimate_Wizard_Ver2.2_Spec.md` として保存します。

## 旧ファイルの所在（参照専用・削除しない）
**Ver2.0（archive）**
- 仕様: `../archive/ver2.0/specification/GenSpark_Request_EstimateWizard_Ver2.0.md`（旧 Canonical）
- 依頼: `../archive/ver2.0/requests/GENSPARK_UI_DESIGN_REQUEST.md`、`../archive/ver2.0/requests/GenSpark_Request.md`、`../archive/ver2.0/requests/CURRENT_UI_REFERENCE_INVENTORY.md`
- UIパッケージ: `../archive/ver2.0/genspark-ui/`

**Ver2.1（archive）**
- 依頼: `../archive/ver2.1/requests/CORRECTION_REQUEST.md`
- UIパッケージ: `../archive/ver2.1/genspark-ui/`（改訂版・`package/` ＋ `package_staging.zip`）
- 仕様: なし（Ver2.1 はインラインデルタ提示のため独立仕様ファイルなし）

**その他**
- `../../estimate-wizard-ui-spec.json`（Architect 原案・不変・フォルダ外）
- 受入基準: `../acceptance/EstimateWizard_Acceptance_Checklist.md`

## Ver2.2 の主な変更（インライン提示分の要点・正本提供後に本フォルダで確定）
- スワイプ廃止／Back・Next のみ、Screen3 以降プルダウン禁止（押しボタン）。
- Window Film：施工部位選択フロー。
- PPF：**Sunroof / Windshield / Interior（室内PPF施工）** ケース追加（※パノラマルーフは Ver2.2 で不在＝Ver2.1 の依頼から取り下げ予定）。
- 洗車 / メンテ / ルーム：店舗設定でメニュー名＋金額＋**想定必要時間（分）**（カレンダー用）。
- 新ショップランク（GYEON PPFインストーラー 等）によるボタン活性制御。
- ボディサイズ 3M は**推奨のみ・APU が最終決定**。

## 制約
- 本ハンドオフは UI/仕様リファレンスのみ。**実装は Architect 承認後**。
- 旧仕様ファイルの削除・上書きは行いません。
