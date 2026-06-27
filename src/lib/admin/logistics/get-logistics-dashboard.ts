"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogisticsDashboardStats } from "./logistics-types";

export async function getLogisticsDashboardStats(): Promise<LogisticsDashboardStats> {
  await requireAdmin();
  const supabase = createAdminClient();

  const today = new Date().toISOString().split("T")[0];

  const [
    receivingRes,
    pendingOrdersRes,
    backorderingRes,
    pendingShipmentsRes,
    shippedTodayRes,
    lowStockRes,
    todayAdjustmentsRes,
  ] = await Promise.all([
    // Today's receiving records
    supabase
      .from("inventory_receipts")
      .select("id", { count: "exact", head: true })
      .gte("received_at", `${today}T00:00:00.000Z`)
      .lt("received_at",  `${today}T23:59:59.999Z`),

    // Product orders awaiting fulfillment (includes fulfilling)
    supabase
      .from("product_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "approved", "fulfilling"]),

    // Backorders waiting
    supabase
      .from("logistics_backorders")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting"),

    // Shipments in progress
    supabase
      .from("logistics_shipments")
      .select("id", { count: "exact", head: true })
      .in("status", ["ready", "picking", "packed"]),

    // Shipped today
    supabase
      .from("logistics_shipments")
      .select("id", { count: "exact", head: true })
      .eq("status", "shipped")
      .gte("shipped_at", `${today}T00:00:00.000Z`)
      .lt("shipped_at",  `${today}T23:59:59.999Z`),

    // Zero stock alerts (any dealer, any product)
    supabase
      .from("dealer_stock_levels")
      .select("id", { count: "exact", head: true })
      .eq("total_quantity", 0),

    // Today's stock adjustments
    supabase
      .from("warehouse_adjustments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at",  `${today}T23:59:59.999Z`),
  ]);

  return {
    todayReceiving:    receivingRes.count          ?? 0,
    pendingOrders:     pendingOrdersRes.count      ?? 0,
    backordering:      backorderingRes.count       ?? 0,
    pendingShipments:  pendingShipmentsRes.count   ?? 0,
    shippedToday:      shippedTodayRes.count       ?? 0,
    lowStockAlerts:    lowStockRes.count            ?? 0,
    todayAdjustments:  todayAdjustmentsRes.count   ?? 0,
  };
}
