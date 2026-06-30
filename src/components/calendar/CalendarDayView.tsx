"use client";

import { ReservationDB, serviceTypeColor, serviceTypeLabel, reservationStatusLabel } from "@/lib/reservations/reservation-types";

interface Props {
  date: string;
  reservations: ReservationDB[];
  onReservationClick?: (r: ReservationDB) => void;
}

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN   = 20 * 60;
const SLOT_HEIGHT   = 64; // px per 60 min

function minutesToTop(min: number): number {
  return ((min - DAY_START_MIN) / 60) * SLOT_HEIGHT;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8..20

export default function CalendarDayView({ date, reservations, onReservationClick }: Props) {
  const totalHeight = ((DAY_END_MIN - DAY_START_MIN) / 60) * SLOT_HEIGHT;

  const timed  = reservations.filter((r) => r.start_time);
  const allDay = reservations.filter((r) => !r.start_time);

  return (
    <div className="flex flex-col gap-0">
      {/* Legend — distinguish occupied vs available time ranges */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
          空き時間
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
          予約あり（占有）
        </span>
      </div>

      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="border-b border-slate-800 p-2 flex flex-wrap gap-1">
          <span className="text-[10px] text-slate-500 self-center mr-1">終日</span>
          {allDay.map((r) => (
            <button
              key={r.id}
              onClick={() => onReservationClick?.(r)}
              className={`px-2 py-0.5 rounded text-[11px] text-white ${serviceTypeColor(r.service_type)}`}
            >
              {r.customers
                ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                : serviceTypeLabel(r.service_type)}
            </button>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="grid grid-cols-[56px_1fr]">
        {/* Time labels */}
        <div className="relative border-r border-slate-800" style={{ height: totalHeight }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[10px] text-slate-500 -translate-y-1/2"
              style={{ top: minutesToTop(h * 60) }}
            >
              {h}:00
            </div>
          ))}
        </div>

        {/* Events column — faint tint marks AVAILABLE time; colored blocks below are OCCUPIED */}
        <div className="relative bg-emerald-500/5" style={{ height: totalHeight }}>
          {/* Hour lines */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-slate-800"
              style={{ top: minutesToTop(h * 60) }}
            />
          ))}
          {/* Half-hour lines */}
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={`${h}-half`}
              className="absolute left-0 right-0 border-t border-slate-800/30"
              style={{ top: minutesToTop(h * 60 + 30) }}
            />
          ))}

          {/* Reservation blocks */}
          {timed.map((r) => {
            const startMin = timeToMinutes(r.start_time!);
            const endMin   = r.end_time ? timeToMinutes(r.end_time) : startMin + 60;
            const top      = minutesToTop(Math.max(startMin, DAY_START_MIN));
            const height   = Math.max(
              (Math.min(endMin, DAY_END_MIN) - Math.max(startMin, DAY_START_MIN)) / 60 * SLOT_HEIGHT,
              24
            );

            return (
              <button
                key={r.id}
                onClick={() => onReservationClick?.(r)}
                className={`absolute left-1 right-1 rounded-md px-2 text-left overflow-hidden ${serviceTypeColor(r.service_type)} hover:opacity-90 transition-opacity`}
                style={{ top, height }}
              >
                <p className="text-xs text-white font-medium leading-tight truncate">
                  {r.start_time?.slice(0, 5)}
                  {r.end_time && ` – ${r.end_time.slice(0, 5)}`}
                </p>
                <p className="text-xs text-white font-semibold truncate">
                  {r.customers
                    ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                    : serviceTypeLabel(r.service_type)}
                </p>
                {height >= 48 && (
                  <p className="text-[11px] text-white/70 truncate">
                    {serviceTypeLabel(r.service_type)}
                    {r.vehicles && ` · ${[r.vehicles.maker, r.vehicles.model].filter(Boolean).join(" ")}`}
                  </p>
                )}
                {height >= 64 && (
                  <p className="text-[10px] text-white/60">
                    {reservationStatusLabel(r.status)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
