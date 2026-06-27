// RC-02: OCR Session Types
//
// Defines the session wrapper for the vehicle registration OCR review workflow.
// One session = one end-to-end scan workflow (upload → OCR → review → complete).
// Multiple file uploads may belong to one session (re-upload / retry attempts).
//
// DB table: vehicle_registration_ocr_sessions (migration 068_ocr_sessions.sql)
//
// Security:
//   - dealer_id is always from getCurrentDealer() — never from client
//   - All server actions validate dealer_id ownership before any mutation

import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

// ─── Status ───────────────────────────────────────────────────────────────────

export type OcrSessionStatus =
  | "draft"      // Session created; no file uploaded yet
  | "processing" // File uploaded; OCR analysis in progress
  | "reviewing"  // OCR complete; awaiting user review and correction
  | "completed"  // User reviewed, corrected, and confirmed the result
  | "abandoned"; // Session cancelled without completion

// ─── Session record ───────────────────────────────────────────────────────────

export interface OcrSession {
  id:              string;
  dealer_id:       string;
  status:          OcrSessionStatus;
  customer_id:     string | null;
  vehicle_id:      string | null;
  primary_file_id: string | null;
  reviewed_result: VehicleRegistrationOcrResult;
  started_by:      string | null;
  completed_by:    string | null;
  completed_at:    string | null;
  created_at:      string;
  updated_at:      string;
}

// ─── Action param types ───────────────────────────────────────────────────────

export interface CreateOcrSessionParams {
  customer_id?: string;
  vehicle_id?:  string;
}

export interface UpdateOcrSessionParams {
  session_id:        string;
  status?:           OcrSessionStatus;
  primary_file_id?:  string;
  reviewed_result?:  VehicleRegistrationOcrResult;
  customer_id?:      string | null;
  vehicle_id?:       string | null;
}

export interface CompleteOcrSessionParams {
  session_id:       string;
  reviewed_result:  VehicleRegistrationOcrResult;
  customer_id?:     string;
  vehicle_id?:      string;
}

// ─── Action result types ──────────────────────────────────────────────────────

export type OcrSessionResult =
  | { success: true;  sessionId: string }
  | { success: false; error: string };

export type OcrSessionMutationResult =
  | { success: true }
  | { success: false; error: string };
