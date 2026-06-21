// Pure types — no "use server" directive

export type OrderStatus = "draft" | "submitted" | "approved" | "cancelled";

export interface ProductOrderItemDB {
  id:                    string;
  order_id:              string;
  product_id:            string | null;
  sku:                   string;
  product_name_snapshot: string;
  retail_price_snapshot: number | null;
  quantity:              number;
  subtotal:              number;
  created_at:            string;
}

export interface ProductOrderDB {
  id:                   string;
  dealer_id:            string;
  order_number:         string | null;
  status:               OrderStatus;
  order_date:           string | null;
  notes:                string | null;
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
    case "cancelled": return "キャンセル";
  }
}

export function orderStatusColor(status: OrderStatus): string {
  switch (status) {
    case "draft":     return "text-slate-400";
    case "submitted": return "text-blue-400";
    case "approved":  return "text-green-400";
    case "cancelled": return "text-red-400";
  }
}

export function orderDisplayNo(order: Pick<ProductOrderDB, "order_number" | "id">): string {
  return order.order_number ?? `PO-${order.id.slice(0, 8).toUpperCase()}`;
}

export function orderTotal(items: ProductOrderItemDB[]): number {
  return items.reduce((s, i) => s + i.subtotal, 0);
}
