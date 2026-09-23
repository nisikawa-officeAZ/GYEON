import type { EstimateWizardSettingsView, WizardSettingsSectionId } from "@/lib/wizard-catalog/estimate-wizard-settings-types";

export type WizardAccessBadgeVariant = "solid_active" | "solid_unset";

/**
 * The hub badge describes whether the dealer currently has at least one active,
 * non-deleted item in the section. The server-built view already owns that count;
 * the client must not replace it with a hard-coded status.
 */
export function wizardSectionBadge(
  view: Pick<EstimateWizardSettingsView, "sections">,
  sectionId: WizardSettingsSectionId,
): WizardAccessBadgeVariant {
  const section = view.sections.find((candidate) => candidate.id === sectionId);
  return section !== undefined && section.itemCount > 0 ? "solid_active" : "solid_unset";
}
