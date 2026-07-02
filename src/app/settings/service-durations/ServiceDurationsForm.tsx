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
  "w-20 bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50";

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
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] text-slate-500">
              <th className="py-2 pr-3 font-medium">施工内容</th>
              <th className="py-2 px-2 font-medium">時間</th>
              <th className="py-2 px-2 font-medium">日数</th>
              <th className="py-2 px-2 font-medium">前バッファ(分)</th>
              <th className="py-2 px-2 font-medium">後バッファ(分)</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_TYPES.map((st) => {
              const r = rows[st];
              return (
                <tr key={st} className="border-t border-slate-800">
                  <td className="py-2 pr-3 text-slate-200">{serviceTypeLabel(st)}</td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} step="0.5" value={r.hours} disabled={!canEdit}
                      onChange={(e) => setField(st, "hours", e.target.value)} className={inputCls} placeholder="—" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} step="1" value={r.days} disabled={!canEdit}
                      onChange={(e) => setField(st, "days", e.target.value)} className={inputCls} placeholder="—" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} step="5" value={r.buffer_before_min} disabled={!canEdit}
                      onChange={(e) => setField(st, "buffer_before_min", e.target.value)} className={inputCls} placeholder="—" />
                  </td>
                  <td className="py-2 px-2">
                    <input type="number" min={0} step="5" value={r.buffer_after_min} disabled={!canEdit}
                      onChange={(e) => setField(st, "buffer_after_min", e.target.value)} className={inputCls} placeholder="—" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        空欄は未設定です。時間と日数は併用できます（例：多日作業は日数、当日作業は時間）。
      </p>

      <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
        <button
          type="button"
          disabled={!canEdit || isPending}
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
        {!canEdit && <span className="text-xs text-slate-500">閲覧のみ（編集にはオーナー／マネージャー権限が必要です）</span>}
        {result && (
          <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</span>
        )}
      </div>
    </div>
  );
}
