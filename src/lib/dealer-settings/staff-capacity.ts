// DealerOS — Staff / Capacity Settings foundation (Batch B3).
//
// Pure types + helpers, NO data access and NO "use server".
//
// Persistence reuses the EXISTING dealer_settings.business_days jsonb container
// (already used by B1 hours + B2 durations) under a dedicated key `scheduling`.
// No new column, no schema change, no migration, no new table.
//
// B3 is FOUNDATION ONLY — these values are "configured but not yet enforced":
// the calendar / reservation flow does not read them, there is no conflict
// detection and no hard blocking.

import { ReservationServiceType } from "@/lib/reservations/reservation-types";
import { SERVICE_TYPES } from "./service-durations";

// ── Dealer-wide capacity ─────────────────────────────────────────────────────

export interface WorkBay {
  id: string;
  name: string;
  active: boolean;
}

export interface ParallelWorkRules {
  allow_multi_bay: boolean;
  max_parallel_per_staff: number | null;
}

export interface CapacitySettings {
  simultaneous_vehicles: number | null;
  work_bays: WorkBay[];
  parallel_work: ParallelWorkRules;
}

// ── Per-technician capacity (keyed by dealer_staff.id) ───────────────────────

export interface StaffCapacityEntry {
  bookable: boolean;
  daily_capacity: number | null;
  skills: ReservationServiceType[];
}

export type StaffCapacityMap = Record<string, StaffCapacityEntry>;

// ── Scheduling rules ─────────────────────────────────────────────────────────

export type ConflictMode = "warn" | "off"; // "block" intentionally excluded in B3

export interface ConflictRules {
  mode: ConflictMode;
  warn_staff_overlap: boolean;
  warn_bay_overlap: boolean;
  warn_capacity_exceeded: boolean;
}

export interface BlockingRules {
  /** Service-type pairs that should not be scheduled together (config only). */
  blocked_combinations: Array<[ReservationServiceType, ReservationServiceType]>;
}

export interface OverrideRules {
  require_reason: boolean;
  allowed_roles: Array<"owner" | "manager">;
}

export interface SchedulingRules {
  conflict: ConflictRules;
  blocking: BlockingRules;
  override: OverrideRules;
}

export interface StaffCapacitySettings {
  capacity: CapacitySettings;
  staff_capacity: StaffCapacityMap;
  rules: SchedulingRules;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export function defaultStaffCapacitySettings(): StaffCapacitySettings {
  return {
    capacity: {
      simultaneous_vehicles: null,
      work_bays: [],
      parallel_work: { allow_multi_bay: false, max_parallel_per_staff: null },
    },
    staff_capacity: {},
    rules: {
      conflict: { mode: "warn", warn_staff_overlap: true, warn_bay_overlap: true, warn_capacity_exceeded: true },
      blocking: { blocked_combinations: [] },
      override: { require_reason: true, allowed_roles: ["owner", "manager"] },
    },
  };
}

// ── Validation helpers ───────────────────────────────────────────────────────

const MAX_VEHICLES = 100;
const MAX_PARALLEL = 50;
const MAX_DAILY    = 100;
const MAX_BAYS     = 50;

function numOrNull(v: unknown, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.floor(n);
}

function isBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function isServiceType(v: unknown): v is ReservationServiceType {
  return typeof v === "string" && (SERVICE_TYPES as string[]).includes(v);
}

// ── Normalizers ──────────────────────────────────────────────────────────────

function normalizeWorkBays(raw: unknown): WorkBay[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkBay[] = [];
  raw.slice(0, MAX_BAYS).forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const o = b as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) return; // skip nameless bays
    const id = typeof o.id === "string" && o.id.trim() !== "" ? o.id.trim() : `bay_${i}`;
    out.push({ id, name, active: isBool(o.active, true) });
  });
  return out;
}

function normalizeCapacity(raw: unknown): CapacitySettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pw = (o.parallel_work && typeof o.parallel_work === "object" ? o.parallel_work : {}) as Record<string, unknown>;
  return {
    simultaneous_vehicles: numOrNull(o.simultaneous_vehicles, MAX_VEHICLES),
    work_bays: normalizeWorkBays(o.work_bays),
    parallel_work: {
      allow_multi_bay: isBool(pw.allow_multi_bay, false),
      max_parallel_per_staff: numOrNull(pw.max_parallel_per_staff, MAX_PARALLEL),
    },
  };
}

function normalizeStaffEntry(raw: unknown): StaffCapacityEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const skills = Array.isArray(o.skills)
    ? Array.from(new Set((o.skills as unknown[]).filter(isServiceType)))
    : [];
  return {
    bookable: isBool(o.bookable, true),
    daily_capacity: numOrNull(o.daily_capacity, MAX_DAILY),
    skills,
  };
}

export function normalizeStaffCapacityMap(raw: unknown): StaffCapacityMap {
  const out: StaffCapacityMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const entry = normalizeStaffEntry(v);
    if (entry) out[k] = entry;
  }
  return out;
}

function normalizeRules(raw: unknown): SchedulingRules {
  const def = defaultStaffCapacitySettings().rules;
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const c = (o.conflict && typeof o.conflict === "object" ? o.conflict : {}) as Record<string, unknown>;
  const conflict: ConflictRules = {
    mode: c.mode === "off" ? "off" : "warn", // never "block" in B3
    warn_staff_overlap: isBool(c.warn_staff_overlap, def.conflict.warn_staff_overlap),
    warn_bay_overlap: isBool(c.warn_bay_overlap, def.conflict.warn_bay_overlap),
    warn_capacity_exceeded: isBool(c.warn_capacity_exceeded, def.conflict.warn_capacity_exceeded),
  };

  const b = (o.blocking && typeof o.blocking === "object" ? o.blocking : {}) as Record<string, unknown>;
  const blocked_combinations: Array<[ReservationServiceType, ReservationServiceType]> = [];
  if (Array.isArray(b.blocked_combinations)) {
    for (const pair of b.blocked_combinations as unknown[]) {
      if (Array.isArray(pair) && pair.length === 2 && isServiceType(pair[0]) && isServiceType(pair[1])) {
        blocked_combinations.push([pair[0], pair[1]]);
      }
    }
  }

  const ov = (o.override && typeof o.override === "object" ? o.override : {}) as Record<string, unknown>;
  const allowed = Array.isArray(ov.allowed_roles)
    ? (ov.allowed_roles as unknown[]).filter((r): r is "owner" | "manager" => r === "owner" || r === "manager")
    : def.override.allowed_roles;
  const override: OverrideRules = {
    require_reason: isBool(ov.require_reason, def.override.require_reason),
    // Owner may always override — guarantee it is present.
    allowed_roles: Array.from(new Set<"owner" | "manager">(["owner", ...allowed])),
  };

  return { conflict, blocking: { blocked_combinations }, override };
}

export function normalizeStaffCapacitySettings(raw: unknown): StaffCapacitySettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    capacity: normalizeCapacity(o.capacity),
    staff_capacity: normalizeStaffCapacityMap(o.staff_capacity),
    rules: normalizeRules(o.rules),
  };
}

/** Drop per-staff entries whose id is not in the dealer's live staff set. */
export function reconcileStaffCapacity(map: StaffCapacityMap, validStaffIds: Set<string>): StaffCapacityMap {
  const out: StaffCapacityMap = {};
  for (const [id, entry] of Object.entries(map)) {
    if (validStaffIds.has(id)) out[id] = entry;
  }
  return out;
}

// ── Soft capacity warnings (Batch B4) ────────────────────────────────────────
//
// Pure: given how many EXISTING reservations overlap the selected time range and
// the configured scheduling rules, return human-readable SOFT warnings. Never
// blocks; returns [] when the conflict preference is off. No persistent staff/bay
// assignment exists, so warnings are derived from the overlap count + config only.

export interface CapacityWarningContext {
  /** B5a: overlapping reservations that share the selected assigned_staff_id.
   *  null when no staff is selected — the warning falls back to the generic
   *  overlap count. */
  staffOverlapCount?: number | null;
}

export function computeCapacityWarnings(
  overlapCount: number,
  settings: StaffCapacitySettings,
  ctx?: CapacityWarningContext,
): string[] {
  const { conflict } = settings.rules;
  if (conflict.mode === "off") return [];

  const warnings: string[] = [];
  const projected = overlapCount + 1; // include the reservation being created/edited

  if (
    conflict.warn_capacity_exceeded &&
    settings.capacity.simultaneous_vehicles !== null &&
    projected > settings.capacity.simultaneous_vehicles
  ) {
    warnings.push(
      `同時対応台数（${settings.capacity.simultaneous_vehicles}台）を超える可能性があります。この時間帯には既に${overlapCount}件の予約があります。`,
    );
  }

  const activeBays = settings.capacity.work_bays.filter((b) => b.active).length;
  if (conflict.warn_bay_overlap && activeBays > 0 && projected > activeBays) {
    warnings.push(`稼働中の作業ベイ数（${activeBays}）を超える可能性があります。`);
  }

  if (conflict.warn_staff_overlap) {
    const staffOverlap = ctx?.staffOverlapCount ?? null;
    if (staffOverlap !== null) {
      // Precise: a specific technician is selected (B5a).
      if (staffOverlap > 0) {
        warnings.push(`選択した担当スタッフは同じ時間帯に${staffOverlap}件の予約があります。`);
      }
    } else if (overlapCount > 0) {
      // Fallback: no technician selected — generic overlap notice.
      warnings.push(`選択した時間帯に重複する予約が${overlapCount}件あります。`);
    }
  }

  return warnings;
}
