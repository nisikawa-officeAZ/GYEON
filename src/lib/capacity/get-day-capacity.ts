"use server";

// DealerOS — Workshop Capacity: getDayCapacity(date) (Phase C1.1).
//
// Thin server action: loads existing dealer-scoped config (B1 hours, B2 durations,
// B3 scheduling, B6b bays) + reservations, then delegates to the PURE capacity
// core. dealer_id is resolved server-side via getCurrentDealer() — never from
// client. Read-only, soft — produces a score/level, never blocks. No schema.

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
import { isHeavyService } from "./service-classification";
import type { CapacityResult } from "./capacity-types";
import type { ReservationDB, ReservationServiceType } from "@/lib/reservations/reservation-types";

/** Optional candidate reservation to include in a projected capacity preview. */
export interface CandidateOccupancy {
  start: string | null;   // "HH:MM"
  end: string | null;
  service_type: ReservationServiceType;
  staffId?: string | null;
  bayId?: string | null;
}

export interface DayCapacityOptions {
  /** Exclude this reservation (the one being edited) from the current load. */
  excludeReservationId?: string | null;
  /** Add a not-yet-saved reservation so the score reflects "if I book this". */
  candidate?: CandidateOccupancy | null;
}

// Statuses that consume workshop capacity.
const CAPACITY_STATUSES = new Set(["pending", "confirmed", "completed"]);

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

function emptyClosed(date: string): CapacityResult {
  return {
    date,
    closed: true,
    operatingMinutes: 0,
    workshop: { peak: 0, avg: 0 },
    staff: { peak: 0, avg: 0, cap: null },
    bay: { peak: 0, avg: 0, cap: null },
    vehicle: { peak: 0, avg: 0, cap: null },
    bottleneck: null,
    level: "available",
    confidence: "estimated",
    reservationCount: 0,
  };
}

export async function getDayCapacity(date: string, opts?: DayCapacityOptions): Promise<CapacityResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return emptyClosed(date);
  const dealer = await getCurrentDealer();
  if (!dealer) return emptyClosed(date);

  try {
    const [businessHours, durations, scheduling, bays, staffOpts] = await Promise.all([
      getBusinessHoursSettings(),
      getServiceDurations(),
      getStaffCapacitySettings(),
      getBayOptions(),
      getReservationStaffOptions(),
    ]);

    // Reservations whose occupancy could reach `date` (multi-day jobs starting earlier).
    const from = addDaysStr(date, -MAX_MULTIDAY);
    let reservations = (await getReservationsByDateRange(from, date)).filter((r) =>
      CAPACITY_STATUSES.has(r.status),
    );

    // Exclude the edited reservation, then optionally add the candidate so the
    // preview reflects the projected load "if I book this".
    if (opts?.excludeReservationId) {
      reservations = reservations.filter((r) => r.id !== opts.excludeReservationId);
    }
    if (opts?.candidate) {
      const c = opts.candidate;
      reservations = [
        ...reservations,
        {
          id: "__candidate__",
          reservation_date: date,
          start_time: c.start,
          end_time: c.end,
          service_type: c.service_type,
          assigned_staff_id: c.staffId ?? null,
          work_bay_id: c.bayId ?? null,
          status: "pending",
        } as unknown as ReservationDB,
      ];
    }

    const dh = hoursForDate(date, businessHours);
    const closed = isClosedDate(date, businessHours);
    const openMin = dh ? hmToMin(dh.open) : null;
    const closeMin = dh ? hmToMin(dh.close) : null;
    const operatingWindow =
      openMin !== null && closeMin !== null && closeMin > openMin ? { openMin, closeMin } : null;

    // Bookable staff (default bookable when no per-staff entry).
    const staffCapMap = scheduling.staff_capacity;
    const bookableStaffCount =
      staffOpts.filter((s) => {
        const e = staffCapMap[s.id];
        return e ? e.bookable !== false : true;
      }).length || null;

    // Bay capacity total — prefer the work_bays table (B6b); fall back to B3 jsonb bays.
    let bayCapacityTotal: number | null = null;
    const activeBays = bays.filter((b) => b.active);
    if (activeBays.length) {
      bayCapacityTotal = activeBays.reduce((a, b) => a + (b.capacity || 1), 0);
    } else {
      const jsonbBays = scheduling.capacity.work_bays.filter((b) => b.active);
      if (jsonbBays.length) bayCapacityTotal = jsonbBays.reduce((a, b) => a + (b.capacity ?? 1), 0);
    }

    const vehicleCap = scheduling.capacity.simultaneous_vehicles ?? null;

    const intervals = intervalsForDate(expandReservations(reservations, durations), date);

    const result = computeDayCapacity({
      date,
      operatingWindow,
      closed,
      intervals,
      bookableStaffCount,
      bayCapacityTotal,
      vehicleCap,
    });

    // C2.6: day context for the recommendation engine.
    return {
      ...result,
      dayContext: {
        services: Array.from(new Set(intervals.map((iv) => iv.serviceType))),
        dryingActive: intervals.some((iv) => iv.dayType === "drying"),
        heavyActive: intervals.some((iv) => iv.dayType === "active" && isHeavyService(iv.serviceType)),
        bufferActive: intervals.some((iv) => iv.dayType === "buffer"),
      },
    };
  } catch (err) {
    console.warn("[getDayCapacity] failed — returning empty:", err);
    return emptyClosed(date);
  }
}
