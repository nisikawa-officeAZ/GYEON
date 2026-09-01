#!/usr/bin/env node
// GDA-2A-OCR-POSTAL-MASTER-R2 — controlled local import CLI for the Japan Post postal master.
//
// This tool NEVER downloads or unzips data: it accepts only a local already-extracted official
// UTF-8 CSV path, an explicit source publication date, and an expected SHA-256, and it calls
// service-role-only import RPCs. It creates TOOLING ONLY in this phase — it is never invoked
// against real data or a real database here.
//
// Every exported function below is pure or takes its I/O (`readFile`, `sha256`, the RPC client) as
// injected dependencies, so the whole CLI orchestration is testable without touching a filesystem,
// crypto module, or database. Only `main()` — reached exclusively when this file is executed
// directly — wires the real dependencies, and it is never called by the test file or by any other
// module in this candidate.

import {
  parseJpPostalCsv,
  type JpPostalCsvRow,
} from "@/lib/geo/jp-postal-master-csv";
import {
  isNonSpecificTownText,
  buildJpPostalAddressKey,
  buildJpPostalAddressPrefixHead,
} from "@/lib/geo/jp-postal-master-contract";

// ── CLI argument contract ─────────────────────────────────────────────────────

export interface ParsedImportArgs {
  readonly mode: "import";
  readonly csvPath: string;
  readonly sourceDate: string;
  readonly expectedSha256: string;
}
export interface ParsedRollbackArgs {
  readonly mode: "rollback";
  readonly rollbackBatchId: string;
}
export type ParsedCliArgs = ParsedImportArgs | ParsedRollbackArgs;

export type CliArgsParseErrorCode =
  | "UNKNOWN_ARGUMENT"
  | "MISSING_CSV_PATH"
  | "MISSING_SOURCE_DATE"
  | "INVALID_SOURCE_DATE"
  | "MISSING_EXPECTED_SHA256"
  | "INVALID_EXPECTED_SHA256"
  | "ROLLBACK_COMBINED_WITH_IMPORT_ARGS"
  | "INVALID_ROLLBACK_BATCH_ID";

export type CliArgsParseResult =
  | { readonly ok: true; readonly args: ParsedCliArgs }
  | { readonly ok: false; readonly error: CliArgsParseErrorCode };

const KNOWN_FLAGS = new Set(["--csv", "--source-date", "--sha256", "--rollback-batch"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Parse CLI arguments into exactly one of an import request or a rollback request. `--rollback-batch`
 * can never appear alongside any import flag — the two modes are mutually exclusive at the parse
 * boundary, not merely by convention.
 */
export function parseImportCliArgs(argv: readonly string[]): CliArgsParseResult {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!KNOWN_FLAGS.has(flag)) return { ok: false, error: "UNKNOWN_ARGUMENT" };
    const value = argv[i + 1];
    if (value === undefined || KNOWN_FLAGS.has(value)) return { ok: false, error: "UNKNOWN_ARGUMENT" };
    flags.set(flag, value);
    i += 1;
  }

  const hasRollback = flags.has("--rollback-batch");
  const hasImportArg = flags.has("--csv") || flags.has("--source-date") || flags.has("--sha256");
  if (hasRollback && hasImportArg) return { ok: false, error: "ROLLBACK_COMBINED_WITH_IMPORT_ARGS" };

  if (hasRollback) {
    const rollbackBatchId = flags.get("--rollback-batch") as string;
    if (!UUID_RE.test(rollbackBatchId)) return { ok: false, error: "INVALID_ROLLBACK_BATCH_ID" };
    return { ok: true, args: { mode: "rollback", rollbackBatchId } };
  }

  const csvPath = flags.get("--csv");
  if (!csvPath) return { ok: false, error: "MISSING_CSV_PATH" };
  const sourceDate = flags.get("--source-date");
  if (!sourceDate) return { ok: false, error: "MISSING_SOURCE_DATE" };
  if (!isValidIsoDate(sourceDate)) return { ok: false, error: "INVALID_SOURCE_DATE" };
  const expectedSha256 = flags.get("--sha256");
  if (!expectedSha256) return { ok: false, error: "MISSING_EXPECTED_SHA256" };
  if (!SHA256_RE.test(expectedSha256)) return { ok: false, error: "INVALID_EXPECTED_SHA256" };

  return { ok: true, args: { mode: "import", csvPath, sourceDate, expectedSha256: expectedSha256.toLowerCase() } };
}

// ── Row derivation and bounded batching ───────────────────────────────────────

export const IMPORT_BATCH_SIZE = 500;

export interface JpPostalMasterImportRow extends JpPostalCsvRow {
  /** `null` for a non-specific-town row: it is imported (preserving the source columns) but can
   * never win a reverse lookup, so it carries no matchable address key. */
  readonly addressKey: string | null;
  readonly addressPrefixHead: string | null;
  readonly isNonSpecificTown: boolean;
}

/** Attach the derived, non-source-mutating reverse-lookup key fields to one parsed CSV row. */
export function deriveImportRow(row: JpPostalCsvRow): JpPostalMasterImportRow {
  const isNonSpecificTown = isNonSpecificTownText(row.townKanji);
  if (isNonSpecificTown) {
    return { ...row, addressKey: null, addressPrefixHead: null, isNonSpecificTown: true };
  }
  const addressKey = buildJpPostalAddressKey(row);
  return { ...row, addressKey, addressPrefixHead: buildJpPostalAddressPrefixHead(addressKey), isNonSpecificTown: false };
}

/** Deterministic, order-preserving, bounded-size batches — never a single unbounded payload. */
export function chunkImportRows(
  rows: readonly JpPostalMasterImportRow[],
  size: number = IMPORT_BATCH_SIZE,
): readonly (readonly JpPostalMasterImportRow[])[] {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError("chunkImportRows: size must be a positive integer");
  const chunks: JpPostalMasterImportRow[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

// ── Injected RPC client and orchestration ────────────────────────────────────

export type ImportRpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errorCode: string };

export interface JpPostalImportRpcClient {
  begin(input: {
    readonly sourceDate: string;
    readonly sha256: string;
    readonly expectedRowCount: number;
  }): Promise<ImportRpcResult<{ readonly batchId: string; readonly alreadyPromoted: boolean }>>;
  append(input: {
    readonly batchId: string;
    readonly sequence: number;
    readonly rows: readonly JpPostalMasterImportRow[];
  }): Promise<ImportRpcResult<{ readonly appendedCount: number }>>;
  finalize(input: { readonly batchId: string }): Promise<ImportRpcResult<{ readonly totalCount: number }>>;
  rollback(input: { readonly batchId: string }): Promise<ImportRpcResult<{ readonly promotedBatchId: string }>>;
}

export interface ImportCliDeps {
  readonly readFile: (path: string) => string;
  readonly sha256: (text: string) => string;
  readonly rpcClient: JpPostalImportRpcClient;
  /** Stable, address/row-free log output only — never a source row or address. */
  readonly log: (line: string) => void;
}

export type ImportCliOutcome =
  | { readonly ok: true; readonly kind: "imported"; readonly batchId: string; readonly totalCount: number; readonly batchCount: number }
  | { readonly ok: true; readonly kind: "already-promoted"; readonly batchId: string }
  | { readonly ok: true; readonly kind: "rolled-back"; readonly batchId: string; readonly promotedBatchId: string }
  | { readonly ok: false; readonly errorCode: string };

/**
 * Run one CLI invocation end to end against injected dependencies.
 *
 * Checksum is computed and compared BEFORE the file is parsed at all, so a mismatched file is
 * refused without the parser ever running over untrusted content. A batch already promoted under
 * the identical (sourceDate, sha256) pair is an explicit no-write success (`already-promoted`) —
 * the RPC client's `begin` is the sole authority on that replay decision.
 */
export async function runImportCli(argv: readonly string[], deps: ImportCliDeps): Promise<ImportCliOutcome> {
  const parsed = parseImportCliArgs(argv);
  if (!parsed.ok) return { ok: false, errorCode: parsed.error };

  if (parsed.args.mode === "rollback") {
    const { rollbackBatchId } = parsed.args;
    const result = await deps.rpcClient.rollback({ batchId: rollbackBatchId });
    if (!result.ok) return { ok: false, errorCode: result.errorCode };
    deps.log(`rollback batch=${rollbackBatchId} promoted=${result.value.promotedBatchId}`);
    return { ok: true, kind: "rolled-back", batchId: rollbackBatchId, promotedBatchId: result.value.promotedBatchId };
  }

  const { csvPath, sourceDate, expectedSha256 } = parsed.args;

  let text: string;
  try {
    text = deps.readFile(csvPath);
  } catch {
    return { ok: false, errorCode: "CSV_READ_FAILED" };
  }

  const actualSha256 = deps.sha256(text).toLowerCase();
  if (actualSha256 !== expectedSha256) return { ok: false, errorCode: "CHECKSUM_MISMATCH" };

  const parsedCsv = parseJpPostalCsv(text);
  if (!parsedCsv.ok) return { ok: false, errorCode: `CSV_PARSE_${parsedCsv.error}` };

  const importRows = parsedCsv.rows.map(deriveImportRow);

  const begin = await deps.rpcClient.begin({ sourceDate, sha256: actualSha256, expectedRowCount: importRows.length });
  if (!begin.ok) return { ok: false, errorCode: begin.errorCode };
  if (begin.value.alreadyPromoted) {
    deps.log(`replay date=${sourceDate} sha256=${actualSha256} batch=${begin.value.batchId} status=already-promoted`);
    return { ok: true, kind: "already-promoted", batchId: begin.value.batchId };
  }

  const chunks = chunkImportRows(importRows);
  for (let sequence = 0; sequence < chunks.length; sequence += 1) {
    const result = await deps.rpcClient.append({ batchId: begin.value.batchId, sequence, rows: chunks[sequence] });
    if (!result.ok) return { ok: false, errorCode: result.errorCode };
  }

  const finalize = await deps.rpcClient.finalize({ batchId: begin.value.batchId });
  if (!finalize.ok) return { ok: false, errorCode: finalize.errorCode };

  deps.log(
    `import date=${sourceDate} sha256=${actualSha256} batch=${begin.value.batchId} `
    + `rows=${finalize.value.totalCount} batches=${chunks.length} status=promoted`,
  );
  return { ok: true, kind: "imported", batchId: begin.value.batchId, totalCount: finalize.value.totalCount, batchCount: chunks.length };
}

// ── Real wiring — reached only when this file is executed directly ──────────
//
// Never called by the test file or by any other module in this candidate. Builds the real
// dependencies and calls `runImportCli`. Uses a NON-LITERAL import specifier for the Supabase
// client so a missing/uninstalled package cannot fail static type-checking of this file — this
// path is not exercised in this phase (no database connection is made here).

async function buildServiceRoleRpcClient(): Promise<JpPostalImportRpcClient> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run a real import.");
  }
  const pkgName = "@supabase/supabase-js";
  const { createClient } = await import(pkgName);
  const client = createClient(url, serviceRoleKey);

  // The SQL RPCs return a jsonb envelope `{ result_code: "OK" | <error code>, ...snake_case fields }`.
  // This wrapper turns that into the camelCase `ImportRpcResult<T>` the orchestration expects, and
  // maps any non-"OK" result_code (or a PostgREST error) to a failure rather than a thrown error.
  const callRpc = async <T>(fn: string, params: Record<string, unknown>, mapValue: (row: Record<string, unknown>) => T): Promise<ImportRpcResult<T>> => {
    const { data, error } = await client.rpc(fn, params);
    if (error) return { ok: false, errorCode: error.code ?? "RPC_ERROR" };
    const row = data as Record<string, unknown> | null;
    if (!row || typeof row !== "object") return { ok: false, errorCode: "MALFORMED_RPC_RESPONSE" };
    if (row.result_code !== "OK") return { ok: false, errorCode: typeof row.result_code === "string" ? row.result_code : "UNKNOWN_RPC_ERROR" };
    return { ok: true, value: mapValue(row) };
  };

  return {
    begin: (input) => callRpc(
      "jp_postal_import_begin",
      { p_source_date: input.sourceDate, p_sha256: input.sha256, p_expected_row_count: input.expectedRowCount },
      (row) => ({ batchId: row.batch_id as string, alreadyPromoted: row.already_promoted === true }),
    ),
    append: (input) => callRpc(
      "jp_postal_import_append",
      { p_batch_id: input.batchId, p_sequence: input.sequence, p_rows: input.rows },
      (row) => ({ appendedCount: Number(row.appended_count) }),
    ),
    finalize: (input) => callRpc(
      "jp_postal_import_finalize",
      { p_batch_id: input.batchId },
      (row) => ({ totalCount: Number(row.total_count) }),
    ),
    rollback: (input) => callRpc(
      "jp_postal_import_rollback",
      { p_batch_id: input.batchId },
      (row) => ({ promotedBatchId: row.promoted_batch_id as string }),
    ),
  };
}

async function main(): Promise<void> {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const rpcClient = await buildServiceRoleRpcClient();
  const outcome = await runImportCli(process.argv.slice(2), {
    readFile: (path) => readFileSync(path, "utf8"),
    sha256: (text) => createHash("sha256").update(text, "utf8").digest("hex"),
    rpcClient,
    // eslint-disable-next-line no-console
    log: (line) => console.log(line),
  });
  if (!outcome.ok) {
    // eslint-disable-next-line no-console
    console.error(outcome.errorCode);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
