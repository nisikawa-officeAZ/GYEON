# GYEON取扱店向け商品発注 V3 — C5-D正式migration昇格計画

## 1. 文書情報

- 計画ID: `GYEON_ORDER_V3_C5_D_FORMAL_MIGRATION_PROMOTION_PLAN_V1`
- 状態: `GOVERNANCE_CANDIDATE_UNCOMMITTED`
- 基準main commit: `96a66c3fb5969718418da1ef4c75fe62407b48aa`
- 基準main tree: `d8d6d3bdd5d809714896fe006d73910e175f130d`
- C5-C結果: `C5C_DISPOSABLE_DB_PASS`
- DRAFT SQL: `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- DRAFT SQL SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- C5-C runtime派生SQL SHA-256: `93d69dbdcf20910ab81ea9a809dacd250156fd0a5ef728f48db4a793f539cf67`
- C5-C派生規則: terminal `rollback;` 1個だけを `commit;` へ置換
- 作成日: 2026-08-29

この文書はmigration作成・DB適用・provider接続・Git deliveryの権限ではない。C5-Dの実装、検証、commit、push、PR、共有環境適用、provider接続はすべて別ゲートで明示承認を要する。

## 2. 結論

C5-Dは次の順序でのみ進める。

1. 正式migration source候補を作る。
2. 正式ファイルそのものを新しい使い捨てDBで検証する。
3. Codexが証拠を独立受理する。
4. その後にだけ共有環境のpreflightを検討する。

C5-C合格runtimeは強いE2証拠だが、正式timestamp migration、Supabase CLIの正式適用経路、既存注文行を保持したupgrade pathをまだ証明していない。したがって、C5-C合格だけで共有・staging・productionへ適用してはならない。

## 3. 正本と派生関係

### 3.1 DRAFT原本

DRAFTはC5-B/C5-Cのsource provenanceとして残し、削除・移動・実行しない。末尾`rollback;`を維持する。正式昇格後も、C5-Cが何を検証したかを追跡するための不変原本とする。

### 3.2 正式migration候補

正式migrationは、実装時のcurrent mainから次のCLIで新規作成する。

```text
supabase migration new gyeon_order_v3_contract
```

CLIが生成した未使用14桁timestampを使用し、ファイル名を手作業で発明しない。既存migrationを編集、改名、削除してはならない。

### 3.3 許容される内容差分

正式migrationとDRAFTの差分は次だけに限定する。

1. 先頭のsource-only／DRAFT警告コメントを、C5-D正式migration候補と分かるコメントへ置換する。
2. 末尾の誤実行防止コメントを、forward-onlyと別適用ゲートを示すコメントへ置換する。
3. 最終SQL文の`rollback;`を`commit;`へ1回だけ置換する。

テーブル、列、制約、index、policy、grant、revoke、function、RPC署名、function body、lock順序、error code、文字列、空白を含む実行SQLの変更は禁止する。

## 4. 機械検証契約

正式migration候補は次をすべて満たさなければならない。

1. DRAFT hashが`d04517f4...e73`と完全一致する。
2. DRAFTにterminal `rollback;`がちょうど1個ある。
3. 正式migrationにterminal `commit;`がちょうど1個あり、terminal `rollback;`がない。
4. 許可したコメント行とterminal guard以外のdiffが0である。
5. full-line SQL commentだけを双方から除き、DRAFT側のterminal guardを`commit;`へ置換した実行SQLが、正式migrationの実行SQLとbyte-for-byte一致する。
6. 正式migrationのSHA-256、byte数、line数、生成timestampを結果へ記録する。
7. 正式migrationは`supabase/migrations/`直下に1ファイルだけ存在し、同名候補が複数ない。

コメント除去は、先頭空白の後が`--`で始まるfull-line commentだけを対象にする。文字列、dollar-quoted function body、inline内容を壊す正規化は禁止する。

## 5. Source候補の将来write allowlist

C5-D source実装で変更できるのは次の4パスだけとする。

1. `supabase/migrations/<CLI_GENERATED_TIMESTAMP>_gyeon_order_v3_contract.sql`（new）
2. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`
3. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
4. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

`README.md`はDRAFTを実行可能化せず、DRAFTが不変provenanceであること、正式migrationのpath/hash、適用は別承認であることだけを記録する。

既存migration、C5-C harness、UI、provider adapter、Office AZ在庫実装、環境設定、dependency、lockfileは変更禁止とする。

## 6. Source候補の静的受入

source候補ではDBを起動しない。最低限、次を実行する。

- DRAFT／正式migrationの許容差分検査
- migration契約test
- RPC契約test
- `git diff --check`
- exact four-path allowlist確認
- protected pathのpathname／mode／blob／Git state確認
- secret／provider実装／外部HTTP追加のzero-match確認

静的合格は正式migration適用の承認ではない。結果は`C5D_FORMAL_MIGRATION_SOURCE_CANDIDATE_PASS`または`CHANGES_REQUIRED_SOURCE`とする。

## 7. 正式migration専用の使い捨て検証

source候補合格後、別承認で新しいC5-D runtimeを作る。C5-Cの成功suffix・失敗suffix・evidenceを再利用しない。

### 7.1 必須経路A — fresh replay

- 正式migrationを含むformal migration chainを先頭から再生する。
- DRAFT runtime derivativeを生成・適用しない。
- protected LINE migrationは別LINE権限がない限り従来どおり明示除外する。
- 正式migrationの実際のpath/hashをmanifestへ記録する。

### 7.2 必須経路B — populated upgrade

正式migration直前までのbaseline migrationを適用し、代表的な既存`product_orders`／`product_order_items`行を作ってから正式migrationを適用する。

最低限、既存status `draft`、`submitted`、`approved`、`cancelled`、正のquantity、NULL可能な旧列、複数dealerの行を保持する。適用後、行数、主キー、金額、status、dealer_id、既存timestampが意図せず変化していないことを証明する。

### 7.3 必須経路C — Supabase CLI native path

実装時に`supabase --help`と対象subcommandの`--help`でCLI `2.116.0`以降の正確な手順を確認し、将来の共有環境で使うものと同じmigration runner経路を使う。C5-Cの`psql -f`直接適用だけを正式migration証拠として再利用してはならない。

### 7.4 再実行する証拠

- pgTAP schema／constraint／RLS／grant／RPC署名
- real local Auth/PostgREST request scope
- genuine separate-connection concurrency
- DB advisor error-level zero
- bounded query plans
- fixture zero、secret scan、manifest hash、runtime removal

C5-Cの186/186、35/35、11/11はpredecessor証拠として保持するが、正式migration候補の合格を代替しない。

## 8. fail／burn／停止規則

使い捨て検証でreplay、legacy-data upgrade、CLI runner、pgTAP、real Auth、concurrency、cleanupのいずれかが失敗した場合、そのsuffixとevidence setをburnする。同じsuffixを修理・再実行してPASSへ変えてはならない。

- 正式SQL／testの欠陥: `CHANGES_REQUIRED_SOURCE`
- harness／環境の欠陥: `CHANGES_REQUIRED_HARNESS_OR_ENVIRONMENT`
- baseline migrationの既知外失敗: `BASELINE_BLOCKED`
- protected scope逸脱: `BLOCKED_SCOPE`

## 9. rollbackと復旧

### 適用前

候補commit／PRを破棄またはrevertする。DB状態は存在しない。

### 適用後

既存の正式migrationを編集、削除、改名、履歴書換えしてはならない。復旧は新しいforward-only補正migrationで行う。データ削除、table drop、権限緩和、自動down migrationは別owner決定なしに禁止する。

## 10. protected scope

次はmetadata-onlyであり、内容を開く、読む、diff、copy、stage、modifyしてはならない。

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## 11. C5-D終了条件

C5-Dは次をすべて満たした時だけ完了する。

1. 正式migration source候補がexact allowlistで静的合格する。
2. source候補がcommit/pushされた後、正式migration専用のfresh disposable acceptanceが合格する。
3. Codexがraw evidenceとprotected scopeを独立受理する。
4. 結果記録を別ゲートでGitへ届ける。

この終了はE2 local acceptanceであり、shared、staging、production、provider、E3、deploymentを承認しない。
