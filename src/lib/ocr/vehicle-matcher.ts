// DealerOS — OCR vehicle matcher (Phase E9.2, pure). No schema.
//
// Scores an OCR vehicle candidate against existing vehicles by registration
// number (plate_number) and chassis number (vin), classifying existing /
// possible / new. Pure & deterministic; the dealer-scoped fetch lives in
// ocr-match-actions.ts. Nothing is auto-overwritten.

import type { MatchStatus } from "./customer-matcher";

export interface VehicleCandidate {
  plateNumber?:   string;
  chassisNumber?: string;
  modelCode?:     string;
}

export interface VehicleLike {
  id:            string;
  maker?:        string | null;
  model?:        string | null;
  plate_number?: string | null;
  vin?:          string | null;
  model_code?:   string | null;
}

export interface VehicleMatch {
  id:            string;
  label:         string;
  plateNumber:   string | null;
  chassisNumber: string | null;
  score:         number;
  reasons:       string[];
}

export interface VehicleMatchResult {
  status:  MatchStatus;
  matches: VehicleMatch[];
}

const norm = (s?: string | null) => (s ?? "").replace(/\s+/g, "").toUpperCase().trim();

export function scoreVehicle(cand: VehicleCandidate, v: VehicleLike): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const cc = norm(cand.chassisNumber), vc = norm(v.vin);
  if (cc && vc && cc === vc) { score += 70; reasons.push("車台番号一致"); }

  const cp = norm(cand.plateNumber), vp = norm(v.plate_number);
  if (cp && vp && cp === vp) { score += 50; reasons.push("登録番号一致"); }

  const cm = norm(cand.modelCode), vm = norm(v.model_code);
  if (cm && vm && cm === vm) { score += 10; reasons.push("型式一致"); }

  return { score, reasons };
}

export function classifyVehicleMatches(
  cand: VehicleCandidate,
  vehicles: readonly VehicleLike[],
): VehicleMatchResult {
  const scored = (vehicles ?? [])
    .map((v) => ({ v, ...scoreVehicle(cand, v) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const matches: VehicleMatch[] = scored.slice(0, 5).map((x) => ({
    id:            x.v.id,
    label:         [x.v.maker, x.v.model, x.v.plate_number].filter(Boolean).join(" ") || "—",
    plateNumber:   x.v.plate_number ?? null,
    chassisNumber: x.v.vin ?? null,
    score:         x.score,
    reasons:       x.reasons,
  }));

  const best = scored[0]?.score ?? 0;
  // chassis (70) or plate (50) ⇒ existing; model-code-only ⇒ possible.
  const status: MatchStatus = best >= 50 ? "existing" : best >= 10 ? "possible" : "new";
  return { status, matches };
}
