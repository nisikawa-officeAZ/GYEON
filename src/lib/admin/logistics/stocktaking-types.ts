// Types for warehouse stocktaking (RC-16)
// Tables: inventory_stocktaking_sessions, inventory_stocktaking_items

export type StocktakingStatus = "active" | "completed" | "cancelled";
export type StocktakingItemStatus = "pending" | "counted" | "skipped";

export interface StocktakingSession {
  id:            string;
  status:        StocktakingStatus;
  started_by:    string | null;
  started_at:    string;
  completed_by:  string | null;
  completed_at:  string | null;
  note:          string | null;
  created_at:    string;
  updated_at:    string;
}

export interface StocktakingItem {
  id:                      string;
  session_id:              string;
  product_id:              string;
  barcode:                 string | null;
  units_per_case_snapshot: number;
  expected_quantity:       number | null;
  case_count:              number;
  loose_count:             number;
  counted_quantity:        number;
  difference_quantity:     number | null;
  counted_by:              string | null;
  counted_at:              string | null;
  status:                  StocktakingItemStatus;
  // Joined from gyeon_products
  sku:                     string;
  product_name:            string;
  category:                string | null;
  size_label:              string | null;
}

export interface StocktakingSessionWithItems {
  session:     StocktakingSession;
  items:       StocktakingItem[];
  totalCount:  number;
  doneCount:   number;
  adminName:   string | null;
}

export interface StocktakingSessionSummary {
  id:              string;
  status:          StocktakingStatus;
  started_at:      string;
  completed_at:    string | null;
  note:            string | null;
  total_items:     number;
  counted_items:   number;
  started_by_name: string | null;
}

export interface SaveCountInput {
  sessionId: string;
  itemId:    string;
  caseCount: number;
  looseCount: number;
}

export type SaveCountResult =
  | { success: true; countedQuantity: number }
  | { success: false; error: string };

export type StartSessionResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

export type FinalizeResult =
  | { success: true }
  | { success: false; error: string };
