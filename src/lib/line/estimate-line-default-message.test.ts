// GYEON-EST-LINE-F1-R1 — the code-defined GYEON default message + length constants.
//
// Run: node --import tsx --test src/lib/line/estimate-line-default-message.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDefaultEstimateLineMessage } from "./estimate-line-default-message";
import {
  MAX_ESTIMATE_LINE_MESSAGE_LENGTH,
  ESTIMATE_LINE_PDF_SENTENCE,
  ESTIMATE_LINE_SHARE_PATH_PREFIX,
  ESTIMATE_LINE_SHARE_TOKEN_LENGTH,
  computeEstimateLinePdfReserve,
  composeEstimateLinePdfMessage,
} from "./send-estimate-line-core";
import {
  SHARE_TOKEN_LENGTH,
  generateShareToken,
  buildShareUrl,
} from "../estimates/estimate-share-core";

// ── 1. Full interpolation — the exact approved template ─────────────────────

test("1. all three values interpolate into the exact approved GYEON template", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "テスト顧客 GYEON-DELIVERY-V1",
    estimateNumber: "EST-00001",
    dealerDisplayName: "GYEON 品川",
  });
  assert.equal(msg, [
    "テスト顧客 GYEON-DELIVERY-V1 様",
    "",
    "お世話になっております。",
    "GYEON 品川です。",
    "",
    "お車のお見積書（EST-00001）をお送りします。",
    "ご不明な点やご要望がございましたら、このLINEにてお気軽にご連絡ください。",
    "",
    "どうぞよろしくお願いいたします。",
  ].join("\n"));
});

// ── 2. Omission rules — never an unresolved token, never a stray line ───────

test("2. a missing dealer display name omits that entire line cleanly", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "山田", estimateNumber: "EST-1", dealerDisplayName: null,
  });
  assert.equal(msg.includes("です。"), false, "no dealer line");
  assert.equal(msg.includes("undefined"), false);
  assert.equal(msg.includes("null"), false);
  assert.match(msg, /お世話になっております。\n\nお車のお見積書/, "no blank gap where the line was");
});

test("2b. whitespace-only dealer name is treated as missing", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "山田", estimateNumber: "EST-1", dealerDisplayName: "   ",
  });
  assert.equal(msg.includes("です。"), false);
});

test("3. a missing estimate number omits only the parenthetical", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "山田", estimateNumber: null, dealerDisplayName: "GYEON 品川",
  });
  assert.ok(msg.includes("お車のお見積書をお送りします。"));
  assert.equal(msg.includes("（"), false, "no empty parenthesis");
});

test("4. a missing customer name omits the greeting line and its blank line", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "", estimateNumber: "EST-1", dealerDisplayName: null,
  });
  assert.ok(msg.startsWith("お世話になっております。"), "starts at the salutation");
  assert.equal(msg.includes(" 様"), false);
});

test("5. intentional line breaks are literal \\n (the textarea preserves them verbatim)", () => {
  const msg = buildDefaultEstimateLineMessage({
    customerName: "山田", estimateNumber: "EST-1", dealerDisplayName: "GYEON 品川",
  });
  assert.equal(msg.includes("\r"), false);
  assert.ok(msg.split("\n").length >= 8);
});

// ── 6. Length-constant drift proofs (A2-R2) ─────────────────────────────────

test("6. the client-safe token-length literal matches the authoritative share constant AND the real generator", () => {
  assert.equal(ESTIMATE_LINE_SHARE_TOKEN_LENGTH, SHARE_TOKEN_LENGTH, "core literal vs share-core constant");
  for (let i = 0; i < 5; i += 1) {
    assert.equal(generateShareToken().length, ESTIMATE_LINE_SHARE_TOKEN_LENGTH, "real generator output length");
  }
});

test("7. the PDF reserve is EXACT: reserve(origin) === (composed − body) for a real URL", () => {
  const origin = "https://app.example.com";
  const token = generateShareToken();
  const url = buildShareUrl(origin, token);
  const body = "テスト本文です。";
  const composed = composeEstimateLinePdfMessage(body, url);
  assert.equal(
    composed.length - body.length,
    computeEstimateLinePdfReserve(origin),
    "reserve accounts for separators + sentence + complete URL, in UTF-16 units",
  );
  // Structure: body, then the sentence, then the URL — nothing else.
  assert.equal(composed, `${body}\n${ESTIMATE_LINE_PDF_SENTENCE}\n${url}`);
  assert.ok(url.startsWith(origin + ESTIMATE_LINE_SHARE_PATH_PREFIX), "path prefix matches buildShareUrl");
});

test("8. the maximum is the LINE UTF-16 limit and counting is string.length", () => {
  assert.equal(MAX_ESTIMATE_LINE_MESSAGE_LENGTH, 5000);
  // A surrogate-pair character counts as TWO units under this accounting.
  assert.equal("𠮷".length, 2);
});
