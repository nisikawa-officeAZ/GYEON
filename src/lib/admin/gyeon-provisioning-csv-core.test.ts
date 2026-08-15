// GYEON-PARTNER-ONBOARD-F1 — pure provisioning core: CSV validation,
// invitation-error classification, admin projection.
//
// Run: node --import tsx --test src/lib/admin/gyeon-provisioning-csv-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseGyeonProvisioningCsv,
  classifyGyeonInviteError,
  projectGyeonProvisioningRow,
  normalizeGyeonProvisioningEmail,
  GYEON_PROVISIONING_RANKS,
  GYEON_PROVISIONING_STATUSES,
  GYEON_INVITATION_STATES,
  MAX_GYEON_PROVISIONING_ROWS,
} from "./gyeon-provisioning-csv-core";

const HEADER = "representative_email,shop_name,detailer_rank,dealer_code";

// ── State machines (locked values) ───────────────────────────────────────────

test("1. the two state machines carry exactly the locked value sets", () => {
  assert.deepEqual([...GYEON_PROVISIONING_STATUSES], ["registered", "claimed", "revoked"]);
  assert.deepEqual([...GYEON_INVITATION_STATES], ["none", "pending", "sent", "failed", "awaiting_claim"]);
  assert.deepEqual([...GYEON_PROVISIONING_RANKS], ["shop", "detailer", "ppf_installer", "certified"]);
});

// ── CSV parsing ──────────────────────────────────────────────────────────────

test("2. a valid file parses with normalization, optional dealer_code, quoted fields", () => {
  const csv = [
    HEADER,
    ' Owner@Example.COM ,"GYEON 品川, 本店",shop,GY-001',
    "second@example.com,GYEON 大阪,certified,",
  ].join("\r\n");
  const result = parseGyeonProvisioningCsv(csv);
  assert.equal(result.kind, "ok");
  if (result.kind !== "ok") return;
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].emailNormalized, "owner@example.com");
  assert.equal(result.rows[0].shopName, "GYEON 品川, 本店");
  assert.equal(result.rows[0].detailerRank, "shop");
  assert.equal(result.rows[0].dealerCode, "GY-001");
  assert.equal(result.rows[1].dealerCode, null);
  assert.equal(result.rows[1].rowNumber, 3);
});

test("3. header contract: required columns, no unknown columns", () => {
  const missing = parseGyeonProvisioningCsv("representative_email,shop_name\na@b.co,X");
  assert.equal(missing.kind, "error");
  if (missing.kind === "error") {
    assert.ok(missing.errors.some((e) => e.code === "missing-header"));
  }
  const unknown = parseGyeonProvisioningCsv(`${HEADER},plan\na@b.co,X,shop,,pro`);
  assert.equal(unknown.kind, "error");
  if (unknown.kind === "error") {
    assert.ok(unknown.errors.some((e) => e.code === "unknown-header"),
      "forbidden columns (e.g. plan) are rejected, never silently ignored");
  }
});

test("4. row validation fails closed: email shape, rank whitelist, shop name, field count", () => {
  const bad = parseGyeonProvisioningCsv([
    HEADER,
    "not-an-email,Shop,shop,",
    "a@b.co,,detailer,",
    "c@d.co,Shop,platinum,",
    "e@f.co,Shop",
  ].join("\n"));
  assert.equal(bad.kind, "error");
  if (bad.kind !== "error") return;
  const codes = bad.errors.map((e) => e.code).sort();
  assert.deepEqual(codes, ["invalid-email", "invalid-rank", "malformed-row", "missing-shop-name"]);
  const rankError = bad.errors.find((e) => e.code === "invalid-rank");
  assert.equal(rankError?.rowNumber, 4);
});

test("5. in-file duplicates (case-insensitive email, dealer_code) are rejected", () => {
  const dup = parseGyeonProvisioningCsv([
    HEADER,
    "a@b.co,Shop A,shop,GY-1",
    "A@B.CO,Shop B,detailer,GY-2",
    "c@d.co,Shop C,shop,GY-1",
  ].join("\n"));
  assert.equal(dup.kind, "error");
  if (dup.kind !== "error") return;
  assert.ok(dup.errors.some((e) => e.code === "duplicate-email"));
  assert.ok(dup.errors.some((e) => e.code === "duplicate-dealer-code"));
});

test("6. empty file, header-only file, and oversize imports are rejected", () => {
  assert.equal(parseGyeonProvisioningCsv("").kind, "error");
  assert.equal(parseGyeonProvisioningCsv(HEADER).kind, "error");
  const big = [HEADER];
  for (let i = 0; i <= MAX_GYEON_PROVISIONING_ROWS; i += 1) {
    big.push(`user${i}@example.com,Shop ${i},shop,`);
  }
  const over = parseGyeonProvisioningCsv(big.join("\n"));
  assert.equal(over.kind, "error");
  if (over.kind === "error") assert.equal(over.errors[0].code, "too-many-rows");
});

test("7. normalization is trim + lowercase (the DB predicate mirror)", () => {
  assert.equal(normalizeGyeonProvisioningEmail("  Owner@Example.COM  "), "owner@example.com");
});

// ── Invitation-error classification ──────────────────────────────────────────

test("8. email-exists class: no second Auth user is ever created", () => {
  assert.equal(classifyGyeonInviteError({ code: "email_exists", status: 422 }), "email-exists");
  assert.equal(classifyGyeonInviteError({ code: "user_already_exists", status: 422 }), "email-exists");
  assert.equal(classifyGyeonInviteError({ status: 422 }), "email-exists",
    "a 422 without a recognized code still resolves to exists — fail-safe against duplicates");
});

test("9. uncertain class: transport/5xx gives NO verdict (state must stay pending)", () => {
  assert.equal(classifyGyeonInviteError(null), "uncertain");
  assert.equal(classifyGyeonInviteError(undefined), "uncertain");
  assert.equal(classifyGyeonInviteError({ name: "AuthRetryableFetchError" }), "uncertain");
  assert.equal(classifyGyeonInviteError({ status: 0 }), "uncertain");
  assert.equal(classifyGyeonInviteError({ status: 500 }), "uncertain");
  assert.equal(classifyGyeonInviteError({ status: 503 }), "uncertain");
});

test("10. definite-failure class: an answered non-retryable error", () => {
  assert.equal(classifyGyeonInviteError({ status: 400, code: "email_address_invalid" }), "definite-failure");
  assert.equal(classifyGyeonInviteError({ status: 429, code: "over_email_send_rate_limit" }), "definite-failure");
});

// ── Admin projection ─────────────────────────────────────────────────────────

const RAW = {
  id: "prov-1",
  email_normalized: "owner@example.com",
  shop_name: "GYEON 品川",
  detailer_rank: "shop",
  dealer_code: "GY-001",
  provisioning_status: "registered",
  invitation_state: "none",
  invite_sent_at: null,
  claimed_at: null,
  revoked_at: null,
  created_at: "2026-07-31T00:00:00Z",
  // Server-side-only fields that must NEVER cross to the admin client:
  invite_last_error: "CANARY-PROVIDER-ERROR",
  invited_auth_user_id: "CANARY-AUTH-USER",
  created_by_admin_id: "CANARY-ADMIN",
  claimed_by_user_id: "CANARY-CLAIMER",
};

test("11. the projection carries only the whitelisted fields; canaries never survive", () => {
  const row = projectGyeonProvisioningRow(RAW);
  assert.ok(row);
  assert.deepEqual(Object.keys(row!).sort(), [
    "claimedAt", "createdAt", "dealerCode", "detailerRank", "emailNormalized",
    "id", "invitationState", "inviteSentAt", "provisioningStatus", "revokedAt", "shopName",
  ]);
  const serialized = JSON.stringify(row);
  for (const canary of ["CANARY-PROVIDER-ERROR", "CANARY-AUTH-USER", "CANARY-ADMIN", "CANARY-CLAIMER"]) {
    assert.equal(serialized.includes(canary), false, `leaked: ${canary}`);
  }
});

test("12. unknown states, ranks, and malformed rows project to null (fail closed)", () => {
  assert.equal(projectGyeonProvisioningRow({ ...RAW, provisioning_status: "weird" }), null);
  assert.equal(projectGyeonProvisioningRow({ ...RAW, invitation_state: "carrier-pigeon" }), null);
  assert.equal(projectGyeonProvisioningRow({ ...RAW, detailer_rank: "platinum" }), null);
  assert.equal(projectGyeonProvisioningRow({ ...RAW, id: "" }), null);
  assert.equal(projectGyeonProvisioningRow(null), null);
  assert.equal(projectGyeonProvisioningRow("row"), null);
});
