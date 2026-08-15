"use server";

// DealerOS — Reservation staff options (Batch B5a).
//
// Returns the dealer's staff as lightweight { id, name, disabled } options for
// the reservation technician selector. Dealer-scoped via getStaffList →
// getCurrentDealer(); never accepts a client dealer_id. Read-only.
//
// Includes disabled staff (marked) so an existing assignment to a disabled
// technician still resolves and is preserved on edit.

import { getStaffList } from "@/lib/staff/get-staff-list";

export interface ReservationStaffOption {
  id: string;
  name: string;
  disabled: boolean;
}

export async function getReservationStaffOptions(): Promise<ReservationStaffOption[]> {
  try {
    const staff = await getStaffList(); // dealer-scoped
    return staff.map((s) => ({
      id: s.id,
      name: s.name || s.email || s.id.slice(0, 8),
      disabled: s.status === "disabled",
    }));
  } catch (err) {
    console.warn("[getReservationStaffOptions] failed — returning empty list:", err);
    return [];
  }
}
