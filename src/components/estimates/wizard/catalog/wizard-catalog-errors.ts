// Estimate Wizard Ver2.2 — Catalog projection warning/error factories (Phase 10C).
//
// Stable, UI-safe warning/error constructors (no stack traces, no PII). Pure helpers only.

import type {
  WizardCatalogWarning, WizardCatalogWarningCode,
  WizardCatalogError, WizardCatalogErrorCode, WizardCatalogCategoryId,
} from "./wizard-catalog-types";

export function warn(
  code: WizardCatalogWarningCode,
  message: string,
  sourceId: string | null = null,
  category: WizardCatalogCategoryId | null = null,
): WizardCatalogWarning {
  return { code, sourceId, category, message };
}

export function err(
  code: WizardCatalogErrorCode,
  message: string,
  sourceId: string | null = null,
  category: WizardCatalogCategoryId | null = null,
): WizardCatalogError {
  return { code, sourceId, category, message };
}
