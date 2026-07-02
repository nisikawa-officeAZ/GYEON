"use server";

// DealerOS — Workshop Capacity: getRangeCapacity(from, to) (Phase C1.4).
//
// Batched: loads dealer-scoped config + reservations ONCE, expands occupancy
// ONCE, then computes each day via the pure core. Avoids N× round-trips that a
// per-day getDayCapacity loop would incur. Read-only, soft, no schema.
//
// dealer_id resolved server-side via getCurrentDealer(); never from client.

import { getCurrentDealer }         from "@/lib/auth/get-current-dealer";
import { getBusinessHoursSettings } from "@/lib/dealer-settings/save-business-hours";
import { getServiceDurations }      from "@/lib/dealer-settings/save-service-durations";
import { getStaffCapacitySettings } from "@/lib/dealer-settings/save-staff-capacity";
import { getBayOptions }            from "@/lib/work-bays/get-work-bays";
import { getReservationStaffOptions } from "@/lib/reservations/get-reservation-staff-options";
import { getReservationsByDateRange } from "@/lib/reservations/get-reservations-by-date";
import { hoursForDate, isClosedDate } from "@/lib/dealer-settings/business-hours";
import { expandReservations, intervalsForDate, MAX_MULTIDAY } from "./occupancy-expander";
import { computeDayCapacity } from "./capacity-calculator";
import type { CapacityResult } from "./capacity-types";

const CAPACITY_STATUSES = new Set(["pending", "confirmed", "completed"]);
const RANGE_MAX_DAYS = 45; // month grid (~42) + margin

function hmToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function datesInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  let d = from;
  let guard = 0;
  while (d <= to && guard < 400) {
    out.push(d);
    d = addDaysStr(d, 1);
    guard++;
  }
  return out;
}

export async function getRangeCapacity(
  from: string,
  to: string,
): Promise<Record<string, CapacityResult>> {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(from ?? "") || !dateRe.test(to ?? "") || to < from) return {};
  const dealer = await getCurrentDealer();
  if (!dealer) return {};

  try {
    // Clamp the requested range to a safe maximum.
    let end = to;
    const all = datesInclusive(from, to);
    if (all.length > RANGE_MAX_DAYS) end = addDaysStr(from, RANGE_MAX_DAYS - 1);
    const days = datesInclusive(from, end);

    const [businessHours, durations, scheduling, bays, staffOpts] = await Promise.all([
      getBusinessHoursSettings(),
      getServiceDurations(),
      getStaffCapacitySettings(),
      getBayOptions(),
      getReservationStaffOptions(),
    ]);

    // One reservation fetch covering multi-day jobs that start before `from`.
    const fetchFrom = addDaysStr(from, -MAX_MULTIDAY);
    const reservations = (await getReservationsByDateRange(fetchFrom, end)).filter((r) =>
      CAPACITY_STATUSES.has(r.status),
    );

    // Capacities (constant across the range).
    const staffCapMap = scheduling.staff_capacity;
    const bookableStaffCount =
      staffOpts.filter((s) => {
        const e = staffCapMap[s.id];
        return e ? e.bookable !== false : true;
      }).length || null;

    let bayCapacityTotal: number | null = null;
    const activeBays = bays.filter((b) => b.active);
    if (activeBays.length) {
      bayCapacityTotal = activeBays.reduce((a, b) => a + (b.capacity || 1), 0);
    } else {
      const jsonbBays = scheduling.capacity.work_bays.filter((b) => b.active);
      if (jsonbBays.length) bayCapacityTotal = jsonbBays.reduce((a, b) => a + (b.capacity ?? 1), 0);
    }
    const vehicleCap = scheduling.capacity.simultaneous_vehicles ?? null;

    const allIntervals = expandReservations(reservations, durations);

    const out: Record<string, CapacityResult> = {};
    for (const date of days) {
      const dh = hoursForDate(date, businessHours);
      const closed = isClosedDate(date, businessHours);
      const openMin = dh ? hmToMin(dh.open) : null;
      const closeMin = dh ? hmToMin(dh.close) : null;
      const operatingWindow =
        openMin !== null && closeMin !== null && closeMin > openMin ? { openMin, closeMin } : null;

      out[date] = computeDayCapacity({
        date,
        operatingWindow,
        closed,
        intervals: intervalsForDate(allIntervals, date),
        bookableStaffCount,
        bayCapacityTotal,
        vehicleCap,
      });
    }
    return out;
  } catch (err) {
    console.warn("[getRangeCapacity] failed — returning empty:", err);
    return {};
  }
}
