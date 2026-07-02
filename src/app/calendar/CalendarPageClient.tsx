"use client";

import { useState, useEffect } from "react";
import { ReservationDB } from "@/lib/reservations/reservation-types";
import { getReservationsByDateRange } from "@/lib/reservations/get-reservations-by-date";
import CalendarMonthView from "@/components/calendar/CalendarMonthView";
import CalendarWeekView from "@/components/calendar/CalendarWeekView";
import CalendarDayView from "@/components/calendar/CalendarDayView";
import ReservationForm from "@/components/reservations/ReservationForm";

type View = "month" | "week" | "day";
type Modal = null | "new" | { reservation: ReservationDB };

interface Props {
  initialReservations: ReservationDB[];
  initialYear: number;
  initialMonth: number;
  customers: Array<{ id: string; last_name: string; first_name: string | null }>;
  vehicles: Array<{
    id: string;
    customer_id: string | null;
    maker: string | null;
    model: string | null;
    plate_number: string | null;
  }>;
}

// A0: All calendar date math uses LOCAL date semantics. toISOString() would convert to
// UTC and, in ahead-of-UTC zones (e.g. JST +9), shift the calendar date back a day
// ("off-by-one"). Format/parse dates via these local helpers instead.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Inclusive [from, to] date range covering the given view around `date`. */
function rangeForView(date: Date, view: View): [string, string] {
  if (view === "month") {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return [`${y}-${pad2(m)}-01`, `${y}-${pad2(m)}-${pad2(lastDay)}`];
  }
  if (view === "week") {
    const ws = getMondayOfWeek(date);
    return [ws, toLocalDateStr(addDays(parseLocalDate(ws), 6))];
  }
  const ds = toLocalDateStr(date);
  return [ds, ds];
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  return toLocalDateStr(d);
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

function formatWeekLabel(weekStart: string): string {
  const d = parseLocalDate(weekStart);
  const end = addDays(d, 6);
  return `${d.getMonth() + 1}/${d.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
}

function formatDayLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function CalendarPageClient({
  initialReservations,
  initialYear,
  initialMonth,
  customers,
  vehicles,
}: Props) {
  const [view, setView] = useState<View>("month");
  const [year,  setYear]  = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<ReservationDB[]>(initialReservations);
  const [modal, setModal] = useState<Modal>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [defaultStartTime, setDefaultStartTime] = useState<string>("");
  const [defaultEndTime,   setDefaultEndTime]   = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Computed values
  const weekStart = getMondayOfWeek(currentDate);
  const dayStr = toLocalDateStr(currentDate);

  // Navigation labels
  const navLabel =
    view === "month" ? formatMonthLabel(year, month) :
    view === "week"  ? formatWeekLabel(weekStart) :
    formatDayLabel(dayStr);

  async function loadReservations(from: string, to: string) {
    setLoading(true);
    try {
      const data = await getReservationsByDateRange(from, to);
      setReservations(data);
    } finally {
      setLoading(false);
    }
  }

  // A4: single date-shift path keeps the focused date consistent across views.
  function shiftDate(dir: -1 | 1) {
    let d: Date;
    if (view === "month") {
      // First-of-month avoids day-overflow (e.g. Jan 31 → Feb) when stepping months.
      d = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
      setYear(d.getFullYear());
      setMonth(d.getMonth() + 1);
    } else if (view === "week") {
      d = addDays(currentDate, dir * 7);
    } else {
      d = addDays(currentDate, dir);
    }
    setCurrentDate(d);
    const [from, to] = rangeForView(d, view);
    loadReservations(from, to);
  }

  function navigatePrev() { shiftDate(-1); }
  function navigateNext() { shiftDate(1); }

  function navigateToday() {
    const d = new Date();
    setCurrentDate(d);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    const [from, to] = rangeForView(d, view);
    loadReservations(from, to);
  }

  // A4: switching views preserves the focused date (currentDate) and reloads that
  // view's range so Month/Week/Day stay in sync.
  function changeView(v: View) {
    if (v === view) return;
    if (v === "month") {
      setYear(currentDate.getFullYear());
      setMonth(currentDate.getMonth() + 1);
    }
    setView(v);
    const [from, to] = rangeForView(currentDate, v);
    loadReservations(from, to);
  }

  // A4: keyboard navigation — ←/→ move prev/next, "t" jumps to today. Ignored while a
  // modal is open or focus is in a form field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modal !== null) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigatePrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navigateNext(); }
      else if (e.key === "t" || e.key === "T") { e.preventDefault(); navigateToday(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate, modal]);

  function handleDayClick(date: string) {
    // Calendar Time-Axis Sprint 1: clicking a date opens that day's time-axis (day) view.
    // (Reservation creation remains available via the "+ 新規予約" button; creating from a
    // selected time slot is a documented future requirement.) date is "YYYY-MM-DD"; A0: parse
    // as LOCAL midnight so toLocalDateStr(currentDate) yields the same date for the day-view
    // filter (no UTC off-by-one).
    setCurrentDate(parseLocalDate(date));
    setView("day");
    loadReservations(date, date);
  }

  function handleSlotClick(startTime: string, endTime: string) {
    // Calendar Time-Axis Sprint 2: open the existing new-reservation modal pre-filled with
    // the current day-view date + the selected slot's start/end time (default 60-min end).
    setDefaultDate(dayStr);
    setDefaultStartTime(startTime);
    setDefaultEndTime(endTime);
    setModal("new");
  }

  function handleReservationClick(r: ReservationDB) {
    setModal({ reservation: r });
  }

  function handleFormSuccess(r: ReservationDB) {
    void r;
    setModal(null);
    // Reload the current view's range (focused date preserved).
    const [from, to] = rangeForView(currentDate, view);
    loadReservations(from, to);
  }

  const modalReservation = modal && typeof modal === "object" && "reservation" in modal
    ? modal.reservation
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-slate-100">カレンダー</h1>
        <button
          onClick={() => { setDefaultDate(""); setDefaultStartTime(""); setDefaultEndTime(""); setModal("new"); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + 新規予約
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            aria-label="前へ"
            className="px-3 py-1.5 min-w-[40px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            ‹
          </button>
          <button
            onClick={navigateToday}
            aria-label="今日へ移動"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            今日
          </button>
          <button
            onClick={navigateNext}
            aria-label="次へ"
            className="px-3 py-1.5 min-w-[40px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
          >
            ›
          </button>
          <span className="text-slate-200 font-medium text-sm ml-2">
            {navLabel}
          </span>
          {loading && <span className="text-xs text-slate-500">読込中...</span>}
        </div>

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1" role="tablist" aria-label="表示切替">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                view === v ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {v === "month" ? "月" : v === "week" ? "週" : "日"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div className="relative bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        {/* Day/Week grids scroll vertically within a bounded height on small screens;
            the month grid sizes to its content. */}
        <div className={view === "month" ? "" : "max-h-[72vh] overflow-y-auto overscroll-contain"}>
          {view === "month" && (
            <CalendarMonthView
              reservations={reservations}
              year={year}
              month={month}
              onDayClick={handleDayClick}
              onReservationClick={handleReservationClick}
            />
          )}
          {view === "week" && (
            <CalendarWeekView
              reservations={reservations}
              weekStart={weekStart}
              onReservationClick={handleReservationClick}
              onDayClick={handleDayClick}
            />
          )}
          {view === "day" && (
            <CalendarDayView
              date={dayStr}
              reservations={reservations.filter((r) => r.reservation_date === dayStr)}
              onReservationClick={handleReservationClick}
              onSlotClick={handleSlotClick}
            />
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0f172a]/50 backdrop-blur-[1px]">
            <span
              className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin"
              role="status"
              aria-label="読込中"
            />
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-100 mb-4">
              {modalReservation ? "予約編集" : "新規予約"}
            </h2>
            <ReservationForm
              reservation={modalReservation}
              customers={customers}
              vehicles={vehicles}
              defaultDate={defaultDate || undefined}
              defaultStartTime={defaultStartTime || undefined}
              defaultEndTime={defaultEndTime || undefined}
              onSuccess={handleFormSuccess}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
