// GDA-2A-OCR-POSTAL-MASTER-R2 — pure, dependency-free parser for the official Japan Post
// `utf_ken_all` UTF-8 postal-code CSV.
//
// This module performs NO file I/O and NO network access; it accepts already-read CSV TEXT and
// returns a typed, validated row set or a stable error code. The import CLI (a separate allowlisted
// file) owns reading the local file and computing/checking its SHA-256 before calling here.
//
// Column order is fixed by the official `utf-readme` specification (15 columns, one record per
// line): JIS municipality code, old postal code, postal code, prefecture/city/town kana,
// prefecture/city/town kanji, four official flags (10-13), an update flag, and a change-reason
// code. All 15 source values are preserved verbatim (including leading zeroes) — this parser never
// derives or replaces a source column; derived normalized keys are the caller's job.

export interface JpPostalCsvRow {
  readonly jisCode: string;
  readonly oldPostalCode: string;
  readonly postalCode: string;
  readonly prefectureKana: string;
  readonly cityKana: string;
  readonly townKana: string;
  readonly prefectureKanji: string;
  readonly cityKanji: string;
  readonly townKanji: string;
  /** Flag 10 — 一町域が二以上の郵便番号で表される場合の表示 (0 or 1). */
  readonly flagMultiPostalPerTown: "0" | "1";
  /** Flag 11 — 小字毎に番地が起番されている町域の表示 (0 or 1). */
  readonly flagKoazaBanchi: "0" | "1";
  /** Flag 12 — 丁目を有する町域の場合の表示 (0 or 1). */
  readonly flagHasChome: "0" | "1";
  /** Flag 13 — 一つの郵便番号で二以上の町域を表す場合の表示 (0 or 1). */
  readonly flagMultiTownPerPostal: "0" | "1";
  /** 更新の表示 (0 = 変更なし, 1 = 変更あり, 2 = 廃止). */
  readonly updateFlag: "0" | "1" | "2";
  /** 変更理由 (0-6). */
  readonly changeReasonCode: "0" | "1" | "2" | "3" | "4" | "5" | "6";
}

export type JpPostalCsvParseErrorCode =
  | "EMPTY_INPUT"
  | "BOM_PRESENT"
  | "MALFORMED_QUOTE"
  | "EMBEDDED_RECORD_BREAK"
  | "COLUMN_COUNT_MISMATCH"
  | "INVALID_JIS_CODE"
  | "INVALID_POSTAL_CODE"
  | "INVALID_OLD_POSTAL_CODE"
  | "INVALID_FLAG_VALUE"
  | "INVALID_UPDATE_FLAG"
  | "INVALID_CHANGE_REASON_CODE"
  | "DUPLICATE_ROW_IDENTITY"
  | "INVALID_ENCODING";

export interface JpPostalCsvParseFailure {
  readonly ok: false;
  readonly error: JpPostalCsvParseErrorCode;
  /** 1-based source line number, when the failure is attributable to one line. */
  readonly line?: number;
}

export interface JpPostalCsvParseSuccess {
  readonly ok: true;
  readonly rows: readonly JpPostalCsvRow[];
}

export type JpPostalCsvParseResult = JpPostalCsvParseSuccess | JpPostalCsvParseFailure;

const EXPECTED_COLUMN_COUNT = 15;
const BOM = "﻿";

const FLAG01 = new Set(["0", "1"]);
const UPDATE_FLAG = new Set(["0", "1", "2"]);
const CHANGE_REASON = new Set(["0", "1", "2", "3", "4", "5", "6"]);

/**
 * Split one CSV logical record's raw text into its columns.
 *
 * Handles double-quoted fields (comma/CR/LF inside quotes) and `""` as an escaped quote. Returns
 * `null` for a field that opens a quote and never closes it within the given text — the caller
 * treats that as an embedded record break (a quoted newline that swallowed the following physical
 * line) rather than silently concatenating lines.
 */
function splitCsvLine(line: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    if (line[i] === '"') {
      let field = "";
      i += 1;
      let closed = false;
      while (i < n) {
        const ch = line[i];
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          closed = true;
          i += 1;
          break;
        }
        field += ch;
        i += 1;
      }
      if (!closed) return null;
      // After a closing quote the next character must be a comma or end of line.
      if (i < n && line[i] !== ",") return null;
      fields.push(field);
      if (i < n && line[i] === ",") i += 1;
      else i = n + 1;
      continue;
    }

    const commaIdx = line.indexOf(",", i);
    if (commaIdx === -1) {
      const rest = line.slice(i);
      if (rest.includes('"')) return null;
      fields.push(rest);
      i = n + 1;
    } else {
      const field = line.slice(i, commaIdx);
      if (field.includes('"')) return null;
      fields.push(field);
      i = commaIdx + 1;
    }
  }
  return fields;
}

function isAllDigits(s: string): boolean {
  return s.length > 0 && /^\d+$/.test(s);
}

/**
 * Parse an already-read `utf_ken_all` CSV text into validated rows.
 *
 * Rejects (does not silently skip): a UTF-8 BOM, malformed quoting, a quoted field whose closing
 * quote is never found on its own line (embedded record break), any row without exactly 15
 * columns, any of the 15 official-format field checks, and duplicate row identity (the same
 * jisCode + postalCode + all six kana/kanji fields appearing twice).
 */
export function parseJpPostalCsv(text: string): JpPostalCsvParseResult {
  if (text.length === 0) return { ok: false, error: "EMPTY_INPUT" };
  if (text.charCodeAt(0) === 0xfeff || text.startsWith(BOM)) {
    return { ok: false, error: "BOM_PRESENT" };
  }
  // A raw U+FFFD anywhere is treated as invalid-encoding evidence (a lossy re-decode), never
  // silently parsed as a legitimate character.
  if (text.includes("�")) return { ok: false, error: "INVALID_ENCODING" };

  const rawLines = text.split(/\r\n|\r|\n/);
  // A single trailing empty element from a final line break is not a record.
  const lines = rawLines.length > 0 && rawLines[rawLines.length - 1] === ""
    ? rawLines.slice(0, -1)
    : rawLines;
  if (lines.length === 0) return { ok: false, error: "EMPTY_INPUT" };

  const rows: JpPostalCsvRow[] = [];
  const seenIdentity = new Set<string>();

  for (let idx = 0; idx < lines.length; idx += 1) {
    const lineNo = idx + 1;
    const rawLine = lines[idx];
    if (rawLine.trim().length === 0) return { ok: false, error: "COLUMN_COUNT_MISMATCH", line: lineNo };

    const fields = splitCsvLine(rawLine);
    if (fields === null) {
      // An unterminated quote could mean the following physical line was in fact part of this
      // record. Either way this parser refuses to guess-concatenate lines.
      return { ok: false, error: rawLine.includes('"') ? "EMBEDDED_RECORD_BREAK" : "MALFORMED_QUOTE", line: lineNo };
    }
    if (fields.length !== EXPECTED_COLUMN_COUNT) {
      return { ok: false, error: "COLUMN_COUNT_MISMATCH", line: lineNo };
    }

    const [
      jisCode, oldPostalCode, postalCode,
      prefectureKana, cityKana, townKana,
      prefectureKanji, cityKanji, townKanji,
      flagMultiPostalPerTown, flagKoazaBanchi, flagHasChome, flagMultiTownPerPostal,
      updateFlag, changeReasonCode,
    ] = fields;

    if (!/^\d{5}$/.test(jisCode)) return { ok: false, error: "INVALID_JIS_CODE", line: lineNo };
    if (!isAllDigits(oldPostalCode) || oldPostalCode.length > 5) {
      return { ok: false, error: "INVALID_OLD_POSTAL_CODE", line: lineNo };
    }
    if (!/^\d{7}$/.test(postalCode)) return { ok: false, error: "INVALID_POSTAL_CODE", line: lineNo };
    if (
      prefectureKana.length === 0 || cityKana.length === 0 || townKana.length === 0 ||
      prefectureKanji.length === 0 || cityKanji.length === 0 || townKanji.length === 0
    ) {
      return { ok: false, error: "COLUMN_COUNT_MISMATCH", line: lineNo };
    }
    if (!FLAG01.has(flagMultiPostalPerTown) || !FLAG01.has(flagKoazaBanchi)
      || !FLAG01.has(flagHasChome) || !FLAG01.has(flagMultiTownPerPostal)) {
      return { ok: false, error: "INVALID_FLAG_VALUE", line: lineNo };
    }
    if (!UPDATE_FLAG.has(updateFlag)) return { ok: false, error: "INVALID_UPDATE_FLAG", line: lineNo };
    if (!CHANGE_REASON.has(changeReasonCode)) {
      return { ok: false, error: "INVALID_CHANGE_REASON_CODE", line: lineNo };
    }

    const identity = [jisCode, postalCode, prefectureKana, cityKana, townKana, prefectureKanji, cityKanji, townKanji].join("");
    if (seenIdentity.has(identity)) return { ok: false, error: "DUPLICATE_ROW_IDENTITY", line: lineNo };
    seenIdentity.add(identity);

    rows.push({
      jisCode,
      oldPostalCode,
      postalCode,
      prefectureKana,
      cityKana,
      townKana,
      prefectureKanji,
      cityKanji,
      townKanji,
      flagMultiPostalPerTown: flagMultiPostalPerTown as "0" | "1",
      flagKoazaBanchi: flagKoazaBanchi as "0" | "1",
      flagHasChome: flagHasChome as "0" | "1",
      flagMultiTownPerPostal: flagMultiTownPerPostal as "0" | "1",
      updateFlag: updateFlag as "0" | "1" | "2",
      changeReasonCode: changeReasonCode as JpPostalCsvRow["changeReasonCode"],
    });
  }

  return { ok: true, rows };
}
