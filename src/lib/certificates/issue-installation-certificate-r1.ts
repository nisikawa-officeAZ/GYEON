"use server";

import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createClient } from "@/lib/supabase/server";
import {
  isIssueInstallationCertificateR1RpcRow,
  mapInstallationCertificateR1RpcError,
  validateIssueInstallationCertificateR1Command,
  type IssueInstallationCertificateR1Command,
  type IssueInstallationCertificateR1Result,
} from "./installation-certificate-r1-issuance-contract";

/**
 * The only R1 issuance adapter. It accepts no dealer, actor, source snapshot,
 * serial, date, branding, warranty, document, or Storage input. The database
 * repeats authorization and reconstructs every canonical fact atomically.
 */
export async function issueInstallationCertificateR1(
  input: IssueInstallationCertificateR1Command,
): Promise<IssueInstallationCertificateR1Result> {
  const valid = validateIssueInstallationCertificateR1Command(input);
  if (!valid.ok) return { kind: "invalid_request" };

  try {
    const auth = await requireStaffCapability("edit");
    if ("error" in auth) return { kind: "permission_denied" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("issue_installation_certificate_r1_v1", {
      p_completion_report_id: valid.command.completionReportId,
      p_idempotency_key: valid.command.idempotencyKey,
    });

    if (error) return mapInstallationCertificateR1RpcError(error.message);

    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (!isIssueInstallationCertificateR1RpcRow(row)) {
      console.error("[issueInstallationCertificateR1] unrecognized RPC result");
      return { kind: "unavailable" };
    }

    if (row.outcome === "already_issued") {
      return {
        kind: "already_issued",
        issuanceId: row.issuance_id,
        certificateNumber: row.certificate_number,
        issuedOn: row.issued_on,
      };
    }

    return {
      kind: "ok",
      issuanceId: row.issuance_id,
      certificateNumber: row.certificate_number,
      issuedOn: row.issued_on,
      sourceFingerprint: row.source_fingerprint,
      created: row.created,
      replayed: row.replayed,
    };
  } catch {
    // The caller receives no SQL, tenant, UUID, environment, or stack details.
    console.error("[issueInstallationCertificateR1] unavailable");
    return { kind: "unavailable" };
  }
}
