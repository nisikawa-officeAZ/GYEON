"use server";

// Server Action — fetches work order files for a given work order.
//
// Architecture rule:
//   Scoped by BOTH work_order_id AND dealer_id from dealer_members.
//   Returns [] if the work order does not belong to the current dealer.
//
// Marked "use server" so it can be called directly from client components.

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type {
  GetWorkOrderFilesResult,
  WorkOrderFileDB,
} from "./work-order-file-types";
import {
  toPrivateWorkOrderFileView,
  WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS,
} from "./private-work-order-file-delivery";

const STORAGE_BUCKET = "work-order-files";
const PRIVATE_DELIVERY_ERROR =
  "ファイルを安全に読み込めませんでした。時間をおいて再度お試しください。";

export async function getWorkOrderFiles(
  workOrderId: string,
): Promise<GetWorkOrderFilesResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { files: [], error: PRIVATE_DELIVERY_ERROR };

  const supabase = await createClient();

  // Verify the work order belongs to this dealer before returning its files.
  const { data: wo, error: woError } = await supabase
    .from("work_orders")
    .select("id")
    .eq("id",        workOrderId)
    .eq("dealer_id", dealer.dealer_id)
    .single();

  if (woError || !wo) return { files: [], error: PRIVATE_DELIVERY_ERROR };

  const { data, error } = await supabase
    .from("work_order_files")
    .select(`
      id,
      dealer_id,
      work_order_id,
      file_type,
      phase,
      title,
      description,
      file_name,
      file_path,
      file_url,
      mime_type,
      file_size,
      sort_order,
      is_public,
      created_at,
      updated_at
    `)
    .eq("work_order_id", workOrderId)
    .eq("dealer_id",     dealer.dealer_id)
    .order("phase",       { ascending: true })
    .order("sort_order",  { ascending: true })
    .order("created_at",  { ascending: true });

  if (error) {
    console.error("[getWorkOrderFiles] error:", error.message);
    return { files: [], error: PRIVATE_DELIVERY_ERROR };
  }

  const records = (data as WorkOrderFileDB[] | null) ?? [];

  try {
    const files = await Promise.all(records.map(async (record) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(
          record.file_path,
          WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS,
        );

      if (signError || !signed?.signedUrl) {
        throw new Error("Private URL signing failed.");
      }

      return toPrivateWorkOrderFileView(record, signed.signedUrl);
    }));

    return { files, error: null };
  } catch {
    console.error("[getWorkOrderFiles] private delivery signing failed");
    return { files: [], error: PRIVATE_DELIVERY_ERROR };
  }
}
