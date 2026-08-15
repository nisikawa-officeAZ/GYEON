"use client";

// Estimate Wizard Ver2.2 — screen header (title + optional estimate number).
// Presentation-only.

export function StepHeader({
  title,
  estimateNo,
}: {
  title: string;
  estimateNo?: string | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
        {estimateNo && <p className="text-xs text-slate-500 mt-0.5">{estimateNo}</p>}
      </div>
    </div>
  );
}
