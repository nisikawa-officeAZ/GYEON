// GYEON Business Hub — Settings Category Page (Sprint 12I)
//
// Dynamic server component for /settings/[category] routes.
//
// Handles all 20 SettingsCategoryId slugs. The existing /settings/ai route
// takes precedence over this dynamic route for the slug "ai" (Next.js
// App Router static-route priority).
//
// Data strategy (Sprint 12I):
//   Base fetches (all active categories): staffInfo, dealerSettings
//   Category-specific conditional fetches (loaded only for the relevant slug):
//     dealer / branding   → getCompanySettings()
//     staff               → getCompanySettings() + getStaffList()
//     communication / subscription → getCurrentPlan()
//     pdf                 → getDocumentSequences()
//   subscription          → SubscriptionStatusCard server component (planSlot)
//
// Security:
//   - Staff role resolved server-side via getCurrentStaff()
//   - dealer_id is always from getCurrentDealer() (inside server actions)
//   - Visibility check applied before any category detail is rendered
//   - Access-denied state reveals no category info (SPOL-004)
//   - Client-side visibility is UX only — server enforcement is Sprint 13+

import { notFound, redirect }             from "next/navigation";
import type { Metadata }                  from "next";
import MainLayout                         from "@/components/layout/MainLayout";
import { getCurrentStaff }               from "@/lib/staff/get-current-staff";
import { getStaffList }                  from "@/lib/staff/get-staff-list";
import { getCompanySettings }            from "@/lib/company/save-company-settings";
import type { CompanySettingsFields }    from "@/lib/company/save-company-settings";
import { getBrandingSettings }           from "@/lib/branding/save-branding-settings";
import type { BrandingSettings }         from "@/lib/branding/branding-types";
import { getDocumentSequences }          from "@/lib/numbering/get-document-sequences";
import type { DocumentSequenceDB }       from "@/lib/numbering/numbering-types";
import { getCurrentPlan }               from "@/lib/plans/get-current-plan";
import type { DealerPlanInfo }           from "@/lib/plans/plan-types";
import type { DealerStaffDB }            from "@/lib/staff/staff-types";
import { getCanonicalDealerSettings }   from "@/lib/dealer-settings/get-canonical-dealer-settings";
import SubscriptionStatusCard            from "@/components/subscription/SubscriptionStatusCard";
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

  // Visibility check (SPOL-001 / SPOL-004) — server-enforced for RC
  const canAccess = canViewSetting(userLevel, categoryMeta.min_visibility);
  if (!canAccess) {
    redirect("/settings");
  }

  // Load dealer settings only when user has access and the category is active.
  const needsSettings = canAccess && categoryMeta.ui_available;
  const dealerSettings = needsSettings
    ? await getCanonicalDealerSettings().catch(() => null)
    : null;

  // ── Category-specific conditional data fetches ────────────────────────────

  const catId = categoryMeta.category_id;

  let companySettings:  CompanySettingsFields | null = null;
  let brandingSettings: BrandingSettings | null      = null;
  let staffList:        DealerStaffDB[]               = [];
  let sequences:        DocumentSequenceDB[]           = [];
  let planInfo:         DealerPlanInfo | null          = null;

  if (needsSettings) {
    if (catId === "dealer") {
      companySettings = await getCompanySettings().catch(() => null);
    }

    if (catId === "branding") {
      brandingSettings = await getBrandingSettings().catch(() => null);
    }

    if (catId === "staff") {
      [companySettings, staffList] = await Promise.all([
        getCompanySettings().catch(() => null),
        getStaffList().catch(() => []),
      ]);
    }

    if (catId === "communication" || catId === "subscription") {
      planInfo = await getCurrentPlan().catch(() => null);
    }

    if (catId === "pdf") {
      sequences = await getDocumentSequences().catch(() => []);
    }
  }

  // SubscriptionStatusCard is a server component — render it server-side and
  // pass as a React node slot to PlanContent (client component).
  const planSlot: React.ReactNode =
    catId === "subscription" ? <SubscriptionStatusCard /> : null;

  // Fetch registered settings items for this category from the Sprint 12F registry
  const registrations = getRegistrationsForCategory(categoryMeta.category_id);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto p-6">
        <SettingsCategoryPageView
          category={categoryMeta}
          canAccess={canAccess}
          staffRole={staffInfo?.role ?? null}
          staffId={staffInfo?.staffId ?? null}
          dealerSettings={dealerSettings}
          registrations={registrations}
          companySettings={companySettings}
          brandingSettings={brandingSettings}
          staffList={staffList}
          sequences={sequences}
          planInfo={planInfo}
          planSlot={planSlot}
        />
      </div>
    </MainLayout>
  );
}
