// UX-2B — dealer-facing settings status vocabulary.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The settings detail pages used to describe themselves from a STATIC registry:
// an entry said `writable_now`, so the screen printed 保存可能 — whether or not
// the data behind it had actually loaded and whether or not the operator could
// save anything. A green state asserted from a constant is not a status; it is a
// label that happens to be the same colour as one.
//
// Everything here is therefore evidence-driven. A state may only be produced from
// something the page actually observed: a read that succeeded or failed, a role
// that was resolved or could not be, a required value that is present or absent.
//
// ── WHAT 保存可能 MEANS ─────────────────────────────────────────────────────
// “The current user may save, and the state behind this group is healthy.” It is
// NOT a claim that the configuration is complete. Nothing in this file maps it to
// 設定済み, and nothing should.
//
// ── ERROR CODES ────────────────────────────────────────────────────────────
// Codes are per FAILURE CATEGORY, never per page or table, so adding a settings
// page can never shift the meaning of an existing code. The operator sees only
// the code; the cause stays in server logs / observability.
//
// ACTIVE IN THIS PHASE:
//   SET-1001  read failure          — a settings read threw
//   SET-1003  permission-check failure — the ROLE could not be resolved (this is
//             not a denial; a denial is a normal answer and carries no code)
//
// DEFERRED TO UX-2C (deliberately absent from the union below, so no code path
// in this phase can emit them):
//   SET-1002  save/write failure       — needs server-action result plumbing
//   SET-1004  external-integration failure — needs a live connectivity probe
// Adding either one here without its evidence source would recreate the exact
// defect this file exists to remove.

/** Failure categories a dealer-facing settings screen can currently prove. */
export type SettingsStatusCode = "SET-1001" | "SET-1003";

/**
 * The ONLY sentence shown to a dealer for a failure. It names no table, role,
 * RPC, SQLSTATE or server string — those belong in the logs, not on screen.
 */
export function settingsFailureMessageJa(code: SettingsStatusCode): string {
  return `保存状態を確認できません。管理者に報告してください。（エラー番号：${code}）`;
}

// ─── Typed read results ──────────────────────────────────────────────────────

/**
 * A read either produced a value or failed. The distinction matters: `null` from
 * a swallowed catch is indistinguishable from “this dealer has no row yet”, and
 * that ambiguity is what made an honest status impossible.
 */
export type SettingsRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: SettingsStatusCode };

export const readOk = <T,>(value: T): SettingsRead<T> => ({ ok: true, value });
export const readFailed = <T,>(code: SettingsStatusCode): SettingsRead<T> => ({ ok: false, code });

/** Unwrap for consumers that legitimately cannot distinguish (existing forms). */
export function readValueOr<T>(read: SettingsRead<T>, fallback: T): T {
  return read.ok ? read.value : fallback;
}

// ─── Group status ────────────────────────────────────────────────────────────

/**
 * The state of ONE settings group inside the header's 設定状況 area.
 *
 * Ordered by the precedence the view applies:
 *   failure → permission denial → non-error availability → incomplete → writable
 * A failure always wins; a screen with evidence of a problem never shows green.
 */
export type SettingsGroupStatus =
  /** A read or the permission check failed. Carries the code shown to the user. */
  | { readonly kind: "failure"; readonly code: SettingsStatusCode }
  /** The role was resolved and is not permitted to save. A normal answer, not an error. */
  | { readonly kind: "denied" }
  /** Not writable yet for a declared, non-error reason (future / migration / admin / external). */
  | { readonly kind: "unavailable"; readonly labelJa: string }
  /** Writable, but a required value is missing. Names the item and the reason. */
  | { readonly kind: "incomplete"; readonly reasonJa: string }
  /** Healthy and writable by this user. Says nothing about completeness. */
  | { readonly kind: "writable" };

/** The short Japanese text rendered for a group status. */
export function groupStatusLabelJa(status: SettingsGroupStatus): string {
  switch (status.kind) {
    case "failure":     return settingsFailureMessageJa(status.code);
    case "denied":      return "保存権限がありません";
    case "unavailable": return status.labelJa;
    case "incomplete":  return status.reasonJa;
    case "writable":    return "保存可能";
  }
}

/** Tone only — the state is always readable as text, never colour alone. */
export function groupStatusToneClass(status: SettingsGroupStatus): string {
  switch (status.kind) {
    case "failure":     return "bg-red-950/25 text-red-300 border-red-500/25";
    case "denied":      return "bg-slate-800 text-slate-400 border-slate-700";
    case "unavailable": return "bg-slate-800 text-slate-500 border-slate-700";
    case "incomplete":  return "bg-amber-950/25 text-amber-300 border-amber-500/25";
    case "writable":    return "bg-emerald-950/30 text-emerald-400 border-emerald-500/25";
  }
}

// ─── Role wording ────────────────────────────────────────────────────────────

/**
 * The only role fact a dealer sees, in their own words. Raw role identifiers
 * (`owner`, `manager`, …) and visibility levels never reach the screen.
 */
export function dealerRoleLabelJa(role: string | null): string | null {
  switch (role) {
    case "owner":    return "オーナー";
    case "manager":  return "マネージャー";
    case "staff":    return "スタッフ";
    case "readonly": return "閲覧のみ";
    default:         return null;
  }
}

/** Roles permitted to save a `manager_or_owner` settings group. */
export function canSaveAsRole(role: string | null): boolean {
  return role === "owner" || role === "manager";
}
