export const INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET = "documents" as const;
export const INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE = "application/pdf" as const;
export const INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION =
  "installation-certificate-r1-v1" as const;
export const INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

const CANONICAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LOWER_HEX_64_RE = /^[0-9a-f]{64}$/;

export interface FinalizeInstallationCertificateR1DocumentCommand {
  readonly dealerId: string;
  readonly issuanceId: string;
  readonly documentId: string;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly templateVersion: string;
  readonly actorUserId: string;
}

export interface FinalizeInstallationCertificateR1DocumentRpcRow {
  readonly document_id: string;
  readonly issuance_id: string;
  readonly storage_bucket: typeof INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET;
  readonly storage_path: string;
  readonly mime_type: typeof INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE;
  readonly byte_size: number;
  readonly sha256: string;
  readonly template_version: typeof INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION;
  readonly generated_at: string;
  readonly outcome: "created" | "replayed";
  readonly created: boolean;
  readonly replayed: boolean;
}

export type FinalizeInstallationCertificateR1DocumentResult =
  | { readonly kind: "invalid_request" }
  | { readonly kind: "not_found" }
  | { readonly kind: "permission_denied" }
  | { readonly kind: "artifact_missing" }
  | { readonly kind: "artifact_integrity_error" }
  | { readonly kind: "artifact_conflict" }
  | { readonly kind: "unavailable" };

export function isCanonicalUuid(value: string): boolean {
  return CANONICAL_UUID_RE.test(value);
}

export function buildInstallationCertificateR1DocumentPath(
  dealerId: string,
  issuanceId: string,
  documentId: string,
): string {
  if (![dealerId, issuanceId, documentId].every(isCanonicalUuid)) {
    throw new TypeError("canonical UUIDs are required");
  }
  return `${dealerId}/certificates/installation-r1/${issuanceId}/${documentId}.pdf`;
}

export function validateFinalizeInstallationCertificateR1DocumentCommand(
  value: FinalizeInstallationCertificateR1DocumentCommand,
): { readonly ok: true; readonly command: FinalizeInstallationCertificateR1DocumentCommand }
  | { readonly ok: false } {
  if (!isCanonicalUuid(value.dealerId) || !isCanonicalUuid(value.issuanceId) ||
      !isCanonicalUuid(value.documentId) || !isCanonicalUuid(value.actorUserId)) {
    return { ok: false };
  }
  if (value.storageBucket !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET ||
      value.mimeType !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE ||
      value.templateVersion !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION ||
      !Number.isSafeInteger(value.byteSize) || value.byteSize < 1 ||
      value.byteSize > INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES ||
      !LOWER_HEX_64_RE.test(value.sha256)) {
    return { ok: false };
  }
  if (value.storagePath !== buildInstallationCertificateR1DocumentPath(
    value.dealerId, value.issuanceId, value.documentId,
  )) return { ok: false };
  return { ok: true, command: value };
}

export function isFinalizeInstallationCertificateR1DocumentRpcRow(
  value: unknown,
): value is FinalizeInstallationCertificateR1DocumentRpcRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.document_id !== "string" || typeof row.issuance_id !== "string" ||
      !isCanonicalUuid(row.document_id) || !isCanonicalUuid(row.issuance_id) ||
      row.storage_bucket !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET ||
      row.mime_type !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE ||
      row.template_version !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION ||
      typeof row.byte_size !== "number" || !Number.isSafeInteger(row.byte_size) ||
      row.byte_size < 1 || row.byte_size > INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES ||
      typeof row.sha256 !== "string" || !LOWER_HEX_64_RE.test(row.sha256) ||
      typeof row.storage_path !== "string" || typeof row.generated_at !== "string" ||
      !Number.isFinite(Date.parse(row.generated_at)) ||
      (row.outcome !== "created" && row.outcome !== "replayed") ||
      typeof row.created !== "boolean" || typeof row.replayed !== "boolean") {
    return false;
  }
  const pathParts = row.storage_path.split("/");
  return pathParts.length === 5 && pathParts[1] === "certificates" &&
    pathParts[2] === "installation-r1" && pathParts[3] === row.issuance_id &&
    pathParts[4] === `${row.document_id}.pdf` && isCanonicalUuid(pathParts[0]) &&
    ((row.outcome === "created" && row.created && !row.replayed) ||
     (row.outcome === "replayed" && !row.created && row.replayed));
}

export function mapFinalizeInstallationCertificateR1DocumentRpcError(
  message: string | null | undefined,
): FinalizeInstallationCertificateR1DocumentResult {
  const raw = message ?? "";
  const colon = raw.indexOf(":");
  const code = (colon === -1 ? raw : raw.slice(0, colon)).trim();
  switch (code) {
    case "VALIDATION_ERROR": return { kind: "invalid_request" };
    case "NOT_FOUND": return { kind: "not_found" };
    case "PERMISSION_DENIED": return { kind: "permission_denied" };
    case "ARTIFACT_MISSING": return { kind: "artifact_missing" };
    case "ARTIFACT_INTEGRITY_ERROR": return { kind: "artifact_integrity_error" };
    case "ARTIFACT_CONFLICT": return { kind: "artifact_conflict" };
    default: return { kind: "unavailable" };
  }
}
