import type { InstallationCertificateR1NotEligibleReason } from "./installation-certificate-r1-issuance-contract";

export type InstallationCertificateR2Kind = "coating" | "ppf" | "cancoat";

export interface IssueInstallationCertificateR2Command {
  readonly completionReportId: string;
  readonly certificateKind: InstallationCertificateR2Kind;
  readonly idempotencyKey: string;
}

export interface IssueInstallationCertificateR2RpcRow {
  readonly issuance_id: string;
  readonly certificate_number: string;
  readonly issued_on: string;
  readonly source_fingerprint: string;
  readonly outcome: "created" | "replayed" | "already_issued";
  readonly created: boolean;
  readonly replayed: boolean;
}

export type InstallationCertificateR2NotEligibleReason =
  | InstallationCertificateR1NotEligibleReason
  | "certificate-kind-not-applicable";

export type IssueInstallationCertificateR2Result =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "permission_denied" }
  | {
      readonly kind: "not_eligible";
      readonly reasons: readonly InstallationCertificateR2NotEligibleReason[];
    }
  | { readonly kind: "idempotency_conflict" }
  | {
      readonly kind: "already_issued";
      readonly issuanceId: string;
      readonly certificateNumber: string;
      readonly issuedOn: string;
    }
  | {
      readonly kind: "ok";
      readonly issuanceId: string;
      readonly certificateNumber: string;
      readonly issuedOn: string;
      readonly sourceFingerprint: string;
      readonly created: boolean;
      readonly replayed: boolean;
    }
  | { readonly kind: "unavailable" };

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const IDEMPOTENCY_KEY_RE = /^[!-~]{16,128}$/;
const LOWER_HEX_64_RE = /^[0-9a-f]{64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE: Record<InstallationCertificateR2Kind, RegExp> = {
  coating: /^CRT\/CO\/\d{4}\/\d{5,}$/,
  ppf: /^CRT\/PPF\/\d{4}\/\d{5,}$/,
  cancoat: /^CRT\/CC\/\d{4}\/\d{5,}$/,
};

export function validateIssueInstallationCertificateR2Command(
  value: IssueInstallationCertificateR2Command,
): { readonly ok: true; readonly command: IssueInstallationCertificateR2Command }
  | { readonly ok: false } {
  if (typeof value.completionReportId !== "string" ||
      typeof value.idempotencyKey !== "string" ||
      !Object.hasOwn(NUMBER_RE, value.certificateKind)) return { ok: false };
  const completionReportId = value.completionReportId.trim();
  const idempotencyKey = value.idempotencyKey.trim();
  if (!UUID_RE.test(completionReportId) || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return { ok: false };
  }
  return {
    ok: true,
    command: { completionReportId, certificateKind: value.certificateKind, idempotencyKey },
  };
}

export function isIssueInstallationCertificateR2RpcRow(
  value: unknown,
  certificateKind: InstallationCertificateR2Kind,
): value is IssueInstallationCertificateR2RpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.issuance_id === "string" && UUID_RE.test(row.issuance_id) &&
    typeof row.certificate_number === "string" && NUMBER_RE[certificateKind].test(row.certificate_number) &&
    typeof row.issued_on === "string" && ISO_DATE_RE.test(row.issued_on) &&
    typeof row.source_fingerprint === "string" && LOWER_HEX_64_RE.test(row.source_fingerprint) &&
    (row.outcome === "created" || row.outcome === "replayed" || row.outcome === "already_issued") &&
    typeof row.created === "boolean" && typeof row.replayed === "boolean";
}

const NOT_ELIGIBLE_REASONS: readonly InstallationCertificateR2NotEligibleReason[] = [
  "not-canonical",
  "work-order-not-completed",
  "missing-report-number",
  "missing-report-date",
  "snapshot-unconfirmed",
  "snapshot-empty",
  "archived",
  "missing-customer-name",
  "missing-vehicle-name",
  "missing-applied-date",
  "missing-technician",
  "invalid-snapshot-item",
  "missing-issuer-name",
  "certificate-kind-not-applicable",
];

export function mapInstallationCertificateR2RpcError(
  message: string | null | undefined,
): IssueInstallationCertificateR2Result {
  const raw = message ?? "";
  const colon = raw.indexOf(":");
  const code = (colon === -1 ? raw : raw.slice(0, colon)).trim();
  const detail = colon === -1 ? "" : raw.slice(colon + 1).trim();
  switch (code) {
    case "UNAUTHENTICATED": return { kind: "unauthenticated" };
    case "VALIDATION_ERROR": return { kind: "invalid_request" };
    case "NOT_FOUND": return { kind: "not_found" };
    case "PERMISSION_DENIED": return { kind: "permission_denied" };
    case "IDEMPOTENCY_CONFLICT": return { kind: "idempotency_conflict" };
    case "NOT_ELIGIBLE":
      return (NOT_ELIGIBLE_REASONS as readonly string[]).includes(detail)
        ? { kind: "not_eligible", reasons: [detail as InstallationCertificateR2NotEligibleReason] }
        : { kind: "unavailable" };
    default: return { kind: "unavailable" };
  }
}
