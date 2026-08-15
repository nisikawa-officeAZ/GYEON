"use client";

import { useState, useTransition } from "react";
import {
  type BusinessHoursSettings,
  type DayHours,
} from "@/lib/dealer-settings/business-hours";
import { saveBusinessHours } from "@/lib/dealer-settings/save-business-hours";

interface Props {
  initial: BusinessHoursSettings;
  canEdit: boolean;
}

// Display order Mon..Sun; values are weekday indexes (0=Sun..6=Sat).
const WEEKDAYS: Array<{ idx: number; label: string }> = [
  { idx: 1, label: "月" },
  { idx: 2, label: "火" },
  { idx: 3, label: "水" },
  { idx: 4, label: "木" },
  { idx: 5, label: "金" },
  { idx: 6, label: "土" },
  { idx: 0, label: "日" },
];

const inputCls =
  "bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50";

export default function BusinessHoursForm({ initial, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [defaultOpen, setDefaultOpen]   = useState(initial.business_hours.default_hours?.open ?? "");
  const [defaultClose, setDefaultClose] = useState(initial.business_hours.default_hours?.close ?? "");
  const [closed, setClosed] = useState<Set<number>>(new Set(initial.closed_weekdays));
  const [weekdayHours, setWeekdayHours] = useState<Record<string, DayHours>>(
    { ...initial.business_hours.weekday_hours },
  );
  const [tempHolidays, setTempHolidays] = useState<string[]>([...initial.temp_holidays]);
  const [specialOpen, setSpecialOpen]   = useState<string[]>([...initial.business_hours.special_open_days]);

  const [newHoliday, setNewHoliday] = useState("");
  const [newSpecial, setNewSpecial] = useState("");

  function toggleClosed(idx: number) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function setWeekdayHour(idx: number, field: "open" | "close", value: string) {
    setWeekdayHours((prev) => {
      const key = String(idx);
      const cur = prev[key] ?? { open: "", close: "" };
      return { ...prev, [key]: { ...cur, [field]: value } };
    });
  }

  function addDate(list: string[], setList: (v: string[]) => void, value: string, reset: () => void) {
    const v = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || list.includes(v)) return;
    setList([...list, v].sort());
    reset();
  }

  function handleSave() {
    setResult(null);

    // Build weekday_hours: keep only OPEN days that have BOTH times filled.
    const weekday_hours: Record<string, DayHours> = {};
    for (const { idx } of WEEKDAYS) {
      if (closed.has(idx)) continue;
      const h = weekdayHours[String(idx)];
      if (h && h.open && h.close) weekday_hours[String(idx)] = { open: h.open, close: h.close };
    }

    const input = {
      business_hours: {
        default_hours: defaultOpen && defaultClose ? { open: defaultOpen, close: defaultClose } : null,
        weekday_hours,
        special_open_days: specialOpen,
      },
      closed_weekdays: [...closed].sort((a, b) => a - b),
      temp_holidays: tempHolidays,
    };

    startTransition(async () => {
      const res = await saveBusinessHours(input);
      if ("success" in res) setResult({ ok: true, msg: "保存しました" });
      else setResult({ ok: false, msg: res.error || "保存に失敗しました" });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Default hours */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">標準営業時間</h2>
        <p className="text-xs text-slate-500">曜日ごとに個別設定がない営業日に適用されます。</p>
        <div className="flex items-center gap-2">
          <input type="time" value={defaultOpen} disabled={!canEdit}
            onChange={(e) => setDefaultOpen(e.target.value)} className={inputCls} />
          <span className="text-slate-500 text-sm">〜</span>
          <input type="time" value={defaultClose} disabled={!canEdit}
            onChange={(e) => setDefaultClose(e.target.value)} className={inputCls} />
        </div>
      </section>

      {/* Weekly schedule */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">曜日別設定</h2>
        <div className="flex flex-col gap-1.5">
          {WEEKDAYS.map(({ idx, label }) => {
            const isClosed = closed.has(idx);
            const h = weekdayHours[String(idx)];
            return (
              <div key={idx} className="flex items-center gap-3 py-1">
                <span className="w-6 text-center text-sm font-medium text-slate-300">{label}</span>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleClosed(idx)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                    isClosed
                      ? "bg-red-500/15 text-red-300 border border-red-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {isClosed ? "定休日" : "営業"}
                </button>
                {!isClosed && (
                  <div className="flex items-center gap-2">
                    <input type="time" value={h?.open ?? ""} disabled={!canEdit}
                      onChange={(e) => setWeekdayHour(idx, "open", e.target.value)} className={inputCls} />
                    <span className="text-slate-500 text-xs">〜</span>
                    <input type="time" value={h?.close ?? ""} disabled={!canEdit}
                      onChange={(e) => setWeekdayHour(idx, "close", e.target.value)} className={inputCls} />
                    <span className="text-[10px] text-slate-600">空欄は標準時間</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Temporary holidays */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">臨時休業日</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={newHoliday} disabled={!canEdit}
            onChange={(e) => setNewHoliday(e.target.value)} className={inputCls} />
          <button type="button" disabled={!canEdit || !newHoliday}
            onClick={() => addDate(tempHolidays, setTempHolidays, newHoliday, () => setNewHoliday(""))}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg disabled:opacity-50">
            追加
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tempHolidays.map((d) => (
            <span key={d} className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
              {d}
              {canEdit && (
                <button type="button" onClick={() => setTempHolidays(tempHolidays.filter((x) => x !== d))} className="text-red-400 hover:text-red-200">×</button>
              )}
            </span>
          ))}
          {tempHolidays.length === 0 && <span className="text-xs text-slate-600">なし</span>}
        </div>
      </section>

      {/* Special open days */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">臨時営業日</h2>
        <p className="text-xs text-slate-500">定休日でも営業する日を指定します。</p>
        <div className="flex items-center gap-2">
          <input type="date" value={newSpecial} disabled={!canEdit}
            onChange={(e) => setNewSpecial(e.target.value)} className={inputCls} />
          <button type="button" disabled={!canEdit || !newSpecial}
            onClick={() => addDate(specialOpen, setSpecialOpen, newSpecial, () => setNewSpecial(""))}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg disabled:opacity-50">
            追加
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {specialOpen.map((d) => (
            <span key={d} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
              {d}
              {canEdit && (
                <button type="button" onClick={() => setSpecialOpen(specialOpen.filter((x) => x !== d))} className="text-emerald-400 hover:text-emerald-200">×</button>
              )}
            </span>
          ))}
          {specialOpen.length === 0 && <span className="text-xs text-slate-600">なし</span>}
        </div>
      </section>

      {/* Save */}
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
