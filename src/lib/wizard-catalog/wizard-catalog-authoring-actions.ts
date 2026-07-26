"use server";

// C2C3 — Wizard catalog authoring/review SERVER ACTIONS.
//
// Thin wrappers over the pure DI core. Each action: resolves the dealer ONLY from
// getCurrentDealer(); checks the owner|manager capability via getCurrentStaff();
// never accepts dealer_id (or any tenancy/identity) from the caller; injects the
// authoritative dealer id into the SECURITY DEFINER RPC through the user-scoped,
// RLS-authenticated Supabase client; and returns a stable typed result. No raw DB
// or exception text is surfaced, no service_role client is used, and no Wizard is
// mounted. Only the settings path is revalidated on success.

import { createClient } from "@/lib/supabase/server";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { getCurrentStaff } from "@/lib/staff/get-current-staff";
import { getAuthoritativeShopRank } from "@/lib/dealer-settings/get-authoritative-shop-rank";
import { revalidatePath } from "next/cache";
import type { DealerStaffRole } from "@/lib/staff/staff-types";
import {
  runSaveCatalogItem,
  runArchiveCatalogItem,
  runConfirmCatalogReview,
  runSavePpfCoatingAdjustment,
  runArchivePpfCoatingAdjustment,
  buildUpsertPayload,
} from "./wizard-catalog-authoring-core";
import type {
  WizardCatalogItemInput,
  WizardCatalogUpsertResult,
  WizardCatalogArchiveResult,
  WizardCatalogReviewResult,
  PpfCoatingAdjustmentInput,
  PpfCoatingAdjustmentUpsertResult,
  PpfCoatingAdjustmentArchiveResult,
} from "./wizard-catalog-authoring-types";

const SETTINGS_PATH = "/settings";

async function getDealer(): Promise<{ dealer_id: string } | null> {
  const dealer = await getCurrentDealer();
  return dealer ? { dealer_id: dealer.dealer_id } : null;
}

async function getStaffRole(): Promise<DealerStaffRole | null> {
  const staff = await getCurrentStaff();
  return staff?.role ?? null;
}

interface RpcEnvelope {
  ok?: boolean;
  item_id?: string;
  code?: string;
  kind?: string;
  action?: string;
  reviewed_revision?: number;
  /** B1.1-B7 — returned by the PPF+coating adjustment RPCs. */
  rule_id?: string;
}

/** Create or update a dealer-owned Wizard catalog item. */
export async function saveWizardCatalogItem(
  input: WizardCatalogItemInput,
): Promise<WizardCatalogUpsertResult> {
  const result = await runSaveCatalogItem(
    {
      getDealer,
      getStaffRole,
      upsert: async (dealerId, inp) => {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.rpc("wiz_upsert_catalog_item", {
            p_expected_dealer: dealerId,
            p_item_id: inp.itemId ?? null,
            p_kind: inp.kind,
            p_payload: buildUpsertPayload(inp),
          });
          const env = data as RpcEnvelope | null;
          if (error || !env?.ok || !env.item_id) {
            console.error("[saveWizardCatalogItem] rpc failed:", error?.message);
            return { ok: false };
          }
          return {
            ok: true,
            itemId: env.item_id,
            code: env.code ?? "",
            kind: env.kind ?? inp.kind,
            action: env.action === "updated" ? "updated" : "created",
          };
        } catch (err) {
          console.error("[saveWizardCatalogItem] threw:", err instanceof Error ? err.message : err);
          return { ok: false };
        }
      },
    },
    input,
  );
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}

/** Soft-archive a dealer-owned Wizard catalog item (never hard-deletes). */
export async function archiveWizardCatalogItem(
  itemId: string,
): Promise<WizardCatalogArchiveResult> {
  const result = await runArchiveCatalogItem(
    {
      getDealer,
      getStaffRole,
      archive: async (dealerId, id) => {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.rpc("wiz_archive_catalog_item", {
            p_expected_dealer: dealerId,
            p_item_id: id,
          });
          const env = data as RpcEnvelope | null;
          if (error || !env?.ok || !env.item_id) {
            console.error("[archiveWizardCatalogItem] rpc failed:", error?.message);
            return { ok: false };
          }
          return {
            ok: true,
            itemId: env.item_id,
            action: env.action === "already_archived" ? "already_archived" : "archived",
          };
        } catch (err) {
          console.error("[archiveWizardCatalogItem] threw:", err instanceof Error ? err.message : err);
          return { ok: false };
        }
      },
    },
    itemId,
  );
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}

/**
 * Create or update a dealer-scoped PPF + coating reduction rule (B1.1).
 *
 * B1.1-B7: writes go through the SECURITY DEFINER RPC, never direct table DML. `authenticated`
 * holds SELECT only on this table, so the RPC is the sole write path and
 * `wiz_can_configure(p_expected_dealer)` inside it is the enforcing authority. The dealer id is
 * the server-resolved one and is never taken from the caller — it is an assertion the RPC
 * re-verifies, exactly as the catalog RPCs do.
 */
export async function saveDealerPpfCoatingAdjustment(
  input: PpfCoatingAdjustmentInput,
): Promise<PpfCoatingAdjustmentUpsertResult> {
  const result = await runSavePpfCoatingAdjustment(
    {
      getDealer,
      getStaffRole,
      upsertAdjustment: async (dealerId, inp) => {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.rpc("wiz_upsert_ppf_coating_adjustment", {
            p_expected_dealer: dealerId,
            p_rule_id: inp.ruleId ?? null,
            // Only the payload keys the RPC allowlists. `dealer_id` is absent by construction.
            p_payload: {
              ppf_method_code: inp.ppfMethodCode,
              coating_code: inp.coatingCode,
              adjustment_type: inp.adjustmentType,
              adjustment_value: inp.adjustmentValue,
              is_active: inp.isActive ?? true,
            },
          });
          const env = data as RpcEnvelope | null;
          if (error || !env?.ok || !env.rule_id) {
            console.error("[saveDealerPpfCoatingAdjustment] rpc failed:", error?.message);
            return { ok: false };
          }
          return { ok: true, ruleId: env.rule_id, action: env.action === "updated" ? "updated" : "created" };
        } catch (err) {
          console.error("[saveDealerPpfCoatingAdjustment] threw:", err instanceof Error ? err.message : err);
          return { ok: false };
        }
      },
    },
    input,
  );
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}

/** Soft-archive a PPF + coating reduction rule (never hard-deletes: no DELETE policy or grant). */
export async function archiveDealerPpfCoatingAdjustment(
  ruleId: string,
): Promise<PpfCoatingAdjustmentArchiveResult> {
  const result = await runArchivePpfCoatingAdjustment(
    {
      getDealer,
      getStaffRole,
      archiveAdjustment: async (dealerId, id) => {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase.rpc("wiz_archive_ppf_coating_adjustment", {
            p_expected_dealer: dealerId,
            p_rule_id: id,
          });
          const env = data as RpcEnvelope | null;
          if (error || !env?.ok || !env.rule_id) {
            console.error("[archiveDealerPpfCoatingAdjustment] rpc failed:", error?.message);
            return { ok: false };
          }
          // The RPC — not this action — decides idempotency: an already-archived row performs no
          // write and reports `already_archived`.
          return {
            ok: true,
            ruleId: env.rule_id,
            action: env.action === "already_archived" ? "already_archived" : "archived",
          };
        } catch (err) {
          console.error("[archiveDealerPpfCoatingAdjustment] threw:", err instanceof Error ? err.message : err);
          return { ok: false };
        }
      },
    },
    ruleId,
  );
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}

/** Confirm the current catalog configuration as reviewed (never activates). */
export async function confirmWizardCatalogReview(): Promise<WizardCatalogReviewResult> {
  const result = await runConfirmCatalogReview({
    getDealer,
    getStaffRole,
    getRank: getAuthoritativeShopRank,
    confirm: async (dealerId) => {
      try {
        const supabase = await createClient();
        // Rank is NOT sent — the RPC resolves it authoritatively from the database.
        const { data, error } = await supabase.rpc("wiz_confirm_catalog_review", {
          p_expected_dealer: dealerId,
        });
        const env = data as RpcEnvelope | null;
        if (error || !env?.ok || typeof env.reviewed_revision !== "number") {
          console.error("[confirmWizardCatalogReview] rpc failed:", error?.message);
          return { ok: false };
        }
        return { ok: true, reviewedRevision: env.reviewed_revision };
      } catch (err) {
        console.error("[confirmWizardCatalogReview] threw:", err instanceof Error ? err.message : err);
        return { ok: false };
      }
    },
  });
  if (result.ok) revalidatePath(SETTINGS_PATH);
  return result;
}
