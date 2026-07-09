# GenSpark UI Deliverables — Estimate Wizard Ver2.0

GenSpark が制作した見積ウィザードの **UI 成果物（Zip）** を受け入れる専用フォルダです。

## 配置ルール

| デバイス | 配置先 | 想定ファイル名（例） |
|---|---|---|
| **PC（Desktop ≥1024px）** | `pc/` | `estimate-wizard-pc-ver2.0.zip` |
| **タブレット（768–1023px）** | `tablet/` | `estimate-wizard-tablet-ver2.0.zip` |
| （将来）スマートフォン（<768px） | `smartphone/`（必要時に作成） | `estimate-wizard-smartphone-ver2.0.zip` |

- オペレーターが上記サブフォルダに Zip を配置し、Git へプッシュします。
- 各 Zip は自己完結型 HTML（インライン CSS）＋スクリーンショットを想定（正本仕様の Deliverables に準拠）。

## 準拠すべき正本仕様（Canonical）

- `../GenSpark_Request_EstimateWizard_Ver2.0.md`（**Canonical UI Specification**）
- 参照：`../CURRENT_UI_REFERENCE_INVENTORY.md`（現行UIラベル・入力順の参照）

## 注意

- **Zip の中身は未検証**（受領後に、正本仕様との整合＝機能欠落ゼロ・文言/順序一致・ダークトークン・プルダウン禁止・スワイプ等をレビューします）。
- 受領後の実装（React化・EstimateEditor 統合）は **Architect 承認後**に開始します。
