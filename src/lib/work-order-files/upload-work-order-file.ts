"use server";

// Server Action — uploads a file to Supabase Storage and inserts metadata.
//
// Security rules:
//   1. dealer_id is ALWAYS injected server-side from dealer_members.
//   2. work_order_id is validated to belong to the same dealer_id before upload.
//   3. Storage path is server-generated — never from client input.
//   4. File is uploaded to: {dealer_id}/{work_order_id}/{phase}/{uuid}_{file_name}

import { revalidatePath }   from "next/cache";
import { createClient }     from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import {
  WorkOrderFileType,
  WorkOrderFilePhase,
  workOrderFileStoragePath,
} from "./work-order-file-types";

const STORAGE_BUCKET = "work-order-files";
const MAX_FILE_SIZE  = 20 * 1024 * 1024;  // 20 MB

export async function uploadWorkOrderFile(formData: FormData) {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { error: auth.error };

  const workOrderId = (formData.get("work_order_id") as string | null)?.trim();
  if (!workOrderId)  return { error: "Work order ID is required." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "File is required." };
  if (file.size > MAX_FILE_SIZE) return { error: "File size must be under 20 MB." };

  const phase       = ((formData.get("phase")       as string | null)?.trim() ?? "before") as WorkOrderFilePhase;
  const fileType    = ((formData.get("file_type")   as string | null)?.trim() ?? "photo")  as WorkOrderFileType;
  const title       = (formData.get("title")        as string | null)?.trim() || null;
  const description = (formData.get("description")  as string | null)?.trim() || null;
  const supabase = await createClient();

  // Validate work_order_id belongs to the same dealer.
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id",        workOrderId)
    .eq("dealer_id", auth.dealerId)
    .single();

  if (woError || !wo) {
    return { error: "Work order not found or does not belong to your dealer." };
  }

  // Build storage path (server-generated, never from client).
  const uniquePrefix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const storagePath  = workOrderFileStoragePath(
    auth.dealerId,
    workOrderId,
    phase,
    file.name,
    uniquePrefix,
  );

  // Upload to Supabase Storage.
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadWorkOrderFile] storage error:", uploadError.message);
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // Insert metadata record.
  const { error: insertError } = await supabase.from("work_order_files").insert({
    dealer_id:     auth.dealerId,      // server-injected — never from form
    work_order_id: workOrderId,
    file_type:     fileType,
    phase,
    title,
    description,
    file_name:     file.name,
    file_path:     storagePath,
    file_url:      null,
    mime_type:     file.type || null,
    file_size:     file.size,
    sort_order:    0,
    is_public:     false,
  });

  if (insertError) {
    // Compensating cleanup is a server-only operation over the exact path that
    // this action generated. A caller never supplies this destructive target.
    let cleanupError: unknown = null;
    try {
      const admin = createAdminClient();
      const { error } = await admin.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);
      cleanupError = error;
    } catch (error) {
      cleanupError = error;
    }

    if (cleanupError) {
      console.error("[uploadWorkOrderFile] compensating cleanup failed");
    }
    console.error("[uploadWorkOrderFile] insert error:", insertError.message);
    return { error: "ファイル情報の保存に失敗しました。時間をおいて再度お試しください。" };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
