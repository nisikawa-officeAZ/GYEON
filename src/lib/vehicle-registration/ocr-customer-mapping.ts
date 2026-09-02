// DealerOS — Vehicle registration OCR → customer mapping rule
//
// Japanese registration business rule (refined):
//   - Owner (所有者) and user (使用者) may differ. Do NOT blindly pick the user.
//   - Default to the USER only when the owner is clearly NOT the real customer —
//     a finance/credit/leasing company, car dealer, manufacturer, auto-sales,
//     auction/export/import, i.e. a business merely holding legal ownership.
//   - If owner ≠ user and BOTH look like ordinary individuals/corporations, the
//     operator must choose which to register (requireSelection).
//   - If owner and user are the same / not separated, register whoever is present.
//   - The customer may be an individual OR a corporation. Never split a
//     corporation name into surname/given.
//   - Owner AND user raw data are always preserved in the OCR result JSON;
//     only the CHOSEN party is reflected to the form.

import type { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

export type CustomerType   = "individual" | "corporation" | "unknown";
export type CustomerSource = "user" | "owner";

export interface OcrCustomerAnalysis {
  ownerName:             string;        // trimmed raw text, exactly as printed
  ownerAddress:          string;        // trimmed raw text, exactly as printed
  userName:              string;        // trimmed raw text, exactly as printed
  userAddress:           string;        // trimmed raw text, exactly as printed
  ownerUserSeparated:    boolean;       // owner ≠ user, decided from resolved NAMES only
  ownerIsBusinessHolder: boolean;       // owner looks like finance/dealer/leasing/etc.
  requireSelection:      boolean;       // separated & both normal → operator must choose
  recommendedSource:     CustomerSource;// default radio selection
  note:                  string | null; // shown when auto-defaulting to user
}

/**
 * Internal-only extension of `OcrCustomerAnalysis` carrying the marker/directional-phrase
 * RESOLVED values used for identity/postal decisions. Never exported — callers outside this
 * module only ever see the raw-preserving public shape via `analyzeOcrCustomer`.
 */
interface ResolvedOcrCustomerAnalysis extends OcrCustomerAnalysis {
  resolvedOwnerName:    string; // "" when blank/marker/同上/unresolved directional phrase
  resolvedUserName:     string; // "" when blank/marker/同上/unresolved directional phrase
  resolvedOwnerAddress: string; // "" when blank/marker/同上/unresolved directional phrase
  resolvedUserAddress:  string; // "" when blank/marker/同上/unresolved directional phrase
}

export const OWNER_BUSINESS_HOLDER_NOTE =
  "所有者が信販会社・販売店等の可能性があるため、使用者を顧客として選択しています。";

// Corporation / organization markers — must NOT be split into surname/given.
const CORP_KEYWORDS =
  /(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|社会福祉法人|学校法人|医療法人|宗教法人|特定非営利活動法人|NPO法人|独立行政法人|地方独立行政法人|\(株\)|（株）|㈱|\(有\)|（有）|㈲|\(同\)|（同）)/;

// Owner is a business merely HOLDING ownership (finance / dealer / maker / leasing
// / auto-sales / auction / trading) — in that case the user is the real customer.
const OWNER_BUSINESS_HOLDER =
  /(信販|クレジット|クレディ|リース|ローン|ファイナンス|銀行|保証|自動車販売|オートセールス|オートサービス|モータース|モーター|ディーラー|販売店|オート|オークション|輸出|輸入|商事|物産|メーカー|自動車工業|自動車製造|Finance|Leasing|Credit|Motors?|Auto|Bank|アプラス|オリコ|オリエントコーポレーション|ジャックス|セディナ|オリックス|ニコス|セゾン|アコム|プレミア|Aplus|Orico|Jaccs|Cedyna|Orix)/i;

function norm(s: string): string {
  return s.replace(/[\s　]/g, "");
}

// ── Marker / directional-phrase resolution ──────────────────────────────────────
//
// 車検証 OCR text routinely carries placeholder text instead of a real name/address:
//   - blank, or an asterisk-only redaction (ASCII "***" or full-width "＊＊＊")
//   - the literal 同上 ("same as above")
//   - a directional phrase pointing at the OTHER party's line, e.g. 所有者欄に
//     "使用者に同じ" printed instead of repeating the name already on file.
//
// Classification is string-only and NFKC-normalized (so full-width "＊" and half-width
// "*" match alike); the RAW trimmed text is always preserved on OcrCustomerAnalysis, and
// only the resolved/classified value is ever blanked out or copied.

type FieldKind = "owner_name" | "owner_address" | "user_name" | "user_address";

// The exact phrase each field may carry to mean "copy the other party's line here".
const DIRECTIONAL_PHRASE: Record<FieldKind, string> = {
  owner_name:    "使用者に同じ",
  owner_address: "使用者住所に同じ",
  user_name:     "所有者に同じ",
  user_address:  "所有者住所に同じ",
};

const OPPOSITE_FIELD: Record<FieldKind, FieldKind> = {
  owner_name:    "user_name",
  owner_address: "user_address",
  user_name:     "owner_name",
  user_address:  "owner_address",
};

const ANY_DIRECTIONAL_PHRASE = new Set(Object.values(DIRECTIONAL_PHRASE));

/** NFKC + trim for CLASSIFICATION ONLY — never used as the value stored/copied. */
function classifyNorm(raw: string): string {
  return raw.normalize("NFKC").trim();
}

/** Blank, an asterisk-only redaction (either width), or the literal 同上. */
function isBlankOrMarkerText(normalized: string): boolean {
  return normalized === "" || /^\*+$/.test(normalized) || normalized === "同上";
}

/**
 * Resolve one field (owner_name / owner_address / user_name / user_address) to either a
 * concrete usable string or "" (unusable). `rawByField` holds the trimmed raw text of all
 * four fields so a directional phrase can be resolved against its opposite field.
 *
 * Exactly one hop, no recursion: a directional phrase copies the OPPOSITE field's raw text
 * only when that opposite text is itself concrete — not blank, not a marker/同上, and not
 * ANY directional phrase (including its own). A phrase in the wrong field (address text in
 * a name field or vice versa) or naming the wrong party (self-reference) never resolves,
 * regardless of what the opposite field holds. Name phrases never touch address fields and
 * address phrases never touch name fields.
 */
function resolveField(kind: FieldKind, rawByField: Record<FieldKind, string>): string {
  const raw = rawByField[kind];
  const normalized = classifyNorm(raw);

  if (isBlankOrMarkerText(normalized)) return "";

  if (ANY_DIRECTIONAL_PHRASE.has(normalized)) {
    if (normalized !== DIRECTIONAL_PHRASE[kind]) return ""; // wrong field or wrong party
    const oppositeRaw        = rawByField[OPPOSITE_FIELD[kind]];
    const oppositeNormalized = classifyNorm(oppositeRaw);
    if (isBlankOrMarkerText(oppositeNormalized) || ANY_DIRECTIONAL_PHRASE.has(oppositeNormalized)) {
      return ""; // opposite is not concrete (blank/marker/同上/directional, including a cycle)
    }
    return oppositeRaw;
  }

  // Meaningful text — even text that merely CONTAINS an asterisk — is concrete as-is.
  return raw;
}

/** True when the name looks like a corporation/organization. */
export function isCorporationName(name: string): boolean {
  return CORP_KEYWORDS.test(name);
}

/** True when the OWNER looks like a finance/dealer/maker/leasing business holder. */
export function isBusinessOwnerHolder(ownerName: string): boolean {
  return OWNER_BUSINESS_HOLDER.test(ownerName);
}

/**
 * Split an individual's Japanese name into surname/given — ONLY when confident
 * (an explicit space separator). Otherwise keep the full name as the surname and
 * leave given blank (never fabricate a split).
 */
export function splitIndividualName(full: string): { last: string; first: string } {
  const t = full.trim();
  const parts = t.split(/[\s　]+/).filter(Boolean);
  if (parts.length >= 2) return { last: parts[0], first: parts.slice(1).join(" ") };
  return { last: t, first: "" };
}

/**
 * Analyze owner/user to decide recommended customer source and whether to ask, INCLUDING the
 * internal resolved values used for identity/postal decisions. Not exported — internal callers
 * in this module use this; external callers use the public `analyzeOcrCustomer` below, which
 * never exposes the resolved fields.
 */
function analyzeOcrCustomerInternal(r: Partial<VehicleRegistrationOcrResult>): ResolvedOcrCustomerAnalysis {
  const ownerName    = (r.owner_name    ?? "").trim();
  const userName     = (r.user_name     ?? "").trim();
  const ownerAddress = (r.owner_address ?? "").trim();
  const userAddress  = (r.user_address  ?? "").trim();

  const rawByField: Record<FieldKind, string> = {
    owner_name: ownerName, owner_address: ownerAddress,
    user_name:  userName,  user_address:  userAddress,
  };

  // Resolved, marker/directional-aware values — the ONLY values used for identity/postal
  // decisions below. The raw trimmed fields above are preserved verbatim on the result.
  const resolvedOwnerName    = resolveField("owner_name",    rawByField);
  const resolvedUserName     = resolveField("user_name",     rawByField);
  const resolvedOwnerAddress = resolveField("owner_address", rawByField);
  const resolvedUserAddress  = resolveField("user_address",  rawByField);

  // Separated is decided from resolved NAMES only — a directional name phrase can prove two
  // lines are one person, but an address phrase must never move this classification.
  const separated             = !!resolvedUserName && !!resolvedOwnerName
    && norm(resolvedUserName) !== norm(resolvedOwnerName);
  const ownerIsBusinessHolder = separated && isBusinessOwnerHolder(resolvedOwnerName);

  let recommendedSource: CustomerSource;
  let requireSelection: boolean;
  let note: string | null;

  if (!separated) {
    // Same or only one present → use whichever exists.
    recommendedSource = resolvedUserName ? "user" : "owner";
    requireSelection  = false;
    note              = null;
  } else if (ownerIsBusinessHolder) {
    // Owner is finance/dealer/etc. → the user is the real customer.
    recommendedSource = "user";
    requireSelection  = false;
    note              = OWNER_BUSINESS_HOLDER_NOTE;
  } else {
    // Both look ordinary → operator must decide.
    recommendedSource = "user";
    requireSelection  = true;
    note              = null;
  }

  return {
    ownerName, ownerAddress, userName, userAddress,
    resolvedOwnerName, resolvedUserName, resolvedOwnerAddress, resolvedUserAddress,
    ownerUserSeparated: separated, ownerIsBusinessHolder,
    requireSelection, recommendedSource, note,
  };
}

/** Analyze owner/user to decide recommended customer source and whether to ask. */
export function analyzeOcrCustomer(r: Partial<VehicleRegistrationOcrResult>): OcrCustomerAnalysis {
  const a = analyzeOcrCustomerInternal(r);
  return {
    ownerName: a.ownerName, ownerAddress: a.ownerAddress,
    userName: a.userName, userAddress: a.userAddress,
    ownerUserSeparated: a.ownerUserSeparated, ownerIsBusinessHolder: a.ownerIsBusinessHolder,
    requireSelection: a.requireSelection, recommendedSource: a.recommendedSource, note: a.note,
  };
}

/**
 * Which party the customer record is ACTUALLY taken from, or null when the certificate names
 * nobody. This is the single effective-party decision the whole mapping is built on.
 *
 * The requested `source` is honoured whenever that party is named. When it is not, the OTHER party
 * is used — a certificate that names only 所有者 must still produce a customer. What must never
 * happen is the two halves disagreeing: before this function existed the NAME fell back across
 * parties while the address applied its own independent preference, so asking for 使用者 on a
 * certificate that named only 所有者 could return the owner's name beside the user's address.
 */
export function effectiveCustomerParty(
  r: Partial<VehicleRegistrationOcrResult>,
  source: CustomerSource,
): CustomerSource | null {
  const a = analyzeOcrCustomerInternal(r);
  if (source === "user") {
    if (a.resolvedUserName) return "user";
    return a.resolvedOwnerName ? "owner" : null;
  }
  if (a.resolvedOwnerName) return "owner";
  return a.resolvedUserName ? "user" : null;
}

/**
 * True when 所有者 and 使用者 are ONE party described twice.
 *
 * `ownerUserSeparated` is "both named AND different", so both-named-and-NOT-separated means the two
 * names normalise equal. That is not two parties whose data must be kept apart — it is one party
 * recorded on two lines, which is the ordinary shape of a 車検証 where the owner drives their own
 * car. Only in that case may a blank field be completed from the other line: 使用者住所 is routinely
 * left blank (or printed 同上) when it repeats the owner's, and refusing to read it there would
 * throw away an address the certificate plainly states.
 *
 * This is the ONE place cross-line completion is permitted, and it is gated on proven identity —
 * never on the mere absence of a name, which is what made the original rule unsafe.
 */
function isOneParty(a: ResolvedOcrCustomerAnalysis): boolean {
  return !!a.resolvedOwnerName && !!a.resolvedUserName && !a.ownerUserSeparated;
}

/** NFKC is not applied here: this is display/draft text, not a match key. Trim only. */
function trimmed(raw: string | undefined): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Resolve the concrete customer name/kana/address/type for a chosen source.
 *
 * Every field comes from the SAME effective party. Where that party's field is blank, the other
 * line is read only when `isOneParty` proves the two lines describe one person; otherwise the field
 * stays blank and is left for the operator to fill, which is strictly better than silently
 * borrowing a different person's address.
 */
export function resolveCustomer(
  r: Partial<VehicleRegistrationOcrResult>,
  source: CustomerSource,
): { name: string; kana: string; address: string; customerType: CustomerType } {
  const a = analyzeOcrCustomerInternal(r);
  const party = effectiveCustomerParty(r, source);
  const oneParty = isOneParty(a);

  /** The effective party's value, completed from the other line only when they are one party. */
  const fromParty = (userValue: string, ownerValue: string): string => {
    if (party === null) return "";
    const own = party === "user" ? userValue : ownerValue;
    if (own) return own;
    if (!oneParty) return "";
    return party === "user" ? ownerValue : userValue;
  };

  // The name needs no completion step: `party` is non-null precisely when that party HAS a
  // resolved name (raw text, or a concrete value copied one hop via a directional phrase).
  const name = party === "user" ? a.resolvedUserName : party === "owner" ? a.resolvedOwnerName : "";
  const kana = fromParty(trimmed(r.user_name_kana), trimmed(r.owner_name_kana));
  const address = fromParty(a.resolvedUserAddress, a.resolvedOwnerAddress);

  const customerType: CustomerType = !name
    ? "unknown"
    : (isCorporationName(name) || r.customer_type === "corporation")
      ? "corporation"
      : "individual";

  return { name, kana, address, customerType };
}
