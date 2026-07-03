"use server";

// Onboarding Step 2 — Admin / Owner (管理者情報).
// The first onboarding person is the dealer OWNER / primary administrator,
// NOT ordinary staff. This upserts the current user's dealer_staff record with
// role='owner' (unique per dealer_id+user_id → no duplicate), and stores the
// richer profile fields (furigana / title / phone) in the flexible
// dealer_settings.store_profile jsonb blob — no schema change.
// Additional staff are invited later from Settings / User Management.

import { requireRole } from "@/lib/staff/require-role";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OnboardingAdminParams {
  name:      string;
  furigana?: string;
  title?:    string;
  phone?:    string;
  email?:    string;
}

export async function saveOnboardingAdmin(
  params: OnboardingAdminParams,
): Promise<{ success: boolean; error?: string }> {
  // Owner/manager only, consistent with saveOnboardingStep.
  try {
    await requireRole(["owner", "manager"]);
  } catch {
    return { success: false, error: "この操作を行う権限がありません" };
  }

  const [user, dealer] = await Promise.all([getCurrentUser(), getCurrentDealer()]);
  if (!user || !dealer) {
    return { success: false, error: "ディーラー情報が取得できませんでした" };
  }

  const clean = (v: string | undefined) => (v ?? "").trim() || null;
  const name  = clean(params.name);
  const email = clean(params.email);

  const supabase = createAdminClient();

  // 1) Upsert the current user as the dealer OWNER (primary administrator).
  //    UNIQUE (dealer_id, user_id) guarantees no duplicate staff record.
  const { error: staffErr } = await supabase
    .from("dealer_staff")
    .upsert(
      {
        dealer_id: dealer.dealer_id,
        user_id:   user.id,
        name,
        email,
        role:      "owner",
        status:    "active",
      },
      { onConflict: "dealer_id,user_id" },
    );
  if (staffErr) return { success: false, error: staffErr.message };

  // 2) Persist to dealer_settings: contact_name + extras in store_profile jsonb.
  const { data: current } = await supabase
    .from("dealer_settings")
    .select("store_profile")
    .eq("dealer_id", dealer.dealer_id)
    .maybeSingle();

  const storeProfile = {
    ...(current?.store_profile ?? {}),
    admin_name:     name,
    admin_furigana: clean(params.furigana),
    admin_title:    clean(params.title),
    admin_phone:    clean(params.phone),
    admin_email:    email,
  };

  const { error: settErr } = await supabase
    .from("dealer_settings")
    .upsert(
      {
        dealer_id:      dealer.dealer_id,
        contact_name:   name,
        store_profile:  storeProfile,
        onboarding_step: 2,
        updated_at:     new Date().toISOString(),
      },
      { onConflict: "dealer_id" },
    );
  if (settErr) return { success: false, error: settErr.message };

  return { success: true };
}
