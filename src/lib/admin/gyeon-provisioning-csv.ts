"use server";

// GYEON partner provisioning — CSV import server actions
// (GYEON-PARTNER-ONBOARD-F1). superAdmin-only; gate-checked BEFORE any
// provisioning-table access; the confirmed import commits rows + audit record
// in ONE database transaction (import_gyeon_provisioning) — all or nothing.
// Invitations are NEVER sent from the import path.

import { requireSuperAdmin } from "./require-admin";
import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseGyeonProvisioningCsv,
  type GyeonProvisioningCsvError,
  type GyeonProvisioningCsvRow,
} from "./gyeon-provisioning-csv-core";

export type GyeonProvisioningCsvDryRunResult =
  | { kind: "disabled" }
  | { kind: "invalid"; errors: GyeonProvisioningCsvError[] }
  // F2-04: `unchanged` counts rows whose byte-equivalent registered+unclaimed
  // twin already exists — a replay no-op, NOT a conflict. Classification is
  // identical to the import transaction's rules.
  | { kind: "ok"; rows: GyeonProvisioningCsvRow[]; conflicts: { email: string; reason: string }[]; unchanged: number }
  | { kind: "error" };

export type GyeonProvisioningCsvImportResult =
  | { kind: "disabled" }
  | { kind: "invalid"; errors: GyeonProvisioningCsvError[] }
  | { kind: "conflict"; conflicts: { email: string; reason: string }[] }
  | { kind: "imported"; count: number; unchanged: number }
  | { kind: "error" };

// Preview: parse + validate + database conflict check. ZERO writes.
export async function dryRunGyeonProvisioningCsv(
  csvText: string,
): Promise<GyeonProvisioningCsvDryRunResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  await requireSuperAdmin();

  const parsed = parseGyeonProvisioningCsv(csvText);
  if (parsed.kind === "error") return { kind: "invalid", errors: parsed.errors };

  try {
    const supabase = createAdminClient();
    const emails = parsed.rows.map((r) => r.emailNormalized);
    const codes = parsed.rows.map((r) => r.dealerCode).filter((c): c is string => c !== null);

    // F2-04: the SAME classification the import transaction applies —
    //   identical row, still registered+unclaimed -> unchanged (replay no-op)
    //   any difference / claimed / revoked        -> conflict
    //   dealer_code held by a DIFFERENT email     -> conflict
    const conflicts: { email: string; reason: string }[] = [];
    let unchanged = 0;

    const { data: emailHits, error: emailError } = await supabase
      .from("gyeon_dealer_provisioning")
      .select("email_normalized, shop_name, detailer_rank, dealer_code, provisioning_status, claimed_at")
      .in("email_normalized", emails);
    if (emailError) return { kind: "error" };
    const byEmail = new Map((emailHits ?? []).map((h) => [h.email_normalized as string, h]));

    for (const row of parsed.rows) {
      const hit = byEmail.get(row.emailNormalized);
      if (!hit) continue;
      const identical =
        hit.provisioning_status === "registered" &&
        hit.claimed_at === null &&
        hit.shop_name === row.shopName &&
        hit.detailer_rank === row.detailerRank &&
        (hit.dealer_code ?? "") === (row.dealerCode ?? "");
      if (identical) unchanged += 1;
      else conflicts.push({ email: row.emailNormalized, reason: "email-exists" });
    }

    if (codes.length > 0) {
      const { data: codeHits, error: codeError } = await supabase
        .from("gyeon_dealer_provisioning")
        .select("email_normalized, dealer_code")
        .in("dealer_code", codes);
      if (codeError) return { kind: "error" };
      for (const hit of codeHits ?? []) {
        // A code held by the same email was already classified above.
        if (!byEmail.has(hit.email_normalized as string)) {
          conflicts.push({ email: hit.email_normalized, reason: "dealer-code-exists" });
        }
      }
    }

    return { kind: "ok", rows: parsed.rows, conflicts, unchanged };
  } catch {
    return { kind: "error" };
  }
}

// Confirmed import: re-parses independently and delegates to the atomic
// import_gyeon_provisioning transaction, which re-checks conflicts and writes
// every row plus the audit record together — or nothing at all.
export async function confirmGyeonProvisioningCsv(
  csvText: string,
): Promise<GyeonProvisioningCsvImportResult> {
  if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };
  const admin = await requireSuperAdmin();

  const parsed = parseGyeonProvisioningCsv(csvText);
  if (parsed.kind === "error") return { kind: "invalid", errors: parsed.errors };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("import_gyeon_provisioning", {
      p_admin_id: admin.id,
      p_rows: parsed.rows.map((r) => ({
        email_normalized: r.emailNormalized,
        shop_name: r.shopName,
        detailer_rank: r.detailerRank,
        dealer_code: r.dealerCode,
      })),
    });
    if (error) return { kind: "error" };

    const result = data as {
      outcome?: string;
      inserted?: number;
      unchanged?: number;
      conflicts?: { email: string; reason: string }[];
    } | null;

    switch (result?.outcome) {
      case "imported":
        // F2-04: inserted + unchanged are reported separately; a full replay
        // is inserted=0 with every row unchanged.
        return {
          kind: "imported",
          count: typeof result.inserted === "number" ? result.inserted : 0,
          unchanged: typeof result.unchanged === "number" ? result.unchanged : 0,
        };
      case "conflict":
        return { kind: "conflict", conflicts: result.conflicts ?? [] };
      case "invalid-input":
      case "invalid-row":
        return {
          kind: "invalid",
          errors: [{ rowNumber: 0, code: "malformed-row", message: "Rejected by the database validation pass." }],
        };
      default:
        return { kind: "error" };
    }
  } catch {
    return { kind: "error" };
  }
}
