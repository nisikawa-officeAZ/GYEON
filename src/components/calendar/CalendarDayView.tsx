"use client";

import { ReservationDB, serviceTypeColor, serviceTypeLabel, reservationStatusLabel } from "@/lib/reservations/reservation-types";
import { minutesToTime, timeToMinutes, hm, durationLabel, statusDotClass, layoutOverlaps } from "@/lib/calendar/calendar-utils";
import type { WorkBayOption } from "@/lib/work-bays/work-bay-types";

interface Props {
  date: string;
  reservations: ReservationDB[];
  onReservationClick?: (r: ReservationDB) => void;
  /** Calendar Time-Axis Sprint 2: start a new reservation from a clicked available slot. */
  onSlotClick?: (startTime: string, endTime: string) => void;
  /** B1: store closed day — visual only, slots remain clickable (no enforcement). */
  closed?: boolean;
  /** B1: business-hours open/close ("HH:MM") for this date; null shades nothing. */
  openTime?: string | null;
  closeTime?: string | null;
  /** B5a follow-up: resolve assigned technician name; null when none/deleted. */
  staffName?: (id?: string | null) => string | null;
  /** B6b: resolve assigned bay name; null when none/deleted. */
  bayName?: (id?: string | null) => string | null;
  /** B6b: active bays for lane display. */
  bays?: WorkBayOption[];
  /** B6b: render per-bay lanes instead of a single column. */
  bayLanes?: boolean;
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

export default function CalendarDayView({ date, reservations, onReservationClick, onSlotClick, closed = false, openTime = null, closeTime = null, staffName, bayName, bays = [], bayLanes = false }: Props) {
  const totalHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * SLOT_HEIGHT;

  const timed  = reservations.filter((r) => r.start_time);
  const allDay = reservations.filter((r) => !r.start_time);
  const laid   = layoutOverlaps(timed);
  const isEmpty = reservations.length === 0;

  // B1: clamp business-hours to the visible axis for non-open shading (visual only).
  const openMin  = openTime  ? Math.min(Math.max(timeToMinutes(openTime),  DAY_START_MIN), DAY_END_MIN) : null;
  const closeMin = closeTime ? Math.min(Math.max(timeToMinutes(closeTime), DAY_START_MIN), DAY_END_MIN) : null;

  // B6b: per-bay lane view (day only). Display mode — creation stays in the
  // standard view / "+ 新規予約" button.
  if (bayLanes && bays.length > 0) {
    const laneDefs: Array<{ id: string | null; name: string }> = [
      ...bays.map((b) => ({ id: b.id as string | null, name: b.name })),
      { id: null, name: "未割当" },
    ];
    const gridCols = `48px repeat(${laneDefs.length}, minmax(120px,1fr))`;
    return (
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400">
          作業ベイ別表示
          <span className="ml-auto text-slate-500">{reservations.length} 件</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            {/* Lane headers */}
            <div className="grid border-b border-slate-800" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {laneDefs.map((lane) => (
                <div key={lane.id ?? "none"} className="py-2 px-1 text-center text-[11px] text-slate-300 border-l border-slate-800 truncate">
                  {lane.name}
                </div>
              ))}
            </div>
            {/* Lane grid */}
            <div className="grid" style={{ gridTemplateColumns: gridCols }}>
              <div className="relative" style={{ height: totalHeight }}>
                {HOURS.map((h) => (
                  <div key={h} className="absolute right-2 text-[10px] tabular-nums text-slate-500 -translate-y-1/2" style={{ top: minutesToTop(h * 60) }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {laneDefs.map((lane) => {
                const laneLaid = layoutOverlaps(timed.filter((r) => (r.work_bay_id ?? null) === lane.id));
                return (
                  <div key={lane.id ?? "none"} className="relative border-l border-slate-800" style={{ height: totalHeight }}>
                    {HOURS.map((h) => (
                      <div key={h} className="absolute left-0 right-0 border-t border-slate-800/60" style={{ top: minutesToTop(h * 60) }} />
                    ))}
                    {laneLaid.map(({ r, col, cols, startMin, endMin }) => {
                      const top = minutesToTop(Math.max(startMin, DAY_START_MIN));
                      const heightPx = Math.max((Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN)) / 60 * SLOT_HEIGHT, 24);
                      const widthPct = 100 / cols;
                      const tech = staffName?.(r.assigned_staff_id) ?? null;
                      return (
                        <button
                          key={r.id}
                          onClick={() => onReservationClick?.(r)}
                          title={`${hm(r.start_time)}${r.end_time ? `–${hm(r.end_time)}` : ""} ${displayName(r)}`}
                          className={`absolute z-10 rounded-md px-1.5 py-0.5 text-left overflow-hidden ring-1 ring-black/20 ${serviceTypeColor(r.service_type)} hover:brightness-110 transition-all`}
                          style={{ top, height: heightPx, left: `${col * widthPct}%`, width: `${widthPct}%` }}
                        >
                          <p className="text-[10px] text-white/90 font-medium leading-tight tabular-nums truncate">{hm(r.start_time)}</p>
                          <p className="text-[11px] text-white font-semibold leading-tight truncate">{displayName(r)}</p>
                          {heightPx >= 44 && tech && <p className="text-[9px] text-white/75 truncate">{tech}</p>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      {/* B1: closed-day / business-hours notice (visual only — no booking restriction) */}
      {closed ? (
        <div className="px-3 py-1.5 bg-slate-900/70 border-b border-slate-800 text-[11px] text-slate-400">
          定休日（予約の作成は可能です）
        </div>
      ) : (openTime && closeTime) ? (
        <div className="px-3 py-1.5 bg-slate-900/40 border-b border-slate-800 text-[11px] text-slate-500">
          営業時間 {openTime}–{closeTime}
        </div>
      ) : null}

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

          {/* B1: shade non-business hours (before open / after close), or the whole day when
              closed. Visual only + pointer-events-none, so slot-create remains available. */}
          {closed ? (
            <div className="pointer-events-none absolute inset-0 bg-slate-950/45" aria-hidden />
          ) : (
            <>
              {openMin !== null && openMin > DAY_START_MIN && (
                <div
                  className="pointer-events-none absolute left-0 right-0 bg-slate-950/35"
                  style={{ top: 0, height: minutesToTop(openMin) }}
                  aria-hidden
                />
              )}
              {closeMin !== null && closeMin < DAY_END_MIN && (
                <div
                  className="pointer-events-none absolute left-0 right-0 bg-slate-950/35"
                  style={{ top: minutesToTop(closeMin), height: totalHeight - minutesToTop(closeMin) }}
                  aria-hidden
                />
              )}
            </>
          )}

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
            const tech = staffName?.(r.assigned_staff_id) ?? null;
            const bay = bayName?.(r.work_bay_id) ?? null;

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

                {tech && height >= 44 && (
                  <p className="text-[10px] sm:text-[11px] text-white/80 truncate">担当: {tech}</p>
                )}
                {bay && height >= 56 && (
                  <p className="text-[10px] sm:text-[11px] text-white/70 truncate">ベイ: {bay}</p>
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
