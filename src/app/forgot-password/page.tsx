"use client";

import { useState }   from "react";
import Link           from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
      });

      if (resetError) {
        setError("パスワードリセットメールの送信に失敗しました。再度お試しください。");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("予期しないエラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

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
          <p className="text-xs text-[#55556a]">パスワードのリセット</p>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-xs text-[#9999b0] leading-relaxed">
                登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
              </p>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

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
                    background: "var(--gs-bg-2, #111118)",
                    border:     "1px solid var(--gs-line, rgba(255,255,255,0.08))",
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--gs-blue, #4f8ef7)"}
                  onBlur={(e)  => e.currentTarget.style.borderColor = "var(--gs-line, rgba(255,255,255,0.08))"}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: "var(--gs-blue, #4f8ef7)" }}
              >
                {loading ? "送信中..." : "リセットメールを送信"}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-xs transition-colors"
                  style={{ color: "var(--gs-text-3, #55556a)" }}
                >
                  ← ログインに戻る
                </Link>
              </div>
            </form>
          ) : (
            /* Success state */
            <div className="flex flex-col items-center gap-4 text-center py-2">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)" }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="var(--gs-green, #22c55e)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 8.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7"/>
                  <polyline points="2 6 12 13 22 6"/>
                  <polyline points="16 19 18 21 22 17"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f0f0f5]">メールを送信しました</p>
                <p className="text-xs text-[#9999b0] mt-1 leading-relaxed">
                  <span className="text-[#f0f0f5] font-medium">{email}</span> に<br />
                  パスワードリセット用のリンクを送信しました。<br />
                  受信トレイと迷惑メールをご確認ください。
                </p>
              </div>
              <Link
                href="/login"
                className="mt-2 text-xs underline transition-colors"
                style={{ color: "var(--gs-blue, #4f8ef7)" }}
              >
                ログイン画面へ
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
