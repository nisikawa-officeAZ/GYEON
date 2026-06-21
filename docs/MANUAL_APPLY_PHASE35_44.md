# Manual Apply Guide — PHASE35〜44 Migrations

## 適用対象環境

| 環境 | 適用可否 |
|---|---|
| Local (Supabase CLI) | ✅ 可 |
| Development / Staging | ✅ 可 |
| **Production** | ❌ **適用禁止** |

> 本番環境への適用は別途レビュー・承認プロセスを経てから実施する。

---

## 事前確認事項

1. **バックアップ必須**: 適用前に対象DBのバックアップを取得すること
2. **適用順序を厳守**: 依存関係があるため番号順に実行すること
3. **1ファイルずつ適用**: まとめて実行せず、1SQLごとに検証クエリを実行すること
4. **自動実行禁止**: CI/CD・supabase db push での自動適用は禁止

---

## SQL適用順（依存関係順）

```
001_create_core_tables.sql          ← 基盤テーブル（customers, vehicles, estimates, etc.）
002_enable_rls.sql                  ← RLS有効化
003_create_dealers_and_members.sql  ← dealers / dealer_members
004_enable_saas_rls.sql             ← SaaS RLS

--- 以下が PHASE35〜44 対象 ---

035_update_customers_schema.sql     ← customers 拡張（ADD COLUMN のみ）
036_update_vehicles_schema.sql      ← vehicles 拡張（ADD COLUMN のみ）
037_rebuild_estimate_core.sql       ← estimates 拡張 + estimate_items 作成
038_create_work_orders.sql          ← work_orders 作成
039_create_work_order_files.sql     ← work_order_files 作成 + Storage設定(手動)
040_create_completion_reports.sql   ← completion_reports 作成
041_create_invoices.sql             ← invoices + invoice_items 作成
042_create_payments.sql             ← payments 作成
```

---

## 依存関係確認

| Migration | 依存先テーブル | 状態 |
|---|---|---|
| 035 | `customers`（001で作成済み） | ✅ OK |
| 036 | `vehicles`（001で作成済み） | ✅ OK |
| 037 | `estimates`（001で作成済み） | ✅ OK |
| 038 | `estimates`, `customers`, `vehicles`（001 + 037 + 035 + 036） | ✅ OK |
| 039 | `work_orders`（038） | ✅ OK |
| 040 | `work_orders`（038） | ✅ OK |
| 041 | `customers`（035）, `vehicles`（036）, `estimates`（037）, `work_orders`（038）, `completion_reports`（040） | ✅ OK |
| 042 | `invoices`（041）, `customers`（035） | ✅ OK |

---

## Supabase SQL Editor での手順

1. Supabase Dashboard → SQL Editor を開く
2. 対象環境（Development）であることを確認
3. 以下の手順で1ファイルずつ適用:

```
a. SQLファイルの内容をSQL Editorに貼り付け
b. 「Run」ボタンをクリック
c. エラーがないことを確認
d. 下記の検証クエリを実行
e. 結果確認後、次のSQLへ
```

---

## 各SQL適用後の検証クエリ

### 035_update_customers_schema.sql

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('last_name','first_name','last_name_kana','first_name_kana',
                      'prefecture','city','address1','address2','notes','line_user_id')
ORDER BY column_name;

-- データ移行確認
SELECT id, name, last_name, first_name, kana, last_name_kana
FROM public.customers LIMIT 5;
```

### 036_update_vehicles_schema.sql

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vehicles'
  AND column_name IN ('maker','color','plate_number','body_size','mileage',
                      'inspection_expiry_date','notes','vehicle_code')
ORDER BY column_name;

-- データ移行確認
SELECT id, manufacturer, maker, body_color, color, license_plate, plate_number
FROM public.vehicles LIMIT 5;
```

### 037_rebuild_estimate_core.sql

```sql
-- estimate_items テーブル確認
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'estimate_items';

-- RLS確認
SELECT tablename, rowsecurity
FROM pg_tables WHERE tablename IN ('estimate_items') AND schemaname = 'public';

-- status constraint確認
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'estimates_status_check';
```

### 038_create_work_orders.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'work_orders';

SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'work_orders' AND schemaname = 'public';

SELECT indexname FROM pg_indexes
WHERE tablename = 'work_orders' AND schemaname = 'public';
```

### 039_create_work_order_files.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'work_order_files';

SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'work_order_files' AND schemaname = 'public';

-- Storage bucket は別途手動作成（下記STORAGE_SETUP参照）
```

### 040_create_completion_reports.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'completion_reports';

SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'completion_reports' AND schemaname = 'public';
```

### 041_create_invoices.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_items')
ORDER BY table_name;

SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('invoices','invoice_items') AND schemaname = 'public';
```

### 042_create_payments.sql

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'payments';

SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename = 'payments' AND schemaname = 'public';

SELECT indexname FROM pg_indexes
WHERE tablename = 'payments' AND schemaname = 'public';
```

---

## 安全性確認済み項目

| 確認項目 | 結果 |
|---|---|
| `DROP COLUMN` の存在 | ❌ なし（全migration確認済み） |
| `TRUNCATE` の存在 | ❌ なし |
| `DELETE FROM` (全件削除) の存在 | ❌ なし |
| `DROP TABLE` の存在 | ❌ なし |
| `CREATE TABLE IF NOT EXISTS` の使用 | ✅ すべて使用 |
| `ADD COLUMN IF NOT EXISTS` の使用 | ✅ 035・036・037で使用 |
| `CREATE INDEX IF NOT EXISTS` の使用 | ✅ すべて使用 |
| `CREATE POLICY IF NOT EXISTS` の使用 | ✅ すべて使用 |

> **注意**: 037のみ `DROP CONSTRAINT IF EXISTS estimates_status_check` を含む。
> これはCONSTRAINT の再定義（status値を追加）のためで、データ削除ではない。
> 既存estimatesのstatusデータは保持される。

---

## Rollback不可項目

以下の操作はロールバック不可:

- `ADD COLUMN`: カラム追加後は手動で `DROP COLUMN` が必要（禁止）
- `CREATE TABLE`: テーブル作成後は手動で `DROP TABLE` が必要（禁止）
- `UPDATE`: データ移行クエリは実行後に元の状態に戻せない（バックアップ必須）

---

## 適用前バックアップ手順

```bash
# Supabase CLIの場合
supabase db dump --db-url "postgresql://..." -f backup_before_phase35-44_$(date +%Y%m%d).sql

# または Supabase Dashboard > Settings > Database > Backups から手動バックアップ
```
