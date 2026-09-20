# 見積正本一本化・編集設計監査

監査基準: `origin/main` 相当 `1da01c4eded273dc44ef399de417e00075700e7b`

## 結論

Ver2.2 見積ウィザードを唯一の本番見積 UI とする。旧 `EstimateEditor` と旧サンプル PDF は削除し、実行経路もソース検査で禁止する。

既存見積の「編集」は、既存行を直接上書きする方式では実装しない。正本ウィザードの保存済み見積は DB で不変に保護されており、旧見積の平坦な明細から元の施工選択を完全復元することもできないためである。安全な完成形は、元見積を保持したまま正本ウィザードで新版を発行する「改訂」方式とする。

## 今回完了した切替

- `/estimates/new` は Ver2.2 正本ウィザードだけを表示する。
- `/estimates/[id]/edit` は旧編集 UI を表示しない。正本 snapshot がある見積はその draft を正確に復元して新版を発行し、snapshot のない旧見積だけは推測復元を止めて顧客・車両を引き継ぐ新規作成へ案内する。
- ウィザードの読み取りプレビューは `WizardPreviewPanel` を直接表示し、旧編集 UI を経由しない。
- `/pdf` は保存済み見積の正規 PDF レンダラーだけを使用する。未使用の旧サンプル PDF UI を削除した。
- 旧 `EstimateEditor` 本体と専用 helper/test を削除した。
- ソース検査で、本番 route が旧編集 UI を import した場合に失敗するよう固定した。
- `npm run build` の `prebuild` に正本検査を接続した。担当者がこの文書を読み忘れても、旧 editor・旧 PDF mock・誤った route を戻す変更は本番ビルド前に失敗する。

## 監査で確認した旧契約上の不足（今回解消）

1. `WizardSaveIntent` は `draft / expectedConfigRevision / idempotencyKey` の新規作成契約で、改訂対象 ID を持たない。
2. `save_estimate_from_wizard` は新規作成と同一キー再送だけを扱い、保存済み見積の更新を扱わない。
3. DB は wizard 見積の金額・明細・メモ更新を `WIZARD_ESTIMATE_IMMUTABLE` で拒否する。
4. 現行 `getEstimate` は復元に必要な wizard line identity、pricing metadata、configuration revision を取得していない。
5. 既存 hydration adapter は平坦な旧明細を施工選択へ推測変換せず、意図的に保存を拒否する。
6. 本番ウィザードは初期 canonical draft を外部から受け取る契約を持たない。

## 実装済みの新版発行契約

### E1: 正確な読み取り（実装済み）

- wizard 由来か legacy 由来かをサーバーで判定する。
- wizard 由来の見積だけ、保存済み identity/metadata を選択して Ver2.2 draft へ完全逆変換する。
- legacy 見積は推測復元せず、顧客・車両を引き継ぐ「新版作成」のみ許可する。

### E2: 改訂保存 RPC（実装済み）

- `issue_estimate_revision_from_wizard` を新設し、元見積は不変のまま新しい見積行を原子的に作成する。
- `estimate_revisions` に元見積、新版、改訂番号、元 snapshot fingerprint を保存し、設定 revision と idempotency key は新版見積へ保存する。
- 認証、tenant、権限、サーバー価格再計算、楽観的競合検出を新規保存と同じかそれ以上にする。
- 二重送信は同じ新版を返し、元見積が途中で変化した場合は競合として停止する。

### E3: 正本 UI へ接続（実装済み）

- `ProductionEstimateWizard` に、サーバーが検証済みの initial draft と改訂 binding を渡す。
- 画面名は「見積編集」ではなく、実態に合わせて「見積を修正して新版を作成」とする。
- 保存後は新版の詳細/PDFへ移動し、元見積との関係を双方に表示する。

### E4: 受入条件（ソース検査・自動テスト済み、本番UATは所有者実施）

- Detailer に Certified 専用商品が一件も表示されない。
- legacy 見積から施工内容を推測しない。
- 元見積、発行済み PDF、請求書、施工指示は変更されない。
- 同一操作の再送で新版が重複しない。
- PC / tablet / mobile の正本 UI が同一 state model を使う。
- 旧 UI 名、旧 PDF モック、旧 editor import が production source に存在しない。

## 禁止事項

- 旧 `updateEstimate` を wizard 見積に再接続しない。
- create action に estimate ID を足して update のように見せない。
- ラベル、金額、並び順から商品 identity を推測しない。
- legacy UI を fallback、preview、feature flag、エラー時の代替として残さない。
- 元見積を削除・上書きして新版に見せない。
