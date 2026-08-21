"use client";

import { useState, useTransition } from "react";
import type { DealerStaffDB, DealerStaffRole } from "@/lib/staff/staff-types";
import {
  staffRoleLabel,
  staffStatusLabel,
  staffRoleBadgeColor,
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

const surface =
  "overflow-hidden rounded-2xl border border-[#263955] bg-[#111826]/90";

function SectionTitle({ label, labelEn }: { label: string; labelEn: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-[#20304a] pb-4">
      <div>
        <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">{labelEn}</p>
        <h2 className="mt-1 text-[16px] font-bold text-[#e8eef7]">{label}</h2>
      </div>
      <span className="h-px flex-1 bg-[#20304a]" />
    </div>
  );
}

function RoleSelector({
  value,
  options,
  disabled,
  onChange,
  label,
}: {
  value: DealerStaffRole;
  options: DealerStaffRole[];
  disabled?: boolean;
  onChange: (role: DealerStaffRole) => void;
  label: string;
}) {
  return (
    <div
      className="flex min-h-12 flex-wrap gap-2"
      role="group"
      aria-label={label}
    >
      {options.map((role) => {
        const selected = value === role;
        return (
          <button
            key={role}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={selected
              ? "min-h-12 rounded-xl border border-[#3478ff] bg-[#17336d] px-3 text-xs font-semibold text-[#c4d8ff] shadow-[0_8px_22px_rgba(47,107,255,.14)] disabled:opacity-50"
              : "min-h-12 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-3 text-xs font-semibold text-[#8191ad] transition-colors hover:border-[#4a7fc8] hover:text-[#b9d0ff] disabled:opacity-50"}
          >
            {staffRoleLabel(role)}
          </button>
        );
      })}
    </div>
  );
}

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
    <div className="flex flex-col gap-5">
      {/* Action error */}
      {actionError && (
        <div className="rounded-xl border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      {/* Staff summary */}
      <section className={`${surface} p-4 sm:p-6`}>
        <SectionTitle label="スタッフ概要" labelEn="TEAM OVERVIEW" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "登録スタッフ", value: activeStaff.length, tone: "text-[#e8eef7]" },
            { label: "招待中", value: pendingInvites.length, tone: "text-[#91b9ff]" },
            { label: "あなたの権限", value: staffRoleLabel(currentRole), tone: "text-emerald-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[#20304a] bg-[#0b1322] px-4 py-4">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[#70809b]">{item.label}</p>
              <p className={`mt-2 text-xl font-bold ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active staff table */}
      <section className={surface}>
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <SectionTitle label="スタッフ一覧" labelEn="STAFF DIRECTORY" />
            </div>
          {canInvite && (
            <button
              type="button"
              onClick={() => setShowInviteForm((prev) => !prev)}
              className="min-h-12 shrink-0 rounded-xl bg-[#2f6bff] px-5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(47,107,255,.24)] transition-colors hover:bg-[#3977ff]"
            >
              {showInviteForm ? "キャンセル" : "+ スタッフを招待"}
            </button>
          )}
          </div>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="mx-4 mb-5 flex flex-col gap-4 rounded-2xl border border-[#31568c] bg-[#0b1322] p-4 sm:mx-6 sm:p-5">
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] text-[#5f9cff]">NEW INVITATION</p>
              <p className="mt-1 text-sm font-bold text-[#e8eef7]">新規スタッフを招待</p>
            </div>
            {inviteError && (
              <div className="rounded-xl border border-red-700/50 bg-red-900/30 px-3 py-2 text-xs text-red-300">
                {inviteError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#a9b7cc]">名前</label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="山田 太郎"
                  className="min-h-12 rounded-xl border border-[#2a3e5d] bg-[#070d18] px-4 py-3 text-sm text-[#edf3fc] placeholder:text-[#526079] focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#a9b7cc]">メールアドレス</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="staff@example.com"
                  className="min-h-12 rounded-xl border border-[#2a3e5d] bg-[#070d18] px-4 py-3 text-sm text-[#edf3fc] placeholder:text-[#526079] focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-xs font-semibold text-[#a9b7cc]">ロール</label>
                <RoleSelector
                  value={inviteForm.role}
                  options={invitableRoles}
                  disabled={isPending}
                  onChange={(role) => setInviteForm((f) => ({ ...f, role }))}
                  label="招待するスタッフのロール"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={isPending || !inviteForm.email || !inviteForm.name}
                className="min-h-12 rounded-xl bg-[#2f6bff] px-5 text-sm font-bold text-white transition-colors hover:bg-[#3977ff] disabled:bg-[#172238] disabled:text-[#526079]"
              >
                {isPending ? "送信中..." : "招待を送る"}
              </button>
            </div>
          </div>
        )}

        {/* Staff table */}
        {activeStaff.length === 0 ? (
          <div className="mx-4 mb-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#2a3e5d] px-5 py-10 text-center sm:mx-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#31568c] bg-[#122142] text-2xl text-[#73a7ff]">♙</div>
            <p className="text-sm font-semibold text-[#e8eef7]">スタッフが登録されていません</p>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#70809b]">NO STAFF MEMBERS</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0b1322]">
                <tr className="border-y border-[#20304a]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">名前</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">メール</th>
                  <th className="min-w-[330px] px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">ロール</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">ステータス</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">最終ログイン</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">操作</th>
                </tr>
              </thead>
              <tbody>
                {activeStaff.map((member) => (
                  <tr key={member.id} className="border-b border-[#20304a] transition-colors last:border-b-0 hover:bg-[#13203a]/60">
                    <td className="px-5 py-4 font-medium text-[#e8eef7]">
                      {member.name ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-[#8191ad]">
                      {member.email ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      {isOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as DealerStaffRole)
                          }
                          disabled={isPending}
                          aria-label={`${member.name ?? "スタッフ"}のロール`}
                          className="min-h-12 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-3 text-xs font-semibold text-[#c4d8ff] focus:border-[#4a7fc8] focus:outline-none focus:ring-2 focus:ring-[#3478ff]/20 disabled:opacity-50"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {staffRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-medium ${staffRoleBadgeColor(member.role)}`}
                        >
                          {staffRoleLabel(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-medium ${
                          member.status === "active"
                            ? "bg-green-900/40 text-green-400 border border-green-700/40"
                            : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {staffStatusLabel(member.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[#70809b]">
                      {member.last_login_at
                        ? new Date(member.last_login_at).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canToggleStatus(member) && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member)}
                          disabled={isPending}
                          className={`min-h-10 rounded-xl border px-4 text-xs font-semibold transition-colors ${
                            member.status === "active"
                              ? "border-[#2a3e5d] bg-[#0b1322] text-[#8191ad] hover:border-red-700/60 hover:bg-red-900/30 hover:text-red-300"
                              : "border-[#2a3e5d] bg-[#0b1322] text-[#8191ad] hover:border-green-700/60 hover:bg-green-900/30 hover:text-green-300"
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
      </section>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <section className={surface}>
          <div className="p-4 sm:p-6">
            <SectionTitle label="招待中" labelEn="PENDING INVITATIONS" />
            <p className="mt-3 text-xs text-[#70809b]">以下のメールアドレスへの招待が保留中です</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0b1322]">
                <tr className="border-y border-[#20304a]">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">名前</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">メール</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">ロール</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">招待日</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70809b]">操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr key={invite.id} className="border-b border-[#20304a] transition-colors last:border-b-0 hover:bg-[#13203a]/60">
                    <td className="px-5 py-4 text-[#d6e0ef]">{invite.name ?? "—"}</td>
                    <td className="px-5 py-4 text-xs text-[#8191ad]">{invite.email ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-medium ${staffRoleBadgeColor(invite.role)}`}
                      >
                        {staffRoleLabel(invite.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[#70809b]">
                      {invite.invited_at
                        ? new Date(invite.invited_at).toLocaleDateString("ja-JP")
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className="min-h-10 rounded-xl border border-[#2a3e5d] bg-[#0b1322] px-4 text-xs font-semibold text-[#8191ad] transition-colors hover:border-[#4a7fc8] hover:text-[#c4d8ff]"
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
        </section>
      )}
    </div>
  );
}
