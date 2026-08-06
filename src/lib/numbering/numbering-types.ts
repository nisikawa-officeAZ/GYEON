// Pure types — no "use server" directive

export type DocumentSequenceType =
  | "estimate"
  | "work_order"
  | "completion_report"
  | "invoice"
  | "payment"
  | "maintenance_reminder"
  | "product_order"
  | "reservation"
  // MONTHLY-DATA-B2: the monthly consolidated invoice (月次請求書), numbered MIV with a monthly reset.
  | "monthly_invoice";

export type DocumentResetPolicy = "never" | "yearly" | "monthly";

export interface DocumentSequenceDB {
  id:             string;
  dealer_id:      string;
  sequence_type:  DocumentSequenceType;
  prefix:         string;
  padding:        number;
  reset_policy:   DocumentResetPolicy;
  fiscal_year:    number;
  current_number: number;
  created_at:     string;
  updated_at:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function defaultPrefix(type: DocumentSequenceType): string {
  switch (type) {
    case "estimate":             return "EST";
    case "work_order":           return "WO";
    case "completion_report":    return "REP";
    case "invoice":              return "INV";
    case "payment":              return "PAY";
    case "maintenance_reminder": return "MNT";
    case "product_order":        return "PO";
    case "reservation":          return "RSV";
    case "monthly_invoice":      return "MIV";
  }
}

/**
 * MONTHLY-DATA-B2: the default reset policy for a NEW sequence row of a given type.
 *
 * Only monthly_invoice defaults to a monthly reset (MIV-YYYY-MM-NNNNN); every existing type keeps
 * its historical "never" default, so this helper cannot change the numbering of any existing type.
 * A stored `document_sequences.reset_policy` still wins when a row already exists — this is only the
 * default used when the row is absent.
 */
export function defaultResetPolicy(type: DocumentSequenceType): DocumentResetPolicy {
  switch (type) {
    case "monthly_invoice":
      return "monthly";
    default:
      return "never";
  }
}

export function sequenceTypeLabel(type: DocumentSequenceType): string {
  switch (type) {
    case "estimate":             return "見積書";
    case "work_order":           return "作業指示書";
    case "completion_report":    return "作業完了報告";
    case "invoice":              return "請求書";
    case "payment":              return "入金";
    case "maintenance_reminder": return "メンテナンス通知";
    case "product_order":        return "商品注文";
    case "reservation":          return "予約";
    case "monthly_invoice":      return "月次請求書";
  }
}

export function resetPolicyLabel(policy: DocumentResetPolicy): string {
  switch (policy) {
    case "never":   return "リセットなし";
    case "yearly":  return "年次リセット";
    case "monthly": return "月次リセット";
  }
}

/**
 * Formats a document number string.
 *
 * e.g. formatDocumentNumber("EST", 1, 5, 2026)   → "EST-2026-00001"
 *      formatDocumentNumber("EST", 1, 5, 0)      → "EST-00001"        (never policy)
 *      formatDocumentNumber("EST", 1, 5, 202606) → "EST-2026-06-00001" (monthly)
 *      formatDocumentNumber("",    1, 5, 0)      → "00001"             (blank prefix)
 *
 * The output is assembled from NON-EMPTY semantic segments joined by "-", so a blank prefix
 * simply contributes no segment. The previous implementation special-cased the blank-prefix
 * branch with a `.replace(/^-/, numStr)`, which substituted the padded number for the leading
 * hyphen and therefore emitted the sequence number TWICE ("00001" → "0000100001") whenever the
 * prefix was empty AND the reset policy was "never" (fiscalYear 0 ⇒ no year segment). That
 * combination is reachable: `document_sequences.prefix` defaults to '' and the settings save path
 * writes `input.prefix.trim()` with no non-empty check, while "never" is the default reset policy.
 *
 * Segment assembly makes leading, trailing and doubled hyphens structurally impossible rather than
 * merely avoided. Stored prefixes are used EXACTLY as given — this function does not trim, default,
 * or otherwise normalize them.
 */
export function formatDocumentNumber(
  prefix:    string,
  number:    number,
  padding:   number,
  fiscalYear: number,
): string {
  const segments: string[] = [];

  if (prefix !== "") segments.push(prefix);

  if (fiscalYear >= 100000) {
    // monthly: YYYYMM → two segments, so the month keeps its own separator.
    segments.push(String(fiscalYear).slice(0, 4));
    segments.push(String(fiscalYear).slice(4).padStart(2, "0"));
  } else if (fiscalYear > 0) {
    // yearly: YYYY
    segments.push(String(fiscalYear));
  }
  // "never" (fiscalYear 0) contributes no date segment.

  segments.push(String(number).padStart(padding, "0"));

  return segments.join("-");
}

/**
 * The canonical clock for document numbering.
 *
 * Document numbers are dealer-facing Japanese business identifiers, so the year/month a number
 * belongs to must be decided in Japan Standard Time — NOT in whatever zone the host happens to run
 * in. `fiscal_year` participates in the UNIQUE (dealer_id, sequence_type, fiscal_year) constraint on
 * `document_sequences`, so a host-local reading would select a DIFFERENT SEQUENCE ROW near a
 * boundary: a Vercel/UTC server would roll the year over at 09:00 JST on 1 January, nine hours
 * after the operator's day did.
 */
export const DOCUMENT_NUMBER_TIME_ZONE = "Asia/Tokyo" as const;

// Built once. `en-CA` yields ISO-ordered numeric parts; only the tagged parts are read, so the
// locale's separators and ordering are irrelevant to the result.
const JST_YEAR_MONTH_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: DOCUMENT_NUMBER_TIME_ZONE,
  year:     "numeric",
  month:    "2-digit",
});

/**
 * The calendar year and 1-based month of `date` AS OBSERVED IN Asia/Tokyo.
 *
 * Uses `formatToParts` with an explicit `timeZone` rather than `Date#getFullYear()`/`getMonth()`,
 * which read the HOST's zone, and rather than `process.env.TZ`, which would make the result depend
 * on ambient process configuration. The value therefore does not change with the machine's timezone.
 */
function tokyoYearMonth(date: Date): { year: number; month: number } {
  let year = 0;
  let month = 0;
  for (const part of JST_YEAR_MONTH_FORMAT.formatToParts(date)) {
    if (part.type === "year")       year = Number(part.value);
    else if (part.type === "month") month = Number(part.value);
  }
  return { year, month };
}

/**
 * Compute the `fiscal_year` value for a given reset policy and date, in Asia/Tokyo.
 *
 *   "never"   → 0        (no reset; a single row per dealer+type)
 *   "yearly"  → YYYY
 *   "monthly" → YYYYMM
 *
 * `date` stays injectable so the boundary behaviour is deterministically testable.
 */
export function computeFiscalYear(policy: DocumentResetPolicy, date: Date = new Date()): number {
  switch (policy) {
    case "never":   return 0;
    case "yearly":  return tokyoYearMonth(date).year;
    case "monthly": {
      const { year, month } = tokyoYearMonth(date);
      return year * 100 + month;
    }
  }
}
