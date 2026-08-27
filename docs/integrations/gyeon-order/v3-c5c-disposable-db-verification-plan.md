# GYEON取扱店向け商品発注 V3 — C5-C使い捨てDB検証計画

## 1. 文書情報

- 計画ID: `GYEON-ORDER-V3-C5-C-R1-DISPOSABLE-DB-ACCEPTANCE-PLAN`
- 対象branch: `agent/gyeon-order-v3-c5-external-authority-design`
- 対象commit: `1ae0f7e91f3889ea08c894bcb589bb35a15303ec`
- 対象tree: `a6f7fde6b4b9b8c15689ccd5124f17632c6e9f92`
- 対象SQL: `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- SQL状態: `DRAFT_DO_NOT_APPLY / terminal ROLLBACK`
- 調査日: 2026-08-28
- 現在状態: `PLAN_ONLY / NOT_EXECUTED`

この文書はDB実行権限ではない。C5-Cは、読取専用診断、検証資産実装、静的受入、使い捨てDB実行、ソース修正、commit、push、migration昇格、環境適用を別ゲートとして扱う。

## 2. 結論

C5-Cは、C5-BのSQLが「書かれている」ことではなく、次の6点を生の実行証拠で証明する。

1. **再現性**: 正式migration連鎖とC5-B派生SQLが、fresh PostgreSQL 17で一度に成立する。
2. **認可**: 本物のローカルAuth tokenを使い、owner／staff／readonly／別店舗／無効membershipの境界がPostgREST request scopeで成立する。
3. **外部証跡**: 証跡が目的・provider event・店舗・注文・version・fingerprint・金額・通貨・期限へ拘束され、一度だけ消費される。
4. **資格正本**: 資格modeをクライアントが指定できず、Office AZ所有のversion付き投影だけで判定し、未設定・古い・異常はfail-closedになる。
5. **状態保全**: stale/version/fingerprint競合時に元注文と元与信を壊さず、新与信取消intentだけを1件保存する。
6. **競合安全性**: 本当に別のDB接続を同時実行し、二重finalize、二重証跡消費、二重補償、二重倉庫taskを防ぐ。

どれか1つでも未実施・skip・todo・`NOTESTS`ならPASSにしない。

## 3. 現行C5-Bで固定する契約

### 3.1 外部証跡purpose

C5-Cで有効なpurposeは次の4つだけである。

- `initial_authorization`
- `edit_reauthorization`
- `bank_payment_match`
- `inventory_reservation`

`void`と`capture`は将来のprovider operationであり、C5-Cのevidence purposeへ追加しない。

### 3.2 資格authority

- qualification modeは公開RPC引数に存在してはならない。
- Office AZ所有の`gyeon_dealer_qualification_mode_projection`が唯一のmode正本である。
- 商品分類はOffice AZ所有のversion付き投影だけを使用する。
- seed、既定mode、rank/historyからの推測、ブラウザwriter、MacBook authoring RPCを設けない。
- `shop_to_detailer`は、発送済み・未返品履歴authorityがない間は成功させない。

### 3.3 durable compensation

新しいカード与信成功後に注文versionまたはfingerprintが競合した場合は、例外でtransactionを巻き戻さない。

- 元注文を変更しない。
- 元の既存与信を変更しない。
- `void_new_card_authorization` intentを一意に1件だけinsertする。
- `ok: false`の通常JSONを返す。
- 同じ競合のreplay／同時実行で2件目を作らない。

### 3.4 倉庫task

- 支払・供給・予約／BO・営業日authorityが揃ったservice-only releaseで、`unaccepted` taskを一度だけ作る。
- dealer browserはrelease／acceptできない。
- warehouse acceptは既存taskをlockして消費し、taskを初回insertしない。

## 4. 最新Supabase仕様の影響

2026-08-28時点の公式仕様を前提にする。

- local stackは開発専用で、外部公開しない。
- self-hostedの既定Postgresは17へ移行済みのため、C5-CもPostgreSQL 17を固定する。
- 2026-06-30以降のSupabase client系はNode.js 20を対象外としているため、Auth/PostgREST harnessはNode.js 22以上を使用し、実versionを証拠化する。
- public tableのData API自動露出は環境設定により異なる。RLSとGRANTを別々に検証する。
- public tableはRLSだけでなく不要なanon/authenticated GRANTをrevokeする。
- `SECURITY DEFINER`は既定PUBLIC EXECUTEを持つため、全署名でrevoke後に正確なroleだけへgrantする。
- pgTAPは`supabase test db`相当の実行結果を保存し、plan不一致・skip・todo・`NOTESTS`を失格とする。
- extension version明示は非推奨で既定versionが使われるため、version pinを証明条件にしない。実際に読み込まれたextension／Postgres／CLI versionを証拠化する。

## 5. 実行環境契約

### 5.1 runtime場所

fresh suffixごとに次の形式を使う。

```text
/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c5c.<YYYYMMDDTHHMMSSZ-random6>/
```

- Git worktree外であること。
- Colima/Docker containerから読めることを、DB起動前の最小mount probeで確認する。
- `/private/tmp`は過去にcontainerから見えず`NOTESTS`になったため使用しない。
- 既存C4 runtime、C4 evidence、失敗済みsuffixを流用しない。

### 5.2 runtime内容

リポジトリ全体をコピーしない。次だけを複製する。

- `supabase/config.toml`のC5-C専用派生物
- 正式migration連鎖
- C5-B guarded SQLから作る1個のruntime派生SQL
- C5-C検証資産
- 証拠出力先

`ScreensPreview.tsx`およびアプリUI sourceはコピーしない。

### 5.3 接続拒否ガード

全scriptは次を満たさない限り停止する。

- DB/API hostが`127.0.0.1`、`localhost`、`::1`のいずれか。
- URLに`supabase.co`、`supabase.in`、`pooler.supabase`を含まない。
- `.temp/project-ref`やremote linkが存在しない。
- project IDとruntime suffixが一致する。
- `GYEON_ORDER_V3_C5C_DISPOSABLE_CONFIRM`が固定literalと完全一致する。
- source HEAD/tree/SQL SHA-256が計画対象と一致する。

### 5.4 protected migration境界

- `20260801110110_line_link_tokens.sql`はC5-Cのreplay対象外とし、除外をmanifestへ明記する。内容は開かず、LINE objectがruntimeに存在しないことだけを確認する。
- closed finance migrationは変更・個別診断しない。正式migration replayの一部として機械適用し、個別source reviewは行わない。
- DRAFT directory内の他SQLは自動適用しない。C5-B対象SQLだけをhash指定で派生する。

## 6. runtime派生SQL契約

1. 原本SQL SHA-256を記録する。
2. terminal `ROLLBACK`がちょうど1個であることを確認する。
3. runtime内だけで、その1個を`COMMIT`へ置換する。
4. それ以外のbyte差分がないことを機械検証する。
5. 派生SQL SHA-256を記録する。
6. 派生SQLをGit worktreeへ戻さない。

置換数が0または2以上、source hash不一致、追加差分がある場合は`C5C_NOT_STARTED_SOURCE_DRIFT`で停止する。

## 7. 実行フェーズ

### C5C-0: source integrity preflight

- branch、HEAD、tree、upstream、index、worktreeを記録する。
- C5-B 3ファイルとC5-A pure-contract 2ファイルのhashを記録する。
- protected pathはpathname／mode／blob／Git stateだけを記録する。
- Node、Supabase CLI、Colima/Docker、psql、PostgreSQL image versionを記録する。
- C5-B source test `50/50`のcommit provenanceを記録し、C5-Cではsource testを再実行しない。

### C5C-1: fresh runtime and exact replay

- 未使用suffixを作る。
- mount probeを1回だけ行う。
- formal migrationを番号順にreplayし、LINE migrationの明示除外を記録する。
- C5-B runtime派生SQLを最後に1回だけ適用する。
- migrationごとの開始・終了・SQLSTATEとschema fingerprintを保存する。

既存migration失敗は`C5C_BASELINE_BLOCKED`、C5-B派生SQL失敗は`C5C_CHANGES_REQUIRED_SOURCE`とする。同じsuffixで修復・再実行しない。

### C5C-2: pgTAP schema / RLS / grant / function

最低限、次を厳密な集合比較で証明する。

#### Schema

- C5-Bで追加・変更された全table、列、型、NOT NULL、default、CHECK、PK、FK、unique、partial index。
- evidence purposeが正確に4種類だけ。
- provider＋provider_event_id一意性。
- prepared operation kindとpurposeの対応。
- qualification mode／rule／classification／snapshotのversion binding。
- compensation outboxの一意identityとappend-only境界。
- warehouse taskのorder一意性とversion。

#### RLS / GRANT

- 全public tableでRLS enabled。
- anonのtable権限0。
- authenticatedのauthority/evidence/prepared/snapshot/outbox/task直接write権限0。
- authenticatedは自店舗のorder/item SELECTだけ。
- 別店舗、無効dealer、無効／期限外ordering membershipは0行または拒否。
- private helperはbrowserから実行不可。
- dealer RPCは必要なauthenticated roleだけ、release／acceptはservice_roleだけ。
- `auth.role()`、`user_metadata`、`raw_user_meta_data`を認可に使わない。

#### Function

- 全公開／private functionのexact signature、owner、security mode、`search_path = ''`。
- public prepare signatureにqualification mode/result/price/role/evidence-successがない。
- finalize lock順序がprepared operation → order → evidenceで一貫する。
- warehouse acceptにtask insertがない。
- dynamic SQL、外部HTTP、provider callがない。

### C5C-3: real Auth / PostgREST request scope

ローカルGoTrueで署名済みtokenを発行し、少なくとも次のprincipalを作る。

1. Dealer A owner
2. Dealer A manager
3. Dealer A staff
4. Dealer A readonly
5. Dealer A suspended member
6. Dealer B owner
7. dealer membershipなし
8. ordering membership期限切れ

実HTTPで次を証明する。

- ownerだけがowner-submit prepare/finalize、edit prepare/finalize、cancelを呼べる。
- manager/staffはdraft／owner review requestまで。
- readonly、suspended、missing、expiredは拒否。
- Dealer A tokenからDealer B order／itemを読めない。
- authority/evidence/prepared/snapshot/outbox/task tableを直接読書きできない。
- `p_qualification_mode`を送っても公開RPCとして受理されない。
- client price、role、evidence success、provider event、warehouse stateの偽装を受け入れない。

token、password、anon key、service key全文は保存しない。証拠にはrole、HTTP status、redacted principal ID、件数、error codeだけを残す。

### C5C-4: qualification authority contract

- dealer mode投影なし → `qualification_authority_not_configured`。
- 過去投影だけ／明示`STALE` → `qualification_authority_stale`。
- 明示`ERROR`／不正authority → `qualification_authority_error`。
- `CONFIGURED:none` → qualification snapshotを作り、client modeなしで進む。
- `shop_initial` → 値引前税別定価、販促品除外、指定thresholdで判定。
- `detailer_initial` → 必須商品不足を返し、MATT任意・算入外を維持。
- 商品分類欠落または古い分類 → fail-closed。
- `shop_to_detailer` → 履歴authority未接続としてfail-closed。
- snapshotがorder/version、mode projection version、rule version、classification version、input fingerprintへ結合される。

同じ注文内で複数classification versionが混在する場合の正式挙動はClaude read-only診断で必ず確認する。単一versionへ統一できない設計なら、C5-C実行前にsource repairへ戻す。

### C5C-5: evidence / prepare / finalize contract

#### Evidence

- service-owned successful evidenceだけを受理する。
- 4purposeごとにbindingを検証する。
- provider event再送は同じcanonical evidenceだけ。
- 別注文・別version・別fingerprint・別金額・別通貨・別purposeは拒否。
- expired、failed、unknown、consumedを区別する。
- consumed evidenceの再利用を拒否する。

#### Owner submit

- prepareはserver値を再計算し、短いtransactionでprepared operationを作る。
- provider処理はDB transaction外である。
- finalizeはcurrent fingerprintとversionを再確認し、evidenceを一度だけ消費する。
- provider failure／unknownではorder、prepared operation、warehouse taskを誤って進めない。

#### Pre-warehouse edit

- 金額不変editと金額変更editを分ける。
- card金額変更は`edit_reauthorization` evidenceが必要。
- 再与信失敗は元注文・元与信・versionを維持する。

#### Compensation

- 新与信成功後のversion／fingerprint conflictは通常JSON failureを返す。
- exception rollbackでintentを失わない。
- original order／original authorizationは不変。
- `void_new_card_authorization` intentは1件だけ。

### C5C-6: warehouse release and acceptance

- bank transferは`bank_payment_match`未消費／不一致ではreleaseしない。
- inventoryは`inventory_reservation`未消費／不一致ではreleaseしない。
- card、COD、credit accountのpayment readinessを支払契約どおり確認する。
- supply projectionが`NOT_CONFIGURED`／`STALE`／`ERROR`ならreleaseしない。
- backorder policyとwarehouse calendar未設定はfail-closed。
- 土曜日を固定休業日にしない。
- release replay／同時実行でも`unaccepted` taskは1件。
- acceptはexpected order versionとtask versionの両方を要求する。
- taskがない／accepted済み／version不一致を区別し、orderを誤更新しない。

### C5C-7: genuine separate-connection concurrency

各raceは2つの独立OS `psql` processと第3observer connectionで行い、distinct backend PIDを保存する。

1. 同じprovider eventの同時evidence insert。
2. 同じprepared operation＋同じevidenceのowner finalize二重実行。
3. finalizeと別editによるorder version競合。
4. 同一新与信に対するcompensation intent二重生成競合。
5. edit finalize成功と失敗／stale finalizeの競合。
6. warehouse release二重実行。
7. warehouse accept二重実行。
8. cancelとwarehouse release／acceptの競合。

合格条件:

- backend PIDが別で同時にactive。
- canonical winnerが1つ。
- evidence消費、prepared消費、compensation intent、warehouse task、notificationに重複なし。
- original-state preservation。
- deadlock、lost update、負数量、orphan prepared/evidence消費なし。
- timeout時も結果を推測せず`UNKNOWN`として失格にする。

### C5C-8: advisors / query plans / evidence

- local DB lint/advisorをerror thresholdで実行する。
- qualification projection、classification join、prepared/evidence lookup、warehouse task lookupの`EXPLAIN (ANALYZE, BUFFERS)`を取得する。
- index利用だけでなくfixture件数とcostを記録する。
- evidence manifestへ全command、exit code、test plan/count、hash、cleanup結果を保存する。

### C5C-9: cleanup

- fixtureを依存順に削除し、残存件数0を第三接続で確認する。
- exact project IDのlocal stackだけを停止する。
- exact runtime pathだけを削除する。globや親directory削除は禁止。
- cleanup失敗はC5-C失敗であり、合格へ繰り上げない。
- raw evidenceは保持し、secret scanをPASSさせる。

## 8. 必須証拠

```text
manifest.json
versions.txt
source-hashes.sha256
runtime-derived-hashes.sha256
migration-replay.ndjson
schema-fingerprint.json
pgtap.tap
real-auth-results.ndjson
qualification-results.ndjson
evidence-prepare-finalize-results.ndjson
warehouse-results.ndjson
concurrency-results.ndjson
backend-pids.ndjson
advisors.txt
query-plans.txt
secret-scan.txt
cleanup.log
summary.json
summary.md
```

`summary`だけでは合格判定しない。Codexはraw assertion、PID、SQLSTATE、件数、hash、cleanupを直接確認する。

## 9. 合否分類

### `C5C_DISPOSABLE_DB_PASS`

- replay、pgTAP、real Auth、qualification、evidence、prepare/finalize、compensation、warehouse、concurrency、advisor、cleanupが全件PASS。
- skip、todo、`NOTESTS`、unknown、secret leakが0。
- repository/protected metadataが不変。

### `C5C_CHANGES_REQUIRED_SOURCE`

SQL構文、constraint、RLS、GRANT、function、qualification version、evidence consumption、compensation durability、warehouse timing、競合安全性の欠陥。

同じsuffixでsourceを修正しない。suffixと証拠をburnし、別のC5-B source-repair gateへ戻る。

### `C5C_BLOCKED_ENVIRONMENT`

Colima/Docker mount、CLI、baseline migration、PostgreSQL client、port、runtime権限など、C5-B source以外の要因で検証不能。

未実施項目をPASSにせず、同じsuffixを再利用しない。別承認後にfresh suffixで再試行する。

### `C5C_SCOPE_OR_AUTHORITY_CONFLICT`

Office AZ inventory実装、provider仕様、qualification履歴正本、保護対象、linked project接続が必要になった場合。推測実装せず停止する。

## 10. 停止条件

次の1件でも発生した時点で停止する。

- loopback以外のhostまたはlinked projectを検出。
- source commit/tree/hash不一致。
- runtime derivativeがterminal guard以外を変更。
- baseline replayまたはC5-B SQL適用失敗。
- pgTAP plan不一致、skip、todo、`NOTESTS`。
- real tokenを使わない認可代替。
- concurrency PIDが同一、逐次実行、観測接続なし。
- assertion failure、unknown external result、cleanup failure。
- token、password、secret key、raw provider payloadのログ出力。
- allowlist外source defectまたはOffice AZ inventory実装要求。

## 11. 読取専用診断の確認項目

Claudeは実装・テスト前に、現在のSQLとC4 harnessを読取専用で調べ、次を返す。

1. C5-B object／function／signature／lock順序の完全一覧。
2. C4 harnessで再利用できる構造と、変更せず参照だけにすべき部分。
3. C5-Cで新規作成すべき正確な検証資産allowlist。
4. fixture dependency／cleanup順序。
5. success pathに必要なserver-owned fixtureだけの一覧。
6. classification version混在、prepared expiry、normal-JSON compensation、warehouse releaseに関するsource defect候補。
7. 各raceの2接続SQL手順とobserver assertion。
8. C5-C実行前にsource repairが必要かの判定。

## 12. 後続の実行資産候補allowlist

読取専用診断で過不足を確定するまで実装しない。現時点の候補は次の10パスだけである。

1. `scripts/e2e/gyeon-order-v3-c5c/config.toml`
2. `scripts/e2e/gyeon-order-v3-c5c/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c5c/schema-rls.test.sql`
4. `scripts/e2e/gyeon-order-v3-c5c/qualification-evidence.test.sql`
5. `scripts/e2e/gyeon-order-v3-c5c/prepare-finalize-warehouse.test.sql`
6. `scripts/e2e/gyeon-order-v3-c5c/real-auth.mjs`
7. `scripts/e2e/gyeon-order-v3-c5c/concurrency.mjs`
8. `scripts/e2e/gyeon-order-v3-c5c/capture-evidence.sh`
9. `scripts/e2e/gyeon-order-v3-c5c/cleanup.sh`
10. `docs/integrations/gyeon-order/v3-c5c-disposable-db-verification-result.md`

既存C4資産はaccepted evidenceとして変更しない。C5-C資産から参照・比較はできるが、コピー元の契約を黙って変更しない。

## 13. 次のゲート

1. この計画を含む4文書の未コミット差分をCodexが検証する。
2. ownerが4文書のstage／local commitを別途承認する。
3. ownerがpushを別途承認する。
4. CodexがDraft PR #36へClaude read-only診断指示を投稿する。
5. Claude診断をCodexが受入れ、10パス候補を確定または縮小する。
6. harness実装、静的検証、disposable DB実行をそれぞれ別承認にする。

C5-C合格後も、正式migration昇格、Dev-Next／production適用、provider接続、Ready、merge、deployは未承認のままである。
