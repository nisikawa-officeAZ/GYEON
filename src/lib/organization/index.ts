// DealerOS — Enterprise Organization Foundation: Package Barrel (Sprint 11V)
//
// Public API for src/lib/organization/.
// Import from here, not from sub-modules, to maintain a stable package surface.

// ── Domain types ──────────────────────────────────────────────────────────────
export type {
  OrganizationId,
  OrganizationType,
  OrganizationTier,
  OrganizationStatus,
  Organization,
  OrganizationHierarchyNode,
  OrganizationMember,
  OrganizationRoleId,
  OrganizationRole,
  OrganizationPermissionAction,
  OrganizationPermissionScope,
  OrganizationPermission,
  OrganizationPolicyEnforcement,
  OrganizationPolicy,
  ApplicationOwnershipType,
  OrganizationApplicationOwnership,
  OrganizationFoundationDescriptor,
} from "./organization-types";

// ── Hierarchy ─────────────────────────────────────────────────────────────────
export type { HierarchyLevel } from "./organization-hierarchy";

export {
  HIERARCHY_LEVELS,
  ORGANIZATION_REGISTRY,
  PLATFORM_ROOT,
  GYEON_JAPAN,
  ATTRACTION,
  DETAILING_DIVISION,
  WHOLESALE_DIVISION,
  MAIN_WAREHOUSE,
  ATTRACTION_SALES_DIVISION,
  getHierarchyLevel,
  getAllowedChildTypes,
  getAllowedParentTypes,
  getOrganizationsByType,
  getOrganization,
  getChildOrganizations,
  getAncestorPath,
  buildHierarchyNode,
  isValidParentChild,
  getOrganizationsForApplication,
} from "./organization-hierarchy";

// ── Application registry ──────────────────────────────────────────────────────
export {
  ORGANIZATION_APPLICATION_OWNERSHIP,
  getApplicationsForOrganization,
  getOrganizationsForApp,
  getOwnerForApplication,
  isOrganizationActiveForApplication,
  getActiveApplicationOwners,
} from "./organization-registry";

// ── Roles and permissions ─────────────────────────────────────────────────────
export {
  ORGANIZATION_ROLES,
  ROLE_SCOPE_MATRIX,
  getOrganizationRole,
  getRolesForScope,
  canRoleAccessScope,
  getRoleFromDealerRole,
  getDealerScopedRoles,
  getPlatformScopedRoles,
} from "./organization-roles";

// ── Policy ────────────────────────────────────────────────────────────────────
export {
  ORGANIZATION_POLICIES,
  STRICT_ORG_POLICIES,
  ADVISORY_ORG_POLICIES,
  getOrganizationPolicy,
  getPoliciesForScope,
  getStrictPolicies,
  getAdvisoryPolicies,
} from "./organization-policy";

// ── Platform Core bridge ──────────────────────────────────────────────────────
export type { OrganizationModuleManifest, OrgPolicySummary } from "./platform-core-bridge";

export {
  ORG_TYPE_APPLICATION_MAP,
  APPLICATION_ORG_TYPE_MAP,
  ORGANIZATION_MODULE_MANIFEST,
  ORGANIZATION_POLICY_SUMMARY,
  getApplicationsForOrgType,
  getOrgTypesForApplication,
  isOrgTypeRelevantToApplication,
  getOrganizationsForPlatformApplication,
} from "./platform-core-bridge";

// ── Foundation descriptor ─────────────────────────────────────────────────────
export { ORGANIZATION_FOUNDATION } from "./organization-descriptor";
