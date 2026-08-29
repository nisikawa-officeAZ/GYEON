# GYEON取扱店向け商品発注 V3 — C5-E1本番migration台帳整合化計画

## 1. 文書情報

- 計画ID: `GYEON_ORDER_V3_C5_E1_PRODUCTION_MIGRATION_LEDGER_RECONCILIATION_PLAN_V1`
- 状態: `GOVERNANCE_CANDIDATE_UNCOMMITTED / PRODUCTION_UNCHANGED / APPLY_NO_GO`
- 作成日: 2026-08-29
- GitHub `main`: `48de96bbf5518be3fd7fd8a3964dfd7975716165`
- `main` tree: `e25590d276237f643e9b1408e6c47d192388de07`
- 監査worktree HEAD: `a9d5d222fd1d4c726f91f3ea81d1d10e4adb5dc8`
- 監査worktree tree: `e25590d276237f643e9b1408e6c47d192388de07`
- 対象project: `DealerOS-Prod`
- 対象project ref: `dmvyaykhibmphrmekjbb`
- 対象region: `ap-northeast-1`
- 対象PostgreSQL: `17.6.1.147`
- 監査時Supabase CLI: `2.116.0`
- 前提結果: `C5D_FORMAL_MIGRATION_DISPOSABLE_PASS`
- 正式migration SHA-256: `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b`

本計画は本番適用の権限ではない。許可されたのはread-only監査とgovernance文書候補の作成だけである。Git stage、commit、push、PR作成・更新、Supabase login/link、migration repair、migration apply、SQL mutation、provider接続、Vercel deployment、production smokeはすべて別ゲートで明示承認を要する。

## 2. 結論

現時点の本番適用判定は `NO_GO_MIGRATION_LEDGER_DRIFT` とする。

理由は、GitHub `main` の正式SQLが111件である一方、`DealerOS-Prod`のmigration台帳は104件であり、未登録7件のうち3件が今回の本番対象外だからである。canonical `supabase/migrations/`をそのまま`db push`する方法、`--include-all`、内容未適用のmigrationを`applied`扱いにする`migration repair`は採用しない。

次の実行候補は、本番に適用済みの104件を非実行placeholderとして表し、今回承認対象となり得る4件だけをbyte-identical SQLとして含む隔離promotion bundleを作り、先に本番への`--dry-run`だけを証明する方式である。この方式自体もC5-E2として別承認・別検証を要する。

## 3. Read-only監査結果

### 3.1 対象同一性

| 項目 | 確認値 |
|---|---|
| Supabase project | `DealerOS-Prod` |
| project ref | `dmvyaykhibmphrmekjbb` |
| project status | `ACTIVE_HEALTHY` |
| PostgreSQL | `17.6.1.147` / major `17` |
| GitHub main commit | `48de96bbf5518be3fd7fd8a3964dfd7975716165` |
| GitHub main tree | `e25590d276237f643e9b1408e6c47d192388de07` |
| production migration count | `104` |
| production latest version | `20260824151255` |
| GitHub main top-level SQL count | `111` |
| production `product_orders` rows | `0` |
| production `product_order_items` rows | `0` |

通常checkoutの`.temp/project-ref`は`vhiuiwolnlvlwvoaingd`、すなわち`DealerOS-Dev-Next`であり、本番ではない。したがって`--linked`は本番手順に使用しない。

### 3.2 本番台帳に無い7件

#### 今回の本番候補になり得る新しい4件

| 順序 | migration | GitHub main SHA-256 | 分類 |
|---:|---|---|---|
| 1 | `20260825151059_persist_existing_vehicle_confirmed_body_size.sql` | `b45d94574e9385919668a8010e680d38e7eb916a17dca5b9546f2b0d84903dcd` | `CANDIDATE_PENDING` |
| 2 | `20260826010000_ppf_r1_atomic_price_persistence.sql` | `3b058f927627be556c1b47580d79346eae2b280065e4acfc9b2497f8384ef1aa` | `CANDIDATE_PENDING` |
| 3 | `20260826143000_window_film_v1_atomic_persistence.sql` | `bac9a397f356abffc2ae7a8e446df774b57ca94aab55108b10881e91a49b2182` | `CANDIDATE_PENDING` |
| 4 | `20260829101726_gyeon_order_v3_contract.sql` | `bd1a7742725c3f2a7bb42a3dbe5889b6e86bf6d213a0a550e6dd48f460d6d91b` | `CANDIDATE_PENDING` |

#### 今回の本番対象外3件

| migration | 本番実体 | 分類 | 処置 |
|---|---|---|---|
| `20260731115631_gyeon_dealer_provisioning.sql` | table/functionとも不在 | `DEV_APPLIED_PROD_DEFERRED` | C5-Eで適用しない |
| `20260801000649_gyeon_provisioning_pin_function_search_path.sql` | 対象function不在 | `DEV_APPLIED_PROD_DEFERRED_DEPENDENT` | C5-Eで適用しない |
| `20260801110110_line_link_tokens.sql` | 内容監査・本番適用を実施しない | `PROTECTED_FROZEN` | 独立LINE phaseまで除外 |

最初の2件は`DealerOS-Dev-Next`台帳では適用済みである。LINE migrationはDev-Nextでも未適用であり、既存のfreezeを維持する。

### 3.3 部分適用確認

`20260829101726`の対象は本番に部分適用されていない。

- 対象table: `0 / 17`
- 対象function: `0`
- `product_orders`対象追加column: `0 / 5`の代表確認
- 既存`product_orders`: `0`行
- 既存`product_order_items`: `0`行
- invalid status: `0`行
- non-positive quantity: `0`行

既存注文データの直接破損リスクは現在低い。ただし、適用直前に件数とconstraint互換性を再確認し、値が変化していれば本監査結果を再利用しない。

### 3.4 Dev-Nextの追加drift

Dev-NextではPPF persistenceがcanonical version `20260826010000`ではなく`20260826014012`として記録されている。MCP等による自動timestamp付与を本番へ持ち込むとGitと台帳が再びずれるため、production writeにMCP `apply_migration`を使用しない。

## 4. 根本原因

`supabase/migrations/`に次の2種類が同居している。

1. 全環境へ順番どおり適用するcanonical migration。
2. Devだけに適用され、本番適用がdeferredまたはfrozenのmigration。

Supabase migration台帳は環境別の「適用済み」を表すが、canonicalフォルダは環境別除外を表現しない。このため、通常pushでは本番に不要な旧3件が差分として残り続ける。

## 5. 不採用案

### 5.1 `migration repair --status applied`

不採用。旧3件のうち少なくともprovisioning table/functionは本番に存在しない。未適用SQLを適用済みと記録することは台帳の虚偽化であり、将来の復旧・比較・新環境再現を壊す。

### 5.2 `db push --include-all`

不採用。Dev限定provisioningとprotected LINE migrationを今回の承認範囲外で本番適用する危険がある。

### 5.3 現在のcheckoutから`--linked`

不採用。現在のlinkは`DealerOS-Dev-Next`であり、本番対象ではない。

### 5.4 MCP `apply_migration`

不採用。Supabase公式はMCPをdevelopment/testing向けとし、production接続を推奨していない。またDev-Nextでcanonical filenameと異なるtimestampが記録された実績があり、exact ledger parityを保証できない。

### 5.5 Dashboard SQL editorまたは直接`psql -f`

不採用。SQL実体とmigration台帳を分離し、C5-Dで証明したCLI-native migration contractを失う。

## 6. 採用候補 — 隔離promotion bundle

### 6.1 原則

- GitHub `main`のexact commit `48de96bb...`をsource authorityとする。
- 本番に適用済みの104件は、remote version/nameから生成した0-byte placeholderで表す。
- placeholderへ元SQL本文をcopyしない。適用済みmigrationを再実行しない。
- 新しい4件だけGitHub `main`からbyte-identicalに取得し、上記SHA-256をhard gateにする。
- 対象外3件はbundleに存在させない。
- protected path本文は開かず、読まず、copyせず、placeholderまたは除外状態だけを記録する。
- bundleはGit worktree外のfresh runtimeへ作り、attempt終了時に削除する。
- bundle自体の全file名、size、SHA-256とcombined manifest SHA-256を保存する。

### 6.2 placeholder安全契約

placeholderは「本番台帳ですでに適用済みのversion/nameをCLIへ提示する」ためだけに使う。次をhard prohibitionとする。

- `supabase db reset`
- `supabase migration up --local`
- `supabase db push --include-all`
- `--include-seed`
- `supabase migration repair`
- production以外へのbundle再利用
- placeholderのSQL実行

CLIがplaceholderをpendingとして表示する、内容を実行対象にする、remote-only/local-only差分を104件に対して報告する、または新4件以外をdry-runへ出す場合は即FAILとし、bundleを本番適用へ昇格しない。

## 7. C5-E2 dry-run検証ゲート

C5-E2は別承認を要する。最初の実行はproduction mutationを行わない`--dry-run`だけとする。

### 7.1 future implementation allowlist

1. `scripts/e2e/gyeon-order-v3-c5e2/README.md`
2. `scripts/e2e/gyeon-order-v3-c5e2/build-promotion-bundle.sh`
3. `scripts/e2e/gyeon-order-v3-c5e2/verify-production-dry-run.sh`
4. `scripts/e2e/gyeon-order-v3-c5e2/cleanup.sh`
5. `scripts/e2e/gyeon-order-v3-c5e2/expected-production-migrations.json`

上記は将来の候補allowlistであり、本計画は作成・実行・Git deliveryを許可しない。

### 7.2 実行前hard gate

1. GitHub `main` commit/treeが本計画値と一致する。
2. `DealerOS-Prod` refが`dmvyaykhibmphrmekjbb`、statusが`ACTIVE_HEALTHY`である。
3. production migration countが`104`、latestが`20260824151255`である。
4. 対象外3件がproduction台帳に無い。
5. 新4件がproduction台帳に無い。
6. 新4件のSHA-256が本計画値と一致する。
7. production `product_orders` / `product_order_items`とconstraint互換性をread-onlyで再監査する。
8. Supabase backup/PITRまたは同等の復旧可能性をoperatorが確認する。
9. CLI認証情報、DB password、接続文字列、JWT、keyをlog・manifest・shell historyへ出さない。
10. 通常checkoutのlink stateを変更しない。

### 7.3 dry-run command contract

current CLI helpでflagを再確認した後、fresh bundleから次の意味のcommandを実行する。

```text
SUPABASE_TELEMETRY_DISABLED=1 supabase db push \
  --dry-run \
  --project-ref dmvyaykhibmphrmekjbb \
  --skip-vault \
  --workdir <fresh-promotion-bundle>
```

DB passwordはpromptまたは承認済みsecret injectionで渡す。command line、evidence、chatへ平文を置かない。

### 7.4 dry-run PASS条件

dry-runの適用予定が次の4件、次の順序だけであること。

1. `20260825151059_persist_existing_vehicle_confirmed_body_size`
2. `20260826010000_ppf_r1_atomic_price_persistence`
3. `20260826143000_window_film_v1_atomic_persistence`
4. `20260829101726_gyeon_order_v3_contract`

追加、欠落、順序差、target mismatch、remote drift、credential failure、placeholder再適用、secret検出のいずれかで`C5E2_DRY_RUN_FAIL_BURN_BUNDLE`とする。同じbundleは修理・再利用しない。

## 8. 将来のproduction applyゲート

C5-E2 dry-run PASSだけでは本番適用を許可しない。ownerがexact bundle manifest hashとexact 4 migrationを明示承認した後に限り、同じimmutable bundleから`--dry-run`を外した1回のCLI commandを実行できる。

- `--linked`禁止
- `--include-all`禁止
- `--include-seed`禁止
- `migration repair`禁止
- MCP write禁止
- Dashboard SQL / direct `psql`適用禁止
- concurrent deploy禁止

Supabase CLIがmigrationごとにtransactionを完了する場合、途中失敗で先頭からの一部だけが適用済みになる可能性がある。失敗時は再実行せず、read-only migration listとschema状態を採取して停止する。復旧は新しいforward-only migrationまたは未適用suffixの再実行可能性を別phaseで判断する。

## 9. 適用後required verification

1. production台帳が`108`件になり、新4 version/nameが各1件だけ存在する。
2. 対象外3件は引き続き未登録である。
3. GYEON Order V3の対象table `17 / 17`、対象RPC、column、RLS、grant/revokeが成立する。
4. wizard body-size保存、PPF保存、window-film保存の各RPC存在を確認する。
5. Security AdvisorとPerformance Advisorを実行し、新規severityを切り分ける。
6. secretを含まないmigration/apply/postflight evidence manifestを保存する。
7. authenticated staging/production smokeはDB applyとは別承認で実施する。

## 10. Stop条件

次のいずれかで本番適用へ進まない。

- GitHub main commit/treeまたは4件のhashが変化した。
- production project ref/name/statusが一致しない。
- production migration count/latest/欠落集合が本計画から変化した。
- production注文データが増え、既存データ互換性を再証明していない。
- backup/PITRまたは同等の復旧境界が確認できない。
- dry-runがexact 4件以外を表示した。
- protected path本文へのaccessが必要になった。
- CLIが`migration repair`または`--include-all`を要求した。
- credential、network、lock、statement timeout、advisor、scope gateのいずれかがFAILした。

## 11. Protected scope

以下はpathname、mode、blob、Git stateだけを確認する。

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`

本計画作成時blob:

- `ScreensPreview.tsx`: `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- LINE migration: `accd22345054cc44f89156fd78eaba6dfe4242a4`
- monthly invoice migration: `32fda49583ae1217bc13711784ad8fa31744726c`
- monthly invoice test: `fe3c80f22fd80dcbfab076082473216dda582c14`

## 12. 次のゲート

1. MacBook Codexが本計画を含むexact 3-document candidateを検証する。
2. ownerがexact 3 pathsのstage/local commitを別承認する。
3. ownerがnormal pushと新しいcoordination Draft PRを別承認する。
4. MacBook CodexがC5-E2 read-only diagnosis directiveをDraft PRへ投稿する。
5. ownerがfuture 5-path harness candidateを別承認する。
6. static acceptance、stage、commit、pushをそれぞれ別承認する。
7. ownerがproduction-mutationなしのexact dry-runを別承認する。
8. dry-run PASS後、ownerがexact 4 migration production applyを別承認する。
