// DealerOS — Enterprise Organization Foundation: Application Registry (Sprint 11V Phase C)
//
// Maps canonical organizations to Platform applications.
// Each entry records which organization owns or operates which application,
// enabling multi-company application deployment planning.
//
// Ownership types:
//   owner      — organization built and owns the application
//   operator   — organization runs the application (licensing)
//   subscriber — organization uses the application as a customer
//   partner    — organization integrates with the application
//
// No implementation. No persistence. Static declarations only.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type {
  OrganizationApplicationOwnership,
  OrganizationId,
} from "./organization-types";

// ─── Application ownership declarations ──────────────────────────────────────
//
// Application IDs are strings (not PlatformApplicationId) to avoid circular
// imports between organization/ and platform-core/. The platform-core-bridge.ts
// file handles typed integration.

const DEALER_AGENT_OWNERSHIP: OrganizationApplicationOwnership = {
  organization_id:    "org_gyeon_japan",
  application_id:     "dealer_agent",
  ownership_type:     "owner",
  status:             "active",
  deployment_target:  "gyeon-agent.vercel.app",
  notes:              "GYEON Japan K.K. owns and operates the Dealer Agent. All dealers are GYEON-certified shops.",
};

const EDP_GYEON_OWNERSHIP: OrganizationApplicationOwnership = {
  organization_id:    "org_gyeon_japan",
  application_id:     "enterprise_distribution",
  ownership_type:     "owner",
  status:             "planned",
  deployment_target:  null,
  notes:              "GYEON Japan K.K. will own the EDP. Serves wholesale distribution to certified buyers like Attraction.",
};

const EDP_ATTRACTION_SUBSCRIPTION: OrganizationApplicationOwnership = {
  organization_id:    "org_attraction",
  application_id:     "enterprise_distribution",
  ownership_type:     "subscriber",
  status:             "planned",
  deployment_target:  null,
  notes:              "Attraction Co., Ltd. will subscribe to the EDP as the first B2B buyer (EDP first target customer).",
};

const WAREHOUSE_GYEON_OWNERSHIP: OrganizationApplicationOwnership = {
  organization_id:    "org_gyeon_japan",
  application_id:     "warehouse",
  ownership_type:     "owner",
  status:             "planned",
  deployment_target:  null,
  notes:              "GYEON Japan K.K. will own the Warehouse Management System for the main fulfillment warehouse.",
};

const ACCOUNTING_GYEON_OWNERSHIP: OrganizationApplicationOwnership = {
  organization_id:    "org_gyeon_japan",
  application_id:     "accounting",
  ownership_type:     "owner",
  status:             "planned",
  deployment_target:  null,
  notes:              "GYEON Japan K.K. accounting system — AR/AP, billing, revenue reporting.",
};

const CRM_GYEON_OWNERSHIP: OrganizationApplicationOwnership = {
  organization_id:    "org_gyeon_japan",
  application_id:     "crm",
  ownership_type:     "owner",
  status:             "planned",
  deployment_target:  null,
  notes:              "GYEON Japan K.K. CRM — manages dealer relationships and sales pipeline.",
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const ORGANIZATION_APPLICATION_OWNERSHIP: OrganizationApplicationOwnership[] = [
  DEALER_AGENT_OWNERSHIP,
  EDP_GYEON_OWNERSHIP,
  EDP_ATTRACTION_SUBSCRIPTION,
  WAREHOUSE_GYEON_OWNERSHIP,
  ACCOUNTING_GYEON_OWNERSHIP,
  CRM_GYEON_OWNERSHIP,
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getApplicationsForOrganization(
  org_id: OrganizationId,
): OrganizationApplicationOwnership[] {
  return ORGANIZATION_APPLICATION_OWNERSHIP.filter(
    (o) => o.organization_id === org_id,
  );
}

export function getOrganizationsForApp(
  application_id: string,
): OrganizationApplicationOwnership[] {
  return ORGANIZATION_APPLICATION_OWNERSHIP.filter(
    (o) => o.application_id === application_id,
  );
}

export function getOwnerForApplication(
  application_id: string,
): OrganizationApplicationOwnership | undefined {
  return ORGANIZATION_APPLICATION_OWNERSHIP.find(
    (o) => o.application_id === application_id && o.ownership_type === "owner",
  );
}

export function isOrganizationActiveForApplication(
  org_id: OrganizationId,
  application_id: string,
): boolean {
  return ORGANIZATION_APPLICATION_OWNERSHIP.some(
    (o) =>
      o.organization_id === org_id &&
      o.application_id === application_id &&
      o.status === "active",
  );
}

export function getActiveApplicationOwners(): OrganizationApplicationOwnership[] {
  return ORGANIZATION_APPLICATION_OWNERSHIP.filter(
    (o) => o.status === "active" && o.ownership_type === "owner",
  );
}
