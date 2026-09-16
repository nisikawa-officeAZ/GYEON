import { createHash } from "node:crypto";

export const INSTALLATION_CERTIFICATE_R1_DOCUMENT_CLASS =
  "installation-certificate-r1" as const;

export const INSTALLATION_CERTIFICATE_R1_SOURCE_CONTRACT_VERSION = 1 as const;

export interface IssueInstallationCertificateR1Command {
  readonly completionReportId: string;
  readonly idempotencyKey: string;
}

export interface InstallationCertificateR1IssuerSnapshot {
  readonly displayName: string;
  readonly companyName?: string;
  readonly postalCode?: string;
  readonly address?: string;
  readonly tel?: string;
  readonly email?: string;
  readonly website?: string;
  readonly invoiceRegistrationNumber?: string;
  readonly detailerRank?: string;
  readonly logoMode: "dealer" | "da-default";
}

export interface IssueInstallationCertificateR1RpcRow {
  readonly issuance_id: string;
  readonly certificate_number: string;
  readonly issued_on: string;
  readonly source_fingerprint: string;
  readonly outcome: "created" | "replayed" | "already_issued";
  readonly created: boolean;
  readonly replayed: boolean;
}

export type InstallationCertificateR1NotEligibleReason =
  | "not-canonical"
  | "work-order-not-completed"
  | "missing-report-number"
  | "missing-report-date"
  | "snapshot-unconfirmed"
  | "snapshot-empty"
  | "archived"
  | "missing-customer-name"
  | "missing-vehicle-name"
  | "missing-applied-date"
  | "missing-technician"
  | "invalid-snapshot-item"
  | "missing-issuer-name";

export type IssueInstallationCertificateR1Result =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "permission_denied" }
  | {
      readonly kind: "not_eligible";
      readonly reasons: readonly InstallationCertificateR1NotEligibleReason[];
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

export type ValidIssueInstallationCertificateR1Command = Readonly<{
  completionReportId: string;
  idempotencyKey: string;
}>;

export function validateIssueInstallationCertificateR1Command(
  value: IssueInstallationCertificateR1Command,
):
  | { readonly ok: true; readonly command: ValidIssueInstallationCertificateR1Command }
  | { readonly ok: false } {
  if (typeof value.completionReportId !== "string") return { ok: false };
  if (typeof value.idempotencyKey !== "string") return { ok: false };

  const completionReportId = value.completionReportId.trim();
  const idempotencyKey = value.idempotencyKey.trim();
  if (!UUID_RE.test(completionReportId) || !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
    return { ok: false };
  }
  return { ok: true, command: { completionReportId, idempotencyKey } };
}

/**
 * Deterministic JSON used by both TypeScript and PostgreSQL fingerprint tests.
 * Object keys are sorted by Unicode code point; undefined object fields are
 * omitted. Non-JSON values, sparse/undefined array entries, non-finite numbers,
 * and non-plain objects fail closed.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite JSON number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => {
      if (item === undefined) throw new TypeError("undefined array value");
      return canonicalJson(item);
    }).join(",")}]`;
  }
  if (typeof value !== "object") throw new TypeError("unsupported JSON value");

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new TypeError("non-plain JSON object");

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

export function sha256Hex(canonical: string): string {
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function buildInstallationCertificateR1RequestCanonicalJson(
  completionReportId: string,
): string {
  return canonicalJson({
    completionReportId,
    contractVersion: INSTALLATION_CERTIFICATE_R1_SOURCE_CONTRACT_VERSION,
    documentClass: INSTALLATION_CERTIFICATE_R1_DOCUMENT_CLASS,
  });
}

export function buildInstallationCertificateR1SourceCanonicalJson(
  projection: unknown,
  issuer: InstallationCertificateR1IssuerSnapshot,
): string {
  return canonicalJson({ issuer, projection });
}

export function isIssueInstallationCertificateR1RpcRow(
  value: unknown,
): value is IssueInstallationCertificateR1RpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.issuance_id === "string" && UUID_RE.test(row.issuance_id) &&
    typeof row.certificate_number === "string" &&
    /^CRT\/IN\/\d{4}\/\d{5,}$/.test(row.certificate_number) &&
    typeof row.issued_on === "string" && ISO_DATE_RE.test(row.issued_on) &&
    typeof row.source_fingerprint === "string" && LOWER_HEX_64_RE.test(row.source_fingerprint) &&
    (row.outcome === "created" || row.outcome === "replayed" || row.outcome === "already_issued") &&
    typeof row.created === "boolean" &&
    typeof row.replayed === "boolean"
  );
}

export const INSTALLATION_CERTIFICATE_R1_NOT_ELIGIBLE_REASONS:
readonly InstallationCertificateR1NotEligibleReason[] = [
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
];

export function mapInstallationCertificateR1RpcError(
  message: string | null | undefined,
): IssueInstallationCertificateR1Result {
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
    case "NOT_ELIGIBLE": {
      if ((INSTALLATION_CERTIFICATE_R1_NOT_ELIGIBLE_REASONS as readonly string[]).includes(detail)) {
        return {
          kind: "not_eligible",
          reasons: [detail as InstallationCertificateR1NotEligibleReason],
        };
      }
      return { kind: "unavailable" };
    }
    default: return { kind: "unavailable" };
  }
}
