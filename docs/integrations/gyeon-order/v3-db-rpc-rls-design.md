# GYEON取扱店向け商品発注 V3 — DB / RPC / RLS設計契約

## 1. 文書情報

- 契約ID: `GYEON-ORDER-V3-C3-R1`
- 状態: `SOURCE_ONLY_CANDIDATE`
- 対象: GYEON取扱店向け商品発注のDB境界、RPC境界、RLS境界
- 前提契約: `GYEON-ORDER-V3-C2-PURE-CONTRACT`
- SQLドラフト: `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
- 実行禁止: この段階ではDB接続、migration適用、型生成、本番反映を行わない

この文書は実装候補の設計契約であり、稼働中DBを変更する権限ではない。C4の使い捨てPostgreSQL検証を通過し、別途明示承認された場合のみ、正式migrationへ昇格できる。

## 2. 結論

V3発注は既存の `product_orders` / `product_order_items` を注文集約の正本として拡張する。ただし、ブラウザからの直接 `INSERT` / `UPDATE` / `DELETE` は廃止し、すべての商取引変更をサーバー所有RPCへ集約する。

次の値をクライアント入力として信用しない。

- SKU、商品名、商品価格、税率、割引、送料、合計
- 店舗ランク、発注可能数量、バックオーダー可否、入荷予定
- ユーザー権限、店舗所属、掛け売り可否
- 注文ステータス、オーナー承認状態、決済状態、倉庫受付状態
- 最短発送可能日、倉庫営業日、締切時刻
- 初回登録・アップグレード条件の達成判定

クライアントが送信できる注文行は原則として `product_id` と正の整数 `quantity` のみである。価格・供給・資格・送料・発送日はRPCがサーバー正本から再計算する。

## 3. 既存実装との衝突と移行方針

### 3.1 現行の問題

現行実装には次の衝突がある。

1. `product_orders` / `product_order_items` に店舗メンバー向けの広い直接書込み経路がある。
2. 現行作成処理はクライアント由来のSKU・商品名・価格を受け取り、価格不明を0円へ変換し得る。
3. 注文本体と明細が単一トランザクションではなく、途中失敗による不整合余地がある。
4. 旧V1候補はカード決済のみ、税込定価基準送料、ケース倍数、簡略化された供給モデルなど、V3の正式決定と一致しない。
5. `dealer_stock_levels` は店舗ローカル在庫であり、Office AZの商品供給正本ではない。

### 3.2 移行の原則

- 既存V1ファイルはC3-R1で変更しない。
- V3正式migrationは、C4で既存migration連鎖を再現した使い捨てDB上でのみ検証する。
- 直接書込み権限を切る前に、V3 RPCと呼出元の切替を同じリリース単位で成立させる。
- 既存注文の履歴は削除・上書きしない。新しい列には明示的な互換状態を持たせる。
- 未確定の外部正本は推測して埋めず、`NOT_CONFIGURED` または処理拒否にする。

## 4. 正本と責任分界

| 領域 | DB上の投影・正本 | 書込み主体 | ブラウザ直接書込み |
|---|---|---|---|
| 商用プログラム所属 | `gyeon_ordering_memberships` | service role / 管理処理 | 禁止 |
| 商品・ランク別価格 | `gyeon_product_order_offers_v3` | service role / 商品管理同期 | 禁止 |
| 供給可能数量 | `gyeon_order_supply_projection` | Office AZ在庫同期 | 禁止 |
| 送料無料・送料 | `gyeon_order_shipping_rule_versions` | super admin経由の管理処理 | 禁止 |
| 倉庫営業カレンダー | `gyeon_warehouse_calendar_days` | super admin経由の管理処理 | 禁止 |
| 掛け売り条件 | `gyeon_dealer_credit_terms` | super admin経由の管理処理 | 禁止 |
| 注文集約 | `product_orders` | V3 RPC / 倉庫service | 禁止 |
| 注文明細スナップショット | `product_order_items` | V3 RPC | 禁止 |
| オーナー確認履歴 | `gyeon_order_owner_review_events` | V3 RPC | 禁止 |
| 決済証跡 | `gyeon_order_payment_evidence` | 決済adapter / service role | 禁止 |
| 倉庫作業 | `gyeon_order_warehouse_tasks` | 倉庫service | 禁止 |
| 通知配送要求 | `gyeon_order_notification_outbox` | V3 RPC / 管理処理 | 禁止 |

`gyeon_order_supply_projection` はOffice AZ在庫の所有権をDealerOSへ移すものではない。正式在庫、予約、入荷確認済み・棚卸待ち、発注可能数量を分離した読み取り投影である。正本未接続、古い、矛盾、同期失敗のいずれかでは発注可能数量を0と推測せず、`NOT_CONFIGURED` / `STALE` / `ERROR` として拒否する。

## 5. 注文状態の分離

### 5.1 商取引集約ステータス

`product_orders.status` は次の6種だけを持つ。

1. `draft`
2. `submitted`
3. `approved`
4. `fulfilling`
5. `fulfilled`
6. `cancelled`

バックオーダー、オーナー確認、決済、倉庫受付は集約ステータスへ混ぜない。

### 5.2 独立状態軸

- `owner_review_state`: `not_requested` / `pending` / `changes_requested` / `owner_confirmed`
- `payment_status`: `not_required` / `selection_required` / `authorization_pending` / `authorized` / `payment_pending` / `paid` / `failed` / `voided`
- `backorder_policy`: `ship_available_first` / `ship_when_complete` / `NULL`
- 倉庫作業: `gyeon_order_warehouse_tasks.task_state`
- 通知配送: `gyeon_order_notification_outbox.delivery_state`

## 6. 金額・数量・送料契約

### 6.1 1点単位

- 発注数量は1本・1点単位の正の整数。
- `order_unit_qty = 1`、`minimum_order_qty = 1` をDB制約で固定する。
- ケース倍数補正、最低ケース数、自動丸めを行わない。

### 6.2 価格

- 正本は商品・購入ランク・有効期間・versionを持つoffer。
- 注文明細には注文時の税別定価、税込定価、税別仕入、税込仕入、税率、割引、offer versionを不変スナップショットとして保存する。
- 価格未設定は0円に変換せず発注を拒否する。
- 0円は正本offerが意図的無料として明示した場合だけ許可する。

### 6.3 送料無料

- 判定基準は販促グッズを除いた値引き前の税別定価合計。
- 初期閾値は30,000円。
- 閾値・送料はversion付きルールから取得し、注文へversionを保存する。
- 販促グッズは送料無料判定へ算入しない。

## 7. 権限契約

### 7.1 所属の二重確認

すべてのdealer向けRPCとSELECT policyは次を同時に満たす必要がある。

1. `auth.uid()` と `p_actor_id` が一致する。
2. `dealer_users` に対象店舗のactive membershipが1件だけ存在する。
3. `dealer_users.role` がRPCごとの許可roleに完全一致する。
4. `dealers.status = 'active'`。
5. 対象店舗に有効期間内のactive `gyeon_ordering` membershipが存在する。

JWTの `user_metadata`、クライアント送信role、クライアント送信店舗IDだけで権限を決めない。曖昧な複数所属は拒否する。

### 7.2 role別操作

| 操作 | owner | manager | staff | readonly |
|---|---:|---:|---:|---:|
| 下書き作成・更新 | 可 | 可 | 可 | 不可 |
| オーナー確認依頼 | 不要 | 可 | 可 | 不可 |
| 最終発注 | 可 | 不可 | 不可 | 不可 |
| 倉庫受付前キャンセル | 可 | 不可 | 不可 | 不可 |
| 倉庫受付後変更 | 不可 | 不可 | 不可 | 不可 |

最終発注は必ずowner本人のリクエストで行う。managerをowner相当として扱わない。

## 8. RPC契約

### 8.0 `list_gyeon_order_catalog_v3_rpc`

- actor: owner / manager / staff / readonly
- 有効な商用membershipのbuyer rankをサーバーで解決する。
- 商品・価格offer・供給投影を安全な一覧DTOにして返す。
- 供給正本が未接続・古い・失敗の場合、発注可能数量を0にせず状態とNULLを返す。
- offer・供給authority tableをブラウザへ直接公開しない。

### 8.1 `save_gyeon_order_v3_draft_rpc`

- actor: owner / manager / staff
- 入力: dealer、actor、idempotency key、期待version、商品IDと数量、配送・コメント等の下書き
- サーバー処理: membership、offer、供給、価格、送料、資格進捗を再計算し、注文と明細を単一トランザクションで保存
- 禁止: クライアント価格・SKU・合計・role・statusの採用

### 8.2 `request_gyeon_order_v3_owner_review_rpc`

- actor: manager / staff
- `draft` を行ロックし、`owner_review_state = pending` にする。
- immutable eventと通知outboxを同一トランザクションで作る。

### 8.3 `owner_submit_gyeon_order_v3_rpc`

- actor: ownerのみ
- `draft` を行ロックし、最新version・fingerprint・資格・配送・同意・支払・供給・送料・発送可能日を再検証する。
- バックオーダーを含む場合だけ注文全体の発送方針を必須にする。
- カードはサーバー所有の有効な与信証跡が必須。
- 銀行振込・前払いは `payment_pending`。
- 代引きは顧客直送不可。
- 掛け売りはsuper admin設定の有効な契約がある店舗だけ。通常店舗へ選択肢として表示しない。

### 8.4 `edit_gyeon_order_v3_before_warehouse_rpc`

- actor: ownerのみ。
- `submitted` かつ倉庫未受付に限定。
- 金額変更があるカード注文は、新与信成功証跡を確認してから旧与信を解放する。
- 再与信失敗時は元注文と元与信を保持し、注文versionを進めない。

### 8.5 `cancel_gyeon_order_v3_before_warehouse_rpc`

- actor: ownerのみ。
- `draft` または倉庫未受付の `submitted` に限定。

### 8.6 `accept_gyeon_order_v3_warehouse_rpc`

- dealerのauthenticated userへgrantしない。
- 倉庫serviceが支払・供給・発送条件を検証して受付する。
- 受付後は商取引内容を変更不可にする。

## 9. 冪等性と競合制御

- 変更RPCは `(dealer_id, idempotency_key)` を一意にする。
- 同じkey・同じfingerprintは保存済み結果を返す。
- 同じkey・異なるfingerprintは拒否する。
- 注文更新は `FOR UPDATE` と `expected_version` を併用する。
- idempotency記録と注文変更は同一トランザクションで完了する。
- C4では別接続の同時実行により、二重発注・二重受付・lost updateが発生しないことを証明する。

## 10. 倉庫営業カレンダーと発送可能日

- 土曜日を固定休業・固定営業と仮定しない。
- super adminが日付ごとに `normal` / `closed` / `exceptional` / `shortened` と締切時刻を登録する。
- 発送可能日は、支払完了条件、供給可能状態、当日締切、営業カレンダーをサーバーで合成する。
- 必要なカレンダー日が未登録なら推測せず発注確定を拒否する。
- カレンダー変更で既存注文の発送予定が変わる場合、ベル通知とメール通知のoutboxを作成する。
- UI表示には「発送確定日ではない」「当日発送は当日到着を意味しない」を含める。

## 11. RLSとGRANT

### 11.1 基本

- 対象の全public tableでRLSを有効化する。
- `public` / `anon` / `authenticated` のtable権限を一度すべてrevokeする。
- dealer向けには必要なtableの `SELECT` だけをgrantする。
- `INSERT` / `UPDATE` / `DELETE` policyを作らない。
- 変更はRPC経由だけにする。

### 11.2 SECURITY DEFINER

- 必要な関数だけ `SECURITY DEFINER` とする。
- 全関数で `SET search_path = ''`。
- table、function、typeをschema修飾する。
- function executeは `public` / `anon` / `authenticated` / `service_role` から一度revokeし、正確な署名単位で再grantする。
- dealer RPCは `authenticated`、authority同期・倉庫受付は `service_role` のみ。

## 12. 未確定事項の扱い

次はC3-R1で勝手に確定しない。

- Office AZ在庫正本との最終接続方式、同期SLA、予約計算の所有者
- 決済provider固有の与信・取消・再与信API契約
- PayPay銀行入金通知APIの署名・再送・照合契約
- 倉庫通知メールproviderと送信失敗時の再送契約
- 顧客直送納品書へ販売価格を表示するか否か
- 配送先・通知先・お気に入り・保存カートのデータ正本
- 初回登録対象フラグを持つ既存管理画面との最終接続

未接続の外部正本をクライアント入力や仮の0値で補完してはならない。必要な正式証跡がない処理はfail-closedにする。

## 13. C4検証ゲート

正式migration候補へ進むには、最低限次をすべて通す。

1. 本番migration連鎖を再現した未使用の使い捨てPostgreSQL環境。
2. SQL syntax、全migration適用、rollback / cleanup手順。
3. pgTAPによるtable、constraint、RLS、grant、function ownership、signature検証。
4. 実際のrequest JWT claimsを使うowner / manager / staff / readonly / 別店舗 / membership無効の認可試験。
5. 別DB接続によるidempotency、同時更新、二重submit、二重倉庫受付の競合試験。
6. clientが価格、role、status、供給、送料を偽装しても採用されない試験。
7. `NOT_CONFIGURED` / stale supply、未登録calendar、価格未設定、資格未達、決済証跡不足の拒否試験。
8. 既存V1、請求・入金、見積、保護対象UIに回帰がないこと。

## 14. C3-R1変更範囲

この候補で変更してよいのは次の5ファイルだけである。

1. `docs/integrations/gyeon-order/v3-db-rpc-rls-design.md`
2. `supabase/migrations/DRAFT_DO_NOT_APPLY/gyeon_order_v3_contract.sql`
3. `supabase/migrations/DRAFT_DO_NOT_APPLY/README.md`
4. `src/lib/product-orders/gyeon-order-v3-migration-contract.test.ts`
5. `src/lib/product-orders/gyeon-order-v3-rpc-contract.test.ts`

C3-R1ではstage、commit、push、DB接続、migration適用を行わない。
