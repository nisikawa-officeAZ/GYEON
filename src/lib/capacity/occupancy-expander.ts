// DealerOS — Workshop Capacity occupancy expander (Phase C1.1). Pure — no I/O.
//
// Expands each reservation into per-day occupancy intervals, consuming existing
// B2 service-duration config. Multi-day jobs are derived WITHOUT schema:
//   - days <= 1        → one active same-day interval (+ optional buffer intervals)
//   - days  > 1        → first & last day active, middle days drying (bay held)
// This is an approximation until explicit multi-day occupancy schema (C1.6) lands.

import type { ReservationDB } from "@/lib/reservations/reservation-types";
import type { ServiceDuration, ServiceDurationMap } from "@/lib/dealer-settings/service-durations";
import type { OccupancyInterval } from "./capacity-types";

/** Safety cap on multi-day expansion (also bounds the reservation lookback window). */
export const MAX_MULTIDAY = 30;

function hmToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n); // local date math (no UTC drift)
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dayTypeProfile(days: number): Array<"active" | "drying"> {
  if (days <= 1) return ["active"];
  const p: Array<"active" | "drying"> = ["active"];
  for (let i = 1; i < days - 1; i++) p.push("drying");
  p.push("active");
  return p;
}

function pushBuffers(
  out: OccupancyInterval[],
  r: ReservationDB,
  sMin: number | null,
  eMin: number | null,
  dur: ServiceDuration | undefined,
): void {
  if (sMin === null) return;
  const before = dur?.buffer_before_min ?? null;
  const after = dur?.buffer_after_min ?? null;
  const bayId = r.work_bay_id ?? null;
  if (before && before > 0) {
    out.push({ reservationId: r.id, serviceType: r.service_type, date: r.reservation_date, startMin: sMin - before, endMin: sMin, needsStaff: false, needsBay: true, staffId: null, bayId, dayType: "buffer" });
  }
  if (after && after > 0 && eMin !== null) {
    out.push({ reservationId: r.id, serviceType: r.service_type, date: r.reservation_date, startMin: eMin, endMin: eMin + after, needsStaff: false, needsBay: true, staffId: null, bayId, dayType: "buffer" });
  }
}

export function expandReservation(r: ReservationDB, dur: ServiceDuration | undefined): OccupancyInterval[] {
  const startMin = hmToMin(r.start_time);
  const endMinRaw = hmToMin(r.end_time);
  const days = Math.max(1, Math.min(MAX_MULTIDAY, Math.floor(dur?.days ?? 1)));
  const staffId = r.assigned_staff_id ?? null;
  const bayId = r.work_bay_id ?? null;
  const out: OccupancyInterval[] = [];

  if (days <= 1) {
    let eMin = endMinRaw;
    if (startMin !== null && eMin === null) {
      const h = dur?.hours ?? null;
      eMin = h && h > 0 ? startMin + Math.round(h * 60) : startMin + 60;
    }
    out.push({ reservationId: r.id, serviceType: r.service_type, date: r.reservation_date, startMin, endMin: eMin, needsStaff: true, needsBay: true, staffId, bayId, dayType: "active" });
    pushBuffers(out, r, startMin, eMin, dur);
    return out;
  }

  // Multi-day
  const profile = dayTypeProfile(days);
  for (let i = 0; i < profile.length; i++) {
    const date = addDaysStr(r.reservation_date, i);
    if (profile[i] === "active") {
      const isFirst = i === 0;
      const sMin = isFirst ? startMin : null;         // non-first active days = all-day
      let eMin: number | null = isFirst ? endMinRaw : null;
      if (isFirst && sMin !== null && eMin === null) {
        const h = dur?.hours ?? null;
        eMin = h && h > 0 ? sMin + Math.round(h * 60) : null; // null → remainder of window
      }
      out.push({ reservationId: r.id, serviceType: r.service_type, date, startMin: sMin, endMin: eMin, needsStaff: true, needsBay: true, staffId, bayId, dayType: "active" });
      if (isFirst) pushBuffers(out, r, sMin, eMin, dur);
    } else {
      out.push({ reservationId: r.id, serviceType: r.service_type, date, startMin: null, endMin: null, needsStaff: false, needsBay: true, staffId: null, bayId, dayType: "drying" });
    }
  }
  return out;
}

export function expandReservations(
  reservations: ReservationDB[],
  durations: ServiceDurationMap,
): OccupancyInterval[] {
  const all: OccupancyInterval[] = [];
  for (const r of reservations) all.push(...expandReservation(r, durations[r.service_type]));
  return all;
}

export function intervalsForDate(intervals: OccupancyInterval[], date: string): OccupancyInterval[] {
  return intervals.filter((iv) => iv.date === date);
}
