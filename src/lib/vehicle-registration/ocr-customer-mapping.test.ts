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

// ── R7: marker / directional-phrase resolution (string-only, NFKC classify, trim) ──────────────
//
// 車検証 OCR text routinely carries placeholder text instead of a real name/address: blank, an
// asterisk-only redaction, the literal 同上, or a directional phrase pointing at the other party's
// line (e.g. 所有者欄に "使用者に同じ"). Classification never mutates the raw trimmed text that is
// preserved on OcrCustomerAnalysis; only the resolved value used for identity/postal decisions is
// ever blanked or copied.

// ── the four correct one-hop directional phrases ────────────────────────────────

test("DIRECTIONAL: owner_name 使用者に同じ copies the concrete user_name, and proves the parties equal", () => {
  const r = {
    owner_name:    "使用者に同じ",
    owner_address: "東京都港区1-2-3",
    user_name:     "鈴木花子",
    user_address:  "神奈川県横浜市4-5-6",
  };
  const a = analyzeOcrCustomer(r);
  assert.equal(a.ownerName, "使用者に同じ", "the raw trimmed text is preserved untouched");
  assert.equal(a.ownerUserSeparated, false, "name direction proved the two lines are one person");
  assert.equal(resolveCustomer(r, "owner").name, "鈴木花子", "the directional phrase resolved to the concrete user name");
});

test("DIRECTIONAL: owner_address 使用者住所に同じ copies the concrete user_address without changing party classification", () => {
  const r = {
    owner_name:    "山田太郎",
    owner_address: "使用者住所に同じ",
    user_name:     "鈴木花子",
    user_address:  "神奈川県横浜市4-5-6",
  };
  const a = analyzeOcrCustomer(r);
  assert.equal(a.ownerAddress, "使用者住所に同じ", "the raw trimmed text is preserved untouched");
  assert.equal(a.ownerUserSeparated, true, "address direction must never change the separated decision");
  assert.equal(resolveCustomer(r, "owner").address, "神奈川県横浜市4-5-6");
  assert.equal(resolveCustomer(r, "owner").name, "山田太郎");
});

test("DIRECTIONAL: user_name 所有者に同じ copies the concrete owner_name", () => {
  const r = { owner_name: "山田太郎", user_name: "所有者に同じ", user_address: "神奈川県横浜市4-5-6" };
  const a = analyzeOcrCustomer(r);
  assert.equal(a.userName, "所有者に同じ", "the raw trimmed text is preserved untouched");
  assert.equal(resolveCustomer(r, "user").name, "山田太郎", "the directional phrase resolved to the concrete owner name");
});

test("DIRECTIONAL: user_address 所有者住所に同じ copies the concrete owner_address", () => {
  const r = {
    owner_name: "山田太郎", owner_address: "東京都港区1-2-3",
    user_name:  "鈴木花子", user_address:  "所有者住所に同じ",
  };
  const a = analyzeOcrCustomer(r);
  assert.equal(a.userAddress, "所有者住所に同じ", "the raw trimmed text is preserved untouched");
  assert.equal(resolveCustomer(r, "user").address, "東京都港区1-2-3", "the directional phrase resolved to the concrete owner address");
});

// ── name resolution completing a one-party address (not marker-created) ─────────

test("DIRECTIONAL: name-direction equality legitimately completes a blank address via the existing one-party rule", () => {
  const r = { owner_name: "使用者に同じ", user_name: "山田太郎", user_address: "神奈川県横浜市4-5-6" };
  assert.equal(analyzeOcrCustomer(r).ownerUserSeparated, false);
  assert.equal(resolveCustomer(r, "owner").address, "神奈川県横浜市4-5-6");
});

// ── wrong field / wrong party: never resolvable, regardless of the opposite field ──

test("WRONG-PARTY: owner_name carrying the self-referential 所有者に同じ never resolves", () => {
  const r = { owner_name: "所有者に同じ", user_name: "鈴木花子" };
  // If the owner name had resolved, "owner" would be effective (it's the requested source);
  // since it never resolves, the only named party — the user — is used instead.
  assert.equal(effectiveCustomerParty(r, "owner"), "user");
  assert.equal(resolveCustomer(r, "owner").name, "鈴木花子");
});

test("WRONG-FIELD: owner_name carrying the address-direction phrase never resolves", () => {
  const r = { owner_name: "使用者住所に同じ", user_name: "鈴木花子" };
  assert.equal(effectiveCustomerParty(r, "owner"), "user");
  assert.equal(resolveCustomer(r, "owner").name, "鈴木花子");
});

test("WRONG-FIELD: owner_address carrying the name-direction phrase never resolves (name/address never cross)", () => {
  const r = {
    owner_name:    "山田太郎",
    owner_address: "使用者に同じ", // a NAME-direction phrase in an ADDRESS field — must never resolve
    user_name:     "鈴木花子",
    user_address:  "神奈川県横浜市4-5-6",
  };
  const resolved = resolveCustomer(r, "owner");
  assert.equal(resolved.name, "山田太郎", "the owner is still effective");
  assert.equal(resolved.address, "", "the wrong-field phrase must not resolve, and separated parties never borrow");
  assert.notEqual(resolved.address, "神奈川県横浜市4-5-6");
});

test("WRONG-PARTY: user_address carrying the self-referential 使用者住所に同じ never resolves", () => {
  const r = {
    owner_name:    "山田太郎",
    owner_address: "東京都港区1-2-3",
    user_name:     "鈴木花子",
    user_address:  "使用者住所に同じ", // self-referential — points at its own party, never the owner
  };
  const resolved = resolveCustomer(r, "user");
  assert.equal(resolved.name, "鈴木花子", "the user is still effective");
  assert.equal(resolved.address, "", "the self-referential phrase must not resolve, and separated parties never borrow");
  assert.notEqual(resolved.address, "東京都港区1-2-3");
});

// ── TABLE: each of the four approved phrases is unusable in every OTHER field ──────────────────
//
// Observable-behavior only (analyzeOcrCustomer / effectiveCustomerParty / resolveCustomer) — never
// the internal resolved fields. Every field the phrase is NOT placed in carries a distinct,
// concrete, synthetic filler name/address, so a wrong placement that silently resolved would be
// detectable: a leaked name would surface as the WRONG party's name, and a leaked address would
// surface as the OTHER party's address instead of staying blank.

test("TABLE: each directional phrase is unusable in every field other than its own", () => {
  const FILLER = {
    owner_name:    "藤田一郎",
    owner_address: "北海道札幌市1-1-1",
    user_name:     "佐藤次郎",
    user_address:  "福岡県福岡市2-2-2",
  } as const;

  const CORRECT_FIELD_FOR_PHRASE: Record<string, keyof typeof FILLER> = {
    "使用者に同じ":     "owner_name",
    "使用者住所に同じ": "owner_address",
    "所有者に同じ":     "user_name",
    "所有者住所に同じ": "user_address",
  };

  const FIELD_PARTY: Record<keyof typeof FILLER, "owner" | "user"> = {
    owner_name: "owner", owner_address: "owner", user_name: "user", user_address: "user",
  };
  const FIELD_KIND: Record<keyof typeof FILLER, "name" | "address"> = {
    owner_name: "name", owner_address: "address", user_name: "name", user_address: "address",
  };

  for (const [phrase, correctField] of Object.entries(CORRECT_FIELD_FOR_PHRASE)) {
    for (const wrongField of Object.keys(FILLER) as (keyof typeof FILLER)[]) {
      if (wrongField === correctField) continue; // the one field where this phrase IS valid
      const r = { ...FILLER, [wrongField]: phrase };
      const party = FIELD_PARTY[wrongField];
      const label = `"${phrase}" placed in ${wrongField}`;

      if (FIELD_KIND[wrongField] === "name") {
        const otherParty = party === "owner" ? "user" : "owner";
        const otherPartyName = otherParty === "owner" ? FILLER.owner_name : FILLER.user_name;
        assert.equal(
          effectiveCustomerParty(r, party), otherParty,
          `${label}: must not resolve, so the other party becomes effective`,
        );
        assert.equal(
          resolveCustomer(r, party).name, otherPartyName,
          `${label}: resolved name must be the OTHER party's, never derived from the phrase`,
        );
      } else {
        assert.equal(
          resolveCustomer(r, party).address, "",
          `${label}: address must stay blank, never borrow the opposite party's address`,
        );
      }
    }
  }
});

// ── unresolved directional phrase: the opposite field is not concrete ───────────

test("UNRESOLVED: owner_name 使用者に同じ stays unusable when user_name is absent", () => {
  const r = { owner_name: "使用者に同じ" };
  assert.equal(effectiveCustomerParty(r, "owner"), null, "nobody is resolvably named");
  assert.equal(resolveCustomer(r, "owner").name, "");
});

test("UNRESOLVED: owner_name 使用者に同じ stays unusable when user_name is 同上", () => {
  const r = { owner_name: "使用者に同じ", user_name: "同上" };
  assert.equal(effectiveCustomerParty(r, "owner"), null, "同上 is not concrete, so the phrase cannot resolve either");
  assert.equal(resolveCustomer(r, "owner").name, "");
});

test("UNRESOLVED: owner_name 使用者に同じ stays unusable when user_name is an asterisk marker", () => {
  const r = { owner_name: "使用者に同じ", user_name: "***" };
  assert.equal(effectiveCustomerParty(r, "owner"), null);
  assert.equal(resolveCustomer(r, "owner").name, "");
});

test("UNRESOLVED: owner_name 使用者に同じ stays unusable when user_name is itself a directional phrase", () => {
  const r = { owner_name: "使用者に同じ", user_name: "使用者住所に同じ" };
  assert.equal(effectiveCustomerParty(r, "owner"), null, "a directional opposite is not concrete either");
  assert.equal(resolveCustomer(r, "owner").name, "");
});

// ── cycles: mutual directional reference resolves to nothing on either side ─────

test("CYCLE: owner_name 使用者に同じ and user_name 所有者に同じ never resolve (no recursion)", () => {
  const r = { owner_name: "使用者に同じ", user_name: "所有者に同じ" };
  assert.equal(effectiveCustomerParty(r, "owner"), null, "neither side of the cycle ever resolves");
  assert.equal(effectiveCustomerParty(r, "user"), null);
  assert.equal(resolveCustomer(r, "owner").name, "");
  assert.equal(resolveCustomer(r, "user").name, "");
});

test("CYCLE: owner_address and user_address mutually referencing each other never resolve, even when the names prove one party", () => {
  const r = {
    owner_name:    "山田太郎",
    owner_address: "使用者住所に同じ",
    user_name:     "山田太郎",
    user_address:  "所有者住所に同じ",
  };
  assert.equal(analyzeOcrCustomer(r).ownerUserSeparated, false, "same name on both lines ⇒ one party");
  // Even though the names prove one party (which would normally allow a blank address to be
  // completed from the other line), the cyclic address phrases never resolve on either side, so
  // there is nothing concrete to borrow — both stay blank.
  assert.equal(resolveCustomer(r, "owner").address, "");
  assert.equal(resolveCustomer(r, "user").address, "");
});

// ── asterisk-only redactions: ASCII and full-width, unusable ────────────────────

test("MARKER: an ASCII asterisk-only owner_name is unusable", () => {
  assert.equal(effectiveCustomerParty({ owner_name: "***" }, "owner"), null);
  assert.equal(resolveCustomer({ owner_name: "***" }, "owner").name, "");
});

test("MARKER: a full-width asterisk-only owner_name is unusable", () => {
  assert.equal(effectiveCustomerParty({ owner_name: "＊＊＊" }, "owner"), null);
  assert.equal(resolveCustomer({ owner_name: "＊＊＊" }, "owner").name, "");
});

test("MARKER: a mixed-width asterisk-only owner_name is unusable", () => {
  assert.equal(effectiveCustomerParty({ owner_name: "＊*＊" }, "owner"), null);
  assert.equal(resolveCustomer({ owner_name: "＊*＊" }, "owner").name, "");
});

// ── TABLE: every required marker-value shape (1-char / multi-char, ASCII / full-width, mixed) ──

test("MARKER TABLE: one-char and multi-char asterisk markers are unusable in both a name and an address field, ASCII and full-width alike", () => {
  const MARKER_VALUES = ["*", "***", "＊", "＊＊＊", "＊*＊"];
  for (const marker of MARKER_VALUES) {
    assert.equal(
      effectiveCustomerParty({ owner_name: marker }, "owner"), null,
      `owner_name="${marker}" must be unusable`,
    );
    assert.equal(resolveCustomer({ owner_name: marker }, "owner").name, "", `owner_name="${marker}"`);

    const r = { owner_name: "山田太郎", owner_address: marker };
    assert.equal(
      resolveCustomer(r, "owner").address, "",
      `owner_address="${marker}" must be unusable even though the owner is named`,
    );
  }
});

// ── meaningful text that merely CONTAINS an asterisk remains concrete ───────────

test("MARKER: meaningful text containing an asterisk is still concrete, in a name and in an address", () => {
  const r = { owner_name: "山田*太郎", owner_address: "東京都港区1-2-3*" };
  const resolved = resolveCustomer(r, "owner");
  assert.equal(resolved.name, "山田*太郎");
  assert.equal(resolved.address, "東京都港区1-2-3*");
});

// ── 同上 is unusable, and is NEVER treated as a directional phrase to resolve ────

test("MARKER: exact 同上 is unusable and never copies the other party's value", () => {
  const r = { owner_name: "山田太郎", user_name: "同上" };
  assert.equal(
    effectiveCustomerParty(r, "user"), "owner",
    "同上 is not a directional phrase — the user never resolves, so the owner is used instead",
  );
  assert.equal(resolveCustomer(r, "user").name, "山田太郎");
});

// ── marker text cannot create an equality proof for one-party completion ────────

test("ANTI-MIXING: a marker owner_name does not prove one-party identity, so the user's blank address is not borrowed from the owner", () => {
  const r = { owner_name: "同上", owner_address: "東京都港区1-2-3", user_name: "山田太郎" };
  assert.equal(resolveCustomer(r, "user").name, "山田太郎", "falls back to the user, the only named party");
  assert.equal(
    resolveCustomer(r, "user").address, "",
    "the owner's concrete address must not be borrowed — marker text created no equality proof",
  );
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
