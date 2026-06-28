"use client";

import { useState } from "react";
import Link        from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(
    searchParams.get("registered") === "1"
      ? null  // will show success note instead
      : null,
  );
  const [loading,  setLoading]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);

  const justRegistered = searchParams.get("registered") === "1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient({ rememberMe });
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError("メールアドレスまたはパスワードが正しくありません。");
        return;
      }

      router.push("/");
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
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--gs-blue, #4f8ef7)" }}
            >
              <span className="text-white text-xl font-black tracking-tight">G</span>
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-[#55556a] tracking-[2.5px] uppercase">GYEON</p>
              <p className="text-base font-bold text-[#f0f0f5] leading-tight">Detailer Agent</p>
            </div>
          </div>
          <p className="text-xs text-[#55556a]">ショップ管理システムにサインイン</p>
        </div>

        {/* ── Post-registration success note ─────────────────────────────── */}
        {justRegistered && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <p className="text-xs text-emerald-400 font-medium">アカウントを作成しました。ログインしてください。</p>
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
