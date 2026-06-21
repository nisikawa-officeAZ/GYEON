"use server";

// PHASE59: Onboarding service
// dealer_id is ALWAYS from getCurrentDealer() — never accepted from client.
// Fail-open for onboarding (no block on primary flow).

import { createClient }     from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createAuditLog }   from "@/lib/audit/audit";
import { createNotification } from "@/lib/notifications/notification";
import {
  OnboardingStatus,
  OnboardingSaveParams,
  ONBOARDING_SKIPPED_STEP,
  ONBOARDING_TOTAL_STEPS,
} from "./onboarding-types";

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current onboarding status for the active dealer.
 * Returns null if no dealer or dealer_settings doesn't exist yet.
 * Gracefully handles missing columns (migration not applied).
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("dealer_settings")
      .select(`
        onboarding_completed, onboarding_completed_at, onboarding_step,
        business_name, business_phone, business_email, business_address,
        business_website, logo_url,
        tax_rate, terms_and_conditions,
        line_enabled, line_liff_id, webhook_url,
        stamp_url, pdf_footer, invoice_note, completion_note
      `)
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      onboarding_completed:    data.onboarding_completed    ?? false,
      onboarding_completed_at: data.onboarding_completed_at ?? null,
      onboarding_step:         data.onboarding_step         ?? 1,
      business_name:           data.business_name           ?? null,
      business_phone:          data.business_phone          ?? null,
      business_email:          data.business_email          ?? null,
      business_address:        data.business_address        ?? null,
      business_website:        data.business_website        ?? null,
      logo_url:                data.logo_url                ?? null,
      tax_rate:                data.tax_rate                ?? 10,
      terms_and_conditions:    data.terms_and_conditions    ?? null,
      line_enabled:            data.line_enabled            ?? false,
      line_liff_id:            data.line_liff_id            ?? null,
      webhook_url:             data.webhook_url             ?? null,
      stamp_url:               data.stamp_url               ?? null,
      pdf_footer:              data.pdf_footer              ?? null,
      invoice_note:            data.invoice_note            ?? null,
      completion_note:         data.completion_note         ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────

async function upsertDealerSettings(
  dealerId: string,
  patch: Record<string, unknown>
) {
  const supabase = await createClient();
  return supabase
    .from("dealer_settings")
    .upsert(
      { dealer_id: dealerId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "dealer_id" }
    );
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Saves step data and advances onboarding_step.
 * Upserts dealer_settings. Never throws.
 */
export async function saveOnboardingStep(
  params: OnboardingSaveParams
): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "ディーラー情報が取得できませんでした" };

  // Build patch — omit undefined values
  const patch: Record<string, unknown> = { onboarding_step: params.step };
  if (params.business_name   !== undefined) patch.business_name   = params.business_name;
  if (params.business_phone  !== undefined) patch.business_phone  = params.business_phone;
  if (params.business_email  !== undefined) patch.business_email  = params.business_email;
  if (params.business_address !== undefined) patch.business_address = params.business_address;
  if (params.business_website !== undefined) patch.business_website = params.business_website;
  if (params.logo_url        !== undefined) patch.logo_url        = params.logo_url;
  if (params.stamp_url       !== undefined) patch.stamp_url       = params.stamp_url;
  if (params.pdf_footer      !== undefined) patch.pdf_footer      = params.pdf_footer;
  if (params.invoice_note    !== undefined) patch.invoice_note    = params.invoice_note;
  if (params.completion_note !== undefined) patch.completion_note = params.completion_note;
  if (params.tax_rate        !== undefined) patch.tax_rate        = params.tax_rate;
  if (params.terms_and_conditions !== undefined) patch.terms_and_conditions = params.terms_and_conditions;

  try {
    const { error } = await upsertDealerSettings(dealer.dealer_id, patch);
    if (error) return { success: false, error: error.message };

    // Audit
    const isFirstStep = params.step === 2; // Step 1 just completed
    void createAuditLog({
      action:        isFirstStep ? "onboarding_started" : "onboarding_step_updated",
      resource_type: "onboarding",
      new_value:     { step: params.step },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "保存に失敗しました",
    };
  }
}

/**
 * Marks onboarding as complete. Fires success notification.
 */
export async function completeOnboarding(): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "ディーラー情報が取得できませんでした" };

  try {
    const { error } = await upsertDealerSettings(dealer.dealer_id, {
      onboarding_completed:    true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step:         ONBOARDING_TOTAL_STEPS,
    });
    if (error) return { success: false, error: error.message };

    // Audit
    void createAuditLog({
      action:        "onboarding_completed",
      resource_type: "onboarding",
      new_value:     { completed_at: new Date().toISOString() },
    });

    // Welcome notification
    void createNotification({
      type:    "success",
      title:   "GYEON Detailer Agent へようこそ",
      message: "セットアップが完了しました。すべての機能をご利用いただけます。",
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "完了処理に失敗しました",
    };
  }
}

/**
 * Skips the wizard (marks step as SKIPPED so redirect no longer triggers).
 * onboarding_completed remains false — dashboard will show OnboardingCard.
 */
export async function skipOnboarding(): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "ディーラー情報が取得できませんでした" };

  try {
    // Set step to SKIPPED value so the dashboard redirect doesn't fire again
    const { error } = await upsertDealerSettings(dealer.dealer_id, {
      onboarding_step: ONBOARDING_SKIPPED_STEP,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "スキップに失敗しました",
    };
  }
}

/**
 * Resets onboarding so the wizard starts from step 1 again.
 */
export async function resetOnboarding(): Promise<{ success: boolean; error?: string }> {
  const dealer = await getCurrentDealer();
  if (!dealer) return { success: false, error: "ディーラー情報が取得できませんでした" };

  try {
    const { error } = await upsertDealerSettings(dealer.dealer_id, {
      onboarding_completed:    false,
      onboarding_completed_at: null,
      onboarding_step:         1,
    });
    if (error) return { success: false, error: error.message };

    void createAuditLog({
      action:        "onboarding_reset",
      resource_type: "onboarding",
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "リセットに失敗しました",
    };
  }
}
