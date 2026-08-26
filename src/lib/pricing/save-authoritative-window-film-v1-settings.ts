"use server";

import "server-only";

import { requireRole } from "@/lib/staff/require-role";
import { createClient } from "@/lib/supabase/server";
import { parseWindowFilmSettingsV1, type WindowFilmSettingsV1 } from "./window-film-v1-contract";
import { parseWindowFilmTypes, type WindowFilmTypeSetting } from "./window-film-type-contract";

export type AuthoritativeWindowFilmV1SaveResult =
  | { status: "SAVED"; settings: WindowFilmSettingsV1; films: WindowFilmTypeSetting[] }
  | { status: "INVALID_PAYLOAD" | "UNAUTHORIZED" | "REVISION_CONFLICT" | "SAVE_FAILED" };

export async function saveAuthoritativeWindowFilmV1Settings(
  settings: unknown,
  films: unknown,
  expectedRevision: number,
): Promise<AuthoritativeWindowFilmV1SaveResult> {
  let parsedSettings: WindowFilmSettingsV1;
  let parsedFilms: WindowFilmTypeSetting[];
  try {
    parsedSettings = parseWindowFilmSettingsV1(settings);
    parsedFilms = parseWindowFilmTypes(films);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || parsedSettings.revision !== expectedRevision) {
      return { status: "INVALID_PAYLOAD" };
    }
  } catch {
    return { status: "INVALID_PAYLOAD" };
  }

  let dealerId: string;
  try {
    ({ dealerId } = await requireRole(["owner", "manager"]));
  } catch {
    return { status: "UNAUTHORIZED" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_window_film_v1_settings", {
      p_dealer_id: dealerId,
      p_settings: parsedSettings,
      p_films: parsedFilms,
      p_expected_revision: expectedRevision,
    });
    if (error) {
      return error.message.includes("window_film_v1_revision_conflict")
        ? { status: "REVISION_CONFLICT" }
        : { status: "SAVE_FAILED" };
    }
    if (data === null || typeof data !== "object" || Array.isArray(data)) return { status: "SAVE_FAILED" };
    const saved = data as Record<string, unknown>;
    return {
      status: "SAVED",
      settings: parseWindowFilmSettingsV1(saved.settings),
      films: parseWindowFilmTypes(saved.films),
    };
  } catch {
    return { status: "SAVE_FAILED" };
  }
}
