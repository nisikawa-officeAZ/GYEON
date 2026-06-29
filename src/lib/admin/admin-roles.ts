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
 * DB note: Migration 075 expanded admin_users.role CHECK to allow
 * 'super_admin' | 'gyeon_admin' | 'logistics_admin'.
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
  super_admin:     { label: "スーパー管理者",     color: "text-purple-300 bg-purple-900/40 border-purple-700/50" },
  gyeon_admin:     { label: "GYEON管理者",        color: "text-blue-300   bg-blue-900/40   border-blue-700/50"   },
  logistics_admin: { label: "物流管理者",         color: "text-green-300  bg-green-900/40  border-green-700/50"  },
};

export const DEALER_ROLE_META: Record<DealerRole, { label: string }> = {
  owner:     { label: "店舗オーナー" },
  manager:   { label: "マネージャー" },
  staff:     { label: "スタッフ"     },
  read_only: { label: "閲覧のみ"     },
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
  { key: "dashboard",  label: "管理ダッシュボード",  href: "/admin/dashboard",  roles: ["super_admin", "gyeon_admin"],                           iconKey: "dashboard" },
  { key: "dealers",    label: "店舗管理",    href: "/admin/dealers",    roles: ["super_admin", "gyeon_admin"],                           iconKey: "dealers"   },
  { key: "news",       label: "お知らせ",    href: "/admin/news",       roles: ["super_admin", "gyeon_admin"],                           iconKey: "news"      },
  { key: "resources",  label: "資料",        href: "/admin/resources",  roles: ["super_admin", "gyeon_admin"],                           iconKey: "resources" },
  { key: "plans",      label: "プラン",      href: "/admin/plans",      roles: ["super_admin", "gyeon_admin"],                           iconKey: "plans"     },
  { key: "users",      label: "ユーザー管理", href: "/admin/users",      roles: ["super_admin"],                                          iconKey: "users"     },
  { key: "logistics",  label: "物流",        href: "/admin/logistics",  roles: ["super_admin", "gyeon_admin", "logistics_admin"],        iconKey: "logistics" },
  { key: "products",   label: "製品",        href: "/admin/products",   roles: ["super_admin", "gyeon_admin", "logistics_admin"],        iconKey: "products",  soon: true },
  { key: "crm",        label: "CRM",        href: "/admin/crm",        roles: ["super_admin", "gyeon_admin"],                           iconKey: "crm",       soon: true },
  { key: "ai-center",  label: "AIセンター",  href: "/admin/ai-center",  roles: ["super_admin", "gyeon_admin"],                           iconKey: "ai",        soon: true },
  { key: "billing",    label: "請求",        href: "/admin/billing",    roles: ["super_admin", "gyeon_admin"],                           iconKey: "billing"   },
  { key: "settings",   label: "設定",        href: "/admin/settings",   roles: ["super_admin", "gyeon_admin"],                           iconKey: "settings",  soon: true },
  { key: "audit",      label: "監査ログ",    href: "/admin/audit",      roles: ["super_admin"],                                          iconKey: "audit"     },
];

export function getVisibleNav(role: string) {
  return ADMIN_NAV_CONFIG.filter((item) => (item.roles as string[]).includes(role));
}

export function isAdminRole(role: string): role is AdminRole {
  return ["super_admin", "gyeon_admin", "logistics_admin"].includes(role);
}
