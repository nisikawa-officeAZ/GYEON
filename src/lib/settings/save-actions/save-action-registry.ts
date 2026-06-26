// GYEON Business Hub — Settings Save Action Registry (Sprint 12J)
//
// Declarative registry of all settings save flows — their status, role
// requirements, and coverage. No execution from this module.
//
// Key findings from Phase B (existing server action audit):
//
//   FULLY SAFE (dealer_id from getCurrentDealer + server role check):
//     inviteStaff, updateStaffRole, disableStaff — requireRole() enforced
//     saveLineRichMenuConfig                    — checkFeatureAccess(Pro+)
//     saveAiSettings                            — checkFeatureAccess(Pro+) + encryption
//     setDealerRank                             — requireAdmin() (platform admin only)
//
//   PARTIALLY SAFE (dealer_id safe, role check missing — Sprint 13):
//     saveCompanySettings  — getCurrentDealer() ✓, no role check ⚠
//     upsertDealerSettings — getCurrentDealer() ✓, no role check ⚠
//     updateDocumentSequence — getCurrentDealer() ✓, no role check ⚠
//
// Sprint 12J connects the safe flows with UI-level role gating for the
// partially-safe ones. Full server enforcement tracked for Sprint 13.

import type { SettingsSaveAction, SettingsSaveActionId, SettingsSaveActionRegistry } from "./save-action-types";
import type { SettingsCategoryId } from "../settings-types";

export const SETTINGS_SAVE_ACTION_REGISTRY: SettingsSaveActionRegistry = {

  company_info: {
    action_id:             "company_info",
    display_name:          "Company & Store Settings",
    category_ids:          ["dealer", "branding"],
    status:                "writable_now",
    server_action_path:    "src/lib/company/save-company-settings.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    notes:
      "saveCompanySettings upserts dealer_settings (business_name, address, logo, stamp, etc.). " +
      "dealer_id from getCurrentDealer() — safe. No server role check yet. " +
      "UI gates to manager+ only. Full server enforcement Sprint 13.",
  },

  line_connection: {
    action_id:             "line_connection",
    display_name:          "LINE Channel Connection",
    category_ids:          ["communication"],
    status:                "external_integration_required",
    server_action_path:    "src/lib/line/update-line-settings.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    notes:
      "upsertDealerSettings writes LINE channel credentials (channel_id, liff_id, webhook_url). " +
      "Requires LINE Developer Console setup before credentials can be entered. " +
      "dealer_id from getCurrentDealer() — safe. No server role check — Sprint 13. " +
      "Managed from /line page, not exposed in /settings/communication.",
  },

  line_rich_menu: {
    action_id:             "line_rich_menu",
    display_name:          "LINE Rich Menu Configuration",
    category_ids:          ["communication"],
    status:                "writable_now",
    server_action_path:    "src/lib/line/save-line-rich-menu-config.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    notes:
      "saveLineRichMenuConfig enforces Pro+ feature gate (checkFeatureAccess). " +
      "dealer_id from getCurrentDealer() — safe. Preserves existing rich_menu_id. " +
      "No staff-role gate at server level — Sprint 13.",
  },

  document_sequences: {
    action_id:             "document_sequences",
    display_name:          "Document Sequence Settings",
    category_ids:          ["pdf"],
    status:                "writable_now",
    server_action_path:    "src/lib/numbering/update-document-sequence.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    notes:
      "updateDocumentSequence writes prefix/padding/reset_policy. " +
      "current_number is never directly writable via this action. " +
      "dealer_id from getCurrentDealer() — safe. No role gate — Sprint 13.",
  },

  staff_invite: {
    action_id:             "staff_invite",
    display_name:          "Staff Invite",
    category_ids:          ["staff"],
    status:                "writable_now",
    server_action_path:    "src/lib/staff/invite-staff.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    notes:
      "inviteStaff enforces role hierarchy server-side via requireRole(['owner','manager']). " +
      "Manager cannot invite owner/manager — can only invite staff/readonly.",
  },

  staff_role_update: {
    action_id:             "staff_role_update",
    display_name:          "Staff Role Update",
    category_ids:          ["staff"],
    status:                "writable_now",
    server_action_path:    "src/lib/staff/update-staff-role.ts",
    ui_role_policy:        "owner_only",
    has_server_role_check: true,
    notes:
      "updateStaffRole enforces requireRole(['owner']) server-side. " +
      "Prevents last-owner demotion. Action is audit-logged.",
  },

  staff_disable: {
    action_id:             "staff_disable",
    display_name:          "Staff Enable / Disable",
    category_ids:          ["staff"],
    status:                "writable_now",
    server_action_path:    "src/lib/staff/disable-staff.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    notes:
      "disableStaff/enableStaff enforce requireRole(['owner','manager']) server-side. " +
      "Manager cannot disable other managers or owners. Prevents last-owner disable. Audit-logged.",
  },

  ai_gateway_settings: {
    action_id:             "ai_gateway_settings",
    display_name:          "AI Gateway Settings",
    category_ids:          ["ai_providers"],
    status:                "writable_now",
    server_action_path:    "src/lib/ai/save-ai-settings.ts",
    ui_role_policy:        "owner_only",
    has_server_role_check: true,
    notes:
      "saveAiSettings requires Pro+ feature access server-side (checkFeatureAccess). " +
      "API keys are encrypted with AES-256-GCM before storage. " +
      "Managed via /settings/ai dedicated route — not embedded in /settings/ai_providers.",
  },

  dealer_rank: {
    action_id:             "dealer_rank",
    display_name:          "Dealer Rank Assignment",
    category_ids:          ["dealer"],
    status:                "requires_admin",
    server_action_path:    "src/lib/dealer-settings/set-dealer-rank.ts",
    ui_role_policy:        "platform_admin",
    has_server_role_check: true,
    notes:
      "setDealerRank uses requireAdmin() and service-role client. " +
      "Platform admin only — managed via /admin panel. Not exposed in dealer-facing settings UI.",
  },

} as const;

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getSaveActionsForCategory(
  categoryId: SettingsCategoryId,
): SettingsSaveAction[] {
  return (Object.values(SETTINGS_SAVE_ACTION_REGISTRY) as SettingsSaveAction[]).filter(
    action => action.category_ids.includes(categoryId),
  );
}

// Returns the most permissive writable status for a category.
// Returns null if no save actions registered for this category.
export function getCategorySaveStatus(
  categoryId: SettingsCategoryId,
): SettingsSaveAction["status"] | null {
  const actions = getSaveActionsForCategory(categoryId);
  if (actions.length === 0) return null;
  if (actions.some(a => a.status === "writable_now")) return "writable_now";
  if (actions.some(a => a.status === "external_integration_required")) return "external_integration_required";
  if (actions.some(a => a.status === "requires_migration")) return "requires_migration";
  if (actions.some(a => a.status === "requires_admin")) return "requires_admin";
  if (actions.some(a => a.status === "read_only")) return "read_only";
  return "future";
}

// Returns true if staffRole meets the minimum policy for editing a category.
// Used for UI-level role gating (not a substitute for server enforcement).
export function canEditWithRole(
  staffRole: "owner" | "manager" | "staff" | "readonly" | null | undefined,
  policy: SettingsSaveAction["ui_role_policy"],
): boolean {
  if (policy === "platform_admin") return false;
  if (policy === "owner_only") return staffRole === "owner";
  if (policy === "manager_or_owner") return staffRole === "owner" || staffRole === "manager";
  // "any_authenticated" — allow owner/manager/staff, not readonly/null
  return staffRole === "owner" || staffRole === "manager" || staffRole === "staff";
}
