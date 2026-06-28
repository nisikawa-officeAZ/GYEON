"use server";

// Server Action — uploads a dealer branding asset (logo or stamp) to Supabase Storage.
//
// Security rules (mirrors uploadWorkOrderFile):
//   1. dealer_id is ALWAYS resolved server-side from dealer_members (requireRole).
//   2. dealer_id is NEVER accepted from client input.
//   3. The storage path is server-generated: {dealer_id}/branding/{slot}.png
//   4. Only owner/manager may upload.
//
// Returns the internal storage path AND a resolved public URL. The path is the
// canonical reference persisted by saveBrandingSettings(); the URL is convenience
// for preview and existing consumers (PDF, customer portal).

import { createClient }  from "@/lib/supabase/server";
import { requireRole }   from "@/lib/staff/require-role";
import {
  BRANDING_BUCKET,
  brandingStoragePath,
  type BrandingSlot,
} from "./branding-types";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — branding assets are small

export interface UploadBrandingResult {
  success: true;
  slot:    BrandingSlot;
  path:    string;
  url:     string | null;
}

export async function uploadBrandingImage(
  formData: FormData,
): Promise<UploadBrandingResult | { error: string }> {
  try {
    // Resolves dealerId server-side; throws if role is insufficient. Never trust the client.
    const { dealerId } = await requireRole(["owner", "manager"]);

    const slotRaw = (formData.get("slot") as string | null)?.trim();
    if (slotRaw !== "logo" && slotRaw !== "stamp") {
      return { error: "不正なアセット種別です" };
    }
    const slot: BrandingSlot = slotRaw;

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return { error: "ファイルが必要です" };
    if (file.size > MAX_FILE_SIZE) return { error: "ファイルサイズは5MB以下にしてください" };

    const supabase = await createClient();

    // Server-generated path — overwrites the previous asset for this dealer/slot.
    const storagePath = brandingStoragePath(dealerId, slot);
    const buffer      = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(storagePath, buffer, {
        contentType: "image/png",
        upsert:      true,
      });

    if (uploadError) {
      console.error("[uploadBrandingImage] storage error:", uploadError.message);
      return { error: `アップロードに失敗しました: ${uploadError.message}` };
    }

    const { data: urlData } = supabase.storage
      .from(BRANDING_BUCKET)
      .getPublicUrl(storagePath);

    return {
      success: true,
      slot,
      path: storagePath,
      url:  urlData?.publicUrl ?? null,
    };
  } catch (err) {
    console.error("[uploadBrandingImage] failed:", err);
    const msg = err instanceof Error ? err.message : "アップロードに失敗しました";
    return { error: msg };
  }
}
