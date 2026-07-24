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
  EstimateLineAction, runEstimateLineAttempt, type EstimateLineSender,
} from "./EstimateLineAction";
import type { EstimateLineResult } from "@/lib/line/send-estimate-line-core";

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
  // The confirmation names both the customer and the estimate.
  assert.match(code, /\{customerName\} さんの LINE に見積 \{estimateNumber\} を送信します/);
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
  // Explicit resend + cancel, and the resend carries ONLY the confirmed authorization.
  assert.match(block, /data-testid="line-resend-indeterminate-confirm"/);
  assert.match(block, /onClick=\{\(\) => attempt\(\{ kind: "confirmed-resend" \}\)\}/);
  assert.match(block, /data-testid="line-resend-indeterminate-cancel"/);
  assert.match(block, /onClick=\{\(\) => setStage\(\{ kind: "idle" \}\)\}/);
});

test("6f. the ordinary Close/reset is hidden for BOTH resend-required states", () => {
  const code = readFileSync(SRC, "utf8");
  assert.match(code,
    /result\.kind !== "resend-required" && result\.kind !== "resend-required-indeterminate"/,
    "the reset control must exclude both resend prompts");
  // Neither resend state renders while a plain send is possible, and neither auto-sends.
  assert.equal(code.includes("useEffect"), false, "no effect may fire a send");
});

// ── 7-8. Phase-1 scope and the copy fallback ───────────────────────────────

test("7. NO PDF-link selector exists anywhere in the tree", () => {
  const html = render();
  const code = readFileSync(SRC, "utf8");
  for (const forbidden of ["pdf-link", "pdfLink", "PDFリンク", "PDF付き", "mode-select", "line-mode"]) {
    assert.equal(html.includes(forbidden), false, `rendered output offers ${forbidden}`);
    assert.equal(code.includes(forbidden), false, `source declares ${forbidden}`);
  }
  // Phase 1 never asks the server for a mode.
  assert.equal(code.includes('"pdf"'), false, "no pdf destination is constructible here");
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
  // No effect may fire a send.
  assert.equal(code.includes("useEffect"), false, "no effect — a send is only ever an operator action");
  // Handlers are wrapped, so a MouseEvent can never become an argument.
  assert.equal(/onClick=\{attempt\}/.test(code), false);
});

test("10. the component imports no transport, action, Supabase or token", () => {
  const code = readFileSync(SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of [
    "send-line-message", "create-line-message-log", "send-estimate-line\"",
    "supa" + "base", "createClient", "createAdminClient", "fetch(",
    "access_token", "server-only",
  ]) {
    assert.equal(code.includes(forbidden), false, `the component references ${forbidden}`);
  }
  // The sender arrives as a prop — the component owns no server binding.
  assert.match(code, /send: EstimateLineSender;/);
  assert.match(code, /import type \{[\s\S]*?EstimateResendAuthorization,?[\s\S]*?\} from "@\/lib\/line\/send-estimate-line-core"/);
});
