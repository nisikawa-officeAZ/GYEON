// C2C2 — Authoritative Wizard runtime configuration aggregate loader (SERVER ONLY).
//
// The single future-host-facing entry that resolves the complete, fail-closed runtime bundle a
// production EstimateWizardContainer host would need. It accepts NO dealer id, rank, lifecycle, or
// configuration from the client: dealer comes only from getCurrentDealer(), rank only from
// getAuthoritativeShopRank(), coating catalog only from getDealerPricingCatalog(), and the Wizard
// catalog + lifecycle only from authenticated, RLS-scoped Supabase reads. No app route or production
// component imports this yet — this phase establishes the boundary only.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { getDealerPricingCatalog } from "@/lib/pricing/get-dealer-pricing-catalog";
import {
  resolveWizardRuntimeConfig,
  type AuthoritativeWizardRuntimeConfiguration,
  type WizardCatalogRow,
  type WizardConfigReaders,
} from "./wizard-runtime-config";

export async function getAuthoritativeWizardRuntimeConfig(): Promise<AuthoritativeWizardRuntimeConfiguration> {
  const readers: WizardConfigReaders = {
    getDealer: getCurrentDealer,
    getRank: getAuthoritativeShopRank,
    getCatalog: getDealerPricingCatalog,

    getLifecycle: async (dealerId) => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("dealer_wizard_catalog_lifecycle")
        .select("state, current_configuration_revision, reviewed_configuration_revision, reviewed_at")
        .eq("dealer_id", dealerId)
        .maybeSingle();
      if (error) return { ok: false };
      return { ok: true, row: data ?? null };
    },

    getCatalogRows: async (_dealerId) => {
      const supabase = await createClient();
      // RLS returns global rows + THIS dealer's own rows only; filter to active/undeleted.
      const { data, error } = await supabase
        .from("wizard_catalog_items")
        .select(
          "id, market, product_mode, kind, owner_scope, dealer_id, code, label_ja, display_order, is_active, default_unit_price, priceable, quantity_required, min_quantity, max_quantity, ppf_type_group_id, duration_minutes, deleted_at, presentation, wizard_catalog_item_ranks(rank), wizard_catalog_item_categories(category_id)",
        )
        .eq("is_active", true)
        .is("deleted_at", null);
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
        ranks: ((d.wizard_catalog_item_ranks as { rank: string }[] | null) ?? []).map((x) => x.rank),
        categories: ((d.wizard_catalog_item_categories as { category_id: string }[] | null) ?? []).map((x) => x.category_id),
      }));
      return { ok: true, rows };
    },
  };

  return resolveWizardRuntimeConfig(readers);
}
