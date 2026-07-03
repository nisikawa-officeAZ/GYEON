"use server";

import { requireAdmin } from "./require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DealerAdminView } from "./admin-types";

export async function getDealersAdmin(): Promise<DealerAdminView[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dealers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DealerAdminView[];
}

/**
 * Archived (soft-deleted) dealers — the restore surface for Super Admin.
 * Returns dealers with deleted_at set; their members are suspended and cannot
 * log in until restoreDealer() is run.
 */
export async function getArchivedDealersAdmin(): Promise<DealerAdminView[]> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dealers")
    .select("*")
    .not("deleted_at", "is", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DealerAdminView[];
}
