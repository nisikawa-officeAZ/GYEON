"use server";

// Server Action — updates an existing estimate.
// Line items are replaced (delete + re-insert) on every save.
//
// Security rules:
//   1. Update is scoped by BOTH id AND dealer_id from dealer_members.
//   2. customer_id and vehicle_id changes are validated against dealer_id.
//   3. dealer_id is NEVER changeable via this action.

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { EstimateCategory } from "./estimate-types";
import { calculateEstimateTotals } from "@/lib/pricing/estimate-totals";

interface ItemInput {
  category:      EstimateCategory;
  item_name:     string;
  description:   string;
  quantity:      number;
  unit_price:    number;
  discount_rate: number;
  sort_order:    number;
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

export async function updateEstimate(estimateId: string, formData: FormData) {
  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const customerId     = str(formData, "customer_id");
  const vehicleId      = str(formData, "vehicle_id");
  const estimateNo     = str(formData, "estimate_no") ?? "";
  const status         = str(formData, "status") ?? "draft";
  const title          = str(formData, "title");
  const subtotal       = num(formData, "subtotal");
  const taxRate        = num(formData, "tax_rate", 10);
  const taxAmount      = num(formData, "tax_amount");
  const discountAmount = num(formData, "discount_amount");
  const total          = num(formData, "total");
  const validUntil     = str(formData, "valid_until");
  const notes          = str(formData, "notes");
  const internalMemo   = str(formData, "internal_memo");
  const itemsJson      = str(formData, "items_json");

  if (!customerId) return { error: "Customer is required." };
  if (!vehicleId)  return { error: "Vehicle is required." };
  if (!estimateNo) return { error: "Estimate No is required." };

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

  // Parse line items payload (if present) and recompute totals SERVER-SIDE.
  // Server-computed totals are authoritative; client subtotal/tax/total are a
  // fallback only when no line items are submitted.
  const hasItemsPayload = itemsJson !== null;
  let items: ItemInput[] = [];
  if (hasItemsPayload) {
    try {
      items = JSON.parse(itemsJson as string) as ItemInput[];
    } catch {
      // Reject malformed payload instead of silently wiping items / falling back
      // to client totals (consistent with createEstimate).
      return { error: "見積明細データが不正です" };
    }
  }
  const computed = items.length > 0
    ? calculateEstimateTotals(items, discountAmount, taxRate)
    : null;
  const finalSubtotal = computed?.subtotal        ?? subtotal;
  const finalDiscount = computed?.discount_amount ?? discountAmount;
  const finalTaxRate  = computed?.tax_rate        ?? taxRate;
  const finalTax      = computed?.tax_amount      ?? taxAmount;
  const finalTotal    = computed?.total           ?? total;

  // Update the estimate record.
  const { error: updateError } = await supabase
    .from("estimates")
    .update({
      customer_id:     customerId,
      vehicle_id:      vehicleId,
      estimate_no:     estimateNo,
      estimate_number: estimateNo,
      title:           title,
      status:          status,
      subtotal:        finalSubtotal,
      tax:             finalTax,        // legacy column mirror
      tax_rate:        finalTaxRate,
      tax_amount:      finalTax,
      discount_amount: finalDiscount,
      total:           finalTotal,
      valid_until:     validUntil || null,
      notes:           notes,
      internal_memo:   internalMemo,
      updated_at:      new Date().toISOString(),
    })
    .eq("id",        estimateId)
    .eq("dealer_id", dealer.dealer_id);   // scope to current dealer only

  if (updateError) {
    console.error("[updateEstimate] error:", updateError.message);
    return { error: updateError.message };
  }

  // Replace line items: delete existing, re-insert (items already parsed above).
  if (hasItemsPayload) {
    // Delete all existing items for this estimate.
    const { error: deleteError } = await supabase
      .from("estimate_items")
      .delete()
      .eq("estimate_id", estimateId)
      .eq("dealer_id",   dealer.dealer_id);

    if (deleteError) {
      console.error("[updateEstimate] delete items error:", deleteError.message);
    }

    if (items.length > 0) {
      const rows = items.map((item, i) => ({
        estimate_id:   estimateId,
        dealer_id:     dealer.dealer_id,
        category:      item.category      ?? "other",
        item_name:     item.item_name     ?? "",
        description:   item.description   || null,
        quantity:      item.quantity      ?? 1,
        unit_price:    item.unit_price    ?? 0,
        discount_rate: item.discount_rate ?? 0,
        line_total:    Math.round(
          (item.quantity ?? 1) * (item.unit_price ?? 0) * (1 - (item.discount_rate ?? 0) / 100)
        ),
        sort_order:    item.sort_order    ?? i,
      }));

      const { error: itemsError } = await supabase
        .from("estimate_items")
        .insert(rows);

      if (itemsError) {
        console.error("[updateEstimate] insert items error:", itemsError.message);
      }
    }
  }

  revalidatePath("/estimates");
  return { success: true };
}
