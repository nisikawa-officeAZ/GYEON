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
  ownerName:             string;
  ownerAddress:          string;
  userName:              string;
  userAddress:           string;
  ownerUserSeparated:    boolean;       // owner ≠ user
  ownerIsBusinessHolder: boolean;       // owner looks like finance/dealer/leasing/etc.
  requireSelection:      boolean;       // separated & both normal → operator must choose
  recommendedSource:     CustomerSource;// default radio selection
  note:                  string | null; // shown when auto-defaulting to user
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

/** Analyze owner/user to decide recommended customer source and whether to ask. */
export function analyzeOcrCustomer(r: Partial<VehicleRegistrationOcrResult>): OcrCustomerAnalysis {
  const ownerName    = (r.owner_name    ?? "").trim();
  const userName     = (r.user_name     ?? "").trim();
  const ownerAddress = (r.owner_address ?? "").trim();
  const userAddress  = (r.user_address  ?? "").trim();

  const separated             = !!userName && !!ownerName && norm(userName) !== norm(ownerName);
  const ownerIsBusinessHolder = separated && isBusinessOwnerHolder(ownerName);

  let recommendedSource: CustomerSource;
  let requireSelection: boolean;
  let note: string | null;

  if (!separated) {
    // Same or only one present → use whichever exists.
    recommendedSource = userName ? "user" : "owner";
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
    ownerUserSeparated: separated, ownerIsBusinessHolder,
    requireSelection, recommendedSource, note,
  };
}

/** Resolve the concrete customer name/address/type for a chosen source. */
export function resolveCustomer(
  r: Partial<VehicleRegistrationOcrResult>,
  source: CustomerSource,
): { name: string; address: string; customerType: CustomerType } {
  const a = analyzeOcrCustomer(r);
  const name =
    source === "user" ? (a.userName || a.ownerName) : (a.ownerName || a.userName);
  // Prefer the chosen party's address; only fall back to the other when NOT separated.
  const address =
    source === "user"
      ? (a.ownerUserSeparated ? a.userAddress : (a.userAddress || a.ownerAddress))
      : (a.ownerUserSeparated ? a.ownerAddress : (a.ownerAddress || a.userAddress));

  const customerType: CustomerType = !name
    ? "unknown"
    : (isCorporationName(name) || r.customer_type === "corporation")
      ? "corporation"
      : "individual";

  return { name, address, customerType };
}
