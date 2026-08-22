"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ReservationDB } from "@/lib/reservations/reservation-types";
import { getReservationsByDateRange } from "@/lib/reservations/get-reservations-by-date";
import {
  type BusinessHoursSettings,
  DEFAULT_BUSINESS_HOURS_SETTINGS,
  isClosedDate,
  hoursForDate,
} from "@/lib/dealer-settings/business-hours";
import type { WorkBayOption } from "@/lib/work-bays/work-bay-types";
import type { ReservationStaffOption } from "@/lib/reservations/get-reservation-staff-options";
import { getDayCapacity } from "@/lib/capacity/get-day-capacity";
import { getRangeCapacity } from "@/lib/capacity/get-range-capacity";
import type { CapacityResult, RecommendationLevel } from "@/lib/capacity/capacity-types";
import CalendarCapacityPanel from "@/components/calendar/CalendarCapacityPanel";
import CalendarCapacityLegend, { type CapacityCategory } from "@/components/calendar/CalendarCapacityLegend";
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
  /** B1: store business hours / closed days — reflected visually only (no enforcement). */
  businessHours?: BusinessHoursSettings;
  /** B5a follow-up: dealer-scoped staff id → name for technician display. */
  staffNameById?: Record<string, string>;
  /** PERF-C3: raw dealer-scoped staff options, reused by getRangeCapacity()
      to skip its own duplicate fetch instead of only deriving staffNameById. */
  staffOptions?: ReservationStaffOption[];
  /** B6b: dealer-scoped bay id → name for bay display. */
  bayNameById?: Record<string, string>;
  /** B6b: dealer bays for day-view lanes ([] until migration 092). */
  bays?: WorkBayOption[];
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
  businessHours = DEFAULT_BUSINESS_HOURS_SETTINGS,
  staffNameById = {},
  staffOptions = [],
  bayNameById = {},
  bays = [],
}: Props) {
  const [view, setView] = useState<View>("month");
  const [bayLaneMode, setBayLaneMode] = useState(false);
  const [year,  setYear]  = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [reservations, setReservations] = useState<ReservationDB[]>(initialReservations);
  const [modal, setModal] = useState<Modal>(null);
  const [defaultDate, setDefaultDate] = useState<string>("");
  const [defaultStartTime, setDefaultStartTime] = useState<string>("");
  const [defaultEndTime,   setDefaultEndTime]   = useState<string>("");
  const [loading, setLoading] = useState(false);

  // C1.3: day-capacity display, memoized per date (client cache → no repeat DB calls).
  const capCache = useRef<Map<string, CapacityResult>>(new Map());
  const capReq = useRef(0);
  const [dayCapacity, setDayCapacity] = useState<CapacityResult | null>(null);
  const [capLoading, setCapLoading] = useState(false);

  // C1.4: month/week daily-workload heatmap levels, batched + memoized by range.
  const rangeCache = useRef<Map<string, Record<string, RecommendationLevel>>>(new Map());
  const rangeReq = useRef(0);
  const [rangeLevels, setRangeLevels] = useState<Record<string, RecommendationLevel>>({});

  // Computed values
  const weekStart = getMondayOfWeek(currentDate);
  const dayStr = toLocalDateStr(currentDate);

  // B1: business-hours / closed-day visual reflection (no enforcement).
  const isClosed = (d: string) => isClosedDate(d, businessHours);
  const dayHours = hoursForDate(dayStr, businessHours);

  // B5a follow-up: resolve a technician name for a reservation; null when
  // unassigned or the staff no longer exists (never breaks the UI).
  const staffName = (id?: string | null): string | null => (id && staffNameById[id]) || null;
  // B6b: resolve a bay name for a reservation; null when unassigned/deleted.
  const bayName = (id?: string | null): string | null => (id && bayNameById[id]) || null;
  const activeBays = bays.filter((b) => b.active);

  // C1.3: load day capacity (cached by date). force=true bypasses the cache after edits.
  async function loadDayCapacity(date: string, force = false) {
    if (!force && capCache.current.has(date)) {
      setDayCapacity(capCache.current.get(date)!);
      return;
    }
    const req = ++capReq.current;
    setCapLoading(true);
    try {
      const res = await getDayCapacity(date);
      capCache.current.set(date, res);
      if (capReq.current === req) setDayCapacity(res); // ignore stale responses
    } finally {
      if (capReq.current === req) setCapLoading(false);
    }
  }

  // Compute capacity only for the focused day (day view); clear otherwise.
  useEffect(() => {
    if (view === "day" && dayStr) {
      loadDayCapacity(dayStr);
    } else {
      setDayCapacity(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dayStr]);

  // C1.4: batched range capacity for the month/week heatmap (cached by range key).
  async function loadRangeCapacity(from: string, to: string, force = false) {
    const key = `${from}_${to}`;
    if (!force && rangeCache.current.has(key)) {
      setRangeLevels(rangeCache.current.get(key)!);
      return;
    }
    const req = ++rangeReq.current;
    // PERF-C3: businessHours/bays/staffOptions were already resolved server-side
    // by page.tsx — pass them through so getRangeCapacity() skips its own
    // duplicate fetch for these three (getServiceDurations/getStaffCapacitySettings
    // and the reservations range fetch have no SSR equivalent and still run).
    const res = await getRangeCapacity(from, to, { businessHours, bayOptions: bays, staffOptions });
    const levels: Record<string, RecommendationLevel> = {};
    for (const [d, cap] of Object.entries(res)) levels[d] = cap.level;
    rangeCache.current.set(key, levels);
    if (rangeReq.current === req) setRangeLevels(levels);
  }

  useEffect(() => {
    if (view === "month" || view === "week") {
      const [from, to] = rangeForView(currentDate, view);
      loadRangeCapacity(from, to);
    } else {
      setRangeLevels({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate]);

  const dayLevel = (d: string): RecommendationLevel | null => rangeLevels[d] ?? null;

  // C1.5: heatmap show/hide filter (month/week display only).
  const [capFilter, setCapFilter] = useState<Record<CapacityCategory, boolean>>({
    available: true, limited: true, warning: true, high_load: true, closed: true,
  });
  const toggleCapFilter = (c: CapacityCategory) => setCapFilter((p) => ({ ...p, [c]: !p[c] }));

  // A day is de-emphasized when its category's filter is off (unknown levels stay visible).
  const dayDimmed = (d: string): boolean => {
    if (isClosed(d)) return !capFilter.closed;
    const lvl = dayLevel(d);
    if (!lvl) return false;
    return !capFilter[lvl];
  };

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
    // C1.3: a reservation change can affect capacity (incl. multi-day spans) — drop
    // the cache and recompute the focused day.
    capCache.current.clear();
    rangeCache.current.clear();
    if (view === "day" && dayStr) loadDayCapacity(dayStr, true);
    else {
      const [from, to] = rangeForView(currentDate, view);
      loadRangeCapacity(from, to, true);
    }
  }

  const modalReservation = modal && typeof modal === "object" && "reservation" in modal
    ? modal.reservation
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">カレンダー</h1>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">CALENDAR</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
          <Link
            href="/settings/business-hours"
            className="shrink-0 rounded-xl border border-[#263955] bg-[#111826]/90 px-4 py-2.5 text-sm font-semibold text-[#c3cee2] backdrop-blur-xl transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
          >
            営業時間設定
          </Link>
          <button
            onClick={() => { setDefaultDate(""); setDefaultStartTime(""); setDefaultEndTime(""); setModal("new"); }}
            className="shrink-0 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
          >
            + 新規予約
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            aria-label="前へ"
            className="min-w-[40px] rounded-lg border border-[#263955] bg-[#0d1420] px-3 py-1.5 text-sm text-[#8191ad] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
          >
            ‹
          </button>
          <button
            onClick={navigateToday}
            aria-label="今日へ移動"
            className="rounded-lg border border-[#263955] bg-[#0d1420] px-3 py-1.5 text-sm text-[#8191ad] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
          >
            今日
          </button>
          <button
            onClick={navigateNext}
            aria-label="次へ"
            className="min-w-[40px] rounded-lg border border-[#263955] bg-[#0d1420] px-3 py-1.5 text-sm text-[#8191ad] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
          >
            ›
          </button>
          <span className="ml-2 text-sm font-medium text-[#edf3fc]">
            {navLabel}
          </span>
          {loading && <span className="text-xs text-[#7788a4]">読込中...</span>}
        </div>

        {view === "day" && activeBays.length > 0 && (
          <button
            onClick={() => setBayLaneMode((v) => !v)}
            aria-pressed={bayLaneMode}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              bayLaneMode
                ? "border-[#2f5db8] bg-[#1c4fd6] text-white"
                : "border-[#263955] bg-[#0d1420] text-[#8191ad] hover:bg-[#1a2740] hover:text-[#edf3fc]"
            }`}
          >
            ベイ表示
          </button>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-[#263955] bg-[#0d1420] p-1" role="tablist" aria-label="表示切替">
          {(["month", "week", "day"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => changeView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v ? "bg-[#1c4fd6] text-white" : "text-[#7788a4] hover:text-[#c3cee2]"
              }`}
            >
              {v === "month" ? "月" : v === "week" ? "週" : "日"}
            </button>
          ))}
        </div>
      </div>

      {/* C1.3: workshop capacity panel (day view only) */}
      {view === "day" && (
        <CalendarCapacityPanel capacity={dayCapacity} loading={capLoading} />
      )}

      {/* C1.5: heatmap legend + show/hide filter (month/week only) */}
      {(view === "month" || view === "week") && (
        <CalendarCapacityLegend filter={capFilter} onToggle={toggleCapFilter} />
      )}

      {/* Calendar view */}
      <div className="relative overflow-hidden rounded-2xl border border-[#263955] bg-[#0d1420]">
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
              isClosed={isClosed}
              staffName={staffName}
              bayName={bayName}
              dayLevel={dayLevel}
              dayDimmed={dayDimmed}
            />
          )}
          {view === "week" && (
            <CalendarWeekView
              reservations={reservations}
              weekStart={weekStart}
              onReservationClick={handleReservationClick}
              onDayClick={handleDayClick}
              isClosed={isClosed}
              staffName={staffName}
              bayName={bayName}
              dayLevel={dayLevel}
              dayDimmed={dayDimmed}
            />
          )}
          {view === "day" && (
            <CalendarDayView
              date={dayStr}
              reservations={reservations.filter((r) => r.reservation_date === dayStr)}
              onReservationClick={handleReservationClick}
              onSlotClick={handleSlotClick}
              closed={isClosed(dayStr)}
              openTime={dayHours?.open ?? null}
              closeTime={dayHours?.close ?? null}
              staffName={staffName}
              bayName={bayName}
              bays={activeBays}
              bayLanes={bayLaneMode && activeBays.length > 0}
            />
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d1420]/60 backdrop-blur-[1px]">
            <span
              className="w-6 h-6 rounded-full border-2 border-[#263955] border-t-[#5f9cff] animate-spin"
              role="status"
              aria-label="読込中"
            />
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-3 sm:p-4"
          onClick={() => setModal(null)}
        >
          <div className="fixed inset-0 bg-[#0f172a]/80 backdrop-blur-sm" aria-hidden />
          <div
            className="relative my-4 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#263955] bg-[#111826] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#edf3fc]">
                {modalReservation ? "予約編集" : "新規予約"}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#7788a4] transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
              >
                ✕
              </button>
            </div>
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
