"use server";

// Server Action — deletes a work order file from Storage and DB.
//
// Security rules:
//   1. File record is first fetched and validated against dealer_id.
//   2. Storage deletion uses the file_path stored in DB (never client-supplied).
//   3. DB record is deleted only after Storage deletion succeeds.
//   4. A user cannot delete files belonging to another dealer.

import { revalidatePath }  from "next/cache";
import { createClient }    from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

const STORAGE_BUCKET = "work-order-files";

export async function deleteWorkOrderFile(fileId: string) {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return auth;

  const dealer = await getCurrentDealer();
  if (!dealer) return { error: "No active dealer membership." };

  const supabase = await createClient();

  // Fetch the record first — validates ownership and retrieves file_path.
  const { data: file, error: fetchError } = await supabase
    .from("work_order_files")
    .select("id, file_path, dealer_id")
    .eq("id",        fileId)
    .eq("dealer_id", dealer.dealer_id)   // scope to current dealer
    .single();

  if (fetchError || !file) {
    return { error: "File not found or does not belong to your dealer." };
  }

  // Delete from Supabase Storage using the DB-stored path.
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([file.file_path]);

  if (storageError) {
    // Log but proceed — the file may have already been removed from storage.
    console.warn("[deleteWorkOrderFile] storage remove warning:", storageError.message);
  }

  // Delete the DB record.
  const { error: deleteError } = await supabase
    .from("work_order_files")
    .delete()
    .eq("id",        fileId)
    .eq("dealer_id", dealer.dealer_id);   // double-scope for safety

  if (deleteError) {
    console.error("[deleteWorkOrderFile] db delete error:", deleteError.message);
    return { error: deleteError.message };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
