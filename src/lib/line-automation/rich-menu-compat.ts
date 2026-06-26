// DealerOS — LINE Automation Platform: Rich Menu Compatibility (Sprint 11G Phase F)
//
// Defines the Rich Menu button types and their relationship to LINE automation
// workflows. This module bridges the LINE Rich Menu UI layer to the workflow
// engine — a Rich Menu button tap may trigger a workflow or a UI navigation.
//
// Rich Menu buttons in GYEON DealerAgent:
//   maintenance        — maintenance reminder booking / vehicle service history
//   reservation        — reservation creation / management
//   review             — review request CTA (links to google/instagram)
//   estimate           — estimate request / view pending estimates
//   campaign           — current campaign offers / seasonal promotions
//   ai_chat            — AI chat interface (customer-facing, Phase 11H+)
//   customer_gallery   — customer vehicle photo gallery
//   before_after_gallery — before/after detailing photo gallery
//
// Button tap → workflow mapping:
//   Some buttons (maintenance, reservation, estimate) trigger workflows.
//   Others (ai_chat, customer_gallery, before_after_gallery) open UI screens.
//   review is handled by the Review Request approval flow (Sprint 11E/11F).
//
// This module defines types and registry only — actual Rich Menu creation via
// the LINE Messaging API is deferred to Phase 11H+.
//
// Pure — no "use server", no external calls.

import type { LineAutomationWorkflowId } from "./line-automation-types";

// ─── Button type ───────────────────────────────────────────────────────────────

/**
 * LineAutomationRichMenuButtonType — all Rich Menu button types supported by GYEON.
 */
export type LineAutomationRichMenuButtonType =
  | "maintenance"
  | "reservation"
  | "review"
  | "estimate"
  | "campaign"
  | "ai_chat"
  | "customer_gallery"
  | "before_after_gallery";

// ─── Button descriptor ─────────────────────────────────────────────────────────

/**
 * LineAutomationRichMenuButton — metadata for a single Rich Menu button.
 *
 * A button may:
 *   a) Trigger a workflow (workflow_id is set, action is "trigger_workflow")
 *   b) Open a LIFF screen (action is "open_liff_url")
 *   c) Post a postback event (action is "postback")
 *
 * liff_url: null for buttons that trigger workflows server-side.
 * rich_menu_api_deferred: true for all buttons — LINE API integration is Phase 11H+.
 */
export interface LineAutomationRichMenuButton {
  type:                     LineAutomationRichMenuButtonType;
  label:                    string;
  label_ja:                 string;
  description:              string;
  action:                   "trigger_workflow" | "open_liff_url" | "postback";
  /** null when action is not "trigger_workflow". */
  workflow_id:              LineAutomationWorkflowId | null;
  /** null when button opens a LIFF or triggers a server-side workflow. */
  liff_url:                 null;
  postback_data:            string;
  /** true = requires a LINE-linked customer account to function. */
  requires_line_link:       boolean;
  /** Required AppFeature to show this button. */
  required_feature:         string;
  implementation_status:    "available" | "partial" | "planned";
  rich_menu_api_deferred:   true;
}

// ─── RICH_MENU_BUTTON_REGISTRY ─────────────────────────────────────────────────

/**
 * RICH_MENU_BUTTON_REGISTRY — canonical registry of all Rich Menu buttons.
 *
 * rich_menu_api_deferred is always true — LINE Rich Menu API integration
 * (createRichMenu, setRichMenuToUser) requires Phase 11H+.
 */
export const RICH_MENU_BUTTON_REGISTRY: readonly LineAutomationRichMenuButton[] = [
  {
    type:                   "maintenance",
    label:                  "Maintenance",
    label_ja:               "メンテナンス",
    description:            "Opens the maintenance history and reminder booking screen",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=maintenance",
    requires_line_link:     false,
    required_feature:       "maintenance",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "reservation",
    label:                  "Reservation",
    label_ja:               "ご予約",
    description:            "Opens the reservation creation or management screen",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=reservation",
    requires_line_link:     false,
    required_feature:       "reservations",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "review",
    label:                  "Review",
    label_ja:               "口コミを書く",
    description:            "Sends the customer a link to leave a Google/Instagram review. Uses Review Request workflow.",
    action:                 "trigger_workflow",
    workflow_id:            "review_request",
    liff_url:               null,
    postback_data:          "action=trigger_workflow&workflow=review_request",
    requires_line_link:     true,
    required_feature:       "ai_reputation",
    implementation_status:  "partial",   // Workflow defined; LINE dispatch deferred
    rich_menu_api_deferred: true,
  },

  {
    type:                   "estimate",
    label:                  "Estimate",
    label_ja:               "お見積り",
    description:            "Opens the estimate request form or pending estimate screen",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=estimate",
    requires_line_link:     false,
    required_feature:       "estimates",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "campaign",
    label:                  "Campaign",
    label_ja:               "キャンペーン",
    description:            "Shows the current campaign offers and seasonal promotions",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=campaign",
    requires_line_link:     false,
    required_feature:       "line",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "ai_chat",
    label:                  "AI Chat",
    label_ja:               "AIチャット",
    description:            "Opens the customer-facing AI chat interface (powered by line_agent)",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=ai_chat",
    requires_line_link:     true,
    required_feature:       "ai_gateway",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "customer_gallery",
    label:                  "My Gallery",
    label_ja:               "マイギャラリー",
    description:            "Shows the customer's vehicle photo gallery from the Media Platform",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=customer_gallery",
    requires_line_link:     true,
    required_feature:       "line",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },

  {
    type:                   "before_after_gallery",
    label:                  "Before/After",
    label_ja:               "ビフォーアフター",
    description:            "Shows the dealer's before/after detailing gallery from the Media Platform",
    action:                 "open_liff_url",
    workflow_id:            null,
    liff_url:               null,
    postback_data:          "action=open_screen&screen=before_after_gallery",
    requires_line_link:     false,
    required_feature:       "line",
    implementation_status:  "planned",
    rich_menu_api_deferred: true,
  },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the registry entry for a button type. */
export function getRichMenuButton(
  type: LineAutomationRichMenuButtonType,
): LineAutomationRichMenuButton | undefined {
  return RICH_MENU_BUTTON_REGISTRY.find((b) => b.type === type);
}

/** Returns all buttons that trigger a given workflow. */
export function getRichMenuButtonsForWorkflow(
  workflowId: LineAutomationWorkflowId,
): readonly LineAutomationRichMenuButton[] {
  return RICH_MENU_BUTTON_REGISTRY.filter((b) => b.workflow_id === workflowId);
}

/** Returns all buttons with a given implementation status. */
export function getRichMenuButtonsByStatus(
  status: "available" | "partial" | "planned",
): readonly LineAutomationRichMenuButton[] {
  return RICH_MENU_BUTTON_REGISTRY.filter((b) => b.implementation_status === status);
}
