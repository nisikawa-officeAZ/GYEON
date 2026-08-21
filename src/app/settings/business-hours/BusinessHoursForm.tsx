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
  "min-h-12 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 py-3 text-sm text-[#edf3fc] transition-all focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20 disabled:cursor-not-allowed disabled:opacity-50";

const surface =
  "rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6";

function SectionTitle({ label, labelEn, hint }: { label: string; labelEn: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#20304a] pb-4">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">{labelEn}</p>
          <h2 className="mt-1 text-[16px] font-bold text-[#e8eef7]">{label}</h2>
        </div>
        <span className="h-px flex-1 bg-[#20304a]" />
      </div>
      {hint && <p className="text-xs leading-5 text-[#70809b]">{hint}</p>}
    </div>
  );
}

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
    <div className="flex flex-col gap-5">
      {/* Default hours */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle
          label="標準営業時間"
          labelEn="DEFAULT HOURS"
          hint="曜日ごとに個別設定がない営業日に適用されます。"
        />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:max-w-xl">
          <input aria-label="標準開店時間" type="time" value={defaultOpen} disabled={!canEdit}
            onChange={(e) => setDefaultOpen(e.target.value)} className={inputCls} />
          <span className="text-center text-sm text-[#70809b]">〜</span>
          <input aria-label="標準閉店時間" type="time" value={defaultClose} disabled={!canEdit}
            onChange={(e) => setDefaultClose(e.target.value)} className={inputCls} />
        </div>
      </section>

      {/* Weekly schedule */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle
          label="曜日別設定"
          labelEn="WEEKLY SCHEDULE"
          hint="営業／定休日を切り替え、必要な曜日だけ個別時間を設定できます。"
        />
        <div className="flex flex-col divide-y divide-[#20304a]">
          {WEEKDAYS.map(({ idx, label }) => {
            const isClosed = closed.has(idx);
            const h = weekdayHours[String(idx)];
            return (
              <div key={idx} className="grid grid-cols-[40px_88px] items-center gap-3 py-4 sm:grid-cols-[40px_88px_1fr]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a3e5d] bg-[#0b1322] text-sm font-bold text-[#d6e0ef]">{label}</span>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleClosed(idx)}
                  aria-pressed={isClosed}
                  className={`min-h-10 rounded-xl border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    isClosed
                      ? "border-red-500/30 bg-red-500/15 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {isClosed ? "定休日" : "営業"}
                </button>
                {!isClosed && (
                  <div className="col-span-2 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:col-span-1 sm:grid-cols-[150px_auto_150px_1fr]">
                    <input aria-label={`${label}曜日の開店時間`} type="time" value={h?.open ?? ""} disabled={!canEdit}
                      onChange={(e) => setWeekdayHour(idx, "open", e.target.value)} className={inputCls} />
                    <span className="text-xs text-[#70809b]">〜</span>
                    <input aria-label={`${label}曜日の閉店時間`} type="time" value={h?.close ?? ""} disabled={!canEdit}
                      onChange={(e) => setWeekdayHour(idx, "close", e.target.value)} className={inputCls} />
                    <span className="col-span-3 text-[10px] text-[#526079] sm:col-span-1">空欄は標準時間</span>
                  </div>
                )}
                {isClosed && <span className="col-span-2 text-xs text-[#526079] sm:col-span-1">標準定休日として設定します</span>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Temporary holidays */}
        <section className={`${surface} flex flex-col gap-5`}>
          <SectionTitle label="臨時休業日" labelEn="TEMPORARY CLOSURES" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="追加する臨時休業日" type="date" value={newHoliday} disabled={!canEdit}
              onChange={(e) => setNewHoliday(e.target.value)} className={`${inputCls} min-w-0 flex-1`} />
            <button type="button" disabled={!canEdit || !newHoliday}
              onClick={() => addDate(tempHolidays, setTempHolidays, newHoliday, () => setNewHoliday(""))}
              className="min-h-12 rounded-xl border border-[#31568c] bg-[#122142] px-5 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff] disabled:opacity-50">
              追加
            </button>
          </div>
          <div className="flex min-h-10 flex-wrap gap-2">
            {tempHolidays.map((d) => (
              <span key={d} className="flex min-h-10 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-xs text-red-300">
                {d}
                {canEdit && (
                  <button type="button" aria-label={`${d}の臨時休業日を削除`} onClick={() => setTempHolidays(tempHolidays.filter((x) => x !== d))} className="text-red-400 hover:text-red-200">×</button>
                )}
              </span>
            ))}
            {tempHolidays.length === 0 && <span className="self-center text-xs text-[#526079]">登録なし</span>}
          </div>
        </section>

        {/* Special open days */}
        <section className={`${surface} flex flex-col gap-5`}>
          <SectionTitle label="臨時営業日" labelEn="SPECIAL OPEN DAYS" hint="定休日でも営業する日を指定します。" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <input aria-label="追加する臨時営業日" type="date" value={newSpecial} disabled={!canEdit}
              onChange={(e) => setNewSpecial(e.target.value)} className={`${inputCls} min-w-0 flex-1`} />
            <button type="button" disabled={!canEdit || !newSpecial}
              onClick={() => addDate(specialOpen, setSpecialOpen, newSpecial, () => setNewSpecial(""))}
              className="min-h-12 rounded-xl border border-[#31568c] bg-[#122142] px-5 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff] disabled:opacity-50">
              追加
            </button>
          </div>
          <div className="flex min-h-10 flex-wrap gap-2">
            {specialOpen.map((d) => (
              <span key={d} className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs text-emerald-300">
                {d}
                {canEdit && (
                  <button type="button" aria-label={`${d}の臨時営業日を削除`} onClick={() => setSpecialOpen(specialOpen.filter((x) => x !== d))} className="text-emerald-400 hover:text-emerald-200">×</button>
                )}
              </span>
            ))}
            {specialOpen.length === 0 && <span className="self-center text-xs text-[#526079]">登録なし</span>}
          </div>
        </section>
      </div>

      {/* Save */}
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
