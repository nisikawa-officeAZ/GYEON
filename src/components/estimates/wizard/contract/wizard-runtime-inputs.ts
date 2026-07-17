// EW-UI-3B — Shared runtime-input contract for the canonical Estimate Wizard host.
//
// ONE definition of the trusted, caller-supplied runtime inputs (shopRank + screenConfig), consumed
// by BOTH the read-only production reference (production/EstimateWizardContainer.tsx) AND the future
// canonical EW-UI host (EstimateWizard.tsx / useEstimateWizard.ts). Relocated here from the
// container WITHOUT any shape change so the two hosts can never drift.
//
// Trusted inputs only: there is NO default, NO fixture fallback, and this module imports NO
// example/preview/default data (no ScreensPreview, no EXAMPLE_*/DEFAULT_*/PREVIEW_*, and it does NOT
// import the production container). Field types come straight from the approved selector prop types
// in screens/step-types.ts, so no shape is re-declared or duplicated here.

import type {
  ShopRank,
  FilmTypeOption,
  WindowAreaOption,
  MaintenanceMenu,
  WashMenu,
  RoomMenu,
  OtherWorkPresetItem,
  StoreGlobalOption,
  CouponOption,
  InstallationMethodOption,
  PpfPartOption,
  PpfTypeGroup,
} from "../screens/step-types";

/**
 * Every operator-visible collection on Screens 4–5, supplied by the caller.
 *
 * Each field's type is the SELECTOR'S OWN prop type (from screens/step-types.ts), so it cannot drift
 * from what the approved screens actually accept, and no shape is re-declared here.
 *
 * There is no default and no fallback. Not `EXAMPLE_*`, not `[]`. A caller that cannot supply a
 * dealer-configured list cannot mount the host — which is the point: silently substituting fixture
 * menus would put invented service names in front of an operator and, because manual line labels
 * become `item_name`, onto persisted estimates.
 */
export interface WizardScreenConfiguration {
  filmTypes:          FilmTypeOption[];
  windowAreas:        WindowAreaOption[];
  maintenanceMenus:   MaintenanceMenu[];
  washMenus:          WashMenu[];
  roomMenus:          RoomMenu[];
  otherWorkPresets:   OtherWorkPresetItem[];
  storeGlobalOptions: StoreGlobalOption[];
  coupons:            CouponOption[];
  ppfMethods:         InstallationMethodOption[];
  ppfParts:           PpfPartOption[];
  ppfTypeGroups:      PpfTypeGroup[];
}

/**
 * The trusted runtime inputs a future EstimateWizard host receives as props. These are NEVER business
 * state: they must not live in WizardStore, EstimateWizardDraftV22, or the hook's mutable state — the
 * hook stays business-state-only. There is no default and no fixture fallback for either field.
 */
export interface WizardRuntimeInputs {
  /** AUTHORITATIVE dealer rank (server/session-derived). No default; no fixture fallback. */
  shopRank:     ShopRank;
  /** Dealer-configured master data for Screens 4–5. No default; no fixture fallback. */
  screenConfig: WizardScreenConfiguration;
}
