// GYEON Business Hub — Settings Save Action Types (Sprint 12J, updated Sprint 12L)
//
// Pure type definitions for the Settings Center save action registry.
// No execution, no DB calls, no persistence. Foundation only.
//
// Purpose:
//   Declares which settings sections have safe save flows, which are
//   read-only, and what role policy governs each action. Consumed by
//   SettingsCategoryPageView to drive UI save state and role-based gating.

import type { SettingsCategoryId } from "../settings-types";

// ─── Save action identity ─────────────────────────────────────────────────────

export type SettingsSaveActionId =
  | "company_info"              // saveCompanySettings — dealer, branding
  | "line_connection"           // upsertDealerSettings — communication
  | "line_rich_menu"            // saveLineRichMenuConfig — communication
  | "line_rich_menu_publish"    // publishLineRichMenu — communication (LINE API call)
  | "line_rich_menu_delete"     // deleteLineRichMenu — communication (LINE API call)
  | "document_sequences"        // updateDocumentSequence — pdf
  | "staff_invite"              // inviteStaff — staff
  | "staff_role_update"         // updateStaffRole — staff
  | "staff_disable"             // disableStaff / enableStaff — staff
  | "ai_gateway_settings"       // saveAiSettings — ai_providers (/settings/ai route)
  | "dealer_rank"               // setDealerRank — admin-only, not in dealer UI
  | "line_message_settings"     // PHASE70 — LINE message header/footer — not yet implemented
  | "ocr_policy"                // PHASE70 — OCR enable/disable flag — not yet implemented
  | "maintenance_templates"     // PHASE70 — maintenance reminder templates — not yet implemented
  ;

// ─── Save action status ───────────────────────────────────────────────────────

// Describes whether a given settings section can be written right now.
export type SettingsSaveActionStatus =
  | "writable_now"                   // safe existing server action is connected
  | "read_only"                      // no write path — display only
  | "future"                         // planned but not yet implemented
  | "requires_migration"             // write path exists but needs a DB migration
  | "requires_admin"                 // platform admin only — not in dealer UI
  | "external_integration_required"  // depends on external API setup (e.g., LINE channel)
  ;

// ─── Role policy ─────────────────────────────────────────────────────────────

// Minimum role required to interact with the save action.
// "UI policy" — what the UI enforces. Server enforcement may differ (documented per action).
export type SettingsSaveActionPolicy =
  | "any_authenticated"   // getCurrentDealer() only — no staff role check (gap documented)
  | "manager_or_owner"    // owner or manager can edit; staff/readonly get read-only view
  | "owner_only"          // owner only
  | "platform_admin"      // requireAdmin() — not accessible from dealer-facing UI
  ;

// ─── Save action descriptor ───────────────────────────────────────────────────

export interface SettingsSaveAction {
  action_id:              SettingsSaveActionId;
  display_name:           string;
  category_ids:           SettingsCategoryId[];
  status:                 SettingsSaveActionStatus;
  server_action_path:     string | null;
  ui_role_policy:         SettingsSaveActionPolicy;
  // true = server action enforces role via requireRole() or requireAdmin()
  // false = server only checks getCurrentDealer() — role enforcement deferred
  has_server_role_check:  boolean;
  // true = all DB writes are scoped to the authenticated dealer_id from server session
  dealer_scope:           boolean;
  // true = requires platform admin — not accessible from dealer-facing routes
  admin_scope:            boolean;
  // null = pure DB write; string = name of external system the action depends on
  external_dependency:    string | null;
  notes:                  string;
}

// ─── Registry type ────────────────────────────────────────────────────────────

export type SettingsSaveActionRegistry = Readonly<Record<SettingsSaveActionId, SettingsSaveAction>>;
