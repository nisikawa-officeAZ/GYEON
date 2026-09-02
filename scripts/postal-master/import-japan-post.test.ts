import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  parseImportCliArgs,
  deriveImportRow,
  chunkImportRows,
  runImportCli,
  verifySupabaseProjectBinding,
  IMPORT_BATCH_SIZE,
  type JpPostalImportRpcClient,
  type JpPostalMasterImportRow,
} from "./import-japan-post";
import type { JpPostalCsvRow } from "@/lib/geo/jp-postal-master-csv";

const VALID_SHA256 = "a".repeat(64);
const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const PROJECT_REF = "abcdefghijklmnopqrst";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = "synthetic-test-key";

function importArgs(sha256: string = VALID_SHA256, extra: readonly string[] = []): string[] {
  return [
    "--csv", "/tmp/x.csv",
    "--source-date", "2026-09-01",
    "--sha256", sha256,
    "--expected-project-ref", PROJECT_REF,
    "--confirm-project-ref", PROJECT_REF,
    ...extra,
  ];
}

function rollbackArgs(extra: readonly string[] = []): string[] {
  return [
    "--rollback-batch", VALID_UUID,
    "--expected-project-ref", PROJECT_REF,
    "--confirm-project-ref", PROJECT_REF,
    ...extra,
  ];
}

// ── Argument parsing ──────────────────────────────────────────────────────

test("parses a well-formed import invocation", () => {
  const result = parseImportCliArgs(importArgs());
  assert.deepEqual(result, {
    ok: true,
    args: {
      mode: "import",
      csvPath: "/tmp/x.csv",
      sourceDate: "2026-09-01",
      expectedSha256: VALID_SHA256,
      expectedProjectRef: PROJECT_REF,
      confirmProjectRef: PROJECT_REF,
      validateOnly: false,
    },
  });
});

test("parses a well-formed rollback invocation", () => {
  const result = parseImportCliArgs(rollbackArgs());
  assert.deepEqual(result, {
    ok: true,
    args: { mode: "rollback", rollbackBatchId: VALID_UUID, expectedProjectRef: PROJECT_REF, confirmProjectRef: PROJECT_REF },
  });
});

test("rejects --rollback-batch combined with any import argument", () => {
  const result = parseImportCliArgs(["--rollback-batch", VALID_UUID, "--csv", "/tmp/x.csv"]);
  assert.deepEqual(result, { ok: false, error: "ROLLBACK_COMBINED_WITH_IMPORT_ARGS" });
});

test("rejects a missing csv path", () => {
  assert.deepEqual(
    parseImportCliArgs(["--source-date", "2026-09-01", "--sha256", VALID_SHA256, "--expected-project-ref", PROJECT_REF]),
    { ok: false, error: "MISSING_CSV_PATH" },
  );
});

test("rejects a missing source date", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--sha256", VALID_SHA256, "--expected-project-ref", PROJECT_REF]),
    { ok: false, error: "MISSING_SOURCE_DATE" },
  );
});

test("rejects an invalid calendar date", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-02-30", "--sha256", VALID_SHA256, "--expected-project-ref", PROJECT_REF]),
    { ok: false, error: "INVALID_SOURCE_DATE" },
  );
});

test("rejects a missing sha256", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--expected-project-ref", PROJECT_REF]),
    { ok: false, error: "MISSING_EXPECTED_SHA256" },
  );
});

test("rejects a malformed sha256", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", "not-hex", "--expected-project-ref", PROJECT_REF]),
    { ok: false, error: "INVALID_EXPECTED_SHA256" },
  );
});

test("rejects a malformed rollback batch id", () => {
  assert.deepEqual(
    parseImportCliArgs(["--rollback-batch", "not-a-uuid", "--expected-project-ref", PROJECT_REF, "--confirm-project-ref", PROJECT_REF]),
    { ok: false, error: "INVALID_ROLLBACK_BATCH_ID" },
  );
});

test("requires expected and confirmed project refs for every mutation", () => {
  const withoutExpected = importArgs().filter((_, i, a) => a[i - 1] !== "--expected-project-ref" && a[i] !== "--expected-project-ref");
  assert.deepEqual(parseImportCliArgs(withoutExpected), { ok: false, error: "MISSING_EXPECTED_PROJECT_REF" });
  const withoutConfirm = importArgs().filter((_, i, a) => a[i - 1] !== "--confirm-project-ref" && a[i] !== "--confirm-project-ref");
  assert.deepEqual(parseImportCliArgs(withoutConfirm), { ok: false, error: "MISSING_CONFIRM_PROJECT_REF" });
  const mismatchedConfirm = [...withoutConfirm, "--confirm-project-ref", "zyxwvutsrqponmlkjihg"];
  assert.deepEqual(
    parseImportCliArgs(mismatchedConfirm),
    { ok: false, error: "PROJECT_REF_CONFIRMATION_MISMATCH" },
  );
});

test("validate-only is import-only and does not require confirmation", () => {
  const args = importArgs(VALID_SHA256, ["--validate-only"])
    .filter((_, i, a) => a[i - 1] !== "--confirm-project-ref" && a[i] !== "--confirm-project-ref");
  const result = parseImportCliArgs(args);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.args.mode === "import" && result.args.validateOnly, true);
  assert.deepEqual(parseImportCliArgs(rollbackArgs(["--validate-only"])), {
    ok: false,
    error: "ROLLBACK_COMBINED_WITH_IMPORT_ARGS",
  });
});

test("rejects an unknown flag", () => {
  assert.deepEqual(parseImportCliArgs(["--bogus", "x"]), { ok: false, error: "UNKNOWN_ARGUMENT" });
});

// ── Row derivation and batching ───────────────────────────────────────────

const BASE_ROW: JpPostalCsvRow = {
  jisCode: "13101",
  oldPostalCode: "100",
  postalCode: "1000001",
  prefectureKana: "ﾄｳｷﾖｳﾄ",
  cityKana: "ﾁﾖﾀﾞｸ",
  townKana: "ﾁﾖﾀﾞ",
  prefectureKanji: "東京都",
  cityKanji: "千代田区",
  townKanji: "千代田",
  flagMultiPostalPerTown: "0",
  flagKoazaBanchi: "0",
  flagHasChome: "0",
  flagMultiTownPerPostal: "0",
  updateFlag: "0",
  changeReasonCode: "0",
};

test("deriveImportRow computes an address key for a specific town", () => {
  const row = deriveImportRow(BASE_ROW);
  assert.equal(row.isNonSpecificTown, false);
  assert.equal(row.addressKey, "東京都千代田区千代田");
  assert.equal(row.addressPrefixHead, "東京都千代田区千代田".slice(0, 8));
});

test("deriveImportRow leaves a non-specific town with no matchable key", () => {
  const row = deriveImportRow({ ...BASE_ROW, townKanji: "以下に掲載がない場合" });
  assert.equal(row.isNonSpecificTown, true);
  assert.equal(row.addressKey, null);
  assert.equal(row.addressPrefixHead, null);
});

test("chunkImportRows produces deterministic, order-preserving, bounded batches", () => {
  const rows = Array.from({ length: IMPORT_BATCH_SIZE * 2 + 3 }, () => deriveImportRow(BASE_ROW));
  const chunks = chunkImportRows(rows);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, IMPORT_BATCH_SIZE);
  assert.equal(chunks[1].length, IMPORT_BATCH_SIZE);
  assert.equal(chunks[2].length, 3);
  assert.equal(chunks.flat().length, rows.length);
});

test("chunkImportRows rejects a non-positive size", () => {
  assert.throws(() => chunkImportRows([], 0));
  assert.throws(() => chunkImportRows([], -1));
});

// ── Orchestration ──────────────────────────────────────────────────────────

const CSV_TEXT = '13101,100,1000001,ﾄｳｷﾖｳﾄ,ﾁﾖﾀﾞｸ,ﾁﾖﾀﾞ,東京都,千代田区,千代田,0,0,0,0,0,0\n';
const CSV_SHA256 = createHash("sha256").update(CSV_TEXT, "utf8").digest("hex");

function fakeRpcClient(overrides: Partial<JpPostalImportRpcClient> = {}): JpPostalImportRpcClient {
  return {
    status: async () => ({
      ok: true,
      value: { found: false, expectedRowCount: 1, appendedSequences: [], isActive: false },
    }),
    begin: async () => ({ ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }),
    append: async () => ({ ok: true, value: { appendedCount: 1, alreadyAppended: false } }),
    finalize: async () => ({ ok: true, value: { totalCount: 1 } }),
    rollback: async () => ({ ok: true, value: { promotedBatchId: VALID_UUID } }),
    ...overrides,
  };
}

function mutationDeps(
  rpcClient: JpPostalImportRpcClient,
  overrides: Partial<{
    readFile: (path: string) => string;
    sha256: (text: string) => string;
    log: (line: string) => void;
    supabaseUrl: string;
    serviceRoleKey: string;
    createRpcClient: (url: string, key: string) => Promise<JpPostalImportRpcClient>;
  }> = {},
) {
  return {
    readFile: () => CSV_TEXT,
    sha256: () => CSV_SHA256,
    log: () => {},
    supabaseUrl: PROJECT_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
    createRpcClient: async () => rpcClient,
    ...overrides,
  };
}

test("runImportCli stops on a checksum mismatch before parsing", async () => {
  let parseCalled = false;
  const outcome = await runImportCli(
    importArgs("b".repeat(64)),
    mutationDeps(fakeRpcClient(), {
      readFile: () => { parseCalled = true; return CSV_TEXT; },
      sha256: () => CSV_SHA256,
    }),
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "CHECKSUM_MISMATCH" });
  assert.equal(parseCalled, true); // file was read (for hashing) but the RPC client was never reached
});

test("runImportCli imports through begin/append/finalize on a matching checksum", async () => {
  const calls: string[] = [];
  const logs: string[] = [];
  const rpcClient = fakeRpcClient({
    status: async () => {
      calls.push("status");
      return { ok: true, value: { found: false, expectedRowCount: 1, appendedSequences: [], isActive: false } };
    },
    begin: async () => { calls.push("begin"); return { ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }; },
    append: async () => { calls.push("append"); return { ok: true, value: { appendedCount: 1, alreadyAppended: false } }; },
    finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
  });
  const outcome = await runImportCli(
    importArgs(CSV_SHA256),
    mutationDeps(rpcClient, { log: (line) => logs.push(line) }),
  );
  assert.deepEqual(outcome, { ok: true, kind: "imported", batchId: VALID_UUID, totalCount: 1, batchCount: 1 });
  assert.deepEqual(calls, ["status", "begin", "append", "finalize"]);
  assert.equal(logs.length, 1);
  // Log output is restricted to date/checksum/batch/counts/status — never an address or row value.
  assert.equal(logs[0].includes("東京都"), false);
  assert.equal(logs[0].includes("1000001"), false);
  assert.equal(logs[0].includes(PROJECT_URL), false);
  assert.equal(logs[0].includes(SERVICE_ROLE_KEY), false);
});

test("runImportCli treats an already-promoted identical replay as a no-write success", async () => {
  const appendCalls: number[] = [];
  const rpcClient = fakeRpcClient({
    status: async () => ({
      ok: true,
      value: {
        found: true,
        batchId: VALID_UUID,
        status: "promoted",
        expectedRowCount: 1,
        appendedSequences: [0],
        isActive: true,
      },
    }),
    append: async (input) => {
      appendCalls.push(input.sequence);
      return { ok: true, value: { appendedCount: input.rows.length, alreadyAppended: false } };
    },
  });
  const outcome = await runImportCli(
    importArgs(CSV_SHA256),
    mutationDeps(rpcClient),
  );
  assert.deepEqual(outcome, { ok: true, kind: "already-promoted", batchId: VALID_UUID });
  assert.deepEqual(appendCalls, []);
});

test("runImportCli rejects a promoted-but-superseded or terminal identity without appending", async () => {
  const appendCalls: number[] = [];
  const base = {
    found: true as const,
    batchId: VALID_UUID,
    expectedRowCount: 1,
    appendedSequences: [] as number[],
  };
  const append = async (input: { sequence: number }) => {
    appendCalls.push(input.sequence);
    return { ok: true as const, value: { appendedCount: 1, alreadyAppended: false } };
  };
  const superseded = await runImportCli(importArgs(CSV_SHA256), mutationDeps(fakeRpcClient({
    status: async () => ({ ok: true, value: { ...base, status: "promoted", isActive: false } }),
    append,
  })));
  assert.deepEqual(superseded, { ok: false, errorCode: "PROMOTED_BATCH_SUPERSEDED" });
  const rejected = await runImportCli(importArgs(CSV_SHA256), mutationDeps(fakeRpcClient({
    status: async () => ({ ok: true, value: { ...base, status: "rejected", isActive: false } }),
    append,
  })));
  assert.deepEqual(rejected, { ok: false, errorCode: "BATCH_REJECTED" });
  assert.deepEqual(appendCalls, []);
});

test("runImportCli rollback calls only the rollback RPC", async () => {
  const calls: string[] = [];
  const rpcClient = fakeRpcClient({
      begin: async () => { calls.push("begin"); return { ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }; },
      rollback: async () => { calls.push("rollback"); return { ok: true, value: { promotedBatchId: "prior-batch" } }; },
  });
  const outcome = await runImportCli(rollbackArgs(), mutationDeps(rpcClient, {
    readFile: () => { calls.push("readFile"); return CSV_TEXT; },
    sha256: () => { calls.push("sha256"); return CSV_SHA256; },
  }));
  assert.deepEqual(outcome, { ok: true, kind: "rolled-back", batchId: VALID_UUID, promotedBatchId: "prior-batch" });
  assert.deepEqual(calls, ["rollback"]);
});

test("runImportCli surfaces a malformed CSV as a stable CSV_PARSE_ error code", async () => {
  const badCsv = "not,enough,columns\n";
  const sha = createHash("sha256").update(badCsv, "utf8").digest("hex");
  const outcome = await runImportCli(
    importArgs(sha),
    mutationDeps(fakeRpcClient(), { readFile: () => badCsv, sha256: () => sha }),
  );
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.errorCode, "CSV_PARSE_COLUMN_COUNT_MISMATCH");
});

test("runImportCli surfaces a file-read failure as a stable error code", async () => {
  const outcome = await runImportCli(
    importArgs(),
    mutationDeps(fakeRpcClient(), {
      readFile: () => { throw new Error("ENOENT"); },
      sha256: () => VALID_SHA256,
    }),
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "CSV_READ_FAILED" });
});

test("runImportCli surfaces an append failure without calling finalize", async () => {
  const calls: string[] = [];
  const rpcClient = fakeRpcClient({
    append: async () => { calls.push("append"); return { ok: false, errorCode: "APPEND_FAILED" }; },
    finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
  });
  const outcome = await runImportCli(
    importArgs(CSV_SHA256),
    mutationDeps(rpcClient),
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "APPEND_FAILED" });
  assert.deepEqual(calls, ["append"]);
});

test("canonical project binding accepts only the exact expected/confirmed hosted project", () => {
  assert.deepEqual(verifySupabaseProjectBinding(PROJECT_URL, PROJECT_REF, PROJECT_REF), {
    ok: true,
    projectRef: PROJECT_REF,
  });
  for (const [url, expected, confirmed, code] of [
    ["http://abcdefghijklmnopqrst.supabase.co", PROJECT_REF, PROJECT_REF, "NON_CANONICAL_SUPABASE_URL"],
    ["https://abcdefghijklmnopqrst.supabase.co.attacker.test", PROJECT_REF, PROJECT_REF, "NON_CANONICAL_SUPABASE_URL"],
    ["https://custom.example.test", PROJECT_REF, PROJECT_REF, "NON_CANONICAL_SUPABASE_URL"],
    ["https://abcdefghijklmnopqrst.supabase.co:443", PROJECT_REF, PROJECT_REF, "NON_CANONICAL_SUPABASE_URL"],
    ["https://abcdefghijklmnopqrst.supabase.co/rest/v1", PROJECT_REF, PROJECT_REF, "NON_CANONICAL_SUPABASE_URL"],
    [PROJECT_URL, "zyxwvutsrqponmlkjihg", "zyxwvutsrqponmlkjihg", "PROJECT_REF_URL_MISMATCH"],
    [PROJECT_URL, PROJECT_REF, "zyxwvutsrqponmlkjihg", "PROJECT_REF_CONFIRMATION_MISMATCH"],
  ] as const) {
    assert.deepEqual(verifySupabaseProjectBinding(url, expected, confirmed), { ok: false, errorCode: code });
  }
});

test("every project mismatch fails before RPC client construction", async () => {
  let constructions = 0;
  const outcome = await runImportCli(importArgs(CSV_SHA256), mutationDeps(fakeRpcClient(), {
    supabaseUrl: "https://zyxwvutsrqponmlkjihg.supabase.co",
    createRpcClient: async () => { constructions += 1; return fakeRpcClient(); },
  }));
  assert.deepEqual(outcome, { ok: false, errorCode: "PROJECT_REF_URL_MISMATCH" });
  assert.equal(constructions, 0);
});

test("validate-only performs full local planning with zero client construction and zero RPC", async () => {
  let constructions = 0;
  const calls: string[] = [];
  const logs: string[] = [];
  const args = importArgs(CSV_SHA256, ["--validate-only"])
    .filter((_, i, a) => a[i - 1] !== "--confirm-project-ref" && a[i] !== "--confirm-project-ref");
  const outcome = await runImportCli(args, {
    readFile: () => CSV_TEXT,
    sha256: () => CSV_SHA256,
    createRpcClient: async () => { constructions += 1; return fakeRpcClient({
      status: async () => { calls.push("status"); return { ok: false, errorCode: "UNEXPECTED" }; },
    }); },
    log: (line) => logs.push(line),
  });
  assert.deepEqual(outcome, { ok: true, kind: "validated", totalCount: 1, batchCount: 1 });
  assert.equal(constructions, 0);
  assert.deepEqual(calls, []);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes(PROJECT_URL), false);
  assert.equal(logs[0].includes(SERVICE_ROLE_KEY), false);
  assert.equal(logs[0].includes("東京都"), false);
});

test("interrupted staged import resumes and skips every already appended sequence", async () => {
  const calls: string[] = [];
  const rpcClient = fakeRpcClient({
    status: async () => ({
      ok: true,
      value: {
        found: true,
        batchId: VALID_UUID,
        status: "validating",
        expectedRowCount: 1,
        appendedSequences: [0],
        isActive: false,
      },
    }),
    begin: async () => { calls.push("begin"); return { ok: false, errorCode: "UNEXPECTED" }; },
    append: async () => { calls.push("append"); return { ok: false, errorCode: "UNEXPECTED" }; },
    finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
  });
  const outcome = await runImportCli(importArgs(CSV_SHA256), mutationDeps(rpcClient));
  assert.deepEqual(outcome, { ok: true, kind: "imported", batchId: VALID_UUID, totalCount: 1, batchCount: 1 });
  assert.deepEqual(calls, ["finalize"]);
});

test("begin race re-reads status once and resumes only the exact staged identity", async () => {
  let statusCalls = 0;
  const calls: string[] = [];
  const rpcClient = fakeRpcClient({
    status: async () => {
      statusCalls += 1;
      if (statusCalls === 1) {
        return { ok: true, value: { found: false, expectedRowCount: 1, appendedSequences: [], isActive: false } };
      }
      return {
        ok: true,
        value: {
          found: true,
          batchId: VALID_UUID,
          status: "staged",
          expectedRowCount: 1,
          appendedSequences: [],
          isActive: false,
        },
      };
    },
    begin: async () => { calls.push("begin"); return { ok: false, errorCode: "IMPORT_IN_PROGRESS" }; },
    append: async () => { calls.push("append"); return { ok: true, value: { appendedCount: 0, alreadyAppended: true } }; },
    finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
  });
  const outcome = await runImportCli(importArgs(CSV_SHA256), mutationDeps(rpcClient));
  assert.equal(outcome.ok, true);
  assert.equal(statusCalls, 2);
  assert.deepEqual(calls, ["begin", "append", "finalize"]);
});

test("status count mismatch fails closed before begin or append", async () => {
  const calls: string[] = [];
  const outcome = await runImportCli(importArgs(CSV_SHA256), mutationDeps(fakeRpcClient({
    status: async () => ({ ok: false, errorCode: "EXPECTED_ROW_COUNT_MISMATCH" }),
    begin: async () => { calls.push("begin"); return { ok: false, errorCode: "UNEXPECTED" }; },
    append: async () => { calls.push("append"); return { ok: false, errorCode: "UNEXPECTED" }; },
  })));
  assert.deepEqual(outcome, { ok: false, errorCode: "EXPECTED_ROW_COUNT_MISMATCH" });
  assert.deepEqual(calls, []);
});

test("invalid or out-of-range status sequence evidence fails closed", async () => {
  for (const appendedSequences of [[2], [-1], [0, 0], [0.5]]) {
    const outcome = await runImportCli(importArgs(CSV_SHA256), mutationDeps(fakeRpcClient({
      status: async () => ({
        ok: true,
        value: {
          found: true,
          batchId: VALID_UUID,
          status: "validating",
          expectedRowCount: 1,
          appendedSequences,
          isActive: false,
        },
      }),
    })));
    assert.deepEqual(outcome, { ok: false, errorCode: "STATUS_SEQUENCE_INVALID" });
  }
});

test("runImportCli rejects an invalid CLI invocation before touching any dependency", async () => {
  const calls: string[] = [];
  const outcome = await runImportCli(["--bogus"], {
    readFile: () => { calls.push("readFile"); return CSV_TEXT; },
    sha256: () => { calls.push("sha256"); return CSV_SHA256; },
    log: () => {},
  });
  assert.deepEqual(outcome, { ok: false, errorCode: "UNKNOWN_ARGUMENT" });
  assert.deepEqual(calls, []);
});

test("row data used in this suite is exclusively synthetic (no real personal data path)", () => {
  const row: JpPostalMasterImportRow = deriveImportRow(BASE_ROW);
  assert.equal(row.postalCode, "1000001");
});
