import "server-only";

import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { createClient } from "@/lib/supabase/server";
import {
  projectLegacyWindowFilmV1Draft,
  resolveStoredWindowFilmV1,
} from "./window-film-v1-persisted-payload";
import type { WindowFilmSettingsV1 } from "./window-film-v1-contract";
import type { WindowFilmTypeReadSetting } from "./window-film-type-contract";

export type AuthoritativeWindowFilmV1ReadResult =
  | { status: "READY"; settings: WindowFilmSettingsV1; films: WindowFilmTypeReadSetting[] }
  | { status: "LEGACY_REVIEW_REQUIRED"; draft: WindowFilmSettingsV1 | null; films: WindowFilmTypeReadSetting[] }
  | { status: "NOT_CONFIGURED"; films: WindowFilmTypeReadSetting[] }
  | { status: "MALFORMED" | "UNAUTHENTICATED" | "READ_FAILED" };

function optionalPercent(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : null;
}

/** Authenticated, RLS-scoped read of the V1 settings and this dealer's film catalog only. */
export async function getAuthoritativeWindowFilmV1Settings(): Promise<AuthoritativeWindowFilmV1ReadResult> {
  try {
    const dealer = await getCurrentDealer();
    if (!dealer) return { status: "UNAUTHENTICATED" };
    const supabase = await createClient();
    const [{ data: settingsRow, error: settingsError }, { data: filmRows, error: filmError }] = await Promise.all([
      supabase
        .from("dealer_settings")
        .select("service_price_settings")
        .eq("dealer_id", dealer.dealer_id)
        .maybeSingle(),
      supabase
        .from("wizard_catalog_items")
        .select("id, code, label_ja, display_order, is_active, deleted_at, presentation, install_coefficient_bp, updated_at")
        .eq("dealer_id", dealer.dealer_id)
        .eq("owner_scope", "dealer")
        .eq("kind", "film_type")
        .is("deleted_at", null)
        .order("display_order", { ascending: true }),
    ]);
    if (settingsError || filmError || !filmRows) return { status: "READ_FAILED" };

    const films: WindowFilmTypeReadSetting[] = filmRows.map((row) => {
      const presentation = row.presentation !== null && typeof row.presentation === "object" && !Array.isArray(row.presentation)
        ? row.presentation as Record<string, unknown>
        : {};
      return {
        itemId: row.id,
        code: row.code,
        name: row.label_ja ?? row.code,
        installationCoefficientBp: row.install_coefficient_bp,
        irCutPercent: optionalPercent(presentation.irCutPercent),
        uvCutPercent: optionalPercent(presentation.uvCutPercent),
        isActive: row.is_active === true,
        displayOrder: Number(row.display_order ?? 0),
        expectedUpdatedAt: row.updated_at ?? null,
      };
    });
    if (films.some((film) =>
      typeof film.itemId !== "string"
      || typeof film.code !== "string"
      || typeof film.name !== "string"
      || film.name.trim() === ""
      || (film.installationCoefficientBp !== null
        && (!Number.isInteger(film.installationCoefficientBp)
          || film.installationCoefficientBp < 1_000
          || film.installationCoefficientBp > 50_000))
      || !Number.isInteger(film.displayOrder)
      || film.displayOrder < 0
      || typeof film.expectedUpdatedAt !== "string"
      || Number.isNaN(Date.parse(film.expectedUpdatedAt))
    )) return { status: "MALFORMED" };
    const activeFilmNames = films
      .filter((film) => film.isActive)
      .map((film) => film.name.trim().toLowerCase());
    if (films.some((film) => film.name !== film.name.trim())
      || new Set(activeFilmNames).size !== activeFilmNames.length
      || new Set(films.map((film) => film.code)).size !== films.length
      || new Set(films.map((film) => film.itemId)).size !== films.length
      || new Set(films.map((film) => film.displayOrder)).size !== films.length) return { status: "MALFORMED" };

    const stored = resolveStoredWindowFilmV1(settingsRow?.service_price_settings ?? null);
    if (stored.status === "V1_READY") return { status: "READY", settings: stored.settings, films };
    if (stored.status === "LEGACY_REVIEW_REQUIRED") {
      return {
        status: "LEGACY_REVIEW_REQUIRED",
        draft: projectLegacyWindowFilmV1Draft(stored.legacy),
        films,
      };
    }
    if (stored.status === "NOT_CONFIGURED") return { status: "NOT_CONFIGURED", films };
    return { status: "MALFORMED" };
  } catch {
    return { status: "READ_FAILED" };
  }
}
