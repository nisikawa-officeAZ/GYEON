"use client";

import { useEffect, useState } from "react";
import type { TrialStatusResponse } from "@/app/api/trial/status/route";

export default function TrialBanner() {
  const [status, setStatus] = useState<TrialStatusResponse | null>(null);

  useEffect(() => {
    fetch("/api/trial/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status) return null;
  if (!status.hasActiveTrial && !status.trialEnded) return null;

  if (status.trialEnded) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
        style={{
          background:  "rgba(85,85,106,0.20)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          color:       "var(--gs-text-3, #55556a)",
        }}
      >
        <span>Basicプランへ移行済み</span>
      </div>
    );
  }

  if (status.trialEndsToday || status.daysRemaining === 0) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold"
        style={{
          background:   "rgba(239,68,68,0.12)",
          borderBottom: "1px solid rgba(239,68,68,0.20)",
          color:        "var(--gs-red, #ef4444)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        試用期間 本日終了
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
      style={{
        background:   "rgba(245,158,11,0.10)",
        borderBottom: "1px solid rgba(245,158,11,0.18)",
        color:        "var(--gs-amber, #f59e0b)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      試用期間 残り{status.daysRemaining}日
    </div>
  );
}
