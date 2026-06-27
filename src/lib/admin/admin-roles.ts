/**
 * GYEON Business Hub — Admin Role Definitions
 *
 * Admin-side roles (stored in admin_users.role):
 *   super_admin     — GYEON Super Admin: full access to all modules
 *   gyeon_admin     — GYEON Admin: all modules except Users and Audit Logs
 *   logistics_admin — Logistics Admin: Logistics and Products only
 *
 * Dealer-side roles (stored in dealer_members.role, not admin roles):
 *   owner     — Dealer Owner: full dealer access
 *   manager   — Dealer Manager: most dealer access, no billing
 *   staff     — Dealer Staff: operational access only
 *   read_only — Read Only: view-only access
 *
 * DB note: admin_users.role CHECK constraint currently only allows 'super_admin'.
 * New admin roles (gyeon_admin, logistics_admin) require a future migration to
 * add them to the constraint before DB records can use them.
 */

export type AdminRole = "super_admin" | "gyeon_admin" | "logistics_admin";

export type DealerRole = "owner" | "manager" | "staff" | "read_only";

export interface AdminNavItem {
  key:   string;
  label: string;
  href:  string;
  roles: AdminRole[];
  soon?: boolean;
  icon:  React.ReactNode;
}

// Role metadata
export const ADMIN_ROLE_META: Record<AdminRole, { label: string; color: string }> = {
  super_admin:     { label: "Super Admin",       color: "text-purple-300 bg-purple-900/40 border-purple-700/50" },
  gyeon_admin:     { label: "GYEON Admin",       color: "text-blue-300   bg-blue-900/40   border-blue-700/50"   },
  logistics_admin: { label: "Logistics Admin",   color: "text-green-300  bg-green-900/40  border-green-700/50"  },
};

export const DEALER_ROLE_META: Record<DealerRole, { label: string }> = {
  owner:     { label: "Dealer Owner"  },
  manager:   { label: "Manager"       },
  staff:     { label: "Staff"         },
  read_only: { label: "Read Only"     },
};

// Navigation items with role-based visibility
// icon is a string key; actual SVG is rendered by AdminSidebar
export const ADMIN_NAV_CONFIG: {
  key:   string;
  label: string;
  href:  string;
  roles: AdminRole[];
  soon?: boolean;
  iconKey: string;
}[] = [
  { key: "dashboard",  label: "Dashboard",  href: "/admin/dashboard",  roles: ["super_admin", "gyeon_admin"],                           iconKey: "dashboard" },
  { key: "dealers",    label: "Dealers",    href: "/admin/dealers",    roles: ["super_admin", "gyeon_admin"],                           iconKey: "dealers"   },
  { key: "plans",      label: "Plans",      href: "/admin/plans",      roles: ["super_admin", "gyeon_admin"],                           iconKey: "plans"     },
  { key: "users",      label: "Users",      href: "/admin/users",      roles: ["super_admin"],                                          iconKey: "users"     },
  { key: "logistics",  label: "Logistics",  href: "/admin/logistics",  roles: ["super_admin", "gyeon_admin", "logistics_admin"],        iconKey: "logistics", soon: true },
  { key: "products",   label: "Products",   href: "/admin/products",   roles: ["super_admin", "gyeon_admin", "logistics_admin"],        iconKey: "products",  soon: true },
  { key: "crm",        label: "CRM",        href: "/admin/crm",        roles: ["super_admin", "gyeon_admin"],                           iconKey: "crm",       soon: true },
  { key: "ai-center",  label: "AI Center",  href: "/admin/ai-center",  roles: ["super_admin", "gyeon_admin"],                           iconKey: "ai",        soon: true },
  { key: "billing",    label: "Billing",    href: "/admin/billing",    roles: ["super_admin", "gyeon_admin"],                           iconKey: "billing"   },
  { key: "settings",   label: "Settings",   href: "/admin/settings",   roles: ["super_admin", "gyeon_admin"],                           iconKey: "settings",  soon: true },
  { key: "audit",      label: "Audit Logs", href: "/admin/audit",      roles: ["super_admin"],                                          iconKey: "audit"     },
];

export function getVisibleNav(role: string) {
  return ADMIN_NAV_CONFIG.filter((item) => (item.roles as string[]).includes(role));
}

export function isAdminRole(role: string): role is AdminRole {
  return ["super_admin", "gyeon_admin", "logistics_admin"].includes(role);
}
