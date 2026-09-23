"use client";

import { useState } from "react";
import Link        from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/auth/sanitize-next-path";
import Brand from "@/components/ui/Brand";
import { Suspense } from "react";

// Credential failure copy. This message must be shown ONLY for a rejected
// email/password sign-in — never for an authentication-link (callback/confirm)
// failure, which has nothing to do with the credentials the operator typed.
const INVALID_CREDENTIALS_MESSAGE =
  "メールアドレスまたはパスワードが正しくありません。";

// Sign-in was rejected because the email has not been verified yet. The
// password is not wrong; the email link has simply not been completed.
const EMAIL_NOT_CONFIRMED_MESSAGE =
  "メールアドレスの確認が完了していません。登録時にお送りした確認メール内のリンクを開いてから、再度ログインしてください。";

// Authentication-link failure flags set by the server-side auth boundaries
// (/api/auth/callback and /auth/confirm). Rendered as a dedicated notice with a
// concrete next action; the flags carry no secret and no raw provider error.
const AUTH_LINK_FAILURE_FLAGS = ["auth_callback_failed", "auth_confirm_failed"] as const;
const AUTH_LINK_FAILED_MESSAGE =
  "認証リンクを確認できませんでした。リンクの有効期限切れ、または使用済みの可能性があります。" +
  "新規登録の方は、確認メール内のリンクをもう一度開いてください。" +
  "パスワード再設定の方は「パスワードを忘れた方」から再度お手続きください。";

function authLinkNotice(errorFlag: string | null): string | null {
  if (!errorFlag) return null;
  return (AUTH_LINK_FAILURE_FLAGS as readonly string[]).includes(errorFlag)
    ? AUTH_LINK_FAILED_MESSAGE
    : null;
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);

  const authNotice = authLinkNotice(searchParams.get("error"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient({ rememberMe });
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        // Supabase AuthApiError carries a stable `code`. An unverified email is
        // a distinct state from wrong credentials and must be labelled as such.
        const code = authError.code ?? "";
        const msg  = authError.message.toLowerCase();
        if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
          setError(EMAIL_NOT_CONFIRMED_MESSAGE);
        } else {
          setError(INVALID_CREDENTIALS_MESSAGE);
        }
        return;
      }

      // Restore the preserved `?next=` destination. sanitizeNextPath() validates the value returned by
      // searchParams.get (already transport-decoded, so no further decoding) and ALWAYS returns a safe
      // internal path — falling back to "/" when `next` is absent or unsafe, and preserving valid
      // percent-encoding — so the redirect honors valid internal destinations and can never
      // open-redirect.
      const target = sanitizeNextPath(searchParams.get("next"));
      router.push(target);
      router.refresh();
    } catch {
      setError("予期しないエラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* ── Brand header ───────────────────────────────────────────────── */}
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          <Brand size={56} />
          <p className="text-xs text-[#55556a]">ショップ管理システムにサインイン</p>
        </div>

        {/* ── Authentication-link failure notice (not a credentials error) ── */}
        {authNotice && (
          <div
            role="status"
            className="mb-4 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10"
          >
            <p className="text-xs text-amber-300 font-medium leading-relaxed">{authNotice}</p>
          </div>
        )}

        {/* ── Form card ──────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-6 space-y-4"
          style={{
            background:   "var(--gs-bg-card, #16161f)",
            borderColor:  "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
              style={{
                background:  "var(--gs-bg-2, #111118)",
                border:      "1px solid var(--gs-line, rgba(255,255,255,0.08))",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--gs-blue, #4f8ef7)"}
              onBlur={(e)  => e.currentTarget.style.borderColor = "var(--gs-line, rgba(255,255,255,0.08))"}
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#9999b0]">
                パスワード
              </label>
              <Link
                href="/forgot-password"
                className="text-xs transition-colors"
                style={{ color: "var(--gs-text-3, #55556a)" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--gs-blue, #4f8ef7)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--gs-text-3, #55556a)"}
              >
                パスワードを忘れた方
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
                style={{
                  background:  "var(--gs-bg-2, #111118)",
                  border:      "1px solid var(--gs-line, rgba(255,255,255,0.08))",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--gs-blue, #4f8ef7)"}
                onBlur={(e)  => e.currentTarget.style.borderColor = "var(--gs-line, rgba(255,255,255,0.08))"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-[#9999b0] hover:text-[#f0f0f5] transition-colors"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded accent-[#4f8ef7]"
              style={{ background: "var(--gs-bg-2, #111118)" }}
            />
            <span className="text-xs text-[#9999b0]">ログイン状態を保持する</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--gs-blue, #4f8ef7)" }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>

          {/* Sign-up link */}
          <div className="text-center pt-1">
            <p className="text-xs text-[#55556a]">
              アカウントをお持ちでない方は{" "}
              <Link
                href="/signup"
                className="underline transition-colors"
                style={{ color: "var(--gs-blue, #4f8ef7)" }}
              >
                新規登録
              </Link>
            </p>
          </div>
        </form>

        {/* Dev environment label */}
        {process.env.NODE_ENV === "development" && (
          <p className="text-center text-[10px] text-[#55556a] mt-4 tracking-wider">
            DEVELOPMENT ENVIRONMENT
          </p>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <LoginForm />
    </Suspense>
  );
}
