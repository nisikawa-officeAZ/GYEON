import { redirect }              from "next/navigation";
import { getCurrentDealer }       from "@/lib/auth/get-current-dealer";
import { getCurrentUser }         from "@/lib/auth/get-current-user";
import { getCurrentAdmin }        from "@/lib/admin/get-current-admin";
import { createClient }           from "@/lib/supabase/server";
import { rankLabelEn }            from "@/lib/ranks/dealer-ranks";
import { BRAND, deriveHomeBrandPayload } from "@/lib/brand/variant";

// Bare page label only. The product name is appended exactly once by the shared
// metadata template in src/app/layout.tsx (`%s | ${BRAND.name}`), so repeating it
// here would render it twice.
export const metadata = { title: "ホーム" };

export default async function HomePage() {

  // ── Super Admin gate (must come first) ───────────────────────────────────
  // Super Admins have no dealer_members record. Route them to the admin console
  // BEFORE any dealer validation so they are never trapped on /no-dealer.
  // Both lookups are independent, request-cached authority reads (React
  // `cache()`), so starting them concurrently costs no extra query — only
  // the decision on each result stays sequential (admin acted on first).
  const adminPromise  = getCurrentAdmin();
  const dealerPromise = getCurrentDealer();

  const admin = await adminPromise;
  if (admin) redirect("/admin/dashboard");

  // ── Dealer gate ──────────────────────────────────────────────────────────
  // Middleware ensures the user is authenticated before reaching this page.
  // Here we additionally verify they have an active dealer_members record.
  const dealer = await dealerPromise;
  if (!dealer) {
    const user = await getCurrentUser();
    if (user) redirect("/no-dealer");
    redirect("/login");
  }

  // ── Onboarding redirect + dealer certification (rank) ────────────────────
  let shouldRedirectToOnboarding = false;
  let rawRank: string | null = null;
  try {
    const supabase = await createClient();
    const { data: settings, error } = await supabase
      .from("dealer_settings")
      .select("onboarding_completed, onboarding_step, detailer_rank")
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();
    if (!error) {
      rawRank = (settings?.detailer_rank as string | null) ?? null;
      const completed = settings?.onboarding_completed ?? false;
      const step      = settings?.onboarding_step      ?? 1;
      if (!settings || (!completed && step === 1)) shouldRedirectToOnboarding = true;
    }
  } catch { /* column missing — skip */ }

  if (shouldRedirectToOnboarding) redirect("/onboarding");

  // Certification label — dynamic, from the centralized rank definition.
  // Empty when no rank has been assigned (nothing is displayed then).
  const certLabel = rawRank && rawRank.trim() ? rankLabelEn(rawRank) : "";

  // Deployment-level application brand, transported to the static home as one
  // validated payload. src/lib/brand/variant.ts stays the single source of truth;
  // the static file holds no per-brand text or asset path of its own.
  const brandParam = encodeURIComponent(JSON.stringify(deriveHomeBrandPayload()));
  const homeSrc = certLabel
    ? `/desktop-home.html?cert=${encodeURIComponent(certLabel)}&b=${brandParam}`
    : `/desktop-home.html?b=${brandParam}`;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          トップ画面 — 全ビューポート共通。
          Gensparkデザイン(/public/desktop-home.html)をそのまま忠実に表示。
          デスクトップ／タブレット／モバイル(ドロワー含む)のレスポンシブ挙動は
          すべて desktop-home.html 側が所有する。
          メニューはクリックで実ページへ遷移(target=_parent)。
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 z-50 bg-[#080d1a]">
        <iframe
          src={homeSrc}
          title={BRAND.name}
          className="w-full h-full border-0 block"
        />
      </div>
    </>
  );
}
