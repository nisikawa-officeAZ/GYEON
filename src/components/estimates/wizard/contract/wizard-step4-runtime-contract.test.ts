// EW-UI-3B — Step-4 runtime-contract tests: row-ID authority + shared runtime-input relocation.
// Run: node --import tsx --test src/components/estimates/wizard/contract/wizard-step4-runtime-contract.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createWizardRowId, type WizardRowIdCryptoSource } from "./wizard-row-id";
import type { WizardRuntimeInputs, WizardScreenConfiguration } from "./wizard-runtime-inputs";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// valid RFC 4122 v4 fixtures (version nibble 4; variant nibble 8|9|a|b)
const NATIVE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DUP = "11111111-1111-4111-8111-111111111111";
const UNIQUE = "22222222-2222-4222-9222-222222222222";

const fillFF = (arr: Uint8Array): Uint8Array => {
  arr.fill(0xff);
  return arr;
};

// Web Crypto methods that throw — used to prove createWizardRowId fails closed (never propagates).
const throwUUID = (): string => {
  throw new Error("randomUUID unavailable");
};
const throwGetRandomValues = (_arr: Uint8Array): Uint8Array => {
  throw new Error("getRandomValues unavailable");
};

// strip block + line comments so prose that MENTIONS forbidden tokens is not matched — code only.
const codeOf = (path: string): string =>
  readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const ROW_ID_SRC = "src/components/estimates/wizard/contract/wizard-row-id.ts";
const RUNTIME_INPUTS_SRC = "src/components/estimates/wizard/contract/wizard-runtime-inputs.ts";
const RUNTIME_CONFIG_SRC = "src/lib/wizard-catalog/wizard-runtime-config.ts";
const CONTAINER_SRC = "src/components/estimates/wizard/production/EstimateWizardContainer.tsx";

// ── Row-ID authority ────────────────────────────────────────────────────────────

test("1. native randomUUID path yields a prefixed, valid v4 id", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => NATIVE };
  const id = createWizardRowId("ppfInterior", [], src);
  assert.equal(id, `ppf-${NATIVE}`);
  assert.ok(UUID_V4_RE.test(id!.slice("ppf-".length)));
});

test("2. getRandomValues fallback produces correct v4 version + variant bits", () => {
  const src: WizardRowIdCryptoSource = { getRandomValues: fillFF }; // no randomUUID
  const id = createWizardRowId("otherWork", [], src);
  assert.ok(id, "expected an id");
  const uuid = id!.slice("ow-".length);
  assert.ok(UUID_V4_RE.test(uuid), `not v4: ${uuid}`);
  assert.equal(uuid[14], "4", "version nibble must be 4");
  assert.ok(["8", "9", "a", "b"].includes(uuid[19]), "variant nibble must be 8|9|a|b");
});

test("3. the two row kinds use distinct prefixes", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => NATIVE };
  assert.equal(createWizardRowId("ppfInterior", [], src)!.startsWith("ppf-"), true);
  assert.equal(createWizardRowId("otherWork", [], src)!.startsWith("ow-"), true);
  // and the two full ids differ by prefix for the same uuid
  assert.notEqual(createWizardRowId("ppfInterior", [], src), createWizardRowId("otherWork", [], src));
});

test("4. an existing-id collision triggers a retry", () => {
  let calls = 0;
  const src: WizardRowIdCryptoSource = { randomUUID: () => (calls++ === 0 ? DUP : UNIQUE) };
  const id = createWizardRowId("ppfInterior", [`ppf-${DUP}`], src);
  assert.equal(id, `ppf-${UNIQUE}`);
  assert.equal(calls, 2, "should have retried exactly once past the collision");
});

test("5. repeated collision fails closed (null)", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => DUP };
  assert.equal(createWizardRowId("otherWork", [`ow-${DUP}`], src), null);
});

test("6. missing crypto fails closed (null)", () => {
  // an empty source has neither randomUUID nor getRandomValues → fail closed
  assert.equal(createWizardRowId("ppfInterior", [], {}), null);
});

test("7. malformed native UUID fails closed with no fallback available", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => "not-a-uuid" };
  assert.equal(createWizardRowId("ppfInterior", [], src), null);
});

test("7b. malformed native UUID falls back to getRandomValues within the bounded policy", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => "not-a-uuid", getRandomValues: fillFF };
  const id = createWizardRowId("ppfInterior", [], src);
  assert.ok(id && UUID_V4_RE.test(id.slice("ppf-".length)));
});

test("8. existingIds is never mutated", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: () => NATIVE };
  const existing = [`ppf-${DUP}`, `ppf-${UNIQUE}`];
  const snapshot = [...existing];
  createWizardRowId("ppfInterior", existing, src);
  assert.deepEqual(existing, snapshot);
});

test("8b. real global crypto (default source) produces a valid id", () => {
  const id = createWizardRowId("ppfInterior", []); // no cryptoSource → globalThis.crypto
  assert.ok(id && UUID_V4_RE.test(id.slice("ppf-".length)));
});

// ── Web-Crypto exception fail-closed (R34B-F1) ──────────────────────────────────────

test("8c. randomUUID throws → getRandomValues fallback yields a valid prefixed id", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: throwUUID, getRandomValues: fillFF };
  let id: string | null = null;
  assert.doesNotThrow(() => {
    id = createWizardRowId("ppfInterior", [], src);
  });
  assert.ok(id && UUID_V4_RE.test((id as string).slice("ppf-".length)), `expected a valid v4 id, got ${id}`);
});

test("8d. randomUUID throws with no fallback fails closed (null), without throwing", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: throwUUID }; // no getRandomValues
  let id: string | null = "sentinel";
  assert.doesNotThrow(() => {
    id = createWizardRowId("otherWork", [], src);
  });
  assert.equal(id, null);
});

test("8e. getRandomValues throws fails closed (null), without throwing", () => {
  const src: WizardRowIdCryptoSource = { getRandomValues: throwGetRandomValues }; // no randomUUID
  let id: string | null = "sentinel";
  assert.doesNotThrow(() => {
    id = createWizardRowId("ppfInterior", [], src);
  });
  assert.equal(id, null);
});

test("8f. both randomUUID and getRandomValues throw fails closed (null), without throwing", () => {
  const src: WizardRowIdCryptoSource = { randomUUID: throwUUID, getRandomValues: throwGetRandomValues };
  let id: string | null = "sentinel";
  assert.doesNotThrow(() => {
    id = createWizardRowId("otherWork", [], src);
  });
  assert.equal(id, null);
});

// ── Source-level guarantees ───────────────────────────────────────────────────────

test("9. row-id helper source has no Math.random and no safe-random-uuid import", () => {
  const code = codeOf(ROW_ID_SRC);
  assert.equal(/Math\.random/.test(code), false, "must not use Math.random");
  assert.equal(/safe-random-uuid/.test(code), false, "must not import safe-random-uuid");
  assert.equal(/Date\.now|new Date/.test(code), false, "must not be time-based");
});

test("10. shared runtime-input contract has no preview/example/default dependency", () => {
  const code = codeOf(RUNTIME_INPUTS_SRC);
  for (const bad of [/ScreensPreview/, /EXAMPLE_/, /DEFAULT_/, /PREVIEW_/, /EstimateWizardContainer/]) {
    assert.equal(bad.test(code), false, `runtime-inputs code must not reference ${bad}`);
  }
});

test("11. wizard-runtime-config imports the shared contract, not the container", () => {
  const code = codeOf(RUNTIME_CONFIG_SRC);
  assert.equal(/contract\/wizard-runtime-inputs/.test(code), true, "must import from the shared contract");
  assert.equal(/production\/EstimateWizardContainer/.test(code), false, "must NOT import from the container");
});

test("12. EstimateWizardContainer no longer declares its own WizardScreenConfiguration", () => {
  // Use RAW source with comment-proof patterns: naive comment-stripping is unsafe on this 36KB file,
  // and none of these exact patterns can appear in prose.
  const raw = readFileSync(CONTAINER_SRC, "utf8");
  assert.equal(/export interface WizardScreenConfiguration/.test(raw), false, "local interface must be removed");
  assert.equal(
    /import type \{ WizardScreenConfiguration \} from "\.\.\/contract\/wizard-runtime-inputs"/.test(raw),
    true,
    "must import the shared type from the contract module",
  );
  // the ComponentProps machinery existed only for that interface — gone with it (relocation was type-only)
  assert.equal(/ComponentProps/.test(raw), false, "unused ComponentProps import must be gone");
});

// ── Shared type shape (compile-time; tsc validates in `npm run typecheck`) ────────

test("13. WizardScreenConfiguration + WizardRuntimeInputs expose the expected fields", () => {
  const screenConfig: WizardScreenConfiguration = {
    filmTypes: [], windowAreas: [], maintenanceMenus: [], washMenus: [], roomMenus: [],
    otherWorkPresets: [], storeGlobalOptions: [], coupons: [],
    ppfMethods: [], ppfParts: [], ppfTypeGroups: [],
  };
  const inputs: WizardRuntimeInputs = { shopRank: "detailer", screenConfig };
  assert.equal(inputs.shopRank, "detailer");
  assert.equal(Object.keys(inputs.screenConfig).length, 11);
});
