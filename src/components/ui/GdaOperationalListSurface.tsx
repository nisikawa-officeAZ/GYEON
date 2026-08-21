"use client";

// GDA_UI_OPERATIONAL_LIST_S4 — shared presentational shell for operational
// list/search leaf pages (customers, vehicles, and later leaf pages).
//
// TOP v18 vocabulary: deep navy/black background, fine blue borders, glass
// cards, GYEON blue accent, large controlled radii, JP/EN hierarchy,
// line-style icons. Presentational only — it owns no data fetch, filter
// rule, permission gate, route, or callback. Callers pass fully-formed
// content (search form, filter chips, results) and this component supplies
// only the shared chrome: heading/action row, search/filter glass panels,
// results shell, and responsive spacing.

import { ReactNode } from "react";

interface GdaOperationalListSurfaceProps {
  titleJa: string;
  titleEn: string;
  action?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}

export default function GdaOperationalListSurface({
  titleJa,
  titleEn,
  action,
  search,
  filters,
  children,
}: GdaOperationalListSurfaceProps) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#edf3fc] md:text-[22px]">{titleJa}</h1>
          <p className="mt-1 text-[10px] font-semibold tracking-[0.22em] text-[#7788a4]">{titleEn}</p>
        </div>
        {action}
      </div>

      {(search || filters) && (
        <div className="mb-4 flex flex-col gap-4">
          {search && (
            <div className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 backdrop-blur-xl">
              {search}
            </div>
          )}
          {filters && (
            <div className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 backdrop-blur-xl">
              {filters}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90 backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}

export function GdaOperationalListActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
    >
      {children}
    </button>
  );
}

// Approved empty pattern: 64px line-icon box, Japanese message, English
// sublabel, and at most one primary action when the current permission
// allows it. Callers decide whether an action is permitted; this component
// never evaluates permissions itself.
export function GdaOperationalListEmptyState({
  messageJa,
  messageEn,
  actionLabel,
  onAction,
}: {
  messageJa: string;
  messageEn: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[#31568c] bg-[#122142] text-[#5f83b8]">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M9 15h6" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#c3cee2]">{messageJa}</p>
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#7788a4]">{messageEn}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
