"use server";

import { randomUUID } from "node:crypto";

import {
  ensureInstallationCertificateR1Document,
  type EnsureInstallationCertificateR1DocumentResult,
} from "./ensure-installation-certificate-r1-document";
import {
  issueInstallationCertificateR1,
} from "./issue-installation-certificate-r1";
import type {
  InstallationCertificateR1NotEligibleReason,
} from "./installation-certificate-r1-issuance-contract";

type DocumentFailure = Exclude<
  EnsureInstallationCertificateR1DocumentResult,
  { readonly kind: "ready" }
>["kind"];

export type IssueInstallationCertificateR1DocumentResult =
  | {
      readonly kind: "ready";
      readonly issuanceId: string;
      readonly certificateNumber: string;
      readonly issuedOn: string;
    }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "permission_denied" }
  | {
      readonly kind: "not_eligible";
      readonly reasons: readonly InstallationCertificateR1NotEligibleReason[];
    }
  | { readonly kind: "idempotency_conflict" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "document_error"; readonly reason: DocumentFailure };

/**
 * The single UI orchestration boundary. Browser input is only the canonical
 * completion-report id. Issuance reconstructs every immutable fact in the DB;
 * document creation consumes only the resulting issuance snapshot.
 */
export async function issueInstallationCertificateR1Document(
  completionReportId: string,
): Promise<IssueInstallationCertificateR1DocumentResult> {
  try {
    const issuance = await issueInstallationCertificateR1({
      completionReportId,
      idempotencyKey: randomUUID(),
    });

    if (issuance.kind !== "ok" && issuance.kind !== "already_issued") {
      return issuance;
    }

    const document = await ensureInstallationCertificateR1Document(issuance.issuanceId);
    if (document.kind !== "ready") {
      return { kind: "document_error", reason: document.kind };
    }

    return {
      kind: "ready",
      issuanceId: issuance.issuanceId,
      certificateNumber: issuance.certificateNumber,
      issuedOn: issuance.issuedOn,
    };
  } catch {
    return { kind: "unavailable" };
  }
}
