// R4Q-R9 — source-boundary guards for the privileged product CSV import.
//
// Run: node --import tsx --test src/lib/products/import-gyeon-products-csv.test.ts
//
// The target is a "use server" module, so it is not imported under node:test.
// The accepted parser behavior is unchanged; this file pins the authorization,
// client, and failure-order boundaries directly from source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ACTION_PATH = "src/lib/products/import-gyeon-products-csv.ts";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function importBody(): string {
  const code = codeOf(ACTION_PATH);
  const marker = "export async function importGyeonProductsCsv";
  const start = code.indexOf(marker);
  assert.ok(start >= 0, "the product CSV import action exists");
  return code.slice(start);
}

test("the import remains a Server Action and uses only the server-only admin client", () => {
  const raw = readFileSync(ACTION_PATH, "utf8");
  const code = codeOf(ACTION_PATH);

  assert.match(raw, /^"use server";/, "the server directive remains first");
  assert.match(code, /import \{ requireAdmin \} from "@\/lib\/admin\/require-admin";/);
  assert.match(code, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin";/);
  assert.equal(code.includes("@/lib/supabase/server"), false, "no request-scoped SSR client");
  assert.equal(code.includes("SUPABASE_SERVICE_ROLE_KEY"), false, "the action never reads the secret directly");
});

test("authorization precedes parsing, privileged client construction, and table access", () => {
  const body = importBody();
  const gateAt = body.indexOf("await requireAdmin()");
  const parseAt = body.indexOf("parseCsv(csvText)");
  const headerAt = body.indexOf('if (!headers.includes("sku")');
  const clientAt = body.indexOf("createAdminClient()");

  for (const [name, at] of [
    ["authorization gate", gateAt],
    ["CSV parsing", parseAt],
    ["header validation", headerAt],
    ["admin client", clientAt],
  ] as const) {
    assert.ok(at >= 0, `${name} exists`);
  }
  assert.ok(gateAt < parseAt, "authorization precedes CSV parsing");
  assert.ok(parseAt < headerAt && headerAt < clientAt,
    "header validation precedes privileged client construction");

  const tableAccesses = [...body.matchAll(/\.from\("gyeon_products"\)/g)];
  assert.ok(tableAccesses.length > 0, "product table access exists");
  for (const access of tableAccesses) {
    assert.ok(clientAt < (access.index ?? -1), "the privileged client precedes every table access");
  }
});

test("authorization denial is stable, non-sensitive, and zero-write", () => {
  const body = importBody();
  const gateAt = body.indexOf("await requireAdmin()");
  const parseAt = body.indexOf("parseCsv(csvText)");
  const denial = body.slice(gateAt, parseAt);

  assert.match(denial, /catch \{/);
  assert.match(denial, /inserted: 0/);
  assert.match(denial, /updated: 0/);
  assert.match(denial, /CSVインポートには有効な管理者権限が必要です/);
  assert.equal(/err\.message|error\.message/.test(denial), false, "no internal authorization detail is returned");
  for (const write of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
    assert.equal(denial.includes(write), false, `denial performs no ${write}`);
  }
});

test("existing-SKU classification failure stops before every product write", () => {
  const body = importBody();
  const selectAt = body.indexOf('.select("sku")');
  const failureAt = body.indexOf("if (existingError)");
  const updateAt = body.indexOf(".update(");
  const insertAt = body.indexOf(".insert(");

  assert.ok(selectAt >= 0 && failureAt > selectAt, "the SELECT error is inspected");
  assert.ok(updateAt > failureAt && insertAt > failureAt, "the failure guard precedes all writes");
  const failureBlock = body.slice(failureAt, Math.min(updateAt, insertAt));
  assert.match(failureBlock, /return \{/);
  assert.match(failureBlock, /inserted: 0/);
  assert.match(failureBlock, /updated: 0/);
  assert.match(failureBlock, /商品データの確認に失敗しました/);
});
