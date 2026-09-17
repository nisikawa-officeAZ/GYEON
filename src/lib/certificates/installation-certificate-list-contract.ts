import {
  parseInstallationCertificateR1Snapshot,
  type InstallationCertificateR1Snapshot,
} from "./installation-certificate-r1-artifact-core";

export const INSTALLATION_CERTIFICATE_PAGE_SIZE = 25;
export const INSTALLATION_CERTIFICATE_SEARCH_MAX_LENGTH = 100;

export interface InstallationCertificateListRow {
  readonly id: string;
  readonly certificate_number: string;
  readonly issued_on: string;
  readonly issued_at: string;
  readonly snapshot: unknown;
}

export interface InstallationCertificateListItem {
  readonly issuanceId: string;
  readonly certificateNumber: string;
  readonly issueDate: string;
  readonly issuedAt: string;
  readonly customerName: string;
  readonly vehicleName: string;
  readonly plate: string | null;
  readonly appliedDate: string;
  readonly technician: string;
  readonly hasDocument: boolean;
  readonly snapshotValid: boolean;
}

export function normalizeCertificateSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, INSTALLATION_CERTIFICATE_SEARCH_MAX_LENGTH);
}

export function normalizeCertificatePage(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/** Escape PostgreSQL LIKE metacharacters while keeping user text literal. */
export function escapeCertificateLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function invalidSnapshotItem(
  row: InstallationCertificateListRow,
  hasDocument: boolean,
): InstallationCertificateListItem {
  return {
    issuanceId: row.id,
    certificateNumber: row.certificate_number,
    issueDate: row.issued_on,
    issuedAt: row.issued_at,
    customerName: "データ確認が必要です",
    vehicleName: "データ確認が必要です",
    plate: null,
    appliedDate: row.issued_on,
    technician: "—",
    hasDocument: false,
    snapshotValid: false,
  };
}

export function projectInstallationCertificateListItem(
  row: InstallationCertificateListRow,
  hasDocument: boolean,
): InstallationCertificateListItem {
  const parsed = parseInstallationCertificateR1Snapshot(row.snapshot);
  if (!parsed.ok) return invalidSnapshotItem(row, hasDocument);
  const snapshot: InstallationCertificateR1Snapshot = parsed.snapshot;
  if (
    snapshot.certificateNumber !== row.certificate_number ||
    snapshot.issueDate !== row.issued_on
  ) {
    return invalidSnapshotItem(row, hasDocument);
  }

  return {
    issuanceId: row.id,
    certificateNumber: row.certificate_number,
    issueDate: row.issued_on,
    issuedAt: row.issued_at,
    customerName: snapshot.customer.name,
    vehicleName: snapshot.vehicle.name,
    plate: snapshot.vehicle.plate ?? null,
    appliedDate: snapshot.installation.appliedDate,
    technician: snapshot.installation.technician,
    hasDocument,
    snapshotValid: true,
  };
}
