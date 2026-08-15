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
import Link from "next/link";

import MainLayout from "@/components/layout/MainLayout";
import ProductionEstimateWizard from "@/components/estimates/wizard/production/ProductionEstimateWizard";
import { saveEstimateFromWizardIntentAction } from "@/components/estimates/wizard/save/save-estimate-from-wizard-intent-action";
// B2.2B — the customer-search action is imported HERE, by the server route, and injected as a
// prop. The client tree imports no Server Action, so every server entry point remains visible
// at this one file.
import { searchDealerCustomersAction } from "@/lib/customers/search-dealer-customers-action";
// B2-D: the duplicate-warning action, like the search action, is imported ONCE here and injected as
// a prop, so every server entry point stays visible at the route rather than scattered in the tree.
import { findWizardCustomerDuplicatesAction } from "@/lib/customers/find-wizard-customer-duplicates-action";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { getAuthoritativeWizardRuntimeConfigForDealer } from "@/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer";
import { loadDealerWizardEntityReferences } from "@/lib/estimates/get-dealer-wizard-entity-references";
// GDA-1R2-C3R — the reservation prefill loader is a server-only read that carries its own
// capability check and dealer scoping, and fails closed to null for every invalid case.
import { getReservationPrefill } from "@/lib/reservations/get-reservation-prefill";

interface Props {
  searchParams: Promise<{
    customer_id?: string | string[];
    vehicle_id?: string | string[];
    reservation_id?: string | string[];
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

/**
 * B2-E2B — the ACTIONABLE counterpart to `Unavailable`, shown only for the two runtime failures the
 * dealer can resolve themselves: the catalog review has never been confirmed (`review-required`), or
 * a settings change invalidated it and it must be confirmed again (`revision-mismatch`).
 *
 * Separating these from the generic notice is deliberate. Both describe the dealer's OWN
 * configuration state, already visible to them on their own settings screen, so naming the required
 * step discloses nothing — whereas the previous uniform notice advised waiting, which could never
 * resolve either state no matter how long the operator waited.
 *
 * Like `Unavailable`, this takes no props and renders no reason code, dealer/user id, role or
 * configuration value: the two reasons share ONE message, so the surface cannot distinguish them.
 * The review itself is never auto-confirmed here or anywhere else — this only routes the human to it.
 */
function SetupRequired() {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
        <div role="alert" data-testid="estimate-create-setup-required" className="max-w-lg mx-auto text-center py-16">
          <h1 className="text-xl font-bold mb-3">見積を開始できません</h1>
          <p className="text-sm leading-7 text-slate-300">
            見積を開始する前に、見積設定の確認を完了してください。
          </p>
          <Link
            href="/settings/estimate-wizard"
            className="inline-block mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            見積ウィザード設定を開く
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}

export default async function EstimateNewPage({ searchParams }: Props) {
  const { customer_id, vehicle_id, reservation_id } = await searchParams;

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
  //    a fixed notice rather than redirecting. The two OWNER-RESOLVABLE review states
  //    get the actionable setup notice; every other reason keeps the generic one.
  if (!runtime.ok) {
    if (runtime.reason === "review-required" || runtime.reason === "revision-mismatch") {
      return <SetupRequired />;
    }
    return <Unavailable />;
  }

  // 7. Dealer-bound entity references for the SAME context.
  const references = await loadDealerWizardEntityReferences(actor.context);
  // 8. Every typed entity failure shows the fixed notice.
  if (!references.ok) return <Unavailable />;

  // GDA-1R2-C3R — resolved ONLY after actor, runtime and references all succeeded, and
  // ONLY when a scalar reservation_id arrived. The loader fails closed to null for every
  // invalid, inaccessible, wrong-tenant, wrong-status or unrecognized-service reservation,
  // so a bad id degrades silently to the ordinary wizard with no reason leaked.
  const reservationId = scalar(reservation_id);
  const serverPrefill =
    reservationId !== undefined ? await getReservationPrefill(reservationId) : null;

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
          serverPrefill={serverPrefill ?? undefined}
          expectedConfigRevision={runtime.lifecycle.currentRevision}
          saveInvoker={saveEstimateFromWizardIntentAction}
          customerSearchInvoker={searchDealerCustomersAction}
          duplicateCheckInvoker={findWizardCustomerDuplicatesAction}
        />
      </div>
    </MainLayout>
  );
}
