// GDA-3A — completed-work-order completion-desk review-surface source-contract test.
//
// Asserts WorkOrderDetail extracts the completion-report, invoice,
// maintenance, and review-request sections into one shared
// `completionDeskSections` element that is reused, unmodified, for both the
// completed-only 完了後の対応 wrapper and the non-completed rendering path,
// without introducing new state, server actions, or automatic authority.
//
// Run: node --import tsx --test src/components/work-orders/work-order-completion-desk.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const COMPONENT = "src/components/work-orders/WorkOrderDetail.tsx";

const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const code = codeOf(COMPONENT);

const countOccurrences = (source: string, pattern: RegExp): number =>
  (source.match(pattern) ?? []).length;

// ── Completion desk heading and exact sequence ──────────────────────────────

test("renders the 完了後の対応 heading", () => {
  assert.match(code, /完了後の対応/);
});

test("renders the exact four-step sequence", () => {
  assert.match(
    code,
    /1\.\s*完了報告書\s*→\s*2\.\s*請求書\s*→\s*3\.\s*メンテナンス通知\s*→\s*4\.\s*レビュー依頼/
  );
});

// ── Completed-only wrapper guard ────────────────────────────────────────────

test('guards the completion-desk wrapper on wo.status === "completed"', () => {
  assert.match(code, /wo\.status === "completed" \? \(/);
});

// ── Shared single completionDeskSections element ────────────────────────────

test("defines exactly one completionDeskSections element", () => {
  assert.equal(countOccurrences(code, /const completionDeskSections = \(/g), 1);
});

test("reuses the same completionDeskSections element for both the completed and non-completed branches", () => {
  assert.equal(countOccurrences(code, /\{completionDeskSections\}/g), 1);
  assert.match(code, /\) : \(\s*completionDeskSections\s*\)/);
});

// ── Each existing child component invoked exactly once ──────────────────────

test("invokes CompletionReportSection exactly once", () => {
  assert.equal(countOccurrences(code, /<CompletionReportSection\b/g), 1);
});

test("invokes InvoiceSection exactly once", () => {
  assert.equal(countOccurrences(code, /<InvoiceSection\b/g), 1);
});

test("invokes MaintenanceSection exactly once", () => {
  assert.equal(countOccurrences(code, /<MaintenanceSection\b/g), 1);
});

test("invokes ReviewRequestApprovalSection exactly once", () => {
  assert.equal(countOccurrences(code, /<ReviewRequestApprovalSection\b/g), 1);
});

// ── Existing show/hide states unchanged; no additional useState ────────────

test("keeps exactly the five existing useState toggles and adds no new one", () => {
  assert.equal(countOccurrences(code, /useState\(false\)/g), 5);
  assert.match(code, /const \[showFiles,\s*setShowFiles\]\s*= useState\(false\)/);
  assert.match(code, /const \[showReport,\s*setShowReport\]\s*= useState\(false\)/);
  assert.match(code, /const \[showInvoice,\s*setShowInvoice\]\s*= useState\(false\)/);
  assert.match(code, /const \[showMaintenance,\s*setShowMaintenance\]\s*= useState\(false\)/);
  assert.match(code, /const \[showReviewRequest,\s*setShowReviewRequest\]\s*= useState\(false\)/);
});

test("does not default-open any section", () => {
  assert.doesNotMatch(code, /useState\(true\)/);
});

// ── No new server action, persistence, or automatic authority ──────────────

test("imports no server action module", () => {
  assert.doesNotMatch(code, /"use server"/);
  assert.doesNotMatch(code, /from ["']@\/lib\/[^"']*actions[^"']*["']/);
});

test("adds no auto-issue, auto-send, or auto-approval behavior", () => {
  assert.doesNotMatch(code, /auto[-_]?(issue|send|approve|approval|create)/i);
});
