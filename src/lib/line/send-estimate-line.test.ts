// R90B — the estimate LINE send decision core, executed.
//
// Run: node --import tsx --test src/lib/line/send-estimate-line.test.ts
//
// The core is pure and fully injected, so every branch — recipient authority,
// ordering, the customer-visible text, and each typed outcome — is proved by
// calling the SHIPPING function. The "use server" shell over it contains no
// branching of its own (asserted from source in line-transport-boundary.test.ts).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runEstimateLineSend, buildEstimateLineText,
  isEstimateResendAuthorization, isValidEstimateId,
  ESTIMATE_LINE_LOG_UNAVAILABLE_MESSAGE, ESTIMATE_LINE_SEND_FAILED_MESSAGE,
  type EstimateLineCoreDeps, type EstimateLineSource,
  type EstimateLineTransportOutcome, type EstimateResendProbe,
} from "./send-estimate-line-core";

const ESTIMATE_ID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const CUSTOMER_ID = "8c2b6d1f-4a33-4e55-9b21-77aa2f0c1d44";

const FIRST = { kind: "first-send" } as const;
const CONFIRMED = { kind: "confirmed-resend" } as const;

const SOURCE: EstimateLineSource = {
  customerId: CUSTOMER_ID,
  estimateNumber: "EST-2026-0001",
  total: 132000,
  validUntil: "2026-08-31",
};

type Calls = {
  loadEstimate: number; loadRecipient: number; loadConfig: number;
  probeLastSent: number; loadBusinessName: number; send: number;
  order: string[];
  sent: Array<{ lineUserId: string; customerId: string; estimateId: string; text: string }>;
};

function world(overrides?: {
  estimate?: EstimateLineSource | null;
  recipient?: { lineCustomerId: string; lineUserId: string } | null;
  config?: { enabled: boolean; hasAccessToken: boolean };
  probe?: EstimateResendProbe;
  businessName?: string | null;
  outcome?: EstimateLineTransportOutcome;
  throwOnSend?: boolean;
}): { deps: EstimateLineCoreDeps; calls: Calls } {
  const calls: Calls = {
    loadEstimate: 0, loadRecipient: 0, loadConfig: 0,
    probeLastSent: 0, loadBusinessName: 0, send: 0, order: [], sent: [],
  };
  const deps: EstimateLineCoreDeps = {
    loadEstimate: async () => {
      calls.loadEstimate += 1; calls.order.push("loadEstimate");
      return overrides?.estimate === undefined ? SOURCE : overrides.estimate;
    },
    loadRecipient: async () => {
      calls.loadRecipient += 1; calls.order.push("loadRecipient");
      return overrides?.recipient === undefined
        ? { lineCustomerId: "lc-1", lineUserId: "U-actor" }
        : overrides.recipient;
    },
    loadConfig: async () => {
      calls.loadConfig += 1; calls.order.push("loadConfig");
      return overrides?.config ?? { enabled: true, hasAccessToken: true };
    },
    probeLastSent: async () => {
      calls.probeLastSent += 1; calls.order.push("probeLastSent");
      return overrides?.probe ?? { kind: "none" };
    },
    loadBusinessName: async () => {
      calls.loadBusinessName += 1; calls.order.push("loadBusinessName");
      return overrides?.businessName === undefined ? "GYEON 品川" : overrides.businessName;
    },
    send: async (p) => {
      calls.send += 1; calls.order.push("send");
      calls.sent.push({
        lineUserId: p.recipient.lineUserId, customerId: p.customerId,
        estimateId: p.estimateId, text: p.text,
      });
      if (overrides?.throwOnSend) throw new Error("network down");
      return overrides?.outcome ?? { kind: "sent" };
    },
  };
  return { deps, calls };
}

// ── 1-2. Input validation fails closed ─────────────────────────────────────

test("1. a malformed estimate id blocks before ANY dependency is touched", async () => {
  for (const bad of ["", "not-a-uuid", `${ESTIMATE_ID}0`, "../../admin", `${ESTIMATE_ID}\n`, null, 7, {}]) {
    const { deps, calls } = world();
    const r = await runEstimateLineSend(deps, bad, FIRST);
    assert.deepEqual(r, { kind: "blocked", reason: "invalid-request" }, String(bad));
    assert.deepEqual(calls.order, [], `${String(bad)}: reached a dependency`);
  }
});

test("2. a malformed authorization blocks; only the two literals are accepted", async () => {
  for (const bad of [
    null, undefined, "first-send", { kind: "send" }, { kind: "first-send", lineUserId: "U-x" },
    { kind: "confirmed-resend", text: "hi" }, {}, [], { Kind: "first-send" },
  ]) {
    const { deps, calls } = world();
    const r = await runEstimateLineSend(deps, ESTIMATE_ID, bad);
    assert.deepEqual(r, { kind: "blocked", reason: "invalid-request" }, JSON.stringify(bad));
    assert.deepEqual(calls.order, []);
  }
  assert.equal(isEstimateResendAuthorization(FIRST), true);
  assert.equal(isEstimateResendAuthorization(CONFIRMED), true);
  assert.equal(isValidEstimateId(ESTIMATE_ID), true);
});

// ── 3-5. Recipient authority ───────────────────────────────────────────────

test("3. a foreign / missing estimate is blocked and resolves no recipient", async () => {
  const { deps, calls } = world({ estimate: null });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "blocked", reason: "estimate-not-found" });
  assert.equal(calls.loadRecipient, 0, "no recipient lookup for an estimate we do not own");
  assert.equal(calls.send, 0);
});

test("4. an estimate with no customer is skipped", async () => {
  const { deps, calls } = world({ estimate: { ...SOURCE, customerId: null } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "skipped", reason: "no-customer" });
  assert.equal(calls.loadRecipient, 0);
  assert.equal(calls.send, 0);
});

test("5. an unlinked / unfollowed customer is skipped (is_friend=false → null)", async () => {
  const { deps, calls } = world({ recipient: null });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "skipped", reason: "not-linked" });
  assert.equal(calls.send, 0);
});

test("6. the recipient is DERIVED from the persisted customer, never supplied", async () => {
  const { deps, calls } = world();
  await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(calls.sent.length, 1);
  assert.equal(calls.sent[0].lineUserId, "U-actor", "the id came from the recipient lookup");
  assert.equal(calls.sent[0].customerId, CUSTOMER_ID, "…which was keyed by the estimate's own customer");
  assert.equal(calls.sent[0].estimateId, ESTIMATE_ID);
});

// ── 7-8. Configuration ─────────────────────────────────────────────────────

test("7. LINE disabled or token missing blocks before any write", async () => {
  const off = world({ config: { enabled: false, hasAccessToken: true } });
  assert.deepEqual(await runEstimateLineSend(off.deps, ESTIMATE_ID, FIRST),
    { kind: "blocked", reason: "line-disabled" });
  assert.equal(off.calls.probeLastSent, 0);
  assert.equal(off.calls.send, 0);

  const noTok = world({ config: { enabled: true, hasAccessToken: false } });
  assert.deepEqual(await runEstimateLineSend(noTok.deps, ESTIMATE_ID, FIRST),
    { kind: "blocked", reason: "no-access-token" });
  assert.equal(noTok.calls.send, 0);
});

// ── 8-10b. Resend preflight — three-valued and fail-closed ─────────────────

test("8. NO sent row + first-send → continues, preflight strictly before the send", async () => {
  const { deps, calls } = world({ probe: { kind: "none" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "sent" });
  assert.ok(calls.order.indexOf("probeLastSent") < calls.order.indexOf("send"),
    "the preflight must precede the only side effect");
  assert.deepEqual(calls.order, [
    "loadEstimate", "loadRecipient", "loadConfig", "probeLastSent", "loadBusinessName", "send",
  ]);
});

test("9. a sent row WITH a timestamp + first-send → resend-required, nothing sent", async () => {
  const { deps, calls } = world({ probe: { kind: "sent", sentAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "resend-required", sentAt: "2026-07-20T02:15:00Z" });
  assert.equal(calls.send, 0, "no pending log, no LINE call before the operator confirms");
  assert.equal(calls.loadBusinessName, 0, "not even the message was built");
});

test("9b. a sent row with a NULL sent_at is still resend-required", async () => {
  // The row proves the estimate was delivered; only its recorded time is missing.
  // Treating that as "never sent" would authorise a silent duplicate.
  const { deps, calls } = world({ probe: { kind: "sent", sentAt: null } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "resend-required", sentAt: null });
  assert.equal(calls.send, 0);
});

test("9c. an UNAVAILABLE preflight fails closed — blocked, never sent", async () => {
  const { deps, calls } = world({ probe: { kind: "unavailable" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "blocked", reason: "resend-check-unavailable" });
  assert.equal(calls.send, 0, "a failed read must never be read as `not sent`");
  assert.equal(calls.loadBusinessName, 0);
});

test("9d. an INDETERMINATE (pending) attempt + first-send → resend-required-indeterminate, nothing sent", async () => {
  const { deps, calls } = world({ probe: { kind: "indeterminate", attemptedAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "resend-required-indeterminate", attemptedAt: "2026-07-20T02:15:00Z" });
  assert.equal(calls.send, 0, "an unconfirmed prior attempt must not be resent automatically");
  assert.equal(calls.loadBusinessName, 0, "not even the message was built");
});

test("9e. an INDETERMINATE attempt with a NULL timestamp → same result, still zero sends", async () => {
  const { deps, calls } = world({ probe: { kind: "indeterminate", attemptedAt: null } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "resend-required-indeterminate", attemptedAt: null });
  assert.equal(calls.send, 0);
});

test("10. a prior sent row + confirmed-resend → continues without re-checking", async () => {
  const { deps, calls } = world({ probe: { kind: "sent", sentAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, CONFIRMED);
  assert.deepEqual(r, { kind: "sent" });
  assert.equal(calls.probeLastSent, 0, "an explicit resend does not re-run the preflight");
  assert.equal(calls.send, 1);
});

test("10b. confirmed-resend skips the preflight even when it would be UNAVAILABLE", async () => {
  const { deps, calls } = world({ probe: { kind: "unavailable" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, CONFIRMED);
  assert.deepEqual(r, { kind: "sent" }, "the operator has already accepted the duplicate risk");
  assert.equal(calls.probeLastSent, 0);
});

test("10c. confirmed-resend skips an INDETERMINATE preflight and sends", async () => {
  const { deps, calls } = world({ probe: { kind: "indeterminate", attemptedAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, CONFIRMED);
  assert.deepEqual(r, { kind: "sent" }, "the operator explicitly accepted the possible-duplicate risk");
  assert.equal(calls.probeLastSent, 0, "the probe is not even consulted on a confirmed resend");
  assert.equal(calls.send, 1);
});

// ── 11-13. Outcomes ────────────────────────────────────────────────────────

test("11. an explicit transport failure returns failed WITH the exact copyText", async () => {
  const { deps, calls } = world({ outcome: { kind: "failed" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(r.kind, "failed");
  if (r.kind !== "failed") return;
  assert.equal(r.message, ESTIMATE_LINE_SEND_FAILED_MESSAGE);
  assert.equal(r.copyText, calls.sent[0].text, "the fallback is byte-identical to what was sent");
});

test("12. a THROWN send is `unknown` — never failed — and carries the message", async () => {
  const { deps, calls } = world({ throwOnSend: true });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(r.kind, "unknown", "delivery is indeterminate, not failed");
  if (r.kind !== "unknown") return;
  assert.equal(r.copyText, calls.sent[0].text);
});

test("13. a missing pending log is FAILED, never unknown — no request was made", async () => {
  const { deps } = world({ outcome: { kind: "log-unavailable" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(r.kind, "failed");
  if (r.kind !== "failed") return;
  assert.equal(r.message, ESTIMATE_LINE_LOG_UNAVAILABLE_MESSAGE);
  assert.notEqual(r.kind as string, "unknown");
});

// ── 14-16. The customer-visible text ───────────────────────────────────────

test("14. the exact contracted message, from persisted fields only", () => {
  assert.equal(
    buildEstimateLineText({
      estimateNumber: "EST-2026-0001", total: 132000,
      validUntil: "2026-08-31", businessName: "GYEON 品川",
    }),
    [
      "【お見積書】EST-2026-0001",
      "お車のお見積をお送りします。",
      "合計金額: ¥132,000",
      "有効期限: 2026-08-31",
      "GYEON 品川",
    ].join("\n"),
  );
});

test("15. every null source OMITS its own line — nothing is invented", () => {
  // All four absent → only the fixed sentence survives.
  assert.equal(
    buildEstimateLineText({ estimateNumber: null, total: null, validUntil: null, businessName: null }),
    "お車のお見積をお送りします。",
  );
  // A null TOTAL omits the amount — it must never become ¥0, which a customer
  // would read as a real price rather than as a missing one.
  const noTotal = buildEstimateLineText({
    estimateNumber: "EST-1", total: null, validUntil: "2026-08-31", businessName: "GYEON 品川",
  });
  assert.equal(noTotal.includes("合計金額"), false, "a null total must not print an amount");
  assert.equal(noTotal.includes("¥0"), false);
  // A genuine zero still prints — absent and zero are different facts.
  assert.match(
    buildEstimateLineText({ estimateNumber: "E", total: 0, validUntil: null, businessName: null }),
    /合計金額: ¥0/,
  );
  // A null or blank NUMBER omits the header line entirely — no bare 【お見積書】.
  for (const n of [null, "", "   "]) {
    const t = buildEstimateLineText({ estimateNumber: n, total: 100, validUntil: null, businessName: null });
    assert.equal(t.includes("【お見積書】"), false, `"${String(n)}" must omit the header line`);
    assert.equal(t.split("\n")[0], "お車のお見積をお送りします。");
  }
  // No placeholder ever appears.
  for (const combo of [
    { estimateNumber: null, total: null, validUntil: null, businessName: null },
    { estimateNumber: "E", total: null, validUntil: null, businessName: null },
    { estimateNumber: null, total: 1, validUntil: null, businessName: null },
    { estimateNumber: null, total: null, validUntil: "2026-08-31", businessName: null },
    { estimateNumber: null, total: null, validUntil: null, businessName: "GYEON 品川" },
  ]) {
    const t = buildEstimateLineText(combo);
    assert.equal(/未設定|不明|TBD|null|undefined|NaN/.test(t), false, JSON.stringify(combo));
  }
  // Grouping is locale-independent.
  assert.match(buildEstimateLineText({ estimateNumber: "E", total: 1234567, validUntil: null, businessName: null }),
    /合計金額: ¥1,234,567/);
});

test("15b. a null total reaches the customer message as an OMISSION, end to end", async () => {
  const { deps, calls } = world({ estimate: { ...SOURCE, total: null } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.deepEqual(r, { kind: "sent" });
  assert.equal(calls.sent[0].text.includes("合計金額"), false, "no invented amount was sent");
});

test("16. CANARY: no internal memo, cost, margin, internal id or staff name can appear", async () => {
  // The builder has no parameter that could carry them, and the core reads only
  // the four customer-safe fields — so the canaries are UNREACHABLE, not merely absent.
  const { deps, calls } = world({
    estimate: { ...SOURCE, estimateNumber: "EST-2026-0002" },
  });
  await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  const text = calls.sent[0].text;
  for (const canary of [
    "CANARY", "山田太郎", "internal_memo", "内部メモ", "原価", "cost", "margin", "粗利",
    CUSTOMER_ID, ESTIMATE_ID, "lc-1", "U-actor",
  ]) {
    assert.equal(text.includes(canary), false, `the customer message leaked ${canary}`);
  }
});
