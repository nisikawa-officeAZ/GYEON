"use server";

import { getCurrentPlan } from "./get-current-plan";
import { AppFeature, canUseFeature } from "./plan-types";

/**
 * Server-side feature gate check.
 * Fetches the dealer's plan from DB and checks against the feature matrix.
 */
export async function checkFeatureAccess(feature: AppFeature): Promise<boolean> {
  const { plan } = await getCurrentPlan();
  return canUseFeature(plan, feature);
}
