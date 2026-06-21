"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminAuditAction } from "./admin-types";

export async function writeAuditLog({
  adminUserId,
  targetUserId,
  targetDealerId,
  action,
  details = {},
}: {
  adminUserId: string;
  targetUserId?: string;
  targetDealerId?: string;
  action: AdminAuditAction;
  details?: Record<string, unknown>;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("admin_audit_logs").insert({
      admin_user_id:    adminUserId,
      target_user_id:   targetUserId ?? null,
      target_dealer_id: targetDealerId ?? null,
      action,
      details,
    });
  } catch {
    // Audit log failure must not block the operation
    // In production, send to error monitoring
  }
}
