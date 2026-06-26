// GYEON Business Hub — Settings Save Action Registry (Sprint 12L)
//
// Declarative registry of all settings save flows — their status, role
// requirements, and coverage. No execution from this module.
//
// Sprint 12J audit findings:
//   FULLY SAFE (dealer_id from getCurrentDealer + server role check):
//     inviteStaff, updateStaffRole, disableStaff — requireRole() enforced
//     setDealerRank                               — requireAdmin() (platform admin only)
//
//   PARTIALLY SAFE — role check missing (Sprint 12J/12K gaps):
//     saveCompanySettings    — getCurrentDealer() ✓, no role check ⚠  → fixed Sprint 12K
//     upsertDealerSettings   — getCurrentDealer() ✓, no role check ⚠  → fixed Sprint 12K
//     updateDocumentSequence — getCurrentDealer() ✓, no role check ⚠  → fixed Sprint 12K
//     saveLineRichMenuConfig — Pro+ gate only, no role check ⚠         → fixed Sprint 12L
//     publishLineRichMenu    — Pro+ gate only, no role check ⚠         → fixed Sprint 12L
//     deleteLineRichMenu     — Pro+ gate only, no role check ⚠         → fixed Sprint 12L
//     saveAiSettings         — Pro+ gate only, no role check ⚠         → fixed Sprint 12L
//
// Sprint 12L status: all dealer-facing write paths now have server-side role enforcement.
// No known server-side authorization gaps remain for Phase 1 features.

import type { SettingsSaveAction, SettingsSaveActionId, SettingsSaveActionRegistry } from "./save-action-types";
import type { SettingsCategoryId } from "../settings-types";

export const SETTINGS_SAVE_ACTION_REGISTRY: SettingsSaveActionRegistry = {

  // ─── Company / Branding ────────────────────────────────────────────────────

  company_info: {
    action_id:             "company_info",
    display_name:          "Company & Store Settings",
    category_ids:          ["dealer", "branding"],
    status:                "writable_now",
    server_action_path:    "src/lib/company/save-company-settings.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "saveCompanySettings upserts dealer_settings (business_name, address, logo, stamp, etc.). " +
      "dealer_id from requireRole → getCurrentDealer() — safe. " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12K). " +
      "staff/readonly/unknown roles receive 権限エラー and the write is rejected.",
  },

  // ─── LINE Channel Credentials ─────────────────────────────────────────────

  line_connection: {
    action_id:             "line_connection",
    display_name:          "LINE Channel Connection",
    category_ids:          ["communication"],
    status:                "external_integration_required",
    server_action_path:    "src/lib/line/update-line-settings.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   "LINE Developers Console",
    notes:
      "upsertDealerSettings writes LINE channel credentials (channel_id, liff_id, webhook_url, " +
      "channel_secret, access_token). Requires LINE Developer Console setup before credentials " +
      "can be entered. dealer_id from requireRole → getCurrentDealer() — safe. " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12K). " +
      "Managed from /line page, not exposed in /settings/communication panel.",
  },

  // ─── LINE Rich Menu ───────────────────────────────────────────────────────

  line_rich_menu: {
    action_id:             "line_rich_menu",
    display_name:          "LINE Rich Menu Configuration",
    category_ids:          ["communication"],
    status:                "writable_now",
    server_action_path:    "src/lib/line/save-line-rich-menu-config.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "saveLineRichMenuConfig writes rich menu layout config to dealer_settings.line_public_settings. " +
      "Requires Pro+ (checkFeatureAccess). Preserves existing rich_menu_id — only publish/delete touch it. " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12L). " +
      "Pure DB write — no LINE API call at config-save time.",
  },

  line_rich_menu_publish: {
    action_id:             "line_rich_menu_publish",
    display_name:          "LINE Rich Menu Publish",
    category_ids:          ["communication"],
    status:                "writable_now",
    server_action_path:    "src/lib/line/publish-line-rich-menu.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   "LINE Messaging API",
    notes:
      "publishLineRichMenu creates/uploads rich menu via LINE API and sets it as default. " +
      "Requires Pro+ (checkFeatureAccess) and active LINE channel (line_enabled + line_access_token). " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12L). " +
      "line_access_token is read server-side only — never returned to client.",
  },

  line_rich_menu_delete: {
    action_id:             "line_rich_menu_delete",
    display_name:          "LINE Rich Menu Delete",
    category_ids:          ["communication"],
    status:                "writable_now",
    server_action_path:    "src/lib/line/delete-line-rich-menu.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   "LINE Messaging API",
    notes:
      "deleteLineRichMenu removes the default rich menu via LINE API and clears rich_menu_id in DB. " +
      "Requires Pro+ (checkFeatureAccess). LINE API calls are best-effort (failures are caught/ignored). " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12L).",
  },

  // ─── Document Sequences ───────────────────────────────────────────────────

  document_sequences: {
    action_id:             "document_sequences",
    display_name:          "Document Sequence Settings",
    category_ids:          ["pdf"],
    status:                "writable_now",
    server_action_path:    "src/lib/numbering/update-document-sequence.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "updateDocumentSequence writes prefix/padding/reset_policy for estimate/invoice/etc. sequences. " +
      "current_number is never directly writable via this action. " +
      "dealer_id from requireRole → getCurrentDealer() — safe. " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12K).",
  },

  // ─── Staff Management ─────────────────────────────────────────────────────

  staff_invite: {
    action_id:             "staff_invite",
    display_name:          "Staff Invite",
    category_ids:          ["staff"],
    status:                "writable_now",
    server_action_path:    "src/lib/staff/invite-staff.ts",
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "inviteStaff enforces role hierarchy server-side via requireRole([\"owner\",\"manager\"]). " +
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
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "updateStaffRole enforces requireRole([\"owner\"]) server-side. " +
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
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "disableStaff/enableStaff enforce requireRole([\"owner\",\"manager\"]) server-side. " +
      "Manager cannot disable other managers or owners. Prevents last-owner disable. Audit-logged.",
  },

  // ─── AI Gateway ───────────────────────────────────────────────────────────

  ai_gateway_settings: {
    action_id:             "ai_gateway_settings",
    display_name:          "AI Gateway Settings",
    category_ids:          ["ai_providers"],
    status:                "writable_now",
    server_action_path:    "src/lib/ai/save-ai-settings.ts",
    ui_role_policy:        "owner_only",
    has_server_role_check: true,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "saveAiSettings requires Pro+ feature access server-side (checkFeatureAccess). " +
      "API keys are encrypted with AES-256-GCM before storage (DEALER_AI_KEY_SECRET). " +
      "requireRole([\"owner\",\"manager\"]) enforced server-side (Sprint 12L). " +
      "Managed via /settings/ai dedicated route — not embedded in /settings/ai_providers.",
  },

  // ─── Platform Admin ───────────────────────────────────────────────────────

  dealer_rank: {
    action_id:             "dealer_rank",
    display_name:          "Dealer Rank Assignment",
    category_ids:          ["dealer"],
    status:                "requires_admin",
    server_action_path:    "src/lib/dealer-settings/set-dealer-rank.ts",
    ui_role_policy:        "platform_admin",
    has_server_role_check: true,
    dealer_scope:          false,
    admin_scope:           true,
    external_dependency:   null,
    notes:
      "setDealerRank uses requireAdmin() and service-role client. " +
      "Platform admin only — managed via /admin panel. Not exposed in dealer-facing settings UI.",
  },

  // ─── PHASE70 — Future write paths (not yet implemented) ───────────────────
  // These entries declare intent and security requirements.
  // No server actions exist for these yet — status: "future".
  // Do NOT add fake save behavior or client-only stubs.

  line_message_settings: {
    action_id:             "line_message_settings",
    display_name:          "LINE Message Header / Footer",
    category_ids:          ["communication"],
    status:                "future",
    server_action_path:    null,
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "PHASE70: LINE message templates (header text, footer text, maintenance notice text). " +
      "Fields visible read-only in UI with PHASE70 badge. " +
      "When implemented: must use requireRole([\"owner\",\"manager\"]) and write to " +
      "dealer_settings.line_public_settings.message_templates. No DB migration needed.",
  },

  ocr_policy: {
    action_id:             "ocr_policy",
    display_name:          "OCR Enable / Disable",
    category_ids:          ["ocr"],
    status:                "future",
    server_action_path:    null,
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "PHASE70: OCR enable/disable toggle and policy settings. " +
      "OCR category currently shows read-only display panel. " +
      "When implemented: must use requireRole([\"owner\",\"manager\"]) and write to " +
      "dealer_settings (ocr_enabled flag). May require DB migration for new columns.",
  },

  maintenance_templates: {
    action_id:             "maintenance_templates",
    display_name:          "Maintenance Reminder Templates",
    category_ids:          ["notifications"],
    status:                "future",
    server_action_path:    null,
    ui_role_policy:        "manager_or_owner",
    has_server_role_check: false,
    dealer_scope:          true,
    admin_scope:           false,
    external_dependency:   null,
    notes:
      "PHASE70: Editable reminder message templates (12-month, 18-month, etc.). " +
      "Currently shown as read-only defaults in notifications panel. " +
      "When implemented: must use requireRole([\"owner\",\"manager\"]) and write to " +
      "dealer_settings.reminder_templates jsonb. May require DB migration.",
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
