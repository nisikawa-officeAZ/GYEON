"use server";

// GYEON partner onboarding — atomic shop-profile completion (the ONLY
// transition from the 'invited' owner membership to 'active').
//
// The caller supplies exactly the three required shop fields (phone,
// prefecture, address). Everything that AUTHORIZES the transition — the
// invited owner membership, the dealer it belongs to — is derived server-side
// from the session and re-validated inside the complete_gyeon_shop_profile
// transaction, which writes the dealer fields, activates the membership, and
// inserts the audit row all-or-nothing.

import { isGyeonPartnerOnboardingEnabled } from "@/lib/gyeon/partner-onboarding-enabled";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FIELD_LENGTH = 200;

export type CompleteGyeonShopProfileResult =
  | { kind: "disabled" }
  | { kind: "not-authenticated" }
  | { kind: "not-verified" }
  | { kind: "invalid-input"; reasonJa: string }
  | { kind: "completed"; dealerId: string }
  | { kind: "not-eligible" }
  | { kind: "already-active" }
  | { kind: "identity-mismatch" }
  | { kind: "error" };

export async function completeGyeonShopProfile(input: {
  phone: string;
  prefecture: string;
  address: string;
}): Promise<CompleteGyeonShopProfileResult> {
  try {
    // Server-only feature gate FIRST — before any database access.
    if (!isGyeonPartnerOnboardingEnabled()) return { kind: "disabled" };

    const phone = (input?.phone ?? "").trim();
    const prefecture = (input?.prefecture ?? "").trim();
    const address = (input?.address ?? "").trim();

    if (phone === "") return { kind: "invalid-input", reasonJa: "電話番号が未入力です。" };
    if (prefecture === "") return { kind: "invalid-input", reasonJa: "都道府県が未入力です。" };
    if (address === "") return { kind: "invalid-input", reasonJa: "住所が未入力です。" };
    if (phone.length > MAX_FIELD_LENGTH || prefecture.length > MAX_FIELD_LENGTH || address.length > MAX_FIELD_LENGTH) {
      return { kind: "invalid-input", reasonJa: "入力が長すぎます。" };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { kind: "not-authenticated" };
    if (!user.email_confirmed_at) return { kind: "not-verified" };

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("complete_gyeon_shop_profile", {
      p_user_id: user.id,
      p_phone: phone,
      p_prefecture: prefecture,
      p_address: address,
    });

    if (error) {
      console.error("[completeGyeonShopProfile] rpc error:", error.message);
      return { kind: "error" };
    }

    const outcome = (data as { outcome?: string; dealer_id?: string } | null)?.outcome;
    switch (outcome) {
      case "completed": {
        const dealerId = (data as { dealer_id?: string }).dealer_id;
        if (typeof dealerId !== "string" || dealerId === "") return { kind: "error" };
        return { kind: "completed", dealerId };
      }
      case "not-eligible":      return { kind: "not-eligible" };
      case "already-active":    return { kind: "already-active" };
      // F2-03: the transaction re-validated the auth.users identity and the
      // provisioning relationship and refused with zero writes.
      case "identity-mismatch": return { kind: "identity-mismatch" };
      case "invalid-input":     return { kind: "invalid-input", reasonJa: "入力内容を確認してください。" };
      default:                  return { kind: "error" };
    }
  } catch (err) {
    console.error("[completeGyeonShopProfile] unexpected error:", err);
    return { kind: "error" };
  }
}
