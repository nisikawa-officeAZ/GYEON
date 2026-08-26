import type { WizardScreenConfiguration } from "../contract/wizard-runtime-inputs";
import type { WizardWindowFilmDraft } from "../draft/wizard-draft-types";
import { resolveWindowFilmV1Price } from "@/lib/pricing/window-film-v1-price-resolution";

export function isWindowFilmV1RuntimeReady(
  screenConfig: WizardScreenConfiguration,
): boolean {
  const settings = screenConfig.windowFilmSettings;
  if (!settings) return false;
  const hasValidFilm = screenConfig.filmTypes.some((film) =>
    !film.disabled
    && Number.isSafeInteger(film.installationCoefficientBp)
    && film.installationCoefficientBp! >= 1_000
    && film.installationCoefficientBp! <= 50_000,
  );
  const hasActiveArea = Object.values(settings.areas).some((area) =>
    area.isActive && area.priceYen !== null && area.durationMinutes !== null,
  );
  const hasActivePackage = settings.packages.some((item) =>
    item.isActive && item.priceYen !== null && item.durationMinutes !== null,
  );
  return hasValidFilm && (hasActiveArea || hasActivePackage);
}

/**
 * Return the canonical draft value to write when an automatic suggestion changes.
 * `null` means the operator entered a manual override and no write is allowed.
 */
export function reconcileWindowFilmUnitPriceInput(
  currentInput: string,
  previousSuggestedInput: string | null,
  nextSuggestedInput: string | null,
): string | null {
  const currentIsAutomatic = currentInput.trim() === ""
    || (previousSuggestedInput !== null && currentInput === previousSuggestedInput);
  if (!currentIsAutomatic) return null;
  return nextSuggestedInput ?? "";
}

/** Pure display projection of the same authoritative resolver used by final pricing. */
export function windowFilmV1SuggestedUnitPrice(
  screenConfig: WizardScreenConfiguration,
  draft: WizardWindowFilmDraft,
): number | null {
  const settings = screenConfig.windowFilmSettings;
  const film = screenConfig.filmTypes.find((entry) => entry.id === draft.filmTypeId);
  if (!settings || !film?.installationCoefficientBp) return null;
  const selectedOptions = draft.selectedOptionIds ?? [];
  const result = resolveWindowFilmV1Price(
    settings,
    {
      areaCodes: draft.selectedAreaIds,
      packageCode: draft.selectedPackageCode ?? null,
      options: selectedOptions.map((code) => ({
        code,
        quantity: draft.optionQuantities?.[code] ?? 1,
      })),
    },
    film.installationCoefficientBp,
  );
  return result.ok ? result.totalPriceYen : null;
}
