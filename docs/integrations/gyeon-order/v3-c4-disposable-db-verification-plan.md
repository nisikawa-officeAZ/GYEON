# GYEON取扱店向け商品発注 V3 — C4使い捨てDB検証計画

## 1. 文書情報

- 計画ID: `GYEON-ORDER-V3-C4-R1-DISPOSABLE-VERIFICATION-PLAN`
- 対象commit: `0b10bee385ea016236df7b92e0783668e934dbfd`
- 対象契約: `GYEON-ORDER-V3-C3-R1`
- 状態: `PLAN_ONLY / NOT_EXECUTED`
- 作成時Supabase CLI: `2.108.0`
- DB接続: 未実施
- migration適用: 未実施
- source変更: この計画書1ファイルのみ

この計画は実行権限ではない。使い捨てDBの作成、Docker/Colima操作、migration replay、SQL実行、テストfixture作成、cleanupは、別の明示承認後に行う。

## 2. 結論

C4は一回の「動いた／動かない」確認ではなく、次の4種類の証明を分離して行う。

1. **Schema証明**: migration連鎖上でSQLが成立し、制約・索引・RLS・GRANT・関数署名が契約どおりである。
2. **認可証明**: 本物のローカルAuth tokenを使い、owner / manager / staff / readonly / 別店舗 / 無効membershipの境界がHTTP request scopeで成立する。
3. **商取引証明**: 価格・供給・資格・送料・決済・カレンダーをクライアントが偽装できず、未設定はfail-closedになる。
4. **競合証明**: 本当に別のDB接続を同時実行し、同じ冪等key、異なるkey、version競合、二重submit、二重倉庫受付で一意性が壊れない。

1つでも未実施ならC4はPASSにしない。静的テストだけ、service roleだけ、同一接続内の疑似並列だけでは認可・競合証明にならない。

## 3. 現時点で判明している重要事項

### 3.1 現在のC3 SQLは正式migrationではない

`supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql` は末尾が `ROLLBACK` であり、source-only設計候補である。C4では原本を変更せず、使い捨てruntime内だけに次の差分を持つ派生SQLを生成する。

- 原本のSHA-256を記録する。
- `ROLLBACK` を `COMMIT` に置換したruntime派生物を作る。
- 置換箇所が1か所だけであることを機械検証する。
- 派生物のSHA-256も記録する。
- 派生物をリポジトリへ戻さない。

### 3.2 現在のC3 SQLには意図的なfail-closed箇所がある

- 初回条件・資格authorityが接続されるまで、最終発注は `QUALIFICATION_AUTHORITY_NOT_CONFIGURED` で止まる。
- カード金額変更の再価格・再与信adapterが接続されるまで、変更処理は `SERVER_REPRICE_EDIT_ADAPTER_NOT_CONFIGURED` で止まる。

C4ではこれらの拒否を「正常なfail-closed」として証明する。一方、正式リリース合格には成功経路も必要なため、C4結果は次のように分ける。

- DB/RLS/RPC基盤が通る: `C4_FOUNDATION_PASS`
- 外部authority未接続で成功経路が未証明: `C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`
- SQL/RLS/RPC自体に欠陥: `C4_CHANGES_REQUIRED_SOURCE`

`C4_FOUNDATION_PASS` を本番適用可と解釈してはならない。

### 3.3 Supabaseの現在仕様による追加確認

- public schemaの新規tableがData APIへ自動公開されない設定があるため、GRANTとData API露出を別々に確認する。
- `SECURITY DEFINER` は既定のEXECUTEを持つため、全署名でPUBLIC/anon/authenticated/service_roleからrevoke後、必要roleだけへ再grantされていることを確認する。
- PostgreSQL 17を検証基準にする。既存のB7-4用PostgreSQL 15テンプレートをそのまま流用しない。
- Supabase CLIは `SUPABASE_TELEMETRY_DISABLED=1` を固定し、ユーザー領域へのテレメトリ書込みを防止する。

## 4. 絶対禁止

- linked Supabase projectへの接続
- 本番・開発・Preview DBへの接続
- `supabase db push`
- `supabase migration up --linked`
- `supabase test db --linked`
- service roleをdealer認可の成功証明に使うこと
- JWT claim文字列のSQL設定だけを「実Auth証明」と呼ぶこと
- 同一DB接続の逐次処理を「競合試験」と呼ぶこと
- 失敗したruntime suffixや証拠ディレクトリの再利用
- 既存migrationの黙った除外
- C4中のsource修正、stage、commit、push
- `ScreensPreview.tsx`のopen/read/diff/copy/stage/modify
- broadな削除、repo全体のstash・restore・cleanup

## 5. 実行環境契約

### 5.1 runtime場所

実行時に未使用のランダムsuffixを生成し、リポジトリ外の明示パスを使用する。

```text
/Users/atsushinishikawa/Documents/Codex/runtime/gyeon-order-v3-c4.<suffix>/
```

この場所はDocker/Colimaから参照できることを事前確認する。`/private/tmp` はvolume可視性問題が起き得るため使用しない。

### 5.2 runtime内容

リポジトリ全体はコピーしない。次だけをruntimeへ複製する。

- `supabase/migrations/` の正式migrationファイル
- C4用の一時 `supabase/config.toml`
- C4用pgTAP、Auth HTTP、競合試験資産
- C3 SQLから生成した適用用派生SQL

保護対象UIとアプリソースはruntimeへコピーしない。

### 5.3 Supabase設定

- `project_id`: `dealeros-gyeon-order-v3-c4-<suffix>`
- PostgreSQL: major version 17
- API/Auth/Storage: enabled
- Realtime/Analytics/Edge Runtime: disabled unlessmigration replayが要求する場合のみ停止して再判断
- ports: runtime専用の未使用port
- seed auto-run: disabled
- remote link state: 存在しないことを検査
- network: runtime専用

### 5.4 接続拒否ガード

全スクリプトは次を満たさなければ起動しない。

- DB hostが `127.0.0.1` / `localhost` / `::1` のいずれか。
- URLに `supabase.co` / `supabase.in` / `pooler.supabase` を含まない。
- `GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM` が固定値と完全一致する。
- runtime project IDとsuffixが一致する。
- `.temp/project-ref`、remote link、production URLが存在しない。

## 6. 実行フェーズ

### C4-0: source integrity preflight

1. branch、HEAD、tree、worktree、indexを記録する。
2. C3の5ファイルhashを記録する。
3. この計画書以外に未commit変更がないことを確認する。
4. 元リポジトリの保護対象はstatusだけ確認し、内容を読まない。
5. Node、Supabase CLI、Docker/Colima、PostgreSQL clientのversionを記録する。

失敗時: `C4_NOT_STARTED_SOURCE_DRIFT`

### C4-1: fresh disposable runtime

1. 未使用suffixと専用runtime directoryを作る。
2. migrationと検証資産だけを複製する。
3. PostgreSQL 17の専用configを生成する。
4. runtimeにremote linkがないことを確認する。
5. 専用project IDでlocal Supabase stackを起動する。

失敗時はsuffixをburnし、同じ場所で再試行しない。

### C4-2: exact baseline migration replay

1. committed migrationを番号順に先頭から適用する。
2. migrationごとの開始・終了・SQLSTATEを保存する。
3. 既存migrationが失敗した場合、勝手に除外しない。
4. baselineが完了して初めてC3派生SQLを適用する。
5. C3派生SQL適用後、schema fingerprintを取得する。

既存migration由来の失敗: `C4_BASELINE_BLOCKED`

C3派生SQL由来の失敗: `C4_CHANGES_REQUIRED_SOURCE`

### C4-3: pgTAP schema / RLS / grant tests

最低限、次をfull-rowまたは厳密な集合差分で検証する。

#### Schema

- 新規11tableの存在、列型、NULL、default、CHECK、PK、FK、unique
- `product_orders`の6状態だけのCHECK
- owner review、payment、backorder、warehouse taskの状態分離
- 4支払方式
- 1点単位制約
- 税別30,000円のversioned shipping rule
- 供給4状態とNULL維持
- 倉庫カレンダー4状態、日付別cutoff
- 参照・RLS列のindex有無

#### RLS / GRANT

- 対象全public tableでRLS enabled
- anonのtable権限0
- authenticatedの直接INSERT/UPDATE/DELETE権限0
- authenticatedの注文SELECTは自店舗だけ
- 別店舗、無効dealer、無効membership、期限外membershipは0行
- authority tableはdealerから直接読めない
- public functionの既定EXECUTEが残っていない
- dealer RPCはauthenticatedのみ
- 倉庫受付RPCはservice_roleのみ
- internal private functionはブラウザから直接実行不可
- `auth.role()`、user-editable metadata認可がない

#### Function

- 全署名、owner、security mode、`search_path = ''`
- 参照relationがschema-qualified
- volatilityと引数defaultが契約どおり
- SQL injection可能なdynamic SQLがない

### C4-4: real Auth / PostgREST request tests

ローカルGoTrueで次の実ユーザーを発行し、署名済みaccess tokenを取得する。

1. dealer A owner
2. dealer A manager
3. dealer A staff
4. dealer A readonly
5. dealer A suspended member
6. dealer B owner
7. dealer membershipなし
8. ordering membership失効

各tokenからData API/RPCへ実HTTP requestを送り、次を証明する。

- Catalog: active 4 roleは自店舗rankの価格だけ。別rankとauthority tableは不可。
- Draft: owner/manager/staff可、readonly不可。
- Review request: manager/staff可。
- Final submit: ownerだけ。manager/staff/readonly不可。
- Cancel: ownerだけ、倉庫受付後は不可。
- Direct table write: 全dealer roleで不可。
- Tenant isolation: dealer A tokenでdealer B注文を読めない。
- Membership: suspended/expired/missing/duplicateは拒否。
- Forgery: SKU、名称、価格、税、送料、status、role、orderable quantityをpayloadへ追加すると拒否。

token全文、service key、passwordは証拠へ保存しない。

### C4-5: business contract tests

#### 価格・送料

- 価格未設定は拒否、0円へ変換しない。
- intentional freeだけ0円を許可。
- 値引前税別定価で送料無料判定。
- 販促品は30,000円判定から除外。
- 販促品単独注文は拒否。
- 数量1、2、3をそのまま採用し、ケース倍数補正しない。

#### 供給・バックオーダー

- `NOT_CONFIGURED` / `STALE` / `ERROR` は発注可能数量を返さず、変更RPCを拒否。
- 正式在庫、予約、棚卸待ち、発注可能数量を別々に保持。
- backorderなしでは発送方針NULLのみ。
- backorderありでは注文全体の発送方針が必須。
- 分割発送でも追加送料を生成しない。

#### 支払・倉庫解放

- card: server-verified authorizationが必要。
- bank transfer prepaid: 入金照合前は倉庫へ流さない。
- COD: 顧客直送不可。
- credit account: activeな掛け売り設定が必須、通常店舗は選択不可。
- 倉庫受付後は商取引変更不可。
- 再与信失敗時は元注文・元与信・versionを保持。

#### カレンダー

- 15:00締切前後。
- closed / exceptional / shortened。
- 土曜日を通常営業・休業の両方で試験し、曜日固定がないことを証明。
- 必要日未登録はfail-closed。
- 日程変更時にbell＋email outboxが1組だけ生成される。

#### 資格

- Shop税別定価100,000円。
- Detailer必須6商品、MATT任意・算入外。
- upgradeは過去の発送済み・未返品履歴を再利用。
- 正式達成はfulfilled後。
- authority未接続は `QUALIFICATION_AUTHORITY_NOT_CONFIGURED`。

### C4-6: separate-connection concurrency

各raceは2つの独立したOS `psql` processと第3の観測接続を使う。両backend PIDが異なることを証拠に残す。

1. 同じdealer・同じkey・同じpayloadのdraft保存
2. 同じdealer・同じkey・異なるpayload
3. 異なるkey・同じorder・同じexpected version
4. owner submitの二重実行
5. owner cancelとwarehouse acceptの競合
6. warehouse acceptの二重実行
7. card再与信成功更新と失敗更新の競合

合格条件:

- 同一key・同一fingerprintは同じcanonical result。
- 同一key・異なるfingerprintは片方を拒否。
- version競合は1件だけcommit。
- 二重注文、二重task、二重通知、二重決済証跡がない。
- deadlock、lost update、負の数量がない。
- failure時も元注文の整合性が保たれる。

### C4-7: advisor / query plan

- Supabase DB advisorsを実行する。
- Catalog listとorder SELECTの `EXPLAIN (ANALYZE, BUFFERS)` を使い捨てfixture上で取得する。
- RLS predicate、membership、offer、order/item join列に必要なindexを確認する。
- sequential scanの存在だけで即失格にせず、fixture件数とcostを含めて判断する。
- lock順序を `idempotency → order → items/task` に統一できているか確認する。
- transaction中に外部HTTP決済・銀行API・メールAPIを呼ばないことを確認する。

### C4-8: evidence and cleanup

証拠ディレクトリへ次を保存する。

```text
manifest.json
versions.txt
source-hashes.sha256
runtime-derived-hashes.sha256
migration-replay.log
schema-fingerprint.json
pgtap.tap
real-auth-results.ndjson
business-contract-results.ndjson
concurrency-results.ndjson
advisors.txt
query-plans.txt
cleanup.log
summary.md
```

cleanupは専用project ID、専用container/volume、専用runtime pathだけを対象にする。cleanup失敗はC4失敗である。証拠は保持し、runtimeとDBは破棄する。

## 7. 合否判定

### `C4_FOUNDATION_PASS`

- baseline replay成功
- C3派生SQL適用成功
- pgTAP全件PASS
- real Auth/RLS全件PASS
- fail-closed business tests全件PASS
- concurrency全件PASS
- cleanup成功
- 外部authority未接続の成功経路だけが明示的に残る

### `C4_RELEASE_BLOCKED_EXTERNAL_AUTHORITY`

基盤はPASSしたが、資格、再与信、在庫同期、銀行入金、通知などの外部authority成功経路が未接続。

### `C4_CHANGES_REQUIRED_SOURCE`

SQL構文、constraint、RLS、GRANT、RPC、冪等性、競合、tenant isolationのいずれかに欠陥がある。

### `C4_BLOCKED_ENVIRONMENT`

Docker/Colima、volume mount、CLI、baseline migrationなど、C3 source以外の環境要因で検証不能。ただし未実施項目をPASSにしない。

## 8. 停止条件

次のいずれかが起きた時点で、そのsuffixの実行を停止する。

- loopback以外のDB URL
- linked project検出
- source hash不一致
- baseline migration失敗
- C3 SQL適用失敗
- pgTAPのplan不一致、NOTESTS、skip、todo
- Auth tokenを使わない代替証明
- concurrency backend PIDが同一
- cleanup対象が一意に特定できない
- secretがログへ出力された

失敗後は同じsuffixを修復・再実行しない。結果を記録し、新しい修正フェーズと新しいsuffixを要求する。

## 9. C4実装時の予定allowlist

実行資産を作る場合は、次の候補だけを別途承認対象にする。現時点では未作成である。

1. `scripts/e2e/gyeon-order-v3-c4/config.toml`
2. `scripts/e2e/gyeon-order-v3-c4/setup.sh`
3. `scripts/e2e/gyeon-order-v3-c4/schema-rls.test.sql`
4. `scripts/e2e/gyeon-order-v3-c4/business-contract.test.sql`
5. `scripts/e2e/gyeon-order-v3-c4/real-auth.mjs`
6. `scripts/e2e/gyeon-order-v3-c4/concurrency.mjs`
7. `scripts/e2e/gyeon-order-v3-c4/capture-evidence.sh`
8. `scripts/e2e/gyeon-order-v3-c4/cleanup.sh`
9. `docs/integrations/gyeon-order/v3-c4-disposable-db-verification-result.md`

allowlist外のsource修正、正式migration作成、stage、commit、push、DB適用は別ゲートとする。

## 10. 次の承認ゲート

次に許可を求める範囲は「上記9パスのC4実行資産をsource-onlyで作成すること」だけである。その段階でもDBは起動・接続・適用しない。

実行資産の静的レビューがPASSした後、さらに別承認で使い捨てDB実行へ進む。
