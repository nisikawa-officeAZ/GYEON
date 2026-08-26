import "server-only";

import type { ShopRank } from "@/components/estimates/wizard/screens/step-types";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { createClient } from "@/lib/supabase/server";
import {
  GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE,
  GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE,
} from "@/lib/wizard-catalog/ppf-coating-adjustment-core";

export interface PpfCoatingAdjustmentSettingRule {
  readonly ruleId: string;
  readonly adjustmentType: "amount" | "percent";
  readonly adjustmentValue: number;
  readonly isActive: boolean;
}

export type PpfCoatingAdjustmentSettingsResult =
  | {
      readonly status: "READY";
      readonly rank: ShopRank;
      readonly canEdit: boolean;
      readonly rule: PpfCoatingAdjustmentSettingRule | null;
      readonly obsoleteRuleCount: number;
    }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "RANK_UNAVAILABLE" }
  | { readonly status: "COATING_UNAVAILABLE"; readonly rank: "ppf_installer" }
  | { readonly status: "READ_FAILED" };

/** Authenticated, RLS-scoped loader for the current dealer's single combination-discount rule. */
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

    let rule: PpfCoatingAdjustmentSettingRule | null = null;
    let obsoleteRuleCount = 0;
    for (const row of data as Record<string, unknown>[]) {
      if (row.dealer_id !== dealer.dealer_id || row.deleted_at !== null) return { status: "READ_FAILED" };
      const isGlobal =
        row.ppf_method_code === GLOBAL_PPF_COATING_ADJUSTMENT_METHOD_CODE
        && row.coating_code === GLOBAL_PPF_COATING_ADJUSTMENT_COATING_CODE;
      if (!isGlobal) {
        obsoleteRuleCount += 1;
        continue;
      }
      if (
        rule !== null
        || typeof row.id !== "string"
        || (row.adjustment_type !== "amount" && row.adjustment_type !== "percent")
        || typeof row.adjustment_value !== "number"
        || !Number.isInteger(row.adjustment_value)
        || row.adjustment_value < 0
        || typeof row.is_active !== "boolean"
      ) {
        return { status: "READ_FAILED" };
      }
      rule = {
        ruleId: row.id,
        adjustmentType: row.adjustment_type,
        adjustmentValue: row.adjustment_value,
        isActive: row.is_active,
      };
    }

    return {
      status: "READY",
      rank: rankResult.rank,
      canEdit: staff?.role === "owner" || staff?.role === "manager",
      rule,
      obsoleteRuleCount,
    };
  } catch {
    return { status: "READ_FAILED" };
  }
}
