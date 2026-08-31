# GYEON商品発注 V3 C5 外部権威設計・影響調査

| 項目 | 内容 |
|---|---|
| 文書ID | `GYEON-ORDER-V3-C5-EXTERNAL-AUTHORITY-DESIGN-R1` |
| 状態 | `C5-A_COMMITTED_LOCAL_NOT_PUSHED / C5-B_GOVERNANCE_CANDIDATE_UNCOMMITTED / STRIPE_PROVIDER_OWNER_RATIFIED_DOCUMENTATION_CANDIDATE_UNCOMMITTED` |
| 作成日 | 2026-08-27 |
| 基準commit | `d1f8ef9e94c3a7ea4ed5003489c9098b6327918a` |
| 前提 | C4 DB foundation pass、release blocked by external authority |
| 実施範囲 | 読み取り調査、責任分界、接続方式、競合試験、段階別allowlistの設計 |
| 非実施 | 本番ソース変更、SQL変更、migration昇格・適用、外部API接続、stage、commit、push、Ready、merge、deploy |

## 1. 結論

C4で作成したDB基礎は再利用できるが、現状のまま商品発注を公開してはならない。資格判定とサーバー再価格計算が意図的にfail-closedであり、カード、PayPay銀行、倉庫解放、Office AZ在庫予約の権威証跡も実運用へ接続されていない。

C5以降は、外部APIをPostgreSQLトランザクション内から直接呼ばない。DealerOSのサーバー処理が外部権威へ問い合わせ、結果を改ざん不能なサーバー証跡として保存し、その証跡IDを短いDBトランザクションで検証・消費する二段階方式を正式候補とする。

次の4原則を固定する。

1. ブラウザの成功フラグ、金額、資格判定、在庫数、支払状態を信用しない。
2. 外部通信中に注文行ロックを保持しない。
3. 証跡は注文、店舗、金額、通貨、注文version、要求fingerprintへ結び付け、別注文へ転用できなくする。
4. 外部処理失敗、応答不明、version競合では元注文と元与信を維持し、倉庫へ流さない。

## 2. 調査結果

### 2.1 再利用できる基礎

- 集約statusは `draft / submitted / approved / fulfilling / fulfilled / cancelled` の6つに分離済み。
- ownerだけが最終発注でき、manager／staffは確認依頼までというRPC境界がある。
- 商品・価格・税・送料・供給はserver-owned authorityから再計算する設計になっている。
- `gyeon_order_supply_projection` はOffice AZ在庫の読み取り投影であり、DealerOS在庫へ所有権を移さない。
- 倉庫営業日は日別の `normal / closed / exceptional / shortened` と締切時刻で管理し、曜日固定を持たない。
- payment evidence、idempotency ledger、owner review event、notification outbox、warehouse taskの基礎テーブルがある。
- C4でpgTAP 48/48、real Auth 9/9、core separate-session 4/4が通過している。

### 2.2 現在のrelease blocker

| 領域 | 現状 | 判定 |
|---|---|---|
| 初回資格 | `rules_snapshot.qualification_verified` が文字列 `true` かだけを確認し、未接続時は `QUALIFICATION_AUTHORITY_NOT_CONFIGURED` で停止 | クライアント由来になり得るため正本として不可。停止動作は維持する |
| 注文編集 | `SERVER_REPRICE_EDIT_ADAPTER_NOT_CONFIGURED` で常に停止 | 正しいfail-closed。二段階再価格・再与信が必要 |
| カード | 採用PSPはStripeに確定したが、Stripe adapter／API version／失効／消費／Webhook契約がない | Stripe公式契約確認後に別ゲートで接続 |
| 銀行振込 | `payment_pending` までは表現できるが、PayPay銀行webhook・照合・重複防止がない | provider公式契約待ち。推測実装禁止 |
| 倉庫キュー | 現行SQLは倉庫受付RPCの中で初めてtaskを作る | 正式仕様と逆。支払解放時に `unaccepted` taskを先に作る |
| 在庫 | Office AZ読み取り投影はあるが、注文引当／解放の正本APIがない | 数量表示だけで販売確定してはならない |
| 通知 | outboxの器はあるが、配信worker、再送、dead-letter、宛先正本が未接続 | ベル正本とメール配送を分離して実装 |

### 2.3 既存機能を流用してはいけない箇所

- 既存 `payments` は顧客向け請求・入金管理であり、GYEON商品発注のPSP与信またはPayPay銀行入金通知の正本ではない。
- 既存LINE webhookは署名検証された外部webhookの実装例としてだけ参照できる。PayPay銀行固有の署名、再送、event ID、応答規則を代用してはならない。
- `dealer_stock_levels` は取扱店ローカル在庫であり、GYEON Japanから販売するOffice AZ在庫の正本ではない。
- pure TypeScriptの `evaluateInitialQualification` は業務計算契約であり、発送・返品履歴そのものの正本ではない。

## 3. 権威所有マトリクス

| 事実 | 正本所有者 | DealerOSへ保存するもの | ブラウザ入力 |
|---|---|---|---|
| 商品・ランク別価格 | Office AZ商品管理 | version付きoffer投影と注文時snapshot | 商品ID・数量のみ |
| 正式在庫・引当・棚卸待ち・発注可能数 | Office AZ inventory | version付き供給投影、予約証跡ID | 不可 |
| 初回／upgrade資格 | DealerOS server business authority | 対象mode、rule version、発送・返品fact、判定snapshot | 不可 |
| カード与信 | Stripe | provider event、amount、currency、order version、fingerprintを結ぶ証跡 | Stripeがtoken化したprovider入力だけ |
| 銀行入金 | PayPay銀行＋DealerOS照合worker | immutable webhook inbox、照合結果、注文への一意割当 | 不可 |
| 代引 | DealerOS注文契約＋倉庫発送実績 | 初回代引回収対象額snapshot、後送分再請求禁止fact | 支払方式の選択のみ |
| 掛け売り | スーパーアドミン設定＋月次請求authority | 有効なterms version、発送済み数量、請求書snapshot | 不可 |
| 倉庫営業日・締切 | スーパーアドミン | 日別version付きcalendar | 不可 |
| 倉庫受付・作業 | 倉庫service | 消えないtask、task version、受付者・日時 | dealer browserから不可 |
| ベル通知 | DealerOS notification store | dealer-scoped通知レコード | 不可 |
| メール配信 | 採用メールprovider | outbox、attempt、provider reference、delivery result | 不可 |

## 4. 共通の外部証跡契約

既存 `gyeon_order_payment_evidence` は基礎として使えるが、少なくとも次を追加または別のappend-only event表で保持する必要がある。

- `purpose`: `initial_authorization / edit_reauthorization / bank_payment_match / void / capture`
- `provider` と `provider_event_id`。provider内で一意にする。
- `order_id / dealer_id / order_version`
- canonical request `fingerprint`
- `amount_inc_tax_yen / currency`
- `state` と `server_verified_at`
- `expires_at`。有効期限のない証跡として扱わない。
- `consumed_at / consumed_by_operation`。同じ成功証跡を二重利用しない。
- raw payloadそのものではなく、必要最小限の正規化値とpayload hash。秘密・カード番号・銀行認証情報を保存しない。

DBのfinalize RPCは次をすべて満たす証跡だけを採用する。

1. service-owned経路で作成されている。
2. 注文、店舗、目的、金額、通貨、注文version、fingerprintが完全一致する。
3. success状態で、期限内、未消費である。
4. provider event IDが過去に別処理へ割り当てられていない。
5. 注文行ロック取得後にも注文versionが一致する。

## 5. 資格authority

### 5.1 正式な判定材料

- 店舗ごとにスーパーアドミンが設定したqualification mode。
- version付きqualification rule。
- 商品master側のserver-owned分類: `eligible_chemical / required_detailer_product / optional_matt / other`。
- 現在注文の正本offerから取得した値引前税別定価と数量。
- 過去の発送済み数量と返品済み数量から導出する「発送済み・未返品」fact。

現在のoffer表にはqualification分類がないため、商品masterまたは専用version付き分類表が必要である。クライアントや注文snapshot内の自由な文字列を分類正本にしてはならない。

### 5.2 判定時点

1. カート／draft保存時: 仮達成状況を表示する。
2. owner submit時: 同じserver authorityで再計算し、未達なら拒否する。
3. 発送完了時: 正式達成factを記録する。
4. 発送後返品時: 発送済み・未返品履歴を再計算し、必要なら `recheck_required` へ移す。

`rules_snapshot ->> 'qualification_verified'` のboolean文字列は廃止候補とし、`qualification_authority_id / rule_version / evaluated_at / input_fingerprint / provisional_decision` の参照へ置き換える。

## 6. カード決済と注文編集

### 6.0 Stripe provider決定と未接続境界

- オーナーは採用カードPSPをStripeに確定した。接続対象はStripe PaymentsのPaymentIntents APIを正式候補とする。
- Stripe口座は取得済みだが、口座ID、APIキー、Webhook secretその他の秘密情報は本リポジトリへ記録しない。
- この決定はprovider選定だけであり、Stripe SDK、API呼び出し、PaymentIntent作成、与信、売上確定、取消、返金、Webhook route、環境変数、DB変更、sandbox、staging、production接続を許可しない。
- 正確なAPI version、IC+契約、複数回売上確定機能の有効化、利用可能ブランド、与信期限、再送、event finality、照合方法は `NOT_CONFIGURED` とする。
- バックオーダー分割発送の業務契約は「各発送の確定済み税込支払額を発送ごとに売上確定し、売上確定回数を正本の発送回数と一致させ、累計額を当初承認額以下に保つ」とする。
- 公開Stripe文書では複数回売上確定はIC+料金体系の機能で有効化確認が必要であり、日本のJCBは対象地域外である。したがって公式回答まではカード決済と `ship_available_first` の組み合わせをfail-closedで停止する。
- 与信期限切れ、ブランド非対応、複数回売上確定不可時の代替契約は未確定であり、支払方法変更、一括売上確定、再与信、発送方針変更を自動決定しない。

### 6.1 owner最終発注

1. Server Actionがsession、dealer、owner roleを確認する。
2. prepare RPCが注文version、商品、価格、送料、資格、供給、配送、同意を再計算し、canonical fingerprintと支払額を返す。
3. DBトランザクションを終了する。
4. サーバーがPSPへ与信を要求する。
5. PSP成功結果を、注文version・fingerprint・金額へ結んだ証跡として保存する。
6. finalize submit RPCが注文をロックし、証跡を検証・消費して `submitted` へ遷移する。
7. version競合時は注文を変更せず、新規与信の取消をcompensation outboxへ登録する。

### 6.2 倉庫受付前の金額変更

1. prepare edit RPCが置換行をserver repricingし、旧額、新額、注文version、edit fingerprintを返す。
2. 金額が同一ならPSP再与信なしでfinalize可能。
3. 金額が変わるカード注文は、DBロック外で新額の与信を取得する。
4. finalize edit RPCがversionと証跡を確認し、注文・明細・新証跡消費を一つのtransactionでcommitする。
5. commit後に旧与信取消をoutbox処理する。
6. 新与信失敗、応答不明、finalize競合では元注文・元明細・元与信・versionを維持する。

PSPへ通信している間にDBロックを保持する実装と、「先に旧与信を解除してから新与信を試す」実装は禁止する。

## 7. PayPay銀行・前払い照合

### 7.1 provider契約確定前

公式の認証方式、署名対象、event ID、再送、IP制限、応答期限、照会API、sandboxが確定するまでrouteを実装しない。UIとDBは `payment_pending / on_hold / paid` を表現できる状態に留める。

### 7.2 接続後の処理

1. 専用route handlerがraw bodyで署名を検証する。
2. provider event IDを一意キーにimmutable webhook inboxへ保存し、再送を冪等に受ける。
3. workerが銀行取引ID、振込先識別、注文参照、金額、未使用状態を照合する。
4. 完全一致1件だけを `paid` evidenceへ昇格する。
5. 不足、過入金、重複、名義相違、対象不明、複数候補は `on_hold` とし、倉庫taskを作らない。
6. exact matchのtransactionでpayment status更新、warehouse release判定、task作成、通知outboxを原子的に行う。

通知受信だけで `paid` にしない。既存の顧客向け `payments` へ直接INSERTして照合済み扱いにしない。

## 8. 倉庫キューと支払解放

正式仕様では、倉庫taskは「倉庫受付時」ではなく「倉庫へ送れる条件が揃った時」に `unaccepted` で作成する。

| 支払方式 | task作成条件 |
|---|---|
| カード | owner submit済み＋有効なカード与信証跡 |
| 銀行振込・前払い | owner submit済み＋exact match済み入金証跡 |
| 代引 | owner submit済み。顧客直送は禁止 |
| 掛け売り | owner submit済み＋有効な掛け売りterms version |

`accept_gyeon_order_v3_warehouse_rpc` は既存taskをロックし、`unaccepted -> accepted` と注文 `submitted -> approved` を同一transactionで行う。受付RPCの中でtaskを初めてINSERTする現行候補は変更が必要である。

支払解放時も、供給authority、バックオーダー方針、最短発送可能日を再検証する。ベル通知は注意喚起であり、warehouse taskが作業正本である。

## 9. Office AZ在庫・予約

Office AZを唯一の在庫所有者として維持する。DealerOSには読み取り投影と注文時snapshotだけを持たせる。

公開前に次のどちらか一つを正式決定する必要がある。

- 同一DB authority方式: Office AZの予約RPCが商品を決定順でロックし、引当／BOを原子的に記録する。
- 別system authority方式: Office AZ予約APIがidempotency key、注文fingerprint、source versionを受け、予約証跡を返す。DealerOS finalizeはその証跡だけを採用する。

同期された `orderable_qty` の表示だけで予約成功とみなしてはならない。予約失敗、source version競合、timeoutは注文確定または倉庫解放を停止する。取消・編集・期限切れには対応する引当解放契約が必要である。

## 10. カレンダーと通知

- 最短発送可能日は、支払成立時刻、在庫準備日、日別締切、日別calendarからサーバーで算定する。
- calendar未登録を土日休業や翌営業日へ推測変換しない。
- calendar変更は影響注文を再計算し、日付が変わった注文だけにbell＋email outboxを1組作る。
- ベル通知のDB正本と、メールproviderへの配送attemptを分ける。
- email失敗はベル通知や注文状態を巻き戻さず、再送可能なdelivery failureとして残す。
- 通知先メールの正本と追加権限は正式仕様で未確定のため、C5で固定しない。

## 11. 競合試験

外部adapter接続後は、新しい使い捨て環境で次を独立DB接続とprovider stubを使って実行する。

1. 同一owner submitを同時実行し、注文・証跡消費・倉庫task・通知が各1件だけになる。
2. owner cancelとwarehouse acceptの競合で一方だけがcommitする。
3. warehouse accept二重実行でtaskと注文versionが一度だけ進む。
4. 同じedit tokenへの再与信成功と失敗が競合しても、失敗側が元注文を壊さない。
5. PSP成功後に注文versionが変わった場合、注文は不変で新与信取消outboxが1件だけできる。
6. 同じPayPay銀行eventの再送で入金証跡とwarehouse taskが重複しない。
7. 同じ銀行取引IDを2注文へ割り当てられない。
8. inventory reservationとcancel／editが競合して負在庫、二重引当、解放漏れを起こさない。
9. qualification fulfillmentとreturnが競合して資格履歴が矛盾しない。

合格条件は、別backend PID、唯一のwinner、canonical replay、重複なし、元状態保持、deadlockなしを生の証拠で確認することとする。

## 12. 推奨実装フェーズ

一度に全接続しない。次の順番なら、各障害の原因を分離できる。

### C5-A: server authority contract

- pure type／contract test
- evidence envelope、prepare/finalize、qualification fact、warehouse releaseの型
- 外部通信なし、SQL変更なし

### C5-B: DB source-only candidate

- qualification authority
- evidence強化
- prepare/finalize RPC
- warehouse task作成時点の修正
- provider adapterはstubのみ
- `DRAFT_DO_NOT_APPLY` を維持

### C5-C: disposable DB acceptance

- migration replay、pgTAP、real Auth、RLS、別接続race、provider stub failure
- C4でNOT_RUNだった4 raceを必須化

### C5-D: Office AZ inventory authority connection

- 予約・解放・version・idempotency契約
- DealerOSは投影consumerのまま

### C5-E: provider connection

- Stripeの公式contract、正確なAPI version、IC+／複数回売上確定の有効化、利用可能ブランド、与信期限
- PayPay銀行の公式contract
- secret management、signature、replay、timeout、reconciliation
- provider sandbox E2E

### C5-F: runtime／UI binding

- 既存R1 UIを変更せずserver stateへ接続
- loading、pending、on_hold、failure、retryを実データへ結合
- 24画面のレスポンシブ受入は別ゲート

## 13. 提案allowlist

次の実装ゲートでは、承認された段階のliteral pathだけを使う。最初のC5-A候補は以下に限定する。

1. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`
2. `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts`
3. `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts`

C5-Aでは既存C4 SQL、migration、UI、payments、inventory実装を変更しない。C5-B以降のallowlistはC5-A受入後に別途提示する。

C5-Bのsource-only候補は次の3パスに限定する。

1. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
2. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
3. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

このallowlistはprovider実接続、通常migration生成、Supabase接続、DB実行、UI変更、Office AZ在庫実装を含まない。C5-BのSQLは `DRAFT_DO_NOT_APPLY` と末尾 `ROLLBACK` を維持する。

## 14. 未確定で停止する項目

次はユーザー決定またはprovider公式契約が得られるまで推測実装しない。

1. Stripe Payments / PaymentIntents APIの正確なversionと、与信・売上確定・取消・返金・webhookの公式契約。
2. BO分割発送で必要な複数回売上確定のStripe口座上の有効化、日本で利用するカードブランド対応、与信期限切れ時の代替契約。売上確定額と回数の業務契約自体は確定済み。
3. PayPay銀行APIの署名、event ID、再送、照会、sandbox契約。
4. Office AZ在庫authorityが同一DBか別systemか、および予約APIの所有者。
5. 通知先メールの正本、件数、追加権限。
6. 倉庫未受付の再通知間隔と管理者エスカレーション時間。

これらが未確定でも、C5-Aのpure contractとC5-Bのfail-closed DB骨格までは作成できる。ただしprovider実接続とproduction releaseはできない。

## 15. 最終判定

`C5_DESIGN_GATE = PASS`

`C5_A_SOURCE_CANDIDATE = PASS`

`C5_B_GOVERNANCE_CANDIDATE = UNCOMMITTED`

`C5_B_DB_SOURCE_IMPLEMENTATION = NOT_STARTED`

`PRODUCTION_RELEASE = BLOCKED_BY_EXTERNAL_AUTHORITY`

次に進める最小リスクの作業は、C5-A候補を受け入れた後、別承認でC5-BのDB source-only候補を作ることである。stage、commit、push、migration適用、外部送信は別承認とする。

## 16. C5-A実施結果

ユーザーの明示承認後、13章の3ファイルallowlist内だけでpure contract候補を作成した。

| 項目 | 結果 |
|---|---|
| 新規pure contract | `src/lib/product-orders/gyeon-order-v3-external-authority-core.ts` |
| 新規契約テスト | `src/lib/product-orders/gyeon-order-v3-external-authority-core.test.ts` |
| 新規テスト | 19/19 PASS |
| 既存V3 pure contractとの合算 | 40/40 PASS |
| 対象2ファイルstrict typecheck | PASS |
| SQL／migration／Supabase接続 | 変更・実行なし |
| PSP／銀行／在庫／メール通信 | なし |
| stage／commit／push | commit `a3da60d662bc8da7ad09f17740fc7975dd917f35`／push未実施 |

作業worktreeには依存関係をインストールせず、主checkoutに固定済みのTypeScript 5.9.3とtsx 4.23.1 runtimeを読み取り利用した。packageおよびlockfileは変更していない。

## 17. C5-B統治候補

2026-08-27、オーナーはC5-Bへ進む意思を明示した。ただし正本計画には商品発注の凍結規則、別の最新記録フェーズ、C5-B allowlist未登録が残っていたため、ソース実装前に統治同期を行う。

統治候補の変更対象は次の3文書だけとする。

1. `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md`
2. `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`
3. `docs/integrations/gyeon-order/v3-c5-external-authority-design-and-impact.md`

この候補は、C5-BをGYEONサービス提供に必要な商品調達の安全性依存として限定的に記録する。GYEON DA完成優先、Office AZ在庫のStudio所有、外部provider未確定時のfail-closed、audit／implementation／verification／commit／push／DB適用の分離は変更しない。

統治候補のオーナー受入とローカルcommit後、C5-A commitのpushおよびDraft PR作成は別承認とする。Draft PR上に最新のClaude向けread-only診断指示が存在するまで、C5-B source実装を開始しない。
