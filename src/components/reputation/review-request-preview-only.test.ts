// GDA-4A — review-request preview-only source-contract test.
//
// Asserts ReviewRequestApprovalSection no longer imports or exposes the
// dry-run approve/reject/skip actions, their result phases, or their
// buttons, while the useful readiness/preview/copy/compliance surface and
// the required no-save/no-send disclosure remain.
//
// Run: node --import tsx --test src/components/reputation/review-request-preview-only.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const COMPONENT = "src/components/reputation/ReviewRequestApprovalSection.tsx";

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const code = codeOf(COMPONENT);

// ── Dry-run action identifiers are absent ───────────────────────────────────

test("does not import approveReviewRequestDryRun", () => {
  assert.doesNotMatch(code, /approveReviewRequestDryRun/);
});

test("does not import rejectReviewRequestDryRun", () => {
  assert.doesNotMatch(code, /rejectReviewRequestDryRun/);
});

test("does not import skipReviewRequestDryRun", () => {
  assert.doesNotMatch(code, /skipReviewRequestDryRun/);
});

// ── Approving/rejecting/skipping/done result behavior is absent ────────────

test("does not carry an approving/rejecting/skipping/done section phase", () => {
  assert.doesNotMatch(code, /"approving"/);
  assert.doesNotMatch(code, /"rejecting"/);
  assert.doesNotMatch(code, /"skipping"/);
  assert.doesNotMatch(code, /"done"/);
});

test("does not carry ReviewRequestDryRunActionResult or a result field", () => {
  assert.doesNotMatch(code, /ReviewRequestDryRunActionResult/);
  assert.doesNotMatch(code, /result:\s*null/);
});

// ── The three action-button labels are absent ───────────────────────────────

test("does not render the approve/reject/skip button labels", () => {
  assert.doesNotMatch(code, /承認（ドライラン）/);
  assert.doesNotMatch(code, /否認/);
  assert.doesNotMatch(code, />後で</);
});

// ── Required behavior is preserved ──────────────────────────────────────────

test("still imports and calls prepareReviewRequestApproval", () => {
  assert.match(code, /import\s*\{\s*prepareReviewRequestApproval\s*\}\s*from\s*["']@\/lib\/reputation\/actions\/review-request-actions["']/);
  assert.match(code, /prepareReviewRequestApproval\(workOrderId\)/);
});

test("still renders the deterministic LINE message preview and character count", () => {
  assert.match(code, /LINEメッセージプレビュー/);
  assert.match(code, /preview\.payload\.character_count/);
  assert.match(code, /preview\.payload\.message_text/);
});

test("still renders the copy action", () => {
  assert.match(code, /handleCopy/);
  assert.match(code, /navigator\.clipboard\.writeText/);
  assert.match(code, /メッセージをコピー/);
});

test("still renders link readiness", () => {
  assert.match(code, /LinkReadinessRow/);
  assert.match(code, /リンク設定状況/);
});

test("still renders missing settings", () => {
  assert.match(code, /設定が必要な項目/);
  assert.match(code, /missing_settings/);
});

test("still renders the compliance checklist", () => {
  assert.match(code, /コンプライアンス保証/);
  assert.match(code, /compliance_checklist/);
});

test("still has the disabled future AI-edit boundary", () => {
  assert.match(code, /下書き編集（Phase 11G\+）/);
  assert.match(code, /disabled/);
});

test("still declares the source-contract prop and status guards", () => {
  assert.match(code, /isCompleted/);
  assert.match(code, /feature_locked/);
  assert.match(code, /no_customer/);
});

// ── Japanese no-save/no-send disclosure ─────────────────────────────────────

test("displays the required Japanese no-save/no-send disclosure", () => {
  assert.match(code, /このプレビューでは承認は保存されず、LINEも送信されません。/);
});

// ── Ready status label wording ──────────────────────────────────────────────

test("does not render the executable-approval ready status label", () => {
  assert.doesNotMatch(code, /承認可能/);
});

test("renders the preview-readiness ready status label", () => {
  assert.match(code, /プレビュー準備完了/);
});
