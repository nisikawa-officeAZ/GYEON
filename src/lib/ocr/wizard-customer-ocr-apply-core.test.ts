// B2-C.2 / B2-C.4C — unit tests for the pure OCR → Screen 1 customer-draft core.
// No DB, no mocks, no network.
// Run: node --import tsx --test src/lib/ocr/wizard-customer-ocr-apply-core.test.ts
//
// The duplicate-reason tests deliberately drive the REAL B2-D core
// (find-wizard-customer-duplicates-core.ts) rather than a local restatement of its rules. That is
// the point of them: the product contract says an OCR-applied name gets no special treatment, and
// the only way to assert "no special treatment" is to run the applied values through the very code
// a hand-typed value goes through.
//
// B2-C.4C: the effective-party tests that used to live here have moved to
// ocr-customer-mapping.test.ts along with the rule itself. This file no longer owns a second copy
// of that contract — it tests only what this module actually decides: candidate precedence, the
// anti-mixing rule, and which draft fields are eligible.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OCR_APPLICABLE_DRAFT_FIELDS,
  buildWizardCustomerOcrPatch,
} from "./wizard-customer-ocr-apply-core";

import {
  planDuplicateCheck,
  classifyReason,
  type DuplicateMatchKeys,
} from "@/lib/customers/find-wizard-customer-duplicates-core";

/** Match keys for an input the rule must accept. Fails loudly rather than returning a fake. */
function keysFor(input: { name?: string; kana?: string; phone?: string }): DuplicateMatchKeys {
  const plan = planDuplicateCheck(input);
  assert.equal(plan.ok, true, "expected the duplicate rule to be applicable for this input");
  if (!plan.ok) throw new Error("unreachable");
  return plan.keys;
}

// ── confirmed candidate takes precedence (B2-C.4C) ──────────────────────────────

test("a confirmed candidate name wins over conflicting raw OCR fields", () => {
  // The review screen resolved 所有者 as the customer — perhaps because the operator explicitly
  // chose them. Re-deriving from the raw fields would default to 使用者 and silently overrule that.
  const patch = buildWizardCustomerOcrPatch({
    customer_candidate_name:    "山田太郎",
    customer_candidate_address: "東京都港区1-2-3",
    owner_name:    "山田太郎",
    owner_address: "東京都港区1-2-3",
    user_name:     "鈴木花子",
    user_address:  "神奈川県横浜市4-5-6",
  });
  assert.equal(patch.name, "山田太郎", "the operator's confirmed party must survive");
  assert.equal(patch.address, "東京都港区1-2-3");
  assert.notEqual(patch.name, "鈴木花子");
});

test("candidate name with an absent candidate address does NOT back-fill from raw OCR", () => {
  const patch = buildWizardCustomerOcrPatch({
    customer_candidate_name: "山田太郎",
    owner_address: "東京都港区1-2-3",
    user_name:     "鈴木花子",
    user_address:  "神奈川県横浜市4-5-6",
  });
  assert.equal(patch.name, "山田太郎");
  assert.equal("address" in patch, false, "an absent candidate field stays absent and editable");
});

test("candidate name never acquires a kana derived from the raw fields", () => {
  // There is no customer_candidate_kana yet. Deriving one here would default to a party the
  // candidate name may not have come from — a name and a kana read off two different lines.
  const patch = buildWizardCustomerOcrPatch({
    customer_candidate_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    user_name:       "鈴木花子",
    user_name_kana:  "スズキハナコ",
  });
  assert.equal(patch.name, "山田太郎");
  assert.equal("kana" in patch, false, "kana must not be guessed while the candidate is authoritative");
});

test("a blank candidate name is not a candidate — raw fallback still applies", () => {
  const patch = buildWizardCustomerOcrPatch({
    customer_candidate_name: "   ",
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address:   "東京都港区1-2-3",
  });
  assert.deepEqual(
    { n: patch.name, k: patch.kana, a: patch.address },
    { n: "山田太郎", k: "ヤマダタロウ", a: "東京都港区1-2-3" },
  );
});

test("an explicit source is ignored while a confirmed candidate is present", () => {
  // The candidate already encodes the party decision; a source argument must not re-open it.
  const result = {
    customer_candidate_name: "山田太郎",
    owner_name: "山田太郎",
    user_name:  "鈴木花子",
  };
  assert.equal(buildWizardCustomerOcrPatch(result, "user").name, "山田太郎");
  assert.equal(buildWizardCustomerOcrPatch(result, "owner").name, "山田太郎");
});

// ── raw fallback (no candidate) ─────────────────────────────────────────────────

test("maps the full name into the draft", () => {
  const patch = buildWizardCustomerOcrPatch({ owner_name: "山田太郎" });
  assert.equal(patch.name, "山田太郎");
});

test("applies kana when the certificate carries it", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
  });
  assert.equal(patch.kana, "ヤマダタロウ");
});

test("omits kana entirely when the certificate has none", () => {
  const patch = buildWizardCustomerOcrPatch({ owner_name: "山田太郎" });
  assert.equal("kana" in patch, false, "an absent kana must not appear as an empty string");
});

test("applies the address when present and omits it when absent", () => {
  const withAddress = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_address: "東京都港区1-2-3",
  });
  assert.equal(withAddress.address, "東京都港区1-2-3");

  const without = buildWizardCustomerOcrPatch({ owner_name: "山田太郎" });
  assert.equal("address" in without, false);
});

test("trims OCR whitespace but does not otherwise rewrite the operator-facing value", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "  山田 太郎  ",
    owner_name_kana: " ヤマダ タロウ ",
  });
  // The interior space survives: normalisation for MATCHING happens in the duplicate core, on a
  // copy. The draft keeps what the operator is being asked to confirm.
  assert.equal(patch.name, "山田 太郎");
  assert.equal(patch.kana, "ヤマダ タロウ");
});

test("a finance/leasing owner defaults to the user as the customer", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "オリコ信販株式会社",
    owner_address: "東京都千代田区9-9-9",
    user_name: "鈴木花子",
    user_name_kana: "スズキハナコ",
    user_address: "神奈川県横浜市4-5-6",
  });
  assert.equal(patch.name, "鈴木花子");
  assert.equal(patch.kana, "スズキハナコ");
  assert.equal(patch.address, "神奈川県横浜市4-5-6");
});

test("an explicit source overrides the recommendation when there is no candidate", () => {
  const result = {
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    user_name: "鈴木花子",
    user_name_kana: "スズキハナコ",
  };
  assert.equal(buildWizardCustomerOcrPatch(result, "owner").name, "山田太郎");
  assert.equal(buildWizardCustomerOcrPatch(result, "user").name, "鈴木花子");
});

test("the applied fields all come from one party (delegated to the shared resolver)", () => {
  // The rule itself is asserted in ocr-customer-mapping.test.ts. This checks only that the wizard
  // consumes it rather than re-deriving: asking for the user on an owner-only certificate must
  // yield the owner's name AND the owner's kana AND the owner's address.
  const patch = buildWizardCustomerOcrPatch(
    {
      owner_name: "山田太郎",
      owner_name_kana: "ヤマダタロウ",
      owner_address: "東京都港区1-2-3",
      user_address: "神奈川県横浜市4-5-6",
    },
    "user",
  );
  assert.deepEqual(
    { n: patch.name, k: patch.kana, a: patch.address },
    { n: "山田太郎", k: "ヤマダタロウ", a: "東京都港区1-2-3" },
  );
});

// ── the patch may never widen beyond three fields ───────────────────────────────

test("emits only name, kana and address — never phone, email, postal or LINE id", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address: "東京都港区1-2-3",
    // Fields a 車検証 does carry, none of which are customer-contact fields:
    chassis_number: "ABC-1234567",
    license_plate_number: "1234",
    color: "白",
  });
  assert.deepEqual(Object.keys(patch).sort(), ["address", "kana", "name"]);
  for (const key of Object.keys(patch)) {
    assert.ok(
      (OCR_APPLICABLE_DRAFT_FIELDS as readonly string[]).includes(key),
      `${key} is outside the OCR-applicable allowlist`,
    );
  }
});

test("a blank or unreadable result yields an EMPTY patch, never blank strings", () => {
  assert.deepEqual(buildWizardCustomerOcrPatch({}), {});
  assert.deepEqual(
    buildWizardCustomerOcrPatch({ owner_name: "   ", owner_name_kana: "  ", owner_address: "" }),
    {},
    "whitespace-only OCR output must not overwrite fields the operator already filled",
  );
});

// ── duplicate reason rules, asserted through the REAL B2-D core ─────────────────

test("same normalized full name AND same kana yields name_kana", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
  });
  const keys = keysFor({ name: patch.name, kana: patch.kana, phone: "" });
  const row = {
    match_name_norm: "山田太郎",
    match_kana_norm: "ヤマダタロウ",
    match_phone_digits: null,
  };
  assert.equal(classifyReason(row, keys), "name_kana");
});

test("same full name with kana ABSENT yields name", () => {
  const patch = buildWizardCustomerOcrPatch({ owner_name: "山田太郎" });
  const keys = keysFor({ name: patch.name, kana: patch.kana, phone: "" });
  const row = {
    match_name_norm: "山田太郎",
    match_kana_norm: "ヤマダタロウ",
    match_phone_digits: null,
  };
  assert.equal(classifyReason(row, keys), "name");
});

test("same full name with a DIFFERENT kana yields name, not name_kana", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
  });
  const keys = keysFor({ name: patch.name, kana: patch.kana, phone: "" });
  const row = {
    match_name_norm: "山田太郎",
    match_kana_norm: "ヤマモトタロウ",
    match_phone_digits: null,
  };
  assert.equal(
    classifyReason(row, keys),
    "name",
    "a disagreeing kana must be reported honestly as a name-only match",
  );
});

// ── no OCR-specific exception ───────────────────────────────────────────────────

test("OCR-applied values produce the SAME match keys as identical hand-typed values", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
  });
  const fromOcr = keysFor({ name: patch.name, kana: patch.kana, phone: "" });
  const typedByHand = keysFor({ name: "山田太郎", kana: "ヤマダタロウ", phone: "" });
  assert.deepEqual(fromOcr, typedByHand, "the OCR path must have no duplicate-matching exception");
});

test("half-width katakana from OCR matches full-width stored kana", () => {
  // NFKC equivalence is the duplicate core's rule, not this module's — asserted here because OCR is
  // the path most likely to emit half-width katakana in the first place.
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ﾔﾏﾀﾞﾀﾛｳ",
  });
  const keys = keysFor({ name: patch.name, kana: patch.kana, phone: "" });
  const row = {
    match_name_norm: "山田太郎",
    match_kana_norm: "ヤマダタロウ",
    match_phone_digits: null,
  };
  assert.equal(classifyReason(row, keys), "name_kana");
});

test("the patch never carries a phone key, so phone precedence is untouched", () => {
  const patch = buildWizardCustomerOcrPatch({
    owner_name: "山田太郎",
    owner_name_kana: "ヤマダタロウ",
  });
  assert.equal("phone" in patch, false);

  // A phone the OPERATOR typed still wins the reason precedence, exactly as before.
  const keys = keysFor({ name: patch.name, kana: patch.kana, phone: "090-1234-5678" });
  const row = {
    match_name_norm: "山田太郎",
    match_kana_norm: "ヤマダタロウ",
    match_phone_digits: "09012345678",
  };
  assert.equal(classifyReason(row, keys), "phone");
});
