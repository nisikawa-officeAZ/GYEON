# GYEON取扱店向け商品発注 V3 — C5-D正式migration専用使い捨てDB検証計画

## 1. 文書情報

- 計画ID: `GYEON_ORDER_V3_C5_D_DISPOSABLE_DB_VERIFICATION_PLAN_V1`
- 状態: `GOVERNANCE_CANDIDATE_UNCOMMITTED / HARNESS_NOT_IMPLEMENTED / DB_NOT_RUN`
- 対象branch: `agent/gyeon-order-v3-c5d-formal-migration-promotion`
- 基準HEAD: `d06cd8a45d404c3e66c086341b80b0a5436b260b`
- 基準tree: `575347f7daf693fa3923d6efe9f5ff1b4078ae5e`
- source commit: `c7806331dcbb035448704e09c625cd4870681142`
- formal migration: `supabase/migrations/20260829101726_gyeon_order_v3_contract.sql`
- formal SHA-256: `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b`
- 直前migration version: `20260826143000`
- DRAFT SHA-256: `d04517f479a956ba50f7d1b7ce636f8fc57b7e02d81f47b0adf457e1e12e2e73`
- 監査時Supabase CLI: `2.116.0`
- 作成日: 2026-08-29

この文書はharness実装、外部AI送信、Git delivery、Colima/Docker起動、DB/Supabase runtime、provider接続、共有・staging・production適用、PR Ready、merge、deploymentの権限ではない。すべて別ゲートで明示承認を要する。

## 2. 結論

C5-DはC5-Cの成功証拠を前提資料として保持するが、C5-C runtimeやsuffixを再利用しない。正式timestamp migrationそのものを対象に、次の3経路を別々のloopback-only runtimeで証明する。

1. **A — Fresh full-chain replay**: migration連鎖を先頭からSupabase CLIで適用する。
2. **B — Populated legacy upgrade**: 直前versionまで適用し、代表的な既存注文・明細を作成してから正式migrationをSupabase CLIで適用する。
3. **C — CLI-native pending migration**: 空の直前baselineから`migration up --local`で正式migrationだけをpending migrationとして適用し、CLI ledgerを証明する。

正式migrationを`psql -f`で直接適用してはならない。`psql`はfixture作成、pgTAP、検証query、cleanupだけに使用できる。

## 3. 実行単位と分離

1回のowner-approved attemptは、未使用suffixの下にA/B/Cの3 runtimeを作る。

```text
/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5d.<fresh-suffix>/fresh
/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5d.<fresh-suffix>/populated
/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5d.<fresh-suffix>/runner
```

- runtimeはGit worktree外かつ`/private/tmp`外に置く。
- project ID、DB port、API portを3 runtimeで分離する。
- 各hostは`127.0.0.1`、`localhost`、`::1`だけを許可する。
- `.temp/project-ref`、linked project、`supabase.co`、`supabase.in`、`pooler.supabase`を検出したら開始前に停止する。
- A/B/Cのどれか1つでも失敗したらattempt全体をburnする。同じsuffixを修理・再実行しない。
- cleanupは途中失敗でも3 runtimeすべてへ1回ずつ停止・削除を試みる。

## 4. 実行前source identity

実行時の受理済みHEAD/treeはCodexが明示し、harnessは完全一致を要求する。最低限次をhard gateにする。

- branch、HEAD、tree、upstream、ahead/behind、index、worktree clean
- formal path/hashと同名候補1件
- DRAFT path/hash、terminal ROLLBACK、不変Git blob
- formal migrationのterminal COMMIT、terminal ROLLBACKなし
- main base `96a66c3fb5969718418da1ef4c75fe62407b48aa`がHEADのancestor
- protected 4 pathのpathname/mode/blob/Git state
- Supabase CLI、Node、Git、Colima、Docker、PostgreSQL clientの実version
- `GYEON_ORDER_V3_C5D_PSQL_BIN`が実行可能であること。監査時の安定パスは`/opt/homebrew/opt/libpq/bin/psql`だが、versionを固定推測せず実行時に記録する。

## 5. migration staging contract

- Git worktreeの`supabase/migrations/`を直接実行しない。各runtimeへ必要migrationだけをbyte copyする。
- `DRAFT_DO_NOT_APPLY`配下は一切copyしない。
- protected LINE migration `20260801110110_line_link_tokens.sql`は内容を開かず、runtime chainから明示除外し、manifestへ`excluded_protected`として記録する。
- それ以外の正式migrationはfilename順を維持する。
- C5-D formal migrationはGit blobと同じSHA-256でcopyし、書換え・派生・再formatを禁止する。
- closed finance migrationは機械的chainの一部としてcopyできるが、個別内容を診断・変更しない。

## 6. 必須経路

### 6.1 A — Fresh full-chain replay

1. bare local stackを起動する。
2. current CLI helpで確認した`supabase db reset --local --no-seed --yes`相当のCLI-native経路で全正式migrationを適用する。
3. `supabase migration list --local`でformal version `20260829101726`がちょうど1件適用済みであることを確認する。
4. C5-C相当のpgTAP、real Auth/PostgREST、business contract、separate-connection concurrency、advisor、query planを再実行する。

### 6.2 B — Populated legacy upgrade

1. `supabase db reset --local --version 20260826143000 --no-seed --yes`相当でformal直前まで適用する。
2. 複数dealer、`product_orders`の`draft`・`submitted`・`approved`・`cancelled`、正のquantityを持つ`product_order_items`、NULL可能な旧列、金額、timestampを含む代表fixtureを作る。
3. 適用前fingerprintとしてrow count、PK、FK、dealer_id、status、quantity、金額、timestampを保存する。
4. current CLI helpで確認した`supabase migration up --local`相当でformal migrationを適用する。
5. 適用後に同じ旧データが欠落・重複・意図しない変更を受けていないこと、新しいconstraintが成立することを証明する。
6. migration失敗、lock timeout、statement timeout、fixture変化はすべてFAILとする。

### 6.3 C — CLI-native pending migration

1. Bとは別runtimeをformal直前versionまでCLIで構築する。
2. fixtureを入れず、`supabase migration list --local`でformalがpendingであることを記録する。
3. `supabase migration up --local`でformal migrationを1回だけ適用する。
4. 再度`migration list --local`を実行し、version `20260829101726`が1件だけ適用済みであることを確認する。
5. CLI command、開始・終了時刻、exit codeを証拠化し、`psql -f`によるformal適用が0件であることをcommand ledgerで証明する。

## 7. Aで再実行する契約証拠

- pgTAP: schema、constraint、index、RLS、grant/revoke、function owner/search_path、RPC署名
- qualification authority、classification version、fail-closed状態
- external evidence、prepare/finalize、payment snapshot、compensation outbox
- warehouse release/acceptance、calendar、reservation、backorder、payment method
- real local Auth/PostgREST request scope
- 2つの独立OS `psql` processと第3observer connectionによる全race
- `supabase db lint --local --schema public --level warning --fail-on error`
- bounded query plans
- secret scan、fixture zero、project stop、runtime removal、retained hash verification

C5-Cの186/186、35/35、11/11はpredecessor証拠であり、C5-D PASSの代替にしない。

## 8. 将来のharness実装write allowlist

実装時に新規作成できるのは次の10パスだけとする。既存C5-C harnessはread-only referenceであり変更しない。

1. `scripts/e2e/gyeon-order-v3-c5d/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5d/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5d/capture-evidence.sh`
4. `scripts/e2e/gyeon-order-v3-c5d/cleanup.sh`
5. `scripts/e2e/gyeon-order-v3-c5d/real-auth.mjs`
6. `scripts/e2e/gyeon-order-v3-c5d/concurrency.mjs`
7. `scripts/e2e/gyeon-order-v3-c5d/schema-rls.test.sql`
8. `scripts/e2e/gyeon-order-v3-c5d/qualification-evidence.test.sql`
9. `scripts/e2e/gyeon-order-v3-c5d/prepare-finalize-warehouse.test.sql`
10. `scripts/e2e/gyeon-order-v3-c5d/populated-upgrade.test.sql`

依存関係、lockfile、migration、DRAFT、C5-C harness、UI、provider、Office AZ在庫、環境設定は変更禁止とする。

## 9. harness実装ゲート

harness候補作成ではruntimeを起動しない。許可する静的確認は次だけとする。

- `SUPABASE_TELEMETRY_DISABLED=1`を付けた`supabase --version`と`supabase db reset --help`、`supabase migration up --help`、`supabase migration list --help`、`supabase db lint --help`
- `bash -n` for `setup.sh`、`capture-evidence.sh`、`cleanup.sh`
- `node --check` for `real-auth.mjs`、`concurrency.mjs`
- exact 10-path allowlist
- 新規10パスへの`git diff --no-index --check /dev/null`
- formal path/hash、直前version、confirmation literal、A/B/C分離、loopback、burn、cleanup、CLI-native prohibitionの静的zero/positive match
- protected metadata-only確認

上記`--help`／`--version`以外のSupabase CLI、setup、DB、Colima、Docker、psql、SQL、Auth、PostgREST、HTTP、provider、networkは実行禁止とする。

実装PASSはharness実行の承認ではない。harnessのstage、commit、push、runtime実行はそれぞれ別承認とする。

## 10. required evidence

最低限、次をretained evidenceへ含める。

- aggregate `manifest.json`とA/B/C別manifest
- versions、source/harness hashes、protected metadata
- A/B/C command ledger
- A fresh migration list/replay結果
- B pre/post legacy fingerprintとupgrade assertion
- C pending/applied migration listとCLI exit code
- pgTAP、real-auth、business、warehouse、concurrency結果
- backend PID、advisor、query plans、secret scan
- cleanup log、fixture zero、stop/remove exit code
- 全artifact SHA-256

secret、JWT、service-role key、raw local stack bannerは保存・表示しない。

## 11. verdictとburn rule

- 全gate PASS: `C5D_FORMAL_MIGRATION_DISPOSABLE_PASS`
- formal SQL/test defect: `CHANGES_REQUIRED_SOURCE`
- harness/environment defect: `CHANGES_REQUIRED_HARNESS_OR_ENVIRONMENT`
- baseline failure: `BASELINE_BLOCKED`
- scope/protected/linked-project conflict: `BLOCKED_SCOPE`

どのFAILでもsuffixと全A/B/C evidence setをburnする。同じsuffixの修理、再実行、結果上書きを禁止する。

## 12. protected scope

次はpathname/mode/blob/Git stateだけを確認し、内容を開く、読む、diff、copy、stage、modifyしない。

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

## 13. 次のゲート

1. 本計画、harness実装指示書、completion plan、append-only ledgerのexact 4-document candidateをCodexが検証する。
2. ownerが4文書のstage/local commitを別承認する。
3. ownerが通常pushを別承認する。
4. ownerが実装executorと非公開文書の外部送信有無を別決定する。
5. 10-path未コミットharness候補を静的受入する。
6. harness stage、commit、pushをそれぞれ別承認する。
7. fresh suffixを使うruntime実行を別承認する。
