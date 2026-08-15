# GYEON商品発注 foundation 統合監査

## 判定

**ACCEPTED_FOR_BOUNDED_PURE_CONTRACT_IMPLEMENTATION**

この文書は、GYEON商品発注をDitailerOSへ統合する前の契約レビュー記録である。V1の金額、権限、6状態、冪等性、送り状確認後capture境界を確定したため、別branchのpure contractと限定テストだけを開始できる。DB、RPC、RLS、UI、PSP接続、倉庫永続化、通知永続化の実装開始はまだ承認しない。

このDraft PRで許可する変更は本書だけである。pure contract候補は別worktree／別branchへ分離し、このPRへ混入させない。既存Migration変更、新規Migration作成、DB接続、Supabase接続は含まない。

## 監査基準

| 対象 | 固定値 |
| --- | --- |
| Foundation handoff export commit | `f259686f875f8b24d47cc17e9fc4e7c3e3011595` |
| Foundation handoff tree | `68bba212b3fa1326d7e4f1bf8de884e645eb6650` |
| Foundation approved implementation commit | `a4246dad4e46443929aa0e81b609fd6ebb565091` |
| Foundation approved implementation tree | `b29e5cd4a081a5f52508764bd71f1baaeca5587c` |
| DitailerOS reviewed branch | `fix/approval-center-delete-access-cut` |
| DitailerOS reviewed commit | `f6f8b0b64041480515f67294e6f0e732a2766716` |
| Foundation handoff PR | [detaileros-inventory-foundation PR #1](https://github.com/nisikawa-officeAZ/detaileros-inventory-foundation/pull/1) |
| Coordination record | [DitailerOS Issue #3](https://github.com/nisikawa-officeAZ/GYEON/issues/3) |

Foundationのcommit、tree、契約名は参照識別子であり、foundation commitのcherry-pick、merge、Migrationコピー、実装コードの直接コピーを許可するものではない。

## 役割分離

- DitailerOSは実際の統合先であり、商品発注UI、認証、server action、DB、RLS、PSP接続、倉庫連携を所有する。
- `detaileros-inventory-foundation` は業務契約、pure function、port、参照実装を提供するfoundationであり、単独で稼働するアプリではない。
- GYEON EditionはGYEON Japanへの商品発注を扱う。ディーラー店舗内の在庫管理は行わない。
- GYEON商品発注とEnterprise版の店舗在庫管理は別責務とし、同じテーブルや画面へ安易に統合しない。
- 既存の `product_orders`、`product_order_items`、`gyeon_products` を一般在庫向けに改名、転用、抽象化しない。
- 完成済みのpayments、月締め請求、請求書PDFから再利用するのは、認証、RLS、原子性、冪等性、immutable snapshot、fail-closed、テスト方式などの設計パターンであり、既存機能やMigrationそのものではない。

## 確定した初期プロダクト判断

1. 初期GYEON発注の支払方法は**カード決済のみ**とする。
2. 月締め掛売り、銀行振込、請求書払いは将来拡張へ延期する。
3. PSP authorizationとcaptureを分離し、captureの正規タイミングは**送り状バーコード確認成功時**とする。
4. 保存するディーラーランクの正本はDitailerOSの `certified` とする。foundationの `certified_detailer` は統合境界で `certified` へ変換する。
5. 3万円未満に適用する送料マスターはGYEON Japanの物流担当者または管理者が管理する。
6. 送料マスターが未設定、不正、または対象判定不能の場合は送料無料へフォールバックせず、注文処理をfail closedで停止する。
7. 供給在庫が不足していてもバックオーダーは許可する。ただし販売停止、廃番、ランク不許可の商品は注文できない。
8. 3万円送料無料のV1判定basisは、foundationと同じ**税込定価snapshot・値引き前・数量合計**とする。送料はbasisへ含めない。
9. dealer側はowner／manager／staffが作成、編集、submit、再注文できる。取消は破壊的操作としてowner／managerだけに限定し、readonlyは閲覧だけとする。
10. 正規状態は `draft`、`submitted`、`approved`、`fulfilling`、`fulfilled`、`cancelled` の6状態とする。dealerはapprove／fulfillmentを実行できず、activeなGYEON operatorだけが実行できる。
11. V1は注文全体を一括でfulfillment、capture、完了する。partial shipment、partial capture、backorder分割はV1 runtimeへ入れず、後続契約までfail closedとする。
12. `fulfilled` は発送確認とcapture成功の両方が永続証跡として存在するときだけ許可する。発送またはcapture後の単純cancelは禁止し、返金／返品の別契約へ送る。

## 現状の利用可能範囲

- `/product-orders` routeと既存UIはGYEONの商品発注導線として扱う。
- `gyeon_products` はGYEONの商品マスターであり、価格、ランク、販売状態、発注単位、供給可否をサーバーが判断する正本候補である。
- `product_orders` と `product_order_items` は発注header／lineの保存先として維持する。
- `draft` 注文を永続カートへ発展させる余地はあるが、現在の契約だけでは安全な永続カートとして承認できない。所有者、unique active cart、期限、version、再開、更新、削除、同時編集の契約が先に必要である。
- 再注文は過去のsnapshotをそのまま再利用せず、商品マスター、価格、税率、販売状態、ランク、発注単位、供給可否を再検証した新規注文として作成する。

## 重大な未解決リスク

1. クライアント入力の価格をサーバーが信頼して保存できる。
2. 注文headerとitemsの作成が非原子的で、失敗時の補償deleteに依存している。
3. RLSだけではroleとstatus transitionを十分に強制できていない。
4. idempotency key、request fingerprint、同時submit防止がない。
5. DB側の6 statusとUI／TypeScript側の4 statusが一致していない。
6. dealer approval UIとserver契約が矛盾している。
7. `product_order_items` のSELECT権限とdealer間の非漏洩が実証されていない。
8. 入荷処理が非原子的で、backorder statusにも不整合がある。
9. shipment、backorder、tracking、capture、retryが一つの状態機械として接続されていない。
10. 商品名、SKU、単価、税率、値引き、ランク、発注単位などの注文時snapshotが不足している。
11. autosave cart、resume、update、delete、unique active cart、optimistic lockingが未実装または未証明である。
12. captureがタイムアウトした場合の「PSPでは成功したがDitailerOSでは結果不明」という状態に対する照合契約がない。

以上のどれかをUI側の注意書きだけで補うことは認めない。権限、金額、状態遷移、重複防止はサーバーとDBで強制する。

## 実装前に必要な契約

### 金額と商品

- 商品価格、税率、値引き、送料、合計額はサーバー所有データから計算する。
- 注文時に商品名、SKU、単価、税率、値引き、ランク、発注単位をimmutable snapshotとして保存する。
- 商品ランク、販売状態、廃番、最小発注単位、供給可否をサーバーで再検証する。
- 3万円送料無料の閾値は確定済みだが、判定basisは実装前に確定する。foundationの `quoteShippingFromMaster` は、税込定価snapshot・値引き前・数量合計をbasisとする。このbasisを採用するか、DitailerOS固有契約へ変更するかを決定するまで推測しない。
- 閾値未満で該当運賃を解決できない場合、foundationは `shippingFee: null`、`freeShipping: false`、`underThresholdFeeResolved: false` を返す。DitailerOSも未解決状態を送料無料へ変換せずfail closedで停止する。
- 金額の丸め単位と税計算順序を固定する。

### 原子性、冪等性、同時実行

- order headerとitemsを一つのtransactional RPCで作成する。
- dealer、actor、roleは認証済みrequest scopeからサーバーが確定し、クライアント指定値を権限根拠にしない。
- idempotency keyとcanonical payload fingerprintを保存する。
- 同じkey／同じpayloadは同じ注文を返し、同じkey／異なるpayloadは明示的な競合として拒否する。
- versionまたは `updated_at` によるoptimistic lockingを、カートの数量変更、削除、submitへ適用する。
- dealer／cart ownerごとのunique active cart契約と、期限切れ処理を定義する。

### 認証、role、RLS

- owner、manager、staff、readonlyごとに、カート作成、編集、submit、閲覧、取消、再注文の権限表を確定する。
- disabled staffの拒否をactive membershipより優先する。
- `product_orders` と `product_order_items` のdealer境界をRLSで強制し、header経由の間接漏洩も防ぐ。
- operator／GYEON Japan物流担当者／管理者の権限とdealer権限を分離する。
- privileged RPCであっても、publicなclient入力だけでdealerやactorを切り替えられないようにする。

### 状態機械、倉庫、配送

- DBの6 statusとUI／TypeScriptの4 statusを一つの明示的なstatus transition表へ統合する。
- 誰が、どの状態からどの状態へ、どの条件で遷移できるかをDB契約として固定する。
- 倉庫受領前に編集できる項目と、受領後に凍結する金額・snapshot・数量を定義する。
- 部分入荷、部分出荷、バックオーダー、取消、再注文の数量不変条件を定義する。
- shipment barcodeを一意にし、形式、発行者、重複scan、再scan、誤scanの扱いを決める。
- 送り状番号、配送会社、追跡情報、発送日時のauthorityを定義する。

### カード決済、capture、通知

- 注文submit時のPSP authorizationと、送り状バーコード確認成功時のcaptureを分離する。
- foundationの `PaymentPort` が提供するのは `capture` と任意の `reauthorize` だけであり、初回authorizationは別のDitailerOS／PSP契約として定義する。
- capture金額は保存済み注文snapshotからサーバーが導出する。
- `captureAmountYen` はfulfillment開始時に一度だけ確定して保存し、capture時に再計算しない。
- capture idempotency key、payload fingerprint、PSP response、失敗理由、照合状態を永続化する。
- capture結果をDBへ確定保存してから通知を生成する。メール送信成功をcapture成功の条件にしない。
- capture失敗、timeout、結果不明、再試行、authorization期限切れ、取消、返金の状態遷移を決める。
- 通知は再送可能にし、attempt、last error、next retry、delivered timeを追跡する。

## Foundation契約の再利用分類

| Foundation対象 | 分類 | DitailerOSでの扱い |
| --- | --- | --- |
| `AuthWindow` | `ADAPT_FOUNDATION_CONTRACT` | ユーザー認証ではなく、PSP authorizationの実行時刻、期限、金額、任意のauthorization IDを表す。期限切れ・金額不一致をfail closedで拒否する契約として適合させる。 |
| DitailerOS request scope（foundation外） | `USE_EXISTING_DITAILEROS_PATTERN` | current dealer、actor、owner／manager／staff／readonly、disabled優先拒否はDitailerOSの実認証・認可契約を正本とし、`AuthWindow` とは完全に分離する。 |
| `PaymentPort` | `ADAPT_FOUNDATION_CONTRACT` | 保証範囲は冪等な `capture` と任意の `reauthorize` だけである。PSP固有実装と秘密情報をserver側へ閉じ込める。 |
| 初回PSP authorization（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | `PaymentPort` は初回authorizeを提供しないため、注文submit時のauthorization port、保存、取消、期限管理を別契約として定義する。 |
| `CaptureResultRepositoryPort` | `ADAPT_FOUNDATION_CONTRACT` | `persistCaptureResult` によるorder ID、idempotency key、capture ID、capture金額、capture時刻の保存境界だけを適合させる。 |
| capture照合・検索契約（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | 既存結果検索、結果不明、PSP照合、request fingerprint、永続的な一意性はfoundation portの保証外であり、DitailerOS DB／RPC契約として追加する。 |
| `WarehouseShippingDeps` | `ADAPT_FOUNDATION_CONTRACT` | 依存境界はcarrier、`PaymentPort`、email、capture結果保存、fulfillment開始時のcapture金額取得、clockである。送料マスター取得や倉庫担当者の権限判定は含まない。 |
| `WarehouseOrderLineInput` | `ADAPT_FOUNDATION_CONTRACT` | immutable snapshotから倉庫入力を生成し、商品、offer、数量、受付数量、barcode、価格、税率、発注単位、値引きの不変条件をserverで検証する。 |
| `ProductOrderItemSnapshot` | `ADAPT_FOUNDATION_CONTRACT` | 既存保証はproduct ID、offer ID、数量、受付数量、商品名、SKU、税抜・税込定価、税率、発注単位、値引きである。 |
| snapshot追加項目（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | 購入ランク、販売状態、supplier availability、送料、決済情報を保存する場合は、foundation既存保証と区別したDitailerOS拡張とする。 |
| `captureAmountYen` | `ADAPT_FOUNDATION_CONTRACT` | fulfillment開始時にserver計算額を凍結し、capture時は保存値だけを使用する。client指定額とcapture時の再計算を拒否する。 |
| `captureIdempotencyKey` | `ADAPT_FOUNDATION_CONTRACT` | foundationのorder-scoped capture keyと同一keyで二重課金しない契約を利用する。DB一意制約、canonical fingerprint、結果検索、照合はDitailerOS側で追加する。 |
| `quoteShippingFromMaster` | `ADAPT_FOUNDATION_CONTRACT` | 税込定価snapshot・値引き前・数量合計をbasisとして送料を引くpure contractである。basisの採否は未解決だが、運賃未解決時の `shippingFee: null`／fail-closedは維持する。 |
| `canBuyerPurchaseOffer` | `ADAPT_FOUNDATION_CONTRACT` | `isPurchasable`、`allowedRanks`、Certified限定、PPF Installer限定を組み合わせた購入可否を利用し、`certified_detailer` は境界でDitailerOS正本の `certified` へ変換する。 |
| `validateCartLines`／`isValidOrderUnitQty`／`suggestOrderUnitQty` | `ADAPT_FOUNDATION_CONTRACT` | 最小発注数量、発注単位、rank、購入可否のpure検証をserver-side再検証へ適合させる。 |
| `SupplierProductAvailability`／`supplyBadgeView`／`assertNeverUsesDealerStockForSupply` | `ADAPT_FOUNDATION_CONTRACT` | supplier availabilityの型、表示判定、dealer stockを供給可否へ誤用しないpure guardを利用する。 |
| supplier availability永続化（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | supplier feedの保存、更新authority、stale管理、販売停止／廃番との合成、backorderのserver強制をDitailerOSで実装する。 |
| `ProductOrderStatus`／`canTransition`／`isOrderEditable`／warehouse status bridge | `ADAPT_FOUNDATION_CONTRACT` | foundationの正確な6状態 `draft`、`submitted`、`approved`、`fulfilling`、`fulfilled`、`cancelled` とpure遷移・受領後編集不可判定を対応表の基準にする。 |
| warehouse acceptanceのpure遷移 | `ADAPT_FOUNDATION_CONTRACT` | in-memoryのwarehouse phaseとorder status bridge、不正遷移拒否を再利用する。 |
| warehouse acceptance永続化（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | 受領権限、原子的なDB遷移、受領時刻、受領後ロック、部分受領、並行更新をDitailerOSで強制する。 |
| foundationのbarcode／active-label照合 | `ADAPT_FOUNDATION_CONTRACT` | 送り状barcode一致、active label一致、商品JAN／case JAN、重複barcode、case数量のpure検証を利用する。 |
| barcode永続化・監査（foundation外） | `NEW_GYEON_SPECIFIC_IMPLEMENTATION` | barcode一意制約、scan actor権限、scan履歴、重複／誤scan／再scanの永続化と原子的capture開始をDitailerOSで実装する。 |
| `confirmLabelAndShip` | `ADAPT_FOUNDATION_CONTRACT` | 検品完了、active label照合、capture、capture ID検証、repository保存、メールの順序契約を利用する。DB transaction、PSP接続、権限はDitailerOSで実装する。 |
| capture後のメール再送 | `ADAPT_FOUNDATION_CONTRACT` | foundationのemail-only retryとcapture前メール拒否を利用し、captureを再実行せず通知だけを再試行する。 |
| durable notification outbox | `DEFER` | foundationにはattempt管理、scheduler、next retry、dead-letterがないため、capture永続化と状態機械の確定後に別承認する。 |
| foundationのMigration／DB schemaの直接移植 | `PROTECTED_CONFLICT` | 既存DitailerOS schema、RLS、status、保護Migrationと衝突するため禁止する。 |

`ProductOrderItemSnapshot`、`WarehouseShippingDeps`、`CaptureResultRepositoryPort` などのfoundation型を、DitailerOSのDB永続化、認証、RLS、transaction保証と同一視してはならない。foundationはpure contractとport境界を提供し、tenant分離、actor authority、DB一意性、結果照合、監査証跡はDitailerOSが別途保証する。

## Migration方針

次の既存Migrationはimmutableであり、修正、rename、置換、内容コピーを禁止する。

- `supabase/migrations/047_create_gyeon_products.sql`
- `supabase/migrations/048_create_product_orders.sql`
- `supabase/migrations/069_inventory_counting.sql`
- `supabase/migrations/077_logistics_foundation.sql`
- `supabase/migrations/079_warehouse_daily_ops.sql`
- `supabase/migrations/104_least_privilege_grants.sql`

DB変更が承認された場合は、既存Migrationを編集せず、新しい時系列Migrationだけを追加する。本PRでは新規Migrationの作成も適用も行わない。

## 実装allowlist案

### このDraft PRで許可するpathname

- `docs/integrations/gyeon-order/foundation-review.md`

### 将来の契約設計で候補にできる既存領域

以下は候補であり、現時点では変更を承認しない。DB／RPC／RLS契約設計の承認後に、実在確認済みpathnameから改めてliteral allowlistを作る。

- `src/app/product-orders/page.tsx`
- `src/app/product-orders/ProductOrdersClient.tsx`
- `src/components/product-orders/ProductOrderForm.tsx`
- `src/components/product-orders/ProductOrderTable.tsx`
- `src/lib/product-orders/create-product-order.ts`
- `src/lib/product-orders/get-product-orders.ts`
- `src/lib/product-orders/product-order-types.ts`
- `src/lib/product-orders/update-product-order.ts`
- `src/lib/products/get-gyeon-products.ts`
- 新規のGYEON商品発注contract／RPC binding／boundary test
- 新規のGYEON商品発注Migration

商品発注PDF、通知、tracking UI、倉庫管理UIは初期contractの確定に不要であり、別フェーズへ延期する。

## 絶対変更禁止範囲

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`
- `supabase/migrations/20260801110110_line_link_tokens.sql`
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
- payments全体
- monthly-statements全体
- invoice PDF全体
- estimate PDF全体
- LINE全体
- GYEON onboarding全体
- この文書化フェーズ開始時点で存在する月締め請求書PDF関連のdirty paths 16件

## 文書化フェーズ開始時の保護dirty-path baseline

以下は既存worktreeの並行作業であり、本branchへ移動、コピー、stage、commitしてはならない。

1. `next.config.ts`
2. `src/components/estimates/wizard/screens/ScreensPreview.tsx`
3. `src/components/monthly-statements/MonthlyStatementDetailClient.tsx`
4. `src/lib/monthly-statements/monthly-statement-types.ts`
5. `src/lib/monthly-statements/ensure-monthly-invoice-pdf.ts`
6. `src/lib/monthly-statements/monthly-invoice-artifact-action-boundary.test.ts`
7. `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`
8. `src/lib/monthly-statements/monthly-invoice-artifact-core.test.ts`
9. `src/lib/monthly-statements/monthly-invoice-artifact-core.ts`
10. `src/lib/pdf/chromium-document/design/monthly-invoice-a4.html`
11. `src/lib/pdf/chromium-document/design/monthly-invoice-data.js`
12. `src/lib/pdf/chromium-document/design/monthly-invoice-paginate.js`
13. `src/lib/pdf/monthly-invoice-document-data.test.ts`
14. `src/lib/pdf/monthly-invoice-document-data.ts`
15. `src/lib/pdf/render-monthly-invoice-document.ts`
16. `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`

`ScreensPreview.tsx` はpathname、mode、Git状態、hashだけを確認し、内容を開かない。文書化開始時のSHA-256は `04e206bedfb985b1c3d29b88a04006d75cd50487e1a8fd6858331495b1a85947` である。

## V1 pure contract候補の実装証跡

V1判断は、最新のDitailerOS基準 `6225ff9abd5ec96a3f956349b80212414813a484` から作成した分離branch `agent/gyeon-order-contract-v1` でpure contract候補へ変換した。

候補pathnameは次の2つだけである。

- `src/lib/product-orders/gyeon-order-contract-core.ts`
- `src/lib/product-orders/gyeon-order-contract-core.test.ts`

検証結果は次の通りである。

- focused node test: `34/34 PASS`
- candidate-scoped strict TypeScript: diagnostics `0`
- two-path `git diff --check`: `PASS`
- DB／Supabase接続: `false`
- Migration作成／適用: `false`
- 既存runtime／UI変更: `false`
- commit／push: `false`

この証跡はpure contract候補の存在を示すだけであり、RPC、RLS、UIまたはPSP実装の承認ではない。

## pure contract後に残るプロダクト／運用判断

次の判断はDB／RPC／runtime実装前に別契約で決定する。

1. 具体的なPSP選定、authorization有効期限の取得方法、再authorization、取消、返金API。
2. 永続カートを1 dealer共有にするかactor別にするか、active cart数、期限、引継ぎ、同時編集時の競合表示。
3. 送り状バーコードの発行元と保存形式、label再発行時の旧barcode無効化、重複／誤scan／再scan監査。
4. PSP結果不明、メール、倉庫API障害時のretry上限、dead-letter、管理者対応、照合手順。
5. GYEON Japan物流担当者／管理者をDitailerOS上でどのactive capabilityとして表現するか。
6. V1で延期したpartial shipment、partial capture、backorder分割、返品、返金の状態機械。

## 次の承認ゲート

次候補はpure contract受入後の**DB／RPC／RLS読み取り専用契約監査**である。本Draft PRでは開始しない。

次フェーズを開始するには、Codexが本書を承認した後、少なくとも次を含む別の明示的な指示が必要である。

- pure contractの正規status transition表とrole表をDBへ正確に写像する計画
- GYEON operator capabilityの実在authority
- server-owned金額計算
- atomic order RPC
- idempotency／fingerprint／optimistic locking
- RLSとdealer非漏洩契約
- immutable snapshot
- authorization／capture／barcode／backorder／notificationの永続化境界
- 新規Migrationだけを対象にしたliteral pathname allowlist

foundationのpure contractをDitailerOSのDB実装と同一視してはならない。DitailerOSの認証、RLS、既存statusとの対応表を先に確定し、別のsource implementation、disposable verification、commit、push、Dev適用フェーズへ順番に分離する。

## この文書化フェーズで実施しないこと

- runtime実装
- DB、Supabase、Storageへの接続
- Migrationの作成、変更、適用
- test、lint、TypeScript compile、Next build
- foundationコードの変更、コピー、cherry-pick、merge
- 保護されたPDF、LINE、payments、monthly-statements、onboardingの変更
- 実装フェーズへの自動移行
