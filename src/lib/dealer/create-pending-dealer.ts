"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEALER_SIGNUP_FLOW = "dealer-v1";
const BUSINESS_NAME_MAX_LENGTH = 120;

export type CreatePendingDealerResult =
  | { kind: "created"; dealerId: string }
  | { kind: "already-exists"; dealerId: string }
  | { kind: "not-authenticated" }
  | { kind: "not-verified" }
  | { kind: "not-dealer-signup" }
  | { kind: "invalid-business-name" }
  | { kind: "email-conflict" }
  | { kind: "error" };

/**
 * Converges a verified Dealer registration into one pending dealer row.
 *
 * This action deliberately accepts no arguments. Identity and email come only
 * from auth.getUser(), so an unauthenticated browser cannot ask the service
 * role client to create a dealer for an arbitrary Auth user. The business name
 * is the only value read from user_metadata; it is display data, never an
 * authorization input.
 */
export async function createPendingDealer(): Promise<CreatePendingDealerResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) return { kind: "not-authenticated" };
    if (!user.email || !user.email_confirmed_at) return { kind: "not-verified" };

    const metadata = user.user_metadata as Record<string, unknown> | null;
    if (metadata?.dealer_signup_flow !== DEALER_SIGNUP_FLOW) {
      return { kind: "not-dealer-signup" };
    }

    const businessName =
      typeof metadata.dealer_business_name === "string"
        ? metadata.dealer_business_name.trim()
        : "";
    if (
      businessName.length === 0 ||
      Array.from(businessName).length > BUSINESS_NAME_MAX_LENGTH
    ) {
      return { kind: "invalid-business-name" };
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const admin = createAdminClient();

    // Idempotency guard 1: the verified Auth user already owns a dealer.
    const { data: ownerDealer, error: ownerLookupError } = await admin
      .from("dealers")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (ownerLookupError) {
      console.error("[createPendingDealer] owner lookup error:", ownerLookupError.message);
      return { kind: "error" };
    }
    if (ownerDealer) return { kind: "already-exists", dealerId: ownerDealer.id };

    // Idempotency guard 2: a dealer already uses the verified email. This is a
    // no-write outcome; returning/suspended accounts remain a human-admin case.
    const { data: emailDealer, error: emailLookupError } = await admin
      .from("dealers")
      .select("id")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (emailLookupError) {
      console.error("[createPendingDealer] email lookup error:", emailLookupError.message);
      return { kind: "error" };
    }
    if (emailDealer) return { kind: "email-conflict" };

    const { data, error } = await admin
      .from("dealers")
      .insert({
        name:                businessName,
        owner_user_id:       user.id,
        email:               normalizedEmail,
        approval_status:     "pending",
        subscription_status: "pending",
        plan:                "basic",
        status:              "active",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createPendingDealer] insert error:", error.message);
      return { kind: "error" };
    }

    return { kind: "created", dealerId: data.id };
  } catch (error) {
    console.error("[createPendingDealer] unexpected error:", error);
    return { kind: "error" };
  }
}
