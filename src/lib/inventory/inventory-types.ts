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
