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
  "bg-[#1e293b] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50";
const numCls = `${inputCls} w-24`;

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
    <div className="flex flex-col gap-6">
      {/* Not-yet-enforced notice */}
      <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
        これらの設定は「設定済み・未適用」です。現時点ではカレンダーや予約作成には反映されず、重複警告・ブロックも行いません。
      </div>

      {/* Dealer-wide capacity */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-200">同時対応・並行作業</h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span className="w-40">同時対応台数</span>
          <input type="number" min={0} value={simultaneous} disabled={!canEdit}
            onChange={(e) => setSimultaneous(e.target.value)} className={numCls} placeholder="—" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={allowMultiBay} disabled={!canEdit}
            onChange={(e) => setAllowMultiBay(e.target.checked)} />
          複数ベイの並行作業を許可
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span className="w-40">技術者あたり並行上限</span>
          <input type="number" min={0} value={maxParallel} disabled={!canEdit}
            onChange={(e) => setMaxParallel(e.target.value)} className={numCls} placeholder="—" />
        </label>
      </section>

      {/* Work bays */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">作業ベイ</h2>
        <div className="flex flex-col gap-1.5">
          {bays.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <input type="text" value={b.name} disabled={!canEdit}
                onChange={(e) => setBay(b.id, { name: e.target.value })}
                className={`${inputCls} flex-1`} placeholder="ベイ名" />
              <label className="flex items-center gap-1 text-xs text-slate-400">
                台数
                <input type="number" min={1} max={50} value={b.capacity ?? 1} disabled={!canEdit}
                  onChange={(e) => setBay(b.id, { capacity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  className={`${inputCls} w-16`} />
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                <input type="checkbox" checked={b.active} disabled={!canEdit}
                  onChange={(e) => setBay(b.id, { active: e.target.checked })} />
                有効
              </label>
              {canEdit && (
                <button type="button" onClick={() => setBays(bays.filter((x) => x.id !== b.id))}
                  className="text-slate-500 hover:text-red-400 text-sm px-1">×</button>
              )}
            </div>
          ))}
          {bays.length === 0 && <span className="text-xs text-slate-600">ベイ未登録</span>}
        </div>
        {canEdit && (
          <button type="button"
            onClick={() => setBays([...bays, { id: genId(), name: "", active: true, capacity: 1 }])}
            className="self-start px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg">
            + ベイを追加
          </button>
        )}
      </section>

      {/* Per-staff capacity */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">技術者ごとの設定</h2>
        {staffOptions.length === 0 && <span className="text-xs text-slate-600">スタッフが登録されていません</span>}
        <div className="flex flex-col gap-3">
          {staffOptions.map((opt) => {
            const s = staffCap[opt.id];
            return (
              <div key={opt.id} className="flex flex-col gap-2 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-200 font-medium truncate">{opt.name}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      <input type="checkbox" checked={s.bookable} disabled={!canEdit}
                        onChange={(e) => setStaffField(opt.id, { bookable: e.target.checked })} />
                      予約受入
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-400">
                      1日上限
                      <input type="number" min={0} value={s.daily} disabled={!canEdit}
                        onChange={(e) => setStaffField(opt.id, { daily: e.target.value })}
                        className={`${inputCls} w-16`} placeholder="—" />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_TYPES.map((st) => (
                    <label key={st}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] cursor-pointer border ${
                        s.skills.has(st)
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          : "bg-slate-800/50 text-slate-400 border-slate-700"
                      } ${!canEdit ? "opacity-60" : ""}`}>
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
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">重複警告の設定</h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <span className="w-40">警告モード</span>
          <select value={conflictMode} disabled={!canEdit}
            onChange={(e) => setConflictMode(e.target.value === "off" ? "off" : "warn")} className={inputCls}>
            <option value="warn">警告する</option>
            <option value="off">警告しない</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={warnStaff} disabled={!canEdit || conflictMode === "off"}
            onChange={(e) => setWarnStaff(e.target.checked)} />
          担当者の重複を警告
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={warnBay} disabled={!canEdit || conflictMode === "off"}
            onChange={(e) => setWarnBay(e.target.checked)} />
          ベイの重複を警告
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={warnCapacity} disabled={!canEdit || conflictMode === "off"}
            onChange={(e) => setWarnCapacity(e.target.checked)} />
          キャパシティ超過を警告
        </label>
      </section>

      {/* Service blocking rules */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">同時実施を避ける施工の組み合わせ</h2>
        <div className="flex items-center gap-2">
          <select value={pairA} disabled={!canEdit}
            onChange={(e) => setPairA(e.target.value as ReservationServiceType)} className={inputCls}>
            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{serviceTypeLabel(st)}</option>)}
          </select>
          <span className="text-slate-500 text-xs">×</span>
          <select value={pairB} disabled={!canEdit}
            onChange={(e) => setPairB(e.target.value as ReservationServiceType)} className={inputCls}>
            {SERVICE_TYPES.map((st) => <option key={st} value={st}>{serviceTypeLabel(st)}</option>)}
          </select>
          <button type="button" disabled={!canEdit || pairA === pairB}
            onClick={() => {
              if (pairA === pairB) return;
              const exists = blocked.some(([a, b]) =>
                (a === pairA && b === pairB) || (a === pairB && b === pairA));
              if (!exists) setBlocked([...blocked, [pairA, pairB]]);
            }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg disabled:opacity-50">
            追加
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {blocked.map(([a, b], i) => (
            <span key={`${a}-${b}-${i}`} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-slate-300">
              {serviceTypeLabel(a)} × {serviceTypeLabel(b)}
              {canEdit && (
                <button type="button" onClick={() => setBlocked(blocked.filter((_, j) => j !== i))}
                  className="text-slate-500 hover:text-red-400">×</button>
              )}
            </span>
          ))}
          {blocked.length === 0 && <span className="text-xs text-slate-600">なし</span>}
        </div>
      </section>

      {/* Manual override requirements */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-200">手動上書きの要件</h2>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={requireReason} disabled={!canEdit}
            onChange={(e) => setRequireReason(e.target.checked)} />
          上書き時に理由の入力を必須にする
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked disabled />
          オーナーは上書き可能（常時）
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={allowManager} disabled={!canEdit}
            onChange={(e) => setAllowManager(e.target.checked)} />
          マネージャーも上書き可能
        </label>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
        <button type="button" disabled={!canEdit || isPending} onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {isPending ? "保存中..." : "保存"}
        </button>
        {!canEdit && <span className="text-xs text-slate-500">閲覧のみ（編集にはオーナー／マネージャー権限が必要です）</span>}
        {result && <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</span>}
      </div>
    </div>
  );
}
