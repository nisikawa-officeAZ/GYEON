// Sign-up pending — shown after account creation while waiting for dealer linking.
// The user now exists in Supabase Auth but has no dealer_members record yet.
// Access to app features requires an admin to insert a dealer_members row.

import Link from "next/link";

interface Props {
  searchParams: Promise<{ confirm?: string }>;
}

export const metadata = { title: "登録完了 | GYEON Detailer Agent" };

export default async function SignUpPendingPage({ searchParams }: Props) {
  const params        = await searchParams;
  const needsConfirm  = params.confirm === "1";
  const isDev         = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ── Brand header ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 justify-center">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--gs-blue, #4f8ef7)" }}
          >
            <span className="text-white text-xl font-black">G</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-[#55556a] tracking-[2.5px] uppercase">GYEON</p>
            <p className="text-base font-bold text-[#f0f0f5] leading-tight">Detailer Agent</p>
          </div>
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
              <h1 className="text-lg font-bold text-[#f0f0f5]">アカウントを作成しました</h1>
              <p className="text-xs text-[#9999b0] mt-1">ご登録ありがとうございます</p>
            </div>
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
                body="登録したメールアドレスに確認メールをお送りしました。受信トレイと迷惑メールフォルダをご確認ください。"
                highlight
              />
            )}
            <Step
              num={needsConfirm ? "2" : "1"}
              title="店舗管理者に連絡してください"
              body="ショップのオーナーまたは管理者に、アカウントを作成した旨をお知らせください。"
            />
            <Step
              num={needsConfirm ? "3" : "2"}
              title="店舗への紐付けを待つ"
              body="管理者があなたのアカウントを店舗に追加した後、アプリをご利用いただけます。"
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

        {/* ── Dev note ───────────────────────────────────────────────────── */}
        {isDev && (
          <div
            className="rounded-xl border p-4 flex flex-col gap-2"
            style={{
              borderColor: "rgba(245,158,11,0.3)",
              background:  "rgba(245,158,11,0.06)",
            }}
          >
            <p className="text-xs font-bold text-amber-400 tracking-wider uppercase">
              開発者メモ — 本番環境では非表示
            </p>
            <p className="text-xs text-amber-300/75 leading-relaxed">
              新規ユーザーを店舗に紐付けるには、Supabase SQL Editor で以下を実行してください。
            </p>
            <div
              className="rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-x-auto"
              style={{ background: "rgba(0,0,0,0.4)", color: "#9999b0" }}
            >
              <p style={{ color: "#55556a" }}>-- 1. ユーザーのUUIDを確認</p>
              <p>SELECT id, email FROM auth.users WHERE email = &apos;登録したメール&apos;;</p>
              <br />
              <p style={{ color: "#55556a" }}>-- 2. 対象の dealer_id を確認</p>
              <p>SELECT id, business_name FROM dealers LIMIT 10;</p>
              <br />
              <p style={{ color: "#55556a" }}>-- 3. dealer_members に追加</p>
              <p>INSERT INTO dealer_members (user_id, dealer_id, role, status)</p>
              <p>VALUES (&apos;&lt;user_uuid&gt;&apos;, &apos;&lt;dealer_uuid&gt;&apos;, &apos;admin&apos;, &apos;active&apos;);</p>
            </div>
            <p className="text-[10px] text-amber-300/50">
              ※ dealer_id はクライアントから受け取ってはいけません。必ずサーバー側のSupabaseで設定してください。
            </p>
          </div>
        )}

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
