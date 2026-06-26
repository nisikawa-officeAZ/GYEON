"use server";

// Thin delegation wrapper — preserves all existing import paths.
// Business logic lives in src/lib/subscription/subscription.ts.

import { checkFeatureAccess as _checkFeatureAccess } from "@/lib/subscription/subscription";
import { AppFeature } from "@/lib/plans/plan-types";

export async function checkFeatureAccess(feature: AppFeature): Promise<boolean> {
  return _checkFeatureAccess(feature);
}
