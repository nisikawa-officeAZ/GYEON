"use client";

import { useState, useTransition, useEffect } from "react";
import { createReservation } from "@/lib/reservations/create-reservation";
import { updateReservation } from "@/lib/reservations/update-reservation";
import { getCapacityPreview, type CapacityRecommendation } from "@/lib/reservations/get-capacity-preview";
import type { RecommendationLevel } from "@/lib/capacity/capacity-types";
import { recommendationLabel } from "@/lib/capacity/recommendation";
import type { ReservationAdvice, ReasonSeverity } from "@/lib/capacity/reservation-advisor";
import { getReservationStaffOptions, type ReservationStaffOption } from "@/lib/reservations/get-reservation-staff-options";
import { logCapacityOverride, getLatestCapacityOverride, type CapacityOverrideRecord } from "@/lib/reservations/capacity-override-log";
import { getBayOptions } from "@/lib/work-bays/get-work-bays";
import type { WorkBayOption } from "@/lib/work-bays/work-bay-types";
import { WORK_BAYS_SCHEMA_READY } from "@/lib/flags";
import {
  ReservationDB,
  ReservationStatus,
  ReservationServiceType,
  reservationStatusLabel,
  serviceTypeLabel,
} from "@/lib/reservations/reservation-types";

interface Props {
  reservation?: ReservationDB;
  customers: Array<{ id: string; last_name: string; first_name: string | null }>;
  vehicles: Array<{
    id: string;
    customer_id: string | null;
    maker: string | null;
    model: string | null;
    plate_number: string | null;
  }>;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  onSuccess?: (r: ReservationDB) => void;
  onCancel?: () => void;
}

function reasonColor(sev: ReasonSeverity): string {
  switch (sev) {
    case "warn":   return "text-red-300";
    case "notice": return "text-amber-300";
    case "info":   return "text-slate-300";
  }
}

function factorTone(tone: "good" | "tight" | "full" | "info"): string {
  switch (tone) {
    case "good": return "text-emerald-300";
    case "tight": return "text-amber-300";
    case "full": return "text-red-300";
    case "info": return "text-slate-300";
  }
}

function compatBadge(status: "compatible" | "caution" | "not_recommended"): string {
  switch (status) {
    case "compatible":     return "bg-emerald-500/15 border-emerald-500/40 text-emerald-300";
    case "caution":        return "bg-amber-500/15 border-amber-500/40 text-amber-300";
    case "not_recommended": return "bg-red-500/15 border-red-500/40 text-red-300";
  }
}
function phaseLabel(phase: "heavy" | "drying" | "buffer" | "none"): string | null {
  switch (phase) {
    case "heavy":  return "重作業中でも対応可";
    case "drying": return "乾燥期間中に対応可";
    case "buffer": return "バッファ期間中に対応可";
    case "none":   return null;
  }
}
function compatShort(status: "compatible" | "caution" | "not_recommended"): string {
  switch (status) {
    case "compatible":      return "可";
    case "caution":         return "注意";
    case "not_recommended": return "非推奨";
  }
}

// C2.11: plain-language recommended action for non-technical staff.
function recommendedActionText(a: ReservationAdvice, requireReason: boolean): string {
  const compat = a.selectedCompatibility.status;
  let base: string;
  if (compat === "not_recommended") {
    base = a.suggestedAlternatives.length > 0
      ? "現在のスケジュールと両立しにくいため、代替サービスまたは別日時を検討してください。"
      : "現在のスケジュールと両立しにくいため、別日時を検討してください。";
  } else if (a.level === "high_load") {
    base = "工房が高負荷です。予約は可能ですが、余裕のある日時が推奨されます。";
  } else if (compat === "caution" || a.level === "warning") {
    base = "予約は可能です（混雑気味）。";
  } else {
    base = "予約に適しています。";
  }
  return requireReason ? `${base} 上書き理由の入力が必要です。` : base;
}

function levelClasses(level: RecommendationLevel): string {
  switch (level) {
    case "available": return "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
    case "limited":   return "bg-sky-500/10 border-sky-500/30 text-sky-300";
    case "warning":   return "bg-amber-500/10 border-amber-500/30 text-amber-300";
    case "high_load": return "bg-red-500/10 border-red-500/30 text-red-300";
  }
}

const SERVICE_TYPES: ReservationServiceType[] = [
  "coating", "maintenance", "ppf", "window", "wheel", "interior", "other",
];

const STATUSES: ReservationStatus[] = [
  "pending", "confirmed", "completed", "cancelled", "no_show",
];

export default function ReservationForm({
  reservation,
  customers,
  vehicles,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onSuccess,
  onCancel,
}: Props) {
  const isEdit = !!reservation;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>(reservation?.customer_id ?? "");
  const [vehicleId,  setVehicleId]  = useState<string>(reservation?.vehicle_id  ?? "");
  const [staffId,    setStaffId]    = useState<string>(reservation?.assigned_staff_id ?? "");
  const [bayId,      setBayId]      = useState<string>(reservation?.work_bay_id ?? "");
  const [serviceType, setServiceType] = useState<ReservationServiceType>(
    reservation?.service_type ?? "other"
  );
  const [date,      setDate]      = useState(reservation?.reservation_date ?? defaultDate ?? "");
  const [startTime, setStartTime] = useState(reservation?.start_time?.slice(0, 5) ?? defaultStartTime ?? "");
  const [endTime,   setEndTime]   = useState(reservation?.end_time?.slice(0, 5)   ?? defaultEndTime   ?? "");
  const [notes,     setNotes]     = useState(reservation?.notes ?? "");
  const [status,    setStatus]    = useState<ReservationStatus>(reservation?.status ?? "pending");

  // Customer search filter
  const [custSearch, setCustSearch] = useState("");

  // B5a: dealer-scoped technician options (loaded once).
  const [staffOptions, setStaffOptions] = useState<ReservationStaffOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    getReservationStaffOptions().then((opts) => {
      if (!cancelled) setStaffOptions(opts);
    });
    return () => { cancelled = true; };
  }, []);
  const staffKnown = staffOptions.some((o) => o.id === staffId);
  // Dangling reference (assigned staff was deleted): show it, but it will be
  // cleared on save rather than triggering a server validation error.
  const staffDangling = staffId !== "" && staffOptions.length > 0 && !staffKnown;

  // B6b: dealer-scoped work bay options (loaded once; only when schema is live).
  const [bayOptions, setBayOptions] = useState<WorkBayOption[]>([]);
  useEffect(() => {
    if (!WORK_BAYS_SCHEMA_READY) return;
    let cancelled = false;
    getBayOptions().then((opts) => {
      if (!cancelled) setBayOptions(opts);
    });
    return () => { cancelled = true; };
  }, []);
  const bayKnown = bayOptions.some((o) => o.id === bayId);
  const bayDangling = bayId !== "" && bayOptions.length > 0 && !bayKnown;

  // B4: soft capacity-warning preview (informational; never blocks saving).
  const [capacityWarnings, setCapacityWarnings] = useState<string[]>([]);
  const [requireReason, setRequireReason] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  // C1.2: soft workshop-capacity recommendation for the selected slot.
  const [capacity, setCapacity] = useState<CapacityRecommendation | null>(null);
  // C2: full reservation advice (reasons + suggested alternatives).
  const [advice, setAdvice] = useState<ReservationAdvice | null>(null);

  // B5b: latest previously-recorded override reason for this reservation (edit view).
  const [priorOverride, setPriorOverride] = useState<CapacityOverrideRecord | null>(null);
  useEffect(() => {
    if (!reservation?.id) return;
    let cancelled = false;
    getLatestCapacityOverride(reservation.id).then((rec) => {
      if (!cancelled) setPriorOverride(rec);
    });
    return () => { cancelled = true; };
  }, [reservation?.id]);

  useEffect(() => {
    if (!date || !startTime || !endTime) {
      setCapacityWarnings([]);
      setRequireReason(false);
      setCapacity(null);
      setAdvice(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await getCapacityPreview({
        date,
        start: startTime,
        end: endTime,
        excludeId: reservation?.id ?? null,
        staffId: staffId || null,
        bayId: bayId || null,
        serviceType,
      });
      if (!cancelled) {
        setCapacityWarnings(res.warnings);
        setRequireReason(res.requireReason);
        setCapacity(res.capacity);
        setAdvice(res.advice);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [date, startTime, endTime, staffId, bayId, serviceType, reservation?.id]);

  const filteredCustomers = custSearch
    ? customers.filter((c) => {
        const name = [c.last_name, c.first_name].filter(Boolean).join(" ");
        return name.includes(custSearch);
      })
    : customers;

  // Filter vehicles by selected customer
  const filteredVehicles = customerId
    ? vehicles.filter((v) => v.customer_id === customerId)
    : vehicles;

  // B5b: persist the override reason via the existing activity_logs infra when a
  // reason was entered and a capacity warning was present. Fire-and-forget-safe.
  async function maybeLogOverride(reservationId: string, edited: boolean) {
    const highLoad = capacity?.level === "high_load";
    if (overrideReason.trim() && (capacityWarnings.length > 0 || highLoad)) {
      await logCapacityOverride({
        reservationId,
        reason: overrideReason.trim(),
        warnings: highLoad ? [...capacityWarnings, `高負荷（工房稼働 ${capacity?.workshopPct ?? "?"}%）`] : capacityWarnings,
        isEdit: edited,
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError("予約日を入力してください");
      return;
    }

    // B5b: when the dealer's settings require it, an override reason is mandatory
    // to save over a capacity warning.
    if (requireReason && !overrideReason.trim()) {
      setError("上書き理由を入力してください");
      return;
    }

    // B5a: only send an assignment that resolves to a known dealer staff id.
    // A dangling id (deleted staff) is cleared to null so the server validation
    // never rejects the save.
    const assignedStaffToSend = staffId && staffOptions.some((o) => o.id === staffId) ? staffId : null;
    // B6b: only send a bay that resolves to a known dealer bay (server also gates on flag).
    const assignedBayToSend = bayId && bayOptions.some((o) => o.id === bayId) ? bayId : null;

    startTransition(async () => {
      if (isEdit) {
        const result = await updateReservation(reservation!.id, {
          customer_id:      customerId   || null,
          vehicle_id:       vehicleId    || null,
          assigned_staff_id: assignedStaffToSend,
          work_bay_id:      assignedBayToSend,
          service_type:     serviceType,
          reservation_date: date,
          start_time:       startTime    || null,
          end_time:         endTime      || null,
          notes:            notes        || null,
          status,
        });
        if (result.success && result.data) {
          await maybeLogOverride(result.data.id, true);
          onSuccess?.(result.data);
        } else {
          setError(result.error ?? "更新に失敗しました");
        }
      } else {
        const result = await createReservation({
          customer_id:      customerId   || null,
          vehicle_id:       vehicleId    || null,
          assigned_staff_id: assignedStaffToSend,
          work_bay_id:      assignedBayToSend,
          service_type:     serviceType,
          reservation_date: date,
          start_time:       startTime    || null,
          end_time:         endTime      || null,
          notes:            notes        || null,
          status,
        });
        if (result.success && result.data) {
          await maybeLogOverride(result.data.id, false);
          onSuccess?.(result.data);
        } else {
          setError(result.error ?? "作成に失敗しました");
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Customer select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">顧客</label>
        <input
          type="text"
          placeholder="顧客を検索..."
          value={custSearch}
          onChange={(e) => setCustSearch(e.target.value)}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] placeholder-[#5f6b85] focus:outline-none focus:border-[#3478ff]"
        />
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setVehicleId("");
          }}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
        >
          <option value="">顧客を選択</option>
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.last_name, c.first_name].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </div>

      {/* Vehicle select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">車両</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
        >
          <option value="">車両を選択</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {[v.maker, v.model, v.plate_number].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </div>

      {/* Assigned technician (B5a) */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">担当スタッフ</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
        >
          <option value="">未指定</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id} disabled={s.disabled && s.id !== staffId}>
              {s.name}{s.disabled ? "（無効）" : ""}
            </option>
          ))}
          {staffDangling && (
            <option value={staffId}>（不明なスタッフ）</option>
          )}
        </select>
        {staffDangling && (
          <span className="text-[10px] text-amber-400">以前の担当スタッフは削除されています。保存すると未指定になります。</span>
        )}
      </div>

      {/* Work bay (B6b — only when the schema is live) */}
      {WORK_BAYS_SCHEMA_READY && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">作業ベイ</label>
          <select
            value={bayId}
            onChange={(e) => setBayId(e.target.value)}
            className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          >
            <option value="">未指定</option>
            {bayOptions.map((b) => (
              <option key={b.id} value={b.id} disabled={!b.active && b.id !== bayId}>
                {b.name}{!b.active ? "（無効）" : ""}
              </option>
            ))}
            {bayDangling && <option value={bayId}>（不明なベイ）</option>}
          </select>
          {bayDangling && (
            <span className="text-[10px] text-amber-400">以前の作業ベイは削除されています。保存すると未指定になります。</span>
          )}
        </div>
      )}

      {/* Service type */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">施工内容 <span className="text-red-400">*</span></label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as ReservationServiceType)}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          required
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{serviceTypeLabel(t)}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">予約日 <span className="text-red-400">*</span></label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
        />
      </div>

      {/* Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">開始時刻</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">終了時刻</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          />
        </div>
      </div>

      {/* B5b: previously recorded override reason for this reservation (edit view). */}
      {priorOverride && (
        <div className="rounded-lg bg-[#1a2740]/70 border border-[#263955] px-3 py-2 text-[11px] text-[#c3cee2]">
          <span className="text-[#7788a4]">前回の上書き理由: </span>{priorOverride.reason}
        </div>
      )}

      {/* C2: soft recommendation + reason panel + suggested alternatives (never blocks). */}
      {advice && (
        <div className={`flex flex-col gap-1.5 rounded-lg px-3 py-2 border ${levelClasses(advice.level)}`}>
          {/* C2.11: Reservation Decision Summary (glanceable; details below) */}
          <div className="flex flex-col gap-1 rounded-md bg-black/20 px-2.5 py-1.5">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] font-bold text-slate-100">予約判定</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${levelClasses(advice.level)}`}>
                {recommendationLabel(advice.level)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${compatBadge(advice.selectedCompatibility.status)}`}>
                両立: {compatShort(advice.selectedCompatibility.status)}
              </span>
              {requireReason && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-red-500/15 border-red-500/40 text-red-300">
                  上書き理由必須
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-200 leading-snug">{recommendedActionText(advice, requireReason)}</p>
          </div>

          {/* C2.10/C2.12: compatibility explanation (badge lives in the summary above) */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[10px] text-slate-300">{advice.selectedCompatibility.reason}</span>
            {phaseLabel(advice.selectedCompatibility.phase) && (
              <span className="text-[10px] text-emerald-300">
                {phaseLabel(advice.selectedCompatibility.phase)}
              </span>
            )}
          </div>

          {/* C2.12: qualitative WHY notes only — numeric dimensions are shown once in the
              factor grid below (avoids duplicating staff/bay/workshop figures). */}
          {advice.reasons.filter((r) => r.kind === "service" || r.kind === "closed").length > 0 && (
            <ul className="flex flex-col gap-0.5 text-[10px]">
              {advice.reasons
                .filter((r) => r.kind === "service" || r.kind === "closed")
                .map((r, i) => (
                  <li key={i} className={reasonColor(r.severity)}>・{r.label}</li>
                ))}
            </ul>
          )}

          {/* C2.7: remaining-capacity factors (plain language for shop staff) */}
          {advice.factors.length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5 border-t border-white/10 mt-0.5">
              {advice.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-400">{f.label}</span>
                  <span className={`font-medium text-right ${factorTone(f.tone)}`}>{f.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested alternatives (C2.2/C2.6) — clickable + reason text (C2.7) */}
          {advice.suggestedAlternatives.length > 0 && (
            <div className="flex flex-col gap-1 pt-1 border-t border-white/10 mt-0.5">
              <span className="text-[10px] text-slate-400">おすすめの代替サービス（残キャパで順位付け）:</span>
              {advice.suggestedAlternatives.map((s) => (
                <div key={s.service_type} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServiceType(s.service_type)}
                    className="shrink-0 px-2 py-0.5 rounded-md text-[10px] bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
                  >
                    {s.label}
                  </button>
                  {s.reason && <span className="text-[10px] text-slate-500 truncate">{s.reason}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* B4/B5a/B6b: specific overlap warnings — saving is not blocked. */}
      {capacityWarnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <span className="text-[11px] font-medium text-amber-300">キャパシティ警告</span>
          <ul className="list-disc list-inside text-[11px] text-amber-200/90 flex flex-col gap-0.5">
            {capacityWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* B5b/C1.2: override reason — shown when a warning or High-Load recommendation is
          present; required when the dealer's settings mandate it. */}
      {(capacityWarnings.length > 0 || requireReason) && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-amber-300">
            上書き理由{requireReason ? "（必須）" : "（任意）"}
          </label>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            rows={2}
            className="w-full bg-[#0d1420] border border-amber-500/40 rounded-lg px-3 py-2 text-sm text-[#edf3fc] placeholder-[#5f6b85] focus:outline-none focus:border-amber-400 resize-none"
            placeholder="重複や高負荷を承知で予約する理由など"
          />
        </div>
      )}

      {/* Status (edit only) */}
      {isEdit && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[#7788a4]">ステータス</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReservationStatus)}
            className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] focus:outline-none focus:border-[#3478ff]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{reservationStatusLabel(s)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[#7788a4]">メモ</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-[#0d1420] border border-[#263955] rounded-lg px-3 py-2 text-sm text-[#edf3fc] placeholder-[#5f6b85] focus:outline-none focus:border-[#3478ff] resize-none"
          placeholder="備考・要望など"
        />
      </div>

      {error && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-[#263955] bg-[#111826]/90 text-sm font-semibold text-[#c3cee2] backdrop-blur-xl transition-colors hover:bg-[#1a2740] hover:text-[#edf3fc]"
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] flex-1 rounded-xl border border-[#2f5db8] bg-[#1c4fd6] text-sm font-semibold text-white transition-colors hover:bg-[#1a45bd] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3478ff]"
        >
          {isPending ? "処理中..." : isEdit ? "更新" : "予約作成"}
        </button>
      </div>
    </form>
  );
}
