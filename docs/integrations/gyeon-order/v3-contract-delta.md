# GYEON商品発注 V3 契約差分監査

| 項目 | 内容 |
|---|---|
| 文書マーカー | `GYEON_ORDER_V3_C1_CONTRACT_DELTA_AUDIT` |
| 判定 | `CHANGES_REQUIRED_BEFORE_IMPLEMENTATION` |
| 作成日 | 2026-08-27 |
| 対象 | V3正式仕様、R1 UI正本、V1 pure contract／runtime候補、現行DealerOS |
| 実施範囲 | 読み取り専用の契約差分設計 |
| 非実施 | DealerOSソース変更、Migration作成・適用、DB接続、stage、commit、push、Ready、merge、deploy |

## 1. 結論

R1 UIはV3の画面正本候補として使用できる。しかし、既存V1契約候補はV3と複数の重大な衝突があるため、そのままruntime、DB、RPCへ採用してはならない。

次に行うべき作業はUI移植ではなく、V3用pure contractの新規候補を隔離ブランチで作成し、業務状態を別軸へ分離して契約テストで固定することである。

## 2. 監査正本と指紋

| 正本 | 所在 | SHA-256／commit |
|---|---|---|
| V3正式決定仕様 | `agent/gyeon-order-ui-idempotency-resume-v1:docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md` | `44fc165d02b434c6eff23760813db5070039bab58fcbb6f8e11d3a1cb86cbbc2` |
| R1 UI正本候補 | `gda_gyeon_order_ui_v3_all_r1.zip` | `906fdf64c6eea6ef612073f266fec6c726b96e0560145248c29246666cfd5af2` |
| V1 pure contract候補 | `agent/gyeon-order-runtime-v1:src/lib/product-orders/gyeon-order-contract-core.ts` | `7ba6f1d7daa78043a80b78ddc62a5a12321eea1b5fed3beb3e781e512c2af7b4` |
| V1 Migration候補 | `agent/gyeon-order-runtime-v1:supabase/migrations/20260809162137_gyeon_product_order_v1_contract.sql` | `7105768382bf3e705ae0a688b47b2af6ec1ba10d85ec4b0015fa9cd5da6d65f0` |
| 現在の作業ブランチ | `fix/approval-center-delete-access-cut` | `5b1cd6ae8d3277d3d46cfc4f15f247fc168e0223` |
| 現在の `origin/main` | `origin/main` | `0757cf6314da72f780856af537c5c857627f80cb` |

現在の作業ツリーには保護対象 `src/components/estimates/wizard/screens/ScreensPreview.tsx` の既存未コミット変更がある。今後の候補作成にこの作業ツリーを使わない。

## 3. 重大なV1→V3差分

| # | 領域 | V1候補 | V3正式契約 | 判定 |
|---|---|---|---|---|
| 1 | 最終発注権限 | owner／manager／staffがsubmit可能 | 最終発注はownerだけ。staffは確認依頼まで | `REPLACE` |
| 2 | 送料無料判定 | 値引き前の税込定価合計 | 値引き前の税別定価合計30,000円 | `REPLACE` |
| 3 | 支払方法 | card固定 | card／銀行振込前払い／代引／掛け売り | `REPLACE` |
| 4 | 発注単位 | order unit／minimum quantityを許容 | 1本・1点単位。ケース倍数補正禁止 | `RESTRICT_TO_ONE` |
| 5 | オーナー承認 | 注文statusへ直接submit | 承認依頼・差し戻しをorder statusと分離 | `NEW_AXIS` |
| 6 | バックオーダー | 可否snapshotのみ | 発送方針、在庫／入荷、分割事実を別軸管理 | `EXPAND_SEPARATELY` |
| 7 | 倉庫営業日 | なし | 日別営業状態・締切・最短発送可能日・変更通知 | `NEW_REQUIRED` |
| 8 | 在庫表示 | in/low/out/unknown | 正式在庫、引当、棚卸待ち、BO、発注可能数を分離 | `REPLACE_READ_MODEL` |
| 9 | 注文編集 | draft中心 | warehouse受付前まで編集・取消、受付後凍結 | `EXPAND_WITH_LOCKING` |
| 10 | 再与信 | V1はcard capture中心 | 倉庫受付前の金額変更で再与信、失敗時は元状態維持 | `NEW_REQUIRED` |
| 11 | 配送 | 送料zone中心 | 1注文1配送先、5種の配送先、時間・同意 | `NEW_REQUIRED` |
| 12 | 初回条件 | なし | Shop／Detailer／upgradeの条件判定 | `NEW_REQUIRED` |
| 13 | 販促グッズ | なし | 単独注文禁止、のぼり365日制限 | `NEW_REQUIRED` |
| 14 | PDF／CSV | 注文印刷の基礎のみ | 発行状態、権限、納品書／請求書DL、正式CSV | `NEW_REQUIRED` |
| 15 | 通知 | 汎用通知テーブル／ベル | 注文・入金・倉庫・発送・請求イベントと再送 | `EXPAND` |

## 4. 維持できるV1契約

次はV3でも維持できる。

- 注文の集約statusは `draft / submitted / approved / fulfilling / fulfilled / cancelled` の6種類だけにする。
- 商品、価格、税、ランク、販売状態、送料、合計はserver-owned authorityから解決する。
- clientから受け取る注文行は商品IDと数量を中心とし、client価格を信用しない。
- order headerとitemsは一つの原子的RPCで保存する。
- dealer-scoped idempotency keyとcanonical request fingerprintを使う。
- 取扱店からのテーブル直接writeを切り、許可されたRPCだけを公開する。
- `product_orders` と `product_order_items` をGYEON発注の保存先として維持する。
- バックオーダーをorder statusへ追加しない。
- 再注文時は過去snapshotを無条件再利用せず、現行商品・価格・ランク・供給可否を再検証する。

## 5. V3で分離すべき状態軸

一つのstatusへ詰め込むことを禁止する。

1. 注文: `draft / submitted / approved / fulfilling / fulfilled / cancelled`
2. オーナー確認: 未依頼／確認待ち／差し戻し／確認済み
3. 支払: 未選択／与信待ち／与信済み／入金待ち／入金照合済み／保留／失敗／掛け売り
4. 倉庫タスク: 未生成／未受付／受付済み／作業中／例外／完了
5. 在庫・供給: 在庫あり／在庫切れ／確認中／情報古い／BO可否／入荷予定
6. 発送: 未準備／準備中／発送済み／配送中／納品済み
7. PDF: 未発行／作成中／発行済み／失敗／権限なし
8. 初回条件: 対象外／未達／カート上達成／発送完了で正式達成／再確認

## 6. V3 fail-closed契約

次の状態では成功扱いにせず、理由を表示して処理を止める。

- 価格、税率、取扱店購入価格、販売状態、購入可能ランクが未設定または古い。
- 発注可能数量、BO可否、入荷予定のauthorityが不明。
- 送料ルールまたは配送地域が解決できない。
- 倉庫営業カレンダーまたは締切が解決できず、最短発送可能日を計算できない。
- staff／managerが最終発注を試みる。
- オーナー確認、支払条件、配送先、必要同意、BO発送方針が不足する。
- カード与信、銀行入金照合、掛け売り有効性の証跡が不足する。
- 同じidempotency keyで異なるpayloadが送信される。
- version不一致の古いカートが保存・発注される。
- 倉庫受付後に金額、数量、配送先、商取引内容を変更しようとする。
- 販促グッズだけで発注しようとする。
- 初回条件が未達のまま最終発注しようとする。

## 7. 未確定事項の扱い

V3 §20の15項目は、UI・DB・APIで推測確定しない。実装時は次の扱いにする。

- 金額や期限を勝手にdefaultしない。
- 未設定を0円、許可、無制限へ変換しない。
- 未確定機能は非表示または明示的な未設定状態にする。
- 本番取引に必要な未確定値はfail closedで停止する。
- 承認後にversioned ruleとして追加し、既存注文snapshotを書き換えない。

## 8. 次フェーズ `GYEON-ORDER-V3-C2` 候補

### 8.1 目的

DB、runtime、UIを変更せず、V3業務契約をpure TypeScriptと契約テストへ写像する。

### 8.2 literal allowlist案

1. `docs/master_specification/SPEC_GYEON_ORDER_001_DEALER_ORDER_FORMAL_DECISION_V3.md`
2. `docs/master_specification/SPEC_GYEON_ORDER_001_GENSPARK_UI_PRODUCTION_REQUEST_V3.md`
3. `docs/integrations/gyeon-order/v3-contract-delta.md`
4. `src/lib/product-orders/gyeon-order-v3-contract-core.ts`
5. `src/lib/product-orders/gyeon-order-v3-contract-core.test.ts`

既存V1 core、runtime、Migrationは変更せず、V3候補の受入後に置換・廃止方針を別ゲートで決める。

### 8.3 C2必須テスト

- ownerだけが最終発注できる。manager／staff／readonlyは拒否される。
- staffは確認依頼を作成できるがorderを`submitted`へ遷移できない。
- 送料無料basisは税別定価・値引き前・販促グッズ除外・30,000円である。
- 数量は1単位で、ケース倍数への補正を行わない。
- 4支払区分の倉庫送信起点が正式仕様と一致する。
- BO発送方針はBOを含む注文だけで必須になる。
- BO、支払、承認、発送、PDFをorder statusへ混入しない。
- 最短発送可能日は在庫、支払成立時刻、締切、日別カレンダーから計算する。
- 土曜日、日曜日、祝日を固定休業として扱わない。
- カレンダー変更による既存発送予定変更はベル＋メール通知対象になる。
- 未確定事項はdefault値に変換されない。
- 6つの注文状態と許可遷移がV3に一致する。

### 8.4 C2禁止事項

- DB／Supabase接続
- Migration作成、変更、適用
- UI移植
- PSP、PayPay銀行、メールprovider接続
- 既存V1候補の上書き
- 保護dirty pathの読取、変更、stage、commit
- broad staging、stash、restore、cleanup
- commit、push、Ready、merge、deploy

## 9. C2後の推奨順序

1. `C2`: V3 pure contract候補
2. `C3`: DB／RPC／RLS source-only設計
3. `C4`: disposable DBでtenant、RLS、冪等性、同時実行を検証
4. `C5`: 商品一覧・永続カート・オーナー確認のruntime接続
5. `C6`: 支払・倉庫営業カレンダー・最短発送可能日
6. `C7`: 倉庫キュー・引当・BO・発送・通知
7. `C8`: PDF・CSV・初回条件・販促グッズ・管理画面
8. `C9`: 24画面レスポンシブ受入と本番前E2E

## 10. C1最終判定

`GYEON-ORDER-V3-C1 = COMPLETE`

`GYEON-ORDER-V3-C2 = NOT_STARTED / EXPLICIT_AUTHORIZATION_REQUIRED`

R1 UIを直接実装すること、V1 runtime候補をそのまま採用すること、既存Migrationを修正することは承認しない。
