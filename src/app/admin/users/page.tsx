import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/get-current-admin";
import { getAdminUsers } from "@/lib/admin/get-admin-users";
import { ADMIN_ROLE_META, DEALER_ROLE_META } from "@/lib/admin/admin-roles";
import type { AdminRole, DealerRole } from "@/lib/admin/admin-roles";
import AdminUsersPanel from "./AdminUsersPanel";
import UsersAdminClient from "./UsersAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "ユーザー一覧 | GYEON Admin" };

function RoleArchitecturePanel() {
  const adminRoles: { role: AdminRole; desc: string; access: string }[] = [
    { role: "super_admin",     desc: "スーパー管理者",  access: "全モジュール・監査ログ・ユーザー管理へのフルアクセス" },
    { role: "gyeon_admin",     desc: "GYEON管理者",     access: "ユーザー管理と監査ログを除く全モジュール" },
    { role: "logistics_admin", desc: "物流管理者",      access: "物流と商品のみ" },
  ];

  const dealerRoles: { role: DealerRole; desc: string; access: string }[] = [
    { role: "owner",     desc: "店舗オーナー",   access: "自店舗内のフルアクセス — 全機能・請求・スタッフ管理" },
    { role: "manager",   desc: "マネージャー",   access: "見積・作業指示・顧客・予約。請求は不可。" },
    { role: "staff",     desc: "スタッフ",       access: "業務機能のみ — 見積・作業指示" },
    { role: "read_only", desc: "閲覧のみ",       access: "全店舗データの閲覧のみ。作成・編集・削除は不可。" },
  ];

  return (
    <details className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
      <summary className="px-5 py-3 cursor-pointer select-none list-none flex items-center justify-between">
        <span>
          <span className="text-sm font-semibold text-slate-200">権限構成</span>
          <span className="text-xs text-slate-500 ml-2">
            権限の定義。マイグレーション075で3つの管理者権限がDBで有効化されます。
          </span>
        </span>
        <span className="text-[10px] text-slate-500">開く / 閉じる</span>
      </summary>

      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
          GYEON管理者権限 (admin_users.role)
        </p>
        <div className="space-y-1">
          {adminRoles.map(({ role, desc, access }) => {
            const meta = ADMIN_ROLE_META[role];
            return (
              <div key={role} className="flex items-start gap-3 py-1.5">
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

      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">
          店舗ユーザー権限 (dealer_members.role)
        </p>
        <div className="space-y-1">
          {dealerRoles.map(({ role, desc, access }) => {
            const meta = DEALER_ROLE_META[role];
            return (
              <div key={role} className="flex items-start gap-3 py-1.5">
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
    </details>
  );
}

export default async function AdminUsersPage() {
  const caller = await getCurrentAdmin();
  if (!caller) redirect("/login");

  const isSuperAdmin = caller.role === "super_admin";
  const adminUsers   = isSuperAdmin ? await getAdminUsers() : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">ユーザー管理</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          管理者ユーザー・店舗ユーザー・権限構成
        </p>
      </div>

      {isSuperAdmin && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">管理者ユーザー</h2>
          <AdminUsersPanel adminUsers={adminUsers} callerId={caller.user_id} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">店舗ユーザー</h2>
        <UsersAdminClient />
      </div>

      <RoleArchitecturePanel />
    </div>
  );
}
