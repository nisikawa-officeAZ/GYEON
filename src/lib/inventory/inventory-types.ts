// Inventory counting types
// DB table: dealer_stock_levels (migration 069_inventory_counting.sql)
//
// Counting formula:
//   total_quantity = case_count × units_per_case_used + loose_count

export interface StockLevel {
  id:                  string;
  dealer_id:           string;
  product_id:          string;
  case_count:          number;
  loose_count:         number;
  units_per_case_used: number;
  total_quantity:      number;
  last_counted_at:     string;
  last_counted_by:     string | null;
  notes:               string | null;
  created_at:          string;
  updated_at:          string;
}

// Product + stock level joined row for the inventory UI
export interface ProductWithStock {
  product_id:          string;
  sku:                 string;
  product_name:        string;
  category:            string | null;
  size_label:          string | null;
  units_per_case:      number | null; // Product default (may be null if not set)
  // Stock level — null if this dealer has never counted this product
  stock:               StockLevel | null;
}

export interface StockCountInput {
  product_id:          string;
  case_count:          number;
  loose_count:         number;
  units_per_case_used: number; // User-confirmed value for this count
  notes?:              string;
}

export type UpsertStockResult =
  | { success: true;  stock: StockLevel }
  | { success: false; error: string };

// ─── Movement types (migration 072) ───────────────────────────────────────────

export type MovementType =
  | "receive"
  | "adjustment_in"
  | "adjustment_out"
  | "sale"
  | "return"
  | "damage"
  | "transfer";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  receive:        "入荷",
  adjustment_in:  "在庫増加",
  adjustment_out: "在庫減少",
  sale:           "販売",
  return:         "返品",
  damage:         "破損",
  transfer:       "移動",
};

export interface StockMovement {
  id:                      string;
  dealer_id:               string;
  product_id:              string;
  movement_type:           MovementType;
  quantity_delta:          number; // signed: + in, - out
  case_count:              number;
  loose_count:             number;
  units_per_case_snapshot: number;
  balance_after:           number;
  source_type:             string | null;
  source_id:               string | null;
  note:                    string | null;
  created_by:              string | null;
  created_at:              string;
}

export interface InventoryReceipt {
  id:                      string;
  dealer_id:               string;
  product_id:              string;
  case_count:              number;
  loose_count:             number;
  units_per_case_snapshot: number;
  total_quantity:          number;
  received_at:             string;
  received_by:             string | null;
  note:                    string | null;
  created_at:              string;
}

export interface CreateReceiptInput {
  product_id:              string;
  case_count:              number;
  loose_count:             number;
  units_per_case_snapshot: number;
  note?:                   string;
}

export type CreateReceiptResult =
  | { success: true;  receipt: InventoryReceipt; stock: StockLevel }
  | { success: false; error: string };

export type GetMovementsResult = Array<
  StockMovement & { product_name: string; sku: string }
>;
