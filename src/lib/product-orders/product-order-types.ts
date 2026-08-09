// Pure types — no "use server" directive

export type OrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "fulfilling"
  | "fulfilled"
  | "cancelled";

export interface ProductOrderItemDB {
  id:                    string;
  order_id:              string;
  product_id:            string | null;
  sku:                   string;
  product_name_snapshot: string;
  retail_price_snapshot: number | null;
  quantity:              number;
  subtotal:              number;
  offer_version_snapshot?: number | null;
  buyer_rank_snapshot?: string | null;
  order_unit_qty_snapshot?: number | null;
  list_price_ex_tax_yen_snapshot?: number | null;
  list_price_inc_tax_yen_snapshot?: number | null;
  unit_discount_ex_tax_yen_snapshot?: number | null;
  unit_discount_inc_tax_yen_snapshot?: number | null;
  tax_rate_bps_snapshot?: number | null;
  line_list_subtotal_inc_tax_yen?: number | null;
  line_payable_subtotal_inc_tax_yen?: number | null;
  supply_availability_snapshot?: string | null;
  backorder_allowed_snapshot?: boolean | null;
  created_at:            string;
}

export interface ProductOrderDB {
  id:                   string;
  dealer_id:            string;
  order_number:         string | null;
  status:               OrderStatus;
  order_date:           string | null;
  notes:                string | null;
  created_by?:          string | null;
  buyer_rank_snapshot?: string | null;
  payment_method?:      "card" | null;
  free_shipping_basis?: "list_price_inc_tax_before_discount" | null;
  free_shipping_threshold_yen?: number | null;
  shipping_basis_yen?: number | null;
  shipping_zone_code?: string | null;
  shipping_rate_version_snapshot?: number | null;
  shipping_fee_yen?: number | null;
  free_shipping?: boolean | null;
  product_subtotal_inc_tax_yen?: number | null;
  payable_amount_yen?: number | null;
  idempotency_key?: string | null;
  created_at:           string;
  updated_at:           string;
  product_order_items?: ProductOrderItemDB[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "draft":     return "下書き";
    case "submitted": return "注文済み";
    case "approved":  return "承認済み";
    case "fulfilling": return "出荷準備中";
    case "fulfilled":  return "出荷・決済完了";
    case "cancelled": return "キャンセル";
  }
}

export function orderStatusColor(status: OrderStatus): string {
  switch (status) {
    case "draft":     return "text-slate-400";
    case "submitted": return "text-blue-400";
    case "approved":  return "text-green-400";
    case "fulfilling": return "text-amber-400";
    case "fulfilled":  return "text-emerald-400";
    case "cancelled": return "text-red-400";
  }
}

export function orderDisplayNo(order: Pick<ProductOrderDB, "order_number" | "id">): string {
  return order.order_number ?? `PO-${order.id.slice(0, 8).toUpperCase()}`;
}

export function orderTotal(items: ProductOrderItemDB[]): number {
  return items.reduce((s, i) => s + i.subtotal, 0);
}
