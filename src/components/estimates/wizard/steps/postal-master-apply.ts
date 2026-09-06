// GDA-2A-OCR-POSTAL-MASTER-R2 — pure Wizard-side planner for the postal-master lookup seams.
//
// This module contains NO Server Action import, NO Supabase client, and NO fetch. It only decides
// WHEN a lookup should fire and WHETHER an already-returned response may be applied to the draft.
// Every rule here mirrors the frozen directive contract: only `FOUND` may fill a BLANK target, and
// an async response may apply only if the normalized source input still equals the request's
// source snapshot AND the target remains blank at response time — a stale or superseded response
// can never overwrite a value the operator has since typed or that another response already filled.

import {
  normalizeJpPostalCode,
  normalizeJpAddressInput,
  buildJpPostalAddressKey,
  type JpPostalForwardLookupResult,
  type JpPostalReverseLookupResult,
} from "@/lib/geo/jp-postal-master-contract";

// ── Trigger conditions ───────────────────────────────────────────────────────

/** Fire postal→address only once the postal input is a complete valid 7-digit code and the
 * address target is still blank. Re-evaluated on every keystroke by the caller; this function is
 * the single source of truth for "is it time to look up". */
export function shouldTriggerPostalToAddress(postalInput: string, addressTarget: string): boolean {
  return normalizeJpPostalCode(postalInput) !== null && addressTarget.trim() === "";
}

/** Fire address→postal only once the address input carries usable text and the postal target is
 * still blank. In practice this fires once, right after the accepted single-scan OCR patch
 * supplies a nonblank address, because the target is blank only before an operator or a prior
 * lookup has already filled it. */
export function shouldTriggerAddressToPostal(addressInput: string, postalTarget: string): boolean {
  return normalizeJpAddressInput(addressInput) !== null && postalTarget.trim() === "";
}

// ── Postal → address ─────────────────────────────────────────────────────────

export interface PostalToAddressRequestSnapshot {
  /** The normalized 7-digit postal code the request was issued for. */
  readonly sourcePostalCode: string;
}

export interface PostalToAddressResponse {
  readonly requestSnapshot: PostalToAddressRequestSnapshot;
  /** The draft's postal input AT RESPONSE TIME (raw, as the operator may have kept editing it). */
  readonly currentPostalInput: string;
  /** The draft's address target AT RESPONSE TIME. */
  readonly currentAddressTarget: string;
  readonly result: JpPostalForwardLookupResult;
}

export type PostalToAddressPlan =
  | { readonly apply: true; readonly address: string }
  | { readonly apply: false };

/**
 * Decide whether a postal→address response may be applied.
 *
 * Zero-write for every code except `FOUND`; even `FOUND` is discarded if the postal input changed
 * since the request (stale response) or the address target is no longer blank (operator or another
 * response already filled it, or typed over it, in the interim).
 */
export function planPostalToAddressApply(response: PostalToAddressResponse): PostalToAddressPlan {
  if (response.result.code !== "FOUND") return { apply: false };
  if (normalizeJpPostalCode(response.currentPostalInput) !== response.requestSnapshot.sourcePostalCode) {
    return { apply: false };
  }
  if (response.currentAddressTarget.trim() !== "") return { apply: false };

  const { address } = response.result;
  return { apply: true, address: `${address.prefectureKanji}${address.cityKanji}${address.townKanji}` };
}

// ── OCR-address → postal ─────────────────────────────────────────────────────

export interface AddressToPostalRequestSnapshot {
  /** The normalized address text the request was issued for. */
  readonly sourceAddress: string;
}

export interface AddressToPostalResponse {
  readonly requestSnapshot: AddressToPostalRequestSnapshot;
  /** The draft's address input AT RESPONSE TIME. */
  readonly currentAddressInput: string;
  /** The draft's postal target AT RESPONSE TIME. */
  readonly currentPostalTarget: string;
  readonly result: JpPostalReverseLookupResult;
}

export type AddressToPostalPlan =
  | { readonly apply: true; readonly postalCode: string }
  | { readonly apply: false };

/** Formats a normalized 7-digit code as `NNN-NNNN`, matching the existing 郵便番号 field's placeholder. */
export function formatJpPostalCodeForDisplay(normalized: string): string {
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

/**
 * Decide whether an address→postal response may be applied.
 *
 * Same zero-write and staleness discipline as the postal→address direction, mirrored on the
 * address input / postal target pair.
 */
export function planAddressToPostalApply(response: AddressToPostalResponse): AddressToPostalPlan {
  if (response.result.code !== "FOUND") return { apply: false };
  if (normalizeJpAddressInput(response.currentAddressInput) !== response.requestSnapshot.sourceAddress) {
    return { apply: false };
  }
  if (response.currentPostalTarget.trim() !== "") return { apply: false };

  return { apply: true, postalCode: formatJpPostalCodeForDisplay(response.result.postalCode) };
}

// Re-exported so callers building a request snapshot never re-derive the key formula by hand.
export { buildJpPostalAddressKey };
