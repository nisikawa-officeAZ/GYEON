// GYEON Business Hub — Settings Category Page (Sprint 12H)
//
// Dynamic server component for /settings/[category] routes.
//
// Handles all 20 SettingsCategoryId slugs. The existing /settings/ai route
// takes precedence over this dynamic route for the slug "ai" (Next.js
// App Router static-route priority).
//
// Security:
//   - Staff role resolved server-side via getCurrentStaff()
//   - dealer_id is always from getCurrentDealer() (inside server actions)
//   - Visibility check applied before any category detail is rendered
//   - Access-denied state reveals no category info (SPOL-004)
//   - Client-side visibility is UX only — server enforcement is Sprint 13+
//
// Rendering strategy:
//   - Active categories: show metadata + registered items + status
//   - Future categories: show coming-soon state
//   - Enterprise categories: show enterprise-locked state
//   - Access denied: show generic gate with no category names exposed

import { notFound }                       from "next/navigation";
import type { Metadata }                  from "next";
import MainLayout                         from "@/components/layout/MainLayout";
import { getCurrentStaff }               from "@/lib/staff/get-current-staff";
import { getCanonicalDealerSettings }    from "@/lib/dealer-settings/get-canonical-dealer-settings";
import {
  getSettingsCategory,
  resolveVisibilityFromRole,
  canViewSetting,
  getRegistrationsForCategory,
} from "@/lib/settings";
import type { SettingsCategoryId }        from "@/lib/settings";
import SettingsCategoryPageView           from "@/components/settings/SettingsCategoryPageView";

// ─── Page metadata ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const cat = getSettingsCategory(category as SettingsCategoryId);
  if (!cat) return { title: "Not Found — Settings" };
  return {
    title:       `${cat.display_name} — Settings`,
    description: cat.description.slice(0, 160),
  };
}

// ─── Page component ───────────────────────────────────────────────────────────

export default async function SettingsCategoryPage({ params }: PageProps) {
  const { category } = await params;

  // Validate slug against the registry — 404 for any unknown slug
  const categoryMeta = getSettingsCategory(category as SettingsCategoryId);
  if (!categoryMeta) notFound();

  // Resolve staff role server-side for visibility gate
  // getCurrentStaff() injects dealer_id from getCurrentDealer() internally
  const staffInfo = await getCurrentStaff().catch(() => null);
  const userLevel  = resolveVisibilityFromRole(staffInfo?.role ?? null);

  // Visibility check (SPOL-001 / SPOL-004)
  // Note: this is a UX gate — full server-side enforcement wired in Sprint 13
  const canAccess = canViewSetting(userLevel, categoryMeta.min_visibility);

  // Load dealer settings only when user has access and the category is active.
  // Skipping the fetch for future / enterprise / access-denied reduces load.
  const needsSettings = canAccess && categoryMeta.ui_available;
  const dealerSettings = needsSettings
    ? await getCanonicalDealerSettings().catch(() => null)
    : null;

  // Fetch registered settings items for this category from the Sprint 12F registry
  // Pure static call — no DB, no async
  const registrations = getRegistrationsForCategory(categoryMeta.category_id);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6">
        <SettingsCategoryPageView
          category={categoryMeta}
          canAccess={canAccess}
          staffRole={staffInfo?.role ?? null}
          dealerSettings={dealerSettings}
          registrations={registrations}
        />
      </div>
    </MainLayout>
  );
}
