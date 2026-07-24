// R90B — the `estimate` message purpose.
//
// Run: node --import tsx --test src/lib/line/line-message-types.test.ts
//
// Pure types module — no "use server", no server-only, no Supabase — so it is
// imported directly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { lineMessagePurposeLabel, type LineMessagePurpose } from "./line-message-types";

const TYPES_SRC = "src/lib/line/line-message-types.ts";

test("1. `estimate` is a member of the purpose union and is labelled", () => {
  const purpose: LineMessagePurpose = "estimate";
  assert.equal(lineMessagePurposeLabel(purpose), "見積送付");
});

test("2. every pre-existing purpose keeps its exact label", () => {
  const before: Array<[LineMessagePurpose, string]> = [
    ["manual", "手動送信"],
    ["completion_report", "完了報告"],
    ["maintenance_reminder", "メンテナンス通知"],
    ["reservation", "予約案内"],
    ["campaign", "キャンペーン"],
    ["review_request", "レビュー依頼"],
    ["system", "システム"],
  ];
  for (const [p, label] of before) assert.equal(lineMessagePurposeLabel(p), label, p);
});

test("3. the label map stays EXHAUSTIVE over the union", () => {
  // `Record<LineMessagePurpose, string>` makes a missing member a compile error;
  // this pins the runtime side so a future member cannot fall through to the
  // `?? purpose` escape and surface a raw enum value to an operator.
  const all: LineMessagePurpose[] = [
    "manual", "completion_report", "maintenance_reminder", "reservation",
    "campaign", "review_request", "estimate", "system",
  ];
  for (const p of all) {
    const label = lineMessagePurposeLabel(p);
    assert.notEqual(label, p, `${p} fell through to the raw-value fallback`);
    assert.ok(label.length > 0);
  }
});

test("4. the addition is TypeScript-only — no migration, no SQL edit", () => {
  // Comment-stripped: the documentation above the union is allowed to NAME the
  // things the code must not do.
  const code = readFileSync(TYPES_SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(code, /'estimate'/);
  // The DB column is `purpose text NOT NULL DEFAULT 'manual'` with no CHECK and
  // no enum type, so nothing here may reach for SQL.
  for (const forbidden of ["CREATE TYPE", "ALTER TABLE", "migration"]) {
    assert.equal(code.includes(forbidden), false, `types module references ${forbidden}`);
  }
});
