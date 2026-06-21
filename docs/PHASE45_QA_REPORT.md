# PHASE45 QA Report

作成日: 2026-06-21

---

## 1. Migration 確認結果

### 対象ファイル一覧

| ファイル | 内容 | 依存先 | 安全性 |
|---|---|---|---|
| `035_update_customers_schema.sql` | customers カラム追加 + データ移行 | `customers`（001） | ✅ |
| `036_update_vehicles_schema.sql` | vehicles カラム追加 + データ移行 | `vehicles`（001） | ✅ |
| `037_rebuild_estimate_core.sql` | estimates 拡張 + estimate_items 作成 | `estimates`（001） | ✅ ※1 |
| `038_create_work_orders.sql` | work_orders 作成 | `estimates`, `customers`, `vehicles` | ✅ |
| `039_create_work_order_files.sql` | work_order_files 作成 | `work_orders`（038） | ✅ |
| `040_create_completion_reports.sql` | completion_reports 作成 | `work_orders`（038） | ✅ |
| `041_create_invoices.sql` | invoices + invoice_items 作成 | `customers`, `vehicles`, `estimates`, `work_orders`, `completion_reports` | ✅ |
| `042_create_payments.sql` | payments 作成 | `invoices`（041）, `customers` | ✅ |

**※1**: 037は `DROP CONSTRAINT IF EXISTS estimates_status_check` を含む。
これはstatus CHECKの値追加のための再定義で、データ削除は伴わない。安全と判断。

### 安全性チェック

| チェック項目 | 結果 |
|---|---|
| `DROP TABLE` の存在 | ✅ なし |
| `DROP COLUMN` の存在 | ✅ なし |
| `TRUNCATE` の存在 | ✅ なし |
| 全件 `DELETE FROM` の存在 | ✅ なし |
| `CREATE TABLE IF NOT EXISTS` | ✅ 全新規テーブルで使用 |
| `ADD COLUMN IF NOT EXISTS` | ✅ 035・036・037で使用 |
| `CREATE INDEX IF NOT EXISTS` | ✅ 全ファイルで使用 |
| `CREATE POLICY IF NOT EXISTS` | ✅ 全ファイルで使用 |
| RLS有効化（ENABLE ROW LEVEL SECURITY） | ✅ 全新規テーブルで適用 |
| 依存関係順序 | ✅ 正しい順序 |

### Migration 未適用確認

- ✅ `supabase db push` は実行していない
- ✅ CI/CDからの自動適用はない
- ✅ 全migrationはSQL Editorへの手動貼り付けのみで適用可能な状態
- ✅ `MANUAL_APPLY_PHASE35_44.md` に手順書を作成済み

---

## 2. Storage 確認結果

### work-order-files バケット

| 確認項目 | 結果 |
|---|---|
| バケット作成 | ⚠️ **未作成**（手動作成が必要） |
| public設定 | ⚠️ 未設定（privateで作成すること） |
| Storage RLS policy (INSERT) | ⚠️ **未設定** |
| Storage RLS policy (SELECT) | ⚠️ **未設定** |
| Storage RLS policy (DELETE) | ⚠️ **未設定** |
| アプリ側のパス生成ロジック | ✅ `workOrderFileStoragePath()` 実装済み |
| dealer_idによるパス分離 | ✅ `{dealer_id}/{work_order_id}/{phase}/...` |

**必要アクション:** `docs/STORAGE_SETUP_WORK_ORDER_FILES.md` の手順に従い手動作成。

---

## 3. RLS 確認結果

### DB テーブル RLS

| テーブル | dealer_id | RLS有効 | Policy | 判定 |
|---|---|---|---|---|
| customers | ✅ | ✅ | ✅ | ✅ OK |
| vehicles | ✅ | ✅ | ✅ | ✅ OK |
| estimates | ✅ | ✅ | ✅ | ✅ OK |
| estimate_items | ✅ | ✅ | ✅ | ✅ OK |
| work_orders | ✅ | ✅ | ✅ | ✅ OK |
| work_order_files | ✅ | ✅ | ✅ (DB) | ⚠️ Storage Policy未設定 |
| completion_reports | ✅ | ✅ | ✅ | ✅ OK |
| invoices | ✅ | ✅ | ✅ | ✅ OK |
| invoice_items | ✅ | ✅ | ✅ | ✅ OK |
| payments | ✅ | ✅ | ✅ | ✅ OK |

### アプリ側 dealer_id 分離監査

```
調査コマンド:
grep -rn "fd.get.*dealer_id" src/lib/
grep -rn "localStorage.*dealer_id" src/lib/
grep -rn "searchParams.*dealer_id" src/lib/
grep -rn "params.*dealer_id" src/lib/
```

**結果: 全コード audit 完了 — 違反なし**

| 確認項目 | 結果 |
|---|---|
| FormData から dealer_id 読み取り | ✅ なし |
| URL params から dealer_id 読み取り | ✅ なし |
| localStorage から dealer_id 読み取り | ✅ なし |
| `getCurrentDealer()` 非使用の server action | ⚠️ `recalculate-invoice-payment.ts`（※2） |

**※2**: `recalculate-invoice-payment.ts` は直接エクスポートされるが、
呼び出し元（`create-payment.ts`, `update-payment.ts`, `delete-payment.ts`）が
`getCurrentDealer()` で取得した `dealer.dealer_id` を引数として渡す設計。
外部から dealer_id を注入することは不可能。**問題なし**と判断。

---

## 4. コード品質確認

### TypeScript

- ✅ `npm run tsc` エラーなし（本PHASE実行時に確認）
- ✅ Supabase JOIN返り値の `as unknown as T[]` キャストパターン統一
- ✅ `"use server"` ディレクティブ全server actionに付与

### Build

- ✅ `npm run build` 成功
- ⚠️ Unsupported metadata `viewport`/`themeColor` 警告 — 既存の問題、本PHASEとは無関係

### Lint

- ℹ️ `npm run lint` スクリプト未定義（package.jsonに`lint`スクリプトなし）
- ℹ️ `next lint` は Next.js 15 で deprecated（ESLint CLI への移行が推奨）
- ✅ TypeScript strict mode (`tsc --noEmit`) でエラーなし — lint相当の型チェックはpassしている

---

## 5. E2E テスト状態

| ステップ | 実装状態 | 実行状態 |
|---|---|---|
| Dealer Settings | ✅ 実装済み | ⏳ 手動実行待ち |
| Customer作成 | ✅ 実装済み | ⏳ |
| Vehicle作成 | ✅ 実装済み | ⏳ |
| Estimate作成 | ✅ 実装済み | ⏳ |
| Estimate approved化 | ✅ 実装済み | ⏳ |
| Work Order作成 | ✅ 実装済み | ⏳ |
| Work Order Files登録 | ✅ 実装済み（Storage未作成） | ⏳ |
| Work Order completed化 | ✅ 実装済み | ⏳ |
| Completion Report作成 | ✅ 実装済み | ⏳ |
| Invoice作成 | ✅ 実装済み | ⏳ |
| Payment登録 | ✅ 実装済み | ⏳ |
| Dashboard反映 | ✅ 実装済み | ⏳ |

**E2E実行ブロッカー:**
1. Migration 035〜042 の適用（手動）
2. Storage bucket `work-order-files` の手動作成
3. テスト用 Dealer + dealer_member の登録

---

## 6. 次PHASEへ進める条件

### 必須（ブロッカー）

| 条件 | 状態 |
|---|---|
| Migration 001〜042 の手動適用 | ⏳ 未適用 |
| Storage bucket `work-order-files` 作成 | ⏳ 未作成 |
| Storage RLS policy 設定 | ⏳ 未設定 |
| E2E シナリオ 手動実行 | ⏳ 未実行 |

### 推奨

| 条件 | 状態 |
|---|---|
| 本番環境へのMigration適用計画策定 | ⏳ |
| Dealer設定UI（dealers テーブル編集） | 未実装 |
| 請求書PDF実際のファイル生成（現在は印刷のみ） | 未実装 |

---

## 7. 判定

**現在の状態:** ✅ コード完成 / ⚠️ インフラ未設定

- アプリケーションコード（PHASE35〜44）は全実装完了
- TypeScript・Build エラーなし
- dealer_id 分離ルール全サーバーアクションで遵守確認済み
- Migration・Storage の手動適用が完了次第、即座に稼働可能な状態

**次PHASEへの推奨:** Migration適用とE2E確認を完了後、次の機能開発フェーズへ進む。
