// DealerOS — Enterprise Organization Foundation: Descriptor (Sprint 11V)
//
// Authoritative singleton descriptor for the Enterprise Organization Foundation.
// Analogous to PLATFORM_CORE in platform-core/platform-descriptor.ts.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { OrganizationFoundationDescriptor } from "./organization-types";
import { ORGANIZATION_REGISTRY }     from "./organization-hierarchy";
import { HIERARCHY_LEVELS }          from "./organization-hierarchy";
import { ORGANIZATION_ROLES }        from "./organization-roles";
import { ORGANIZATION_POLICIES }     from "./organization-policy";
import { ORGANIZATION_APPLICATION_OWNERSHIP } from "./organization-registry";

export const ORGANIZATION_FOUNDATION: OrganizationFoundationDescriptor = {
  version:                       "1.0.0",
  sprint:                        "Sprint 11V",
  hierarchy_level_count:         HIERARCHY_LEVELS.length,                    // 6
  registered_organization_count: ORGANIZATION_REGISTRY.length,               // 7
  role_count:                    ORGANIZATION_ROLES.length,                   // 7
  policy_count:                  ORGANIZATION_POLICIES.length,                // 8
  application_ownership_count:   ORGANIZATION_APPLICATION_OWNERSHIP.length,  // 6
  platform_core_integrated:      true,
  persistence_required:          false,
  target_sprint:                 "Sprint 12+",
};
