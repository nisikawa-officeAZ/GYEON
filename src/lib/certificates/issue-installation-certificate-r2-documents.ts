"use server";

import { randomUUID } from "node:crypto";

import {
  ensureInstallationCertificateR1Document,
  type EnsureInstallationCertificateR1DocumentResult,
} from "./ensure-installation-certificate-r1-document";
import { issueInstallationCertificateR2 } from "./issue-installation-certificate-r2";
import type {
  InstallationCertificateR2Kind,
  InstallationCertificateR2NotEligibleReason,
  IssueInstallationCertificateR2Result,
} from "./installation-certificate-r2-issuance-contract";

type DocumentFailure = Exclude<
  EnsureInstallationCertificateR1DocumentResult,
  { readonly kind: "ready" }
>["kind"];

export interface ReadyInstallationCertificateR2 {
  readonly certificateKind: InstallationCertificateR2Kind;
  readonly issuanceId: string;
  readonly certificateNumber: string;
  readonly issuedOn: string;
}

type IssuanceFailure = Exclude<
  IssueInstallationCertificateR2Result,
  { readonly kind: "ok" } | { readonly kind: "already_issued" } | { readonly kind: "not_eligible" }
>;

export type IssueInstallationCertificateR2DocumentsResult =
  | { readonly kind: "ready"; readonly certificates: readonly ReadyInstallationCertificateR2[] }
  | IssuanceFailure
  | {
      readonly kind: "not_eligible";
      readonly reasons: readonly InstallationCertificateR2NotEligibleReason[];
    }
  | {
      readonly kind: "document_error";
      readonly certificateKind: InstallationCertificateR2Kind;
      readonly reason: DocumentFailure;
    };

const CERTIFICATE_KINDS: readonly InstallationCertificateR2Kind[] = [
  "coating",
  "ppf",
  "cancoat",
];

export async function issueInstallationCertificateR2Documents(
  completionReportId: string,
): Promise<IssueInstallationCertificateR2DocumentsResult> {
  const certificates: ReadyInstallationCertificateR2[] = [];

  try {
    for (const certificateKind of CERTIFICATE_KINDS) {
      const issuance = await issueInstallationCertificateR2({
        completionReportId,
        certificateKind,
        idempotencyKey: randomUUID(),
      });
      if (issuance.kind === "not_eligible" &&
          issuance.reasons.length === 1 &&
          issuance.reasons[0] === "certificate-kind-not-applicable") {
        continue;
      }
      if (issuance.kind === "not_eligible") return issuance;
      if (issuance.kind !== "ok" && issuance.kind !== "already_issued") return issuance;

      const document = await ensureInstallationCertificateR1Document(issuance.issuanceId);
      if (document.kind !== "ready") {
        return { kind: "document_error", certificateKind, reason: document.kind };
      }
      certificates.push({
        certificateKind,
        issuanceId: issuance.issuanceId,
        certificateNumber: issuance.certificateNumber,
        issuedOn: issuance.issuedOn,
      });
    }

    return certificates.length > 0
      ? { kind: "ready", certificates }
      : { kind: "not_eligible", reasons: ["certificate-kind-not-applicable"] };
  } catch {
    return { kind: "unavailable" };
  }
}
