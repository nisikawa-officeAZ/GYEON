# GDA Estimate Wizard 郵便番号マスター R5 — 使い捨てDB検証計画

## 1. 文書情報

- 計画ID: `GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DISPOSABLE_DB_VERIFICATION_PLAN_V1`
- 状態: `DESIGN_AND_RATIFICATION_PUSHED / HARNESS_CANDIDATE_CREATED_SEVEN_PATH_UNCOMMITTED / CODEX_STATIC_REVIEW_CHANGES_REQUIRED / FIRST_REPAIR_ATTEMPT_INCOMPLETE_PARTIAL_SETUP_CAPTURE_CLEANUP / SECOND_SEVEN_FILE_REPAIR_NO_CHANGE / FOUR_DOCUMENT_DEALER_BOUNDARY_AND_RUNTIME_LOCATION_DOC_REPAIR_COMPLETED / THREE_SHELL_SCRIPT_OS_TEMP_EXCLUSION_SOURCE_REPAIR_COMPLETED / CODEX_STATIC_RE_REVIEW_FOUND_FINDINGS_A_B_PLUS_STALE_STATUS / GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_STATIC_REPAIR_RESULT_V1_APPLIED_AS_CANDIDATE / CODEX_STATIC_VERDICT_CHANGES_REQUIRED_HARNESS_OS_TEMP_FAIL_CLOSED_ORDERING / GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_OS_TEMP_GUARD_REPAIR_RESULT_V1_APPLIED_AS_CANDIDATE / CODEX_STATIC_VERDICT_CHANGES_REQUIRED_HARNESS_RETAINED_DESTINATION_EXISTS_BURN_GAP / ABORTED_DISPATCH_D5CA2074_READ_ONLY_UNAUTHORIZED_WC_NO_EDITS_NOT_ACCEPTED / GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_CLOSEOUT_REPAIR_RESULT_V1_APPLIED_AS_CANDIDATE / DB_NOT_RUN / RUNTIME_NOT_RUN / CANDIDATE_UNSTAGED_UNCOMMITTED_UNPUSHED`
- Repository: `nisikawa-officeAZ/GYEON`
- 対象PR: `#48` (`OPEN/Draft`, base `main`)
- 対象branch: `agent/estimate-wizard-ocr-postal-unified-r1`
- R4-F1 source HEAD: `3c3532b40ac4db84061b17aaf575b8af9297e139`
- R4-F1 source tree: `9186b0660018920db19283f1a85ee2224cfae97e`
- 対象migration: `supabase/migrations/20260901001246_jp_postal_master.sql`
- migration SHA-256: `2325168075511e7a1657f6c2b2299109a41a0181ac590a86817cf94d44467f7a`
- 監査時Supabase CLI: `2.116.0`
- 作成日: 2026-09-02

この文書は限定設計だけである。harness実装、外部AI送信、Git stage/commit/push、Colima/Docker/DB/Supabase runtime、Auth/PostgREST、共有・development・staging・production接続、migration適用、実データ投入、PR変更、Ready、merge、deploymentを許可しない。

## 1.1 現在の状態（2026-09-02）

- 本設計文書とR5ガバナンス比准は、いずれもpush済みでありPR `#48`（`OPEN/Draft`, base `main`）に反映されている。
- 最初のharness実装invocationは、計画/台帳の比准欠落を理由に、いかなる書き込みも行わずに停止した。
- 比准後の後続invocationが、セクション9に列挙する7 pathsからなるharness候補を作成した。この候補は現在もGit未追跡・未staged・未commitのままである。
- Codexによる静的レビューは、この候補に修理が必要な欠陥があると判定した（`CHANGES_REQUIRED`）。
- 最初の修理試行は`setup.sh`、`capture-evidence.sh`、`cleanup.sh`の一部を変更したが、未完了のまま終了した。
- 2回目の7-file修理試行は、候補に対して何も変更しなかった。
- 4-document（本計画・directive・completion plan・phase results ledger）のdealer-boundary/runtime-location doc repairは完了済みである（`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_DOC_REPAIR_RESULT_V1`）。
- その後Codexが静的再レビューを行い、残存する2件のsource findings（A: OS一時ディレクトリ除外がsource上で強制されていない、B: fixtureの郵便番号/JISコードが実在の日本郵便データに類似・衝突しうる）と、本ステータス記述の陳腐化（finding C）を検出した。
- 本repair（結果マーカー`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_STATIC_REPAIR_RESULT_V1`）は、finding A（`setup.sh`/`capture-evidence.sh`/`cleanup.sh`のOS一時ディレクトリ除外をsource強制）、finding B（`real-auth.mjs`/`import-resume.mjs`/`runtime-contract.test.sql`のfixtureをsynthetic化）、finding C（本ステータス更新）を候補として適用済みである。
- その後Codexが本候補を静的レビューし、`CHANGES_REQUIRED_HARNESS`と判定した。synthetic postal/JISフィクスチャの修正（finding B）自体は妥当だが、OS一時ディレクトリ除外のfail-closed順序に欠陥があった。`setup.sh`/`capture-evidence.sh`/`cleanup.sh`いずれも、`LANE_DIR`/`SUFFIX_DIR`/`RUNTIME_DIR`/`RETAINED_DIR`等のruntime/suffix/lane/retained-evidence pathをOS一時ディレクトリ除外チェックで拒否するその`fail()`呼び出し自体が、まだ未検証（除外チェックに失敗したかもしれない）そのpathへ`mkdir`やburn evidence書き込みを行いうるという欠陥があった。
- 本repair（結果マーカー`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_OS_TEMP_GUARD_REPAIR_RESULT_V1`）は、三つのshell scriptすべてに`PATHS_VALIDATED`ゲートを導入し、canonical runtime parent・suffix path・lane path（および`cleanup.sh`ではretained-evidence parent/derived destinationも含む）の除外チェックが全て成功した後にのみ、通常の`fail()`ハンドラおよびEXIT trapがburn evidenceを書き込めるようにした。ゲート成立前の拒否は非書き込み（stderrへの出力とexitのみ）である。あわせて`gda_r5_realpath`/`gda_r5_assert_outside_excluded_roots`のcanonicalizationエラー自体も、未検証destinationへの書き込みなしにfail-closedとなるよう明示的なエラーハンドリングを追加した。fresh suffix、burn-on-failure、one-shot cleanup、exact-prefix removal、hash、protected-file、evidence要件はいずれも弱めていない。Bash 3.2互換は維持している。
- その後Codexが`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_OS_TEMP_GUARD_REPAIR_RESULT_V1`候補を静的レビューし、再び`CHANGES_REQUIRED_HARNESS`と判定した。`cleanup.sh`のretained-destination存在チェック（`[[ ! -e "$RETAINED_DIR" ]]`）が`PATHS_VALIDATED=1`より前で実行されており、runtime parent・suffix path・retained-evidence parent・derived retained destinationの4 pathが安全でもRETAINED_DIRが既に存在する場合、`fail()`が既存の安全なsuffixをburnせずに終了してしまうというone-attempt/no-retry契約を弱める欠陥だった。
- 最初のcloseout dispatch invocation（Claudeセッション`d5ca2074-2f62-4bc6-b407-3e2e84d10970`）は、`GYEON_DA_COMPLETION_PLAN.md`と`GYEON_DA_PHASE_RESULTS.md`だけに対して未承認だが読み取り専用の`wc -l`コマンドを1回使用した。Codexがこれを検知してinvocationを停止し、いかなる書き込みも発生しなかったことを確認した。このinvocationはrepair実行として受理されない。
- 後続の代替dispatch invocationはRead/Editのみを使用し、上記のOS-temp guard repair候補（`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_OS_TEMP_GUARD_REPAIR_RESULT_V1`）を作成したが、Codexはその後、上記のretained-destination-exists burn gapを検出した。
- 本repair（結果マーカー`GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_FINAL_CLOSEOUT_REPAIR_RESULT_V1`）は、`cleanup.sh`において`PATHS_VALIDATED=1`への遷移を、4つのcanonical excluded-root checkすべての直後・`[[ ! -e "$RETAINED_DIR" ]]`チェックの直前へ移動した。literalな unsafe-path checkはゲート前のままである。これにより、4 pathが安全だがRETAINED_DIRが既に存在する場合も、検証済みの失敗経路（`fail()`）を通り、既存の安全なsuffixをburnするようになった。他のmkdir、cleanup-started書き込み、aggregate-log書き込み、lane operation、copy、removalはすべて検証後のままであり、弱められていない。Bash 3.2互換は維持している。
- 本closeout invocationはRead/Editのみを使用し、Git未staged・未commit・未push、DB/runtime未実行のままであり、Codexの静的レビュー待ちである。
- DBおよびruntimeの実行は一度も行われていない。
- 本candidateは現在もGit未追跡・未staged・未commit・未pushのままである。
- 本設計文書とR5ガバナンス比准は、いかなる場合もruntime実行またはGit delivery（stage/commit/push）の権限を与えない。各操作は本文書とは別のゲートで個別に承認される。

## 2. 結論

R5は、R4のソース試験だけでは証明できない次の境界を、完全に使い捨てのローカルSupabaseで確認する。

1. 正式migrationが先頭からCLI-nativeに再生できること。
2. 郵便番号テーブル、RPC、権限、RLS、共有`private` schemaとの非破壊性が実DBで成立すること。
3. service-role-only import RPCの中断再開、sequence重複no-op、promote、terminal fail-closedが実DBで成立すること。
4. dealer利用者の検索RPCが実Auth/PostgREST request scopeで許可・拒否を正しく分けること。
5. production importerがローカルURLを意図どおり拒否し、project-ref安全契約を迂回しないこと。

R5 PASS後もDevelopment migration適用や日本郵便実CSV投入は自動承認されない。次はDevelopmentのread-only migration-history preflightであり、適用と投入は別々のowner gateとする。

## 3. 解いてはいけない設計矛盾

R4 importerは、書込み時の`SUPABASE_URL`を厳密に `https://<20文字project-ref>.supabase.co` に限定する。ローカルSupabaseの`http://127.0.0.1:<port>`は正しく`NON_CANONICAL_SUPABASE_URL`で停止する。

したがってR5は次を禁止する。

- importerへlocalhost例外やtest bypassを追加すること。
- `/etc/hosts`、TLS proxy、証明書差替え、DNS偽装でcanonical hosted URLをローカルへ向けること。
- source修正、環境変数override、monkey patchでproject-ref guardを迂回すること。
- hosted Developmentを「disposable」と呼んで実行すること。

代わりに、DB側import state machineはR5専用driverからローカルservice-role PostgREST RPCを直接呼んで証明する。production importerについては、既存unit testとR5でのローカルURL拒否を証拠化し、実書込みは後続のDevelopment専用投入ゲートまで行わない。

## 4. 実行単位

1回のowner-approved attemptは、Git worktree外、`/private/tmp`外、かつ一般的なOSの一時ディレクトリ（`$TMPDIR`、`/tmp`、`/var/folders`、`os.tmpdir()`が指す場所などを含む）外の未使用suffixに2つのruntime laneを作る。一般的なOS一時ディレクトリの使用は明示的に禁止する。

```text
/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5.<UTC timestamp>-<6 lowercase alnum>/fresh
/Users/atsushinishikawa/Documents/Codex/runtime/gda-postal-r5.<UTC timestamp>-<6 lowercase alnum>/import
```

- `fresh`: 正式migrationのfull-chain replay、pgTAP、実Auth/PostgREST検索、権限・共有schema非破壊性。
- `import`: 同じmigration chainを新規DBへ再生し、synthetic CSV相当の架空行だけでimport state machineを検証する。
- project ID、DB/API/Studio/Inbucket/Analytics各portをlane間で分離する。
- hostは`127.0.0.1`、`localhost`、`::1`だけを許可する。
- `.temp/project-ref`、linked project、hosted URL、pooler URL、Production/Development refを検出したら開始前に停止する。
- 片方でも失敗したらattempt全体をburnし、同じsuffixを修理・再実行しない。
- cleanupは途中失敗でも両laneへ停止・削除を1回ずつ試みる。
- retained evidenceも同じくGit worktree外、`/private/tmp`外、一般的なOS一時ディレクトリ外に保存する。

## 5. 実行前hard gate

将来の実行指示は、実装・commit・push済みの受理HEAD/treeを新たに固定する。harnessは少なくとも次を完全一致で要求する。

- branch、HEAD、tree、PR headRefOid、PR `OPEN/Draft`、base `main`
- index/worktree clean、対象harness commitがHEADに含まれること
- migration pathname/mode/blob/SHA-256と同名候補が1件だけであること
- R4の正確な5 source/test pathsのpathname/mode/blob/SHA-256
- `supabase/config.toml`および`supabase/.temp/project-ref`がrepositoryに存在しないこと
- Supabase CLI、Node、Git、Colima、Docker、PostgreSQL clientの実version
- runtime rootがworktree外、`/private/tmp`外、一般的なOS一時ディレクトリ（`$TMPDIR`/`/tmp`/`/var/folders`等）外、未使用であること
- confirmation literal `I_UNDERSTAND_GDA_POSTAL_R5_IS_DISPOSABLE`
- protected 4 pathsのpathname/mode/blob/Git state（内容は読まない）

## 6. migration staging contract

- Git worktreeの`supabase/migrations/`を直接実行せず、各laneへ必要migrationをbyte copyする。
- `DRAFT_DO_NOT_APPLY`はcopyしない。
- protected LINE migration `20260801110110_line_link_tokens.sql`は内容を開かず、runtime chainから除外してmanifestへ`excluded_protected`として記録する。
- それ以外の正式migrationはfilename順を維持する。
- 対象postal migrationはGit blobと同じSHA-256でcopyし、編集・format・派生SQL化しない。
- migrationは現在のSupabase CLIが示すlocal-only native commandで適用する。対象migrationを`psql -f`で適用してはならない。
- protected LINE migrationの除外による依存失敗は`BLOCKED_PROTECTED_DEPENDENCY`とし、内容閲覧や臨時修正で回避しない。

## 7. 必須証拠 — fresh lane

1. 全正式migrationを先頭からlocal-only CLI-native経路で適用する。
2. `supabase migration list --local`相当で`20260901001246`がちょうど1件適用済みであることを示す。
3. `supabase test db`相当で`supabase/tests/jp_postal_master_rpc.test.sql`を実DB実行し、全assertionを数えて記録する。
4. anon、authenticated、service_roleのdirect table accessが契約どおり拒否されることを確認する。
5. 郵便番号マスターはdealerに紐付かないglobal reference dataであり、lookup RPCはdealer idを持たず、dealer所有データを一切返さない。少なくとも1件のactive `dealer_members` membershipを持つauthenticated userは、そのmembershipがどのdealerのものであっても成功することを、実際のAuth session cookie/JWTとPostgREST requestで確認する（別dealerのactive memberでも成功する）。anon、membership無し、inactiveだけのmembershipは拒否されることを同様に確認する。cross-dealer denialは要求しない。
6. 郵便番号正規化、複数候補、空結果、active batchのみ参照、入力上限を実RPCで確認する。
7. R4が保護する既存GYEON-order private-function/RLS契約を、既存pgTAPまたは限定した実queryで再確認する。postal migrationによる共有schemaの破壊がないことを示す。
8. `supabase db lint --local --schema public --level warning --fail-on error`相当を実行し、error 0を要求する。

## 8. 必須証拠 — import lane

実在する氏名・住所・郵便番号を使わず、明示的に架空と分かるdeterministic synthetic rowsだけをruntime内で生成する。

1. service-role PostgREST RPCで`status -> begin -> append`を実行し、途中でdriverを意図的に終了する。
2. 新しいprocessから同一source date/SHA-256/expected countで`status`を取得し、受理済みsequenceをskipして残りだけをappendする。
3. 同じsequenceを再送し、row増加0かつsuccessful no-opであることを確認する。
4. `finalize`後にactive batchとlookup結果が一致することを確認する。
5. 同一identityの再実行がalready-promoted成功になることを確認する。
6. `rejected`、`rolled_back`、promoted-but-superseded identityが再利用されずfail closedとなることを確認する。
7. status RPCがaddress/source rowを返さず、安全なmetadataだけであることを確認する。
8. importerの`--validate-only`をsynthetic CSVで実行し、client生成・HTTP/RPC 0、checksum/count/batch分割だけが行われることを確認する。
9. mutating importerへlocal URLを与え、`NON_CANONICAL_SUPABASE_URL`でclient生成前に停止することを確認する。guardを通過させる試験は行わない。

## 9. 将来のharness実装write allowlist

将来の別承認された実装で新規作成できるのは、次の7 pathsだけとする。

1. `scripts/e2e/gda-estimate-postal-master-r5/config.toml`
2. `scripts/e2e/gda-estimate-postal-master-r5/setup.sh`
3. `scripts/e2e/gda-estimate-postal-master-r5/capture-evidence.sh`
4. `scripts/e2e/gda-estimate-postal-master-r5/cleanup.sh`
5. `scripts/e2e/gda-estimate-postal-master-r5/real-auth.mjs`
6. `scripts/e2e/gda-estimate-postal-master-r5/import-resume.mjs`
7. `scripts/e2e/gda-estimate-postal-master-r5/runtime-contract.test.sql`

既存source、migration、test、dependency、lockfile、UI、config、C5 harness、provider codeは変更禁止とする。synthetic fixtureやevidenceはruntime外部に生成し、Gitへ追加しない。

## 10. harness実装ゲート

harness候補の実装時にはruntimeを起動しない。許可する確認は次だけとする。

- telemetry-disabled Supabase CLIの`--version`と必要な`--help`
- `bash -n` on the three shell files
- `node --check` on the two `.mjs` files
- SQL static lint/check（DB接続を伴わないものだけ）
- exact seven-path changed-file verification
- new seven pathsへの`git diff --no-index --check /dev/null`
- loopback-only、fresh suffix、burn、cleanup、no-linked、no-hosted、CLI-native migration、no-`psql -f` apply、synthetic-only、no-secretsの静的match
- protected metadata-only確認

実装PASSはstage、commit、push、runtime実行の承認ではない。各操作は別ゲートとする。

## 11. retained evidence

- aggregate `manifest.json`、lane別manifest、command ledger
- source/harness path、mode、blob、SHA-256
- version、port、loopback、unlinked、fresh-suffix証拠
- fresh migration list、pgTAP、Auth/PostgREST、grant/RLS、shared-schema、lint結果
- import state transition、sequence、row-count fingerprint、duplicate no-op、resume、terminal fail-closed結果
- validate-only zero-client/zero-network、local-URL拒否結果
- backend PID、開始終了時刻、exit code
- secret scan、fixture zero、stack stop、runtime removal、artifact SHA-256

secret、JWT、service-role key、DB password、raw local stack banner、住所行は保存・表示しない。

## 12. verdict

- 全gate PASS: `GDA_POSTAL_R5_DISPOSABLE_DB_PASS`
- migration/RPC/source contract defect: `CHANGES_REQUIRED_SOURCE`
- harness defect: `CHANGES_REQUIRED_HARNESS`
- local runtime/tool defect: `CHANGES_REQUIRED_ENVIRONMENT`
- protected migration dependency: `BLOCKED_PROTECTED_DEPENDENCY`
- baseline/scope/linked/hosted conflict: `BLOCKED_BASE_OR_SCOPE`

FAILしたsuffixとevidence setはburnする。同じsuffixの再実行、上書き、後付け修理を禁止する。

## 13. protected scope

次はpathname/mode/blob/Git stateだけを確認し、内容を開く、読む、diff、copy、stage、modifyしない。

- `src/components/estimates/wizard/screens/ScreensPreview.tsx` — blob `c1eb0dc88954f3a17cc85e313b62d5bb6a4fda3f`
- `supabase/migrations/20260801110110_line_link_tokens.sql` — blob `accd22345054cc44f89156fd78eaba6dfe4242a4`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql` — blob `32fda49583ae1217bc13711784ad8fa31744726c`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts` — blob `fe3c80f22fd80dcbfab076082473216dda582c14`

## 14. 次のゲート

1. Codexが本計画とR5 harness実装指示書のexact two-document diffを静的検証する。
2. ownerが2文書のliteral-path stage/local commitを別承認する。
3. ownerが通常pushを別承認する。
4. ownerが非公開文書のClaude送信とseven-path harness実装を別承認する。
5. Codexが未コミットharness候補を静的受入する。
6. harnessのstage、commit、pushをそれぞれ別承認する。
7. ownerがfresh suffixによる1回限りのruntime実行を別承認する。
8. R5 PASS後、Development read-only migration-history preflightへ進む。
9. Development migration applyと日本郵便実CSV importは、それぞれ独立承認する。
