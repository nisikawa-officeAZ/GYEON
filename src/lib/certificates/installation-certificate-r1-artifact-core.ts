import { createHash } from "node:crypto";

import {
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET,
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES,
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE,
  INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION,
  buildInstallationCertificateR1DocumentPath,
  isCanonicalUuid,
} from "./installation-certificate-r1-document-contract";

export interface InstallationCertificateR1Snapshot {
  readonly schemaVersion: 1;
  readonly documentClass: "installation-certificate-r1";
  readonly certificateNumber: string;
  readonly issueDate: string;
  readonly customer: { readonly name: string; readonly honorific: "様" | "御中" };
  readonly vehicle: {
    readonly name: string;
    readonly maker?: string;
    readonly model?: string;
    readonly year?: string;
    readonly grade?: string;
    readonly vin?: string;
    readonly plate?: string;
    readonly color?: string;
  };
  readonly installation: { readonly appliedDate: string; readonly technician: string };
  readonly items: readonly {
    readonly category: string;
    readonly name: string;
    readonly description?: string;
  }[];
  readonly issuer: {
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
  };
}

export interface InstallationCertificateR1DocumentRow {
  readonly id: string;
  readonly dealer_id: string;
  readonly issuance_id: string;
  readonly revision: number;
  readonly storage_bucket: string;
  readonly storage_path: string;
  readonly mime_type: string;
  readonly byte_size: number;
  readonly sha256: string;
  readonly template_version: string;
}

/** Narrow renderer input: it intentionally cannot carry money, memo, warranty, grant, QR or URL. */
export interface InstallationCertificateR1Presentation {
  readonly certificateNumber: string;
  readonly issueDate: string;
  readonly customer: InstallationCertificateR1Snapshot["customer"];
  readonly vehicle: InstallationCertificateR1Snapshot["vehicle"];
  readonly installation: InstallationCertificateR1Snapshot["installation"];
  readonly items: InstallationCertificateR1Snapshot["items"];
  readonly issuer: Pick<InstallationCertificateR1Snapshot["issuer"],
    "displayName" | "companyName" | "postalCode" | "address" | "tel" | "email" |
    "invoiceRegistrationNumber" | "detailerRank">;
}

export type InstallationCertificateR1ArtifactFailure =
  | "invalid_request"
  | "not_found"
  | "permission_denied"
  | "not_stored"
  | "snapshot_invalid"
  | "branding_error"
  | "render_error"
  | "storage_error"
  | "persistence_error"
  | "artifact_integrity_error"
  | "artifact_conflict"
  | "cleanup_failed";

const CERTIFICATE_NUMBER_RE = /^CRT\/IN\/\d{4}\/\d{5,}$/;
const LOWER_HEX_64_RE = /^[0-9a-f]{64}$/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
}

function isTrimmedText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function isOptionalTrimmedText(value: unknown): value is string | undefined {
  return value === undefined || isTrimmedText(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseInstallationCertificateR1Snapshot(
  value: unknown,
): { readonly ok: true; readonly snapshot: InstallationCertificateR1Snapshot } | { readonly ok: false } {
  if (!isPlainRecord(value) || !hasExactKeys(value, [
    "schemaVersion", "documentClass", "certificateNumber", "issueDate", "customer",
    "vehicle", "installation", "items", "issuer",
  ])) return { ok: false };

  if (value.schemaVersion !== 1 || value.documentClass !== "installation-certificate-r1" ||
      !isTrimmedText(value.certificateNumber) || !CERTIFICATE_NUMBER_RE.test(value.certificateNumber) ||
      !isIsoDate(value.issueDate)) return { ok: false };

  const customer = value.customer;
  if (!isPlainRecord(customer) || !hasExactKeys(customer, ["name", "honorific"]) ||
      !isTrimmedText(customer.name) || (customer.honorific !== "様" && customer.honorific !== "御中")) {
    return { ok: false };
  }

  const vehicle = value.vehicle;
  const vehicleOptional = ["maker", "model", "year", "grade", "vin", "plate", "color"] as const;
  if (!isPlainRecord(vehicle) || !hasExactKeys(vehicle, ["name"], vehicleOptional) ||
      !isTrimmedText(vehicle.name) || vehicleOptional.some((key) => !isOptionalTrimmedText(vehicle[key]))) {
    return { ok: false };
  }

  const installation = value.installation;
  if (!isPlainRecord(installation) || !hasExactKeys(installation, ["appliedDate", "technician"]) ||
      !isIsoDate(installation.appliedDate) || !isTrimmedText(installation.technician)) {
    return { ok: false };
  }

  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 100) {
    return { ok: false };
  }
  for (const item of value.items) {
    if (!isPlainRecord(item) || !hasExactKeys(item, ["category", "name"], ["description"]) ||
        !isTrimmedText(item.category) || !isTrimmedText(item.name) ||
        !isOptionalTrimmedText(item.description)) return { ok: false };
  }

  const issuer = value.issuer;
  const issuerOptional = [
    "companyName", "postalCode", "address", "tel", "email", "website",
    "invoiceRegistrationNumber", "detailerRank",
  ] as const;
  if (!isPlainRecord(issuer) || !hasExactKeys(issuer, ["displayName", "logoMode"], issuerOptional) ||
      !isTrimmedText(issuer.displayName) ||
      (issuer.logoMode !== "dealer" && issuer.logoMode !== "da-default") ||
      issuerOptional.some((key) => !isOptionalTrimmedText(issuer[key]))) return { ok: false };

  return { ok: true, snapshot: value as unknown as InstallationCertificateR1Snapshot };
}

export function snapshotMatchesIssuance(
  snapshot: InstallationCertificateR1Snapshot,
  issuance: { document_class: unknown; source_contract_version: unknown; certificate_number: unknown; issued_on: unknown },
): boolean {
  return issuance.document_class === "installation-certificate-r1" &&
    issuance.source_contract_version === 1 &&
    issuance.certificate_number === snapshot.certificateNumber &&
    issuance.issued_on === snapshot.issueDate;
}

export function toInstallationCertificateR1Presentation(
  snapshot: InstallationCertificateR1Snapshot,
): InstallationCertificateR1Presentation {
  const { website: _website, logoMode: _logoMode, ...safeIssuer } = snapshot.issuer;
  return {
    certificateNumber: snapshot.certificateNumber,
    issueDate: snapshot.issueDate,
    customer: snapshot.customer,
    vehicle: snapshot.vehicle,
    installation: snapshot.installation,
    items: snapshot.items,
    issuer: safeIssuer,
  };
}

export function sha256InstallationCertificateR1Pdf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isCanonicalInstallationCertificateR1Pdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 9 || bytes.byteLength > INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES) return false;
  const head = Buffer.from(bytes.subarray(0, 5)).toString("ascii");
  if (head !== "%PDF-") return false;
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.byteLength - 1024))).toString("latin1");
  return /%%EOF\s*$/.test(tail);
}

export function validateStoredInstallationCertificateR1Artifact(
  row: InstallationCertificateR1DocumentRow,
  bytes: Uint8Array,
  dealerId: string,
  issuanceId: string,
): boolean {
  if (!validateStoredInstallationCertificateR1Metadata(row, dealerId, issuanceId)) return false;
  if (row.byte_size !== bytes.byteLength || !isCanonicalInstallationCertificateR1Pdf(bytes)) return false;
  return sha256InstallationCertificateR1Pdf(bytes) === row.sha256;
}

export function validateStoredInstallationCertificateR1Metadata(
  row: InstallationCertificateR1DocumentRow,
  dealerId: string,
  issuanceId: string,
): boolean {
  if (!isCanonicalUuid(dealerId) || !isCanonicalUuid(issuanceId) || !isCanonicalUuid(row.id) ||
      row.dealer_id !== dealerId || row.issuance_id !== issuanceId || row.revision !== 1 ||
      row.storage_bucket !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_BUCKET ||
      row.storage_path !== buildInstallationCertificateR1DocumentPath(dealerId, issuanceId, row.id) ||
      row.mime_type !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_MIME_TYPE ||
      row.template_version !== INSTALLATION_CERTIFICATE_R1_DOCUMENT_TEMPLATE_VERSION ||
      !Number.isSafeInteger(row.byte_size) || row.byte_size < 1 ||
      row.byte_size > INSTALLATION_CERTIFICATE_R1_DOCUMENT_MAX_BYTES ||
      !LOWER_HEX_64_RE.test(row.sha256)) return false;
  return true;
}
