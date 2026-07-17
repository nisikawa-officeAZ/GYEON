import "server-only";

// C2C4 — Estimate Wizard settings authoritative server loader.
//
// The ONLY entry the settings page uses to obtain its data. It accepts NO dealer id,
// rank, lifecycle, role, or configuration input: the dealer comes from
// getCurrentDealer(), the role from getCurrentStaff(), the rank from
// getAuthoritativeShopRank(), and all catalog/lifecycle/policy reads go through the
// user-scoped, RLS-authenticated Supabase client. It returns the presentation-safe
// DTO only — never raw rows, dealer ids, raw lifecycle enums, revision wording, or
// database error text. It fails closed and never uses service_role.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { getDealerPricingCatalog } from "@/lib/pricing/get-dealer-pricing-catalog";
import { getStaffList } from "@/lib/staff/get-staff-list";
import {
  buildEstimateWizardSettingsView,
  type RawCatalogItem,
  type RawLifecycle,
  type RawSettingsData,
} from "./estimate-wizard-settings-core";
import type { EstimateWizardSettingsViewResult } from "./estimate-wizard-settings-types";

const EDITABLE_KINDS = [
  "film_type",
  "maintenance_menu",
  "wash_menu",
  "room_cleaning_menu",
  "other_work_preset",
  "store_global_option",
] as const;

const LOAD_FAILED_JA = "設定を読み込めませんでした。時間をおいて再度お試しください。";

/** Resolve last_reviewed_by → a safe display name (never an id; tolerates deletion). */
async function resolveReviewerName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const staff = await getStaffList();
    const hit = staff.find((s) => s.user_id === userId);
    return hit?.name?.trim() || hit?.email?.trim() || null;
  } catch {
    return null;
  }
}

export async function getEstimateWizardSettingsView(): Promise<EstimateWizardSettingsViewResult> {
  const dealer = await getCurrentDealer();
  if (!dealer) {
    return { ok: false, reason: "no-dealer", messageJa: "有効なディーラー権限がありません。" };
  }

  try {
    const [staff, rankRes] = await Promise.all([getCurrentStaff(), getAuthoritativeShopRank()]);
    const role = staff?.role ?? null;
    const rank = rankRes.ok ? rankRes.rank : null;

    const supabase = await createClient();

    // Dealer product mode (RLS: own dealer only).
    const { data: dealerRow, error: dealerErr } = await supabase
      .from("dealers")
      .select("product_mode")
      .eq("id", dealer.dealer_id)
      .maybeSingle();
    if (dealerErr) return { ok: false, reason: "load-failed", messageJa: LOAD_FAILED_JA };
    const productMode = (dealerRow?.product_mode as string | undefined) ?? "gyeon";

    // Active dealer-owned catalog items across the four editable families.
    const { data: itemRows, error: itemErr } = await supabase
      .from("wizard_catalog_items")
      .select(
        "id, code, kind, label_ja, default_unit_price, duration_minutes, display_order, priceable, quantity_required, min_quantity, max_quantity, presentation, is_active, deleted_at",
      )
      .eq("owner_scope", "dealer")
      .eq("dealer_id", dealer.dealer_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("kind", EDITABLE_KINDS as unknown as string[]);
    if (itemErr) return { ok: false, reason: "load-failed", messageJa: LOAD_FAILED_JA };

    // Lifecycle (RLS: own dealer only). Includes durable last-review columns (109).
    const { data: lifeRow, error: lifeErr } = await supabase
      .from("dealer_wizard_catalog_lifecycle")
      .select(
        "state, current_configuration_revision, reviewed_configuration_revision, last_reviewed_at, last_reviewed_by, last_reviewed_configuration_revision",
      )
      .eq("dealer_id", dealer.dealer_id)
      .maybeSingle();
    if (lifeErr) return { ok: false, reason: "load-failed", messageJa: LOAD_FAILED_JA };

    // Window-film requirement = (film_type permitted ranks for this mode) ∩ authoritative rank.
    let filmRequired = false;
    if (rank) {
      const { data: policyRow } = await supabase
        .from("wizard_kind_policy")
        .select("permitted_ranks")
        .eq("product_mode", productMode)
        .eq("kind", "film_type")
        .maybeSingle();
      const permitted = (policyRow?.permitted_ranks as string[] | undefined) ?? [];
      filmRequired = permitted.includes(rank);
    }

    // Coating summary (never throws; returns defaults on failure).
    let coatingCount = 0;
    try {
      const catalog = await getDealerPricingCatalog();
      coatingCount = catalog.coatings.length;
    } catch {
      coatingCount = 0;
    }

    const lifecycle: RawLifecycle | null = lifeRow
      ? {
          state: (lifeRow.state as string) ?? "MIGRATED_UNREVIEWED",
          currentRevision: Number(lifeRow.current_configuration_revision ?? 0),
          reviewedRevision:
            lifeRow.reviewed_configuration_revision === null || lifeRow.reviewed_configuration_revision === undefined
              ? null
              : Number(lifeRow.reviewed_configuration_revision),
          lastReviewedAtIso: (lifeRow.last_reviewed_at as string | null) ?? null,
          lastReviewedRevision:
            lifeRow.last_reviewed_configuration_revision === null || lifeRow.last_reviewed_configuration_revision === undefined
              ? null
              : Number(lifeRow.last_reviewed_configuration_revision),
        }
      : null;

    const reviewerName = await resolveReviewerName((lifeRow?.last_reviewed_by as string | null) ?? null);

    const items: RawCatalogItem[] = (itemRows ?? []).map((r: Record<string, unknown>) => ({
      itemId: r.id as string,
      code: r.code as string,
      kind: r.kind as string,
      labelJa: (r.label_ja as string | null) ?? null,
      defaultUnitPrice: (r.default_unit_price as number | null) ?? null,
      durationMinutes: (r.duration_minutes as number | null) ?? null,
      displayOrder: Number(r.display_order ?? 0),
      priceable: Boolean(r.priceable),
      quantityRequired: Boolean(r.quantity_required),
      minQuantity: (r.min_quantity as number | null) ?? null,
      maxQuantity: (r.max_quantity as number | null) ?? null,
      presentation: r.presentation ?? null,
      isActive: Boolean(r.is_active),
      deletedAt: (r.deleted_at as string | null) ?? null,
    }));

    const raw: RawSettingsData = {
      role,
      rankKnown: rank !== null,
      filmRequired,
      items,
      lifecycle,
      coatingCount,
      reviewerName,
    };

    return { ok: true, view: buildEstimateWizardSettingsView(raw) };
  } catch {
    // Never surface raw errors to the client.
    return { ok: false, reason: "load-failed", messageJa: LOAD_FAILED_JA };
  }
}
