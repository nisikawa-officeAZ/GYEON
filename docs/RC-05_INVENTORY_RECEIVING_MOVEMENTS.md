# RC-05 — Inventory Receiving & Stock Movement Foundation

Sprint completed: 2026-06-27

---

## Overview

RC-05 extends the inventory system (built in RC-04 / migration 069) with:

1. **Receiving** — record incoming stock deliveries that additively increase current stock
2. **Stock movements** — an immutable audit log of every stock change event
3. **UI improvements** — receiving form, movement history panel, improved stock breakdown display

---

## Migration

**File:** `supabase/migrations/072_inventory_receiving_movements.sql`

**Status:** NOT auto-applied. Must be pasted into Supabase SQL Editor manually.

**Apply steps:**
1. Open Supabase Dashboard → SQL Editor
2. Paste the full contents of `072_inventory_receiving_movements.sql`
3. Click Run
4. Verify: `SELECT * FROM inventory_receipts LIMIT 1;` and `SELECT * FROM stock_movements LIMIT 1;`

**Tables created:**
- `inventory_receipts` — one row per receiving event
- `stock_movements` — immutable log of all stock changes

**RLS policy:** Both tables enforce dealer isolation via `dealer_members WHERE user_id = auth.uid() AND status = 'active'`. SELECT + INSERT only — no UPDATE or DELETE on either table.

---

## Tables

### `inventory_receipts`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| dealer_id | uuid | NOT NULL — from server only |
| product_id | uuid | FK → gyeon_products |
| case_count | integer | ≥ 0 |
| loose_count | integer | ≥ 0 |
| units_per_case_snapshot | integer | ≥ 1 — captured at receive time |
| total_quantity | integer | case_count × upc_snapshot + loose_count |
| received_at | timestamptz | defaults to now() |
| received_by | uuid | auth.uid() |
| note | text | nullable |
| created_at | timestamptz | defaults to now() |

Immutable — no UPDATE/DELETE. Corrections are made via `adjustment_in/out` movements.

### `stock_movements`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| dealer_id | uuid | NOT NULL — from server only |
| product_id | uuid | FK → gyeon_products |
| movement_type | text | CHECK IN ('receive','adjustment_in','adjustment_out','sale','return','damage','transfer') |
| quantity_delta | integer | signed: + = stock in, - = stock out |
| case_count | integer | breakdown at time of movement |
| loose_count | integer | breakdown at time of movement |
| units_per_case_snapshot | integer | ≥ 1 |
| balance_after | integer | stock level after this movement |
| source_type | text | 'receipt' \| 'count' \| 'manual' |
| source_id | uuid | FK to source row (e.g. inventory_receipts.id) |
| note | text | nullable |
| created_by | uuid | auth.uid() |
| created_at | timestamptz | defaults to now() |

Immutable — no UPDATE/DELETE. To correct a mistake, insert an opposing movement.

---

## Server Actions

### `receiving-actions.ts`

#### `createReceivingRecord(input: CreateReceiptInput): Promise<CreateReceiptResult>`

Flow:
1. `dealer_id` obtained from `getCurrentDealer()` (server-only — never from client)
2. `created_by` obtained from `getCurrentUser()`
3. Inputs clamped and validated server-side
4. `inventory_receipts` row inserted
5. `dealer_stock_levels` upserted — total_quantity is **additive** (not replaced)
6. `stock_movements` row inserted with `movement_type='receive'`, `source_type='receipt'`
7. Returns `{ success: true, receipt, stock }` or `{ success: false, error }`

**Graceful degradation:** If migration 072 is not applied, returns descriptive Japanese error message — does not crash.

#### `getRecentMovements(productId?, limit=10): Promise<GetMovementsResult>`

Returns recent movements for a dealer, optionally filtered by product. Joins `gyeon_products` for `product_name` and `sku`. Returns `[]` if migration 072 not applied.

### `inventory-actions.ts` (updated)

#### `upsertStockCount` (extended)

Now also records a `stock_movements` entry after each successful stocktake:
- Reads old `total_quantity` before upsert
- Computes `delta = new_total - old_total`
- If `delta != 0`: inserts movement with `movement_type = 'adjustment_in' | 'adjustment_out'`, `source_type = 'count'`
- Movement insert is non-blocking — if migration 072 is not applied, logs to console and continues

---

## Types (inventory-types.ts additions)

```typescript
type MovementType =
  | "receive" | "adjustment_in" | "adjustment_out"
  | "sale" | "return" | "damage" | "transfer";

interface StockMovement { ... }       // DB row
interface InventoryReceipt { ... }    // DB row
interface CreateReceiptInput { ... }  // Server action input
type CreateReceiptResult = ...        // Success | failure union
type GetMovementsResult = ...         // Movement[] with product_name + sku
```

---

## UI Changes (`InventoryClient.tsx`)

### Product card stock summary
**Before:** `12ケース × 6本 + 3本 = 75本`
**After:** `75本 = 12ケース + 3バラ` (total first, cleaner format)

### Action buttons
**Before:** Single "在庫入力" button per product
**After:** Two buttons per product:
- **入荷** (emerald) — opens ReceivingForm; adds to current stock
- **棚卸** (blue) — opens CountForm; sets absolute stock level

### ReceivingForm
- Shows current stock as context
- Inputs: case count, loose count, units per case (default from product)
- Live preview: incoming total + post-receive balance
- Calls `createReceivingRecord()` on save

### Movement History
- Shown below the active form when either "入荷" or "棚卸" is open
- Calls `getRecentMovements(productId, 5)` on mount
- Shows last 5 movements: ±quantity, type label, timestamp, note
- Silent empty state if migration 072 not yet applied

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `dealer_id` from `getCurrentDealer()` only | Security — dealer isolation enforced server-side |
| `units_per_case_snapshot` stored on every movement | Historical accuracy — if product default changes later, historical records remain correct |
| Receiving is additive; counting is absolute | Receiving = "stock arrived", counting = "physical audit of what's on the shelf now" |
| `balance_after` stored on each movement | Enables full audit trail reconstruction without replaying all deltas |
| No UPDATE/DELETE on receipts or movements | Immutable append-only log — corrections are new rows |
| Movement insert is non-blocking after count/receive | If 072 not applied, the primary operation (stock level update) still succeeds |

---

## Graceful Degradation

If `072_inventory_receiving_movements.sql` has not been applied:

- **入荷ボタン** → `createReceivingRecord` returns `{ success: false, error: "テーブルが未適用です..." }`
- **棚卸保存** → succeeds (uses migration 069 tables); movement insert is silently skipped
- **履歴パネル** → `getRecentMovements` returns `[]` → shows "履歴なし"

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/072_inventory_receiving_movements.sql` | **New** — migration (manual apply) |
| `src/lib/inventory/inventory-types.ts` | Added: MovementType, StockMovement, InventoryReceipt, CreateReceiptInput, CreateReceiptResult, GetMovementsResult |
| `src/lib/inventory/receiving-actions.ts` | **New** — createReceivingRecord, getRecentMovements |
| `src/lib/inventory/inventory-actions.ts` | Extended upsertStockCount to record stock movements |
| `src/app/inventory/InventoryClient.tsx` | Added ReceivingForm, MovementHistory; improved stock breakdown display; dual action buttons |
| `docs/RC-05_INVENTORY_RECEIVING_MOVEMENTS.md` | **New** — this file |
