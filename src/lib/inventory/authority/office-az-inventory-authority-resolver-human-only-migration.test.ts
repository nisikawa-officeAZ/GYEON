// INV001 P19 D6-B F1/F1b/F1c static invariants for the human-only resolver
// migration. These tests read files only; they prove nothing about a running
// database. Runtime proof is the D6 disposable harness (A15) when it is run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateOfficeAzInventoryAuthority } from "./office-az-inventory-authority-core";

const MIGRATION_PATH =
  "supabase/migrations/20260927143257_office_az_inventory_authority_resolver_human_only.sql";
const PRIOR_PINNED_MIGRATIONS: ReadonlyArray<readonly [string, string]> = [
  [
    "supabase/migrations/20260920093931_office_az_operator_authority.sql",
    "2a880998de445c347b53dc8578bd5bfba0e1f66c22816722eef3ae1abf6ac767",
  ],
  [
    "supabase/migrations/20260924132149_office_az_inventory_mobile_persistence.sql",
    "1377e6847bbc261b1289fc0856c11c5feb9d270520c1fb4f26c294a4e33bc6ca",
  ],
];
const HARNESS_PATH = "scripts/e2e/inv001-d6/run.mjs";
const WORKFLOW_PATH = ".github/workflows/inv001-d6-disposable-security-proof.yml";
const TEST_PATH =
  "src/lib/inventory/authority/office-az-inventory-authority-resolver-human-only-migration.test.ts";
const PINNED_BASE = "b440efea8e023c917d78171804c2a1edfd163647";
const PINNED_TREE = "a5591ea3961432a58380261986ae48ca0b7714ee";
const SIGNATURE = "public.resolve_office_az_inventory_authority(text, text)";

type HarnessModule = {
  IDENTITY_EXPECTATIONS: Record<string, string>;
  buildSampleEvidence(): {
    base_commit: string;
    base_tree: string;
    migrations: Array<{ path: string; sha256: string }>;
    findings: Array<Record<string, unknown>>;
  };
};

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");
const sql = read(MIGRATION_PATH);
// Executable statements only; header comments may name the finding vocabulary.
const code = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const count = (text: string, pattern: RegExp): number => (text.match(pattern) ?? []).length;

test("forward-only: the new file is the newest migration and prior pinned migrations are byte-identical", () => {
  const versions = readdirSync(resolve(process.cwd(), "supabase/migrations"))
    .filter((name) => /^[0-9]{14}_.+\.sql$/u.test(name))
    .sort();
  assert.equal(versions.at(-1), basename(MIGRATION_PATH));
  assert.equal(versions.filter((name) => name > "20260924132149_office_az_inventory_mobile_persistence.sql").length, 1);
  for (const [path, expected] of PRIOR_PINNED_MIGRATIONS) {
    assert.equal(sha256(read(path)), expected, `pinned migration changed: ${path}`);
  }
});

test("exactly one create-or-replace of the pinned resolver signature and no other DDL, seed, or destructive statement", () => {
  assert.equal(count(code, /create\s+or\s+replace\s+function\s+public\.resolve_office_az_inventory_authority\(/gi), 1);
  assert.equal(count(code, /create\s+(or\s+replace\s+)?function/gi), 1);
  assert.doesNotMatch(code, /create\s+(table|schema|trigger|policy|role|extension|type|view|index|sequence)/i);
  assert.doesNotMatch(code, /\b(drop|alter|truncate)\s/i);
  assert.doesNotMatch(code, /insert\s+into|delete\s+from|\bupdate\s+\w+\s+set\b/i);
  assert.doesNotMatch(code, /security\s+invoker/i);
  assert.doesNotMatch(code, /\bexecute\s+format\b|\bexecute\s+'/i);
  // Terminators: the body's closing `end;`, `$function$;`, three revokes, one grant.
  assert.equal(count(code, /;\s*$/gm), 6);
});

test("validated signature, definer posture, and JSON shape are preserved", () => {
  const signature = code.match(/create or replace function public\.resolve_office_az_inventory_authority\(([\s\S]*?)\)\s*returns jsonb/i)?.[1] ?? "";
  assert.match(signature, /^\s*p_actor_id text,\s*p_operator_id text\s*$/);
  for (const forbidden of ["authenticated", "owner", "role", "capability", "location", "time", "service"]) {
    assert.doesNotMatch(signature, new RegExp(forbidden, "i"));
  }
  assert.match(code, /returns jsonb\s+language sql\s+stable\s+security definer\s+set search_path = ''\s+as \$function\$/i);
  assert.match(code, /when auth\.uid\(\) is null/);
  assert.match(code, /pg_catalog\.length\(p_actor_id\) not between 1 and 512/);
  assert.match(code, /pg_catalog\.length\(p_operator_id\) not between 1 and 512/);
  assert.match(code, /then null/);
  assert.equal(count(code, /'candidates'/g), 1);
  assert.equal(count(code, /'knownLocationIds'/g), 1);
  const fieldOrder = [
    "'source', 'server_resolved'",
    "'authenticatedUserId', auth.uid()::text",
    "'actorId', assignment.actor_id",
    "'operatorId', assignment.operator_id",
    "'principalKind', assignment.principal_kind",
    "'status', assignment.status",
    "'owner', assignment.owner",
    "'role', assignment.role",
    "'capabilities'",
    "'allowedLocationIds'",
    "'validFromIso'",
    "'validUntilIso'",
    "'authorityVersion', assignment.authority_version",
  ];
  let cursor = -1;
  for (const field of fieldOrder) {
    const index = code.indexOf(field);
    assert.ok(index > cursor, `candidate field missing or out of order: ${field}`);
    cursor = index;
  }
  for (const ordering of [
    "order by assignment.assignment_id",
    "order by grant_row.capability",
    "order by location_grant.location_id",
    "order by location_row.location_id",
  ]) assert.ok(code.includes(ordering), `deterministic ordering lost: ${ordering}`);
});

test("F1: candidates are filtered to human assignments bound to auth.uid(); no service disjunction remains", () => {
  assert.match(code, /assignment\.owner = 'OFFICE_AZ'/);
  assert.match(code, /assignment\.actor_id = p_actor_id/);
  assert.match(code, /assignment\.operator_id = p_operator_id/);
  assert.match(code, /and assignment\.principal_kind = 'human'/);
  assert.match(code, /and assignment\.authenticated_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(code, /'service'/);
  assert.doesNotMatch(code, /or\s+assignment\.principal_kind/i);
  assert.doesNotMatch(code, /principal_kind\s*(<>|!=|in\s*\()/i);
  assert.equal(count(code, /from office_az_inventory_authority_private\.assignments/g), 1);
  assert.match(code, /from human_candidate as assignment/);
});

const knownLocationSegment = (): string => {
  const start = code.indexOf("'knownLocationIds'");
  return code.slice(start, code.indexOf("$function$;", start));
};

test("F1b: knownLocationIds is [] without a matching human candidate and otherwise the full active Office AZ list", () => {
  const segment = knownLocationSegment();
  assert.match(segment, /^'knownLocationIds', case\s+when exists \(\s*select 1\s+from human_candidate as eligible\s+where /);
  assert.match(segment, /\)\s+then coalesce\(\(/);
  assert.match(segment, /from office_az_inventory_authority_private\.locations as location_row\s+where location_row\.owner = 'OFFICE_AZ' and location_row\.is_active/);
  assert.match(segment, /\), '\[\]'::jsonb\)\s+else '\[\]'::jsonb\s+end/);
  // Compatibility boundary: never narrowed to the caller's location grants.
  assert.doesNotMatch(segment, /location_grant|capability_grant|assignment\./);
  assert.equal(count(code, /from office_az_inventory_authority_private\.locations/g), 1);
});

test("F1c: knownLocationIds requires an active, currently valid matching human; candidates stay unfiltered", () => {
  const segment = knownLocationSegment();
  const gate = segment.match(/^'knownLocationIds', case\s+when exists \(([\s\S]*?)\)\s+then coalesce\(\(/)?.[1] ?? "";
  assert.match(
    gate,
    /^\s*select 1\s+from human_candidate as eligible\s+where eligible\.status = 'active'\s+and eligible\.valid_from <= pg_catalog\.now\(\)\s+and \(eligible\.valid_until is null or eligible\.valid_until > pg_catalog\.now\(\)\)\s*$/,
  );
  assert.equal(count(code, /pg_catalog\.now\(\)/g), 2);
  assert.doesNotMatch(code, /statement_timestamp|clock_timestamp|current_timestamp|transaction_timestamp/i);

  // The candidate set itself is not narrowed, so the core keeps its deny codes.
  const cte = code.match(/with human_candidate as \(([\s\S]*?)\n\s*\)\n\s*select pg_catalog\.jsonb_build_object/)?.[1] ?? "";
  assert.match(cte, /from office_az_inventory_authority_private\.assignments as assignment/);
  assert.doesNotMatch(cte, /assignment\.status\s*=|valid_from\s*<|valid_until\s*>|now\(\)/);
  assert.match(code, /from human_candidate as assignment\s+\), '\[\]'::jsonb\)/);
  assert.equal(count(code, /'status', assignment\.status/g), 1);
});

test("least privilege: EXECUTE stays authenticated-only, no table grants, every reference schema-qualified", () => {
  for (const role of ["public", "anon", "service_role"]) {
    assert.match(code, new RegExp(`revoke all on function ${SIGNATURE.replaceAll(/[().]/gu, "\\$&")} from ${role};`, "i"));
  }
  assert.equal(count(code, /\bgrant\b/gi), 1);
  assert.match(code, /grant execute on function public\.resolve_office_az_inventory_authority\(text, text\) to authenticated;/i);
  assert.doesNotMatch(code, /grant\s+(select|insert|update|delete|usage|all)/i);
  assert.doesNotMatch(code, /to\s+(anon|service_role|public)\b/i);
  for (const source of code.matchAll(/\bfrom\s+([A-Za-z_][A-Za-z0-9_.]*)/gu)) {
    const relation = source[1];
    assert.ok(
      relation.startsWith("office_az_inventory_authority_private.") || relation === "human_candidate" || ["public", "anon", "service_role"].includes(relation),
      `unqualified relation reference: ${relation}`,
    );
  }
  assert.doesNotMatch(code, /office_az_inventory_mobile_private|auth\.users|\bpublic\.(?!resolve_office_az_inventory_authority)/);
  for (const fn of ["jsonb_build_object", "jsonb_agg", "to_char", "btrim", "length", "now"]) {
    assert.doesNotMatch(code, new RegExp(`(?<![.\\w])${fn}\\(`, "g"), `unqualified function call: ${fn}`);
  }
  assert.equal(count(code, /auth\.uid\(\)/g), 3);
});

test("core contract: the resolver shapes produced after the fix evaluate fail-closed and keep the human boundary", () => {
  const human = {
    source: "server_resolved",
    authenticatedUserId: "user-a",
    actorId: "actor-a",
    operatorId: "operator-a",
    principalKind: "human",
    status: "active",
    owner: "OFFICE_AZ",
    role: "office_az_warehouse_operator",
    capabilities: ["inventory.quantity.read"],
    allowedLocationIds: ["wh-a"],
    validFromIso: "2026-01-01T00:00:00.000Z",
    validUntilIso: null,
    authorityVersion: 1,
  };
  const request = {
    authenticatedUserId: "user-a",
    actorId: "actor-a",
    operatorId: "operator-a",
    owner: "OFFICE_AZ",
    capability: "inventory.quantity.read",
    requiredLocationIds: ["wh-a"],
    expectedAuthorityVersion: 1,
    requestedAtIso: "2026-09-27T00:00:00.000Z",
  };
  const codeOf = (candidates: readonly unknown[], known: readonly unknown[]) => {
    const evaluation = evaluateOfficeAzInventoryAuthority(candidates, request, known);
    return evaluation.tag === "authorized" ? "authorized" : evaluation.code;
  };
  // F1/F1b outcome for any caller without a matching human assignment.
  assert.equal(codeOf([], []), "ZERO_ASSIGNMENT");
  // Legitimate human keeps the full active list and is authorized.
  assert.equal(codeOf([human], ["wh-a", "wh-b"]), "authorized");
  // Narrowing knownLocationIds for a legitimate human would break the D4 boundary.
  assert.equal(codeOf([human], []), "UNKNOWN_LOCATION");
  // F1c: ineligible humans now receive knownLocationIds = [] and keep their deny codes.
  assert.equal(codeOf([{ ...human, status: "suspended" }], []), "INACTIVE_OPERATOR");
  assert.equal(codeOf([{ ...human, status: "revoked" }], []), "INACTIVE_OPERATOR");
  assert.equal(codeOf([{ ...human, validFromIso: "2026-09-28T00:00:00.000Z" }], []), "NOT_YET_VALID");
  assert.equal(
    codeOf([{ ...human, validFromIso: "2026-09-01T00:00:00.000Z", validUntilIso: "2026-09-27T00:00:00.000Z" }], []),
    "EXPIRED",
  );
  // The pre-fix leak: a service candidate produced a distinguishable oracle.
  const service = { ...human, principalKind: "service", role: "office_az_inventory_service" };
  assert.equal(codeOf([service], ["wh-a", "wh-b"]), "SERVICE_AUTHORITY_NOT_CONFIGURED");
});

test("D6 harness and workflow pin this migration as the third applied migration with F1/F1b/F1c expectations", async () => {
  const specifier: string = pathToFileURL(resolve(process.cwd(), HARNESS_PATH)).href;
  const harness = (await import(specifier)) as HarnessModule;
  const sample = harness.buildSampleEvidence();
  assert.equal(sample.base_commit, PINNED_BASE);
  assert.equal(sample.base_tree, PINNED_TREE);
  assert.deepEqual(
    sample.migrations,
    [...PRIOR_PINNED_MIGRATIONS.map(([path, hash]) => ({ path, sha256: hash })), { path: MIGRATION_PATH, sha256: sha256(sql) }],
  );
  assert.equal(harness.IDENTITY_EXPECTATIONS.A15_service_candidate, "ZERO_ASSIGNMENT");
  assert.deepEqual(sample.findings.map((finding) => finding.id), ["F1", "F1b", "F1c"]);
  for (const finding of sample.findings) assert.equal(finding.disposition, "FIXED_BY_FORWARD_MIGRATION_20260927143257");

  const harnessSource = read(HARNESS_PATH);
  assert.match(harnessSource, /F1_SERVICE_CANDIDATE_EXPOSED/);
  assert.match(harnessSource, /F1B_KNOWN_LOCATIONS_EXPOSED_WITHOUT_HUMAN_CANDIDATE/);
  assert.match(harnessSource, /HUMAN_RESOLVER_COMPATIBILITY_BOUNDARY_CHANGED/);
  assert.match(harnessSource, /F1C_KNOWN_LOCATIONS_EXPOSED_TO_INELIGIBLE_HUMAN/);
  for (const key of ["susp", "rev", "future", "expired"]) {
    assert.ok(harnessSource.includes(`probe("A${key.toUpperCase()}:", "${key}")`), `F1c raw-RPC negative missing: ${key}`);
  }
  assert.doesNotMatch(harnessSource, /F1_SERVICE_CANDIDATE_NOT_OBSERVED/);
  assert.match(harnessSource, /length !== MIGRATIONS\.length\) throw stop\("TEMP_MIGRATION_SET_MISMATCH"\)/);
  assert.match(harnessSource, /counts\.size === MIGRATIONS\.length/);

  const workflow = read(WORKFLOW_PATH);
  for (const path of [MIGRATION_PATH, TEST_PATH, HARNESS_PATH, WORKFLOW_PATH]) {
    assert.ok(workflow.includes(`'${path}'`), `workflow change-set allowlist missing ${path}`);
  }
  assert.ok(workflow.includes(`- ${MIGRATION_PATH}`) && workflow.includes(`- ${TEST_PATH}`), "workflow trigger paths missing");
  assert.ok(workflow.includes(`\n          ${TEST_PATH}\n`), "workflow does not run this static test");
  assert.doesNotMatch(workflow, /scripts\/e2e\/inv001-d6\/(config\.toml|identity\.test\.ts|concurrency\.mjs)'/);
});
