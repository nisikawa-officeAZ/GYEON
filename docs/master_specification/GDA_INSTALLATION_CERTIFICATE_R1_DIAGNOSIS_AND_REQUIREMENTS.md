# GDA Installation Certificate R1 — 現状診断・実装要件

| Field | Value |
|---|---|
| Phase | `GDA_INSTALLATION_CERTIFICATE_R1_A2` |
| Marker | `GDA_INSTALLATION_CERTIFICATE_R1_A2_OWNER_SCOPE_FINAL_V1` |
| Status | **OWNER_SCOPE_FINAL — READY_FOR_R1_B1_CONTRACT** |
| Date | 2026-09-16 |
| Owner | Office AZ / Product Owner |
| Responsible agent | MacBook Codex |
| Repository | `nisikawa-officeAZ/GYEON` |
| Audited commit | `bf15b1ff571b7ea91f6b8ab63b6789ace667f0e0` |
| Audited tree | `0bb00e6c9ce1fffb2d67192e0dc5e3ec9d1767e4` |

## 0. Authority boundary

This phase is a source-only, read-only diagnosis plus a requirements draft. It does not authorize application source edits, tests, migrations, Supabase/Storage changes, production access, certificate issuance, commit, push, PR mutation, Ready conversion, merge, or deployment.

The current governance write allowlist is exactly:

```text
docs/master_specification/GDA_INSTALLATION_CERTIFICATE_R1_DIAGNOSIS_AND_REQUIREMENTS.md
docs/master_specification/CLAUDE_DIRECTIVE_GDA_INSTALLATION_CERTIFICATE_R1_READ_ONLY_DIAGNOSIS.md
```

The following protected paths remain hash-only and must not be opened, diffed, copied, staged, or modified:

```text
src/components/estimates/wizard/screens/ScreensPreview.tsx
supabase/migrations/20260801110110_line_link_tokens.sql
supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql
src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts
```

## 1. 結論

施工証明書はゼロから作る状態ではない。React PDFの見た目と入力データ型は既に存在する。ただし、現在の実装はサンプルデータを描画する**テンプレート層だけ**であり、利用者が発行できる製品機能には接続されていない。

現時点で本番発行へ流用してよい完成部分は次の2点である。

1. `CertificateDocument`を入口とするコーティング・PPF・CanCoatのPDFレイアウト。
2. 完了済み作業、顧客、車両、確認済み施工内容を同一店舗の認証コンテキストで取得する既存の完了報告基盤。

一方、保証文言を含む現在のテンプレートをそのまま本番発行することはできない。未確定の保証条件と、CanCoatに関する相互矛盾があるためである。

最短で安全に運用開始する推奨案は、**R1を「施工事実を証明する施工証明書」に限定し、保証書・購入連動発行枠・保証規約をR2へ分離すること**である。

## 2. 現在すでに存在するもの

### 2.1 PDFテンプレート

次の3種と、両面印刷用のメンテナンス履歴ページが存在する。

- coating certificate
- PPF certificate
- CanCoat certificate
- maintenance history back page

共通の型は顧客、車両、施工日、担当技術者、施工製品、規約、店舗ブランド、証明書番号を受け取れる。テンプレート自身はDBを読まず、外部のadapterから解決済みデータを受け取る設計になっている。

### 2.2 完了済み作業の正本

既存のGDA-1W完了権限基盤には、次の正本がある。

- `work_orders`: 顧客、車両、完了日時、担当者、見積との結合
- `completion_reports`: 1作業につき1つの正式な完了報告
- `completion_report_items`: 作業者が確認した金額を含まない施工内容スナップショット

`getWorkReportSource()`は実ログインのリクエストスコープで店舗を再解決し、同一店舗の正式な完了報告、顧客、車両、確認済み施工内容だけを取得する。施工証明書のデータ取得は、この認可・正本境界を再利用するのが安全である。

### 2.3 帳票発行の参考実装

作業内容書には、認証済みPDF route、正本データadapter、PDFレンダリング、画面からの表示・保存導線が存在する。施工証明書はこの構造を参考にできるが、作業内容書と同じ帳票として扱ってはならない。

## 3. 存在しないもの

次は未実装である。

- certificate用の認証済みrouteまたはServer Action
- 完了作業から`CertificateDocumentData`を作るadapter
- 発行可能判定
- 発行画面、プレビュー、確定確認、履歴画面
- サーバー採番
- 発行レコードと改訂履歴
- 発行時スナップショット
- private StorageへのPDF保存とSHA-256
- 同じ内容の再印刷と、新規発行・訂正の区別
- 重複発行防止と冪等性
- QR公開照合
- 商品/SKUと施工内容の厳密な対応
- 店舗ランク・ロゴ・規約版のサーバー解決
- certificate専用の自動テスト、認可テスト、並行実行テスト

したがって、テンプレートがあることを「施工証明書機能が完成している」と判定してはならない。

## 4. 発見した重大な矛盾

### 4.1 CanCoat

`GYEON_CERTIFICATE_ISSUANCE_CONTROL_SPEC.md`は、CanCoatを専用保証書として扱い、「保証書ではない」という文言を採用しないと定めている。

一方、現在のCanCoatテンプレートとfixtureは「保証書ではない施工証明書」と明記している。両方を同時に正とすることはできない。

OwnerはR1-A2で、CanCoat施工をR1の共通・非保証施工証明書の対象に含め、CanCoat専用保証書だけをR2へ分離すると決定した。したがってR1では、確認済み施工内容にCanCoatが含まれていても共通施工証明書を発行できる。ただし、現行のCanCoat専用テンプレート、保証文言、保証期間、保証条件、発行枠は使用しない。

### 4.2 施工証明書と保証書

Ownerが次フェーズとして指定したのは施工証明書である。しかし既存のcoating/PPFテンプレートには保証文言が含まれ、既存の発行管理仕様は購入量に連動する保証書発行枠まで含む。

施工事実の証明と、法的・商業的な保証付与は別の責任である。同一フェーズにすると、SKUルール、購入連動、保証期間、失効、枠返還、公開照合まで必要になり、見積運用後の早期リリースを大きく遅らせる。

### 4.3 未確定事項

既存仕様のTBD-01〜08（SKU別付与枚数、保証期間、CanCoat規約、店舗ランク、公式資産、公開マスク、返還基準、PPFルール）は未確定のままである。これらは保証書の本番発行を妨げるが、保証を付けない純粋な施工証明書R1まで妨げる必要はない。

## 5. R1の推奨スコープ

### 5.1 含める

- 完了済み作業から発行する施工証明書
- 顧客、車両、施工日、店舗情報、担当者、施工内容の自動入力
- 発行前プレビューと明示的な確定操作
- サーバー採番
- 発行時点の内容を変更不能なスナップショットとして保存
- PDFをprivate Storageへ保存
- 発行済みPDFの再表示・再保存・再印刷
- 同一作業、同一帳票種別の重複発行防止
- 店舗分離、認証、監査ログ
- 店舗ロゴ未設定時はDA標準ロゴ、設定済みなら店舗ロゴを使用
- A4表示と印刷の視覚確認
- CanCoat施工を含む確認済み施工内容への、共通・非保証施工証明書の発行

### 5.2 R1から除外する

- Infinity Warranty等の保証付与
- 購入数量に連動する発行枠
- 商品別保証期間・保証規約
- 枠返還、失効承認、購入grant
- PPFメーカー保証の確定文言
- CanCoat専用保証書、保証期間、保証条件、商品別保証文言の確定
- QRによる一般公開照合
- スーパーアドミンの保証枠管理UI

これらは`GYEON_CERTIFICATE_ISSUANCE_CONTROL_SPEC.md`に基づくR2保証書フェーズとして実装する。

## 6. R1の正本データ契約

| 表示項目 | 正本 | ルール |
|---|---|---|
| 店舗 | request-scope dealer / Brand Profile | クライアントのdealer_idやlogo URLを信用しない |
| 顧客 | completed work orderに結合したcustomer | 手入力し直さない |
| 車両 | completed work orderに結合したvehicle | 手入力し直さない |
| 施工日 | `work_orders.actual_end_at`の日本時間日付 | クライアント入力を正本にしない |
| 担当者 | work orderの担当者と有効な店舗メンバー | 不明なら確定前に選択させ、発行snapshotへ固定 |
| 施工内容 | `completion_report_items` | 見積明細を直接使わない |
| 見積 | work orderとの結合確認・完了時prefillだけ | 見積は提案であり施工事実ではない |
| 発行番号 | サーバー採番 | 店舗側で編集不可、欠番再利用不可 |
| 発行内容 | certificate issuance snapshot | 後日の顧客・車両・店舗変更で過去PDFを変えない |

### 6.1 再入力禁止

既存データが空でない限り、利用者へ同じ顧客名、車両、施工日、施工内容を再入力させない。訂正が必要な場合は、証明書画面の一時上書きではなく、正本または正式な訂正フローへ戻す。

### 6.2 発行入口

発行入口は見積作成中ではなく、作業完了後の正式な完了報告または完了済み作業の詳細画面に置く。保存済み見積は作業へ接続されるが、発行可否は完了済み作業と確認済み施工内容で判断する。

## 7. R1の最低受入基準

1. 未ログインは発行できない。
2. 店舗Aは店舗Bの作業、顧客、車両、PDFを参照・発行できない。
3. 未完了作業、未確認施工内容、空の施工内容では発行できない。
4. 顧客、車両、施工日、施工内容は正本から自動入力される。
5. 見積変更後も、既に確認した施工内容は勝手に変わらない。
6. 同じ確定操作の再送で二重発行されない。
7. 再印刷では新番号を発行しない。
8. 発行済みPDFは後日のマスター・店舗情報変更で変わらない。
9. DB snapshot、保存PDF、SHA-256が一致する。
10. PDFに価格、原価、粗利、社内メモを含めない。
11. 1件・複数施工項目のA4 PDFを目視確認する。
12. 未確定の保証文言を表示しない。
13. CanCoat施工を含む場合も共通・非保証施工証明書として発行し、現行CanCoat専用テンプレートや保証文言を使用しない。

## 8. 実装フェーズ案

| Phase | 内容 | Mutation |
|---|---|---|
| R1-A1 | 現状診断とR1/R2境界（完了） | docs only |
| R1-A2 | Ownerが「施工証明書のみ先行」とCanCoatのR1対象化を確定（完了） | docs only |
| R1-B1 | eligibility、source projection、adapterの純粋契約とテスト | source/tests only |
| R1-B2 | issuance snapshot、採番、冪等性、RLS、private document metadata | migration/source/tests only |
| R1-C1 | 保証文言を含まないR1 PDF、認証route、private Storage保存 | source/tests only |
| R1-D1 | 完了済み作業からのプレビュー・発行・履歴・再印刷UI | source/tests only |
| R1-V1 | disposable DBで認可・並行発行・改ざん耐性・PDF検証 | disposable only |
| R1-RELEASE | Dev、本番を別承認で段階適用 | separately authorized |
| R2 | 保証書、商品ルール、購入連動発行枠、規約、失効、QR照合 | separate phase |

## 9. Owner決定

2026-09-16、Ownerは次を明示承認した。

```text
R1は保証を付けない施工証明書だけを先行する。
保証書、購入連動発行枠、保証規約、失効、QR公開照合はR2へ分離する。
CanCoat施工はR1の共通・非保証施工証明書の対象に含める。
CanCoat専用保証書、保証期間、保証条件、商品別保証文言はR2へ分離する。
```

この決定により、既存のInfinity Warranty、PPFメーカー保証、CanCoat保証に関する未確定文言をR1へ表示してはならない。R1の証明対象は施工事実だけである。CanCoat施工を証明する場合も、現行CanCoat専用テンプレートではなく、他の施工内容と同じ共通・非保証施工証明書に確認済み施工項目として記載する。

## 10. Next gate

R1-B1で、共通・非保証施工証明書のeligibility、正本projection、adapter契約、表示禁止項目、テストallowlistを確定する。R1-B1の別承認まではアプリケーションソースを変更しない。

## 11. Claude診断実行記録

2026-09-16、Ownerの明示承認に基づき、顧客データ、本番DB、認証情報、保護対象ファイルを除外してAnthropic Claudeへ読み取り専用診断を依頼した。

| Attempt | Model / effort | Budget | Scope | Result |
|---|---|---:|---|---|
| 1 | Fable / high | USD 0.50 | full bounded diagnosis directive | `Exceeded USD budget`、診断結果なし |
| 2 | Fable / low | USD 0.50 | template、control spec、canonical completion loader、bounded reference searchだけ | `Exceeded USD budget`、診断結果なし |
| 3 | Haiku 4.5 / low | USD 0.30 | Attempt 2と同じ最小範囲 | `Exceeded USD budget`、診断結果なし |
| 4 | Haiku 4.5 / low | USD 0.50上限（実費USD 0.310305） | low-budget bounded read-only diagnosis | `PASS_READ_ONLY_DIAGNOSIS`、実装変更なし |

Attempt 1〜3の未完成応答は受理していない。Attempt 4では、テンプレート層だけが存在し、認証route、adapter、採番、snapshot、private Storage、冪等性、発行UIが未実装であること、完了報告基盤を再利用できること、CanCoat文言が矛盾することを確認した。

Claudeは「OwnerがCanCoat施工をR1から完全除外した」と解釈したが、当時のOwner決定はCanCoat保証をR2へ分離することまでしか定めていなかったため、その解釈は受理しなかった。2026-09-16、Ownerは追加決定として、CanCoat施工をR1の共通・非保証施工証明書の対象に含めることを明示承認した。MacBook CodexはこのOwner補正を適用したうえで、Attempt 4のその他の診断結果を受理する。

R1-A1/A2の診断・対象確定は完了した。実装は未認可であり、次の独立ゲートはR1-B1契約とallowlistの承認である。
