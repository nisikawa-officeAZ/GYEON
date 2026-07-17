// EW-UI-2A — Read-only projection: canonical EstimateWizardDraftV22 → WizardStore view.
//
// PURE and lossless for every BOUND field. WizardStore is a PROJECTION of the single canonical
// draft — it is never independently stored. `services` stays the existing empty presentation shape
// (Screen-4 service editor is not implemented) and is NEVER derived from canonical
// serviceConfiguration. `vehicle.suggestedSize` stays display-only (null). No pricing/OCR/save.

import type { EstimateWizardDraftV22 } from "../draft/wizard-draft-types";
import { initialWizardStore, type WizardStore } from "../wizard-types";

export function draftToEwUi1Store(draft: EstimateWizardDraftV22): WizardStore {
  const c = draft.customer;
  const nc = c.newCustomer;
  const v = draft.vehicle;
  const nv = v.newVehicle;
  const dc = draft.discountAndCoupon;

  return {
    customer: {
      regMethod:      c.registrationMethod,
      name:           nc.name,
      kana:           nc.kana ?? "",
      email:          nc.email,
      postal:         nc.postal,
      address:        nc.address,
      phone:          nc.phone,
      lineId:         nc.lineId,
      existingId:     c.customerId,
      contractor:     nc.isBusiness,
      contractorRate: nc.tradeRate,
      creditSale:     nc.arAllowed,
      creditClosing:  nc.closingDay,
      paymentDay:     nc.paymentDay,
      creditTerms:    nc.creditTerms ?? "",
    },
    vehicle: {
      maker:             nv.maker,
      model:             nv.model,
      grade:             nv.grade,
      vehicleCode:       nv.vehicle_code,
      displacement:      nv.displacement,
      vin:               nv.vin,
      firstRegYearMonth: nv.first_registration_year_month,
      registrationDate:  nv.registration_date,
      color:             nv.color,
      inspectionExpiry:  nv.inspection_expiry_date,
      plateNumber:       nv.plate_number,
      existingId:        v.vehicleId,
      // "" bodySizeKey projects to null (not-selected); suggestedSize stays display-only.
      confirmedSize:     v.bodySizeKey === "" ? null : v.bodySizeKey,
      suggestedSize:     null,
    },
    categories:      [...draft.serviceSelection.selectedCategories],
    // Screen-4 service editor not implemented → keep the existing empty presentation shape.
    services:        initialWizardStore().services,
    coupons:         [...dc.selectedCouponIds],
    discountMode:    dc.mode,
    discountAmount:  dc.amountInput,
    discountPercent: dc.percentInput,
    notesCustomer:   draft.notes.customerNotes,
    notesInternal:   draft.notes.internalMemo,
  };
}
