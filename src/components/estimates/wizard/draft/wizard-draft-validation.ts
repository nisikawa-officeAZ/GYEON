// Estimate Wizard Ver2.2 — Canonical draft: non-blocking structural completeness metadata.
//
// Deterministic, presentation-only. This is NOT production validation, NOT save eligibility, and
// NOT billing eligibility — it never blocks navigation. It only reports structural gaps so future
// phases can surface hints. No calculation, no I/O.

import type { EstimateWizardDraftV22, WizardValidationIssue, WizardValidationState } from "./wizard-draft-types";

export function computeWizardValidation(d: EstimateWizardDraftV22): WizardValidationState {
  const issues: WizardValidationIssue[] = [];

  // Customer presence (existing selected OR a new name entered).
  const hasCustomer =
    (d.customer.sourceMode === "existing" && !!d.customer.customerId) ||
    (d.customer.sourceMode === "new" && d.customer.newCustomer.name.trim().length > 0);
  if (!hasCustomer) {
    issues.push({ field: "customer", code: "customer_missing", message: "お客様が未選択です。", severity: "warning" });
  }

  // Vehicle presence (existing selected OR a maker/model entered).
  const hasVehicle =
    (d.vehicle.sourceMode === "existing" && !!d.vehicle.vehicleId) ||
    (d.vehicle.sourceMode === "new" && (d.vehicle.newVehicle.maker.trim().length > 0 || d.vehicle.newVehicle.model.trim().length > 0));
  if (!hasVehicle) {
    issues.push({ field: "vehicle", code: "vehicle_missing", message: "車両が未選択です。", severity: "warning" });
  }

  // Service presence.
  if (d.serviceSelection.selectedCategories.length === 0) {
    issues.push({ field: "serviceSelection", code: "service_missing", message: "施工内容が未選択です。", severity: "warning" });
  }

  // Business-customer structural gaps (no calculation — presence checks only).
  const biz = d.customer.newCustomer;
  if (biz.isBusiness && biz.closingDay.trim() === "") {
    issues.push({ field: "customer.closingDay", code: "closing_day_missing", message: "業者設定中ですが締め日が未入力です。", severity: "info" });
  }
  if (biz.isBusiness && biz.arAllowed && biz.paymentDay.trim() === "") {
    issues.push({ field: "customer.paymentDay", code: "payment_due_missing", message: "掛売り設定中ですが支払日が未入力です。", severity: "info" });
  }

  const isCompleteForPreview = hasCustomer && hasVehicle && d.serviceSelection.selectedCategories.length > 0;
  return { issues, isCompleteForPreview };
}
