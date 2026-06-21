"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { searchUsersAdmin } from "@/lib/admin/get-users-admin";
import { sendPasswordResetEmail, createTemporaryPassword } from "@/lib/admin/password-actions";
import { disableUserAdmin, enableUserAdmin, deleteUserAdmin, updateUserEmail } from "@/lib/admin/user-actions";

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  dealer_name: string | null;
  dealer_role: string | null;
}

type ModalState =
  | { type: "none" }
  | { type: "tempPassword"; password: string; email: string | null }
  | { type: "deleteConfirm"; userId: string; email: string | null }
  | { type: "emailChange"; userId: string; currentEmail: string | null };

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

export default function UsersAdminClient() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [deleteInput, setDeleteInput] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = useCallback((q: string) => {
    setLoading(true);
    startTransition(async () => {
      try {
        const result = await searchUsersAdmin(q);
        setUsers(result);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "エラーが発生しました", "error");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    // Initial load
    fetchUsers("");
  }, [fetchUsers]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchUsers]);

  // ── Action handlers ──────────────────────────────────────────────────────

  const handlePasswordReset = (userId: string, email: string | null) => {
    startTransition(async () => {
      const result = await sendPasswordResetEmail(userId);
      if (result.success) {
        showToast(`パスワードリセットメールを ${result.email} に送信しました`, "success");
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleTempPassword = (userId: string, email: string | null) => {
    startTransition(async () => {
      const result = await createTemporaryPassword(userId);
      if (result.success && result.temporaryPassword) {
        setModal({ type: "tempPassword", password: result.temporaryPassword, email });
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleToggleBan = (user: UserRow) => {
    const banned = isBanned(user.banned_until);
    startTransition(async () => {
      const result = banned
        ? await enableUserAdmin(user.id)
        : await disableUserAdmin(user.id);
      if (result.success) {
        showToast(banned ? "アカウントを解除しました" : "アカウントを停止しました", "success");
        fetchUsers(query);
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleDeleteConfirm = () => {
    if (modal.type !== "deleteConfirm") return;
    if (deleteInput !== "DELETE") return;
    const userId = modal.userId;
    setModal({ type: "none" });
    setDeleteInput("");
    startTransition(async () => {
      const result = await deleteUserAdmin(userId);
      if (result.success) {
        showToast("ユーザーを削除しました", "success");
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  const handleEmailChange = () => {
    if (modal.type !== "emailChange") return;
    const userId = modal.userId;
    const email = newEmail.trim();
    if (!email) return;
    setModal({ type: "none" });
    setNewEmail("");
    startTransition(async () => {
      const result = await updateUserEmail(userId, email);
      if (result.success) {
        showToast("メールアドレスを更新しました", "success");
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, email } : u))
        );
      } else {
        showToast(result.error ?? "エラーが発生しました", "error");
      }
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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
          <h1 className="text-xl font-bold text-slate-100">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} 件</p>
        </div>
        <input
          type="text"
          placeholder="メール・IDで検索..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72 px-3 py-1.5 text-sm bg-[#1e293b] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  メール
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ディーラー
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  登録日
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  最終ログイン
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    読み込み中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {query ? "該当するユーザーが見つかりません" : "ユーザーがいません"}
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const banned = isBanned(user.banned_until);
                  return (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setNewEmail(user.email ?? "");
                            setModal({ type: "emailChange", userId: user.id, currentEmail: user.email });
                          }}
                          className="font-medium text-slate-200 hover:text-blue-400 transition-colors text-left"
                        >
                          {user.email ?? "—"}
                        </button>
                        <div className="text-xs text-slate-600 mt-0.5 font-mono">{user.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3">
                        {user.dealer_name ? (
                          <div>
                            <div className="text-slate-300">{user.dealer_name}</div>
                            <div className="text-xs text-slate-500">{user.dealer_role}</div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(user.created_at)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(user.last_sign_in_at)}</td>
                      <td className="px-4 py-3">
                        {banned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50">
                            停止中
                          </span>
                        ) : !user.email_confirmed_at ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700/50">
                            未確認
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-700/50">
                            有効
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            onClick={() => handlePasswordReset(user.id, user.email)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-50"
                          >
                            PW リセット
                          </button>
                          <button
                            onClick={() => handleTempPassword(user.id, user.email)}
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors disabled:opacity-50"
                          >
                            仮PW発行
                          </button>
                          <button
                            onClick={() => handleToggleBan(user)}
                            disabled={isPending}
                            className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 ${
                              banned
                                ? "bg-green-900/50 hover:bg-green-800/60 text-green-300"
                                : "bg-amber-900/50 hover:bg-amber-800/60 text-amber-300"
                            }`}
                          >
                            {banned ? "解除" : "停止"}
                          </button>
                          <button
                            onClick={() =>
                              setModal({ type: "deleteConfirm", userId: user.id, email: user.email })
                            }
                            disabled={isPending}
                            className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800/60 text-red-300 rounded transition-colors disabled:opacity-50"
                          >
                            削除
                          </button>
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

      {/* ── Temp Password Modal ─────────────────────────────────────────── */}
      {modal.type === "tempPassword" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-100">仮パスワード発行</h2>
            <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
              このパスワードはここにのみ表示されます。安全な方法でユーザーに伝えてください。
            </div>
            {modal.email && (
              <div className="text-sm text-slate-400">
                対象ユーザー: <span className="text-slate-200">{modal.email}</span>
              </div>
            )}
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
              パスワードは1度のみ表示されます。このダイアログを閉じると再確認できません。
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

      {/* ── Delete Confirm Modal ────────────────────────────────────────── */}
      {modal.type === "deleteConfirm" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-red-400">ユーザーを削除</h2>
            <p className="text-sm text-slate-300">
              この操作は取り消せません。
              {modal.email && (
                <> <span className="font-medium text-slate-100">{modal.email}</span> を完全に削除します。</>
              )}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                確認のため <span className="font-mono font-bold text-slate-300">DELETE</span> と入力してください
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-600 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setModal({ type: "none" });
                  setDeleteInput("");
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteInput !== "DELETE" || isPending}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Email Change Modal ──────────────────────────────────────────── */}
      {modal.type === "emailChange" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-base font-bold text-slate-100">メールアドレス変更</h2>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">現在のメール</p>
              <p className="text-sm text-slate-400">{modal.currentEmail ?? "—"}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">新しいメールアドレス</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setModal({ type: "none" });
                  setNewEmail("");
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleEmailChange}
                disabled={!newEmail.trim() || isPending}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                更新する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
