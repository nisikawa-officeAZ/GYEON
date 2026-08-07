"use server";

// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B3-B1A — trusted monthly-statement issuance boundary.
//
// The ONLY path that issues a monthly statement. It (1) verifies the authenticated user's finance
// capability and server-resolved dealer scope, (2) confirms the target DRAFT statement belongs to that
// dealer, then (3) calls the single atomic database RPC issue_monthly_statement_rpc EXACTLY ONCE via the
// service-role admin client. Every lock, receipt snapshot, total, validation, and draft→issued
// transition happens inside that one PostgreSQL transaction — never as separate Supabase requests.
//
// Client input NEVER supplies dealer_id, customer_id, totals, or snapshot amounts; only the statement id
// is accepted, and it is re-scoped to the caller's dealer before the RPC. The service-role admin client
// is created and used ONLY on the server and is never exposed to client components.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import type { MonthlyStatementDB } from "./monthly-statement-types";

export async function issueMonthlyStatement(
  statementId: string,
): Promise<{ error: string } | { success: true; statement: MonthlyStatementDB }> {
  if (!statementId) return { error: "月次請求書IDが必要です" };

  // 1. Finance capability + server-resolved dealer scope (fail-closed).
  const auth = await requireStaffCapability("finance");
  if ("error" in auth) return { error: auth.error };

  // 2. Resolve the acting user id (server-side, from the session — never client input) for issued_by,
  //    and confirm the target draft statement belongs to the caller's dealer under RLS.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const issuedBy = userData.user?.id ?? null;
  if (!issuedBy) return { error: "認証エラー" };

  const { data: draft } = await supabase
    .from("monthly_statements")
    .select("id, status")
    .eq("id", statementId)
    .eq("dealer_id", auth.dealerId)
    .maybeSingle();
  if (!draft) return { error: "月次請求書が見つかりません" };

  // 3. Exactly ONE call into the atomic issuance RPC via the service-role boundary. No snapshot INSERT,
  //    total UPDATE, or status UPDATE is performed from TypeScript.
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("issue_monthly_statement_rpc", {
    p_statement_id: statementId,
    p_issued_by:    issuedBy,
  });

  if (error) return { error: error.message ?? "月次請求書の発行に失敗しました" };
  if (!data) return { error: "月次請求書の発行に失敗しました" };

  const statement = (Array.isArray(data) ? data[0] : data) as MonthlyStatementDB;
  return { success: true, statement };
}
