// Sign-up pending — shown after dealer registration is submitted.
// The user and dealers record now exist; approval_status = 'pending'.
// Access to app features is granted only after a Super Admin or GYEON Admin approves
// the dealer and the system creates the dealer_members row.

import Link from "next/link";
import Brand from "@/components/ui/Brand";

interface Props {
  searchParams: Promise<{ confirm?: string; setup_error?: string }>;
}

export const metadata = { title: "申請受付完了 | GYEON Detailer Agent" };

export default async function SignUpPendingPage({ searchParams }: Props) {
  const params       = await searchParams;
  const needsConfirm = params.confirm === "1";
  const setupError   = params.setup_error === "1";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ── Brand header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-center">
          <Brand size={56} />
        </div>

        {/* ── Success card ───────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6 flex flex-col gap-4"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(34,197,94,0.15)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="var(--gs-green, #22c55e)" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#f0f0f5]">
                {needsConfirm ? "確認メールを送信しました" : "ディーラー登録を受け付けました"}
              </h1>
              <p className="text-xs text-[#9999b0] mt-1">
                {needsConfirm
                  ? "メールアドレスの確認後に登録申請が完了します。"
                  : "登録申請を受け付けました。審査完了までお待ちください。"}
              </p>
            </div>
          </div>

          {setupError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-xs text-red-400 leading-relaxed">
                メールアドレスは確認できましたが、店舗情報の登録を完了できませんでした。
                ログイン後に再確認するか、GYEONサポートへお問い合わせください。
              </p>
            </div>
          )}

          {/* Status message */}
          <div
            className="rounded-xl border px-4 py-4 flex flex-col gap-2"
            style={{
              background:   "rgba(79,142,247,0.06)",
              borderColor:  "rgba(79,142,247,0.20)",
            }}
          >
            <p className="text-sm font-semibold text-[#f0f0f5] leading-snug">
              GYEON Japanの承認後にアカウントをご利用いただけます。
            </p>
            <p className="text-xs text-[#9999b0] leading-relaxed">
              GYEON Japanによる審査が完了次第、ログインしてシステムをご利用いただけます。
              審査には通常1〜3営業日かかります。
            </p>
          </div>

          {/* Steps */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "var(--gs-bg-2, #111118)" }}
          >
            {needsConfirm && (
              <Step
                num="1"
                title="メールを確認してください"
                body="登録したメールアドレスに確認メールをお送りしました。メール内の「メールアドレスを確認する」を押してください。受信トレイと迷惑メールフォルダもご確認ください。"
                highlight
              />
            )}
            <Step
              num={needsConfirm ? "2" : "1"}
              title="審査をお待ちください"
              body="GYEON Japanが申請内容を確認します。承認後、登録メールアドレスにご連絡します。"
            />
            <Step
              num={needsConfirm ? "3" : "2"}
              title="承認後にログイン"
              body="承認完了後、下記のログイン画面からシステムにアクセスできます。"
            />
          </div>

          {/* Login button */}
          <Link
            href="/login"
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white text-center transition-all"
            style={{ background: "var(--gs-blue, #4f8ef7)" }}
          >
            ログイン画面へ
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Local component ──────────────────────────────────────────────────────────
function Step({
  num,
  title,
  body,
  highlight = false,
}: {
  num: string;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
        style={{
          background: highlight
            ? "var(--gs-blue-dim, rgba(79,142,247,0.15))"
            : "rgba(255,255,255,0.06)",
          color: highlight ? "var(--gs-blue, #4f8ef7)" : "var(--gs-text-3, #55556a)",
        }}
      >
        {num}
      </div>
      <div className="flex flex-col gap-0.5 flex-1">
        <p
          className="text-xs font-semibold"
          style={{ color: highlight ? "var(--gs-text, #f0f0f5)" : "var(--gs-text-2, #9999b0)" }}
        >
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--gs-text-3, #55556a)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}
