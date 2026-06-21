"use client";

import { ReservationDB, serviceTypeColor } from "@/lib/reservations/reservation-types";

interface Props {
  reservations: ReservationDB[];
  year: number;
  month: number;  // 1-12
  onDayClick?: (date: string) => void;
  onReservationClick?: (r: ReservationDB) => void;
}

const DAY_HEADERS = ["日", "月", "火", "水", "木", "金", "土"];

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarMonthView({
  reservations,
  year,
  month,
  onDayClick,
  onReservationClick,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // First day of the month (0=Sun, 6=Sat)
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  // Build reservation map keyed by date
  const reservationsByDate = new Map<string, ReservationDB[]>();
  for (const r of reservations) {
    const key = r.reservation_date;
    if (!reservationsByDate.has(key)) reservationsByDate.set(key, []);
    reservationsByDate.get(key)!.push(r);
  }

  // Build grid cells (6 weeks × 7 days = 42 cells)
  type Cell = { dateStr: string; day: number; currentMonth: boolean };
  const cells: Cell[] = [];

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const m = month - 1 === 0 ? 12 : month - 1;
    const y = month - 1 === 0 ? year - 1 : year;
    cells.push({ dateStr: isoDate(y, m, day), day, currentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: isoDate(year, month, d), day: d, currentMonth: true });
  }

  // Next month days to fill the grid
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month + 1 === 13 ? 1 : month + 1;
    const y = month + 1 === 13 ? year + 1 : year;
    cells.push({ dateStr: isoDate(y, m, d), day: d, currentMonth: false });
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-800">
        {DAY_HEADERS.map((h, i) => (
          <div
            key={h}
            className={`py-2 text-center text-xs font-medium ${
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
            }`}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const cellReservations = reservationsByDate.get(cell.dateStr) ?? [];
          const isToday = cell.dateStr === today;
          const colIndex = i % 7;

          return (
            <div
              key={cell.dateStr + i}
              onClick={() => onDayClick?.(cell.dateStr)}
              className={`min-h-[90px] p-1.5 border-b border-r border-slate-800 cursor-pointer transition-colors ${
                cell.currentMonth ? "bg-[#0f172a] hover:bg-[#1e293b]" : "bg-[#0a1020] hover:bg-[#111827]"
              } ${colIndex === 6 ? "border-r-0" : ""}`}
            >
              {/* Date number */}
              <div className="mb-1 flex justify-end">
                <span
                  className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : cell.currentMonth
                      ? colIndex === 0
                        ? "text-red-400"
                        : colIndex === 6
                        ? "text-blue-400"
                        : "text-slate-200"
                      : "text-slate-600"
                  }`}
                >
                  {cell.day}
                </span>
              </div>

              {/* Reservation dots / cards */}
              <div className="flex flex-col gap-0.5">
                {cellReservations.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReservationClick?.(r);
                    }}
                    className={`w-full text-left px-1 py-0.5 rounded text-[10px] text-white truncate ${serviceTypeColor(r.service_type)}`}
                  >
                    {r.start_time ? r.start_time.slice(0, 5) + " " : ""}
                    {r.customers
                      ? [r.customers.last_name, r.customers.first_name].filter(Boolean).join(" ")
                      : r.reservation_number ?? r.id.slice(0, 6)}
                  </button>
                ))}
                {cellReservations.length > 3 && (
                  <span className="text-[9px] text-slate-400 pl-1">
                    +{cellReservations.length - 3}件
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
