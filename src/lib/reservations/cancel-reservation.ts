"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { requireStaffCapability } from "@/lib/auth/require-staff-capability";

export async function cancelReservation(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("[cancelReservation] error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  return { success: true };
}

export async function markNoShow(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireStaffCapability("edit");
  if ("error" in auth) return { success: false, error: auth.error };

  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "No active dealer membership." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("reservations")
    .update({ status: "no_show", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("dealer_id", dealer.dealer_id);

  if (error) {
    console.error("[markNoShow] error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/reservations");
  revalidatePath("/calendar");
  return { success: true };
}
