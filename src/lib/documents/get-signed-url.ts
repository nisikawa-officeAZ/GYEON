"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/** Generate a fresh signed URL for an existing file. Returns signed URL valid for 7 days. */
export async function getDocumentSignedUrl(
  filePath: string
): Promise<{ url: string; expiresAt: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .storage
    .from("documents")
    .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

  if (error || !data?.signedUrl) return null;

  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toISOString();
  return { url: data.signedUrl, expiresAt };
}
