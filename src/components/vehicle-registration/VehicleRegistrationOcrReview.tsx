"use client";

// RC-02: OCR Result Review Component — Customer/Vehicle section layout
//
// Displays extracted fields from a vehicle registration certificate (車検証).
// Fields are grouped into two sections: customer data and vehicle data.
// User can edit any field and choose which fields to apply before confirming.

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

// ─── Field grouping ────────────────────────────────────────────────────────────

type ReviewField = keyof Omit<VehicleRegistrationOcrResult, "confidence">;

const CUSTOMER_FIELDS: ReviewField[] = [
  "owner_name",
  "user_name",
  "owner_address",
  "user_address",
];

const VEHICLE_FIELDS: ReviewField[] = [
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
  "displacement",
  "color",
  "notes",
];

const ALL_REVIEW_FIELDS: ReviewField[] = [...CUSTOMER_FIELDS, ...VEHICLE_FIELDS];

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border-b border-slate-800">
      <span className="text-xs">{icon}</span>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}

interface FieldTableProps {
  fields:   ReviewField[];
  ocr:      VehicleRegistrationOcrResult;
  edited:   Record<string, string>;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onEdit:   (key: string, val: string) => void;
}

function FieldTable({ fields, ocr, edited, selected, onToggle, onEdit }: FieldTableProps) {
  const presentFields = fields.filter(k => ocr[k]);
  if (presentFields.length === 0) return (
    <p className="px-4 py-3 text-xs text-slate-600">読み取れたデータがありません</p>
  );

  return (
    <div className="divide-y divide-slate-800">
      {presentFields.map((key) => {
        const isSelected = selected.has(key);
        return (
          <label
            key={key}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-blue-950/20" : "bg-[#0f172a]"}`}
          >
            {/* Checkbox with larger tap area */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(key)}
              className="accent-blue-500 w-4 h-4 shrink-0"
            />
            <span className="text-xs text-slate-400 whitespace-nowrap w-24 shrink-0">
              {OCR_FIELD_LABELS[key]}
            </span>
            <input
              type="text"
              value={edited[key] ?? ""}
              onChange={(e) => onEdit(key, e.target.value)}
              onClick={e => e.stopPropagation()}
              className="flex-1 min-w-0 bg-[#1e293b] border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
          </label>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function VehicleRegistrationOcrReview({
  ocrResult,
  onApply,
  onCancel,
}: Props) {
  const [, startTransition] = useTransition();

  const [edited, setEdited] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const key of ALL_REVIEW_FIELDS) {
      init[key] = (ocrResult[key] as string | undefined) ?? "";
    }
    return init;
  });

  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const key of ALL_REVIEW_FIELDS) {
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

  function editField(key: string, val: string) {
    setEdited((prev) => ({ ...prev, [key]: val }));
  }

  function selectAll(fields: ReviewField[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      fields.filter(k => ocrResult[k]).forEach(k => next.add(k));
      return next;
    });
  }

  function deselectAll(fields: ReviewField[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      fields.forEach(k => next.delete(k));
      return next;
    });
  }

  function handleApply() {
    const payload: Partial<VehicleRegistrationOcrResult> = {};
    for (const key of ALL_REVIEW_FIELDS) {
      if (selected.has(key) && edited[key]) {
        (payload as Record<string, unknown>)[key] = edited[key];
      }
    }
    startTransition(() => {
      onApply(payload);
    });
  }

  const hasAnyValues = ALL_REVIEW_FIELDS.some((k) => ocrResult[k]);

  const customerPresent = CUSTOMER_FIELDS.filter(k => ocrResult[k]);
  const vehiclePresent  = VEHICLE_FIELDS.filter(k => ocrResult[k]);

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

      {!hasAnyValues ? (
        <p className="text-sm text-slate-500 text-center py-4">
          読み取れたデータがありません。別の画像を試してください。
        </p>
      ) : (
        <>
          {/* Grouped field tables */}
          <div className="overflow-y-auto max-h-[45dvh] sm:max-h-[55vh] rounded-xl border border-slate-800">

            {/* Customer section */}
            {customerPresent.length > 0 && (
              <>
                <SectionLabel icon="👤" label="顧客情報" />
                <div className="flex items-center justify-between px-3 py-1 bg-[#0f172a]">
                  <p className="text-[10px] text-slate-600">読み取った顧客データ</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => selectAll(CUSTOMER_FIELDS)}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      全選択
                    </button>
                    <button
                      type="button"
                      onClick={() => deselectAll(CUSTOMER_FIELDS)}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      全解除
                    </button>
                  </div>
                </div>
                <FieldTable
                  fields={CUSTOMER_FIELDS}
                  ocr={ocrResult}
                  edited={edited}
                  selected={selected}
                  onToggle={toggleField}
                  onEdit={editField}
                />
              </>
            )}

            {/* Vehicle section */}
            {vehiclePresent.length > 0 && (
              <>
                <SectionLabel icon="🚗" label="車両情報" />
                <div className="flex items-center justify-between px-3 py-1 bg-[#0f172a]">
                  <p className="text-[10px] text-slate-600">読み取った車両データ</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => selectAll(VEHICLE_FIELDS)}
                      className="text-[10px] text-blue-400 hover:text-blue-300"
                    >
                      全選択
                    </button>
                    <button
                      type="button"
                      onClick={() => deselectAll(VEHICLE_FIELDS)}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      全解除
                    </button>
                  </div>
                </div>
                <FieldTable
                  fields={VEHICLE_FIELDS}
                  ocr={ocrResult}
                  edited={edited}
                  selected={selected}
                  onToggle={toggleField}
                  onEdit={editField}
                />
              </>
            )}
          </div>

          <p className="text-xs text-slate-600">
            チェックした項目のみフォームへ反映されます。
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors min-h-[44px]"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selected.size === 0}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
            >
              フォームへ反映
            </button>
          </div>
        </>
      )}
    </div>
  );
}
