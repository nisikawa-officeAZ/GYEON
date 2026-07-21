// B7-3 — production Estimate CREATE route.
//
// This Server Component is the FIRST and ONLY production importer of both
// `ProductionEstimateWizard` and the authoritative `saveEstimateFromWizardIntentAction`.
// It replaces the legacy `EstimateEditor` create surface: the "+新規見積" button and
// the onboarding handoff (?customer_id=&vehicle_id=) now land on the wizard.
//
// ── ONE TENANT AUTHORITY ────────────────────────────────────────────────────
// The dealer is resolved exactly once, as a branded actor context, and that SAME
// context feeds both the runtime-config resolver and the entity loader. No client
// value supplies the dealer, user, role, config, revision, pricing or totals. Any
// failure at any step mounts nothing save-capable — it redirects or shows a fixed
// unavailable notice, and never leaks an internal reason.

import { redirect } from "next/navigation";

import MainLayout from "@/components/layout/MainLayout";
import ProductionEstimateWizard from "@/components/estimates/wizard/production/ProductionEstimateWizard";
import { saveEstimateFromWizardIntentAction } from "@/components/estimates/wizard/save/save-estimate-from-wizard-intent-action";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { getAuthoritativeWizardRuntimeConfigForDealer } from "@/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer";
import { loadDealerWizardEntityReferences } from "@/lib/estimates/get-dealer-wizard-entity-references";

interface Props {
  searchParams: Promise<{
    customer_id?: string | string[];
    vehicle_id?: string | string[];
  }>;
}

/** A query parameter is trusted only as a scalar string; arrays/absence → undefined. */
const scalar = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * The single, fixed failure surface. It renders no internal reason, code, message,
 * dealer/user id, role or configuration value — an operator sees one calm notice
 * whether the cause was an outage, an ambiguous membership, or a stale catalog.
 */
function Unavailable() {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <div role="alert" data-testid="estimate-create-unavailable" className="max-w-lg mx-auto text-center py-16">
          <h1 className="text-xl font-bold mb-3">見積を開始できません</h1>
          <p className="text-sm leading-7 text-slate-300">
            現在この画面をご利用いただけません。時間をおいて再度お試しいただくか、担当者へご連絡ください。
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

export default async function EstimateNewPage({ searchParams }: Props) {
  const { customer_id, vehicle_id } = await searchParams;

  // 1. Resolve the actor context exactly once.
  const actor = await getEstimateSaveActorContext();
  if (!actor.ok) {
    // 2-3. Only these two map to a navigation; everything else is the fixed notice.
    if (actor.reason === "unauthenticated") redirect("/login");
    if (actor.reason === "no-active-membership") redirect("/no-dealer");
    // 4. membership-read-failed | tenant-context-unavailable | staff-read-failed | permission-denied
    return <Unavailable />;
  }

  // 5. Runtime config for exactly the actor's tenant.
  const runtime = await getAuthoritativeWizardRuntimeConfigForDealer(actor.context);
  // 6. Every runtime failure, including a runtime `no-dealer` (an internal
  //    inconsistency AFTER actor success, not proof of missing membership), shows
  //    the fixed notice rather than redirecting.
  if (!runtime.ok) return <Unavailable />;

  // 7. Dealer-bound entity references for the SAME context.
  const references = await loadDealerWizardEntityReferences(actor.context);
  // 8. Every typed entity failure shows the fixed notice.
  if (!references.ok) return <Unavailable />;

  // 9. Only full success mounts the save-capable wizard.
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <ProductionEstimateWizard
          mode="create"
          shopRank={runtime.shopRank}
          catalog={runtime.catalog}
          screenConfig={runtime.screenConfig}
          pricingConfig={runtime.pricingConfig}
          customers={references.customers}
          vehicles={references.vehicles}
          defaultCustomerId={scalar(customer_id)}
          defaultVehicleId={scalar(vehicle_id)}
          expectedConfigRevision={runtime.lifecycle.currentRevision}
          saveInvoker={saveEstimateFromWizardIntentAction}
        />
      </div>
    </MainLayout>
  );
}
