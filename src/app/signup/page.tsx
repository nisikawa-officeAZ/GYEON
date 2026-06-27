"use client";

import { useState } from "react";
import Link        from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createPendingDealer } from "@/lib/dealer/create-pending-dealer";

const PASSWORD_MIN_LENGTH = 8;

function passwordError(pw: string, confirm: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) {
    return `パスワードは${PASSWORD_MIN_LENGTH}文字以上で設定してください。`;
  }
  if (pw !== confirm) {
    return "パスワードが一致しません。";
  }
  return null;
}

export default function SignUpPage() {
  const router = useRouter();

  const [businessName, setBusinessName] = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError("店舗名を入力してください。");
      return;
    }

    const pwErr = passwordError(password, confirm);
    if (pwErr) { setError(pwErr); return; }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          setError("このメールアドレスはすでに登録されています。ログイン画面からサインインしてください。");
        } else if (msg.includes("password")) {
          setError("パスワードの形式が正しくありません。");
        } else if (msg.includes("email")) {
          setError("メールアドレスの形式が正しくありません。");
        } else {
          setError("アカウントの作成に失敗しました。しばらく待ってから再試行してください。");
        }
        return;
      }

      if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError("このメールアドレスはすでに登録されています。ログイン画面からサインインしてください。");
        return;
      }

      if (!data.user?.id) {
        setError("アカウントの作成に失敗しました。再度お試しください。");
        return;
      }

      // Create the pending dealer record via server action (admin client, bypasses RLS)
      const dealerResult = await createPendingDealer({
        businessName: businessName.trim(),
        ownerUserId:  data.user.id,
        email,
      });

      if (!dealerResult.success) {
        setError("店舗情報の登録に失敗しました。しばらく待ってから再試行してください。");
        return;
      }

      const needsConfirmation = !data.session;
      router.push(`/signup/pending?confirm=${needsConfirmation ? "1" : "0"}`);
    } catch {
      setError("予期しないエラーが発生しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--gs-bg-2, #111118)",
    border:     "1px solid var(--gs-line, rgba(255,255,255,0.08))",
  };
  const focusStyle = "var(--gs-blue, #4f8ef7)";
  const blurStyle  = "var(--gs-line, rgba(255,255,255,0.08))";

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
          <p className="text-xs text-[#55556a]">ディーラー登録申請</p>
        </div>

        {/* ── Form card ──────────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-6 space-y-4"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Business name */}
          <div>
            <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
              店舗名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              autoComplete="organization"
              placeholder="例：〇〇カーディテイリング"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = focusStyle}
              onBlur={(e)  => e.currentTarget.style.borderColor = blurStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
              メールアドレス <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = focusStyle}
              onBlur={(e)  => e.currentTarget.style.borderColor = blurStyle}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[#9999b0] mb-1.5">
              パスワード
              <span className="ml-1 text-[#55556a] font-normal">{PASSWORD_MIN_LENGTH}文字以上</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={PASSWORD_MIN_LENGTH}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-[#f0f0f5] placeholder-[#55556a] focus:outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = focusStyle}
              onBlur={(e)  => e.currentTarget.style.borderColor = blurStyle}
            />
          </div>

          {/* Confirm password */}
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
              onFocus={(e) => e.currentTarget.style.borderColor = focusStyle}
              onBlur={(e)  => e.currentTarget.style.borderColor = blurStyle}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--gs-blue, #4f8ef7)" }}
          >
            {loading ? "申請中..." : "ディーラー登録を申請する"}
          </button>

          {/* Back to login */}
          <div className="text-center pt-1">
            <p className="text-xs text-[#55556a]">
              すでにアカウントをお持ちの方は{" "}
              <Link
                href="/login"
                className="underline transition-colors"
                style={{ color: "var(--gs-blue, #4f8ef7)" }}
              >
                ログイン
              </Link>
            </p>
          </div>
        </form>

      </div>
    </div>
  );
}
