"use client";

// PHASE67: OCR Result Review Component
// Displays extracted fields from vehicle registration certificate.
// User must confirm before any data is applied to customer/vehicle/estimate.

import { useState, useTransition } from "react";
import {
  VehicleRegistrationOcrResult,
  OCR_FIELD_LABELS,
} from "@/lib/vehicle-registration/vehicle-registration-types";

interface Props {
  ocrResult:  VehicleRegistrationOcrResult;
  fileId?:    string;
  onApply:    (selected: Partial<VehicleRegistrationOcrResult>) => void;
  onCancel:   () => void;
}

// Fields shown in the review table (excluding confidence)
const REVIEW_FIELDS: Array<keyof Omit<VehicleRegistrationOcrResult, "confidence">> = [
  "owner_name",
  "user_name",
  "owner_address",
  "user_address",
  "vehicle_name",
  "maker",
  "model",
  "grade",
  "model_code",
  "chassis_number",
  "license_plate_region",
  "license_plate_class",
  "license_plate_kana",
  "license_plate_number",
  "first_registration_date",
  "inspection_expiry_date",
  "vehicle_type",
  "use_type",
  "private_or_business",
  "body_shape",
  "fuel_type",
  "color",
  "notes",
];

function ConfidenceBadge({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "text-green-400 border-green-500/30 bg-green-500/10" :
    pct >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${color}`}>
      信頼度 {pct}%
    </span>
  );
}

export default function VehicleRegistrationOcrReview({
  ocrResult,
  onApply,
  onCancel,
}: Props) {
  const [, startTransition] = useTransition();

  // Editable values — user can correct before applying
  const [edited, setEdited] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const key of REVIEW_FIELDS) {
      init[key] = (ocrResult[key] as string | undefined) ?? "";
    }
    return init;
  });

  // Which fields are selected for apply
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const key of REVIEW_FIELDS) {
      if (ocrResult[key]) s.add(key);
    }
    return s;
  });

  function toggleField(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleApply() {
    const payload: Partial<VehicleRegistrationOcrResult> = {};
    for (const key of REVIEW_FIELDS) {
      if (selected.has(key) && edited[key]) {
        (payload as Record<string, unknown>)[key] = edited[key];
      }
    }
    startTransition(() => {
      onApply(payload);
    });
  }

  const hasValues = REVIEW_FIELDS.some((k) => ocrResult[k]);

  return (
    <div className="flex flex-col gap-4">
      {/* Warning */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
        <span className="text-amber-400 shrink-0">⚠</span>
        <p className="text-xs text-amber-300">
          AIの読み取り結果は必ず確認してください。誤りがある場合は修正してからフォームへ反映してください。
        </p>
      </div>

      {/* Confidence */}
      {ocrResult.confidence !== undefined && (
        <div className="flex justify-end">
          <ConfidenceBadge value={ocrResult.confidence} />
        </div>
      )}

      {!hasValues ? (
        <p className="text-sm text-slate-500 text-center py-4">
          読み取れたデータがありません。別の画像を試してください。
        </p>
      ) : (
        <>
          {/* Field table */}
          <div className="overflow-y-auto max-h-[50vh] rounded-xl border border-slate-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0f172a]">
                <tr className="border-b border-slate-800">
                  <th className="w-8 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === REVIEW_FIELDS.filter((k) => ocrResult[k]).length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelected(new Set(REVIEW_FIELDS.filter((k) => ocrResult[k])));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                      className="accent-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-400">項目</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-400">読み取り結果（編集可）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {REVIEW_FIELDS.map((key) => {
                  const original = (ocrResult[key] as string | undefined) ?? "";
                  if (!original) return null;
                  const isSelected = selected.has(key);
                  return (
                    <tr
                      key={key}
                      className={`transition-colors ${isSelected ? "bg-blue-950/20" : "bg-[#0f172a]"}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleField(key)}
                          className="accent-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                        {OCR_FIELD_LABELS[key]}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={edited[key]}
                          onChange={(e) => setEdited((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full bg-[#1e293b] border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-600">
            チェックした項目のみフォームへ反映されます。
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selected.size === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              フォームへ反映
            </button>
          </div>
        </>
      )}
    </div>
  );
}
