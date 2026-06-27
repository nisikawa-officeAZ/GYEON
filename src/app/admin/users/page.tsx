import UsersAdminClient from "./UsersAdminClient";
import { ADMIN_ROLE_META, DEALER_ROLE_META } from "@/lib/admin/admin-roles";
import type { AdminRole, DealerRole } from "@/lib/admin/admin-roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users | GYEON Admin" };

// Role architecture reference panel (read-only, architecture-only)
function RoleArchitecturePanel() {
  const adminRoles: { role: AdminRole; desc: string; access: string }[] = [
    { role: "super_admin",     desc: "GYEON Super Admin",    access: "Full access to all modules, audit logs, user management" },
    { role: "gyeon_admin",     desc: "GYEON Admin",          access: "All modules except Users and Audit Logs" },
    { role: "logistics_admin", desc: "Logistics Admin",      access: "Logistics and Products only" },
  ];

  const dealerRoles: { role: DealerRole; desc: string; access: string }[] = [
    { role: "owner",     desc: "Dealer Owner",   access: "Full access within own dealer — all features, billing, staff" },
    { role: "manager",   desc: "Dealer Manager", access: "Estimates, work orders, customers, reservations. No billing." },
    { role: "staff",     desc: "Dealer Staff",   access: "Operational features only — estimates, work orders" },
    { role: "read_only", desc: "Read Only",       access: "View-only across all dealer data. No create/edit/delete." },
  ];

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Role Architecture</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Role definitions. Full editing is in a future sprint.
        </p>
      </div>

      {/* Admin roles */}
      <div className="px-5 py-4 border-b border-slate-800">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
          GYEON Admin Roles (admin_users.role)
        </p>
        <div className="space-y-2">
          {adminRoles.map(({ role, desc, access }) => {
            const meta = ADMIN_ROLE_META[role];
            return (
              <div key={role} className="flex items-start gap-3 py-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${meta.color}`}>
                  {meta.label}
                </span>
                <div>
                  <p className="text-xs text-slate-300">{desc}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{access}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dealer roles */}
      <div className="px-5 py-4">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
          Dealer Member Roles (dealer_members.role)
        </p>
        <div className="space-y-2">
          {dealerRoles.map(({ role, desc, access }) => {
            const meta = DEALER_ROLE_META[role];
            return (
              <div key={role} className="flex items-start gap-3 py-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 text-slate-300 bg-slate-800/60 border-slate-700">
                  {meta.label}
                </span>
                <div>
                  <p className="text-xs text-slate-300">{desc}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{access}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">User Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Supabase Auth users, dealer members, and role architecture
        </p>
      </div>

      <RoleArchitecturePanel />

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Auth Users</h2>
        <UsersAdminClient />
      </div>
    </div>
  );
}
