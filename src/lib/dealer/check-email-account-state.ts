"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type EmailAccountState = "new" | "pending" | "active" | "suspended";

/**
 * Public (unauthenticated) signup pre-check.
 *
 * Resolves the COARSE account state for an email so the signup form can show a
 * clear message and never create a duplicate dealer for an email that already
 * has one (returning/suspended users must be restored by Super Admin, not
 * re-registered).
 *
 * Uses the service-role client because `dealers` is RLS-protected. Returns only
 * a coarse state — no dealer name, id, or other PII — to limit the account
 * enumeration surface this endpoint inherently exposes.
 *
 * State mapping (latest dealer row for the email):
 *   - no row                                   → "new"     (safe to register)
 *   - deleted_at set (archived)                → "suspended"
 *   - approval_status suspended | rejected     → "suspended"
 *   - approval_status approved                 → "active"
 *   - approval_status pending | null           → "pending"
 */
export async function checkEmailAccountState(
  email: string,
): Promise<{ state: EmailAccountState }> {
  const normalized = email.trim();
  if (!normalized) return { state: "new" };

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dealers")
    .select("approval_status, deleted_at, created_at")
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return { state: "new" };

  const row = data[0] as { approval_status: string | null; deleted_at: string | null };

  if (row.deleted_at) return { state: "suspended" };

  switch (row.approval_status) {
    case "suspended":
    case "rejected":
      return { state: "suspended" };
    case "approved":
      return { state: "active" };
    case "pending":
    default:
      return { state: "pending" };
  }
}
