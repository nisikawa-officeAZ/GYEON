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

import type { ServiceOfferings } from "@/lib/estimates/service-categories";
import type { WindowFilmSettingsV1 } from "@/lib/pricing/window-film-v1-contract";
import type {
  ShopRank,
  FilmTypeOption,
  WindowFilmConfiguredItem,
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
  /**
   * B2-E2G — the dealer's EXPLICIT opt-in for each of the five managed service families
   * (`dealer_service_offerings`). Rank decides none of them; this map alone does, and every family
   * defaults OFF.
   *
   * REQUIRED and TOTAL. Required because an optional map defaulting to all-OFF would make a wiring
   * failure indistinguishable from a dealer who deliberately opted out, failing silently toward
   * "service hidden" where nobody would notice. Total because a partial map would reintroduce the
   * same ambiguity one key at a time: an absent family must never be readable as OFF at a boundary.
   *
   * `coating` and `other` are absent by design — they are outside the offering model.
   */
  serviceOfferings:   ServiceOfferings;
  filmTypes:          FilmTypeOption[];
  windowAreas:        WindowAreaOption[];
  windowFilmPackages?: WindowFilmConfiguredItem[];
  windowFilmOptions?: WindowFilmConfiguredItem[];
  windowFilmSettings?: WindowFilmSettingsV1 | null;
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
 * B2.2B — the authenticated customer-search seam.
 *
 * Declared here as a TYPE so a `"use client"` module can call the search without importing the
 * Server Action. The action is imported once, by the server route, and injected as a prop — the
 * same discipline the save invoker follows. That keeps every server entry point visible at the
 * page rather than scattered through the client tree.
 *
 * The invoker takes ONE argument: the operator's term. There is deliberately no dealer parameter,
 * so a client cannot express a cross-tenant search at all; the dealer is resolved server-side from
 * the authenticated actor context.
 */
export type WizardCustomerSearchFailureCode =
  | "UNAUTHENTICATED"
  | "DEALER_CONTEXT_REQUIRED"
  | "QUERY_TOO_SHORT"
  | "SEARCH_FAILED";

export type WizardCustomerSearchResult =
  | {
      readonly ok: true;
      readonly results: readonly WizardExistingCustomerReference[];
      /** True when more customers matched than the server will return. */
      readonly truncated: boolean;
    }
  | { readonly ok: false; readonly code: WizardCustomerSearchFailureCode };

export type WizardCustomerSearchInvoker = (rawTerm: unknown) => Promise<WizardCustomerSearchResult>;

/**
 * OPTIONAL by design. A non-production mount (tests, previews) renders Screen 1 without a search
 * seam and simply shows no search surface. There is no fabricated fallback: absent means the
 * operator cannot search, never that "there are no customers".
 */
export interface WizardCustomerSearchInputs {
  readonly customerSearchInvoker?: WizardCustomerSearchInvoker;
}

/**
 * B2-D — the Screen 1 duplicate WARNING seam.
 *
 * Declared here as a TYPE for the same reason as the search invoker: a `"use client"` module calls it
 * without importing the Server Action, which is injected once by the server route. There is again no
 * dealer parameter, so a client cannot express a cross-tenant check.
 *
 * ── ADVISORY, NEVER BLOCKING ────────────────────────────────────────────────────
 * Nothing in this contract can prevent navigation, saving, or customer creation. A failure code is
 * something the operator is TOLD, never something that gates them — which is why there is no
 * "blocked" state and no required acknowledgement anywhere in these types.
 */
/**
 * Why a candidate matched, in descending strength. The order is meaningful: it is the precedence
 * classification applies when more than one rule holds for the same row.
 *
 *   "phone"      — normalized 10–11 digit phone equality. The strongest signal available.
 *   "name_kana"  — normalized full name AND normalized kana both equal.
 *   "name"       — normalized full NAME equality alone, kana absent or different.
 *
 * `"name"` is deliberately full-name equality, never a surname, a partial, a prefix or a suffix —
 * the normalized key is the whole entered name, so nothing shorter can match it. It exists because
 * a 車検証 carries no telephone number and prints furigana only when the registration happens to
 * include it, so OCR intake would otherwise produce no advisory at all. Manual and OCR entry share
 * this rule; neither has a bypass.
 */
export type WizardDuplicateReason = "phone" | "name_kana" | "name";

/**
 * A candidate carries the same minimal projection as any existing-customer reference — id,
 * displayName, phone — plus the reason it matched. Address, email, notes and every other field stay
 * on the server: a duplicate warning is a prompt to recognise a customer, not a reason to widen the
 * PII that reaches the browser.
 */
export type WizardDuplicateCandidate = WizardExistingCustomerReference & {
  readonly reason: WizardDuplicateReason;
};

/**
 * NOT_APPLICABLE is deliberately distinct from `ok: true` with no candidates. The first means the
 * rule cannot fire on this input; the second means the dealer's customers were checked and none
 * matched. Collapsing them would show the operator a reassuring "no duplicates" they never earned.
 */
export type WizardDuplicateCheckFailureCode =
  | "UNAUTHENTICATED"
  | "DEALER_CONTEXT_REQUIRED"
  | "NOT_APPLICABLE"
  | "LOOKUP_FAILED";

export type WizardDuplicateCheckResult =
  | {
      readonly ok: true;
      readonly candidates: readonly WizardDuplicateCandidate[];
      /** True when more customers matched than the server will return. Observed, never guessed. */
      readonly truncated: boolean;
    }
  | { readonly ok: false; readonly code: WizardDuplicateCheckFailureCode };

export type WizardDuplicateCheckInvoker = (raw: {
  name?: unknown;
  kana?: unknown;
  phone?: unknown;
}) => Promise<WizardDuplicateCheckResult>;

/**
 * OPTIONAL by design, exactly like the search seam. A mount without it shows no advisory panel —
 * absent means "this surface cannot check", never "there are no duplicates".
 */
export interface WizardDuplicateCheckInputs {
  readonly duplicateCheckInvoker?: WizardDuplicateCheckInvoker;
}

// ── GDA-1R2-C3R: reservation → estimate server-authorized prefill ───────────

/**
 * The top-level service family a reservation may prefill on Screen 3. `null` means
 * the reservation names no recognizable family — never a default choice.
 */
export type WizardReservationPrefillCategory =
  | "coating"
  | "maintenance"
  | "ppf"
  | "window"
  | "other"
  | null;

/**
 * GDA-1R2-C3R — the SERVER-AUTHORIZED reservation prefill payload, composed
 * server-side from a dealer-scoped reservation lookup and injected as a prop by
 * the server route. Only the server can construct it; it never comes from a query
 * parameter, cookie, or any client-writable channel.
 *
 * It carries NO authority beyond its four prefill values: no dealer identity, no
 * role, no reservation status, no detailed service selection, no screen/pricing
 * configuration, and no customer-facing notes. `notesInternal` is operator-internal
 * text only.
 *
 * Every field is nullable: a reservation may name a customer without a vehicle, a
 * family without notes, and so on. `null` means "nothing to prefill", never a
 * fallback value.
 */
export interface WizardReservationPrefill {
  readonly customerId: string | null;
  readonly vehicleId: string | null;
  readonly category: WizardReservationPrefillCategory;
  readonly notesInternal: string | null;
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
  /**
   * GDA-1R2-C3R — OPTIONAL server-authorized reservation prefill. Unlike the two
   * untrusted query-parameter ids above — which are unchanged by this seam — this
   * object is trusted because only the server route can construct and inject it.
   * See `WizardReservationPrefill` for the authority boundary. Absent means "no
   * reservation to prefill from", never a fallback.
   */
  readonly serverPrefill?: WizardReservationPrefill;
}
