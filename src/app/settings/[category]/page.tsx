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
import {
  readOk,
  readFailed,
  readValueOr,
  type SettingsRead,
  type SettingsStatusCode,
} from "@/lib/settings/settings-status-codes";
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
import type { CanonicalDealerSettings } from "@/lib/dealer-settings/dealer-settings-types";
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
  //
  // UX-2B — a THROW here means the role could not be determined, which is not the
  // same fact as “this user has no permission”. The visibility gate keeps its
  // existing fail-closed behaviour (an unresolved role sees nothing), but the
  // distinction is now carried to the view so the header can say
  // 保存状態を確認できません（SET-1003） instead of silently claiming 保存可能.
  let permissionCheckFailed = false;
  const staffInfo = await getCurrentStaff().catch(() => {
    permissionCheckFailed = true;
    return null;
  });
  const userLevel  = resolveVisibilityFromRole(staffInfo?.role ?? null);

  // Visibility check (SPOL-001 / SPOL-004) — server-enforced for RC
  const canAccess = canViewSetting(userLevel, categoryMeta.min_visibility);
  if (!canAccess) {
    redirect("/settings");
  }

  // ── Reads ────────────────────────────────────────────────────────────────
  //
  // UX-2B — every read used to collapse to `null` / `[]` on failure, which made a
  // failed read indistinguishable from “this dealer simply has no row yet”. The
  // screen then printed a healthy status over a page whose data never arrived.
  //
  // Each read is now captured as a typed result. The plain values are still handed
  // to the existing forms exactly as before (nothing downstream changes), and the
  // failure fact travels separately so the header can report SET-1001 honestly.
  const needsSettings = canAccess && categoryMeta.ui_available;

  const read = async <T,>(load: () => Promise<T>): Promise<SettingsRead<T>> => {
    try {
      return readOk(await load());
    } catch (err) {
      // The cause stays server-side; the dealer only ever sees the code.
      console.error("[SettingsCategoryPage] read failed:", err);
      return readFailed<T>("SET-1001");
    }
  };

  const dealerSettingsRead: SettingsRead<CanonicalDealerSettings | null> = needsSettings
    ? await read(() => getCanonicalDealerSettings())
    : readOk(null);

  // ── Category-specific conditional data fetches ────────────────────────────

  const catId = categoryMeta.category_id;

  let companySettingsRead:  SettingsRead<CompanySettingsFields | null> = readOk(null);
  let brandingSettingsRead: SettingsRead<BrandingSettings | null>      = readOk(null);
  let staffListRead:        SettingsRead<DealerStaffDB[]>              = readOk([]);
  let sequencesRead:        SettingsRead<DocumentSequenceDB[]>         = readOk([]);
  let planInfoRead:         SettingsRead<DealerPlanInfo | null>        = readOk(null);

  if (needsSettings) {
    if (catId === "dealer") {
      companySettingsRead = await read(() => getCompanySettings());
    }

    if (catId === "branding") {
      brandingSettingsRead = await read(() => getBrandingSettings());
    }

    if (catId === "staff") {
      [companySettingsRead, staffListRead] = await Promise.all([
        read(() => getCompanySettings()),
        read(() => getStaffList()),
      ]);
    }

    if (catId === "communication" || catId === "subscription") {
      planInfoRead = await read(() => getCurrentPlan());
    }

    if (catId === "pdf") {
      sequencesRead = await read(() => getDocumentSequences());
    }
  }

  // Unwrapped values for the existing panels — identical shape to before UX-2B.
  const dealerSettings   = readValueOr(dealerSettingsRead, null);
  const companySettings  = readValueOr(companySettingsRead, null);
  const brandingSettings = readValueOr(brandingSettingsRead, null);
  const staffList        = readValueOr(staffListRead, []);
  const sequences        = readValueOr(sequencesRead, []);
  const planInfo         = readValueOr(planInfoRead, null);

  // One failure anywhere in this page's reads is enough to stop claiming health.
  const readFailure: SettingsStatusCode | null =
    [dealerSettingsRead, companySettingsRead, brandingSettingsRead, staffListRead, sequencesRead, planInfoRead]
      .find((r) => !r.ok) !== undefined
      ? "SET-1001"
      : null;

  // SubscriptionStatusCard is a server component — render it server-side and
  // pass as a React node slot to PlanContent (client component).
  const planSlot: React.ReactNode =
    catId === "subscription" ? <SubscriptionStatusCard /> : null;

  // Fetch registered settings items for this category from the Sprint 12F registry
  const registrations = getRegistrationsForCategory(categoryMeta.category_id);

  return (
    <MainLayout>
      <div className={catId === "dealer" || catId === "staff" ? "mx-auto w-full max-w-[1100px]" : "max-w-3xl mx-auto p-6"}>
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
          readFailure={readFailure}
          permissionCheckFailed={permissionCheckFailed}
        />
      </div>
    </MainLayout>
  );
}
