"use client";

// Unified 車検証OCR entry for the wizard (Phase 1).
//
// UNIFIED across PC / Tablet / Smartphone: a single modal hosting the EXISTING OCR
// pipeline component (VehicleRegistrationUpload) — its built-in choice stage already
// offers all three input sources required by the Architect:
//   ・写真を撮影   (capture="environment")
//   ・写真から読み込み (image files: JPEG/PNG/WebP/HEIC)
//   ・PDF読み込み   (accept includes .pdf)
// Flow (unchanged): input source → OCR analysis → form reflection → operator
// correction → save. OCR LOGIC IS NOT MODIFIED — we only reuse the existing
// components verbatim.

import { useState } from "react";
import dynamic from "next/dynamic";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

const VehicleRegistrationUpload = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationUpload"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);
const VehicleRegistrationOcrReview = dynamic(
  () => import("@/components/vehicle-registration/VehicleRegistrationOcrReview"),
  { ssr: false, loading: () => <div className="py-8 text-center text-xs text-slate-500">読み込み中...</div> },
);

type Stage = "closed" | "upload" | "review";

export function OcrEntry({
  customerId,
  vehicleId,
  onApply,
  label = "📄 車検証OCR",
}: {
  customerId?: string;
  vehicleId?: string;
  /** Operator-confirmed OCR fields → parent maps into the wizard store (Phase 2 does full mapping). */
  onApply: (fields: Partial<VehicleRegistrationOcrResult>) => void;
  label?: string;
}) {
  const [stage, setStage] = useState<Stage>("closed");
  const [pending, setPending] = useState<VehicleRegistrationOcrResult | null>(null);

  function close() {
    setStage("closed");
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStage("upload")}
        className="text-xs px-3 py-1.5 rounded-lg text-blue-400 border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
      >
        {label}
      </button>

      {stage !== "closed" && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/60"
          onClick={close}
        >
          <div
            className="bg-[#1e293b] border border-slate-700 rounded-xl shadow-xl w-full max-w-lg p-5 sm:p-6 my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100">
                {stage === "upload" ? "車検証を読み取る" : "読み取り結果を確認"}
              </h3>
              <button type="button" onClick={close} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
            </div>

            {stage === "upload" && (
              <>
                <p className="text-[11px] text-slate-500 mb-3">
                  入力方法：写真を撮影 / 写真から読み込み / PDF読み込み（いずれも既存OCRを使用）
                </p>
                <VehicleRegistrationUpload
                  customerId={customerId || undefined}
                  vehicleId={vehicleId || undefined}
                  onComplete={(result) => { setPending(result); setStage("review"); }}
                  onCancel={close}
                />
              </>
            )}

            {stage === "review" && pending && (
              <VehicleRegistrationOcrReview
                ocrResult={pending}
                onApply={(fields) => { onApply(fields); close(); }}
                onCancel={close}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
