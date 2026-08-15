"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";

/**
 * Generate a fresh signed URL for an existing stored document (re-sign after the
 * original URL expires). Returns a URL valid for 7 days, or null.
 *
 * Security: dealer_id is resolved server-side (getCurrentDealer); the requested
 * filePath must belong to a document_files row owned by that dealer before the
 * service-role client signs it — preventing cross-tenant access via a guessed path.
 */
export async function getDocumentSignedUrl(
  filePath: string
): Promise<{ url: string; expiresAt: string } | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = createAdminClient();

  // Ownership gate — the file must belong to the current dealer.
  const { data: doc } = await supabase
    .from("document_files")
    .select("id")
    .eq("dealer_id", dealer.dealer_id)
    .eq("file_path", filePath)
    .maybeSingle();
  if (!doc) return null;

  const { data, error } = await supabase
    .storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

  if (error || !data?.signedUrl) return null;

  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();
  return { url: data.signedUrl, expiresAt };
}
