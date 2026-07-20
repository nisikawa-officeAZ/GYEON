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

// ── B7-2A: existing customer / vehicle references ───────────────────────────
//
// ── WHY THESE ARE NOT PART OF WizardRuntimeInputs ───────────────────────────
// `Step4EstimateProps extends WizardRuntimeInputs`. Widening that interface would
// thread customer and vehicle references into Screen 4, which needs neither, and
// would contradict the Step-4 contract that permits exactly `shopRank` and
// `screenConfig`. These live in their own interface so the two contracts stay
// separate and Step 4 remains untouched.
//
// ── WHY THE SHAPE IS MINIMAL ────────────────────────────────────────────────
// These cross the server→client boundary. `CustomerDB`/`VehicleDB` carry dealer
// ids, notes, birthdays, LINE identifiers and timestamps — none of which a
// selection list needs, and all of which would be shipped to the browser and
// serialized into the RSC payload. Each field below earns its place: an id to
// select by, a server-composed label to show, and the minimum needed to
// disambiguate and to validate ownership.

/**
 * One selectable existing customer.
 *
 * `phone` is present only to disambiguate identical names at selection time. It
 * is DISPLAY DATA: selecting an existing customer records the id, never a copy of
 * these fields into the new-customer persistence snapshot.
 */
export interface WizardExistingCustomerReference {
  readonly id: string;
  /** Composed server-side. Never re-derived from name parts in the browser. */
  readonly displayName: string;
  readonly phone: string | null;
}

/**
 * One selectable existing vehicle.
 *
 * `customerId` is REQUIRED and is the ownership-validation authority: a vehicle may
 * only be selected under the customer that owns it.
 *
 * `bodySize` is DISPLAY / ORIENTATION ONLY. The operator-selected draft
 * `confirmedSize` (→ `bodySizeKey`) remains the sole persistence authority, so
 * this value must never auto-fix a body size — the 3M recommendation rule that
 * governs Screen 2 applies here too.
 */
export interface WizardExistingVehicleReference {
  readonly id: string;
  readonly customerId: string;
  readonly displayName: string;
  readonly plateNumber: string | null;
  readonly bodySize: string | null;
}

/**
 * The existing-entity host inputs. REQUIRED, like every other trusted input in
 * this module: no optional array and no `[]` fallback. A caller that cannot supply
 * the dealer-scoped lists cannot mount the host, which is deliberate — an empty
 * fallback would silently present "no existing customers" as a fact rather than as
 * a wiring failure, and the operator would create a duplicate record.
 */
export interface WizardExistingEntityInputs {
  readonly customers: readonly WizardExistingCustomerReference[];
  readonly vehicles:  readonly WizardExistingVehicleReference[];
}

/**
 * UNTRUSTED preselection, carried from the route's `?customer_id=` / `?vehicle_id=`
 * onboarding handoff.
 *
 * Optional because absence is a normal state (a bare `/estimates/new`), and typed
 * `string` because that is all a query parameter can promise. Neither value is ever
 * used to look anything up: resolution is exact membership in the arrays above, so
 * an id for another tenant is indistinguishable from an id that does not exist.
 */
export interface WizardPreselectionInputs {
  readonly defaultCustomerId?: string;
  readonly defaultVehicleId?:  string;
}
