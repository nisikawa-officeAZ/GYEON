import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GDA_UI_RESERVATIONS_CALENDAR_S6 — source-contract guard.
//
// The /calendar and /reservations surfaces adopt the accepted TOP v18
// presentation (deep navy/black, glass cards, thin blue borders, large
// controlled radii, restrained GYEON blue) established by the customers/
// vehicles (S4), estimates/work-orders (S5), and maintenance (S5 follow-up)
// conversions. This test reads source files as text and asserts the TOP v18
// tokens are present on headers/cards/tabs/modals/empty states/primary
// actions, that ReservationTable ships a desktop table + mobile card
// presentation, that the calendar's structurally wide day/week grids retain
// bounded internal scrolling, and that every frozen route/prop/callback/
// capacity token is unchanged. It does not render React and does not touch
// business data, permissions, or the database.

const ROOT = process.cwd();
const read = (relPath: string) => readFileSync(join(ROOT, relPath), "utf8");

// The exact eight-path literal allowlist for GDA_UI_RESERVATIONS_CALENDAR_S6_IMPLEMENTATION_V1.
// This file is path 8; the other seven are read below.
const PHASE_ALLOWLIST = [
  "src/app/calendar/CalendarPageClient.tsx",
  "src/components/calendar/CalendarMonthView.tsx",
  "src/components/calendar/CalendarWeekView.tsx",
  "src/components/calendar/CalendarDayView.tsx",
  "src/app/reservations/ReservationsPageClient.tsx",
  "src/components/reservations/ReservationTable.tsx",
  "src/components/reservations/ReservationForm.tsx",
  "src/lib/navigation/gda-reservations-calendar-ui.test.ts",
] as const;

const CALENDAR_PAGE   = read(PHASE_ALLOWLIST[0]);
const MONTH_VIEW      = read(PHASE_ALLOWLIST[1]);
const WEEK_VIEW       = read(PHASE_ALLOWLIST[2]);
const DAY_VIEW        = read(PHASE_ALLOWLIST[3]);
const RESERVATIONS_PAGE = read(PHASE_ALLOWLIST[4]);
const RESERVATION_TABLE = read(PHASE_ALLOWLIST[5]);
const RESERVATION_FORM  = read(PHASE_ALLOWLIST[6]);

test("phase scope contract: exactly eight literal paths, this test file included", () => {
  assert.equal(PHASE_ALLOWLIST.length, 8);
  assert.equal(new Set(PHASE_ALLOWLIST).size, 8, "no duplicate paths in the allowlist");
  assert.ok(
    PHASE_ALLOWLIST.includes("src/lib/navigation/gda-reservations-calendar-ui.test.ts" as (typeof PHASE_ALLOWLIST)[number]),
    "this test file is itself the eighth allowlisted path"
  );
});

test("protected ScreensPreview.tsx path is never referenced by the S6 surfaces", () => {
  for (const src of [CALENDAR_PAGE, MONTH_VIEW, WEEK_VIEW, DAY_VIEW, RESERVATIONS_PAGE, RESERVATION_TABLE, RESERVATION_FORM]) {
    assert.doesNotMatch(src, /ScreensPreview/);
  }
});

// --- TOP v18 tokens on headers, cards, tabs, modals, empty states, primary actions ---

test("calendar and reservations pages carry the TOP v18 page-header pattern (JA title + EN eyebrow)", () => {
  for (const src of [CALENDAR_PAGE, RESERVATIONS_PAGE]) {
    assert.match(src, /text-\[20px\] font-bold text-\[#edf3fc\] md:text-\[22px\]/);
    assert.match(src, /text-\[10px\] font-semibold tracking-\[0\.22em\] text-\[#7788a4\]/);
  }
});

test("calendar and reservations pages carry the TOP v18 glass-card and primary-action tokens", () => {
  for (const src of [CALENDAR_PAGE, RESERVATIONS_PAGE]) {
    assert.match(src, /border-\[#263955\]/);
    assert.match(src, /bg-\[#111826\]\/90/);
    assert.match(src, /backdrop-blur-xl/);
    // Primary action button (GYEON blue): border-[#2f5db8] bg-[#1c4fd6] ... hover:bg-[#1a45bd]
    assert.match(src, /border-\[#2f5db8\] bg-\[#1c4fd6\]/);
    assert.match(src, /hover:bg-\[#1a45bd\]/);
  }
});

test("calendar view-switch and reservation status tabs use TOP v18 segmented-control tokens", () => {
  assert.match(CALENDAR_PAGE, /role="tablist" aria-label="表示切替"/);
  assert.match(CALENDAR_PAGE, /view === v \? "bg-\[#1c4fd6\] text-white" : "text-\[#7788a4\] hover:text-\[#c3cee2\]"/);
  assert.match(RESERVATIONS_PAGE, /activeTab === t\.value\s*\n?\s*\?\s*"bg-\[#1c4fd6\] text-white"/);
});

test("calendar and reservations modal shells use the shared TOP v18 modal chrome and a close control", () => {
  for (const src of [CALENDAR_PAGE, RESERVATIONS_PAGE]) {
    assert.match(src, /bg-\[#0f172a\]\/80 backdrop-blur-sm/);
    assert.match(src, /rounded-2xl border border-\[#263955\] bg-\[#111826\]/);
    assert.match(src, /aria-label="閉じる"/);
    assert.match(src, /overscroll-contain/);
  }
});

test("ReservationTable consumes the shared TOP v18 empty-state pattern", () => {
  assert.match(RESERVATION_TABLE, /from "@\/components\/ui\/GdaOperationalListSurface"/);
  assert.match(RESERVATION_TABLE, /GdaOperationalListEmptyState/);
  assert.match(RESERVATION_TABLE, /messageJa="予約がありません"/);
});

// --- ReservationTable: desktop table + mobile card presentation ---

test("ReservationTable ships both a desktop table and a mobile card presentation", () => {
  assert.match(RESERVATION_TABLE, /hidden md:block/);
  assert.match(RESERVATION_TABLE, /md:hidden/);
  assert.match(RESERVATION_TABLE, /overflow-x-auto/);
  assert.match(RESERVATION_TABLE, /min-h-\[44px\]/);
});

test("every row action (confirm / work-order / estimate / cancel) exists in both the desktop table and the mobile cards", () => {
  for (const marker of ["確定", "施工指示作成", "見積を作成", "キャンセル"]) {
    const count = RESERVATION_TABLE.split(marker).length - 1;
    assert.ok(count >= 2, `expected "${marker}" to appear in both desktop and mobile presentations, found ${count}`);
  }
});

test("reservation status label and color are rendered identically in both presentations (frozen status color)", () => {
  const count = RESERVATION_TABLE.split("reservationStatusColor(r.status)").length - 1;
  assert.ok(count >= 2, "reservationStatusColor(r.status) must drive the badge in both the table row and the mobile card");
});

// --- No body-level horizontal overflow on 375px; calendar internal-scroll preservation ---

test("calendar and reservations page shells use a responsive, non-overflowing container", () => {
  for (const src of [CALENDAR_PAGE, RESERVATIONS_PAGE]) {
    assert.match(src, /mx-auto flex w-full max-w-7xl flex-col/);
  }
});

test("calendar page shell does not force an unbounded min-width outside the bounded-scroll grid views", () => {
  // The page-level shell (header/controls/modal) only carries small,
  // touch-target min-widths (e.g. min-w-[40px] on the prev/next buttons);
  // the wide structural min-widths (min-w-[640px]/min-w-[520px]) belong only
  // to the internal week/day grid wrappers that already scroll bounded.
  assert.doesNotMatch(CALENDAR_PAGE, /min-w-\[640px\]/);
  assert.doesNotMatch(CALENDAR_PAGE, /min-w-\[520px\]/);
});

test("calendar week/day structurally-wide grids retain their bounded internal horizontal scroll", () => {
  assert.match(WEEK_VIEW, /overflow-x-auto/);
  assert.match(WEEK_VIEW, /min-w-\[640px\]/);
  assert.match(DAY_VIEW, /overflow-x-auto/);
  assert.match(DAY_VIEW, /min-w-\[520px\]/);
});

test("calendar page preserves the bounded vertical scroll wrapper for week/day views", () => {
  assert.match(CALENDAR_PAGE, /max-h-\[72vh\] overflow-y-auto overscroll-contain/);
});

// --- Frozen routes/props/callbacks/capacity/status/service colors ---

test("CalendarPageClient preserves the accepted getRangeCapacity call and its PERF-C3 overrides", () => {
  assert.match(
    CALENDAR_PAGE,
    /getRangeCapacity\(from, to, \{ businessHours, bayOptions: bays, staffOptions \}\)/
  );
});

test("CalendarPageClient preserves its capacity caches, request-guards, and core navigation callbacks", () => {
  for (const token of [
    "capCache.current",
    "rangeCache.current",
    "loadDayCapacity",
    "loadRangeCapacity",
    "handleDayClick",
    "handleSlotClick",
    "handleReservationClick",
    "handleFormSuccess",
    "navigatePrev",
    "navigateNext",
    "navigateToday",
    "changeView",
  ]) {
    assert.match(CALENDAR_PAGE, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("CalendarMonthView/WeekView/DayView keep their exact prop contracts", () => {
  for (const src of [MONTH_VIEW, WEEK_VIEW]) {
    assert.match(src, /onReservationClick\?:\s*\(r: ReservationDB\) => void/);
    assert.match(src, /onDayClick\?:\s*\(date: string\) => void/);
    assert.match(src, /isClosed\?:\s*\(dateStr: string\) => boolean/);
    assert.match(src, /dayLevel\?:\s*\(dateStr: string\) => RecommendationLevel \| null/);
    assert.match(src, /dayDimmed\?:\s*\(dateStr: string\) => boolean/);
  }
  assert.match(DAY_VIEW, /onSlotClick\?:\s*\(startTime: string, endTime: string\) => void/);
  assert.match(DAY_VIEW, /bayLanes\?:\s*boolean/);
});

test("calendar views never modify frozen status/service color functions (statusDotClass, serviceTypeColor, levelDotClass, levelTintClass)", () => {
  for (const src of [MONTH_VIEW, WEEK_VIEW, DAY_VIEW]) {
    assert.match(src, /serviceTypeColor\(r\.service_type\)/);
    assert.match(src, /statusDotClass\(r\.status\)/);
  }
  assert.match(MONTH_VIEW, /levelDotClass\(level\)/);
  assert.match(MONTH_VIEW, /levelTintClass\(level\)/);
});

test("ReservationsPageClient preserves its exact filter/tab state, reload semantics, and ReservationTable/ReservationForm wiring", () => {
  assert.match(RESERVATIONS_PAGE, /const \[activeTab,\s*setActiveTab\]\s*=\s*useState<Tab>\("all"\)/);
  assert.match(RESERVATIONS_PAGE, /const \[dateFrom,\s*setDateFrom\]\s*=\s*useState\(""\)/);
  assert.match(RESERVATIONS_PAGE, /const \[dateTo,\s*setDateTo\]\s*=\s*useState\(""\)/);
  assert.match(RESERVATIONS_PAGE, /async function handleTabChange\(tab: Tab\)/);
  assert.match(RESERVATIONS_PAGE, /async function handleDateFilter\(\)/);
  assert.match(RESERVATIONS_PAGE, /limit:\s*200/);
  assert.match(RESERVATIONS_PAGE, /<ReservationTable/);
  assert.match(RESERVATIONS_PAGE, /onEdit=\{\(r\) => setModal\(\{ reservation: r \}\)\}/);
  assert.match(RESERVATIONS_PAGE, /onRefresh=\{reload\}/);
  assert.match(RESERVATIONS_PAGE, /<ReservationForm/);
});

test("ReservationTable preserves its exported helpers and server-action call sites", () => {
  assert.match(RESERVATION_TABLE, /export function shouldShowEstimateAction\(/);
  assert.match(RESERVATION_TABLE, /export function estimateCreateUrl\(/);
  assert.match(RESERVATION_TABLE, /export function stopRowClick\(/);
  assert.match(RESERVATION_TABLE, /updateReservation\(r\.id, \{ status: "confirmed" \}\)/);
  assert.match(RESERVATION_TABLE, /createWorkOrderFromReservation\(r\.id\)/);
  assert.match(RESERVATION_TABLE, /cancelReservation\(r\.id\)/);
  assert.match(RESERVATION_TABLE, /confirm\("この予約をキャンセルしますか\?"\)/);
});

test("ReservationForm preserves its capacity-preview, override-logging, and staff/bay dangling-reference logic", () => {
  for (const token of [
    "getCapacityPreview(",
    "logCapacityOverride(",
    "getLatestCapacityOverride(",
    "getReservationStaffOptions(",
    "getBayOptions(",
    "WORK_BAYS_SCHEMA_READY",
    "staffDangling",
    "bayDangling",
    "requireReason",
  ]) {
    assert.match(RESERVATION_FORM, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("ReservationForm never touches the frozen capacity-advice business color mapping (levelClasses/reasonColor/factorTone/compatBadge)", () => {
  assert.match(RESERVATION_FORM, /function levelClasses\(level: RecommendationLevel\): string \{/);
  assert.match(RESERVATION_FORM, /function reasonColor\(sev: ReasonSeverity\): string \{/);
  assert.match(RESERVATION_FORM, /function factorTone\(tone: "good" \| "tight" \| "full" \| "info"\): string \{/);
  assert.match(RESERVATION_FORM, /function compatBadge\(status: "compatible" \| "caution" \| "not_recommended"\): string \{/);
});

test("ReservationForm submit/cancel actions use the TOP v18 primary/secondary button tokens without changing labels or disabled/onSuccess wiring", () => {
  assert.match(RESERVATION_FORM, /border-\[#2f5db8\] bg-\[#1c4fd6\]/);
  assert.match(RESERVATION_FORM, /disabled=\{isPending\}/);
  assert.match(RESERVATION_FORM, /\{isPending \? "処理中\.\.\." : isEdit \? "更新" : "予約作成"\}/);
  assert.match(RESERVATION_FORM, /onSuccess\?\.\(result\.data\)/);
});

test("no white/admin-template background classes were reintroduced on the converted S6 surfaces", () => {
  // bg-white(?!\/) excludes the pre-existing translucent bg-white/40 accent
  // bar in CalendarDayView (a frozen opacity-suffixed accent, not a solid
  // admin-template light background).
  const FORBIDDEN = /bg-white(?!\/)|bg-slate-50|bg-slate-100|bg-gray-100/;
  for (const src of [CALENDAR_PAGE, MONTH_VIEW, WEEK_VIEW, DAY_VIEW, RESERVATIONS_PAGE, RESERVATION_TABLE, RESERVATION_FORM]) {
    assert.doesNotMatch(src, FORBIDDEN);
  }
});
