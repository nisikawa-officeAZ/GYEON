import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import MainLayout from "@/components/layout/MainLayout";
import ProductionEstimateWizard from "@/components/estimates/wizard/production/ProductionEstimateWizard";
import { issueEstimateRevisionAction } from "@/components/estimates/wizard/save/issue-estimate-revision-action";
import { getEstimateSaveActorContext } from "@/lib/auth/resolve-estimate-save-actor-context";
import { getAuthoritativeWizardRuntimeConfigForDealer } from "@/lib/wizard-catalog/get-authoritative-wizard-runtime-config-for-dealer";
import { loadDealerWizardEntityReferences } from "@/lib/estimates/get-dealer-wizard-entity-references";
import { getEstimateRevisionSource } from "@/lib/estimates/get-estimate-revision-source";
import { getEstimate } from "@/lib/estimates/get-estimate";
import { searchDealerCustomersAction } from "@/lib/customers/search-dealer-customers-action";
import { findWizardCustomerDuplicatesAction } from "@/lib/customers/find-wizard-customer-duplicates-action";
import { createInvoiceFromEstimate } from "@/lib/invoices/create-invoice";
import { getInvoice } from "@/lib/invoices/get-invoice";
import { saveInvoiceDeliveryDate } from "@/lib/invoices/save-invoice-delivery-date";
import { issueInvoice, getIssuedInvoicePdfUrl } from "@/lib/invoices/issue-invoice";

interface Props { params: Promise<{ id: string }> }

function Unavailable() {
  return (
    <MainLayout>
      <div className="max-w-lg mx-auto px-4 py-16 text-center" role="alert">
        <h1 className="text-xl font-bold text-slate-100">新版を開始できません</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">現在この画面をご利用いただけません。担当者へご連絡ください。</p>
      </div>
    </MainLayout>
  );
}

export default async function EstimateEditPage({ params }: Props) {
  const { id } = await params;
  const actor = await getEstimateSaveActorContext();
  if (!actor.ok) {
    if (actor.reason === "unauthenticated") redirect("/login");
    if (actor.reason === "no-active-membership") redirect("/no-dealer");
    return <Unavailable />;
  }

  const [runtime, references, source] = await Promise.all([
    getAuthoritativeWizardRuntimeConfigForDealer(actor.context),
    loadDealerWizardEntityReferences(actor.context),
    getEstimateRevisionSource(id, actor.context),
  ]);

  if (source !== null) {
    if (!runtime.ok || !references.ok) return <Unavailable />;
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
          <ProductionEstimateWizard
            mode="edit"
            initialDraft={source.draft}
            revisionSource={{
              predecessorEstimateId: source.predecessorEstimateId,
              sourceSnapshotFingerprint: source.sourceSnapshotFingerprint,
            }}
            revisionSaveInvoker={issueEstimateRevisionAction}
            shopRank={runtime.shopRank}
            catalog={runtime.catalog}
            screenConfig={runtime.screenConfig}
            pricingConfig={runtime.pricingConfig}
            customers={references.customers}
            vehicles={references.vehicles}
            expectedConfigRevision={runtime.lifecycle.currentRevision}
            saveInvoker={issueEstimateRevisionAction}
            customerSearchInvoker={searchDealerCustomersAction}
            duplicateCheckInvoker={findWizardCustomerDuplicatesAction}
            invoiceActions={{ create: createInvoiceFromEstimate, read: getInvoice,
              saveDate: saveInvoiceDeliveryDate, issue: issueInvoice, download: getIssuedInvoicePdfUrl }}
          />
        </div>
      </MainLayout>
    );
  }

  // Legacy estimates predate immutable canonical snapshots. Their line items are
  // lossy and are never guessed back into a v2.2 draft.
  const estimate = await getEstimate(id);
  if (!estimate) notFound();
  const query = new URLSearchParams({ customer_id: estimate.customer_id, vehicle_id: estimate.vehicle_id });

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-16">
        <section role="alert" data-testid="canonical-estimate-edit-boundary" className="rounded-2xl border border-amber-400/30 bg-[#111827] p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-100">この見積には正本データがありません</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            旧見積から内容を推測して復元すると誤った商品や金額が混ざるため、新版発行を停止しました。
            顧客・車両だけを引き継ぎ、正規ウィザードで新しい見積を作成できます。
          </p>
          <p className="mt-2 text-xs leading-6 text-amber-200/80">元の見積は変更されません。</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={`/estimates/new?${query.toString()}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
              正規ウィザードで新規作成
            </Link>
            <Link href={`/estimates/${encodeURIComponent(estimate.id)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800">
              元の見積詳細へ戻る
            </Link>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
