// GYEON-PARTNER-ONBOARD-F1 — the server-only feature gate.
//
// Run: node --import tsx --test src/lib/gyeon/partner-onboarding-enabled.test.ts
//
// Behavioral proofs (the module reads process.env at CALL time, so the gate is
// directly executable here) plus source-boundary pins that forbid every
// contract-rejected authorization source.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isGyeonPartnerOnboardingEnabled,
  GYEON_PARTNER_ONBOARDING_ENV_VAR,
} from "./partner-onboarding-enabled";

const SRC = "src/lib/gyeon/partner-onboarding-enabled.ts";
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.GYEON_PARTNER_ONBOARDING_ENABLED;
  if (value === undefined) delete process.env.GYEON_PARTNER_ONBOARDING_ENABLED;
  else process.env.GYEON_PARTNER_ONBOARDING_ENABLED = value;
  try { fn(); } finally {
    if (prev === undefined) delete process.env.GYEON_PARTNER_ONBOARDING_ENABLED;
    else process.env.GYEON_PARTNER_ONBOARDING_ENABLED = prev;
  }
}

test("1. enabled ONLY for the exact string 'true'", () => {
  withEnv("true", () => assert.equal(isGyeonPartnerOnboardingEnabled(), true));
});

test("2. every other value disables: missing, empty, false, TRUE, 1, yes, ' true'", () => {
  for (const v of [undefined, "", "false", "TRUE", "True", "1", "yes", " true", "true "]) {
    withEnv(v, () => {
      assert.equal(isGyeonPartnerOnboardingEnabled(), false, `value ${JSON.stringify(v)} must disable`);
    });
  }
});

test("3. the variable name is the exported constant and is NOT NEXT_PUBLIC", () => {
  assert.equal(GYEON_PARTNER_ONBOARDING_ENV_VAR, "GYEON_PARTNER_ONBOARDING_ENABLED");
  assert.equal(GYEON_PARTNER_ONBOARDING_ENV_VAR.startsWith("NEXT_PUBLIC"), false);
});

test("4. source boundary: server-only construction, strict equality, no other env", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  assert.equal(code.includes('"use client"'), false, "never a client module");
  assert.match(code, /process\.env\.GYEON_PARTNER_ONBOARDING_ENABLED === "true"/,
    "strict string equality against exactly 'true'");
  const envReads = code.match(/process\.env\.[A-Z_]+/g) ?? [];
  assert.deepEqual([...new Set(envReads)], ["process.env.GYEON_PARTNER_ONBOARDING_ENABLED"],
    "reads exactly one environment variable");
});

test("5. contract-rejected authorization sources never appear", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  for (const forbidden of [
    "DEALEROS_MARKET",
    "getActiveMarket",
    "getActiveProfile",
    "NEXT_PUBLIC",
    "APP_BRAND_VARIANT",
    "market-profiles",
    "brand/variant",
    "hostname",
    "location",
  ]) {
    assert.equal(code.includes(forbidden), false, `forbidden authorization source: ${forbidden}`);
  }
});

test("6. F2-09: ENFORCED server-only boundary — client evaluation throws at module load", () => {
  const code = strip(readFileSync(SRC, "utf8"));
  const guardAt = code.indexOf('typeof window !== "undefined"');
  const throwAt = code.indexOf("throw new Error(");
  const exportAt = code.indexOf("export ");
  assert.ok(guardAt >= 0 && throwAt >= 0 && exportAt >= 0);
  assert.ok(guardAt < exportAt && throwAt < exportAt,
    "the load-time guard precedes every export — a client bundle cannot read the gate");
  // And the boundary does not break server/test execution (this very test file
  // imported the module at the top and ran the behavioral cases above).
});
