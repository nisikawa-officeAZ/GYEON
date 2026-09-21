import type { WizardPricingLineResult } from "./wizard-pricing-types";

/** Persistence identity shared by the review UI and save mapper. */
export function wizardPricingLineId(line: WizardPricingLineResult): string {
  return line.kind === "catalog"
    ? `catalog:${line.category}:${line.catalogLineRole}:${line.pricingReferenceId}`
    : `manual:${line.sourceId}`;
}

/**
 * Apply an operator-selected order without losing newly added lines.
 * Unknown/stale ids are ignored and lines absent from the preference are appended
 * in the authoritative pricing-engine order.
 */
export function orderByLineIds<T>(
  lines: readonly T[],
  requestedIds: readonly string[],
  idOf: (line: T) => string,
): T[] {
  if (requestedIds.length === 0) return [...lines];

  const byId = new Map(lines.map((line) => [idOf(line), line] as const));
  const used = new Set<string>();
  const ordered: T[] = [];

  for (const id of requestedIds) {
    if (used.has(id)) continue;
    const line = byId.get(id);
    if (line === undefined) continue;
    used.add(id);
    ordered.push(line);
  }
  for (const line of lines) {
    const id = idOf(line);
    if (used.has(id)) continue;
    used.add(id);
    ordered.push(line);
  }
  return ordered;
}

export function orderedWizardPricingLines(
  lines: readonly WizardPricingLineResult[],
  requestedIds: readonly string[],
): WizardPricingLineResult[] {
  return orderByLineIds(lines, requestedIds, wizardPricingLineId);
}
