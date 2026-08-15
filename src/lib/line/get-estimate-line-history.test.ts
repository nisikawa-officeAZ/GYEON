// GYEON-EST-LINE-F1-R1 — the transmission-history reader: safe projection,
// tenancy boundary, and truthful UI states.
//
// Run: node --import tsx --test src/lib/line/get-estimate-line-history.test.ts
//
// The "use server" reader transitively imports the server-only admin client, so
// it cannot execute under node:test; its projection logic is therefore a PURE
// core function (projectEstimateLineHistoryRow) proved behaviorally here, and
// the reader's tenancy predicates, single-parameter surface, and fail-closed
// branches are pinned from source — the same discipline the LINE transport
// boundary tests already use.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { projectEstimateLineHistoryRow } from "./send-estimate-line-core";

const READER_SRC = "src/lib/line/get-estimate-line-history.ts";
const UI_SRC = "src/components/estimates/EstimateLineHistory.tsx";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// ── 1-3. Projection: whitelist only, canaries can never cross ───────────────

const RAW_ROW = {
  id: "log-1",
  status: "sent",
  body: "お見積書のご案内",
  payload: {
    metadata: { estimateId: "e-1", mode: "pdf-link", shareId: "CANARY-SHARE", documentFileId: "CANARY-DOC" },
  },
  created_at: "2026-07-31T00:00:00Z",
  sent_at: "2026-07-31T00:00:05Z",
  // Fields that must NEVER cross the client boundary:
  line_user_id: "CANARY-LINE-USER",
  line_customer_id: "CANARY-LINE-CUSTOMER",
  error_message: "CANARY-PROVIDER-ERROR",
  title: "CANARY-TITLE",
};

test("1. the projection carries EXACTLY the six safe fields", () => {
  const row = projectEstimateLineHistoryRow(RAW_ROW);
  assert.ok(row);
  assert.deepEqual(Object.keys(row!).sort(), ["body", "createdAt", "id", "mode", "sentAt", "state"]);
  assert.equal(row!.state, "sent");
  assert.equal(row!.mode, "pdf-link");
  assert.equal(row!.body, "お見積書のご案内");
});

test("2. no canary (identifier, payload id, provider error, title) survives serialization", () => {
  const serialized = JSON.stringify(projectEstimateLineHistoryRow(RAW_ROW));
  for (const canary of ["CANARY-LINE-USER", "CANARY-LINE-CUSTOMER", "CANARY-PROVIDER-ERROR", "CANARY-TITLE", "CANARY-SHARE", "CANARY-DOC"]) {
    assert.equal(serialized.includes(canary), false, `leaked: ${canary}`);
  }
});

test("3. unknown status, malformed rows, and unknown modes fail closed", () => {
  assert.equal(projectEstimateLineHistoryRow({ ...RAW_ROW, status: "weird" }), null);
  assert.equal(projectEstimateLineHistoryRow({ ...RAW_ROW, id: "" }), null);
  assert.equal(projectEstimateLineHistoryRow(null), null);
  assert.equal(projectEstimateLineHistoryRow("row"), null);
  const noMode = projectEstimateLineHistoryRow({ ...RAW_ROW, payload: { metadata: { mode: "carrier-pigeon" } } });
  assert.equal(noMode!.mode, null, "an unknown mode projects to null, never a passthrough");
  for (const status of ["sent", "failed", "pending", "cancelled"]) {
    assert.ok(projectEstimateLineHistoryRow({ ...RAW_ROW, status }), status);
  }
});

// ── 4-7. Reader source boundary: tenancy, single input, fail-closed ─────────

test("4. the reader derives the dealer ONLY from getCurrentDealer and uses the admin client server-side", () => {
  const code = strip(readFileSync(READER_SRC, "utf8"));
  assert.match(code, /^"use server";/m);
  assert.match(code, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/);
  assert.match(code, /import \{ getCurrentDealer \} from "@\/lib\/auth\/get-current-dealer"/);
  assert.match(code, /const dealer = await getCurrentDealer\(\)/);
  assert.match(code, /if \(!dealer\) return \{ kind: "error" \}/, "no dealer → read failure, never empty history");
});

test("5. exactly one client value (the estimate id) — a dealer id has nowhere to enter", () => {
  const code = strip(readFileSync(READER_SRC, "utf8"));
  assert.match(code, /export async function getEstimateLineHistory\(\s*estimateId: string,?\s*\)/,
    "one string parameter only");
  assert.equal(/dealerId\s*[:,)]/.test(code), false, "no dealer parameter shape exists");
  assert.match(code, /\.eq\("dealer_id", dealer\.dealer_id\)/, "dealer predicate from the session derivation");
  assert.match(code, /\.eq\("purpose", "estimate"\)/);
  assert.match(code, /\.contains\("payload", \{ metadata: \{ estimateId \} \}\)/, "estimate linkage predicate");
});

test("6. deterministic ordering and a bounded initial count", () => {
  const code = strip(readFileSync(READER_SRC, "utf8"));
  assert.match(code, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(code, /const HISTORY_LIMIT = 10/);
  assert.match(code, /\.limit\(HISTORY_LIMIT\)/);
});

test("7. failures are errors; only a SUCCESSFUL read can be empty; malformed ids are non-disclosing", () => {
  const code = strip(readFileSync(READER_SRC, "utf8"));
  assert.match(code, /if \(error\) return \{ kind: "error" \}/, "query failure is a read failure");
  assert.match(code, /catch \{\s*return \{ kind: "error" \};?\s*\}/, "a throw is a read failure");
  assert.match(code, /if \(!isValidEstimateId\(estimateId\)\) return \{ kind: "ok", rows: \[\] \}/,
    "malformed id answers exactly like a foreign id — ok-empty, no existence probe");
  assert.match(code, /projectEstimateLineHistoryRow\(/, "every row passes the whitelist projection");
});

// ── 8-9. History UI: truthful states, read-only effect ──────────────────────

test("8. the empty text renders ONLY after a successful zero-row read; failure has its own state", () => {
  // Comment-STRIPPED: the header documentation truthfully NAMES the empty text,
  // so the ordering check must see only executable code, not comments.
  const code = strip(readFileSync(UI_SRC, "utf8"));
  const emptyAt = code.indexOf("送付履歴はありません");
  const okGuard = code.indexOf("stage.rows.length === 0");
  const errorAt = code.indexOf("送付履歴を読み込めませんでした。再読み込みしてください。");
  assert.ok(emptyAt >= 0 && okGuard >= 0 && errorAt >= 0);
  assert.ok(okGuard < emptyAt, "the empty text sits inside the ok+zero branch");
  assert.match(code, /stage\.kind === "error"/);
  assert.match(code, /data-testid="line-history-loading"/);
  assert.match(code, /data-testid="line-history-error"/);
  assert.match(code, /data-testid="line-history-empty"/);
  assert.match(code, /data-testid="line-history-list"/);
});

test("8b. every history state has a truthful label and pending never claims delivery", () => {
  const code = readFileSync(UI_SRC, "utf8");
  assert.match(code, /sent:\s*"送信済み"/);
  assert.match(code, /failed:\s*"送信失敗"/);
  assert.match(code, /pending:\s*"送信結果未確認（送信済みの可能性があります）"/);
  assert.match(code, /cancelled:\s*"中止"/);
});

test("9. the history effect is read-only and refetches on the version bump", () => {
  const code = strip(readFileSync(UI_SRC, "utf8"));
  assert.match(code, /\[estimateId, version, fetchHistory\]/, "version is an effect dependency");
  for (const forbidden of ["sendEstimateLine", "runEstimateLineAttempt", "attempt("]) {
    assert.equal(code.includes(forbidden), false, `history must never send: ${forbidden}`);
  }
});
