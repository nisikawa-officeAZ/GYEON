import "server-only";

import { firstLayerOptions } from "@/components/estimates/wizard/screens/coating-matrix";
import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { createClient } from "@/lib/supabase/server";
import { toPricingCatalogCoatingId } from "./wizard-coating-id-adapter";

export const PPF_COATING_ADJUSTMENT_SCOPES = ["front_full", "full_body"] as const;
export type PpfCoatingAdjustmentScope = (typeof PPF_COATING_ADJUSTMENT_SCOPES)[number];

export interface PpfCoatingAdjustmentProduct {
  readonly code: string;
  readonly label: string;
}

export interface PpfCoatingAdjustmentSettingRule {
  readonly ruleId: string;
  readonly scope: PpfCoatingAdjustmentScope;
  readonly coatingCode: string;
  readonly adjustmentType: "amount" | "percent";
  readonly adjustmentValue: number;
  readonly isActive: boolean;
}

export type PpfCoatingAdjustmentSettingsResult =
  | {
      readonly status: "READY";
      readonly rank: ShopRank;
      readonly canEdit: boolean;
      readonly products: readonly PpfCoatingAdjustmentProduct[];
      readonly rules: readonly PpfCoatingAdjustmentSettingRule[];
      readonly obsoleteRuleCount: number;
    }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "RANK_UNAVAILABLE" }
  | { readonly status: "COATING_UNAVAILABLE"; readonly rank: "ppf_installer" }
  | { readonly status: "READ_FAILED" };

const isScope = (value: unknown): value is PpfCoatingAdjustmentScope =>
  typeof value === "string"
  && (PPF_COATING_ADJUSTMENT_SCOPES as readonly string[]).includes(value);

function productsForRank(rank: ShopRank): PpfCoatingAdjustmentProduct[] {
  const products = firstLayerOptions(rank).flatMap((product) => {
    const code = toPricingCatalogCoatingId(product.id);
    return code ? [{ code, label: product.label }] : [];
  });
  const unique = [...new Map(products.map((product) => [product.code, product])).values()];
  return [
    ...unique.filter((product) => product.code !== "cancoat-evo"),
    ...unique.filter((product) => product.code === "cancoat-evo"),
  ];
}

/** Authenticated, RLS-scoped loader for the current dealer's two supported PPF coverage rules. */
export async function getPpfCoatingAdjustmentSettings(): Promise<PpfCoatingAdjustmentSettingsResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { status: "UNAUTHENTICATED" };

    const [rankResult, staff] = await Promise.all([
      getAuthoritativeShopRank(),
      getCurrentStaff(),
    ]);
    if (!rankResult.ok) return { status: "RANK_UNAVAILABLE" };
    if (rankResult.rank === "ppf_installer") {
      return { status: "COATING_UNAVAILABLE", rank: "ppf_installer" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("dealer_ppf_coating_adjustments")
      .select("id, dealer_id, ppf_method_code, coating_code, adjustment_type, adjustment_value, is_active, deleted_at")
      .eq("dealer_id", dealer.dealer_id)
      .is("deleted_at", null);
    if (error || !data) return { status: "READ_FAILED" };

    const rules: PpfCoatingAdjustmentSettingRule[] = [];
    let obsoleteRuleCount = 0;
    for (const row of data as Record<string, unknown>[]) {
      if (row.dealer_id !== dealer.dealer_id || row.deleted_at !== null) return { status: "READ_FAILED" };
      if (!isScope(row.ppf_method_code)) {
        obsoleteRuleCount += 1;
        continue;
      }
      if (
        typeof row.id !== "string"
        || typeof row.coating_code !== "string"
        || (row.adjustment_type !== "amount" && row.adjustment_type !== "percent")
        || typeof row.adjustment_value !== "number"
        || !Number.isInteger(row.adjustment_value)
        || row.adjustment_value < 0
        || typeof row.is_active !== "boolean"
      ) {
        return { status: "READ_FAILED" };
      }
      rules.push({
        ruleId: row.id,
        scope: row.ppf_method_code,
        coatingCode: row.coating_code,
        adjustmentType: row.adjustment_type,
        adjustmentValue: row.adjustment_value,
        isActive: row.is_active,
      });
    }

    return {
      status: "READY",
      rank: rankResult.rank,
      canEdit: staff?.role === "owner" || staff?.role === "manager",
      products: productsForRank(rankResult.rank),
      rules,
      obsoleteRuleCount,
    };
  } catch {
    return { status: "READ_FAILED" };
  }
}
