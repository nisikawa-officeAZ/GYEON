// GYEON partner onboarding — the ONE server-side feature gate.
//
// Authorization rule (locked by GYEON-PARTNER-ONBOARD-F1):
//   The feature is enabled ONLY when the server-only environment variable
//   GYEON_PARTNER_ONBOARDING_ENABLED is EXACTLY the string "true".
//   Missing, empty, "false", "TRUE", "1", or any other value → disabled.
//
// Server-only by construction:
//   * The variable name has NO NEXT_PUBLIC_ prefix, so Next.js never inlines
//     its value into any client bundle. If this module is ever evaluated in a
//     client context, process.env.GYEON_PARTNER_ONBOARDING_ENABLED is
//     undefined and the gate reads DISABLED — fail closed.
//   * Every provisioning entry point (CSV import, single create, invite,
//     resend, reconcile, revoke, claim, profile completion) must call this
//     gate BEFORE any access to gyeon_dealer_provisioning.
//
// Explicitly NOT authorization sources for this feature (contract-rejected):
// DEALEROS_MARKET / getActiveMarket, NEXT_PUBLIC_APP_BRAND_VARIANT or any
// brand identity value, any NEXT_PUBLIC_* variable, and the presence or
// absence of a database table. SaaS deployments simply leave the variable
// unset (or "false").

// F2-09: ENFORCED server-only boundary. If a client bundle ever evaluates this
// module, it throws at load time instead of silently reading undefined. (The
// repo has no `server-only` package dependency; this runtime guard is the
// dependency-free equivalent and keeps the module executable under node:test.)
if (typeof window !== "undefined") {
  throw new Error(
    "partner-onboarding-enabled is server-only and must never be imported into client code.",
  );
}

export const GYEON_PARTNER_ONBOARDING_ENV_VAR = "GYEON_PARTNER_ONBOARDING_ENABLED";

export function isGyeonPartnerOnboardingEnabled(): boolean {
  return process.env.GYEON_PARTNER_ONBOARDING_ENABLED === "true";
}
