// DealerOS — AI Settings Platform: Usage Repository (Sprint 11R Phase A)
//
// Supabase-backed implementation of AIUsageRepository.
//
// Reads from dealer_ai_usage_log (migration 073 — CTO approval required).
// Handles table-not-found gracefully: returns 0 spend and empty summary
// with table_available: false, so upstream budget enforcement returns 0
// until the migration is applied.
//
// "use server" is not declared here — consumed by server actions.

import { createClient }  from "@/lib/supabase/server";
import type { AIProviderId } from "@/lib/ai/types";
import type { AICapability } from "@/lib/ai/capabilities";
import type {
  AIUsageRepository,
  AIUsageSummaryResult,
} from "./repository-types";

const PG_UNDEFINED_TABLE = "42P01";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodToDateRange(period: string): { start: string; end: string } {
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);
  return {
    start: start.toISOString(),
    end:   end.toISOString(),
  };
}

// ─── getMonthlySpend ──────────────────────────────────────────────────────────

async function getMonthlySpend(dealer_id: string, period: string): Promise<number> {
  const supabase = await createClient();
  const { start, end } = periodToDateRange(period);

  try {
    const { data, error } = await supabase
      .from("dealer_ai_usage_log")
      .select("estimated_cost_usd")
      .eq("dealer_id", dealer_id)
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      if (error.code === PG_UNDEFINED_TABLE || error.message?.includes("dealer_ai_usage_log")) {
        return 0;
      }
      return 0;
    }

    if (!data || data.length === 0) return 0;

    return data.reduce((sum, row) => {
      const cost = typeof row.estimated_cost_usd === "number" ? row.estimated_cost_usd : 0;
      return sum + cost;
    }, 0);
  } catch {
    return 0;
  }
}

// ─── getSummary ───────────────────────────────────────────────────────────────

async function getSummary(
  dealer_id: string,
  period:    string,
): Promise<AIUsageSummaryResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { start, end } = periodToDateRange(period);

  const empty: AIUsageSummaryResult = {
    dealer_id,
    period,
    total_tokens:       0,
    estimated_cost_usd: 0,
    current_month_usd:  0,
    row_count:          0,
    by_provider:        {},
    by_capability:      {},
    table_available:    false,
    loaded_at:          now,
  };

  try {
    const { data, error } = await supabase
      .from("dealer_ai_usage_log")
      .select(
        "provider, capability, total_tokens, estimated_cost_usd, execution_status",
      )
      .eq("dealer_id", dealer_id)
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      if (error.code === PG_UNDEFINED_TABLE || error.message?.includes("dealer_ai_usage_log")) {
        return { ...empty, table_available: false };
      }
      return empty;
    }

    if (!data || data.length === 0) {
      return { ...empty, table_available: true };
    }

    const byProvider: AIUsageSummaryResult["by_provider"]   = {};
    const byCapability: AIUsageSummaryResult["by_capability"] = {};

    let totalTokens  = 0;
    let totalCostUsd = 0;

    for (const row of data) {
      const tokens = typeof row.total_tokens       === "number" ? row.total_tokens       : 0;
      const cost   = typeof row.estimated_cost_usd === "number" ? row.estimated_cost_usd : 0;

      totalTokens  += tokens;
      totalCostUsd += cost;

      if (row.provider) {
        const pid = row.provider as AIProviderId;
        const existing = byProvider[pid] ?? { tokens: 0, cost_usd: 0 };
        byProvider[pid] = {
          tokens:   existing.tokens   + tokens,
          cost_usd: existing.cost_usd + cost,
        };
      }

      if (row.capability) {
        const cap = row.capability as AICapability;
        const existing = byCapability[cap] ?? { tokens: 0, cost_usd: 0 };
        byCapability[cap] = {
          tokens:   existing.tokens   + tokens,
          cost_usd: existing.cost_usd + cost,
        };
      }
    }

    return {
      dealer_id,
      period,
      total_tokens:       totalTokens,
      estimated_cost_usd: totalCostUsd,
      current_month_usd:  period === currentPeriod() ? totalCostUsd : 0,
      row_count:          data.length,
      by_provider:        byProvider,
      by_capability:      byCapability,
      table_available:    true,
      loaded_at:          now,
    };
  } catch {
    return empty;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createSupabaseAIUsageRepository(): AIUsageRepository {
  return {
    getMonthlySpend,
    getSummary,
  };
}
