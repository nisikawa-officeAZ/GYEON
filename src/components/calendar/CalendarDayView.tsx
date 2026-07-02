"use client";

import { ReservationDB, serviceTypeColor, serviceTypeLabel, reservationStatusLabel } from "@/lib/reservations/reservation-types";
import { minutesToTime, hm, durationLabel, statusDotClass, layoutOverlaps } from "@/lib/calendar/calendar-utils";

interface Props {
  date: string;
  reservations: ReservationDB[];
  onReservationClick?: (r: ReservationDB) => void;
  /** Calendar Time-Axis Sprint 2: start a new reservation from a clicked available slot. */
  onSlotClick?: (startTime: string, endTime: string) => void;
}

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN   = 20 * 60;
const SLOT_HEIGHT   = 72; // px per 60 min (A1: taller rows improve touch targets + readability)

function minutesToTop(min: number): number {
  return ((min - DAY_START_MIN) / 60) * SLOT_HEIGHT;
}

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8..20

// 30-minute slots across the visible axis: 8:00, 8:30, … 19:30.
const SLOTS = Array.from(
  { length: (DAY_END_MIN - DAY_START_MIN) / 30 },
  (_, i) => DAY_START_MIN + i * 30,
);

/** Short customer display name; falls back to the service label when no customer. */
function displayName(r: ReservationDB): string {
  if (r.customers) {
    const name = [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ");
    if (name) return name;
  }
  return serviceTypeLabel(r.service_type);
}

/** Vehicle summary, e.g. "トヨタ アルファード" — empty string when no vehicle. */
function vehicleSummary(r: ReservationDB): string {
  if (!r.vehicles) return "";
  return [r.vehicles.maker, r.vehicles.model].filter(Boolean).join(" ");
}

export default function CalendarDayView({ date, reservations, onReservationClick, onSlotClick }: Props) {
  const totalHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * SLOT_HEIGHT;

  const timed  = reservations.filter((r) => r.start_time);
  const allDay = reservations.filter((r) => !r.start_time);
  const laid   = layoutOverlaps(timed);
  const isEmpty = reservations.length === 0;

  return (
    <div className="flex flex-col gap-0">
      {/* Legend — distinguish occupied vs available time ranges */}
      <div className="sticky top-0 z-20 flex items-center gap-4 px-3 py-2 bg-[#0f172a]/95 backdrop-blur border-b border-slate-800 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/15 border border-emerald-500/40" />
          空き時間
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
          予約あり（占有）
        </span>
        <span className="ml-auto text-slate-500">{reservations.length} 件</span>
      </div>

      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="border-b border-slate-800 p-2 flex flex-wrap gap-1.5">
          <span className="text-[11px] text-slate-500 self-center mr-1">終日</span>
          {allDay.map((r) => (
            <button
              key={r.id}
              onClick={() => onReservationClick?.(r)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-white font-medium ${serviceTypeColor(r.service_type)} hover:opacity-90 transition-opacity`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(r.status)}`} aria-hidden />
              {displayName(r)}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="relative grid grid-cols-[48px_1fr] sm:grid-cols-[64px_1fr]">
        {/* Time labels */}
        <div className="relative border-r border-slate-800" style={{ height: totalHeight }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-1.5 sm:right-2 text-[10px] sm:text-[11px] tabular-nums text-slate-500 -translate-y-1/2"
              style={{ top: minutesToTop(h * 60) }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Events column — faint tint marks AVAILABLE time; colored blocks below are OCCUPIED */}
        <div className="relative bg-emerald-500/[0.04]" style={{ height: totalHeight }}>
          {/* Alternating hour bands — improve visual separation between hours */}
          {HOURS.slice(0, -1).map((h, i) => (
            <div
              key={`band-${h}`}
              className={`absolute left-0 right-0 ${i % 2 === 1 ? "bg-slate-950/25" : ""}`}
              style={{ top: minutesToTop(h * 60), height: SLOT_HEIGHT }}
            />
          ))}

          {/* Hour lines */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-slate-800"
              style={{ top: minutesToTop(h * 60) }}
            />
          ))}
          {/* Half-hour lines (dashed, fainter) */}
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={`${h}-half`}
              className="absolute left-0 right-0 border-t border-dashed border-slate-800/40"
              style={{ top: minutesToTop(h * 60 + 30) }}
            />
          ))}

          {/* Clickable AVAILABLE time slots — start a new reservation (default 60-min end).
              Rendered beneath the reservation blocks (which carry z-10 and — via exact column
              tiling — cover the full occupied width), so a slot button under an occupied block
              is physically covered and cannot be clicked: clicking a block always edits it, and
              only clicking empty time creates. (No availability/conflict logic — pure layering.) */}
          {onSlotClick && SLOTS.map((slotMin) => (
            <button
              key={`slot-${slotMin}`}
              type="button"
              onClick={() => onSlotClick(minutesToTime(slotMin), minutesToTime(slotMin + 60))}
              title={`${minutesToTime(slotMin)} から新規予約`}
              aria-label={`${minutesToTime(slotMin)} から新規予約`}
              className="group absolute left-0 right-0 hover:bg-emerald-500/10 active:bg-emerald-500/15 transition-colors"
              style={{ top: minutesToTop(slotMin), height: SLOT_HEIGHT / 2 }}
            >
              <span className="opacity-0 group-hover:opacity-100 group-active:opacity-100 text-[10px] font-medium text-emerald-300 absolute left-2 top-1 flex items-center gap-0.5 transition-opacity">
                <span className="text-sm leading-none">＋</span>
                {minutesToTime(slotMin)}
              </span>
            </button>
          ))}

          {/* Reservation blocks — overlapping reservations tile into columns for readability. */}
          {laid.map(({ r, col, cols, startMin, endMin }) => {
            const top    = minutesToTop(Math.max(startMin, DAY_START_MIN));
            const height = Math.max(
              (Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN)) / 60 * SLOT_HEIGHT,
              28
            );
            const widthPct = 100 / cols;
            const veh = vehicleSummary(r);
            const dur = durationLabel(r.start_time, r.end_time);

            return (
              <button
                key={r.id}
                onClick={() => onReservationClick?.(r)}
                title={`${hm(r.start_time)}${r.end_time ? `–${hm(r.end_time)}` : ""}${dur ? ` (${dur})` : ""} ${displayName(r)}`}
                className={`group absolute z-10 rounded-md pl-3 pr-2 py-1 text-left overflow-hidden shadow-sm ring-1 ring-black/20 ${serviceTypeColor(r.service_type)} hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white/60 transition-all`}
                style={{ top, height, left: `${col * widthPct}%`, width: `${widthPct}%` }}
              >
                {/* Brighter left accent bar for quick scanning */}
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-white/40 rounded-l-md" aria-hidden />

                <div className="flex items-start justify-between gap-1">
                  <p className="text-[11px] sm:text-xs text-white/90 font-medium leading-tight tabular-nums truncate">
                    {hm(r.start_time)}
                    {r.end_time && ` – ${hm(r.end_time)}`}
                  </p>
                  {height >= 44 && (
                    <span className="shrink-0 flex items-center gap-1 text-[9px] leading-none px-1.5 py-0.5 rounded-full bg-black/25 text-white/90">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(r.status)}`} aria-hidden />
                      {reservationStatusLabel(r.status)}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-white font-semibold leading-tight truncate">
                  {displayName(r)}
                </p>

                {height >= 56 && (
                  <p className="text-[10px] sm:text-[11px] text-white/75 truncate">
                    {serviceTypeLabel(r.service_type)}
                    {dur && ` · ${dur}`}
                    {veh && ` · ${veh}`}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Empty-state hint — grid stays interactive so users can click a slot to create. */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
            <span className="text-xs text-slate-500 bg-[#0f172a]/80 px-3 py-1.5 rounded-full border border-slate-800">
              この日の予約はありません — 空き枠をクリックして新規作成
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
