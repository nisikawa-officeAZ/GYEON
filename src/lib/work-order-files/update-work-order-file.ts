"use server";

// Server Action — updates allowed metadata fields of a work order file.
//
// Allowed fields: phase, title, description, sort_order
// Forbidden: dealer_id, work_order_id, file_path (immutable after upload)
//
// Security rules:
//   1. Record is validated against dealer_id before update.
//   2. dealer_id, work_order_id, file_path cannot be changed.

import { revalidatePath }  from "next/cache";
import { createClient }    from "@/lib/supabase/server";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { WorkOrderFilePhase } from "./work-order-file-types";

function str(formData: FormData, key: string): string | null {
  return (formData.get(key) as string | null)?.trim() || null;
}

export async function updateWorkOrderFile(fileId: string, formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const phase       = str(formData, "phase")       as WorkOrderFilePhase | null;
  const title       = str(formData, "title");
  const description = str(formData, "description");
  const sortOrderRaw = (formData.get("sort_order") as string | null)?.trim();
  const sortOrder   = sortOrderRaw !== undefined && sortOrderRaw !== null && sortOrderRaw !== ""
    ? Number(sortOrderRaw) : undefined;
  const supabase = await createClient();

  // Build update payload — only include defined fields.
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (phase       !== null && phase !== undefined) updatePayload.phase       = phase;
  if (title       !== undefined)                   updatePayload.title       = title;
  if (description !== undefined)                   updatePayload.description = description;
  if (sortOrder   !== undefined && !isNaN(sortOrder)) updatePayload.sort_order = sortOrder;

  const { data: updatedRow, error } = await supabase
    .from("work_order_files")
    .update(updatePayload)
    .eq("id",        fileId)
    .eq("dealer_id", auth.dealerId)
    .select("id")
    .maybeSingle();

  if (error || !updatedRow) {
    console.error("[updateWorkOrderFile] update failed");
    return { error: "ファイル情報を更新できませんでした。時間をおいて再度お試しください。" };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
