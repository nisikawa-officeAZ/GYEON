// Phase 2 Sprint 1 — Types for the customer + vehicle registration orchestration.
//
// Kept in a plain (non-"use server") module so both the server action and the
// client UI can import these types. Server-action files may only export async
// functions, so their shared types live here.

import type { CustomerFormState } from "./customer-mapper";
import type { VehicleFormState }  from "./vehicle-mapper";
import type { VehicleRegistrationOcrResult } from "@/lib/vehicle-registration/vehicle-registration-types";

export interface RegisterFromOcrParams {
  // When set, the vehicle is attached to this existing customer (ownership is
  // re-validated server-side). When null/undefined, a new customer is created.
  existingCustomerId?: string | null;
  customer:            CustomerFormState;
  vehicle:             VehicleFormState;
  // Optional OCR session linkage — completed non-blockingly on success.
  sessionId?:          string | null;
  reviewedResult?:     VehicleRegistrationOcrResult | null;
}

export type RegisterFromOcrResult =
  | { success: true;  customerId: string; vehicleId: string }
  // On vehicle-step failure after a customer was created, customerId is returned
  // so the caller can retry the vehicle step without creating a duplicate customer.
  | { success: false; error: string; customerId?: string };
