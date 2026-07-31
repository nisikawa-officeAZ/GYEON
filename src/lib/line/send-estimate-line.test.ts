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
  MAX_ESTIMATE_LINE_MESSAGE_LENGTH, computeEstimateLinePdfReserve,
  composeEstimateLinePdfMessage,
  type EstimateLineCoreDeps, type EstimateLineSource,
  type EstimateLineTransportOutcome, type EstimateResendProbe,
  type EstimateDeliveryMode,
} from "./send-estimate-line-core";
import type { CreateShareOutcome, EstimateShareContext } from "../estimates/estimate-share-types";

const ESTIMATE_ID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const CUSTOMER_ID = "8c2b6d1f-4a33-4e55-9b21-77aa2f0c1d44";

const FIRST = { kind: "first-send" } as const;
const CONFIRMED = { kind: "confirmed-resend" } as const;
const FIRST_PDF = { kind: "first-send", mode: "pdf-link" } as const;
const CONFIRMED_PDF = { kind: "confirmed-resend", mode: "pdf-link" } as const;

const SHARE: EstimateShareContext = {
  url: "https://app.example.com/s/e/" + "A".repeat(43),
  shareId: "share-1",
  documentFileId: "docfile-1",
  expiresAt: "2026-07-31T00:00:00Z",
};

const SOURCE: EstimateLineSource = {
  customerId: CUSTOMER_ID,
  estimateNumber: "EST-2026-0001",
  total: 132000,
  validUntil: "2026-08-31",
};

type Calls = {
  loadEstimate: number; loadRecipient: number; loadConfig: number;
  probeLastSent: number; loadBusinessName: number; createShareLink: number; send: number;
  order: string[];
  shareRequests: string[];
  sent: Array<{
    lineUserId: string; customerId: string; estimateId: string; text: string;
    mode: EstimateDeliveryMode; share: EstimateShareContext | null;
  }>;
};

function world(overrides?: {
  estimate?: EstimateLineSource | null;
  recipient?: { lineCustomerId: string; lineUserId: string } | null;
  config?: { enabled: boolean; hasAccessToken: boolean };
  probe?: EstimateResendProbe;
  businessName?: string | null;
  outcome?: EstimateLineTransportOutcome;
  throwOnSend?: boolean;
  shareOutcome?: CreateShareOutcome;
}): { deps: EstimateLineCoreDeps; calls: Calls } {
  const calls: Calls = {
    loadEstimate: 0, loadRecipient: 0, loadConfig: 0,
    probeLastSent: 0, loadBusinessName: 0, createShareLink: 0, send: 0,
    order: [], shareRequests: [], sent: [],
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
    createShareLink: async (id) => {
      calls.createShareLink += 1; calls.order.push("createShareLink");
      calls.shareRequests.push(id);
      return overrides?.shareOutcome ?? { kind: "created", share: SHARE };
    },
    send: async (p) => {
      calls.send += 1; calls.order.push("send");
      calls.sent.push({
        lineUserId: p.recipient.lineUserId, customerId: p.customerId,
        estimateId: p.estimateId, text: p.text, mode: p.mode, share: p.share,
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

test("2b. the OPTIONAL mode is validated — only text/pdf-link, and no third key", () => {
  // Accepted: bare kind, and either mode literal on either kind.
  for (const ok of [
    { kind: "first-send" }, { kind: "confirmed-resend" },
    { kind: "first-send", mode: "text" }, { kind: "first-send", mode: "pdf-link" },
    { kind: "confirmed-resend", mode: "text" }, { kind: "confirmed-resend", mode: "pdf-link" },
  ]) {
    assert.equal(isEstimateResendAuthorization(ok), true, JSON.stringify(ok));
  }
  // Rejected: an unknown mode, a non-string mode, or any extra key.
  for (const bad of [
    { kind: "first-send", mode: "pdf" }, { kind: "first-send", mode: "PDF-LINK" },
    { kind: "first-send", mode: "" }, { kind: "first-send", mode: 1 },
    { kind: "first-send", mode: null }, { kind: "first-send", mode: "text", extra: 1 },
    { kind: "first-send", url: "x" },
  ]) {
    assert.equal(isEstimateResendAuthorization(bad), false, JSON.stringify(bad));
  }
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

// ── 17-19. buildEstimateLineText — the PDF link block ──────────────────────

test("17. a shareUrl appends the link block as the LAST lines; text mode is unchanged", () => {
  const base = buildEstimateLineText({
    estimateNumber: "EST-2026-0001", total: 132000, validUntil: "2026-08-31", businessName: "GYEON 品川",
  });
  // Absent / null shareUrl → byte-identical to Phase-1.
  assert.equal(
    buildEstimateLineText({
      estimateNumber: "EST-2026-0001", total: 132000, validUntil: "2026-08-31",
      businessName: "GYEON 品川", shareUrl: null,
    }),
    base,
  );
  const withUrl = buildEstimateLineText({
    estimateNumber: "EST-2026-0001", total: 132000, validUntil: "2026-08-31",
    businessName: "GYEON 品川", shareUrl: SHARE.url,
  });
  // The base message is a strict prefix, and the URL is the final line.
  assert.ok(withUrl.startsWith(base), "the text-mode message is preserved verbatim as the prefix");
  assert.equal(withUrl.split("\n").at(-1), SHARE.url, "the URL is the last line");
  assert.ok(withUrl.includes("お見積書（PDF）は下記からご確認いただけます。"));
});

// ── 18-23. pdf-link delivery ───────────────────────────────────────────────

test("18. pdf-link success: the share is minted AFTER the preflight and BEFORE the send", async () => {
  const { deps, calls } = world();
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST_PDF);
  assert.deepEqual(r, { kind: "sent" });
  assert.deepEqual(calls.order, [
    "loadEstimate", "loadRecipient", "loadConfig", "probeLastSent",
    "createShareLink", "loadBusinessName", "send",
  ]);
  assert.deepEqual(calls.shareRequests, [ESTIMATE_ID], "the share is keyed by the estimate id");
  // The send carries the mode and the FULL share context (for the log metadata).
  assert.equal(calls.sent[0].mode, "pdf-link");
  assert.deepEqual(calls.sent[0].share, SHARE);
  assert.ok(calls.sent[0].text.includes(SHARE.url), "the delivered message carries the link");
});

test("19. pdf-link + a prior sent row → resend-required, NO share is created", async () => {
  const { deps, calls } = world({ probe: { kind: "sent", sentAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST_PDF);
  assert.deepEqual(r, { kind: "resend-required", sentAt: "2026-07-20T02:15:00Z" });
  assert.equal(calls.createShareLink, 0, "no snapshot / share side effect before the operator confirms");
  assert.equal(calls.send, 0);
});

test("20. pdf-link when the share cannot be produced → pdf-unavailable, NOTHING sent", async () => {
  const { deps, calls } = world({
    shareOutcome: { kind: "pdf-unavailable", reason: "pdf-generation-failed" },
  });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST_PDF);
  assert.deepEqual(r, { kind: "pdf-unavailable", reason: "pdf-generation-failed" });
  assert.equal(calls.createShareLink, 1);
  assert.equal(calls.send, 0, "no LINE call is made when the link could not be created");
  assert.equal(calls.loadBusinessName, 0, "the message is never even composed");
});

test("21. confirmed-resend pdf-link skips the preflight, still mints the share and sends", async () => {
  const { deps, calls } = world({ probe: { kind: "sent", sentAt: "2026-07-20T02:15:00Z" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, CONFIRMED_PDF);
  assert.deepEqual(r, { kind: "sent" });
  assert.equal(calls.probeLastSent, 0, "an explicit resend does not re-run the preflight");
  assert.equal(calls.createShareLink, 1);
  assert.equal(calls.sent[0].mode, "pdf-link");
});

test("22. a pdf-link send FAILURE keeps the URL in copyText for manual delivery", async () => {
  const { deps, calls } = world({ outcome: { kind: "failed" } });
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, FIRST_PDF);
  assert.equal(r.kind, "failed");
  if (r.kind !== "failed") return;
  assert.equal(r.copyText, calls.sent[0].text);
  assert.ok(r.copyText.includes(SHARE.url), "the operator can still copy the working link");
});

test("23. text mode NEVER creates a share; the send is mode:text with a null share", async () => {
  const { deps, calls } = world();
  await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(calls.createShareLink, 0);
  assert.equal(calls.sent[0].mode, "text");
  assert.equal(calls.sent[0].share, null);
  assert.equal(calls.sent[0].text.includes("/s/e/"), false, "no link in a text-mode message");
});

// ── F1-R1: the operator-edited message body ─────────────────────────────────
//
// The SHARE fixture's origin — the resolver the prevalidation tests inject.
const SHARE_ORIGIN = "https://app.example.com";
const withOrigin = (deps: EstimateLineCoreDeps, origin: string | null = SHARE_ORIGIN): EstimateLineCoreDeps =>
  ({ ...deps, resolveShareOrigin: () => origin });

test("F1. messageBody is structurally accepted as a string and rejected otherwise", async () => {
  assert.equal(isEstimateResendAuthorization({ kind: "first-send", messageBody: "こんにちは" }), true);
  assert.equal(isEstimateResendAuthorization({ kind: "confirmed-resend", mode: "pdf-link", messageBody: "x" }), true);
  for (const bad of [
    { kind: "first-send", messageBody: 7 },
    { kind: "first-send", messageBody: null },
    { kind: "first-send", messageBody: "x", extra: true },
  ]) {
    const { deps, calls } = world();
    const r = await runEstimateLineSend(deps, ESTIMATE_ID, bad);
    assert.deepEqual(r, { kind: "blocked", reason: "invalid-request" }, JSON.stringify(bad));
    assert.deepEqual(calls.order, []);
  }
});

test("F2. an empty or whitespace-only body blocks message-empty before ANY dependency", async () => {
  for (const body of ["", "   ", "\n\n", "　"]) {
    const { deps, calls } = world();
    const r = await runEstimateLineSend(deps, ESTIMATE_ID, { kind: "first-send", messageBody: body });
    assert.deepEqual(r, { kind: "blocked", reason: "message-empty" }, JSON.stringify(body));
    assert.deepEqual(calls.order, [], "nothing was touched");
  }
});

test("F3. text mode: exactly 5000 UTF-16 units passes untruncated; 5001 blocks before transport", async () => {
  const atLimit = "あ".repeat(MAX_ESTIMATE_LINE_MESSAGE_LENGTH);
  const ok = world();
  const sent = await runEstimateLineSend(ok.deps, ESTIMATE_ID, { kind: "first-send", messageBody: atLimit });
  assert.equal(sent.kind, "sent");
  assert.equal(ok.calls.sent[0].text, atLimit, "byte-identical — no truncation, no re-composition");
  assert.equal(ok.calls.sent[0].text.length, 5000);

  const over = world();
  const blocked = await runEstimateLineSend(over.deps, ESTIMATE_ID, {
    kind: "first-send", messageBody: atLimit + "あ",
  });
  assert.deepEqual(blocked, { kind: "blocked", reason: "message-too-long" });
  assert.deepEqual(over.calls.order, [], "rejected before any dependency, transport included");
});

test("F3b. a surrogate-pair character counts as TWO UTF-16 units", async () => {
  const astral = "𠮷".repeat(2500); // length 5000
  assert.equal(astral.length, 5000);
  const ok = world();
  const sent = await runEstimateLineSend(ok.deps, ESTIMATE_ID, { kind: "first-send", messageBody: astral });
  assert.equal(sent.kind, "sent");

  const over = world();
  const blocked = await runEstimateLineSend(over.deps, ESTIMATE_ID, {
    kind: "first-send", messageBody: astral + "a", // length 5001
  });
  assert.deepEqual(blocked, { kind: "blocked", reason: "message-too-long" });
  assert.deepEqual(over.calls.order, []);
});

test("F4. pdf-link counts the server-appended block; the fit boundary is exact", async () => {
  const reserve = computeEstimateLinePdfReserve(SHARE_ORIGIN);
  const fits = "あ".repeat(MAX_ESTIMATE_LINE_MESSAGE_LENGTH - reserve);

  const ok = world();
  const sent = await runEstimateLineSend(withOrigin(ok.deps), ESTIMATE_ID, {
    kind: "first-send", mode: "pdf-link", messageBody: fits,
  });
  assert.equal(sent.kind, "sent");
  assert.equal(ok.calls.sent[0].text, composeEstimateLinePdfMessage(fits, SHARE.url),
    "final = body + sentence + complete share URL");
  assert.equal(ok.calls.sent[0].text.length, MAX_ESTIMATE_LINE_MESSAGE_LENGTH,
    "the composed message lands exactly on the limit — the reserve is exact");

  const over = world();
  const blocked = await runEstimateLineSend(withOrigin(over.deps), ESTIMATE_ID, {
    kind: "first-send", mode: "pdf-link", messageBody: fits + "あ",
  });
  assert.deepEqual(blocked, { kind: "blocked", reason: "message-too-long" });
});

test("F5. an oversized pdf-link body creates NO share, NO log, NO LINE call — no orphan", async () => {
  const reserve = computeEstimateLinePdfReserve(SHARE_ORIGIN);
  const over = "あ".repeat(MAX_ESTIMATE_LINE_MESSAGE_LENGTH - reserve + 1);
  const { deps, calls } = world();
  const r = await runEstimateLineSend(withOrigin(deps), ESTIMATE_ID, {
    kind: "first-send", mode: "pdf-link", messageBody: over,
  });
  assert.deepEqual(r, { kind: "blocked", reason: "message-too-long" });
  assert.equal(calls.createShareLink, 0, "no share row / snapshot / Storage object");
  assert.equal(calls.send, 0, "no pending log, no LINE request");
  assert.deepEqual(calls.order, [], "rejected before every dependency");
});

test("F6. pdf-link with a body FAILS CLOSED when the origin cannot be resolved", async () => {
  // Resolver present but unresolvable → invalid-app-url before any side effect.
  const nullOrigin = world();
  const r1 = await runEstimateLineSend(withOrigin(nullOrigin.deps, null), ESTIMATE_ID, {
    kind: "first-send", mode: "pdf-link", messageBody: "本文",
  });
  assert.deepEqual(r1, { kind: "pdf-unavailable", reason: "invalid-app-url" });
  assert.deepEqual(nullOrigin.calls.order, []);

  // Resolver ABSENT entirely → same fail-closed answer, never an unchecked send.
  const missing = world();
  const r2 = await runEstimateLineSend(missing.deps, ESTIMATE_ID, {
    kind: "first-send", mode: "pdf-link", messageBody: "本文",
  });
  assert.deepEqual(r2, { kind: "pdf-unavailable", reason: "invalid-app-url" });
  assert.deepEqual(missing.calls.order, []);
});

test("F7. the operator body IS the message: sent verbatim, legacy builder not consulted", async () => {
  const body = "山田 様\n\nお世話になっております。\nGYEON 品川です。\n\nどうぞよろしくお願いいたします。";
  const { deps, calls } = world();
  const r = await runEstimateLineSend(deps, ESTIMATE_ID, { kind: "first-send", messageBody: body });
  assert.equal(r.kind, "sent");
  assert.equal(calls.sent[0].text, body, "line breaks and content preserved exactly");
  assert.equal(calls.loadBusinessName, 0, "the generated-text path is not consulted at all");
});

test("F8. pdf-link with a body: server appends sentence + URL AFTER the operator text", async () => {
  const body = "PDFリンク付きの本文です。";
  const { deps, calls } = world();
  const r = await runEstimateLineSend(withOrigin(deps), ESTIMATE_ID, {
    kind: "confirmed-resend", mode: "pdf-link", messageBody: body,
  });
  assert.equal(r.kind, "sent");
  const text = calls.sent[0].text;
  assert.ok(text.startsWith(body), "operator text leads");
  assert.ok(text.endsWith(SHARE.url), "the complete generated URL is appended last");
  assert.equal(calls.loadBusinessName, 0);
  assert.equal(calls.createShareLink, 1, "exactly one share for the valid case");
});

test("F9. without a messageBody the legacy generated text is unchanged (backward compatibility)", async () => {
  const { deps, calls } = world();
  await runEstimateLineSend(deps, ESTIMATE_ID, FIRST);
  assert.equal(calls.loadBusinessName, 1, "legacy path still builds from persisted fields");
  assert.ok(calls.sent[0].text.includes("【お見積書】EST-2026-0001"));
});
