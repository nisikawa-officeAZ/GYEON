"use client";

import { useState, useTransition } from "react";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import {
  staffRoleLabel,
  staffStatusLabel,
  staffRoleBadgeColor,
  canManageStaff,
} from "@/lib/staff/staff-types";
import { inviteStaff } from "@/lib/staff/invite-staff";
import { updateStaffRole } from "@/lib/staff/update-staff-role";
import { disableStaff, enableStaff } from "@/lib/staff/disable-staff";

interface StaffManagementProps {
  initialStaff: DealerStaffDB[];
  currentRole: DealerStaffRole;
}

interface InviteForm {
  email: string;
  name: string;
  role: DealerStaffRole;
}

const ROLE_OPTIONS: DealerStaffRole[] = ["owner", "manager", "staff", "readonly"];

export default function StaffManagement({ initialStaff, currentRole }: StaffManagementProps) {
  const [staffList, setStaffList] = useState<DealerStaffDB[]>(initialStaff);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({ email: "", name: "", role: "staff" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = currentRole === "owner";
  const isManager = currentRole === "manager";
  const canInvite = isOwner || isManager;

  // Roles manager is allowed to invite
  const invitableRoles: DealerStaffRole[] = isOwner
    ? ROLE_OPTIONS
    : ["staff", "readonly"];

  const activeStaff = staffList.filter((s) => s.status !== "invited");
  const pendingInvites = staffList.filter((s) => s.status === "invited");

  function handleInviteSubmit() {
    setInviteError(null);
    startTransition(async () => {
      const result = await inviteStaff(inviteForm);
      if (result.success && result.data) {
        setStaffList((prev) => [...prev, result.data!]);
        setInviteForm({ email: "", name: "", role: "staff" });
        setShowInviteForm(false);
      } else {
        setInviteError(result.error ?? "招待に失敗しました");
      }
    });
  }

  function handleRoleChange(staffId: string, newRole: DealerStaffRole) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateStaffRole(staffId, newRole);
      if (result.success) {
        setStaffList((prev) =>
          prev.map((s) => (s.id === staffId ? { ...s, role: newRole } : s))
        );
      } else {
        setActionError(result.error ?? "更新に失敗しました");
      }
    });
  }

  function handleToggleStatus(staff: DealerStaffDB) {
    setActionError(null);
    startTransition(async () => {
      const result =
        staff.status === "active"
          ? await disableStaff(staff.id)
          : await enableStaff(staff.id);

      if (result.success) {
        setStaffList((prev) =>
          prev.map((s) =>
            s.id === staff.id
              ? { ...s, status: staff.status === "active" ? "disabled" : "active" }
              : s
          )
        );
      } else {
        setActionError(result.error ?? "操作に失敗しました");
      }
    });
  }

  function canToggleStatus(target: DealerStaffDB): boolean {
    if (isOwner) return true;
    if (isManager && (target.role === "owner" || target.role === "manager")) return false;
    return isManager;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action error */}
      {actionError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {/* Active staff table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-200">スタッフ一覧</p>
          {canInvite && (
            <button
              onClick={() => setShowInviteForm((prev) => !prev)}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              {showInviteForm ? "キャンセル" : "+ スタッフを招待"}
            </button>
          )}
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/40 flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">新規招待</p>
            {inviteError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300">
                {inviteError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">名前</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">メールアドレス</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">ロール</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) =>
                    setInviteForm((f) => ({ ...f, role: e.target.value as DealerStaffRole }))
                  }
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-600"
                >
                  {invitableRoles.map((r) => (
                    <option key={r} value={r}>
                      {staffRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleInviteSubmit}
                disabled={isPending || !inviteForm.email || !inviteForm.name}
                className="text-sm bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "送信中..." : "招待を送る"}
              </button>
            </div>
          </div>
        )}

        {/* Staff table */}
        {activeStaff.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            スタッフが登録されていません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">名前</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">メール</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ロール</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ステータス</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">最終ログイン</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody>
                {activeStaff.map((member) => (
                  <tr key={member.id} className="border-b border-slate-800/50 last:border-b-0">
                    <td className="px-5 py-3 text-slate-100 font-medium">
                      {member.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {member.email ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as DealerStaffRole)
                          }
                          disabled={isPending}
                          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {staffRoleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${staffRoleBadgeColor(member.role)}`}
                        >
                          {staffRoleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-900/40 text-green-400 border border-green-700/40"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {staffStatusLabel(member.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {member.last_login_at
                        ? new Date(member.last_login_at).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canToggleStatus(member) && (
                        <button
                          onClick={() => handleToggleStatus(member)}
                          disabled={isPending}
                          className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
                            member.status === "active"
                              ? "bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300"
                              : "bg-slate-800 hover:bg-green-900/40 text-slate-400 hover:text-green-300"
                          }`}
                        >
                          {member.status === "active" ? "無効化" : "有効化"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <p className="text-sm font-medium text-slate-200">招待中</p>
            <p className="text-xs text-slate-500 mt-0.5">以下のメールアドレスへの招待が保留中です</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">名前</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">メール</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">ロール</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">招待日</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="border-b border-slate-800/50 last:border-b-0">
                    <td className="px-5 py-3 text-slate-300">{invite.name ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{invite.email ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${staffRoleBadgeColor(invite.role)}`}
                      >
                        {staffRoleLabel(invite.role)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {invite.invited_at
                        ? new Date(invite.invited_at).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-xs font-medium px-3 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        onClick={() => {/* stub — resend invite */}}
                      >
                        再送
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
