// GYEON Business Hub — Unified Settings Center: Navigation Model (Sprint 12F)
//
// Defines the navigation hierarchy for the Settings UI.
//
// Future settings UI hierarchy:
//   Settings (root /settings)
//       ↓
//   Group (nav sidebar section: Core / AI / Communication / ...)
//       ↓
//   Category (settings card: /settings/[category])
//       ↓
//   Section (settings page sub-section)
//       ↓
//   Setting Item (individual form field)
//
// Sprint 12F: hierarchy types and metadata only.
// No React components. No URL generation. No router calls.
// Sprint 13: SettingsRouter will consume this metadata to generate navigation.
//
// Current settings page (/settings/page.tsx) uses SettingsCategoryNav.tsx
// which renders 12 categories in a flat grid (PHASE72). The navigation model
// declared here will progressively replace that flat structure.
//
// Pure — no "use server", no async, no DB calls, no UI, no execution.

import type {
  SettingsCategoryId,
  SettingsGroupId,
  SettingsSectionId,
  SettingsItemId,
  SettingsVisibilityLevel,
  SettingsItemStatus,
} from "./settings-types";

// ─── Navigation node types ────────────────────────────────────────────────────

/**
 * The 5 node types in the settings navigation tree.
 */
export type SettingsNavNodeType =
  | "root"      // The settings index (/ settings)
  | "group"     // Sidebar section (Core / AI / ...)
  | "category"  // Settings category card (/settings/ai_providers)
  | "section"   // Section within a category (Store Information)
  | "item";     // Individual setting item

// ─── Navigation route ─────────────────────────────────────────────────────────

/**
 * SettingsNavRoute — the URL and breadcrumb metadata for a settings node.
 *
 * path:       Absolute path (e.g., "/settings/ai_providers")
 * breadcrumb: Ordered display labels (e.g., ["Settings", "AI", "AI Providers"])
 * page_title: H1 title for the page
 */
export interface SettingsNavRoute {
  path:       string;
  breadcrumb: string[];
  page_title: string;
}

// ─── Navigation node ──────────────────────────────────────────────────────────

/**
 * SettingsNavNode — a node in the settings navigation tree.
 * Nodes are nested: root > groups > categories > sections > items.
 */
export interface SettingsNavNode {
  node_type:      SettingsNavNodeType;
  node_id:        string;
  display_name:   string;
  route:          SettingsNavRoute;
  min_visibility: SettingsVisibilityLevel;
  status:         SettingsItemStatus;
  /** Ordered child node IDs. Empty for item nodes. */
  children:       string[];
  /** ID of the parent node. null for root. */
  parent_id:      string | null;
  /** Whether this node is rendered in the current UI. */
  ui_rendered:    boolean;
}

// ─── Navigation tree ─────────────────────────────────────────────────────────

/**
 * SettingsNavTree — the full settings navigation tree.
 * Used by SettingsRouter (Sprint 13) to generate navigation structure.
 *
 * root         — the settings index node
 * nodes        — all nodes keyed by node_id
 * group_order  — display order of group nodes
 */
export interface SettingsNavTree {
  root:        SettingsNavNode;
  nodes:       Record<string, SettingsNavNode>;
  group_order: SettingsGroupId[];
}

// ─── Category route map ────────────────────────────────────────────────────────

/**
 * Maps each SettingsCategoryId to its URL path.
 * Used by the settings UI to generate <Link> hrefs.
 *
 * Existing pages:
 *   /settings        → flat PHASE72 page (all categories)
 *   /settings/ai     → AI Gateway Settings (PHASE72)
 *
 * Future pages (Sprint 13):
 *   /settings/[category] → dedicated category page
 */
export const SETTINGS_CATEGORY_ROUTES: Record<SettingsCategoryId, SettingsNavRoute> = {
  dealer: {
    path:       "/settings",
    breadcrumb: ["Settings"],
    page_title: "Dealer Settings",
  },
  organization: {
    path:       "/settings/organization",
    breadcrumb: ["Settings", "Organization"],
    page_title: "Organization Settings",
  },
  staff: {
    path:       "/settings",    // Currently embedded in main settings page
    breadcrumb: ["Settings", "Staff"],
    page_title: "Staff Management",
  },
  roles_permissions: {
    path:       "/settings/roles",
    breadcrumb: ["Settings", "Roles & Permissions"],
    page_title: "Roles & Permissions",
  },
  ai_providers: {
    path:       "/settings/ai",
    breadcrumb: ["Settings", "AI", "AI Providers"],
    page_title: "AI Provider Settings",
  },
  ai_marketplace: {
    path:       "/settings/ai/marketplace",
    breadcrumb: ["Settings", "AI", "AI Marketplace"],
    page_title: "AI Marketplace Settings",
  },
  communication: {
    path:       "/settings/communication",
    breadcrumb: ["Settings", "Communication"],
    page_title: "Communication Center Settings",
  },
  automation: {
    path:       "/settings/automation",
    breadcrumb: ["Settings", "Automation"],
    page_title: "Automation Center Settings",
  },
  analytics: {
    path:       "/settings/analytics",
    breadcrumb: ["Settings", "Analytics"],
    page_title: "Analytics Center Settings",
  },
  subscription: {
    path:       "/settings",    // Currently embedded in main settings page
    breadcrumb: ["Settings", "Subscription"],
    page_title: "Subscription & Billing",
  },
  media: {
    path:       "/settings/media",
    breadcrumb: ["Settings", "Media"],
    page_title: "Media Asset Center Settings",
  },
  branding: {
    path:       "/settings/branding",
    breadcrumb: ["Settings", "Branding"],
    page_title: "Branding Settings",
  },
  notifications: {
    path:       "/settings/notifications",
    breadcrumb: ["Settings", "Notifications"],
    page_title: "Notification Settings",
  },
  ocr: {
    path:       "/settings",    // Currently embedded in main settings page
    breadcrumb: ["Settings", "OCR"],
    page_title: "OCR Settings",
  },
  pdf: {
    path:       "/settings",    // Currently embedded in main settings page
    breadcrumb: ["Settings", "PDF & Documents"],
    page_title: "PDF & Document Settings",
  },
  customer_portal: {
    path:       "/settings/portal",
    breadcrumb: ["Settings", "Customer Portal"],
    page_title: "Customer Portal Settings",
  },
  gyeon_distribution: {
    path:       "/settings/distribution",
    breadcrumb: ["Settings", "Enterprise", "GYEON Distribution"],
    page_title: "GYEON Distribution Settings",
  },
  warehouse: {
    path:       "/settings/warehouse",
    breadcrumb: ["Settings", "Enterprise", "Warehouse"],
    page_title: "Warehouse Settings",
  },
  crm: {
    path:       "/settings/crm",
    breadcrumb: ["Settings", "Enterprise", "CRM"],
    page_title: "CRM Settings",
  },
  accounting: {
    path:       "/settings/accounting",
    breadcrumb: ["Settings", "Enterprise", "Accounting"],
    page_title: "Accounting Settings",
  },
} as const;

// ─── Navigation tree builder ──────────────────────────────────────────────────

/**
 * Returns the route metadata for a given settings category.
 */
export function getCategoryRoute(
  category_id: SettingsCategoryId,
): SettingsNavRoute {
  return SETTINGS_CATEGORY_ROUTES[category_id];
}

/**
 * Returns all route entries for categories currently rendered in the settings UI.
 * These are categories with ui_available = true in the category registry.
 */
export function getActiveSettingsRoutes(): Array<{
  category_id: SettingsCategoryId;
  route:       SettingsNavRoute;
}> {
  const activeIds: SettingsCategoryId[] = [
    "dealer", "staff", "branding", "notifications",
    "ai_providers", "communication", "subscription",
    "ocr", "pdf", "analytics",
  ];
  return activeIds.map(id => ({ category_id: id, route: SETTINGS_CATEGORY_ROUTES[id] }));
}

/**
 * Builds a breadcrumb array for a given settings path.
 * Used by the settings page layout to render the breadcrumb bar.
 */
export function buildBreadcrumb(
  category_id: SettingsCategoryId,
  section_label?: string,
  item_label?: string,
): string[] {
  const base = SETTINGS_CATEGORY_ROUTES[category_id].breadcrumb;
  const result = [...base];
  if (section_label) result.push(section_label);
  if (item_label)    result.push(item_label);
  return result;
}

// ─── Section ID helpers ───────────────────────────────────────────────────────

/**
 * Builds a canonical section ID from category and section slug.
 * Format: "category_id.section_slug"
 */
export function buildSectionId(
  category_id: SettingsCategoryId,
  section_slug: string,
): SettingsSectionId {
  return `${category_id}.${section_slug}`;
}

/**
 * Builds a canonical item ID from category, section, and item slug.
 * Format: "category_id.section_slug.item_slug"
 */
export function buildItemId(
  category_id: SettingsCategoryId,
  section_slug: string,
  item_slug: string,
): SettingsItemId {
  return `${category_id}.${section_slug}.${item_slug}`;
}
