// R90B — the estimate LINE operator surface.
//
// Run: node --import tsx --test src/components/estimates/EstimateLineAction.test.tsx
//
// This repo has no DOM harness (no jsdom, no @testing-library) and adding one is
// out of scope, so clicks cannot be dispatched. The component therefore delegates
// its ordering and guard rules to `runEstimateLineAttempt`, a pure injectable
// function that the tests call DIRECTLY — the same function the component calls,
// not a copy. Rendered states are proved with `react-dom/server`, and the wiring
// between the two is pinned from source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  EstimateLineAction, runEstimateLineAttempt, runShareListLoad, runShareRevoke,
  type EstimateLineSender,
} from "./EstimateLineAction";
import type { EstimateLineResult } from "@/lib/line/send-estimate-line-core";
import type { EstimateShareListItem } from "@/lib/estimates/estimate-share-types";

(globalThis as { React?: typeof React }).React = React;

const SRC = "src/components/estimates/EstimateLineAction.tsx";
const ESTIMATE_ID = "3f1a7c2e-9b44-4d61-8a0f-5c7e2d9b1a33";
const FIRST = { kind: "first-send" } as const;

const noop: EstimateLineSender = async () => ({ kind: "sent" });

function render(send: EstimateLineSender = noop) {
  return renderToStaticMarkup(React.createElement(EstimateLineAction, {
    estimateId: ESTIMATE_ID,
    estimateNumber: "EST-2026-0001",
    customerName: "アクター 太郎",
    send,
  }));
}

// ── 1-4. The attempt core ──────────────────────────────────────────────────

test("1. one operator action produces exactly one send, and releases the guard", async () => {
  const inFlight = { current: false };
  const calls: Array<[string, unknown]> = [];
  const results: EstimateLineResult[] = [];
  let submitting = 0;

  await runEstimateLineAttempt({
    inFlight, estimateId: ESTIMATE_ID, authorization: FIRST,
    send: async (id, auth) => { calls.push([id, auth]); return { kind: "sent" }; },
    onSubmitting: () => { submitting += 1; },
    onResult: (r) => { results.push(r); },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [ESTIMATE_ID, FIRST], "the id and authorization pass through unchanged");
  assert.equal(submitting, 1, "the in-flight state is shown before the await");
  assert.deepEqual(results, [{ kind: "sent" }]);
  assert.equal(inFlight.current, false, "released in finally");
});

test("2. a same-tick second click cannot produce a second send", async () => {
  const inFlight = { current: false };
  let calls = 0;
  let release!: (r: EstimateLineResult) => void;
  const deferred = new Promise<EstimateLineResult>((res) => { release = res; });

  const deps = {
    inFlight, estimateId: ESTIMATE_ID, authorization: FIRST,
    send: (() => { calls += 1; return deferred; }) as unknown as EstimateLineSender,
    onSubmitting: () => {},
    onResult: () => {},
  };

  const first = runEstimateLineAttempt(deps);
  const second = runEstimateLineAttempt(deps);
  assert.equal(calls, 1, "the second attempt was refused by the shared guard");

  release({ kind: "sent" });
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("3. a THROWN send is reported as unknown, never as sent or failed", async () => {
  const results: EstimateLineResult[] = [];
  await runEstimateLineAttempt({
    inFlight: { current: false }, estimateId: ESTIMATE_ID, authorization: FIRST,
    send: async () => { throw new Error("network down"); },
    onSubmitting: () => {}, onResult: (r) => { results.push(r); },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, "unknown");
});

test("4. a confirmed resend passes the resend authorization verbatim", async () => {
  const seen: unknown[] = [];
  await runEstimateLineAttempt({
    inFlight: { current: false }, estimateId: ESTIMATE_ID,
    authorization: { kind: "confirmed-resend" },
    send: async (_id, auth) => { seen.push(auth); return { kind: "sent" }; },
    onSubmitting: () => {}, onResult: () => {},
  });
  assert.deepEqual(seen, [{ kind: "confirmed-resend" }]);
});

// ── 5-6. Rendered states ───────────────────────────────────────────────────

test("5. the initial state offers ONE explicit control and sends nothing", async () => {
  let calls = 0;
  const html = render(async () => { calls += 1; return { kind: "sent" }; });
  assert.equal(calls, 0, "rendering must never send");
  assert.ok(html.includes('data-testid="line-state-idle"'));
  assert.ok(html.includes('data-testid="line-send-open"'));
  assert.ok(html.includes("LINEで送信"));
  // The confirmation is a separate state, not shown up front.
  assert.equal(html.includes('data-testid="line-send-confirm"'), false);
});

test("6. every contracted state and control exists in the source tree", () => {
  const code = readFileSync(SRC, "utf8");
  for (const marker of [
    "line-state-idle", "line-state-confirming", "line-state-submitting",
    "line-state-resend-required", "line-state-resend-indeterminate",
    "line-state-sent", "line-state-skipped",
    "line-state-blocked", "line-state-failed", "line-state-unknown",
    "line-send-open", "line-send-confirm", "line-send-cancel",
    "line-resend-confirm", "line-resend-cancel",
    "line-resend-indeterminate-confirm", "line-resend-indeterminate-cancel",
    "line-copy-fallback", "line-copy-button",
  ]) {
    assert.ok(code.includes(marker), `missing state/control: ${marker}`);
  }
  // The confirmation names both the customer and the estimate. R92B splits the
  // sentence to insert an optional 「PDFリンク付きで」 clause, so the stable prefix
  // and the closing verb are asserted separately.
  assert.match(code, /\{customerName\} さんの LINE に見積 \{estimateNumber\} を/);
  assert.match(code, /\{stage\.authorization\.mode === "pdf-link" \? "PDFリンク付きで" : ""\}送信します。/);
  // The in-flight control is disabled.
  assert.match(code, /data-testid="line-send-submitting"\s*\n?\s*disabled/);
  // The prior send time is shown on a resend, and a null timestamp still reads
  // as "already sent" rather than as a blank.
  assert.match(code, /\{result\.sentAt \? ` \$\{result\.sentAt\} に` : "すでに"\}送信済みです/);
});

test("6b. every blocked reason the core can return has an operator message", () => {
  const code = readFileSync(SRC, "utf8");
  const coreReasons = [
    "estimate-not-found", "line-disabled", "no-access-token",
    "invalid-request", "resend-check-unavailable",
  ];
  for (const reason of coreReasons) {
    assert.match(code, new RegExp(`"${reason}":\\s*"`), `no message for blocked reason ${reason}`);
  }
  // The duplicate-check failure explains WHY nothing was sent.
  assert.match(code, /"resend-check-unavailable":\s*"送信済みかどうかを確認できなかったため、二重送信を避けて中止しました。/);
});

test("6c. the skipped messages promise no copy field, because none is rendered", () => {
  const code = readFileSync(SRC, "utf8");
  // `skipped` carries no copyText, so neither message may tell the operator to
  // copy something that is not on screen.
  const skipBlock = code.slice(code.indexOf("const SKIP_TEXT"), code.indexOf("const BLOCK_TEXT"));
  assert.equal(skipBlock.includes("コピー"), false, "a skipped message promises a copy field");
  assert.match(skipBlock, /"not-linked":\s*"お客様のLINE連携がありません。"/);
  // The fallback is gated on failed/unknown only — the two outcomes that carry text.
  assert.match(code,
    /result && \(result\.kind === "failed" \|\| result\.kind === "unknown"\) && result\.copyText/);
});

// ── 6d-6f. The indeterminate resend warning ────────────────────────────────

test("6d. the indeterminate warning is distinct and NEVER claims delivery", () => {
  const code = readFileSync(SRC, "utf8");
  // A dedicated rendered state, separate from resend-required.
  assert.match(code, /result\?\.kind === "resend-required-indeterminate"/);
  assert.match(code, /data-testid="line-state-resend-indeterminate"/);
  // The exact ratified message — and it must NOT assert 「送信済み」. Comment-
  // stripped, so the block's own documentation may NAME the forbidden phrase.
  const block = code.slice(
    code.indexOf('result?.kind === "resend-required-indeterminate"'),
    code.indexOf('{result?.kind === "sent"'),
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(block, /前回の送信結果を確認できていません（\{result\.attemptedAt \?\? "日時不明"\}）。すでに届いている可能性があります。それでも再送しますか？/);
  assert.equal(block.includes("送信済み"), false, "the indeterminate state must not claim confirmed delivery");
});

test("6e. both the attemptedAt and 日時不明 branches exist, and resend uses confirmed-resend", () => {
  const code = readFileSync(SRC, "utf8");
  const block = code.slice(
    code.indexOf('data-testid="line-state-resend-indeterminate"'),
    code.indexOf('{result?.kind === "sent"'),
  );
  // The nullish branch supplies the fallback timestamp label.
  assert.match(block, /\{result\.attemptedAt \?\? "日時不明"\}/);
  // Explicit resend + cancel. R92B carries the chosen delivery mode through the
  // resend so a pdf-link resend stays pdf-link.
  assert.match(block, /data-testid="line-resend-indeterminate-confirm"/);
  assert.match(block, /onClick=\{\(\) => attempt\(\{ kind: "confirmed-resend", mode \}\)\}/);
  assert.match(block, /data-testid="line-resend-indeterminate-cancel"/);
  assert.match(block, /onClick=\{\(\) => setStage\(\{ kind: "idle" \}\)\}/);
});

test("6f. the ordinary Close/reset is hidden for BOTH resend-required states", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code,
    /result\.kind !== "resend-required" && result\.kind !== "resend-required-indeterminate"/,
    "the reset control must exclude both resend prompts");
});

// ── 7. Phase-2 PDF-link selector (parallel entry, muscle memory preserved) ───

test("7. the PDF-link selector exists as a PARALLEL entry that adds no step to text", () => {
  const html = render();
  const code = readFileSync(SRC, "utf8");
  // The text entry is UNCHANGED — same testid, same label, still one click.
  assert.ok(html.includes('data-testid="line-send-open"'));
  assert.ok(html.includes("LINEで送信"));
  // The PDF entry sits ALONGSIDE it in the idle state (not a mode toggle that
  // adds a step) and opens the flow directly in pdf-link mode.
  assert.ok(html.includes('data-testid="line-send-open-pdf"'));
  assert.ok(html.includes("PDF付きで送信"));
  assert.match(code, /onClick=\{\(\) => open\("text"\)\}/);
  assert.match(code, /onClick=\{\(\) => open\("pdf-link"\)\}/);
  // `open` seeds the confirming stage with the chosen mode on the authorization.
  assert.match(code, /setStage\(\{ kind: "confirming", authorization: \{ kind: "first-send", mode: chosen \} \}\)/);
  // Rendering still sends nothing.
  let calls = 0;
  render(async () => { calls += 1; return { kind: "sent" }; });
  assert.equal(calls, 0);
});

test("7b. the pdf-unavailable outcome has its own state and per-reason messages", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code, /result\?\.kind === "pdf-unavailable"/);
  assert.match(code, /data-testid="line-state-pdf-unavailable"/);
  // Every PdfUnavailableReason the core can surface has an operator message.
  for (const reason of [
    "invalid-app-url", "pdf-generation-failed", "document-persist-failed",
    "share-create-failed", "reference-integrity-failed",
  ]) {
    assert.match(code, new RegExp(`"${reason}":\\s*"`), `no message for pdf reason ${reason}`);
  }
  // It is NOT a resend prompt, so the ordinary Close/reset still appears for it.
  assert.match(code,
    /result\.kind !== "resend-required" && result\.kind !== "resend-required-indeterminate"/);
});

test("8. the copy fallback appears ONLY for failed/unknown, and is the server's text", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code,
    /result && \(result\.kind === "failed" \|\| result\.kind === "unknown"\) && result\.copyText/,
    "the fallback is gated on the two outcomes that carry a message");
  // Rendered verbatim — never re-composed in the client.
  assert.match(code, /\{copyText\}<\/pre>/);
  assert.equal(/copyText\s*=\s*`/.test(code), false, "the client must not build its own message");
  assert.equal(code.includes("【お見積書】"), false, "no client-side copy of the customer text");
});

// ── 9-10. Wiring and boundary ──────────────────────────────────────────────

test("9. the component calls the same attempt core, with one guard, and never auto-sends", () => {
  const code = readFileSync(SRC, "utf8");
  assert.equal((code.match(/export async function runEstimateLineAttempt/g) ?? []).length, 1,
    "exactly one implementation");
  assert.match(code, /void runEstimateLineAttempt\(\{/, "the component calls it");
  assert.equal((code.match(/useRef\(false\)/g) ?? []).length, 1, "exactly one in-flight guard");
  // R92B-H1: there IS now a mount effect, but it loads the share list ONLY — it
  // must never call `send`/`attempt`. The effect body calls `reloadShares`.
  const effectBody = code.slice(code.indexOf("useEffect(() => {"), code.indexOf("}, [reloadShares]);"));
  assert.ok(effectBody.includes("reloadShares"), "the effect loads the share list");
  assert.equal(effectBody.includes("send"), false, "the effect must not reference send");
  assert.equal(effectBody.includes("attempt"), false, "the effect must not initiate a send attempt");
  // `reloadShares` is a READ-ONLY lister — it wires runShareListLoad, not the sender.
  assert.match(code, /const reloadShares = useCallback\(\s*\(\) => runShareListLoad\(\{ estimateId, listShares, onShares: setShares \}\)/);
  // Handlers are wrapped, so a MouseEvent can never become an argument.
  assert.equal(/onClick=\{attempt\}/.test(code), false);
});

test("10. the component imports no transport, LINE-send action, Supabase or token", () => {
  const code = readFileSync(SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of [
    "send-line-message", "create-line-message-log", "send-estimate-line\"",
    "supa" + "base", "createClient", "createAdminClient", "fetch(",
    "access_token", "server-only",
  ]) {
    assert.equal(code.includes(forbidden), false, `the component references ${forbidden}`);
  }
  // The LINE sender arrives as a prop — the component owns no LINE-send binding.
  assert.match(code, /send: EstimateLineSender;/);
  // F1-R1: the core import is now a VALUE import — the pure client-safe module
  // supplies the length constant and reserve function alongside the types. The
  // forbidden-import canaries above are what keep this boundary honest; the
  // import may carry ONLY the core's pure exports.
  assert.match(code,
    /import \{[\s\S]*?MAX_ESTIMATE_LINE_MESSAGE_LENGTH,[\s\S]*?computeEstimateLinePdfReserve,[\s\S]*?type EstimateResendAuthorization,?[\s\S]*?\} from "@\/lib\/line\/send-estimate-line-core"/);
  // R92B-H1: the list/revoke Server Actions ARE imported (read-only + revoke),
  // wired by default and overridable for tests.
  assert.match(code, /import \{[\s\S]*?listActiveEstimateShares,[\s\S]*?revokeEstimateShare,?[\s\S]*?\} from "@\/lib\/estimates\/estimate-share-actions"/);
});

// ── 11-13. The persistent share list and revoke (R92B-H1) ──────────────────

test("11. runShareListLoad passes the lister's result through, and a failure never sends", async () => {
  const rows: EstimateShareListItem[] = [
    { id: "s-1", createdAt: "2026-07-24T00:00:00Z", expiresAt: "2026-07-31T00:00:00Z" },
  ];
  let seen: EstimateShareListItem[] | null = null;
  let listedFor = "";
  await runShareListLoad({
    estimateId: ESTIMATE_ID,
    listShares: async (id) => { listedFor = id; return rows; },
    onShares: (s) => { seen = s; },
  });
  assert.equal(listedFor, ESTIMATE_ID, "the list is keyed by the estimate id");
  assert.deepEqual(seen, rows);

  // A throwing lister collapses to an empty list — the UI degrades, nothing sends.
  let seen2: EstimateShareListItem[] | null = null;
  await runShareListLoad({
    estimateId: ESTIMATE_ID,
    listShares: async () => { throw new Error("network"); },
    onShares: (s) => { seen2 = s; },
  });
  assert.deepEqual(seen2, []);
});

test("12. runShareRevoke revokes then RE-LISTS on success, and does not re-list on failure", async () => {
  const calls: string[] = [];
  const okRes = await runShareRevoke({
    estimateId: ESTIMATE_ID, shareId: "s-1",
    revokeShare: async (id, shareId) => { calls.push(`revoke:${id}:${shareId}`); return { ok: true }; },
    reload: async () => { calls.push("reload"); },
  });
  assert.deepEqual(okRes, { ok: true });
  assert.deepEqual(calls, [`revoke:${ESTIMATE_ID}:s-1`, "reload"], "a successful revoke triggers exactly one re-list");

  const calls2: string[] = [];
  const failRes = await runShareRevoke({
    estimateId: ESTIMATE_ID, shareId: "s-2",
    revokeShare: async () => { calls2.push("revoke"); return { ok: false }; },
    reload: async () => { calls2.push("reload"); },
  });
  assert.deepEqual(failRes, { ok: false });
  assert.deepEqual(calls2, ["revoke"], "a failed revoke must NOT re-list");
});

test("13. the revoke UI renders ONLY the safe projection — expiry + control, no secret", () => {
  const code = readFileSync(SRC, "utf8");
  for (const marker of ["line-share-list", "line-share-row", "line-share-revoke"]) {
    assert.ok(code.includes(marker), `missing share-list control: ${marker}`);
  }
  // The expiry is shown; the revoke wires runShareRevoke with a re-list reload.
  assert.match(code, /有効期限: \{s\.expiresAt\}/);
  assert.match(code, /runShareRevoke\(\{ estimateId, shareId: s\.id, revokeShare, reload: reloadShares \}\)/);
  // No SHARE token/hash/storage-path field is ever referenced. (Bare "token"
  // would collide with the unrelated `no-access-token` LINE block reason, so the
  // canaries are the specific share-secret shapes.)
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of [
    "token_hash", "tokenHash", "rawToken", "s.token", "s.url",
    "file_path", "filePath", "documentFileId", "document_file_id", "storagePath",
  ]) {
    assert.equal(stripped.includes(forbidden), false, `the component exposes ${forbidden}`);
  }
  // The projected item type carries only id/createdAt/expiresAt, so a secret field
  // has nowhere to come from in the first place.
  assert.match(code, /import type \{ EstimateShareListItem \}/);
});

// ── F1-R1: editable default message, UTF-16 limits, history refresh ─────────
//
// Import declarations are hoisted, so this block extends the suite in place.
import {
  validateEstimateLineBody, computeClientBodyLimit, resolveClientShareOrigin,
  shouldRefreshEstimateLineHistory,
} from "./EstimateLineAction";
import {
  MAX_ESTIMATE_LINE_MESSAGE_LENGTH, computeEstimateLinePdfReserve,
} from "@/lib/line/send-estimate-line-core";

test("F1. body validation: empty and whitespace rejected, boundary exact, surrogate pairs count as two", () => {
  assert.deepEqual(validateEstimateLineBody("", 5000), { valid: false, reason: "empty" });
  assert.deepEqual(validateEstimateLineBody("   \n　", 5000), { valid: false, reason: "empty" });
  assert.deepEqual(validateEstimateLineBody("あ".repeat(5000), 5000), { valid: true, reason: null });
  assert.deepEqual(validateEstimateLineBody("あ".repeat(5001), 5000), { valid: false, reason: "too-long" });
  // 2500 astral chars = 5000 UTF-16 units exactly; one more unit overflows.
  assert.deepEqual(validateEstimateLineBody("𠮷".repeat(2500), 5000), { valid: true, reason: null });
  assert.deepEqual(validateEstimateLineBody("𠮷".repeat(2500) + "a", 5000), { valid: false, reason: "too-long" });
});

test("F2. the client pdf-link limit subtracts the SAME reserve the server computes", () => {
  const origin = "https://app.example.com";
  assert.equal(computeClientBodyLimit("text", origin), MAX_ESTIMATE_LINE_MESSAGE_LENGTH);
  assert.equal(
    computeClientBodyLimit("pdf-link", origin),
    MAX_ESTIMATE_LINE_MESSAGE_LENGTH - computeEstimateLinePdfReserve(origin),
    "a body the client accepts can never be one the server-composed PDF message must reject",
  );
  // Unresolvable origin → fall back to the text limit; the server stays authoritative.
  assert.equal(computeClientBodyLimit("pdf-link", null), MAX_ESTIMATE_LINE_MESSAGE_LENGTH);
});

test("F3. the client origin resolver mirrors the URL API and fails to null", () => {
  assert.equal(resolveClientShareOrigin("https://app.example.com"), "https://app.example.com");
  assert.equal(resolveClientShareOrigin("https://app.example.com/base/path"), "https://app.example.com");
  for (const bad of [undefined, null, "", "   ", "not a url"]) {
    assert.equal(resolveClientShareOrigin(bad), null, String(bad));
  }
});

test("F4. history refresh fires ONLY for outcomes that may have logged a row", () => {
  for (const kind of ["sent", "failed", "unknown"] as const) {
    assert.equal(shouldRefreshEstimateLineHistory(kind), true, kind);
  }
  for (const kind of [
    "skipped", "blocked", "resend-required", "resend-required-indeterminate", "pdf-unavailable",
  ] as const) {
    assert.equal(shouldRefreshEstimateLineHistory(kind), false, kind);
  }
});

test("F5. the editor is a REAL value initialized ONCE from the single default builder", () => {
  const code = readFileSync(SRC, "utf8");
  // Real value, not a placeholder.
  assert.match(code, /data-testid="line-message-editor"\s*\n?\s*value=\{editedBody\}/);
  assert.equal(/placeholder=/.test(code.slice(code.indexOf("line-message-editor"), code.indexOf("line-message-editor") + 400)), false,
    "the template is the value, never a placeholder");
  // One lazy initializer from the shared builder; edits are preserved because
  // nothing else ever writes the state (onChange is the only setter call site).
  assert.equal((code.match(/buildDefaultEstimateLineMessage\(/g) ?? []).length, 1, "exactly one initializer");
  assert.match(code, /useState<string>\(\(\) =>\s*\n?\s*buildDefaultEstimateLineMessage\(\{ customerName, estimateNumber, dealerDisplayName \}\)/);
  assert.equal((code.match(/setEditedBody\(/g) ?? []).length, 1, "only the operator's onChange writes the body");
});

test("F6. the confirmation shows the exact body and the proceed control is validity-gated", () => {
  const code = readFileSync(SRC, "utf8");
  // The textarea sits INSIDE the confirming stage — the confirmed text IS the body.
  const confirming = code.slice(code.indexOf('stage.kind === "confirming"'), code.indexOf('stage.kind === "submitting"'));
  assert.ok(confirming.includes('data-testid="line-message-editor"'), "editor inside the confirm stage");
  assert.ok(confirming.includes('data-testid="line-message-counter"'), "UTF-16 counter visible");
  assert.match(confirming, /\{editedBody\.length\} \/ \{bodyLimit\}/);
  assert.match(confirming, /disabled=\{!bodyCheck\.valid\}/, "送信する is disabled while invalid");
  assert.ok(confirming.includes('data-testid="line-message-invalid"'), "explicit invalid message");
  assert.equal(confirming.includes(".slice("), false, "no truncation anywhere in the stage");
  assert.equal(confirming.includes(".substring("), false);
});

test("F7. the confirmed body rides the closed authorization union; the client adds nothing else", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code, /authorization: \{ \.\.\.authorization, messageBody: editedBody \}/,
    "messageBody is merged onto the operator's authorization");
  // A fail-closed client gate guards bypasses of the disabled button.
  assert.match(code, /if \(!validateEstimateLineBody\(editedBody, limit\)\.valid\) return;/);
  // No client-side share/token/url material exists to smuggle.
  for (const forbidden of ["shareToken", "shareUrl:", "documentFileId", "lineUserId"]) {
    assert.equal(code.includes(forbidden), false, `client must not carry ${forbidden}`);
  }
});

test("F8. the settle callback is gated by the SAME pure refresh rule the tests exercise", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code, /if \(shouldRefreshEstimateLineHistory\(result\.kind\)\) onAttemptSettled\?\.\(\);/);
  assert.equal((code.match(/export function shouldRefreshEstimateLineHistory/g) ?? []).length, 1,
    "one implementation, shared with the tests");
});

test("F9. the two new blocked reasons have operator messages", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code, /"message-empty":\s*"メッセージが空のため送信できません。/);
  assert.match(code, /"message-too-long":\s*"メッセージが長すぎるため送信できません。/);
});

test("F10. rendering the component still sends nothing with the editable default in place", () => {
  let calls = 0;
  const html = render(async () => { calls += 1; return { kind: "sent" }; });
  assert.equal(calls, 0);
  assert.ok(html.includes('data-testid="line-state-idle"'), "idle is unchanged");
  assert.equal(html.includes("line-message-editor"), false, "the editor belongs to the confirm stage only");
});
