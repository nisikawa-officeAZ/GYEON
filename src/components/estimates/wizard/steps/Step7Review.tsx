"use client";

// Step 7 — 確認. Shows the estimate summary + action buttons: 修正 / キャンセル / 保存 /
// PDF / LINE(送信 or 文章コピー) / 予約カレンダー / 請求書 / 納品書 / 納品請求書.
// Cancel = no auto-save; all other actions auto-save then navigate to their module.
// Real save/PDF/LINE and module navigation wire in Phase 2 (existing logic, unchanged).

import type { EstimateWizardApi } from "../useEstimateWizard";
import type {
  WizardExistingCustomerReference,
  WizardExistingVehicleReference,
} from "../contract/wizard-runtime-inputs";
import { effectiveExistingCustomer, effectiveExistingVehicle } from "./existing-entity-selection";
import { serviceCategoryLabel } from "@/lib/estimates/service-categories";
import type { WizardSaveBinding } from "../save/WizardSavePanel";
import { WizardSavePanel } from "../save/WizardSavePanel";
import { Card, SectionTitle, PhaseTwoNotice } from "../ui";

// B7-2C: the save binding is OPTIONAL here on purpose. Only the production wrapper
// supplies one; bare EstimateWizard mounts (every non-production test) keep the
// existing presentation seam and need no session, storage or crypto. This step
// creates no session or key, reads no browser storage, and performs no pricing,
// mapping, validation, DB or navigation work — it renders what it is handed.

// GDA-ESTIMATE-REVIEW-DISPLAY-R1: an existing selection stores ONLY an id, never a
// label, so this step receives the SAME server-supplied reference arrays the
// selection steps use and resolves the label at render time through the same pure
// authorities (effectiveExistingCustomer / effectiveExistingVehicle). The resolved
// server-composed displayName is DISPLAY ONLY — it is never written into the
// canonical draft, so persistence stays byte-identical. A claimed reference that
// fails to resolve (missing, stale, duplicate/ambiguous, or owned by another
// customer) fails closed to the em dash rather than guessing a label; new-entity
// entries keep their draft-field display.

export function Step7Review({
  api, customers, vehicles, saveBinding,
}: {
  api: EstimateWizardApi;
  customers: readonly WizardExistingCustomerReference[];
  vehicles: readonly WizardExistingVehicleReference[];
  saveBinding?: WizardSaveBinding;
}) {
  const s = api.store;

  const existingCustomer = effectiveExistingCustomer(customers, s.customer.regMethod, s.customer.existingId);
  const customerLabel = existingCustomer !== null
    ? existingCustomer.displayName
    // In existing/search mode an unresolved id must not fall back to the
    // new-customer draft field — that field describes a record to CREATE.
    : s.customer.regMethod === "search" ? "—" : (s.customer.name || "—");

  const existingVehicle = effectiveExistingVehicle(vehicles, existingCustomer?.id ?? null, s.vehicle.existingId);
  // A non-empty existingId is a CLAIMED reference: if it did not resolve under the
  // effective customer, showing the new-vehicle draft fields would mislabel it.
  const vehicleReferenceClaimed = typeof s.vehicle.existingId === "string" && s.vehicle.existingId !== "";
  const vehicleLabel = existingVehicle !== null
    ? existingVehicle.displayName
    : vehicleReferenceClaimed ? "—" : ([s.vehicle.maker, s.vehicle.model].filter(Boolean).join(" ") || "—");

  return (
    <>
      <Card>
        <SectionTitle>確認</SectionTitle>
        <dl className="text-xs text-slate-300 space-y-1">
          <div className="flex justify-between"><dt className="text-slate-500">顧客</dt><dd>{customerLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">車両</dt><dd>{vehicleLabel}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">作業</dt><dd>{s.categories.map(serviceCategoryLabel).join(" / ") || "—"}</dd></div>
        </dl>
      </Card>
      {saveBinding
        ? <WizardSavePanel draft={api.draft} binding={saveBinding} />
        : <PhaseTwoNotice screen="保存 / PDF / LINE(送信・文章コピー) / 予約カレンダー / 請求書・納品書・納品請求書" />}
    </>
  );
}
