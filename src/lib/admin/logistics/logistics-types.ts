// Types for the Logistics Admin Console
// Tables: logistics_shipments, logistics_backorders, dealer_stock_levels, inventory_receipts

export interface LogisticsDashboardStats {
  todayReceiving:    number; // inventory_receipts received today
  pendingOrders:     number; // product_orders submitted/approved, not shipped
  backordering:      number; // logistics_backorders status='waiting'
  pendingShipments:  number; // logistics_shipments ready/picking/packed
  shippedToday:      number; // logistics_shipments shipped_at::date = today
  lowStockAlerts:    number; // dealer_stock_levels total_quantity = 0
  todayAdjustments:  number; // warehouse_adjustments created today
}

export interface LogisticsInventoryRow {
  dealer_id:          string;
  dealer_name:        string;
  product_id:         string;
  sku:                string;
  product_name:       string;
  category:           string | null;
  size_label:         string | null;
  units_per_case:     number | null;
  case_count:         number;
  loose_count:        number;
  total_quantity:     number;
  reserved_qty:       number;
  available_qty:      number;
  last_counted_at:    string;
}

export interface LogisticsReceivingRecord {
  id:                     string;
  dealer_id:              string;
  dealer_name:            string;
  product_id:             string;
  sku:                    string;
  product_name:           string;
  case_count:             number;
  loose_count:            number;
  damaged_count:          number;
  total_quantity:         number;
  units_per_case_snapshot: number;
  received_at:            string;
  note:                   string | null;
}

export interface AdminReceiptInput {
  dealer_id:               string;
  product_id:              string;
  case_count:              number;
  loose_count:             number;
  damaged_count:           number;
  units_per_case_snapshot: number;
  supplier?:               string;
  po_number?:              string;
  received_date?:          string; // ISO date yyyy-mm-dd
  note?:                   string;
}

export type AdminReceiptResult =
  | { success: true }
  | { success: false; error: string };

// ─── Warehouse Adjustments ────────────────────────────────────────────────────

export type AdjustmentType = "damage" | "loss" | "internal_use" | "sample" | "correction";

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  damage:       "破損",
  loss:         "紛失",
  internal_use: "社内使用",
  sample:       "サンプル",
  correction:   "在庫補正",
};

export interface WarehouseAdjustmentInput {
  dealer_id:               string;
  product_id:              string;
  adjustment_type:         AdjustmentType;
  reason:                  string;
  quantity_delta:          number; // signed: negative = out, positive = in
  case_count:              number;
  loose_count:             number;
  units_per_case_snapshot: number;
  note?:                   string;
}

export interface WarehouseAdjustmentRow {
  id:                      string;
  dealer_id:               string;
  dealer_name:             string;
  product_id:              string;
  sku:                     string;
  product_name:            string;
  adjustment_type:         AdjustmentType;
  reason:                  string;
  quantity_delta:          number;
  balance_after:           number;
  performed_by_name:       string | null;
  note:                    string | null;
  created_at:              string;
}

export type AdjustmentResult =
  | { success: true }
  | { success: false; error: string };

// ─── Stock Movements ──────────────────────────────────────────────────────────

export interface AdminStockMovementRow {
  id:                string;
  dealer_id:         string;
  dealer_name:       string;
  product_id:        string;
  sku:               string;
  product_name:      string;
  movement_type:     string;
  quantity_delta:    number;
  balance_after:     number;
  source_type:       string | null;
  note:              string | null;
  adjustment_reason: string | null;
  created_by_name:   string | null;
  created_at:        string;
}

// ─── PO Receiving ────────────────────────────────────────────────────────────

export type PoFulfillmentStatus = "pending" | "partial" | "fulfilled" | "backordered";
export type ExtendedOrderStatus = "draft" | "submitted" | "approved" | "fulfilling" | "fulfilled" | "cancelled";

export interface PoFulfillmentLine {
  id:                    string;
  product_order_id:      string;
  product_id:            string | null;
  sku_snapshot:          string;
  product_name_snapshot: string;
  ordered_qty:           number;
  fulfilled_qty:         number;
  backordered_qty:       number;
  remaining_qty:         number; // computed: ordered - fulfilled - backordered
  status:                PoFulfillmentStatus;
  note:                  string | null;
}

export interface PendingProductOrder {
  id:             string;
  dealer_id:      string;
  dealer_name:    string;
  order_number:   string | null;
  status:         ExtendedOrderStatus;
  order_date:     string | null;
  created_at:     string;
  item_count:     number;
  total_qty:      number;
  lines:          PoFulfillmentLine[];
}

export type PoReceivingResult =
  | { success: true }
  | { success: false; error: string };

export interface LogisticsBackorderRow {
  id:                    string;
  dealer_id:             string;
  dealer_name:           string;
  product_id:            string | null;
  sku:                   string | null;
  product_name:          string | null;
  ordered_qty:           number;
  waiting_qty:           number;
  expected_arrival_date: string | null;
  target_delivery_date:  string | null;
  status:                "waiting" | "partial" | "fulfilled" | "cancelled";
  notes:                 string | null;
  order_number:          string | null;
  created_at:            string;
}

export type ShipmentStatus = "ready" | "picking" | "packed" | "shipped" | "completed";

export interface LogisticsShipmentRow {
  id:               string;
  dealer_id:        string;
  dealer_name:      string;
  order_number:     string | null;
  status:           ShipmentStatus;
  tracking_number:  string | null;
  carrier:          string | null;
  notes:            string | null;
  assigned_name:    string | null;
  picked_at:        string | null;
  packed_at:        string | null;
  shipped_at:       string | null;
  completed_at:     string | null;
  created_at:       string;
}

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  ready:     "Ready",
  picking:   "Picking",
  packed:    "Packed",
  shipped:   "Shipped",
  completed: "Completed",
};

export interface ReceivingFormData {
  dealers:  { id: string; name: string }[];
  products: { id: string; sku: string; product_name: string; units_per_case: number | null; jan_code?: string | null }[];
}

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  ready:     "bg-slate-700/60 text-slate-300",
  picking:   "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",
  packed:    "bg-blue-900/40 text-blue-300 border border-blue-700/50",
  shipped:   "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50",
  completed: "bg-green-900/40 text-green-300 border border-green-700/50",
};
