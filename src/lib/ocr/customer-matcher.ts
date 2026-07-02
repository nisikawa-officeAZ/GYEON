// DealerOS — OCR customer matcher (Phase E9.2, pure). No schema.
//
// Scores an OCR customer candidate against existing customers by name / phone /
// address and classifies the result as existing / possible / new so the operator
// decides — nothing is auto-overwritten. Pure & deterministic (unit-testable);
// the dealer-scoped fetch lives in ocr-match-actions.ts.

export type MatchStatus = "existing" | "possible" | "new";

export interface CustomerCandidate {
  lastName?:   string;
  firstName?:  string;
  phone?:      string;
  prefecture?: string;
  city?:       string;
  address1?:   string;
}

export interface CustomerLike {
  id:          string;
  last_name?:  string | null;
  first_name?: string | null;
  phone?:      string | null;
  prefecture?: string | null;
  city?:       string | null;
  address1?:   string | null;
}

export interface CustomerMatch {
  id:      string;
  name:    string;
  phone:   string | null;
  address: string | null;
  score:   number;
  reasons: string[];
}

export interface CustomerMatchResult {
  status:  MatchStatus;
  matches: CustomerMatch[];
}

const digits = (s?: string | null) => (s ?? "").replace(/[^0-9]/g, "");
const normName = (l?: string | null, f?: string | null) => `${l ?? ""}${f ?? ""}`.replace(/\s+/g, "").trim();
const normAddr = (...p: (string | null | undefined)[]) => p.map((x) => x ?? "").join("").replace(/\s+/g, "").trim();

export function scoreCustomer(cand: CustomerCandidate, cust: CustomerLike): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const cp = digits(cand.phone), up = digits(cust.phone);
  if (cp && up && cp === up) { score += 60; reasons.push("電話一致"); }

  const cn = normName(cand.lastName, cand.firstName), un = normName(cust.last_name, cust.first_name);
  if (cn && un && cn === un) { score += 30; reasons.push("氏名一致"); }

  const ca = normAddr(cand.prefecture, cand.city, cand.address1), ua = normAddr(cust.prefecture, cust.city, cust.address1);
  if (ca && ua && (ca === ua || ca.includes(ua) || ua.includes(ca))) { score += 20; reasons.push("住所一致"); }

  return { score, reasons };
}

export function classifyCustomerMatches(
  cand: CustomerCandidate,
  customers: readonly CustomerLike[],
): CustomerMatchResult {
  const scored = (customers ?? [])
    .map((c) => ({ c, ...scoreCustomer(cand, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const matches: CustomerMatch[] = scored.slice(0, 5).map((x) => ({
    id:      x.c.id,
    name:    [x.c.last_name, x.c.first_name].filter(Boolean).join(" ") || "—",
    phone:   x.c.phone ?? null,
    address: [x.c.prefecture, x.c.city, x.c.address1].filter(Boolean).join("") || null,
    score:   x.score,
    reasons: x.reasons,
  }));

  const best = scored[0]?.score ?? 0;
  // phone (60) or name+address (50) ⇒ existing; name-only or address-only ⇒ possible.
  const status: MatchStatus = best >= 50 ? "existing" : best >= 20 ? "possible" : "new";
  return { status, matches };
}
