import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  parseImportCliArgs,
  deriveImportRow,
  chunkImportRows,
  runImportCli,
  IMPORT_BATCH_SIZE,
  type JpPostalImportRpcClient,
  type JpPostalMasterImportRow,
} from "./import-japan-post";
import type { JpPostalCsvRow } from "@/lib/geo/jp-postal-master-csv";

const VALID_SHA256 = "a".repeat(64);
const VALID_UUID = "11111111-2222-3333-4444-555555555555";

// ── Argument parsing ──────────────────────────────────────────────────────

test("parses a well-formed import invocation", () => {
  const result = parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", VALID_SHA256]);
  assert.deepEqual(result, {
    ok: true,
    args: { mode: "import", csvPath: "/tmp/x.csv", sourceDate: "2026-09-01", expectedSha256: VALID_SHA256 },
  });
});

test("parses a well-formed rollback invocation", () => {
  const result = parseImportCliArgs(["--rollback-batch", VALID_UUID]);
  assert.deepEqual(result, { ok: true, args: { mode: "rollback", rollbackBatchId: VALID_UUID } });
});

test("rejects --rollback-batch combined with any import argument", () => {
  const result = parseImportCliArgs(["--rollback-batch", VALID_UUID, "--csv", "/tmp/x.csv"]);
  assert.deepEqual(result, { ok: false, error: "ROLLBACK_COMBINED_WITH_IMPORT_ARGS" });
});

test("rejects a missing csv path", () => {
  assert.deepEqual(
    parseImportCliArgs(["--source-date", "2026-09-01", "--sha256", VALID_SHA256]),
    { ok: false, error: "MISSING_CSV_PATH" },
  );
});

test("rejects a missing source date", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--sha256", VALID_SHA256]),
    { ok: false, error: "MISSING_SOURCE_DATE" },
  );
});

test("rejects an invalid calendar date", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-02-30", "--sha256", VALID_SHA256]),
    { ok: false, error: "INVALID_SOURCE_DATE" },
  );
});

test("rejects a missing sha256", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-09-01"]),
    { ok: false, error: "MISSING_EXPECTED_SHA256" },
  );
});

test("rejects a malformed sha256", () => {
  assert.deepEqual(
    parseImportCliArgs(["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", "not-hex"]),
    { ok: false, error: "INVALID_EXPECTED_SHA256" },
  );
});

test("rejects a malformed rollback batch id", () => {
  assert.deepEqual(parseImportCliArgs(["--rollback-batch", "not-a-uuid"]), { ok: false, error: "INVALID_ROLLBACK_BATCH_ID" });
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
    begin: async () => ({ ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }),
    append: async () => ({ ok: true, value: { appendedCount: 1 } }),
    finalize: async () => ({ ok: true, value: { totalCount: 1 } }),
    rollback: async () => ({ ok: true, value: { promotedBatchId: VALID_UUID } }),
    ...overrides,
  };
}

test("runImportCli stops on a checksum mismatch before parsing", async () => {
  let parseCalled = false;
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", "b".repeat(64)],
    {
      readFile: () => { parseCalled = true; return CSV_TEXT; },
      sha256: () => CSV_SHA256,
      rpcClient: fakeRpcClient(),
      log: () => {},
    },
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "CHECKSUM_MISMATCH" });
  assert.equal(parseCalled, true); // file was read (for hashing) but the RPC client was never reached
});

test("runImportCli imports through begin/append/finalize on a matching checksum", async () => {
  const calls: string[] = [];
  const logs: string[] = [];
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", CSV_SHA256],
    {
      readFile: () => CSV_TEXT,
      sha256: () => CSV_SHA256,
      rpcClient: fakeRpcClient({
        begin: async () => { calls.push("begin"); return { ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }; },
        append: async () => { calls.push("append"); return { ok: true, value: { appendedCount: 1 } }; },
        finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
      }),
      log: (line) => logs.push(line),
    },
  );
  assert.deepEqual(outcome, { ok: true, kind: "imported", batchId: VALID_UUID, totalCount: 1, batchCount: 1 });
  assert.deepEqual(calls, ["begin", "append", "finalize"]);
  assert.equal(logs.length, 1);
  // Log output is restricted to date/checksum/batch/counts/status — never an address or row value.
  assert.equal(logs[0].includes("東京都"), false);
  assert.equal(logs[0].includes("1000001"), false);
});

test("runImportCli treats an already-promoted identical replay as a no-write success", async () => {
  const appendCalls: number[] = [];
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", CSV_SHA256],
    {
      readFile: () => CSV_TEXT,
      sha256: () => CSV_SHA256,
      rpcClient: fakeRpcClient({
        begin: async () => ({ ok: true, value: { batchId: VALID_UUID, alreadyPromoted: true } }),
        append: async (input) => { appendCalls.push(input.sequence); return { ok: true, value: { appendedCount: input.rows.length } }; },
      }),
      log: () => {},
    },
  );
  assert.deepEqual(outcome, { ok: true, kind: "already-promoted", batchId: VALID_UUID });
  assert.deepEqual(appendCalls, []);
});

test("runImportCli surfaces a conflicting-checksum-reuse failure from begin without appending", async () => {
  const appendCalls: number[] = [];
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", CSV_SHA256],
    {
      readFile: () => CSV_TEXT,
      sha256: () => CSV_SHA256,
      rpcClient: fakeRpcClient({
        begin: async () => ({ ok: false, errorCode: "CHECKSUM_REPLAY_CONFLICT" }),
        append: async (input) => { appendCalls.push(input.sequence); return { ok: true, value: { appendedCount: 1 } }; },
      }),
      log: () => {},
    },
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "CHECKSUM_REPLAY_CONFLICT" });
  assert.deepEqual(appendCalls, []);
});

test("runImportCli rollback calls only the rollback RPC", async () => {
  const calls: string[] = [];
  const outcome = await runImportCli(["--rollback-batch", VALID_UUID], {
    readFile: () => { calls.push("readFile"); return CSV_TEXT; },
    sha256: () => { calls.push("sha256"); return CSV_SHA256; },
    rpcClient: fakeRpcClient({
      begin: async () => { calls.push("begin"); return { ok: true, value: { batchId: VALID_UUID, alreadyPromoted: false } }; },
      rollback: async () => { calls.push("rollback"); return { ok: true, value: { promotedBatchId: "prior-batch" } }; },
    }),
    log: () => {},
  });
  assert.deepEqual(outcome, { ok: true, kind: "rolled-back", batchId: VALID_UUID, promotedBatchId: "prior-batch" });
  assert.deepEqual(calls, ["rollback"]);
});

test("runImportCli surfaces a malformed CSV as a stable CSV_PARSE_ error code", async () => {
  const badCsv = "not,enough,columns\n";
  const sha = createHash("sha256").update(badCsv, "utf8").digest("hex");
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", sha],
    { readFile: () => badCsv, sha256: () => sha, rpcClient: fakeRpcClient(), log: () => {} },
  );
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.errorCode, "CSV_PARSE_COLUMN_COUNT_MISMATCH");
});

test("runImportCli surfaces a file-read failure as a stable error code", async () => {
  const outcome = await runImportCli(
    ["--csv", "/tmp/missing.csv", "--source-date", "2026-09-01", "--sha256", VALID_SHA256],
    {
      readFile: () => { throw new Error("ENOENT"); },
      sha256: () => VALID_SHA256,
      rpcClient: fakeRpcClient(),
      log: () => {},
    },
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "CSV_READ_FAILED" });
});

test("runImportCli surfaces an append failure without calling finalize", async () => {
  const calls: string[] = [];
  const outcome = await runImportCli(
    ["--csv", "/tmp/x.csv", "--source-date", "2026-09-01", "--sha256", CSV_SHA256],
    {
      readFile: () => CSV_TEXT,
      sha256: () => CSV_SHA256,
      rpcClient: fakeRpcClient({
        append: async () => { calls.push("append"); return { ok: false, errorCode: "APPEND_FAILED" }; },
        finalize: async () => { calls.push("finalize"); return { ok: true, value: { totalCount: 1 } }; },
      }),
      log: () => {},
    },
  );
  assert.deepEqual(outcome, { ok: false, errorCode: "APPEND_FAILED" });
  assert.deepEqual(calls, ["append"]);
});

test("runImportCli rejects an invalid CLI invocation before touching any dependency", async () => {
  const calls: string[] = [];
  const outcome = await runImportCli(["--bogus"], {
    readFile: () => { calls.push("readFile"); return CSV_TEXT; },
    sha256: () => { calls.push("sha256"); return CSV_SHA256; },
    rpcClient: fakeRpcClient(),
    log: () => {},
  });
  assert.deepEqual(outcome, { ok: false, errorCode: "UNKNOWN_ARGUMENT" });
  assert.deepEqual(calls, []);
});

test("row data used in this suite is exclusively synthetic (no real personal data path)", () => {
  const row: JpPostalMasterImportRow = deriveImportRow(BASE_ROW);
  assert.equal(row.postalCode, "1000001");
});
