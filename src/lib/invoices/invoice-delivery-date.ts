// DEALEROS-ESTIMATE-INVOICE-PDF-B1-MONTHLY-DATA-B1 (+R1) — pure delivery-date resolution.
//
// invoices.delivery_date (納品日) is authoritative and REQUIRED before issuance. This module owns
// the pure rules that decide it, and it FAILS CLOSED: a source that is PRESENT but INVALID is a
// hard error, never silently replaced by a lower-precedence source, null, issue_date, or the clock.
//
//   1. isValidCalendarDate  — a strict YYYY-MM-DD calendar date (impossible dates rejected).
//   2. parseDeliveryDateField — tri-state (absent / valid / invalid) parse of a date-only field
//        (manual operator input, completion_reports.report_date).
//   3. tokyoDateFromTimestamp — convert a STRICT ISO timestamp (a 'T' separator AND an explicit
//        timezone) to the Asia/Tokyo calendar date. Locale-dependent / space-separated /
//        timezone-less forms are rejected. Anything else → null.
//   4. resolveDeliveryDate — the registered precedence as a discriminated result:
//        valid manual → valid report_date → work-order actual_end_at(Asia/Tokyo) → null.
//        A present-but-invalid source at any level short-circuits to { kind: "invalid" } and NEVER
//        falls through to a lower source.
//
// Rules that never bend: no system clock (Date.now()/argless new Date() are never used); issue_date
// is never an input or a fallback; timestamps convert to the Asia/Tokyo calendar date incl. UTC
// day-boundary cases.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// A strict ISO-8601 timestamp: date, a literal 'T', a time, and an EXPLICIT timezone (Z or ±HH:MM).
// Space separators, locale dates, and timezone-less local times are deliberately excluded.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A strict YYYY-MM-DD calendar date. Rejects malformed strings and impossible dates
 * (e.g. 2026-02-30, 2026-13-01) by round-tripping through a UTC construction.
 */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

// Asia/Tokyo is a fixed UTC+9 offset (no DST); formatToParts gives locale-independent numeric parts.
const TOKYO_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Convert a STRICT ISO timestamp to its Asia/Tokyo calendar date (YYYY-MM-DD), or null.
 *
 * The value MUST have the ISO shape (date + 'T' + time + explicit timezone). Timezone-less,
 * space-separated, and locale-formatted strings are rejected up front so that an instant is never
 * interpreted under an ambiguous or host-locale timezone. A valid instant is projected onto the
 * Tokyo calendar day — so 2026-08-03T20:00:00Z (05:00 JST next day) becomes 2026-08-04.
 */
export function tokyoDateFromTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!ISO_TIMESTAMP.test(trimmed)) return null;

  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;

  const parts = TOKYO_PARTS.formatToParts(new Date(ms));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;

  const iso = `${year}-${month}-${day}`;
  return isValidCalendarDate(iso) ? iso : null;
}

/** Tri-state parse: an authoritative field is absent, a valid calendar date, or invalid. */
export type DateFieldParse =
  | { readonly kind: "absent" }
  | { readonly kind: "valid"; readonly value: string }
  | { readonly kind: "invalid" };

/**
 * Parse a date-only authoritative field (manual input, report_date). Null, undefined and a blank
 * string are ABSENT (the caller may fall through to a lower source). A non-string value or a
 * malformed / impossible calendar date is INVALID (the caller must fail closed).
 */
export function parseDeliveryDateField(value: unknown): DateFieldParse {
  if (value === null || value === undefined) return { kind: "absent" };
  if (typeof value !== "string") return { kind: "invalid" };
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "absent" };
  return isValidCalendarDate(trimmed) ? { kind: "valid", value: trimmed } : { kind: "invalid" };
}

/**
 * Parse a timestamp authoritative field (work_orders.actual_end_at). Null/undefined/blank are
 * ABSENT; a strict ISO timestamp is VALID (carrying its Tokyo calendar date); anything else is
 * INVALID.
 */
export function parseDeliveryTimestampField(value: unknown): DateFieldParse {
  if (value === null || value === undefined) return { kind: "absent" };
  if (typeof value !== "string") return { kind: "invalid" };
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "absent" };
  const tokyo = tokyoDateFromTimestamp(trimmed);
  return tokyo ? { kind: "valid", value: tokyo } : { kind: "invalid" };
}

export interface DeliveryDateSources {
  /** Authorized manual delivery-date input (FormData value; expected YYYY-MM-DD). Highest precedence. */
  manual?: unknown;
  /** completion_reports.report_date (a calendar date) when a completion report is linked. */
  reportDate?: unknown;
  /** work_orders.actual_end_at (a timestamp) when a work order is linked. */
  actualEndAt?: unknown;
}

/**
 * The resolution result. `resolved` carries the delivery date (or null when no source is available
 * and the invoice legitimately stays a draft). `invalid` means a PRESENT source failed validation —
 * the caller must fail closed and must not persist anything.
 */
export type DeliveryDateResolution =
  | { readonly kind: "resolved"; readonly value: string | null }
  | { readonly kind: "invalid" };

/**
 * Resolve the delivery date from the registered source precedence, failing closed. A present-but-
 * invalid source at any level short-circuits to `invalid` and never falls through to a lower source.
 * issue_date is never consulted here or anywhere in this module.
 */
export function resolveDeliveryDate(sources: DeliveryDateSources): DeliveryDateResolution {
  const manual = parseDeliveryDateField(sources.manual);
  if (manual.kind === "invalid") return { kind: "invalid" };
  if (manual.kind === "valid") return { kind: "resolved", value: manual.value };

  const report = parseDeliveryDateField(sources.reportDate);
  if (report.kind === "invalid") return { kind: "invalid" };
  if (report.kind === "valid") return { kind: "resolved", value: report.value };

  const workOrder = parseDeliveryTimestampField(sources.actualEndAt);
  if (workOrder.kind === "invalid") return { kind: "invalid" };
  if (workOrder.kind === "valid") return { kind: "resolved", value: workOrder.value };

  return { kind: "resolved", value: null };
}
