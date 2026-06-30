// Phase 2 Sprint 5 — OCR session summary helpers (pure foundation).
//
// Display/classification helpers for the OCR session history & audit viewer.
// Pure functions only (no schema, no I/O) — safe for server and client.
// Kept generic so future AI improvements can extend the mapping without a redesign.

import type { OcrSessionStatus } from "./ocr-session-types";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export type StatusTone = "green" | "blue" | "amber" | "slate" | "red";

export interface SessionStatusMeta {
  label: string;
  tone:  StatusTone;
}

export function ocrSessionStatusMeta(status: OcrSessionStatus): SessionStatusMeta {
  switch (status) {
    case "draft":      return { label: "下書き",   tone: "slate" };
    case "processing": return { label: "解析中",   tone: "blue" };
    case "reviewing":  return { label: "確認待ち", tone: "amber" };
    case "completed":  return { label: "登録完了", tone: "green" };
    case "abandoned":  return { label: "中止",     tone: "red" };
    default:           return { label: status,     tone: "slate" };
  }
}

// One-line summary of the reviewed (user-confirmed) OCR result.
export function summarizeReviewedResult(
  r: VehicleRegistrationOcrResult | null | undefined,
): string {
  if (!r) return "—";
  const vehicle = [r.maker, r.vehicle_name].filter(Boolean).join(" ");
  const name = r.user_name || r.owner_name || "";
  const parts = [vehicle, name].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

// Whether the session ended up linked to a customer / vehicle record.
export interface SessionLinkOutcome {
  customer: "linked" | "none";
  vehicle:  "linked" | "none";
}

export function ocrSessionOutcome(
  s: { customer_id: string | null; vehicle_id: string | null },
): SessionLinkOutcome {
  return {
    customer: s.customer_id ? "linked" : "none",
    vehicle:  s.vehicle_id  ? "linked" : "none",
  };
}
