"use client";

import { ReservationDB, serviceTypeColor, serviceTypeLabel } from "@/lib/reservations/reservation-types";
import { addDaysStr, todayStr, hm, durationLabel, statusDotClass, layoutOverlaps } from "@/lib/calendar/calendar-utils";

interface Props {
  reservations: ReservationDB[];
  weekStart: string;  // ISO date of Monday
  onReservationClick?: (r: ReservationDB) => void;
  /** A4: clicking a day header jumps to that day's time-axis view. */
  onDayClick?: (date: string) => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => 8 + i * 0.5).filter((h) => h <= 20);
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const DAY_START_MIN = 8 * 60;   // 8:00
const DAY_END_MIN   = 20 * 60;  // 20:00
const SLOT_HEIGHT   = 48;       // px per 60 min

function minutesToTop(min: number): number {
  return ((min - DAY_START_MIN) / 60) * SLOT_HEIGHT;
}

export default function CalendarWeekView({
  reservations,
  weekStart,
  onReservationClick,
  onDayClick,
}: Props) {
  const today = todayStr();

  // Build date strings for Mon-Sun (A0: local date math, no UTC shift)
  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));

  // Separate timed vs all-day reservations
  const timedByDay = new Map<string, ReservationDB[]>();
  const allDayByDay = new Map<string, ReservationDB[]>();

  for (const r of reservations) {
    const key = r.reservation_date;
    if (r.start_time) {
      if (!timedByDay.has(key)) timedByDay.set(key, []);
      timedByDay.get(key)!.push(r);
    } else {
      if (!allDayByDay.has(key)) allDayByDay.set(key, []);
      allDayByDay.get(key)!.push(r);
    }
  }

  const totalHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * SLOT_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-800">
          <div />
          {weekDates.map((date, i) => {
            const day = parseInt(date.slice(8), 10);
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onDayClick?.(date)}
                title={`${date} の予約を表示`}
                className={`py-2 text-center border-l border-slate-800 transition-colors hover:bg-slate-800/40 ${
                  isToday ? "bg-blue-900/20" : ""
                }`}
              >
                <span className={`text-[10px] ${i >= 5 ? "text-blue-400" : "text-slate-400"}`}>
                  {DAY_LABELS[i]}
                </span>
                <span
                  className={`ml-1 text-sm font-medium ${
                    isToday ? "text-blue-400" : "text-slate-200"
                  }`}
                >
                  {day}
                </span>
              </button>
            );
          })}
        </div>

        {/* All-day row */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-slate-800 min-h-[28px]">
          <div className="flex items-center justify-end pr-2">
            <span className="text-[9px] text-slate-600">終日</span>
          </div>
          {weekDates.map((date) => {
            const items = allDayByDay.get(date) ?? [];
            return (
              <div key={date} className="border-l border-slate-800 p-0.5 flex flex-col gap-0.5">
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onReservationClick?.(r)}
                    className={`flex items-center gap-1 w-full text-left px-1 py-0.5 rounded text-[10px] text-white truncate ${serviceTypeColor(r.service_type)}`}
                  >
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDotClass(r.status)}`} aria-hidden />
                    <span className="truncate">
                      {r.customers
                        ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                        : serviceTypeLabel(r.service_type)}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {/* Time labels */}
          <div className="relative" style={{ height: totalHeight }}>
            {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] tabular-nums text-slate-600 -translate-y-1/2"
                style={{ top: minutesToTop(h * 60) }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date) => {
            const items = timedByDay.get(date) ?? [];
            const laid = layoutOverlaps(items);
            const isToday = date === today;

            return (
              <div
                key={date}
                className={`relative border-l border-slate-800 ${isToday ? "bg-blue-900/10" : ""}`}
                style={{ height: totalHeight }}
              >
                {/* Hour lines */}
                {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-800/50"
                    style={{ top: minutesToTop(h * 60) }}
                  />
                ))}
                {/* Half-hour lines */}
                {HOURS.filter((_, i) => i % 2 === 1).map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-800/20"
                    style={{ top: minutesToTop(h * 60) }}
                  />
                ))}

                {/* Reservation blocks — overlapping items tile into columns for readability. */}
                {laid.map(({ r, col, cols, startMin, endMin }) => {
                  const top      = minutesToTop(Math.max(startMin, DAY_START_MIN));
                  const height   = Math.max(
                    (Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN)) / 60 * SLOT_HEIGHT,
                    20
                  );
                  const widthPct = 100 / cols;
                  const dur = durationLabel(r.start_time, r.end_time);

                  return (
                    <button
                      key={r.id}
                      onClick={() => onReservationClick?.(r)}
                      title={`${hm(r.start_time)}${r.end_time ? `–${hm(r.end_time)}` : ""}${dur ? ` (${dur})` : ""} ${
                        r.customers
                          ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                          : serviceTypeLabel(r.service_type)
                      }`}
                      className={`absolute rounded px-1 text-left overflow-hidden ring-1 ring-black/20 ${serviceTypeColor(r.service_type)} hover:brightness-110 transition-all`}
                      style={{ top, height, left: `${col * widthPct}%`, width: `${widthPct}%` }}
                    >
                      <p className="flex items-center gap-1 text-[10px] text-white font-medium leading-tight truncate">
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusDotClass(r.status)}`} aria-hidden />
                        <span className="truncate">
                          {hm(r.start_time)}{" "}
                          {r.customers
                            ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                            : serviceTypeLabel(r.service_type)}
                        </span>
                      </p>
                      {height >= 32 && (
                        <p className="text-[9px] text-white/70 truncate">
                          {serviceTypeLabel(r.service_type)}
                          {dur && ` · ${dur}`}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
