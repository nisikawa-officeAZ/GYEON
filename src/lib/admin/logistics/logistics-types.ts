// Types for the Logistics Admin Console
// Tables: logistics_shipments, logistics_backorders, dealer_stock_levels, inventory_receipts

export interface LogisticsDashboardStats {
  todayReceiving:    number; // inventory_receipts received today
  pendingOrders:     number; // product_orders submitted/approved, not shipped
  backordering:      number; // logistics_backorders status='waiting'
  pendingShipments:  number; // logistics_shipments ready/picking/packed
  shippedToday:      number; // logistics_shipments shipped_at::date = today
  lowStockAlerts:    number; // dealer_stock_levels total_quantity = 0
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
  note?:                   string;
}

export type AdminReceiptResult =
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
  products: { id: string; sku: string; product_name: string; units_per_case: number | null }[];
}

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  ready:     "bg-slate-700/60 text-slate-300",
  picking:   "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",
  packed:    "bg-blue-900/40 text-blue-300 border border-blue-700/50",
  shipped:   "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50",
  completed: "bg-green-900/40 text-green-300 border border-green-700/50",
};
