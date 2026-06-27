// No-dealer gate: shown when a user is authenticated in Supabase Auth but
// has no active dealer_members record. Access to all shop data requires this
// record — it is set by a server-side admin, never by client input.

import { redirect }        from "next/navigation";
import { getCurrentUser }  from "@/lib/auth/get-current-user";
import LogoutButton        from "@/components/auth/LogoutButton";

export const metadata = { title: "店舗アクセス待ち | GYEON Detailer Agent" };
export const dynamic  = "force-dynamic";

export default async function NoDealerPage() {
  // If somehow an unauthenticated user lands here, send them to login
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 justify-center">
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

        {/* ── Status card ────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6 flex flex-col gap-5"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {/* Icon + title */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)" }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="var(--gs-amber, #f59e0b)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#f0f0f5]">店舗へのアクセスをお待ちください</h1>
              <p className="text-xs text-[#9999b0] mt-1">
                アカウント: <span className="text-[#f0f0f5] font-medium">{user.email}</span>
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "var(--gs-bg-2, #111118)" }}
          >
            <p className="text-xs text-[#9999b0] leading-relaxed">
              このアカウントはまだ店舗に紐付けられていません。
              以下の手順で店舗へのアクセスを取得してください。
            </p>

            <div className="flex flex-col gap-2.5">
              {[
                {
                  num: "1",
                  text: "ショップのオーナーまたは管理者に、登録したメールアドレスをお知らせください。",
                },
                {
                  num: "2",
                  text: "管理者があなたのアカウントを店舗に追加します。",
                },
                {
                  num: "3",
                  text: "追加完了後、このページをリロードするかログインし直してください。",
                },
              ].map(({ num, text }) => (
                <div key={num} className="flex gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      color:      "var(--gs-text-3, #55556a)",
                    }}
                  >
                    {num}
                  </div>
                  <p className="text-xs text-[#9999b0] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <a
              href="/no-dealer"
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center transition-all"
              style={{
                background:  "rgba(255,255,255,0.06)",
                color:       "var(--gs-text-2, #9999b0)",
                border:      "1px solid var(--gs-line, rgba(255,255,255,0.08))",
              }}
            >
              再確認
            </a>
            <LogoutButton
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-center transition-all"
              style={{
                background: "rgba(239,68,68,0.10)",
                color:      "var(--gs-red, #ef4444)",
                border:     "1px solid rgba(239,68,68,0.20)",
              }}
            />
          </div>
        </div>

        {/* ── Dev SQL guide ───────────────────────────────────────────────── */}
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
            <p className="text-xs text-amber-300/70 leading-relaxed">
              Supabase SQL Editor でこのユーザーを店舗に追加:
            </p>
            <div
              className="rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-x-auto"
              style={{ background: "rgba(0,0,0,0.4)", color: "#9999b0" }}
            >
              <p style={{ color: "#55556a" }}>-- ユーザーUUID確認</p>
              <p>SELECT id FROM auth.users WHERE email = &apos;{user.email}&apos;;</p>
              <br />
              <p style={{ color: "#55556a" }}>-- dealer_id確認</p>
              <p>SELECT id, business_name FROM dealers LIMIT 10;</p>
              <br />
              <p style={{ color: "#55556a" }}>-- dealer_membersへ追加</p>
              <p>INSERT INTO dealer_members</p>
              <p>  (user_id, dealer_id, role, status)</p>
              <p>VALUES</p>
              <p>  (&apos;{user.id}&apos;,</p>
              <p>   &apos;&lt;dealer_uuid&gt;&apos;,</p>
              <p>   &apos;admin&apos;, &apos;active&apos;);</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
