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
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

const STORAGE_BUCKET = "work-order-files";

export async function deleteWorkOrderFile(fileId: string) {
  const auth = await requireStaffCapability("delete");
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();

  // Fetch the record first — validates ownership and retrieves file_path.
  const { data: file, error: fetchError } = await supabase
    .from("work_order_files")
    .select("id, file_path, dealer_id")
    .eq("id",        fileId)
    .eq("dealer_id", auth.dealerId)   // scope to current dealer
    .single();

  if (fetchError || !file) {
    return { error: "File not found or does not belong to your dealer." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    console.error("[deleteWorkOrderFile] admin client unavailable");
    return { error: "ファイルを削除できませんでした。時間をおいて再度お試しください。" };
  }

  // Delete from Supabase Storage using the exact DB-stored path. Authenticated
  // clients are intentionally not granted a broad direct DELETE capability.
  const { error: storageError } = await admin.storage
    .from(STORAGE_BUCKET)
    .remove([file.file_path]);

  if (storageError) {
    console.error("[deleteWorkOrderFile] storage remove failed");
    return { error: "ファイルを削除できませんでした。時間をおいて再度お試しください。" };
  }

  // Delete the metadata only after checked Storage success. Exact id, dealer,
  // and path predicates prevent a stale lookup from deleting a changed row.
  const { data: deletedRow, error: deleteError } = await admin
    .from("work_order_files")
    .delete()
    .eq("id",        fileId)
    .eq("dealer_id", auth.dealerId)
    .eq("file_path", file.file_path)
    .select("id")
    .maybeSingle();

  if (deleteError || !deletedRow) {
    console.error("[deleteWorkOrderFile] metadata delete failed");
    return { error: "ファイル情報を削除できませんでした。時間をおいて再度お試しください。" };
  }

  revalidatePath("/work-orders");
  return { success: true };
}
