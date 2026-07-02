"use server";

// DealerOS — OCR matching server actions (Phase E9.2). Dealer-scoped finders
// that fetch existing customers/vehicles and classify a candidate via the pure
// matchers. dealer_id comes from getCurrentDealer() inside getCustomers/
// getVehicles; never from client. Read-only — nothing is written or overwritten.

import { getCustomers } from "@/lib/customers/get-customers";
import { getVehicles } from "@/lib/vehicles/get-vehicles";
import {
  classifyCustomerMatches,
  type CustomerCandidate,
  type CustomerLike,
  type CustomerMatchResult,
} from "./customer-matcher";
import {
  classifyVehicleMatches,
  type VehicleCandidate,
  type VehicleLike,
  type VehicleMatchResult,
} from "./vehicle-matcher";

export async function findCustomerMatches(candidate: CustomerCandidate): Promise<CustomerMatchResult> {
  const customers = await getCustomers(); // dealer-scoped
  return classifyCustomerMatches(candidate, customers as unknown as CustomerLike[]);
}

export async function findVehicleMatches(candidate: VehicleCandidate): Promise<VehicleMatchResult> {
  const vehicles = await getVehicles(); // dealer-scoped
  return classifyVehicleMatches(candidate, vehicles as unknown as VehicleLike[]);
}
