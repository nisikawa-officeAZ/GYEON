// Server-side: load a dealer's standardized stamp for PDF rendering.
//
// Returns the stamp image as a base64 data URI (downloaded from the private/
// public dealer-branding bucket via the service-role client) plus its kind so
// the PDF can size it at the correct physical dimensions. Falls back to the
// public stamp_url, then null. Never throws — PDFs render without a stamp if
// none is configured.

import { createAdminClient } from "@/lib/supabase/admin";
import { BRANDING_BUCKET } from "@/lib/branding/branding-types";
import { isStampKind, type PdfStamp } from "@/lib/stamp/stamp-types";

export async function getDealerStampForPdf(dealerId: string): Promise<PdfStamp | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("dealer_settings")
      .select("stamp_path, stamp_url, stamp_kind")
      .eq("dealer_id", dealerId)
      .maybeSingle();

    if (!data) return null;
    const row = data as { stamp_path: string | null; stamp_url: string | null; stamp_kind: string | null };
    const kind = isStampKind(row.stamp_kind) ? row.stamp_kind : "square";

    if (row.stamp_path) {
      const { data: file } = await supabase.storage.from(BRANDING_BUCKET).download(row.stamp_path);
      if (file) {
        const buf = Buffer.from(await file.arrayBuffer());
        return { src: `data:image/png;base64,${buf.toString("base64")}`, kind };
      }
    }
    if (row.stamp_url) return { src: row.stamp_url, kind };
    return null;
  } catch (err) {
    console.error("[getDealerStampForPdf] failed:", err);
    return null;
  }
}
