// EW-UI-2A — Read-only projection: canonical EstimateWizardDraftV22 → WizardStore view.
//
// PURE and lossless for every BOUND field. WizardStore is a PROJECTION of the single canonical
// draft — it is never independently stored. `services` is a lossless, DEEP-COPIED projection of the
// canonical serviceConfiguration (detached — mutating it can never mutate the draft).
// `vehicle.suggestedSize` stays display-only (null). No pricing/OCR/save.

import type { EstimateWizardDraftV22, WizardServiceConfigurationDraft } from "../draft/wizard-draft-types";
import type { WizardStore } from "../wizard-types";

/**
 * Deep-copy the canonical service configuration so the projected view is DETACHED from the draft:
 * every array, record, and row object is copied. Mutating the projection can never mutate the draft.
 * No calculation, no coercion, no default invention, no JSON serialization, no generated IDs.
 */
function cloneServiceConfiguration(sc: WizardServiceConfigurationDraft): WizardServiceConfigurationDraft {
  return {
    coating: { ...sc.coating },
    ppf: {
      ...sc.ppf,
      selectedPartIds: [...sc.ppf.selectedPartIds],
      quantitiesByPart: { ...sc.ppf.quantitiesByPart },
      interiorRows: sc.ppf.interiorRows.map((r) => ({ ...r })),
    },
    windowFilm: { ...sc.windowFilm, selectedAreaIds: [...sc.windowFilm.selectedAreaIds] },
    bodyMaintenance: { ...sc.bodyMaintenance },
    carWash: { ...sc.carWash },
    roomCleaning: { ...sc.roomCleaning, selectedMenuIds: [...sc.roomCleaning.selectedMenuIds], unitPricesByMenu: { ...sc.roomCleaning.unitPricesByMenu } },
    otherWork: {
      ...sc.otherWork,
      selectedPresetIds: [...sc.otherWork.selectedPresetIds],
      unitPricesByItem: { ...sc.otherWork.unitPricesByItem },
      quantitiesByItem: { ...sc.otherWork.quantitiesByItem },
      customRows: sc.otherWork.customRows.map((r) => ({ ...r })),
    },
    storeGlobalOptions: {
      ...sc.storeGlobalOptions,
      selectedOptionIds: [...sc.storeGlobalOptions.selectedOptionIds],
      unitPricesByOption: { ...sc.storeGlobalOptions.unitPricesByOption },
      quantitiesByOption: { ...sc.storeGlobalOptions.quantitiesByOption },
    },
  };
}

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
    // EW-UI-2B: lossless, detached projection of the canonical Screen-4 configuration.
    services:        cloneServiceConfiguration(draft.serviceConfiguration),
    coupons:         [...dc.selectedCouponIds],
    discountMode:    dc.mode,
    discountAmount:  dc.amountInput,
    discountPercent: dc.percentInput,
    notesCustomer:   draft.notes.customerNotes,
    notesInternal:   draft.notes.internalMemo,
  };
}
