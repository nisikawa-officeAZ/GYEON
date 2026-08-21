"use client";

import { useState, useTransition } from "react";
import { serviceTypeLabel, type ReservationServiceType } from "@/lib/reservations/reservation-types";
import {
  type ServiceDurationMap,
  type ServiceDuration,
  SERVICE_TYPES,
} from "@/lib/dealer-settings/service-durations";
import { saveServiceDurations } from "@/lib/dealer-settings/save-service-durations";

interface Props {
  initial: ServiceDurationMap;
  canEdit: boolean;
}

type FormRow = {
  hours: string;
  days: string;
  buffer_before_min: string;
  buffer_after_min: string;
};

const inputCls =
  "min-h-12 w-full rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 py-3 text-sm text-[#edf3fc] transition-all placeholder:text-[#526079] focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20 disabled:cursor-not-allowed disabled:opacity-50";

function DurationField({
  label,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  step: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">{label}</span>
      <input
        aria-label={label}
        type="number"
        min={0}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={inputCls}
        placeholder="未設定"
      />
    </label>
  );
}

function toStr(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

function initRows(initial: ServiceDurationMap): Record<string, FormRow> {
  const rows: Record<string, FormRow> = {};
  for (const st of SERVICE_TYPES) {
    const d = initial[st];
    rows[st] = {
      hours: toStr(d?.hours),
      days: toStr(d?.days),
      buffer_before_min: toStr(d?.buffer_before_min),
      buffer_after_min: toStr(d?.buffer_after_min),
    };
  }
  return rows;
}

function parseNum(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function ServiceDurationsForm({ initial, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [rows, setRows] = useState<Record<string, FormRow>>(() => initRows(initial));

  function setField(st: ReservationServiceType, field: keyof FormRow, value: string) {
    setRows((prev) => ({ ...prev, [st]: { ...prev[st], [field]: value } }));
  }

  function handleSave() {
    setResult(null);
    const input: ServiceDurationMap = {};
    for (const st of SERVICE_TYPES) {
      const r = rows[st];
      const d: ServiceDuration = {
        hours: parseNum(r.hours),
        days: parseNum(r.days),
        buffer_before_min: parseNum(r.buffer_before_min),
        buffer_after_min: parseNum(r.buffer_after_min),
      };
      if (d.hours !== null || d.days !== null || d.buffer_before_min !== null || d.buffer_after_min !== null) {
        input[st] = d;
      }
    }

    startTransition(async () => {
      const res = await saveServiceDurations(input);
      if ("success" in res) setResult({ ok: true, msg: "保存しました" });
      else setResult({ ok: false, msg: res.error || "保存に失敗しました" });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6">
        <div className="flex flex-col gap-2 border-b border-[#20304a] pb-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">SERVICE SETTINGS</p>
              <h2 className="mt-1 text-[16px] font-bold text-[#e8eef7]">施工内容別の時間設定</h2>
            </div>
            <span className="h-px flex-1 bg-[#20304a]" />
          </div>
          <p className="text-xs leading-5 text-[#70809b]">
            空欄は未設定です。時間と日数は併用できます（例：多日作業は日数、当日作業は時間）。
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[#20304a]">
          {SERVICE_TYPES.map((st) => {
            const r = rows[st];
            const label = serviceTypeLabel(st);
            return (
              <article key={st} className="grid gap-4 py-5 lg:grid-cols-[180px_1fr] lg:items-end">
                <div className="flex items-center gap-3 lg:self-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#31568c] bg-[#122142] text-sm font-bold text-[#73a7ff]">◴</span>
                  <div>
                    <p className="text-sm font-bold text-[#e8eef7]">{label}</p>
                    <p className="mt-1 text-[9px] tracking-[0.16em] text-[#526079]">{st.toUpperCase()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DurationField label={`${label}・時間`} value={r.hours} step="0.5" disabled={!canEdit}
                    onChange={(value) => setField(st, "hours", value)} />
                  <DurationField label={`${label}・日数`} value={r.days} step="1" disabled={!canEdit}
                    onChange={(value) => setField(st, "days", value)} />
                  <DurationField label={`${label}・前バッファ（分）`} value={r.buffer_before_min} step="5" disabled={!canEdit}
                    onChange={(value) => setField(st, "buffer_before_min", value)} />
                  <DurationField label={`${label}・後バッファ（分）`} value={r.buffer_after_min} step="5" disabled={!canEdit}
                    onChange={(value) => setField(st, "buffer_after_min", value)} />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:px-6">
        <button
          type="button"
          disabled={!canEdit || isPending}
          onClick={handleSave}
          className="min-h-12 rounded-xl bg-[#2f6bff] px-6 text-sm font-bold text-white shadow-[0_10px_28px_rgba(47,107,255,.24)] transition-colors hover:bg-[#3977ff] disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
        {!canEdit && <span className="text-xs text-[#70809b]">閲覧のみ（編集にはオーナー／マネージャー権限が必要です）</span>}
        {result && (
          <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</span>
        )}
      </div>
    </div>
  );
}
