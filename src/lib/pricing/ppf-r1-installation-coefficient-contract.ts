export const PPF_R1_COEFFICIENT_CONTRACT_VERSION = "1.0" as const;

export const PPF_R1_STANDARD_PRODUCT_CODES = [
  "protect-plus",
  "enhance",
  "hybrid",
  "matte",
  "black",
  "tint",
  "carbon",
  "color-line",
] as const;

export type PpfR1StandardProductCode = (typeof PPF_R1_STANDARD_PRODUCT_CODES)[number];
export type PpfR1InstallationCoefficientMap = Record<PpfR1StandardProductCode, number>;

export interface PpfR1InstallationCoefficientSettings {
  contractVersion: typeof PPF_R1_COEFFICIENT_CONTRACT_VERSION;
  installationCoefficientsBpByProductCode: PpfR1InstallationCoefficientMap;
}

const TOP_LEVEL_KEYS = ["contractVersion", "installationCoefficientsBpByProductCode"] as const;

function fail(path: string, reason: string): never {
  throw new TypeError(`Invalid PPF R1 coefficient contract at ${path}: ${reason}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const keys = Object.keys(value);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const extra = keys.filter((key) => !expected.includes(key));
  if (missing.length > 0) fail(path, `missing keys: ${missing.join(", ")}`);
  if (extra.length > 0) fail(path, `unknown keys: ${extra.join(", ")}`);
}

/** Parse the exact eight-product coefficient contract. 10000 basis points = ×1.0. */
export function parsePpfR1InstallationCoefficientSettings(
  value: unknown,
): PpfR1InstallationCoefficientSettings {
  const root = record(value, "$coefficients");
  exactKeys(root, TOP_LEVEL_KEYS, "$coefficients");
  if (root.contractVersion !== PPF_R1_COEFFICIENT_CONTRACT_VERSION) {
    fail("$coefficients.contractVersion", `expected ${PPF_R1_COEFFICIENT_CONTRACT_VERSION}`);
  }

  const raw = record(
    root.installationCoefficientsBpByProductCode,
    "$coefficients.installationCoefficientsBpByProductCode",
  );
  exactKeys(raw, PPF_R1_STANDARD_PRODUCT_CODES, "$coefficients.installationCoefficientsBpByProductCode");

  const parsed = Object.fromEntries(PPF_R1_STANDARD_PRODUCT_CODES.map((code) => {
    const bp = raw[code];
    if (typeof bp !== "number" || !Number.isSafeInteger(bp) || bp <= 0 || bp > 2_147_483_647) {
      fail(`$coefficients.installationCoefficientsBpByProductCode.${code}`, "expected a positive 32-bit integer basis-point value");
    }
    return [code, bp];
  })) as PpfR1InstallationCoefficientMap;

  return {
    contractVersion: PPF_R1_COEFFICIENT_CONTRACT_VERSION,
    installationCoefficientsBpByProductCode: parsed,
  };
}
