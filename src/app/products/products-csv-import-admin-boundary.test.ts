// R4Q-R9 — source-boundary guards for the product CSV import UI.
//
// Run: node --import tsx --test src/app/products/products-csv-import-admin-boundary.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE_PATH = "src/app/products/page.tsx";
const CLIENT_PATH = "src/app/products/ProductsClient.tsx";

const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("the server page derives the import capability fail-closed and passes it as a boolean", () => {
  const page = codeOf(PAGE_PATH);
  const helperAt = page.indexOf("async function resolveCanImportCsv");
  const pageAt = page.indexOf("export default async function ProductsPage");
  assert.ok(helperAt >= 0 && helperAt < pageAt, "the server-only capability helper exists");

  const helper = page.slice(helperAt, pageAt);
  assert.match(helper, /await requireAdmin\(\)/, "active platform admin is the authority");
  assert.match(helper, /return true/);
  assert.match(helper, /catch \{\s*return false;/, "every denial or resolution failure is fail-closed");
  assert.match(page, /const canImportCsv = await resolveCanImportCsv\(\);/);
  assert.match(page, /canImportCsv=\{canImportCsv\}/, "only the server-derived boolean reaches the client");
});

test("the client requires the server-derived capability and guards every import affordance", () => {
  const client = codeOf(CLIENT_PATH);
  assert.match(client, /canImportCsv:\s+boolean;/, "the capability prop is required");
  assert.match(client, /\{ initialProducts, categories, canImportCsv \}/, "the client consumes the capability");

  const importControlsAt = client.indexOf("{canImportCsv && (");
  const inputAt = client.indexOf('type="file"');
  const importLabelAt = client.indexOf("CSVインポート");
  assert.ok(importControlsAt >= 0 && importControlsAt < inputAt && inputAt < importLabelAt,
    "file input and import label are inside the capability guard");

  assert.match(client, /\{canImportCsv && importResult && \(/,
    "the result panel is hidden from ordinary viewers");

  const emptyInstructionAt = client.indexOf("CSVインポートで商品を追加してください");
  const templateAt = client.indexOf("CSVテンプレートをダウンロード");
  const emptyGuardAt = client.lastIndexOf("{canImportCsv && (", emptyInstructionAt);
  assert.ok(emptyGuardAt >= 0 && emptyGuardAt < emptyInstructionAt && emptyInstructionAt < templateAt,
    "empty-state instruction and template link share the capability guard");
});

test("client and page code hold no privileged Supabase surface", () => {
  for (const path of [PAGE_PATH, CLIENT_PATH]) {
    const code = codeOf(path);
    for (const token of ["createAdminClient", "SUPABASE_SERVICE_ROLE_KEY", "@/lib/supabase/admin"]) {
      assert.equal(code.includes(token), false, `${path} must not contain ${token}`);
    }
  }
});
