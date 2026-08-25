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
import { analyzeOcrQuality } from "@/lib/ocr/ocr-field-analysis";
import {
  analyzeOcrCustomer,
  resolveCustomer,
} from "@/lib/vehicle-registration/ocr-customer-mapping";
import type { CustomerSource } from "@/lib/vehicle-registration/ocr-customer-mapping";

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

// Field order per spec: メーカー → 車名 → グレード → 型式 → … → ボディカラー.
// Fuel is intentionally excluded from this flow. ボディサイズ is estimated in the
// wizard (3M), not an OCR field, so it is not part of this OCR review table.
const VEHICLE_FIELDS: ReviewField[] = [
  "maker",                   // メーカー
  "vehicle_name",            // 車名
  "grade",                   // グレード
  "model",                   // 型式
  "chassis_number",          // 車台番号
  "license_plate_region",    // ナンバー地域
  "license_plate_class",     // 分類番号
  "license_plate_kana",      // かな
  "license_plate_number",    // 指定番号
  "first_registration_date", // 初度登録年月
  "registration_date",       // 登録年月日
  "inspection_expiry_date",  // 車検満了日
  "displacement",            // 排気量
  "length_mm",               // 長さ（3M計算用）
  "width_mm",                // 幅（3M計算用）
  "height_mm",               // 高さ（3M計算用）
  "color",                   // ボディカラー（手入力必須・AI自動入力なし）
];

const DIMENSION_FIELDS = new Set<ReviewField>(["length_mm", "width_mm", "height_mm"]);

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
  showAll?: boolean; // render every field (even blank) — always visible + editable
}

function FieldTable({ fields, ocr, edited, selected, onToggle, onEdit, showAll }: FieldTableProps) {
  // showAll → every field is visible + editable (even when OCR returned blank).
  const rendered = showAll ? fields : fields.filter(k => ocr[k]);
  if (rendered.length === 0) return (
    <p className="px-4 py-3 text-xs text-slate-600">読み取れたデータがありません</p>
  );

  return (
    <div className="divide-y divide-slate-800">
      {rendered.map((key) => {
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
      const value = ocrResult[key];
      init[key] = value == null ? "" : String(value);
    }
    return init;
  });

  // B2-C.5 — the operator's EXPLICIT choice, or null when they have not made one.
  //
  // This deliberately does NOT seed itself with the recommendation. Seeding conflated two different
  // states — "never chose" and "chose the party that happens to be recommended" — and because the
  // seed was computed once from the ORIGINAL ocrResult while the mapping below is recomputed from
  // the EDITED values on every render, a choice could outlive the condition that justified it. The
  // selector hides itself when the parties stop being separated, so the operator could be governed
  // by a selection they could no longer see or change. `null` makes "never chose" explicit, and the
  // derived value below decides when a choice is allowed to apply.
  const [sourceChoice, setSourceChoice] = useState<CustomerSource | null>(null);

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

  // Live customer mapping from the (possibly edited) owner/user values + operator choice.
  const customerInput: Partial<VehicleRegistrationOcrResult> = {
    owner_name:    edited.owner_name,
    user_name:     edited.user_name,
    owner_address: edited.owner_address,
    user_address:  edited.user_address,
    customer_type: ocrResult.customer_type,
  };
  const custAnalysis = analyzeOcrCustomer(customerInput);

  // B2-C.5 — the ONE source used for both display and apply, derived during render from the LIVE
  // analysis of the edited values.
  //
  // An explicit choice applies only while the parties are actually separated — which is exactly the
  // condition under which the selector is rendered, so the control's visibility and the value's
  // authority are now the same expression and cannot disagree. When the parties are not separated
  // there is nothing to choose between, so the established recommendation governs.
  //
  // The choice is kept rather than cleared: the edit that de-separates the parties is usually a
  // typo correction, and re-separating them must not silently cost the operator their decision. It
  // lies dormant and becomes active again on its own.
  //
  // Derived, NOT a useEffect reset: an effect runs after commit, leaving one render in which
  // handleApply would still build the payload from the superseded source. There is no such window
  // here — the first render after an edit is already correct.
  const effectiveSource: CustomerSource =
    custAnalysis.ownerUserSeparated && sourceChoice !== null
      ? sourceChoice
      : custAnalysis.recommendedSource;

  const custResolved = resolveCustomer(customerInput, effectiveSource);

  function handleApply() {
    const payload: Partial<VehicleRegistrationOcrResult> = {};
    for (const key of ALL_REVIEW_FIELDS) {
      if (selected.has(key) && edited[key]) {
        if (DIMENSION_FIELDS.has(key)) {
          const numeric = Number(edited[key]);
          if (Number.isFinite(numeric) && numeric > 0) {
            (payload as Record<string, unknown>)[key] = Math.round(numeric);
          }
        } else {
          (payload as Record<string, unknown>)[key] = edited[key];
        }
      }
    }
    if (
      payload.length_mm != null && payload.width_mm != null && payload.height_mm != null &&
      ocrResult.dimension_confidence != null
    ) {
      payload.dimension_confidence = ocrResult.dimension_confidence;
    }
    // Attach the resolved customer (owner/user rule + operator selection).
    if (custResolved.name)    payload.customer_candidate_name    = custResolved.name;
    if (custResolved.address) payload.customer_candidate_address = custResolved.address;
    payload.customer_type = custResolved.customerType;
    startTransition(() => {
      onApply(payload);
    });
  }

  const hasAnyValues = ALL_REVIEW_FIELDS.some((k) => ocrResult[k]);

  const customerPresent = CUSTOMER_FIELDS.filter(k => ocrResult[k]);

  // Phase 2 Sprint 4 — confidence / missing-field handling
  const quality = analyzeOcrQuality(ocrResult);
  const lowConfidence = quality.level === "low";

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

      {/* Low-confidence warning */}
      {lowConfidence && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10">
          <span className="text-red-400 shrink-0">✕</span>
          <p className="text-xs text-red-300">
            読み取り精度が低い可能性があります。各項目を特に注意して確認してください。
          </p>
        </div>
      )}

      {/* Missing important fields */}
      {hasAnyValues && quality.hasMissing && (
        <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
          <p className="text-xs text-amber-300 font-medium">
            読み取れなかった重要項目があります（手入力で補完してください）
          </p>
          {quality.missingCustomer.length > 0 && (
            <p className="text-[11px] text-amber-200/80">
              顧客: {quality.missingCustomer.join("、")}
            </p>
          )}
          {quality.missingVehicle.length > 0 && (
            <p className="text-[11px] text-amber-200/80">
              車両: {quality.missingVehicle.join("、")}
            </p>
          )}
        </div>
      )}

      {/* Customer mapping (owner / user business rule) */}
      {hasAnyValues && (custAnalysis.ownerName || custAnalysis.userName) && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#0b1120] p-3">
          <p className="text-[11px] font-semibold text-slate-300">顧客反映情報</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-[10px] text-slate-500 mb-0.5">所有者</div>
              <div className="text-slate-200 break-words">{custAnalysis.ownerName || "—"}</div>
              {custAnalysis.ownerAddress && <div className="text-[10px] text-slate-500 mt-0.5 break-words">{custAnalysis.ownerAddress}</div>}
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-[10px] text-slate-500 mb-0.5">使用者</div>
              <div className="text-slate-200 break-words">{custAnalysis.userName || "—"}</div>
              {custAnalysis.userAddress && <div className="text-[10px] text-slate-500 mt-0.5 break-words">{custAnalysis.userAddress}</div>}
            </div>
          </div>

          {custAnalysis.ownerUserSeparated && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] text-slate-400">顧客として登録する対象を選択してください</p>
              <div className="flex gap-2">
                {(["user", "owner"] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceChoice(src)}
                    className={`flex-1 h-10 rounded-lg text-xs font-semibold border transition-colors ${
                      // Selected state reads the DERIVED source, not the raw choice, so the
                      // highlighted button is always the party that will actually be applied —
                      // including before any explicit choice, where it shows the recommendation.
                      effectiveSource === src
                        ? "bg-[#1d4ed8] text-white border-[#1d4ed8]"
                        : "bg-[#0f172a] text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {src === "user" ? "使用者を顧客にする" : "所有者を顧客にする"}
                  </button>
                ))}
              </div>
              {custAnalysis.note && (
                <p className="text-[11px] text-amber-300 bg-amber-900/15 border border-amber-800/40 rounded px-2 py-1.5">
                  {custAnalysis.note}
                </p>
              )}
              {custAnalysis.requireSelection && (
                <p className="text-[11px] text-blue-300/90">
                  所有者と使用者が異なります。どちらを顧客にするか確認してください。
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500">顧客として反映する情報</div>
              <div className="text-sm text-slate-100 truncate">{custResolved.name || "—"}</div>
              {custResolved.address && <div className="text-[10px] text-slate-500 truncate">{custResolved.address}</div>}
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
              custResolved.customerType === "corporation" ? "text-purple-300 bg-purple-900/40 border-purple-700/50"
              : custResolved.customerType === "individual" ? "text-blue-300 bg-blue-900/40 border-blue-700/50"
              : "text-slate-400 bg-slate-800 border-slate-700"
            }`}>
              {custResolved.customerType === "corporation" ? "法人" : custResolved.customerType === "individual" ? "個人" : "不明"}
            </span>
          </div>
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
            {/* Vehicle section is ALWAYS shown — every field visible + editable. */}
            <>
              <SectionLabel icon="🚗" label="車両情報" />
              <div className="flex items-center justify-between px-3 py-1 bg-[#0f172a]">
                <p className="text-[10px] text-slate-600">車両データ（未取得項目は手入力可）</p>
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
                showAll
              />
              {/* ボディカラーは手入力必須 — AI は自動入力しない */}
              {!edited.color?.trim() && (
                <p className="px-3 py-2 text-[11px] text-amber-400 bg-amber-950/20">
                  ボディカラーを入力してください。
                </p>
              )}
            </>
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
