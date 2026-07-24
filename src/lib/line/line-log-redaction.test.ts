// R92B-H1 — the audit-log redaction core, executed, plus source proofs that
// send-line-message.ts wires it correctly.
//
// Run: node --import tsx --test src/lib/line/line-log-redaction.test.ts
//
// `redactShareLog` is pure, so its behaviour is proved by calling it. The
// transport wrapper `send-line-message.ts` begins with `import "server-only"`
// (unresolvable under this runner), so the divergence it enforces — LINE gets the
// working URL, the log gets a placeholder — is asserted from SOURCE TEXT.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { redactShareLog, SHARE_LOG_REDACTED_PLACEHOLDER } from "./line-log-redaction";
import type { LineMessage } from "./line-types";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const SEND = "src/lib/line/send-line-message.ts";
const ACTION = "src/lib/line/send-estimate-line.ts";

// A realistic pdf-link body carrying a working, tokenized share URL.
const RAW_TOKEN = "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0Uvw";
const SHARE_URL = `https://app.example.com/s/e/${RAW_TOKEN}`;
const PDF_BODY = [
  "【お見積書】EST-2026-0001",
  "お車のお見積をお送りします。",
  "お見積書（PDF）は下記からご確認いただけます。",
  SHARE_URL,
].join("\n");

// ── 1-3. The pure redaction ────────────────────────────────────────────────

test("1. redaction replaces EVERY text/body with the fixed placeholder", () => {
  const messages: LineMessage[] = [{ type: "text", text: PDF_BODY }];
  const r = redactShareLog({ messages, body: PDF_BODY });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.messages, [{ type: "text", text: SHARE_LOG_REDACTED_PLACEHOLDER }]);
  assert.equal(r.body, SHARE_LOG_REDACTED_PLACEHOLDER);
});

test("2. the redacted copy contains no raw token and no usable share URL", () => {
  const r = redactShareLog({ messages: [{ type: "text", text: PDF_BODY }], body: PDF_BODY });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const dump = JSON.stringify({ messages: r.messages, body: r.body });
  for (const leak of [RAW_TOKEN, SHARE_URL, "https://", "/s/e/", "app.example.com"]) {
    assert.equal(dump.includes(leak), false, `the audit copy leaked ${leak}`);
  }
  // The placeholder itself is inert — no scheme, no host, no token.
  assert.equal(/https?:\/\//.test(SHARE_LOG_REDACTED_PLACEHOLDER), false);
});

test("3. redaction FAILS CLOSED on an empty set or any non-text message", () => {
  assert.deepEqual(redactShareLog({ messages: [], body: "x" }), { ok: false });
  const withImage: LineMessage[] = [
    { type: "text", text: PDF_BODY },
    { type: "image", originalContentUrl: SHARE_URL, previewImageUrl: SHARE_URL },
  ];
  assert.deepEqual(redactShareLog({ messages: withImage, body: PDF_BODY }), { ok: false },
    "a non-text message can hide a link we cannot rewrite — refuse to persist it");
});

// ── 4-7. send-line-message.ts wiring (source) ──────────────────────────────

test("4. redaction is a closed boolean flag that runs before the pending log and the LINE call", () => {
  const code = codeOf(SEND);
  assert.match(code, /import \{ redactShareLog \} from "\.\/line-log-redaction";/);
  const redactAt = code.indexOf("options?.redactLog");
  const pendingAt = code.indexOf("createPendingLog(");
  const fetchAt = code.indexOf("await fetch(`${LINE_API_BASE}/message/push`");
  assert.ok(redactAt >= 0 && redactAt < pendingAt, "redaction precedes the pending-log write");
  assert.ok(redactAt < fetchAt, "…and precedes the LINE request");
  // redactLog is a boolean — never a caller-supplied replacement string.
  assert.match(code, /redactLog\?:\s*boolean;/);
});

test("5. a share message that cannot be safely audited FAILS CLOSED before the LINE call", () => {
  const code = codeOf(SEND);
  const redactAt = code.indexOf("options?.redactLog");
  const pendingAt = code.indexOf("createPendingLog(");
  const block = code.slice(redactAt, pendingAt);
  assert.match(block, /redactShareLog\(\{ messages: outboundMessages, body \}\)/);
  assert.match(block, /if \(!safe\.ok\)/);
  assert.match(block, /reason: "log-unavailable"/, "an un-auditable share aborts before any send");
});

test("6. LINE receives the ORIGINAL messages while the LOG receives the audit copy", () => {
  const code = codeOf(SEND);
  // The push carries the untouched outbound messages (the working URL).
  assert.match(code, /JSON\.stringify\(\{ to: lineUserId, messages: outboundMessages \}\)/);
  // The audit copy is a separate binding; the payload persists IT, not the outbound.
  assert.match(code, /let messages: LineMessage\[\] = outboundMessages;/);
  assert.match(code, /messages = safe\.messages;/);
  assert.match(code, /body = safe\.body;/);
  // The redacted reassignment lives ONLY inside the redact branch.
  const redactBlock = code.slice(code.indexOf("options?.redactLog"), code.indexOf("createPendingLog("));
  assert.ok(redactBlock.includes("messages = safe.messages;"), "reassignment is gated behind redactLog");
});

test("7. text-mode logging is unchanged — the payload literal and default audit copy are intact", () => {
  const code = codeOf(SEND);
  // The audit copy defaults to the outbound content, so a non-redacted send logs
  // exactly what it did before (byte-for-byte).
  assert.match(code, /let messages: LineMessage\[\] = outboundMessages;/);
  // The canonical payload shape is preserved: messages spread first, metadata beside.
  assert.match(code, /\{ messages, metadata: options\.logMetadata \}/);
  assert.match(code, /: \{ messages \}/);
});

test("8. the estimate action redacts the log ONLY for pdf-link, never for text", () => {
  const code = codeOf(ACTION);
  assert.match(code, /redactLog: mode === "pdf-link"/);
});
