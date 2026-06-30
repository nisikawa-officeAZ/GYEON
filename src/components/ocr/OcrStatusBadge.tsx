"use client";

// Phase 2 Sprint 5 — OCR session status badge (processing status management).

import type { OcrSessionStatus } from "@/lib/ocr/ocr-session-types";
import { ocrSessionStatusMeta, type StatusTone } from "@/lib/ocr/ocr-session-summary";

const TONE_CLASS: Record<StatusTone, string> = {
  green: "text-green-400 border-green-500/30 bg-green-500/10",
  blue:  "text-blue-400 border-blue-500/30 bg-blue-500/10",
  amber: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  slate: "text-slate-400 border-slate-600/40 bg-slate-700/30",
  red:   "text-red-400 border-red-500/30 bg-red-500/10",
};

export default function OcrStatusBadge({ status }: { status: OcrSessionStatus }) {
  const meta = ocrSessionStatusMeta(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${TONE_CLASS[meta.tone]}`}>
      {meta.label}
    </span>
  );
}
