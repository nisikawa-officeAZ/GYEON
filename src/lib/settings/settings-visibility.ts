// GYEON Business Hub — Unified Settings Center: Visibility Model (Sprint 12F)
//
// Defines the 6-level visibility model for settings access control.
//
// Visibility levels form a strict hierarchy:
//   platform_admin > company_admin > dealer_owner > manager > staff > readonly
//
// A user with level X can see all settings at level X and below.
// A user with an unknown role MUST be treated as having NO access to sensitive settings.
//
// Key rule (SPOL-004): Any unresolved or unknown role defaults to readonly access.
// Only settings with min_visibility = "readonly" may be shown to unknown roles.
//
// This module provides:
//   - SettingsVisibilityLevel type (in settings-types.ts)
//   - VISIBILITY_LEVEL_ORDER — numeric rank per level (higher = more privileged)
//   - VISIBILITY_DESCRIPTORS — metadata per level
//   - canViewSetting() — compile-safe visibility gate
//   - resolveVisibilityFromRole() — maps DealerStaffRole to SettingsVisibilityLevel
//
// No runtime enforcement in Sprint 12F. These functions are pure utilities.
// Runtime enforcement is implemented in Sprint 13 via server actions.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { SettingsVisibilityLevel } from "./settings-types";
import type { DealerStaffRole } from "@/lib/staff/staff-types";

// ─── Level ordering ────────────────────────────────────────────────────────────

/**
 * Numeric rank for each visibility level.
 * Higher number = more privileged.
 * Used for comparison: userLevel >= requiredLevel → access granted.
 */
export const VISIBILITY_LEVEL_ORDER: Record<SettingsVisibilityLevel, number> = {
  readonly:       1,
  staff:          2,
  manager:        3,
  dealer_owner:   4,
  company_admin:  5,
  platform_admin: 6,
};

// ─── Level descriptors ────────────────────────────────────────────────────────

export interface SettingsVisibilityDescriptor {
  level:          SettingsVisibilityLevel;
  display_name:   string;
  display_name_ja: string;
  description:    string;
  /** Can modify settings at this level (not just view). */
  can_modify:     boolean;
  /** Is this a platform-internal level (not dealer-facing). */
  platform_internal: boolean;
  /** Maps to existing DealerStaffRole. null = no direct mapping. */
  staff_role_equivalent: DealerStaffRole | null;
}

export const VISIBILITY_DESCRIPTORS: SettingsVisibilityDescriptor[] = [
  {
    level:          "readonly",
    display_name:   "Read Only",
    display_name_ja: "閲覧のみ",
    description:
      "Can view a limited set of settings relevant to their work. " +
      "Cannot modify any setting. Appropriate for temporary staff or auditors.",
    can_modify:     false,
    platform_internal: false,
    staff_role_equivalent: "readonly",
  },
  {
    level:          "staff",
    display_name:   "Staff",
    display_name_ja: "スタッフ",
    description:
      "Can view basic operational settings — service menu, pricing display, " +
      "OCR configuration, and reminder templates. Cannot access billing or AI secrets.",
    can_modify:     false,    // Staff view but owner/manager configures
    platform_internal: false,
    staff_role_equivalent: "staff",
  },
  {
    level:          "manager",
    display_name:   "Manager",
    display_name_ja: "マネージャー",
    description:
      "Can view and configure operational settings — LINE integration, " +
      "notification channels, document formatting, and analytics preferences. " +
      "Cannot access billing, AI provider secrets, or organization settings.",
    can_modify:     true,
    platform_internal: false,
    staff_role_equivalent: "manager",
  },
  {
    level:          "dealer_owner",
    display_name:   "Dealer Owner",
    display_name_ja: "オーナー",
    description:
      "Full access to all dealer-level settings including billing, AI configuration, " +
      "staff management, and business identity. Cannot access organization-level or " +
      "company-wide settings.",
    can_modify:     true,
    platform_internal: false,
    staff_role_equivalent: "owner",
  },
  {
    level:          "company_admin",
    display_name:   "Company Admin",
    display_name_ja: "会社管理者",
    description:
      "Access to company-level settings spanning multiple dealer shops. " +
      "Can configure organization structure, enterprise applications (Distribution, " +
      "Warehouse, CRM, Accounting), and company billing.",
    can_modify:     true,
    platform_internal: false,
    staff_role_equivalent: null,  // No current DealerStaffRole equivalent
  },
  {
    level:          "platform_admin",
    display_name:   "Platform Admin",
    display_name_ja: "プラットフォーム管理者",
    description:
      "GYEON platform administrator. Full access to all settings including " +
      "system configuration, feature flags, and support tooling. " +
      "MUST NOT be rendered in dealer-facing settings UI (SPOL-005).",
    can_modify:     true,
    platform_internal: true,
    staff_role_equivalent: null,
  },
] as const satisfies SettingsVisibilityDescriptor[];

// ─── Visibility utilities ─────────────────────────────────────────────────────

/**
 * Returns true if a user at `userLevel` can view a setting requiring `requiredLevel`.
 *
 * Core rule: userLevel >= requiredLevel (by numeric rank).
 *
 * Special case: null userLevel (unresolved role) → can only view readonly settings.
 * This enforces SPOL-004: unknown roles receive no access to sensitive settings.
 */
export function canViewSetting(
  userLevel:     SettingsVisibilityLevel | null,
  requiredLevel: SettingsVisibilityLevel,
): boolean {
  if (userLevel === null) {
    // Unknown role — only readonly settings are accessible
    return requiredLevel === "readonly";
  }
  return VISIBILITY_LEVEL_ORDER[userLevel] >= VISIBILITY_LEVEL_ORDER[requiredLevel];
}

/**
 * Returns true if a user at `userLevel` can modify a setting requiring `requiredLevel`.
 *
 * Modification requires both:
 *   1. Sufficient visibility level (canViewSetting)
 *   2. The user's level descriptor has can_modify = true
 */
export function canModifySetting(
  userLevel:     SettingsVisibilityLevel | null,
  requiredLevel: SettingsVisibilityLevel,
): boolean {
  if (!canViewSetting(userLevel, requiredLevel)) return false;
  if (userLevel === null) return false;
  const descriptor = VISIBILITY_DESCRIPTORS.find(d => d.level === userLevel);
  return descriptor?.can_modify ?? false;
}

/**
 * Maps a DealerStaffRole (from the existing staff module) to a SettingsVisibilityLevel.
 *
 * Mapping:
 *   owner    → dealer_owner
 *   manager  → manager
 *   staff    → staff
 *   readonly → readonly
 *
 * If the role is null or unrecognized, returns null (triggering SPOL-004 default deny).
 */
export function resolveVisibilityFromRole(
  role: DealerStaffRole | null | undefined,
): SettingsVisibilityLevel | null {
  switch (role) {
    case "owner":    return "dealer_owner";
    case "manager":  return "manager";
    case "staff":    return "staff";
    case "readonly": return "readonly";
    default:         return null;  // Unknown role → SPOL-004 default deny
  }
}

/**
 * Returns all settings categories visible at the given level.
 * Used to build the settings index view for a specific user.
 * Categories with min_visibility > userLevel are excluded.
 */
export function getVisibilityDescriptor(
  level: SettingsVisibilityLevel,
): SettingsVisibilityDescriptor | undefined {
  return VISIBILITY_DESCRIPTORS.find(d => d.level === level);
}

/**
 * Returns all levels a given user level can access (inclusive).
 * Useful for building visibility filter predicates.
 */
export function getAccessibleLevels(
  userLevel: SettingsVisibilityLevel | null,
): SettingsVisibilityLevel[] {
  if (userLevel === null) return ["readonly"];
  const userRank = VISIBILITY_LEVEL_ORDER[userLevel];
  return VISIBILITY_DESCRIPTORS
    .filter(d => VISIBILITY_LEVEL_ORDER[d.level] <= userRank)
    .map(d => d.level);
}

/**
 * Returns true if the given visibility level is platform-internal.
 * Platform-internal levels must not appear in dealer-facing UI (SPOL-005).
 */
export function isPlatformInternal(level: SettingsVisibilityLevel): boolean {
  return getVisibilityDescriptor(level)?.platform_internal ?? false;
}
