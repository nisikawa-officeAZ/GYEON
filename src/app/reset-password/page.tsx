"use client";

// Password reset page — reached after clicking the reset email link.
// Supabase exchanges the auth code at /api/auth/callback, which sets a
// recovery session cookie, then redirects here. The user enters a new password
// and we call supabase.auth.updateUser().

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import Link                    from "next/link";
import { createClient }        from "@/lib/supabase/client";

const PASSWORD_MIN_LENGTH = 8;

type PageState = "loading" | "ready" | "submitting" | "success" | "error-no-session";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [pageState,   setPageState]   = useState<PageState>("loading");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [error,       setError]       = useState<string | null>(null);

  // Wait for the recovery session to be established.
  // Supabase fires PASSWORD_RECOVERY after the callback route sets the session.
  useEffect(() => {
    const supabase = createClient();

    // Check if there's already an active recovery session from the callback redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState("ready");
      } else {
        // Subscribe — session may arrive shortly after page load
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" && session) {
              setPageState("ready");
            } else if (event === "SIGNED_OUT") {
              setPageState("error-no-session");
            }
          }
        );

        // Timeout after 10 s — link may have expired
        const timer = setTimeout(() => {
          setPageState(prev => prev === "loading" ? "error-no-session" : prev);
        }, 10_000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`パスワードは${PASSWORD_MIN_LENGTH}文字以上で設定してください。`);
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }

    setPageState("submitting");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("パスワードの更新に失敗しました。リセットリンクが期限切れの可能性があります。");
        setPageState("ready");
        return;
      }

      setPageState("success");
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("予期しないエラーが発生しました。再度お試しください。");
      setPageState("ready");
    }
  }

  const inputStyle = {
    background: "var(--gs-bg-2, #111118)",
    border:     "1px solid var(--gs-line, rgba(255,255,255,0.08))",
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "var(--gs-blue, #4f8ef7)" }}
            >
              <span className="text-white text-xl font-black">G</span>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#55556a] tracking-[2.5px] uppercase">GYEON</p>
              <p className="text-base font-bold text-[#f0f0f5] leading-tight">Detailer Agent</p>
            </div>
          </div>
          <p className="text-xs text-[#55556a]">新しいパスワードを設定</p>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >

          {/* Loading */}
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-2xl animate-spin text-[#4f8ef7]">⟳</span>
              <p className="text-xs text-[#9999b0]">認証情報を確認しています...</p>
            </div>
          )}

          {/* No session — link expired */}
          {pageState === "error-no-session" && (
            <div className="flex flex-col items-center gap-4 text-center py-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.12)" }}>
                <span className="text-red-400 text-xl">✕</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f0f0f5]">リンクが無効です</p>
                <p className="text-xs text-[#9999b0] mt-1 leading-relaxed">
                  パスワードリセットリンクが期限切れまたは無効です。<br />
                  再度パスワードリセットを申請してください。
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "var(--gs-blue, #4f8ef7)" }}
              >
                パスワードリセットへ
              </Link>
            </div>
          )}

          {/* Form */}
          {(pageState === "ready" || pageState === "submitting") && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
                  新しいパスワード
                  <span className="ml-1 text-[#55556a] font-normal">{PASSWORD_MIN_LENGTH}文字以上</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--gs-blue, #4f8ef7)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--gs-line, rgba(255,255,255,0.08))"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--gs-blue, #4f8ef7)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--gs-line, rgba(255,255,255,0.08))"}
                />
              </div>

              <button
                type="submit"
                disabled={pageState === "submitting"}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--gs-blue, #4f8ef7)" }}
              >
                {pageState === "submitting" ? "更新中..." : "パスワードを更新"}
              </button>
            </form>
          )}

          {/* Success */}
          {pageState === "success" && (
            <div className="flex flex-col items-center gap-4 text-center py-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="var(--gs-green, #22c55e)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f0f0f5]">パスワードを更新しました</p>
                <p className="text-xs text-[#9999b0] mt-1">3秒後にログイン画面へ移動します...</p>
              </div>
              <Link
                href="/login"
                className="text-xs underline"
                style={{ color: "var(--gs-blue, #4f8ef7)" }}
              >
                すぐにログインへ
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
