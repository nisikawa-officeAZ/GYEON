import "server-only";

// EW-UI-5A1-B3-P0 — Dealer-bound Wizard runtime configuration loader (SERVER ONLY).
//
// The tenant-coherent counterpart to the arg-less `getAuthoritativeWizardRuntimeConfig()`, which is
// left UNCHANGED by this candidate. That entry discovers its dealer three independent times —
// once via the current-dealer helper for the catalog rows, and again inside the current-dealer-based
// rank and pricing-catalog wrappers. Each discovery uses `.limit(1).single()` over `dealer_members`,
// so a user with more than one active membership can have rank, pricing and catalog rows resolved
// for DIFFERENT dealers within a single call.
//
// This entry has exactly ONE tenant authority: `context.dealerId`, carried by the branded
// `EstimateSaveActorContext`, which the pure actor-context core produces only when the user has
// exactly one active membership and a role — from that SAME membership — permitted to edit.
//
// ── SECURITY PROPERTIES ─────────────────────────────────────────────────────────
//   • Accepts ONLY the branded context. A caller cannot pass a bare string, so a client-supplied
//     dealer id is unrepresentable. Enforced by the type, not by review.
//   • The current-dealer helper is never called here. The current-dealer-bound rank and pricing
//     wrappers are never called either: their arg-less signatures would re-discover a tenant. This
//     module calls the PURE cores instead, feeding each a `getDealerId` that returns exactly
//     `context.dealerId`, so all four reads share one constant tenant.
//   • Every read goes through the NORMAL authenticated `createClient()` under RLS — never a
//     service-role, admin, or secret-keyed client.
//   • Dealer-owned catalog rows are filtered to `context.dealerId` IN THE QUERY, alongside the
//     required global rows. RLS may legitimately expose two dealers' rows to a multi-membership
//     user; that is exactly why the query does not rely on RLS alone for tenant scoping. Any
//     foreign row that still reached the resolver is rejected by its ownership validation
//     (`malformed-catalog-row`), so admission is refused twice over.
//   • The final result is returned ONLY when `runtime.dealerId === context.dealerId`. A mismatch is
//     an identity defect and fails closed with no configuration at all.
//   • No DEFAULT_PRICING_CATALOG, no fixture, no default rank, no fallback tenant anywhere.

import { createClient } from "@/lib/supabase/server";
import type { EstimateSaveActorContext } from "@/lib/auth/estimate-save-actor-context";
import {
  resolveAuthoritativeShopRank,
  type RankResolution,
  type StoredRankRead,
} from "@/lib/dealer-settings/authoritative-shop-rank-core";
import {
  resolveAuthoritativePricingCatalog,
  type PricingCatalogResolution,
  type PricingSettingsReadResult,
} from "@/lib/pricing/authoritative-pricing-catalog-core";
import {
  resolveWizardRuntimeConfigForDealer,
  type AuthoritativeWizardRuntimeConfiguration,
  type WizardCatalogRow,
  type WizardDealerBoundConfigReaders,
  type WizardPpfCoatingAdjustmentRow,
} from "./wizard-runtime-config";

// B1.1-B2 adds the six columns migration 110 introduced: the PPF installation coefficient and the
// five coupon rule columns. Nothing else about the query changes.
const CATALOG_ROW_COLUMNS =
  "id, market, product_mode, kind, owner_scope, dealer_id, code, label_ja, display_order, is_active, default_unit_price, priceable, quantity_required, min_quantity, max_quantity, ppf_type_group_id, duration_minutes, deleted_at, presentation, install_coefficient_bp, coupon_discount_type, coupon_discount_value, coupon_combinable, coupon_valid_from, coupon_valid_to, wizard_catalog_item_ranks(rank), wizard_catalog_item_categories(category_id)";

/**
 * Today's date in the Japan business timezone, as ISO `YYYY-MM-DD`.
 *
 * Coupon validity is a BUSINESS-DAY boundary, so it must not shift with the server's locale. The
 * pure resolver never reads a clock; this server entry is the single place the date enters.
 */
function businessCalculationDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Read `dealers.detailer_rank` for exactly one dealer. A query error or absent row is a FAILED READ. */
async function readStoredRankFor(dealerId: string): Promise<StoredRankRead> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealers")
      .select("detailer_rank")
      .eq("id", dealerId)
      .single();
    if (error || !data) return { ok: false };
    return { ok: true, value: data.detailer_rank };
  } catch {
    return { ok: false };
  }
}

/** Read the two pricing columns for exactly one dealer. Raw values are handed to the pure core. */
async function readPricingSettingsFor(dealerId: string): Promise<PricingSettingsReadResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_settings")
      .select("service_price_settings, ppf_price_tables")
      .eq("dealer_id", dealerId)
      .maybeSingle();
    if (error) return { ok: false };
    return {
      ok: true,
      row: data
        ? {
            service_price_settings: data.service_price_settings,
            ppf_price_tables: data.ppf_price_tables,
          }
        : null,
    };
  } catch {
    return { ok: false };
  }
}

/**
 * The complete, fail-closed Wizard runtime bundle for the tenant the actor context authorizes.
 *
 * Returns a success only for `context.dealerId`. Any query, parse, rank, pricing or identity error
 * yields a typed failure carrying no configuration.
 */
export async function getAuthoritativeWizardRuntimeConfigForDealer(
  context: EstimateSaveActorContext,
): Promise<AuthoritativeWizardRuntimeConfiguration> {
  const tenantId: string = context.dealerId;

  const readers: WizardDealerBoundConfigReaders = {
    // Rank via the PURE core, fed the bound tenant. No current-dealer discovery, no default rank.
    getRank: async (dealerId: string): Promise<RankResolution> =>
      resolveAuthoritativeShopRank({
        getDealerId: async () => dealerId,
        readStoredRank: readStoredRankFor,
      }),

    // Pricing catalog via the PURE core, fed the same bound tenant. Never a default catalog.
    getCatalog: async (dealerId: string): Promise<PricingCatalogResolution> =>
      resolveAuthoritativePricingCatalog({
        getDealerId: async () => dealerId,
        readPricingSettings: readPricingSettingsFor,
      }),

    getLifecycle: async (dealerId: string) => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("dealer_wizard_catalog_lifecycle")
          .select("state, current_configuration_revision, reviewed_configuration_revision, reviewed_at")
          .eq("dealer_id", dealerId)
          .maybeSingle();
        if (error) return { ok: false };
        return { ok: true, row: data ?? null };
      } catch {
        return { ok: false };
      }
    },

    getCatalogRows: async (dealerId: string) => {
      try {
        const supabase = await createClient();
        // Required global rows (dealer_id IS NULL) + THIS dealer's own rows. The explicit
        // dealer_id predicate is what excludes another dealer's rows even when RLS would expose
        // them to a user who legitimately belongs to both.
        const { data, error } = await supabase
          .from("wizard_catalog_items")
          .select(CATALOG_ROW_COLUMNS)
          .eq("is_active", true)
          .is("deleted_at", null)
          .or(`dealer_id.is.null,dealer_id.eq.${dealerId}`);
        if (error || !data) return { ok: false };

        const rows: WizardCatalogRow[] = data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          market: d.market as string,
          product_mode: d.product_mode as string,
          kind: d.kind as string,
          owner_scope: d.owner_scope as string,
          dealer_id: (d.dealer_id as string | null) ?? null,
          code: d.code as string,
          label_ja: (d.label_ja as string | null) ?? null,
          display_order: (d.display_order as number) ?? 0,
          is_active: d.is_active as boolean,
          default_unit_price: (d.default_unit_price as number | null) ?? null,
          priceable: d.priceable as boolean,
          quantity_required: d.quantity_required as boolean,
          min_quantity: (d.min_quantity as number) ?? 1,
          max_quantity: (d.max_quantity as number | null) ?? null,
          ppf_type_group_id: (d.ppf_type_group_id as string | null) ?? null,
          duration_minutes: (d.duration_minutes as number | null) ?? null,
          deleted_at: (d.deleted_at as string | null) ?? null,
          presentation: d.presentation,
          install_coefficient_bp: (d.install_coefficient_bp as number | null) ?? null,
          coupon_discount_type: (d.coupon_discount_type as string | null) ?? null,
          coupon_discount_value: (d.coupon_discount_value as number | null) ?? null,
          coupon_combinable: (d.coupon_combinable as boolean | null) ?? null,
          coupon_valid_from: (d.coupon_valid_from as string | null) ?? null,
          coupon_valid_to: (d.coupon_valid_to as string | null) ?? null,
          ranks: ((d.wizard_catalog_item_ranks as { rank: string }[] | null) ?? []).map((x) => x.rank),
          categories: ((d.wizard_catalog_item_categories as { category_id: string }[] | null) ?? []).map(
            (x) => x.category_id,
          ),
        }));
        return { ok: true, rows };
      } catch {
        return { ok: false };
      }
    },

    // B1.1-B2 — PPF + coating reduction rules for THIS dealer only. Same discipline as the catalog
    // read: the explicit `dealer_id` predicate scopes the query rather than relying on RLS alone,
    // and the resolver independently re-validates ownership on every returned row.
    getPpfCoatingAdjustments: async (dealerId: string) => {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase
          .from("dealer_ppf_coating_adjustments")
          .select("id, dealer_id, ppf_method_code, coating_code, adjustment_type, adjustment_value, is_active, deleted_at")
          .eq("dealer_id", dealerId)
          .is("deleted_at", null);
        if (error || !data) return { ok: false };

        const rows: WizardPpfCoatingAdjustmentRow[] = data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          dealer_id: d.dealer_id as string,
          ppf_method_code: d.ppf_method_code as string,
          coating_code: d.coating_code as string,
          adjustment_type: d.adjustment_type as string,
          adjustment_value: (d.adjustment_value as number) ?? 0,
          is_active: d.is_active as boolean,
          deleted_at: (d.deleted_at as string | null) ?? null,
        }));
        return { ok: true, rows };
      } catch {
        return { ok: false };
      }
    },

    getCalculationDate: businessCalculationDate,
  };

  const runtime = await resolveWizardRuntimeConfigForDealer(tenantId, readers);

  // Final identity assertion: the configuration must describe the tenant the actor is authorized
  // for, and no other. A mismatch carries no configuration.
  if (runtime.ok && runtime.dealerId !== tenantId) {
    return { ok: false, reason: "no-dealer" };
  }
  return runtime;
}
