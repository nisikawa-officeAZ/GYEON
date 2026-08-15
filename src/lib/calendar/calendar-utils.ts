// Pure date/time + layout helpers for the calendar views.
//
// LOCAL date semantics only (see Batch A0): never use toISOString() to derive a
// calendar date string — it converts to UTC and, in ahead-of-UTC zones (e.g. JST
// +9), shifts the calendar date back a day ("off-by-one"). These helpers contain
// NO dealer/data access; dealer_id remains sourced from getCurrentDealer() in the
// server layer only.

import { ReservationDB, ReservationStatus } from "@/lib/reservations/reservation-types";

export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addDaysStr(dateStr: string, n: number): string {
  return toLocalDateStr(addDays(parseLocalDate(dateStr), n));
}

/** Today's calendar date in the user's local timezone, as "YYYY-MM-DD". */
export function todayStr(): string {
  return toLocalDateStr(new Date());
}

// ── Time-of-day helpers ──────────────────────────────────────────────────────

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format a "HH:MM:SS" (or "HH:MM") time value as "HH:MM"; empty when nullish. */
export function hm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

/**
 * Human duration of an EXISTING reservation from its start/end times, e.g.
 * "60分", "1時間30分". Returns "" unless both times are present and end > start.
 * This is a pure display of stored values — NOT a service-duration calculation
 * (no default end is fabricated here).
 */
export function durationLabel(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "";
  const mins = timeToMinutes(end) - timeToMinutes(start);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}時間${m}分`;
  if (h) return `${h}時間`;
  return `${m}分`;
}

/** Solid color for a small status indicator dot (color-coded reservation status). */
export function statusDotClass(status: ReservationStatus): string {
  switch (status) {
    case "pending":   return "bg-amber-400";
    case "confirmed": return "bg-emerald-400";
    case "completed": return "bg-sky-300";
    case "cancelled": return "bg-slate-500";
    case "no_show":   return "bg-red-400";
  }
}

// ── Overlap column layout ────────────────────────────────────────────────────
//
// Positions timed reservations that overlap in time side-by-side in columns so
// they stay readable (Batch A3 "improve readability for overlapping visual
// elements"). This is presentation-only: it does NOT detect, warn about, or
// block conflicts (that is deferred). Columns tile the full width exactly, so a
// slot-create button beneath a block remains fully covered (preserves A2).

export interface LaidOutReservation {
  r: ReservationDB;
  startMin: number;
  endMin: number;
  col: number;   // 0-based column index within its overlap cluster
  cols: number;  // total columns in that cluster (peak concurrency)
}

export function layoutOverlaps(
  items: ReservationDB[],
  defaultDurationMin = 60,
): LaidOutReservation[] {
  const evs: LaidOutReservation[] = items
    .filter((r) => r.start_time)
    .map((r) => {
      const startMin = timeToMinutes(r.start_time!);
      const rawEnd = r.end_time ? timeToMinutes(r.end_time) : startMin + defaultDurationMin;
      return { r, startMin, endMin: Math.max(rawEnd, startMin + 10), col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out: LaidOutReservation[] = [];
  let i = 0;
  while (i < evs.length) {
    // Grow a cluster of chain-overlapping events.
    let clusterEnd = evs[i].endMin;
    let j = i + 1;
    while (j < evs.length && evs[j].startMin < clusterEnd) {
      clusterEnd = Math.max(clusterEnd, evs[j].endMin);
      j++;
    }
    const cluster = evs.slice(i, j);

    // Greedy column assignment; reused columns keep peak concurrency == column count.
    const colEnds: number[] = [];
    for (const ev of cluster) {
      let c = colEnds.findIndex((end) => end <= ev.startMin);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(ev.endMin);
      } else {
        colEnds[c] = ev.endMin;
      }
      ev.col = c;
    }
    for (const ev of cluster) ev.cols = colEnds.length;

    out.push(...cluster);
    i = j;
  }
  return out;
}
