// GYEON partner provisioning — PURE core (GYEON-PARTNER-ONBOARD-F1).
//
// No DB, no "use server", no environment reads — safe for client or server
// import and directly executable under node:test. Hosts the pure logic of the
// provisioning feature:
//   * CSV parsing + validation for the operator import
//   * invitation-error classification (definite vs uncertain vs email-exists)
//   * the whitelist projection of provisioning rows for the admin UI
//
// State machines (locked): provisioning_status registered|claimed|revoked owns
// claim eligibility; invitation_state none|pending|sent|failed|awaiting_claim
// is delivery telemetry ONLY and never gates the claim.

export const GYEON_PROVISIONING_RANKS = [
  "shop",
  "detailer",
  "ppf_installer",
  "certified",
] as const;
export type GyeonProvisioningRank = (typeof GYEON_PROVISIONING_RANKS)[number];

export const GYEON_PROVISIONING_STATUSES = ["registered", "claimed", "revoked"] as const;
export type GyeonProvisioningStatus = (typeof GYEON_PROVISIONING_STATUSES)[number];

export const GYEON_INVITATION_STATES = [
  "none",
  "pending",
  "sent",
  "failed",
  "awaiting_claim",
] as const;
export type GyeonInvitationState = (typeof GYEON_INVITATION_STATES)[number];

export const MAX_GYEON_PROVISIONING_ROWS = 500;

// Required CSV headers (order-independent); dealer_code is the only optional column.
export const GYEON_PROVISIONING_REQUIRED_HEADERS = [
  "representative_email",
  "shop_name",
  "detailer_rank",
] as const;
export const GYEON_PROVISIONING_OPTIONAL_HEADERS = ["dealer_code"] as const;

export function normalizeGyeonProvisioningEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGyeonProvisioningEmail(raw: string): boolean {
  return EMAIL_SHAPE.test(raw.trim());
}

export function isGyeonProvisioningRank(v: string): v is GyeonProvisioningRank {
  return (GYEON_PROVISIONING_RANKS as readonly string[]).includes(v);
}

export interface GyeonProvisioningCsvRow {
  rowNumber: number; // 1-based line number in the source file (header = 1)
  emailNormalized: string;
  shopName: string;
  detailerRank: GyeonProvisioningRank;
  dealerCode: string | null;
}

export type GyeonProvisioningCsvErrorCode =
  | "empty-file"
  | "missing-header"
  | "unknown-header"
  | "malformed-row"
  | "missing-email"
  | "invalid-email"
  | "missing-shop-name"
  | "invalid-rank"
  | "duplicate-email"
  | "duplicate-dealer-code"
  | "too-many-rows";

export interface GyeonProvisioningCsvError {
  rowNumber: number; // 0 = file-level
  code: GyeonProvisioningCsvErrorCode;
  message: string;
}

export type GyeonProvisioningCsvResult =
  | { kind: "ok"; rows: GyeonProvisioningCsvRow[] }
  | { kind: "error"; errors: GyeonProvisioningCsvError[] };

// ── Minimal RFC-4180-style CSV reader ────────────────────────────────────────
// Handles quoted fields, embedded commas, escaped quotes ("") and embedded
// newlines inside quotes; tolerates CRLF and a UTF-8 BOM.

function splitCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => { record.push(field); field = ""; };
  const pushRecord = () => { pushField(); records.push(record); record = []; };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ",") { pushField(); i += 1; continue; }
    if (ch === "\r") { i += 1; continue; }
    if (ch === "\n") { pushRecord(); i += 1; continue; }
    field += ch; i += 1;
  }
  if (field !== "" || record.length > 0) pushRecord();

  // Drop fully-empty trailing records (blank lines).
  return records.filter((r) => r.some((f) => f.trim() !== ""));
}

export function parseGyeonProvisioningCsv(text: string): GyeonProvisioningCsvResult {
  const records = splitCsv(text ?? "");
  if (records.length === 0) {
    return { kind: "error", errors: [{ rowNumber: 0, code: "empty-file", message: "CSV is empty." }] };
  }

  const errors: GyeonProvisioningCsvError[] = [];
  const header = records[0].map((h) => h.trim().toLowerCase());

  const known = new Set<string>([
    ...GYEON_PROVISIONING_REQUIRED_HEADERS,
    ...GYEON_PROVISIONING_OPTIONAL_HEADERS,
  ]);
  for (const h of header) {
    if (!known.has(h)) {
      errors.push({ rowNumber: 1, code: "unknown-header", message: `Unknown column: ${h}` });
    }
  }
  for (const required of GYEON_PROVISIONING_REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      errors.push({ rowNumber: 1, code: "missing-header", message: `Missing column: ${required}` });
    }
  }
  if (errors.length > 0) return { kind: "error", errors };

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    return { kind: "error", errors: [{ rowNumber: 0, code: "empty-file", message: "CSV has a header but no rows." }] };
  }
  if (dataRecords.length > MAX_GYEON_PROVISIONING_ROWS) {
    return {
      kind: "error",
      errors: [{
        rowNumber: 0,
        code: "too-many-rows",
        message: `At most ${MAX_GYEON_PROVISIONING_ROWS} rows per import (got ${dataRecords.length}).`,
      }],
    };
  }

  const col = (name: string) => header.indexOf(name);
  const iEmail = col("representative_email");
  const iShop = col("shop_name");
  const iRank = col("detailer_rank");
  const iCode = col("dealer_code");

  const rows: GyeonProvisioningCsvRow[] = [];
  const seenEmails = new Set<string>();
  const seenCodes = new Set<string>();

  dataRecords.forEach((rec, idx) => {
    const rowNumber = idx + 2; // header is line 1
    if (rec.length !== header.length) {
      errors.push({ rowNumber, code: "malformed-row", message: `Expected ${header.length} fields, got ${rec.length}.` });
      return;
    }
    const emailRaw = (rec[iEmail] ?? "").trim();
    const shopName = (rec[iShop] ?? "").trim();
    const rank = (rec[iRank] ?? "").trim();
    const codeRaw = iCode >= 0 ? (rec[iCode] ?? "").trim() : "";

    if (emailRaw === "") {
      errors.push({ rowNumber, code: "missing-email", message: "representative_email is required." });
      return;
    }
    if (!isValidGyeonProvisioningEmail(emailRaw)) {
      errors.push({ rowNumber, code: "invalid-email", message: `Not an email address: ${emailRaw}` });
      return;
    }
    if (shopName === "") {
      errors.push({ rowNumber, code: "missing-shop-name", message: "shop_name is required." });
      return;
    }
    if (!isGyeonProvisioningRank(rank)) {
      errors.push({
        rowNumber,
        code: "invalid-rank",
        message: `detailer_rank must be one of ${GYEON_PROVISIONING_RANKS.join(", ")} (got: ${rank})`,
      });
      return;
    }

    const emailNormalized = normalizeGyeonProvisioningEmail(emailRaw);
    if (seenEmails.has(emailNormalized)) {
      errors.push({ rowNumber, code: "duplicate-email", message: `Duplicate email in file: ${emailNormalized}` });
      return;
    }
    seenEmails.add(emailNormalized);

    const dealerCode = codeRaw === "" ? null : codeRaw;
    if (dealerCode !== null) {
      if (seenCodes.has(dealerCode)) {
        errors.push({ rowNumber, code: "duplicate-dealer-code", message: `Duplicate dealer_code in file: ${dealerCode}` });
        return;
      }
      seenCodes.add(dealerCode);
    }

    rows.push({ rowNumber, emailNormalized, shopName, detailerRank: rank, dealerCode });
  });

  if (errors.length > 0) return { kind: "error", errors };
  return { kind: "ok", rows };
}

// ── Invitation-error classification ──────────────────────────────────────────
// The Auth Admin invite call has exactly three meaningful failure classes for
// the state machine:
//   "email-exists"      → the address already belongs to an Auth user:
//                          invitation_state = awaiting_claim, NEVER a 2nd user
//   "definite-failure"  → the API answered with a non-retryable error:
//                          invitation_state = failed (explicit resend allowed)
//   "uncertain"         → no trustworthy answer (network/timeout/5xx):
//                          invitation_state STAYS pending; automatic resend is
//                          prohibited — only superAdmin reconcile/resend act.

export interface GyeonInviteErrorShape {
  name?: string;
  code?: string;
  status?: number;
}

export type GyeonInviteErrorClass = "email-exists" | "definite-failure" | "uncertain";

export function classifyGyeonInviteError(error: GyeonInviteErrorShape | null | undefined): GyeonInviteErrorClass {
  if (!error) return "uncertain"; // no error object at all → nothing trustworthy
  if (error.code === "email_exists" || error.code === "user_already_exists") {
    return "email-exists";
  }
  // Retryable transport failures and server-side faults give no verdict.
  if (error.name === "AuthRetryableFetchError") return "uncertain";
  if (typeof error.status === "number" && (error.status === 0 || error.status >= 500)) {
    return "uncertain";
  }
  if (typeof error.status === "number" && error.status === 422) {
    // 422 without a recognized code: legacy/renamed duplicate-email shapes are
    // still "exists" (fail-safe: never create a duplicate by re-sending).
    return "email-exists";
  }
  return "definite-failure";
}

// ── Admin UI projection ──────────────────────────────────────────────────────
// Only these fields ever cross to the admin client. invite_last_error stays
// server-side (provider messages can embed URLs/tokens).

export interface GyeonProvisioningAdminRow {
  id: string;
  emailNormalized: string;
  shopName: string;
  detailerRank: GyeonProvisioningRank;
  dealerCode: string | null;
  provisioningStatus: GyeonProvisioningStatus;
  invitationState: GyeonInvitationState;
  inviteSentAt: string | null;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
}

export function projectGyeonProvisioningRow(raw: unknown): GyeonProvisioningAdminRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const email = typeof r.email_normalized === "string" ? r.email_normalized : "";
  const shop = typeof r.shop_name === "string" ? r.shop_name : "";
  const rank = typeof r.detailer_rank === "string" ? r.detailer_rank : "";
  const status = typeof r.provisioning_status === "string" ? r.provisioning_status : "";
  const invitation = typeof r.invitation_state === "string" ? r.invitation_state : "";

  if (id === "" || email === "" || shop === "") return null;
  if (!isGyeonProvisioningRank(rank)) return null;
  if (!(GYEON_PROVISIONING_STATUSES as readonly string[]).includes(status)) return null;
  if (!(GYEON_INVITATION_STATES as readonly string[]).includes(invitation)) return null;

  return {
    id,
    emailNormalized: email,
    shopName: shop,
    detailerRank: rank,
    dealerCode: typeof r.dealer_code === "string" && r.dealer_code !== "" ? r.dealer_code : null,
    provisioningStatus: status as GyeonProvisioningStatus,
    invitationState: invitation as GyeonInvitationState,
    inviteSentAt: typeof r.invite_sent_at === "string" ? r.invite_sent_at : null,
    claimedAt: typeof r.claimed_at === "string" ? r.claimed_at : null,
    revokedAt: typeof r.revoked_at === "string" ? r.revoked_at : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
  };
}
