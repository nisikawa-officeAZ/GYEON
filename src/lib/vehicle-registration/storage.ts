// PHASE67: Vehicle Registration Storage Service
// Server-side utility — imported only from "use server" modules (actions.ts).
// Rules:
//   - dealer_id always from getCurrentDealer() — never from client
//   - private bucket only (vehicle-registration-documents)
//   - signed URLs only — no public URLs
//   - archive instead of delete

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

export const VEHICLE_REG_BUCKET = "vehicle-registration-documents";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

// Build the storage path for a registration document.
// Convention: {dealer_id}/{customer_id_or_pending}/{yyyy-mm-dd}-{uuid8}.{ext}
export function buildVehicleRegStoragePath(
  dealerId:   string,
  customerId: string | null,
  vehicleId:  string | null,
  fileName:   string,
): string {
  const today   = new Date().toISOString().slice(0, 10);
  const uuid8   = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const ext     = fileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ?? "jpg";
  const segment = customerId && vehicleId
    ? `${customerId}/${vehicleId}`
    : customerId
    ? `${customerId}/no-vehicle`
    : "pending";

  return `${dealerId}/${segment}/${today}-${uuid8}.${ext}`;
}

export interface UploadImageResult {
  success:     boolean;
  storagePath?: string;
  error?:      string;
}

// Upload the registration image to private storage.
// Returns the storage path (never a public URL).
export async function uploadVehicleRegistrationImage(
  imageBuffer:  ArrayBuffer,
  fileName:     string,
  mimeType:     string,
  customerId:   string | null,
  vehicleId:    string | null,
): Promise<UploadImageResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { success: false, error: "認証エラー" };

    const storagePath = buildVehicleRegStoragePath(
      dealer.dealer_id,
      customerId,
      vehicleId,
      fileName,
    );

    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from(VEHICLE_REG_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: mimeType || "image/jpeg",
        upsert:      false,
      });

    if (uploadError) {
      console.error("[storage] upload error:", uploadError.message);
      return { success: false, error: `アップロード失敗: ${uploadError.message}` };
    }

    return { success: true, storagePath };
  } catch (err) {
    console.error("[storage] unexpected error:", err);
    return { success: false, error: "アップロード中にエラーが発生しました" };
  }
}

// Create a time-limited signed URL for the given storage path.
// Signed URLs expire after SIGNED_URL_EXPIRY_SECONDS (1 hour).
export async function getVehicleRegistrationSignedUrl(
  storagePath: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { error: "認証エラー" };

    // Verify the path starts with the dealer's own ID (path-level isolation)
    if (!storagePath.startsWith(dealer.dealer_id + "/")) {
      return { error: "アクセス権限がありません" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(VEHICLE_REG_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
      console.error("[storage] signed URL error:", error?.message);
      return { error: "署名付きURLの生成に失敗しました" };
    }

    return { url: data.signedUrl };
  } catch (err) {
    console.error("[storage] signed URL unexpected error:", err);
    return { error: "URL生成中にエラーが発生しました" };
  }
}

// Soft-delete: move file to archived/ prefix instead of deleting.
// The original file stays; we copy then remove old path.
export async function archiveVehicleRegistrationFile(
  storagePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { success: false, error: "認証エラー" };

    if (!storagePath.startsWith(dealer.dealer_id + "/")) {
      return { success: false, error: "アクセス権限がありません" };
    }

    const archivedPath = `${dealer.dealer_id}/archived/${storagePath.split("/").slice(1).join("/")}`;

    const supabase = await createClient();

    const { error: copyError } = await supabase.storage
      .from(VEHICLE_REG_BUCKET)
      .copy(storagePath, archivedPath);

    if (copyError) {
      console.error("[storage] archive copy error:", copyError.message);
      return { success: false, error: "アーカイブに失敗しました" };
    }

    await supabase.storage.from(VEHICLE_REG_BUCKET).remove([storagePath]);

    return { success: true };
  } catch (err) {
    console.error("[storage] archive unexpected error:", err);
    return { success: false, error: "アーカイブ中にエラーが発生しました" };
  }
}
