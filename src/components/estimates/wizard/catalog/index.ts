// Estimate Wizard Ver2.2 — Catalog projection layer barrel (Phase 10C).
// Read-only, deterministic projection of the production pricing catalog into a Wizard presentation
// model. No pricing execution, no screen dependency.

export type {
  WizardCatalogProjection, WizardCatalogCategory, WizardCatalogItem, WizardCatalogCategoryId,
  WizardPresentationMetadata, WizardPresentationItemMetadata,
  WizardCatalogWarning, WizardCatalogWarningCode, WizardCatalogError, WizardCatalogErrorCode,
} from "./wizard-catalog-types";
export { projectProductionCatalogToWizard } from "./project-production-catalog";
export { FIXTURE_PRESENTATION_METADATA } from "./wizard-catalog-fixtures";
export { compareWizardConfigToCatalog, type CatalogComparisonRow } from "./wizard-catalog-compare";
export { warn as catalogWarn, err as catalogErr } from "./wizard-catalog-errors";
