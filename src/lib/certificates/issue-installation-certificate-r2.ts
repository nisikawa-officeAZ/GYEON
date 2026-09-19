"use server";

import { requireStaffCapability } from "@/lib/auth/require-staff-capability";
import { createClient } from "@/lib/supabase/server";
import {
  isIssueInstallationCertificateR2RpcRow,
  mapInstallationCertificateR2RpcError,
  validateIssueInstallationCertificateR2Command,
  type IssueInstallationCertificateR2Command,
  type IssueInstallationCertificateR2Result,
} from "./installation-certificate-r2-issuance-contract";

export async function issueInstallationCertificateR2(
  input: IssueInstallationCertificateR2Command,
): Promise<IssueInstallationCertificateR2Result> {
  const valid = validateIssueInstallationCertificateR2Command(input);
  if (!valid.ok) return { kind: "invalid_request" };

  try {
    const auth = await requireStaffCapability("edit");
    if ("error" in auth) return { kind: "permission_denied" };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("issue_installation_certificate_r2_v1", {
      p_completion_report_id: valid.command.completionReportId,
      p_certificate_kind: valid.command.certificateKind,
      p_idempotency_key: valid.command.idempotencyKey,
    });
    if (error) return mapInstallationCertificateR2RpcError(error.message);

    const row: unknown = Array.isArray(data) ? data[0] : data;
    if (!isIssueInstallationCertificateR2RpcRow(row, valid.command.certificateKind)) {
      console.error("[issueInstallationCertificateR2] unrecognized RPC result");
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
    console.error("[issueInstallationCertificateR2] unavailable");
    return { kind: "unavailable" };
  }
}
