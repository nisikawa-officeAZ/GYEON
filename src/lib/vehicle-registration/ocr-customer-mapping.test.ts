// B2-C.4C — unit tests for the shared OCR owner/user customer mapping (no DB, no mocks, no network).
// Run: node --import tsx --test src/lib/vehicle-registration/ocr-customer-mapping.test.ts
//
// This is the FIRST test file for this module. It was a shared business rule consumed by four
// callers — one of which persists its output — with no regression protection at all, which is how
// the party-mismatch defect below survived unnoticed.
//
// The property under test throughout: name, kana and address must describe ONE person. The single
// exception is a certificate where 所有者 and 使用者 are the same person recorded twice, where a
// blank line may be completed from the other one — see `isOneParty` in the module.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeOcrCustomer,
  effectiveCustomerParty,
  resolveCustomer,
} from "./ocr-customer-mapping";
import { OCR_TEST_CASES, runOcrTestCase } from "./ocr-test-cases";
import { normalizeVehicleFields } from "./vehicle-normalize";

// ── the regression this phase exists to fix ─────────────────────────────────────

test("REGRESSION: explicit user with user_name missing never yields owner-name + user-address", () => {
  const r = {
    owner_name:    "山田太郎",
    owner_address: "東京都港区1-2-3",
    user_address:  "神奈川県横浜市4-5-6", // present, but the user is NOT named
  };
  const resolved = resolveCustomer(r, "user");

  assert.equal(effectiveCustomerParty(r, "user"), "owner", "no user name ⇒ the owner is effective");
  assert.equal(resolved.name, "山田太郎");
  assert.equal(
    resolved.address,
    "東京都港区1-2-3",
    "the address must follow the name to the owner, never stay with the unnamed user",
  );
  assert.notEqual(resolved.address, "神奈川県横浜市4-5-6");
});

test("REGRESSION: the effective party's blank address is NOT completed from a different party", () => {
  const r = {
    owner_name:   "山田太郎",
    user_address: "神奈川県横浜市4-5-6",
  };
  // The owner is effective but has no address. Borrowing the unnamed user's address would attach a
  // stranger's address to 山田太郎; blank is correct and remains editable.
  assert.equal(resolveCustomer(r, "user").address, "");
  assert.equal(resolveCustomer(r, "owner").address, "");
});

// ── effective party ─────────────────────────────────────────────────────────────

test("effectiveCustomerParty honours the requested source when that party is named", () => {
  const r = { owner_name: "山田太郎", user_name: "鈴木花子" };
  assert.equal(effectiveCustomerParty(r, "owner"), "owner");
  assert.equal(effectiveCustomerParty(r, "user"), "user");
});

test("effectiveCustomerParty falls back to the party that is actually named", () => {
  assert.equal(effectiveCustomerParty({ owner_name: "山田太郎" }, "user"), "owner");
  assert.equal(effectiveCustomerParty({ user_name: "鈴木花子" }, "owner"), "user");
});

test("effectiveCustomerParty is null when nobody is named", () => {
  assert.equal(effectiveCustomerParty({}, "user"), null);
  assert.equal(effectiveCustomerParty({}, "owner"), null);
  assert.equal(effectiveCustomerParty({ owner_name: "   " }, "owner"), null, "blank is not a name");
});

// ── separated parties: never mixed ──────────────────────────────────────────────

test("separated parties keep name, kana and address strictly apart", () => {
  const r = {
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address:   "東京都港区1-2-3",
    user_name:       "鈴木花子",
    user_name_kana:  "スズキハナコ",
    user_address:    "神奈川県横浜市4-5-6",
  };
  assert.equal(analyzeOcrCustomer(r).ownerUserSeparated, true);

  const owner = resolveCustomer(r, "owner");
  assert.deepEqual(
    { n: owner.name, k: owner.kana, a: owner.address },
    { n: "山田太郎", k: "ヤマダタロウ", a: "東京都港区1-2-3" },
  );

  const user = resolveCustomer(r, "user");
  assert.deepEqual(
    { n: user.name, k: user.kana, a: user.address },
    { n: "鈴木花子", k: "スズキハナコ", a: "神奈川県横浜市4-5-6" },
  );
});

test("separated parties do NOT complete a blank field from the other party", () => {
  const r = {
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address:   "東京都港区1-2-3",
    user_name:       "鈴木花子",
    // 鈴木花子 has neither kana nor address on this certificate.
  };
  const user = resolveCustomer(r, "user");
  assert.equal(user.name, "鈴木花子");
  assert.equal(user.kana, "", "must not borrow 山田太郎's kana");
  assert.equal(user.address, "", "must not borrow 山田太郎's address");
});

// ── one party recorded twice: completion IS allowed ─────────────────────────────

test("owner and user naming the SAME person may complete a blank line from the other", () => {
  // The ordinary 車検証 where the owner drives their own car: 使用者住所 is left blank because it
  // repeats the owner's. Refusing to read it would throw away an address the certificate states.
  const r = {
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address:   "東京都港区1-2-3",
    user_name:       "山田太郎",
  };
  assert.equal(analyzeOcrCustomer(r).ownerUserSeparated, false);

  const user = resolveCustomer(r, "user");
  assert.equal(user.name, "山田太郎");
  assert.equal(user.address, "東京都港区1-2-3", "one person ⇒ the owner line completes the blank");
  assert.equal(user.kana, "ヤマダタロウ");
});

test("same person written with differing width still counts as one party", () => {
  // ownerUserSeparated normalises whitespace, so 「山田 太郎」 and 「山田太郎」 are one person.
  const r = {
    owner_name:    "山田 太郎",
    owner_address: "東京都港区1-2-3",
    user_name:     "山田太郎",
  };
  assert.equal(analyzeOcrCustomer(r).ownerUserSeparated, false);
  assert.equal(resolveCustomer(r, "user").address, "東京都港区1-2-3");
});

// ── single-party certificates ───────────────────────────────────────────────────

test("owner-only certificate resolves fully from the owner under either source", () => {
  const r = {
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    owner_address:   "東京都港区1-2-3",
  };
  for (const source of ["owner", "user"] as const) {
    const resolved = resolveCustomer(r, source);
    assert.deepEqual(
      { n: resolved.name, k: resolved.kana, a: resolved.address },
      { n: "山田太郎", k: "ヤマダタロウ", a: "東京都港区1-2-3" },
      `source=${source}`,
    );
  }
});

test("a certificate naming nobody resolves to blanks and customerType unknown", () => {
  const resolved = resolveCustomer({}, "user");
  assert.deepEqual(
    { n: resolved.name, k: resolved.kana, a: resolved.address, t: resolved.customerType },
    { n: "", k: "", a: "", t: "unknown" },
  );
});

test("blank-string fields are treated as absent, not as values", () => {
  const r = { owner_name: "山田太郎", owner_name_kana: "   ", owner_address: "  " };
  const resolved = resolveCustomer(r, "owner");
  assert.equal(resolved.name, "山田太郎");
  assert.equal(resolved.kana, "");
  assert.equal(resolved.address, "");
});

// ── kana ────────────────────────────────────────────────────────────────────────

test("kana comes from the effective party, never from the other one", () => {
  const r = {
    owner_name:      "山田太郎",
    owner_name_kana: "ヤマダタロウ",
    user_name_kana:  "スズキハナコ", // a kana with no name attached
  };
  // The owner is effective (the user is unnamed), so the user's stray kana must not be used.
  assert.equal(resolveCustomer(r, "user").kana, "ヤマダタロウ");
  assert.equal(resolveCustomer(r, "owner").kana, "ヤマダタロウ");
});

test("kana is trimmed but not otherwise rewritten", () => {
  const r = { owner_name: "山田太郎", owner_name_kana: " ヤマダ タロウ " };
  assert.equal(resolveCustomer(r, "owner").kana, "ヤマダ タロウ");
});

// ── the recommendation is unchanged by this phase ───────────────────────────────

test("business-holder owner still recommends the user, and resolves wholly from them", () => {
  const r = {
    owner_name:     "オリコ信販株式会社",
    owner_address:  "東京都千代田区9-9-9",
    user_name:      "鈴木花子",
    user_name_kana: "スズキハナコ",
    user_address:   "神奈川県横浜市4-5-6",
  };
  const a = analyzeOcrCustomer(r);
  assert.equal(a.recommendedSource, "user");
  assert.equal(a.requireSelection, false);
  assert.notEqual(a.note, null);

  const resolved = resolveCustomer(r, a.recommendedSource);
  assert.deepEqual(
    { n: resolved.name, k: resolved.kana, a: resolved.address },
    { n: "鈴木花子", k: "スズキハナコ", a: "神奈川県横浜市4-5-6" },
  );
});

test("corporation detection is unaffected", () => {
  const r = { owner_name: "株式会社山田製作所", owner_address: "東京都港区1-2-3" };
  assert.equal(resolveCustomer(r, "owner").customerType, "corporation");
  assert.equal(resolveCustomer({ owner_name: "山田太郎" }, "owner").customerType, "individual");
});

// ── grade is manual-only: never derived from the vehicle-name remainder ─────────

test("the full non-maker vehicle-name remainder is preserved as model, never split into a grade", () => {
  const norm = normalizeVehicleFields({ maker: undefined, vehicleName: "トヨタ クラウン アスリート" });
  assert.equal(norm.maker, "トヨタ");
  assert.equal(norm.model, "クラウン アスリート", "the remainder after the maker must stay whole");
  assert.equal("grade" in norm, false, "normalizeVehicleFields must never return a grade field");
});

test("normalizeVehicleFields no longer accepts a grade input field", () => {
  // @ts-expect-error grade is not part of the normalizeVehicleFields input contract
  const norm = normalizeVehicleFields({ maker: "トヨタ", vehicleName: "クラウン", grade: "アスリート" });
  assert.equal(norm.model, "クラウン");
  assert.equal("grade" in norm, false);
});

// ── the existing fixture table must not move ────────────────────────────────────

test("every ocr-test-cases fixture keeps its recommended source and resolved name", () => {
  // These fixtures are the pre-existing contract for callers that pass `recommendedSource`
  // (vehicle-registration/ocr.ts and the admin verification page). If any of them moved, this
  // phase would have changed behaviour for a caller it was supposed to leave alone.
  const failures: string[] = [];
  for (const tc of OCR_TEST_CASES) {
    const result = runOcrTestCase(tc);
    if (!result.pass) failures.push(`${result.name}: ${result.failures.join("; ")}`);
  }
  assert.deepEqual(failures, [], "pre-existing OCR fixtures must still pass unchanged");
});
