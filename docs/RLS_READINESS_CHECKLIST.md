# RLS Readiness Checklist — PHASE35〜44

## 概要

全テーブルで `dealer_id` によるマルチテナント分離が実装されているか確認するチェックリスト。

**分離方針:**
```sql
-- 全テーブル共通の RLS パターン
USING (
  dealer_id IN (
    SELECT dealer_id FROM public.dealer_members WHERE user_id = auth.uid()
  )
)
```

**アプリ側ルール:** `dealer_id` は必ず `getCurrentDealer()` 経由。Form/URL/localStorageからの読み取り禁止。

---

## チェックリスト

### customers

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ あり（001で作成） |
| RLS 有効化 | ✅ `ENABLE ROW LEVEL SECURITY` |
| SELECT policy（dealer_id分離） | ✅ `004_enable_saas_rls.sql` で設定済み |
| INSERT policy | ✅ |
| UPDATE policy | ✅ |
| DELETE policy | ✅ |
| アプリ側 getCurrentDealer() 使用 | ✅ `get-customers.ts`, `create-customer.ts`, `update-customer.ts` |
| FormData から dealer_id 読み取りなし | ✅ 確認済み |

### vehicles

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ |
| RLS 有効化 | ✅ |
| SELECT/INSERT/UPDATE/DELETE policy | ✅ `004_enable_saas_rls.sql` |
| アプリ側 getCurrentDealer() 使用 | ✅ |
| FormData から dealer_id 読み取りなし | ✅ |

### estimates

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ |
| RLS 有効化 | ✅ |
| policy | ✅ `004_enable_saas_rls.sql` |
| アプリ側 getCurrentDealer() 使用 | ✅ `get-estimates.ts`, `create-estimate.ts`, `update-estimate.ts` |
| FormData から dealer_id 読み取りなし | ✅ |

### estimate_items（037で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| ALL policy（dealer_id分離） | ✅ `"Dealer members can manage their estimate items"` |
| アプリ側: INSERT時 dealer_id = dealer.dealer_id | ✅ `create-estimate.ts`, `update-estimate.ts` |
| FormData から dealer_id 読み取りなし | ✅ |

### work_orders（038で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their work orders"` |
| アプリ側 getCurrentDealer() 使用 | ✅ `get-work-orders.ts`, `create-work-order.ts`, `update-work-order.ts` |
| FormData から dealer_id 読み取りなし | ✅ |
| FK検証（estimate_id, customer_id, vehicle_id） | ✅ dealer_id付きで`.eq("dealer_id", dealer.dealer_id)` |

### work_order_files（039で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their work order files"` |
| Storage RLS | ⚠️ **未設定**（手動作成必要 — `STORAGE_SETUP_WORK_ORDER_FILES.md` 参照） |
| ストレージパス先頭が dealer_id | ✅ `workOrderFileStoragePath()` で実装 |
| アプリ側 getCurrentDealer() 使用 | ✅ |

### completion_reports（040で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their completion reports"` |
| アプリ側 getCurrentDealer() 使用 | ✅ |
| FK検証（work_order_id） | ✅ |

### invoices（041で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their invoices"` |
| アプリ側 getCurrentDealer() 使用 | ✅ |
| FK検証（customer_id, vehicle_id, estimate_id, work_order_id, completion_report_id） | ✅ dealer_id付きで確認 |
| deleted_at で論理削除 | ✅ |

### invoice_items（041で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their invoice items"` |
| アプリ側: INSERT時 dealer_id = dealer.dealer_id | ✅ |

### payments（042で作成）

| 確認項目 | 状態 |
|---|---|
| `dealer_id` カラム存在 | ✅ `NOT NULL` |
| RLS 有効化 | ✅ |
| ALL policy | ✅ `"Dealer members can manage their payments"` |
| アプリ側 getCurrentDealer() 使用 | ✅ |
| FK検証（invoice_id） | ✅ dealer_id付きで確認 |
| customer_id は invoice から自動引き継ぎ | ✅ FormDataから読み取りなし |

---

## サマリー

| テーブル | dealer_id | RLS有効 | policy | アプリ側分離 |
|---|---|---|---|---|
| customers | ✅ | ✅ | ✅ | ✅ |
| vehicles | ✅ | ✅ | ✅ | ✅ |
| estimates | ✅ | ✅ | ✅ | ✅ |
| estimate_items | ✅ | ✅ | ✅ | ✅ |
| work_orders | ✅ | ✅ | ✅ | ✅ |
| work_order_files | ✅ | ✅ | ✅ (DB) | ✅ |
| completion_reports | ✅ | ✅ | ✅ | ✅ |
| invoices | ✅ | ✅ | ✅ | ✅ |
| invoice_items | ✅ | ✅ | ✅ | ✅ |
| payments | ✅ | ✅ | ✅ | ✅ |

**要対応:**
- `work_order_files`: Storage bucket の RLS policy 未設定（`STORAGE_SETUP_WORK_ORDER_FILES.md` の手順で手動作成）

---

## DB側 RLS 確認クエリ

Migration適用後、以下のSQLで確認:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'customers','vehicles','estimates','estimate_items',
    'work_orders','work_order_files','completion_reports',
    'invoices','invoice_items','payments'
  )
ORDER BY tablename;
-- rowsecurity が true であることを全テーブルで確認
```

```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'customers','vehicles','estimates','estimate_items',
    'work_orders','work_order_files','completion_reports',
    'invoices','invoice_items','payments'
  )
ORDER BY tablename, policyname;
-- 各テーブルに policy が存在することを確認
```
