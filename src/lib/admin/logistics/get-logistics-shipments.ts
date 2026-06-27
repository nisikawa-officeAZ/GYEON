"use server";

import { requireAdmin } from "../require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogisticsShipmentRow, ShipmentStatus } from "./logistics-types";

export async function getLogisticsShipments(): Promise<LogisticsShipmentRow[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const [shipmentsRes, dealersRes, adminsRes] = await Promise.all([
    supabase
      .from("logistics_shipments")
      .select("*, product_orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("dealers")
      .select("id, name"),
    supabase
      .from("admin_users")
      .select("id, name"),
  ]);

  const dealerMap = new Map<string, string>(
    ((dealersRes.data ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
  );
  const adminMap = new Map<string, string>(
    ((adminsRes.data ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name])
  );

  return ((shipmentsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const order = r.product_orders as Record<string, unknown> | null;
    return {
      id:              r.id as string,
      dealer_id:       r.dealer_id as string,
      dealer_name:     dealerMap.get(r.dealer_id as string) ?? "—",
      order_number:    (order?.order_number as string | null) ?? null,
      status:          r.status as ShipmentStatus,
      tracking_number: (r.tracking_number as string | null) ?? null,
      carrier:         (r.carrier         as string | null) ?? null,
      notes:           (r.notes           as string | null) ?? null,
      assigned_name:   r.assigned_admin_id ? (adminMap.get(r.assigned_admin_id as string) ?? null) : null,
      picked_at:       (r.picked_at    as string | null) ?? null,
      packed_at:       (r.packed_at    as string | null) ?? null,
      shipped_at:      (r.shipped_at   as string | null) ?? null,
      completed_at:    (r.completed_at as string | null) ?? null,
      created_at:      r.created_at as string,
    };
  });
}

export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatus,
  trackingNumber?: string,
  carrier?: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updated_at: now };

  if (status === "picking"   && !updates.picked_at)    updates.picked_at    = now;
  if (status === "packed"    && !updates.packed_at)    updates.packed_at    = now;
  if (status === "shipped"   && !updates.shipped_at)   updates.shipped_at   = now;
  if (status === "completed" && !updates.completed_at) updates.completed_at = now;
  if (trackingNumber) updates.tracking_number = trackingNumber;
  if (carrier)        updates.carrier         = carrier;

  const { error } = await supabase
    .from("logistics_shipments")
    .update(updates)
    .eq("id", shipmentId);

  return error ? { success: false, error: error.message } : { success: true };
}
