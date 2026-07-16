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
  buildUpsertPayload,
} from "./wizard-catalog-authoring-core";
import type {
  WizardCatalogItemInput,
  WizardCatalogUpsertResult,
  WizardCatalogArchiveResult,
  WizardCatalogReviewResult,
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
