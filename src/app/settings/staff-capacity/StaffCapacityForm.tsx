"use client";

import { useState, useTransition } from "react";
import { serviceTypeLabel, type ReservationServiceType } from "@/lib/reservations/reservation-types";
import { SERVICE_TYPES } from "@/lib/dealer-settings/service-durations";
import {
  type StaffCapacitySettings,
  type WorkBay,
} from "@/lib/dealer-settings/staff-capacity";
import { saveStaffCapacity } from "@/lib/dealer-settings/save-staff-capacity";
import { saveWorkBays } from "@/lib/work-bays/save-work-bays";
import { WORK_BAYS_SCHEMA_READY } from "@/lib/flags";

interface StaffOption { id: string; name: string; }

interface Props {
  initial: StaffCapacitySettings;
  staffOptions: StaffOption[];
  canEdit: boolean;
}

interface StaffRowState {
  bookable: boolean;
  daily: string;
  skills: Set<ReservationServiceType>;
}

const inputCls =
  "min-h-12 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 py-3 text-sm text-[#edf3fc] transition-all placeholder:text-[#526079] focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20 disabled:cursor-not-allowed disabled:opacity-50";
const numCls = `${inputCls} w-full`;
const surface = "rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:p-6";

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

function ToggleRow({ label, checked, disabled, onChange }: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className={`flex min-h-12 items-center justify-between gap-4 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 text-sm text-[#c4d0e2] ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)} className="h-4 w-4 accent-[#2f6bff]" />
    </label>
  );
}

function parseNum(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function genId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `bay_${Date.now()}`;
}

export default function StaffCapacityForm({ initial, staffOptions, canEdit }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Dealer-wide capacity
  const [simultaneous, setSimultaneous] = useState(
    initial.capacity.simultaneous_vehicles === null ? "" : String(initial.capacity.simultaneous_vehicles),
  );
  const [allowMultiBay, setAllowMultiBay] = useState(initial.capacity.parallel_work.allow_multi_bay);
  const [maxParallel, setMaxParallel] = useState(
    initial.capacity.parallel_work.max_parallel_per_staff === null
      ? "" : String(initial.capacity.parallel_work.max_parallel_per_staff),
  );
  const [bays, setBays] = useState<WorkBay[]>([...initial.capacity.work_bays]);

  // Per-staff
  const [staffCap, setStaffCap] = useState<Record<string, StaffRowState>>(() => {
    const rows: Record<string, StaffRowState> = {};
    for (const opt of staffOptions) {
      const e = initial.staff_capacity[opt.id];
      rows[opt.id] = {
        bookable: e?.bookable ?? true,
        daily: e?.daily_capacity == null ? "" : String(e.daily_capacity),
        skills: new Set<ReservationServiceType>(e?.skills ?? []),
      };
    }
    return rows;
  });

  // Conflict rules
  const [conflictMode, setConflictMode] = useState(initial.rules.conflict.mode);
  const [warnStaff, setWarnStaff] = useState(initial.rules.conflict.warn_staff_overlap);
  const [warnBay, setWarnBay] = useState(initial.rules.conflict.warn_bay_overlap);
  const [warnCapacity, setWarnCapacity] = useState(initial.rules.conflict.warn_capacity_exceeded);

  // Blocking rules
  const [blocked, setBlocked] = useState<Array<[ReservationServiceType, ReservationServiceType]>>(
    [...initial.rules.blocking.blocked_combinations],
  );
  const [pairA, setPairA] = useState<ReservationServiceType>("coating");
  const [pairB, setPairB] = useState<ReservationServiceType>("ppf");

  // Override rules
  const [requireReason, setRequireReason] = useState(initial.rules.override.require_reason);
  const [allowManager, setAllowManager] = useState(initial.rules.override.allowed_roles.includes("manager"));

  function setBay(id: string, patch: Partial<WorkBay>) {
    setBays((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function toggleSkill(staffId: string, st: ReservationServiceType) {
    setStaffCap((prev) => {
      const cur = prev[staffId];
      const next = new Set(cur.skills);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return { ...prev, [staffId]: { ...cur, skills: next } };
    });
  }
  function setStaffField(staffId: string, patch: Partial<StaffRowState>) {
    setStaffCap((prev) => ({ ...prev, [staffId]: { ...prev[staffId], ...patch } }));
  }

  function handleSave() {
    setResult(null);

    const staff_capacity: StaffCapacitySettings["staff_capacity"] = {};
    for (const opt of staffOptions) {
      const s = staffCap[opt.id];
      staff_capacity[opt.id] = {
        bookable: s.bookable,
        daily_capacity: parseNum(s.daily),
        skills: [...s.skills],
      };
    }

    const input: StaffCapacitySettings = {
      capacity: {
        simultaneous_vehicles: parseNum(simultaneous),
        work_bays: bays.map((b) => ({ id: b.id, name: b.name, active: b.active, capacity: b.capacity ?? 1 })),
        parallel_work: { allow_multi_bay: allowMultiBay, max_parallel_per_staff: parseNum(maxParallel) },
      },
      staff_capacity,
      rules: {
        conflict: {
          mode: conflictMode,
          warn_staff_overlap: warnStaff,
          warn_bay_overlap: warnBay,
          warn_capacity_exceeded: warnCapacity,
        },
        blocking: { blocked_combinations: blocked },
        override: { require_reason: requireReason, allowed_roles: allowManager ? ["owner", "manager"] : ["owner"] },
      },
    };

    startTransition(async () => {
      const res = await saveStaffCapacity(input);
      if (!("success" in res)) {
        setResult({ ok: false, msg: res.error || "保存に失敗しました" });
        return;
      }
      // B6b: when the schema is live, bays are persisted to the work_bays table.
      if (WORK_BAYS_SCHEMA_READY) {
        const bayRes = await saveWorkBays(
          bays.map((b) => ({ id: b.id, name: b.name, active: b.active, capacity: b.capacity ?? 1 })),
        );
        if (!("success" in bayRes)) {
          setResult({ ok: false, msg: bayRes.error || "作業ベイの保存に失敗しました" });
          return;
        }
      }
      setResult({ ok: true, msg: "保存しました" });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Not-yet-enforced notice */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 sm:px-6">
        これらの設定は「設定済み・未適用」です。現時点ではカレンダーや予約作成には反映されず、重複警告・ブロックも行いません。
      </div>

      {/* Dealer-wide capacity */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="同時対応・並行作業" labelEn="CAPACITY & PARALLEL WORK" hint="店舗全体と技術者ごとの同時対応上限を設定します。" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-[#c4d0e2]">
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">同時対応台数</span>
          <input type="number" min={0} value={simultaneous} disabled={!canEdit}
            onChange={(e) => setSimultaneous(e.target.value)} className={numCls} placeholder="—" />
          </label>
          <label className="flex flex-col gap-2 text-sm text-[#c4d0e2]">
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">技術者あたり並行上限</span>
          <input type="number" min={0} value={maxParallel} disabled={!canEdit}
            onChange={(e) => setMaxParallel(e.target.value)} className={numCls} placeholder="—" />
          </label>
        </div>
        <ToggleRow label="複数ベイの並行作業を許可" checked={allowMultiBay} disabled={!canEdit} onChange={setAllowMultiBay} />
      </section>

      {/* Work bays */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="作業ベイ" labelEn="WORK BAYS" hint="作業場所ごとの名称・同時対応台数・稼働状態を設定します。" />
        <div className="flex flex-col gap-3">
          {bays.map((b) => (
            <div key={b.id} className="grid grid-cols-1 gap-3 rounded-xl border border-[#20304a] bg-[#0b1322]/70 p-3 sm:grid-cols-[1fr_120px_110px_auto] sm:items-end">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">ベイ名</span>
                <input aria-label={`${b.name || "未設定"}のベイ名`} type="text" value={b.name} disabled={!canEdit}
                  onChange={(e) => setBay(b.id, { name: e.target.value })}
                  className={`${inputCls} w-full`} placeholder="例：第1施工ベイ" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">同時台数</span>
                <input aria-label={`${b.name || "未設定"}の同時台数`} type="number" min={1} max={50} value={b.capacity ?? 1} disabled={!canEdit}
                  onChange={(e) => setBay(b.id, { capacity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  className={`${inputCls} w-full`} />
              </label>
              <ToggleRow label="稼働中" checked={b.active} disabled={!canEdit}
                onChange={(checked) => setBay(b.id, { active: checked })} />
              {canEdit && (
                <button type="button" aria-label={`${b.name || "未設定"}の作業ベイを削除`} onClick={() => setBays(bays.filter((x) => x.id !== b.id))}
                  className="min-h-12 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/15">削除</button>
              )}
            </div>
          ))}
          {bays.length === 0 && <span className="text-xs text-[#526079]">ベイ未登録</span>}
        </div>
        {canEdit && (
          <button type="button"
            onClick={() => setBays([...bays, { id: genId(), name: "", active: true, capacity: 1 }])}
            className="min-h-12 self-start rounded-xl border border-[#31568c] bg-[#122142] px-5 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff]">
            + ベイを追加
          </button>
        )}
      </section>

      {/* Per-staff capacity */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="技術者ごとの設定" labelEn="TECHNICIAN CAPACITY" hint="予約受入、1日上限、対応可能な施工をスタッフごとに設定します。" />
        {staffOptions.length === 0 && <span className="text-xs text-[#526079]">スタッフが登録されていません</span>}
        <div className="flex flex-col gap-3">
          {staffOptions.map((opt) => {
            const s = staffCap[opt.id];
            return (
              <div key={opt.id} className="flex flex-col gap-4 rounded-xl border border-[#20304a] bg-[#0b1322]/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px] sm:items-end">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#31568c] bg-[#122142] text-sm font-bold text-[#73a7ff]">{opt.name.slice(0, 1).toUpperCase()}</span>
                    <span className="truncate text-sm font-bold text-[#e8eef7]">{opt.name}</span>
                  </div>
                  <ToggleRow label="予約受入" checked={s.bookable} disabled={!canEdit}
                    onChange={(checked) => setStaffField(opt.id, { bookable: checked })} />
                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">1日上限</span>
                    <input aria-label={`${opt.name}の1日上限`} type="number" min={0} value={s.daily} disabled={!canEdit}
                      onChange={(e) => setStaffField(opt.id, { daily: e.target.value })}
                      className={`${inputCls} w-full`} placeholder="未設定" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[#20304a] pt-4">
                  {SERVICE_TYPES.map((st) => (
                    <label key={st}
                      className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[11px] ${
                        s.skills.has(st)
                          ? "border-[#31568c] bg-[#122142] text-[#91b9ff]"
                          : "border-[#2a3e5d] bg-[#0b1322] text-[#70809b]"
                      } ${!canEdit ? "opacity-60" : "cursor-pointer"}`}>
                      <input type="checkbox" className="sr-only" checked={s.skills.has(st)} disabled={!canEdit}
                        onChange={() => toggleSkill(opt.id, st)} />
                      {serviceTypeLabel(st)}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Conflict warning preference */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="重複警告の設定" labelEn="CONFLICT WARNINGS" hint="警告対象を選択します。現在は警告・ブロックとも未適用です。" />
        <label className="flex max-w-sm flex-col gap-2 text-sm text-[#c4d0e2]">
          <span className="text-[10px] font-semibold tracking-[0.08em] text-[#8191ad]">警告モード</span>
          <select value={conflictMode} disabled={!canEdit}
            onChange={(e) => setConflictMode(e.target.value === "off" ? "off" : "warn")} className={`${inputCls} w-full`}>
            <option value="warn">警告する</option>
            <option value="off">警告しない</option>
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ToggleRow label="担当者の重複を警告" checked={warnStaff} disabled={!canEdit || conflictMode === "off"} onChange={setWarnStaff} />
          <ToggleRow label="ベイの重複を警告" checked={warnBay} disabled={!canEdit || conflictMode === "off"} onChange={setWarnBay} />
          <ToggleRow label="キャパシティ超過を警告" checked={warnCapacity} disabled={!canEdit || conflictMode === "off"} onChange={setWarnCapacity} />
        </div>
      </section>

      {/* Service blocking rules */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="同時実施を避ける施工の組み合わせ" labelEn="BLOCKED COMBINATIONS" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <select value={pairA} disabled={!canEdit}
            aria-label="組み合わせる施工1" onChange={(e) => setPairA(e.target.value as ReservationServiceType)} className={`${inputCls} min-w-0 w-full`}>
            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{serviceTypeLabel(st)}</option>)}
          </select>
          <span className="text-xs text-[#70809b]">×</span>
          <select value={pairB} disabled={!canEdit}
            aria-label="組み合わせる施工2" onChange={(e) => setPairB(e.target.value as ReservationServiceType)} className={`${inputCls} min-w-0 w-full`}>
            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{serviceTypeLabel(st)}</option>)}
          </select>
          <button type="button" disabled={!canEdit || pairA === pairB}
            onClick={() => {
              if (pairA === pairB) return;
              const exists = blocked.some(([a, b]) =>
                (a === pairA && b === pairB) || (a === pairB && b === pairA));
              if (!exists) setBlocked([...blocked, [pairA, pairB]]);
            }}
            className="col-span-3 min-h-12 rounded-xl border border-[#31568c] bg-[#122142] px-5 text-xs font-semibold text-[#91b9ff] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff] disabled:opacity-50 sm:col-span-1">
            追加
          </button>
        </div>
        <div className="flex min-h-10 flex-wrap gap-2">
          {blocked.map(([a, b], i) => (
            <span key={`${a}-${b}-${i}`} className="flex min-h-10 items-center gap-2 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-3 text-[11px] text-[#c4d0e2]">
              {serviceTypeLabel(a)} × {serviceTypeLabel(b)}
              {canEdit && (
                <button type="button" aria-label={`${serviceTypeLabel(a)}と${serviceTypeLabel(b)}の組み合わせを削除`} onClick={() => setBlocked(blocked.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-300">削除</button>
              )}
            </span>
          ))}
          {blocked.length === 0 && <span className="self-center text-xs text-[#526079]">登録なし</span>}
        </div>
      </section>

      {/* Manual override requirements */}
      <section className={`${surface} flex flex-col gap-5`}>
        <SectionTitle label="手動上書きの要件" labelEn="MANUAL OVERRIDE" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ToggleRow label="上書き理由を必須にする" checked={requireReason} disabled={!canEdit} onChange={setRequireReason} />
          <ToggleRow label="オーナーは上書き可能（常時）" checked disabled />
          <ToggleRow label="マネージャーも上書き可能" checked={allowManager} disabled={!canEdit} onChange={setAllowManager} />
        </div>
      </section>

      {/* Save */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#263955] bg-[#111826]/90 p-4 sm:px-6">
        <button type="button" disabled={!canEdit || isPending} onClick={handleSave}
          className="min-h-12 rounded-xl bg-[#2f6bff] px-6 text-sm font-bold text-white shadow-[0_10px_28px_rgba(47,107,255,.24)] transition-colors hover:bg-[#3977ff] disabled:opacity-50">
          {isPending ? "保存中..." : "保存"}
        </button>
        {!canEdit && <span className="text-xs text-[#70809b]">閲覧のみ（編集にはオーナー／マネージャー権限が必要です）</span>}
        {result && <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</span>}
      </div>
    </div>
  );
}
