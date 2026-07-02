// DealerOS — Store Business Hours foundation (Batch B1).
//
// Pure types + helpers, NO data access and NO "use server" — safe to import from
// both server actions and client components.
//
// Persistence reuses EXISTING dealer_settings columns only (no schema change,
// no migration):
//   - business_days   jsonb      → BusinessHoursConfig (weekly hours + special-open days)
//   - closed_weekdays integer[]  → regular weekly closed days (0=Sun..6=Sat)
//   - temp_holidays   jsonb      → temporary closed dates (YYYY-MM-DD[])
//
// dealer_id is NEVER part of these structures; it is resolved server-side from
// getCurrentDealer() in the save/read action.

export interface DayHours {
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
}

export interface BusinessHoursConfig {
  /** Default open/close applied to any open weekday without a specific override. */
  default_hours: DayHours | null;
  /** Optional per-weekday hours override, keyed "0".."6" (0=Sun). */
  weekday_hours: Record<string, DayHours>;
  /** Dates (YYYY-MM-DD) that are OPEN even though their weekday is a closed day. */
  special_open_days: string[];
}

export interface BusinessHoursSettings {
  business_hours: BusinessHoursConfig;
  closed_weekdays: number[];   // 0=Sun..6=Sat
  temp_holidays: string[];     // YYYY-MM-DD
}

export const DEFAULT_BUSINESS_HOURS_CONFIG: BusinessHoursConfig = {
  default_hours: null,
  weekday_hours: {},
  special_open_days: [],
};

export const DEFAULT_BUSINESS_HOURS_SETTINGS: BusinessHoursSettings = {
  business_hours: DEFAULT_BUSINESS_HOURS_CONFIG,
  closed_weekdays: [],
  temp_holidays: [],
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(t: unknown): t is string {
  return typeof t === "string" && TIME_RE.test(t);
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && DATE_RE.test(s);
}

/** Defensively normalize an unknown jsonb value into a BusinessHoursConfig. */
export function normalizeBusinessHoursConfig(raw: unknown): BusinessHoursConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BUSINESS_HOURS_CONFIG, weekday_hours: {}, special_open_days: [] };
  const o = raw as Record<string, unknown>;

  let default_hours: DayHours | null = null;
  const dh = o.default_hours as Record<string, unknown> | undefined | null;
  if (dh && typeof dh === "object" && isValidTime(dh.open) && isValidTime(dh.close)) {
    default_hours = { open: dh.open, close: dh.close };
  }

  const weekday_hours: Record<string, DayHours> = {};
  const wh = o.weekday_hours;
  if (wh && typeof wh === "object") {
    for (const k of Object.keys(wh as Record<string, unknown>)) {
      if (!/^[0-6]$/.test(k)) continue;
      const v = (wh as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
      if (v && typeof v === "object" && isValidTime(v.open) && isValidTime(v.close)) {
        weekday_hours[k] = { open: v.open, close: v.close };
      }
    }
  }

  const special_open_days = Array.isArray(o.special_open_days)
    ? (o.special_open_days as unknown[]).filter(isValidDateStr)
    : [];

  return { default_hours, weekday_hours, special_open_days };
}

/** Weekday index for a "YYYY-MM-DD" date, 0=Sun..6=Sat (local). */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/**
 * Whether a date is a closed day: closed if its weekday is a regular closed
 * weekday OR it is a temporary holiday — UNLESS it is explicitly a special-open day.
 */
export function isClosedDate(dateStr: string, s: BusinessHoursSettings): boolean {
  if (s.business_hours.special_open_days.includes(dateStr)) return false;
  if (s.temp_holidays.includes(dateStr)) return true;
  return s.closed_weekdays.includes(weekdayOf(dateStr));
}

/** Effective open/close for a date; null when closed or no hours are configured. */
export function hoursForDate(dateStr: string, s: BusinessHoursSettings): DayHours | null {
  if (isClosedDate(dateStr, s)) return null;
  const wd = String(weekdayOf(dateStr));
  return s.business_hours.weekday_hours[wd] ?? s.business_hours.default_hours;
}
