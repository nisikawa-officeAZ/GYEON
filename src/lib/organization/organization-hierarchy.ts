// DealerOS — Enterprise Organization Foundation: Hierarchy (Sprint 11V Phase B)
//
// Canonical 6-level organization hierarchy definition for the Office AZ platform.
//
// Hierarchy levels:
//   1. Platform  (tier_1, depth 0) — Office AZ platform root
//   2. Company   (tier_2, depth 1) — GYEON Japan K.K., Attraction Co., Ltd.
//   3. Division  (tier_3, depth 2) — Detailing, Wholesale, Sales
//   4. Branch    (tier_4, depth 3) — Regional offices
//   5. Warehouse (tier_5, depth 4) — Fulfillment centers
//   6. Dealer    (tier_6, depth 5) — Individual shops (linked to dealer_id)
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  Organization,
  OrganizationType,
  OrganizationTier,
  OrganizationId,
  OrganizationHierarchyNode,
} from "./organization-types";

// ─── Hierarchy level metadata ─────────────────────────────────────────────────

export interface HierarchyLevel {
  type:           OrganizationType;
  tier:           OrganizationTier;
  depth:          number;
  display_name:   string;
  description:    string;
  /** Types allowed as parents of this level. null = root (no parent). */
  parent_types:   OrganizationType[] | null;
  /** Types allowed as children of this level. */
  child_types:    OrganizationType[];
  /** Which Platform applications operate at this level. */
  application_ids: string[];
  max_per_parent: number | null;  // null = unlimited
}

export const HIERARCHY_LEVELS: HierarchyLevel[] = [
  {
    type:          "platform",
    tier:          "tier_1",
    depth:         0,
    display_name:  "Platform",
    description:   "Office AZ platform root. Singleton — there is exactly one platform node.",
    parent_types:  null,
    child_types:   ["company"],
    application_ids: ["dealer_agent", "enterprise_distribution", "warehouse", "accounting", "crm"],
    max_per_parent: 1,
  },
  {
    type:          "company",
    tier:          "tier_2",
    depth:         1,
    display_name:  "Company",
    description:   "Legal entity operating one or more Office AZ applications. Example: GYEON Japan K.K., Attraction Co., Ltd.",
    parent_types:  ["platform"],
    child_types:   ["division"],
    application_ids: ["dealer_agent", "enterprise_distribution"],
    max_per_parent: null,
  },
  {
    type:          "division",
    tier:          "tier_3",
    depth:         2,
    display_name:  "Division",
    description:   "Business division within a company. Example: Detailing Sales, Wholesale, Marketing.",
    parent_types:  ["company"],
    child_types:   ["branch", "warehouse", "dealer"],
    application_ids: ["dealer_agent", "enterprise_distribution"],
    max_per_parent: null,
  },
  {
    type:          "branch",
    tier:          "tier_4",
    depth:         3,
    display_name:  "Branch",
    description:   "Physical or regional branch office within a division. Example: Tokyo Branch, Osaka Branch.",
    parent_types:  ["division"],
    child_types:   ["dealer"],
    application_ids: ["dealer_agent"],
    max_per_parent: null,
  },
  {
    type:          "warehouse",
    tier:          "tier_5",
    depth:         4,
    display_name:  "Warehouse",
    description:   "Fulfillment center or warehouse node. Attached to a division or company. Maps to the Warehouse Management System.",
    parent_types:  ["division", "company"],
    child_types:   [],
    application_ids: ["warehouse", "enterprise_distribution"],
    max_per_parent: null,
  },
  {
    type:          "dealer",
    tier:          "tier_6",
    depth:         5,
    display_name:  "Dealer",
    description:   "Individual detailing shop. Linked to a dealer_id in the Dealer Agent application. Leaf node — no children.",
    parent_types:  ["branch", "division"],
    child_types:   [],
    application_ids: ["dealer_agent"],
    max_per_parent: null,
  },
];

// ─── Canonical static organizations ──────────────────────────────────────────

export const PLATFORM_ROOT: Organization = {
  organization_id: "org_platform_root",
  display_name:    "Office AZ Platform",
  legal_name:      "Office AZ Co., Ltd.",
  type:            "platform",
  tier:            "tier_1",
  status:          "active",
  parent_id:       null,
  description:     "Office AZ platform root. Parent of all company nodes. Administered by Office AZ engineering.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const GYEON_JAPAN: Organization = {
  organization_id: "org_gyeon_japan",
  display_name:    "GYEON Japan",
  legal_name:      "GYEON Japan K.K.",
  type:            "company",
  tier:            "tier_2",
  status:          "active",
  parent_id:       "org_platform_root",
  description:     "GYEON ceramic coating importer and detailing industry operator. Owns and operates the GYEON Detailer Agent application.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const ATTRACTION: Organization = {
  organization_id: "org_attraction",
  display_name:    "Attraction Co., Ltd.",
  legal_name:      "Attraction Co., Ltd.",
  type:            "company",
  tier:            "tier_2",
  status:          "planned",
  parent_id:       "org_platform_root",
  description:     "First target company for the Enterprise Distribution Platform (EDP). Wholesale arm of the Office AZ group. Will operate as the primary EDP buyer.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const DETAILING_DIVISION: Organization = {
  organization_id: "org_detailing_division",
  display_name:    "Detailing Sales Division",
  legal_name:      null,
  type:            "division",
  tier:            "tier_3",
  status:          "active",
  parent_id:       "org_gyeon_japan",
  description:     "GYEON Japan division responsible for detailing shop relationships and dealer management. Hosts all Dealer Agent dealers.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const WHOLESALE_DIVISION: Organization = {
  organization_id: "org_wholesale_division",
  display_name:    "Wholesale Division",
  legal_name:      null,
  type:            "division",
  tier:            "tier_3",
  status:          "planned",
  parent_id:       "org_gyeon_japan",
  description:     "GYEON Japan division responsible for B2B wholesale distribution. Will be served by the Enterprise Distribution Platform.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const MAIN_WAREHOUSE: Organization = {
  organization_id: "org_main_warehouse",
  display_name:    "Main Warehouse",
  legal_name:      null,
  type:            "warehouse",
  tier:            "tier_5",
  status:          "planned",
  parent_id:       "org_wholesale_division",
  description:     "Primary fulfillment center for GYEON Japan wholesale operations. Will be managed by the Warehouse Management System.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

export const ATTRACTION_SALES_DIVISION: Organization = {
  organization_id: "org_attraction_sales",
  display_name:    "Attraction Sales Division",
  legal_name:      null,
  type:            "division",
  tier:            "tier_3",
  status:          "planned",
  parent_id:       "org_attraction",
  description:     "Attraction Co., Ltd. sales division. Will operate as buyer through the EDP B2B portal.",
  country:         "JP",
  timezone:        "Asia/Tokyo",
  is_dealer_linked: false,
  dealer_id_ref:   null,
  spec_version:    "1.0.0",
};

// ─── Static registry ──────────────────────────────────────────────────────────

export const ORGANIZATION_REGISTRY: Organization[] = [
  PLATFORM_ROOT,
  GYEON_JAPAN,
  ATTRACTION,
  DETAILING_DIVISION,
  WHOLESALE_DIVISION,
  MAIN_WAREHOUSE,
  ATTRACTION_SALES_DIVISION,
];

// ─── Hierarchy helpers ────────────────────────────────────────────────────────

export function getHierarchyLevel(type: OrganizationType): HierarchyLevel | undefined {
  return HIERARCHY_LEVELS.find((l) => l.type === type);
}

export function getAllowedChildTypes(type: OrganizationType): OrganizationType[] {
  return getHierarchyLevel(type)?.child_types ?? [];
}

export function getAllowedParentTypes(type: OrganizationType): OrganizationType[] | null {
  return getHierarchyLevel(type)?.parent_types ?? null;
}

export function getOrganizationsByType(type: OrganizationType): Organization[] {
  return ORGANIZATION_REGISTRY.filter((o) => o.type === type);
}

export function getOrganization(id: OrganizationId): Organization | undefined {
  return ORGANIZATION_REGISTRY.find((o) => o.organization_id === id);
}

export function getChildOrganizations(parent_id: OrganizationId): Organization[] {
  return ORGANIZATION_REGISTRY.filter((o) => o.parent_id === parent_id);
}

export function getAncestorPath(org_id: OrganizationId): Organization[] {
  const path: Organization[] = [];
  let current = getOrganization(org_id);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? getOrganization(current.parent_id) : undefined;
  }
  return path;
}

export function buildHierarchyNode(org_id: OrganizationId): OrganizationHierarchyNode | null {
  const org = getOrganization(org_id);
  if (!org) return null;

  const ancestorPath = getAncestorPath(org_id);
  const parentOrg = org.parent_id ? getOrganization(org.parent_id) : undefined;
  const parentNode = org.parent_id ? buildHierarchyNode(org.parent_id) : null;
  const children = getChildOrganizations(org_id);

  return {
    organization: org,
    parent:       parentNode,
    children:     children
      .map((c) => buildHierarchyNode(c.organization_id))
      .filter((n): n is OrganizationHierarchyNode => n !== null),
    depth:        ancestorPath.length - 1,
    ancestor_path: ancestorPath.map((a) => a.organization_id),
  };
}

export function isValidParentChild(
  parent_type: OrganizationType,
  child_type: OrganizationType,
): boolean {
  return getAllowedChildTypes(parent_type).includes(child_type);
}

export function getOrganizationsForApplication(application_id: string): Organization[] {
  const relevantTypes = HIERARCHY_LEVELS
    .filter((l) => l.application_ids.includes(application_id))
    .map((l) => l.type);
  return ORGANIZATION_REGISTRY.filter((o) => relevantTypes.includes(o.type));
}
