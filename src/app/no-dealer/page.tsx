// No-dealer gate: shown when a user is authenticated in Supabase Auth but
// has no active dealer_members record. Access to all shop data requires this
// record — it is set by a server-side admin, never by client input.

import { redirect }        from "next/navigation";
import { getCurrentUser }  from "@/lib/auth/get-current-user";
import { createClient }    from "@/lib/supabase/server";
import { createAdminClient }        from "@/lib/supabase/admin";
import { claimGyeonProvisioning }   from "@/lib/dealer/claim-gyeon-provisioning";
import { createPendingDealer }      from "@/lib/dealer/create-pending-dealer";
import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import LogoutButton        from "@/components/auth/LogoutButton";
import Brand               from "@/components/ui/Brand";

export const metadata = { title: "店舗アクセス待ち | GYEON Detailer Agent" };
export const dynamic  = "force-dynamic";

export default async function NoDealerPage() {
  // If somehow an unauthenticated user lands here, send them to login
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // The "recheck" action reloads this server route. Converge users whose
  // membership became active after they first landed here into the guarded
  // dealer dashboard instead of rendering the stale waiting state again.
  const supabase = await createClient();
  const { data: activeMembership } = await supabase
    .from("dealer_members")
    .select("dealer_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (activeMembership) redirect("/dashboard");

  // GYEON partner onboarding: /no-dealer is the guaranteed sink for every
  // verified user without an active membership, so it is the normal-login
  // claim convergence point — a CSV-matched applicant or an invited shop
  // owner converges here in ANY later session without re-verification.
  //
  // F2-08 SaaS isolation: EVERYTHING below is inside the server-only feature
  // gate. With GYEON_PARTNER_ONBOARDING_ENABLED not exactly "true", this page
  // runs its original behavior byte-for-byte — no claim, no admin client, no
  // invited-membership lookup, and no /shop-profile redirect. Because
  // /shop-profile itself redirects BACK to /no-dealer when the gate is off,
  // gating the only /no-dealer → /shop-profile edge here makes the SaaS
  // redirect loop structurally impossible.
  if (isGyeonPartnerOnboardingEnabled()) {
    let claimedGyeonProvisioning = false;
    if (user.email_confirmed_at) {
      try {
        const claim = await claimGyeonProvisioning();
        claimedGyeonProvisioning = claim.kind === "claimed";
      } catch {
        // Non-eligible/errored claims keep the existing no-dealer behavior.
      }

      // Recovery convergence for an Auth account whose confirmation succeeded
      // while the original pending-dealer write did not. Only the explicit
      // dealer-signup metadata marker is eligible, and the server action still
      // derives identity from the verified session. Pre-provisioned claims win
      // first so this never creates a second dealer for them.
      if (!claimedGyeonProvisioning) {
        const pendingDealer = await createPendingDealer();
        if (pendingDealer.kind === "created") {
          redirect("/signup/pending?confirm=0");
        }
      }
    }

    // A claimed-but-not-activated owner (membership 'invited') belongs on the
    // dedicated shop-profile surface, never on the waiting screen.
    const adminDb = createAdminClient();
    const { data: invitedMembership } = await adminDb
      .from("dealer_members")
      .select("dealer_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .eq("status", "invited")
      .limit(1)
      .maybeSingle();
    if (invitedMembership) redirect("/shop-profile");
  }

  // Detect whether the user belongs to a suspended dealer.
  // suspendDealer() sets dealer_members.status = 'suspended', so querying here
  // distinguishes "no membership" from "suspended membership".
  const { data: suspendedRow } = await supabase
    .from("dealer_members")
    .select("dealer_id")
    .eq("user_id", user.id)
    .eq("status", "suspended")
    .limit(1)
    .maybeSingle();
  const isSuspended = !!suspendedRow;

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center">
          <Brand size={56} />
        </div>

        {/* ── Status card ────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6 flex flex-col gap-5"
          style={{
            background:  "var(--gs-bg-card, #16161f)",
            borderColor: isSuspended
              ? "rgba(239,68,68,0.25)"
              : "var(--gs-line, rgba(255,255,255,0.08))",
          }}
        >
          {isSuspended ? (
            /* ── Suspended account message ─────────────────────────────── */
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.12)" }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                    stroke="#ef4444" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-base font-bold text-[#f0f0f5]">アカウントが停止されています</h1>
                  <p className="text-xs text-[#9999b0] mt-1">
                    アカウント: <span className="text-[#f0f0f5] font-medium">{user.email}</span>
                  </p>
                </div>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <p className="text-xs text-[#9999b0] leading-relaxed">
                  このアカウントは管理者によって一時停止されています。
                  ご不明な点はGYEONサポートまでお問い合わせください。
                </p>
              </div>

              <LogoutButton
                className="w-full py-2.5 rounded-lg text-sm font-medium text-center transition-all"
                style={{
                  background: "rgba(239,68,68,0.10)",
                  color:      "var(--gs-red, #ef4444)",
                  border:     "1px solid rgba(239,68,68,0.20)",
                }}
              />
            </>
          ) : (
            /* ── Pending access message ────────────────────────────────── */
            <>
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
            </>
          )}
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
              <p>   &apos;owner&apos;, &apos;active&apos;);</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
