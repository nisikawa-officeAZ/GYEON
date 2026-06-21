"use client";

import { ReservationDB, serviceTypeColor, serviceTypeLabel, reservationStatusLabel } from "@/lib/reservations/reservation-types";

interface Props {
  reservations: ReservationDB[];
  weekStart: string;  // ISO date of Monday
  onReservationClick?: (r: ReservationDB) => void;
}

const HOURS = Array.from({ length: 25 }, (_, i) => 8 + i * 0.5).filter((h) => h <= 20);
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

const DAY_START_MIN = 8 * 60;   // 8:00
const DAY_END_MIN   = 20 * 60;  // 20:00
const SLOT_HEIGHT   = 48;       // px per 60 min

function minutesToTop(min: number): number {
  return ((min - DAY_START_MIN) / 60) * SLOT_HEIGHT;
}

function durationToPx(startMin: number, endMin: number): number {
  return ((endMin - startMin) / 60) * SLOT_HEIGHT;
}

export default function CalendarWeekView({
  reservations,
  weekStart,
  onReservationClick,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // Build date strings for Mon-Sun
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
              <div
                key={date}
                className={`py-2 text-center border-l border-slate-800 ${
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
              </div>
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
                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] text-white truncate ${serviceTypeColor(r.service_type)}`}
                  >
                    {r.customers
                      ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                      : serviceTypeLabel(r.service_type)}
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
                className="absolute right-2 text-[10px] text-slate-600 -translate-y-1/2"
                style={{ top: minutesToTop(h * 60) }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, colIdx) => {
            const items = timedByDay.get(date) ?? [];
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

                {/* Reservation blocks */}
                {items.map((r) => {
                  const startMin = timeToMinutes(r.start_time!);
                  const endMin   = r.end_time ? timeToMinutes(r.end_time) : startMin + 60;
                  const top      = minutesToTop(Math.max(startMin, DAY_START_MIN));
                  const height   = Math.max(
                    durationToPx(Math.max(startMin, DAY_START_MIN), Math.min(endMin, DAY_END_MIN)),
                    20
                  );

                  return (
                    <button
                      key={r.id}
                      onClick={() => onReservationClick?.(r)}
                      className={`absolute left-0.5 right-0.5 rounded px-1 text-left overflow-hidden ${serviceTypeColor(r.service_type)} hover:opacity-90 transition-opacity`}
                      style={{ top, height }}
                    >
                      <p className="text-[10px] text-white font-medium leading-tight truncate">
                        {r.start_time?.slice(0, 5)}
                        {" "}
                        {r.customers
                          ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                          : serviceTypeLabel(r.service_type)}
                      </p>
                      {height >= 32 && (
                        <p className="text-[9px] text-white/70 truncate">
                          {serviceTypeLabel(r.service_type)}
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
