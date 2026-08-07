"use server";

// B3-B1B I2 — dealer-scoped monthly-statement list (authenticated RLS read, no admin client).

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { MonthlyStatementDB } from "./monthly-statement-types";

export async function getMonthlyStatements(): Promise<MonthlyStatementDB[]> {
  const dealer = await getCurrentDealer();
  if (!dealer) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_statements")
    .select("*")
    .eq("dealer_id", dealer.dealer_id)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getMonthlyStatements error:", error);
    return [];
  }
  return (data ?? []) as MonthlyStatementDB[];
}
