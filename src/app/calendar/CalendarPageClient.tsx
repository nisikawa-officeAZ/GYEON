"use client";

import { useState, useCallback } from "react";
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

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.getMonth() + 1}/${d.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
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
  const [loading, setLoading] = useState(false);

  // Computed values
  const weekStart = getMondayOfWeek(currentDate);
  const dayStr = currentDate.toISOString().slice(0, 10);

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

  function navigatePrev() {
    if (view === "month") {
      const m = month - 1 < 1 ? 12 : month - 1;
      const y = month - 1 < 1 ? year - 1 : year;
      setMonth(m); setYear(y);
      const lastDay = new Date(y, m, 0).getDate();
      loadReservations(
        `${y}-${String(m).padStart(2, "0")}-01`,
        `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      );
    } else if (view === "week") {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
      const from = d.toISOString().slice(0, 10);
      const to   = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
      loadReservations(from, to);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      const ds = d.toISOString().slice(0, 10);
      loadReservations(ds, ds);
    }
  }

  function navigateNext() {
    if (view === "month") {
      const m = month + 1 > 12 ? 1 : month + 1;
      const y = month + 1 > 12 ? year + 1 : year;
      setMonth(m); setYear(y);
      const lastDay = new Date(y, m, 0).getDate();
      loadReservations(
        `${y}-${String(m).padStart(2, "0")}-01`,
        `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      );
    } else if (view === "week") {
      const d = new Date(weekStart + "T00:00:00");
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
      const from = d.toISOString().slice(0, 10);
      const to   = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
      loadReservations(from, to);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      const ds = d.toISOString().slice(0, 10);
      loadReservations(ds, ds);
    }
  }

  function navigateToday() {
    const today = new Date();
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    setCurrentDate(today);
    setYear(y); setMonth(m);
    const lastDay = new Date(y, m, 0).getDate();
    loadReservations(
      `${y}-${String(m).padStart(2, "0")}-01`,
      `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    );
  }

  function handleDayClick(date: string) {
    // Calendar Time-Axis Sprint 1: clicking a date opens that day's time-axis (day) view.
    // (Reservation creation remains available via the "+ 新規予約" button; creating from a
    // selected time slot is a documented future requirement.) date is "YYYY-MM-DD"; parse as
    // UTC midnight so currentDate.toISOString() yields the same date for the day-view filter.
    setCurrentDate(new Date(date + "T00:00:00Z"));
    setView("day");
    loadReservations(date, date);
  }

  function handleReservationClick(r: ReservationDB) {
    setModal({ reservation: r });
  }

  function handleFormSuccess(r: ReservationDB) {
    setModal(null);
    // Reload current view
    if (view === "month") {
      const lastDay = new Date(year, month, 0).getDate();
      loadReservations(
        `${year}-${String(month).padStart(2, "0")}-01`,
        `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
      );
    } else if (view === "week") {
      const from = weekStart;
      const to   = new Date(new Date(weekStart + "T00:00:00").getTime() + 6 * 86400000).toISOString().slice(0, 10);
      loadReservations(from, to);
    } else {
      loadReservations(dayStr, dayStr);
    }
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
          onClick={() => { setDefaultDate(""); setModal("new"); }}
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
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            ‹
          </button>
          <button
            onClick={navigateToday}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            今日
          </button>
          <button
            onClick={navigateNext}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors"
          >
            ›
          </button>
          <span className="text-slate-200 font-medium text-sm ml-2">
            {navLabel}
          </span>
          {loading && <span className="text-xs text-slate-500">読込中...</span>}
        </div>

        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === v ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {v === "month" ? "月" : v === "week" ? "週" : "日"}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
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
          />
        )}
        {view === "day" && (
          <CalendarDayView
            date={dayStr}
            reservations={reservations.filter((r) => r.reservation_date === dayStr)}
            onReservationClick={handleReservationClick}
          />
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
              onSuccess={handleFormSuccess}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
