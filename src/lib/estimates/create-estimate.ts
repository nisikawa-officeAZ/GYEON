"use server";

// Server Action — creates a new estimate with optional line items.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//      dealer_id is NEVER accepted from client form input.
//   2. customer_id from the form is validated to belong to the same dealer_id.
//   3. vehicle_id from the form is validated to belong to the same dealer_id.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateCategory } from "./estimate-types";
import { getNextDocumentNumber } from "@/lib/numbering/get-next-document-number";
import { createActivityLog } from "@/lib/activity/activity-log";

interface ItemInput {
  category:              EstimateCategory;
  item_name:             string;
  description:           string;
  quantity:              number;
  unit_price:            number;
  discount_rate:         number;
  sort_order:            number;
  item_type?:            "manual" | "product";
  product_id?:           string | null;
  sku?:                  string | null;
  product_name_snapshot?: string | null;
  retail_price_snapshot?: number | null;
}

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

function num(formData: FormData, key: string, fallback = 0): number {
  const v = (formData.get(key) as string | null)?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

export async function createEstimate(formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId    = str(formData, "customer_id");
  const vehicleId     = str(formData, "vehicle_id");
  const estimateNo    = str(formData, "estimate_no") ?? "";
  const status        = str(formData, "status") ?? "draft";
  const title         = str(formData, "title");
  const subtotal      = num(formData, "subtotal");
  const taxRate       = num(formData, "tax_rate", 10);
  const taxAmount     = num(formData, "tax_amount");
  const discountAmount = num(formData, "discount_amount");
  const total         = num(formData, "total");
  const validUntil    = str(formData, "valid_until");
  const notes         = str(formData, "notes");
  const internalMemo  = str(formData, "internal_memo");
  const itemsJson     = str(formData, "items_json");

  if (!customerId)  return { error: "Customer is required." };
  if (!vehicleId)   return { error: "Vehicle is required." };

  // Auto-assign number if not provided
  const resolvedNo = estimateNo || (await getNextDocumentNumber("estimate")) || "";

  const supabase = await createClient();

  // Validate customer_id belongs to the same dealer.
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id",        customerId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (customerError || !customer) {
    return { error: "Customer not found or does not belong to your dealer." };
  }

  // Validate vehicle_id belongs to the same dealer.
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id",        vehicleId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (vehicleError || !vehicle) {
    return { error: "Vehicle not found or does not belong to your dealer." };
  }

  // Insert estimate.
  const { data: newEstimate, error: estimateError } = await supabase
    .from("estimates")
    .insert({
      customer_id:     customerId,
      vehicle_id:      vehicleId,
      estimate_no:     resolvedNo,
      estimate_number: resolvedNo,
      title:           title,
      status:          status,
      subtotal:        subtotal,
      tax:             taxAmount,      // legacy column mirror
      tax_rate:        taxRate,
      tax_amount:      taxAmount,
      discount_amount: discountAmount,
      total:           total,
      valid_until:     validUntil || null,
      notes:           notes,
      internal_memo:   internalMemo,
      dealer_id:       dealer.dealer_id,   // server-injected — never from form
    })
    .select("id")
    .single();

  if (estimateError || !newEstimate) {
    console.error("[createEstimate] error:", estimateError?.message);
    return { error: estimateError?.message ?? "Failed to create estimate." };
  }

  // Insert line items if provided.
  if (itemsJson) {
    let items: ItemInput[] = [];
    try {
      items = JSON.parse(itemsJson) as ItemInput[];
    } catch {
      return { error: "Invalid items data." };
    }

    if (items.length > 0) {
      const rows = items.map((item, i) => ({
        estimate_id:            newEstimate.id,
        dealer_id:              dealer.dealer_id,
        category:               item.category               ?? "other",
        item_name:              item.item_name              ?? "",
        description:            item.description            || null,
        quantity:               item.quantity               ?? 1,
        unit_price:             item.unit_price             ?? 0,
        discount_rate:          item.discount_rate          ?? 0,
        line_total:             Math.round(
          (item.quantity ?? 1) * (item.unit_price ?? 0) * (1 - (item.discount_rate ?? 0) / 100)
        ),
        sort_order:             item.sort_order             ?? i,
        item_type:              item.item_type              ?? "manual",
        product_id:             item.product_id             ?? null,
        sku:                    item.sku                    ?? null,
        product_name_snapshot:  item.product_name_snapshot  ?? null,
        retail_price_snapshot:  item.retail_price_snapshot  ?? null,
      }));

      const { error: itemsError } = await supabase
        .from("estimate_items")
        .insert(rows);

      if (itemsError) {
        console.error("[createEstimate] items error:", itemsError.message);
        // Don't fail the whole request — estimate was created successfully.
      }
    }
  }

  void createActivityLog({
    entity_type: "estimate",
    entity_id:   newEstimate.id,
    customer_id: customerId ?? null,
    action:      "created",
    title:       `見積書を作成: ${resolvedNo}`,
  });

  revalidatePath("/estimates");
  return { success: true };
}
