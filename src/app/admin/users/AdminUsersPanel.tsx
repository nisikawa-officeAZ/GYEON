"use client";

import { useState, useTransition } from "react";
import {
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  changeAdminRole,
  resetAdminPassword,
} from "@/lib/admin/admin-user-actions";
import { ADMIN_ROLE_META } from "@/lib/admin/admin-roles";
import type { AdminUserDB } from "@/lib/admin/admin-types";
import type { AdminRole } from "@/lib/admin/admin-roles";

type CreatableRole = Exclude<AdminRole, "super_admin">;

type Modal =
  | { type: "none" }
  | { type: "create" }
  | { type: "tempPassword"; password: string; email: string }
  | { type: "changeRole"; adminId: string; currentRole: AdminRole; email: string | null }
  | { type: "confirmDisable"; adminId: string; email: string | null };

function RoleBadge({ role }: { role: string }) {
  const meta = ADMIN_ROLE_META[role as AdminRole];
  if (!meta) return <span className="text-xs text-slate-500">{role}</span>;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

interface Props {
  adminUsers: AdminUserDB[];
  callerId: string;
}

export default function AdminUsersPanel({ adminUsers: initialUsers, callerId }: Props) {
  const [users, setUsers]     = useState<AdminUserDB[]>(initialUsers);
  const [modal, setModal]     = useState<Modal>({ type: "none" });
  const [toast, setToast]     = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [createEmail, setCreateEmail] = useState("");
  const [createName,  setCreateName]  = useState("");
  const [createRole,  setCreateRole]  = useState<CreatableRole>("gyeon_admin");

  // Change role state
  const [newRole, setNewRole] = useState<CreatableRole>("gyeon_admin");

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleCreate = () => {
    if (!createEmail.trim()) return;
    startTransition(async () => {
      const result = await createAdminUser(createEmail.trim(), createName.trim(), createRole);
      if (result.success && result.tempPassword) {
        setModal({ type: "tempPassword", password: result.tempPassword, email: createEmail.trim() });
        setCreateEmail("");
        setCreateName("");
        setCreateRole("gyeon_admin");
        // Refresh list by re-fetching isn't available in client; append optimistically
        showToast("管理者を作成しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
        setModal({ type: "none" });
      }
    });
  };

  const handleToggleDisable = (user: AdminUserDB) => {
    if (user.user_id === callerId) {
      showToast("自分自身は変更できません", "error");
      return;
    }
    if (user.status === "active") {
      setModal({ type: "confirmDisable", adminId: user.id, email: user.email });
    } else {
      startTransition(async () => {
        const result = await enableAdminUser(user.id);
        if (result.success) {
          setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: "active" } : u));
          showToast("アカウントを有効化しました", "success");
        } else {
          showToast(result.error ?? "エラーが発生しました", "error");
        }
      });
    }
  };

  const handleConfirmDisable = () => {
    if (modal.type !== "confirmDisable") return;
    const adminId = modal.adminId;
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await disableAdminUser(adminId);
      if (result.success) {
        setUsers((prev) => prev.map((u) => u.id === adminId ? { ...u, status: "disabled" } : u));
        showToast("アカウントを停止しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleChangeRole = () => {
    if (modal.type !== "changeRole") return;
    const adminId = modal.adminId;
    setModal({ type: "none" });
    startTransition(async () => {
      const result = await changeAdminRole(adminId, newRole);
      if (result.success) {
        setUsers((prev) => prev.map((u) => u.id === adminId ? { ...u, role: newRole } : u));
        showToast("ロールを変更しました", "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleResetPassword = (user: AdminUserDB) => {
    startTransition(async () => {
      const result = await resetAdminPassword(user.id);
      if (result.success) {
        showToast(`パスワードリセットメールを ${result.email} に送信しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg max-w-sm ${
            toast.type === "success"
              ? "bg-green-900 text-green-200 border border-green-700"
              : "bg-red-900 text-red-200 border border-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{users.length} 件のAdmin User</p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          disabled={isPending}
          className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
        >
          + New Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {["メール / 名前", "ロール", "ステータス", "作成日", "操作"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-600">
                    Admin Userがいません
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.user_id === callerId;
                  const isDisabled = user.status !== "active";
                  const isSuperAdmin = user.role === "super_admin";
                  return (
                    <tr key={user.id} className={`hover:bg-slate-800/20 transition-colors ${isDisabled ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{user.email ?? "—"}</div>
                        {user.name && <div className="text-slate-500 text-[10px]">{user.name}</div>}
                        {isSelf && <div className="text-[10px] text-blue-400 mt-0.5">現在のセッション</div>}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        {isDisabled ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-800/40">停止中</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-green-900/30 text-green-300 border border-green-800/40">有効</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={isPending || isDisabled}
                            className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-40"
                          >
                            PW リセット
                          </button>
                          {!isSuperAdmin && !isSelf && (
                            <button
                              onClick={() => {
                                setNewRole(user.role as CreatableRole);
                                setModal({ type: "changeRole", adminId: user.id, currentRole: user.role, email: user.email });
                              }}
                              disabled={isPending}
                              className="text-[10px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-40"
                            >
                              ロール変更
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleDisable(user)}
                              disabled={isPending}
                              className={`text-[10px] px-2 py-1 rounded transition-colors disabled:opacity-40 ${
                                isDisabled
                                  ? "bg-green-900/40 hover:bg-green-800/50 text-green-300"
                                  : "bg-amber-900/40 hover:bg-amber-800/50 text-amber-300"
                              }`}
                            >
                              {isDisabled ? "有効化" : "停止"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {modal.type === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-100">New Admin User</h2>
            <p className="text-xs text-slate-500">
              アカウントを作成し、初回ログイン用の仮パスワードを発行します。
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">メールアドレス *</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">名前（任意）</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="田中 太郎"
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">ロール *</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as CreatableRole)}
                  className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="gyeon_admin">GYEON Admin</option>
                  <option value="logistics_admin">Logistics Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setModal({ type: "none" })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={!createEmail.trim() || isPending}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                作成する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Temp Password Modal ─────────────────────────────────────────── */}
      {modal.type === "tempPassword" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-100">仮パスワード発行</h2>
            <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
              このパスワードはここにのみ表示されます。安全な方法でユーザーに伝えてください。
            </div>
            <div className="text-sm text-slate-400">
              アカウント: <span className="text-slate-200">{modal.email}</span>
            </div>
            <div className="relative">
              <div className="font-mono text-lg font-bold text-slate-100 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 tracking-widest select-all">
                {modal.password}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(modal.password);
                  showToast("コピーしました", "success");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                コピー
              </button>
            </div>
            <p className="text-xs text-slate-500">
              ログイン後すみやかにパスワードを変更してください。このダイアログを閉じると再確認できません。
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setModal({ type: "none" })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Disable Modal ───────────────────────────────────────── */}
      {modal.type === "confirmDisable" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-amber-400">アカウントを停止</h2>
            <p className="text-sm text-slate-300">
              {modal.email && (
                <><span className="font-medium text-slate-100">{modal.email}</span> の管理者アクセスを停止します。</>
              )}
              停止後も再有効化できます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ type: "none" })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDisable}
                disabled={isPending}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
              >
                停止する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Role Modal ───────────────────────────────────────────── */}
      {modal.type === "changeRole" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-100">ロール変更</h2>
            <div className="text-sm text-slate-400">
              {modal.email ?? "—"}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20">現在:</span>
                <RoleBadge role={modal.currentRole} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-20">変更先:</span>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as CreatableRole)}
                  className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:border-slate-400"
                >
                  <option value="gyeon_admin">GYEON Admin</option>
                  <option value="logistics_admin">Logistics Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ type: "none" })}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleChangeRole}
                disabled={isPending || newRole === modal.currentRole}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                変更する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
