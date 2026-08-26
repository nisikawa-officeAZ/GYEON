import assert from "node:assert/strict";
import test from "node:test";
import {
  PPF_R1_COEFFICIENT_CONTRACT_VERSION,
  PPF_R1_STANDARD_PRODUCT_CODES,
  parsePpfR1InstallationCoefficientSettings,
} from "./ppf-r1-installation-coefficient-contract";

function payload() {
  return {
    contractVersion: PPF_R1_COEFFICIENT_CONTRACT_VERSION,
    installationCoefficientsBpByProductCode: Object.fromEntries(
      PPF_R1_STANDARD_PRODUCT_CODES.map((code, index) => [code, 10_000 + index * 500]),
    ),
  };
}

test("coefficient contract is exactly the eight immutable GYEON product codes", () => {
  const parsed = parsePpfR1InstallationCoefficientSettings(payload());
  assert.deepEqual(Object.keys(parsed.installationCoefficientsBpByProductCode), [...PPF_R1_STANDARD_PRODUCT_CODES]);
});

test("missing, extra, zero, negative, fractional and unsafe coefficients fail closed", () => {
  const cases: unknown[] = [];
  const missing = payload();
  delete missing.installationCoefficientsBpByProductCode.black;
  cases.push(missing);
  cases.push({ ...payload(), extra: true });
  for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    const value = payload();
    value.installationCoefficientsBpByProductCode.black = bad;
    cases.push(value);
  }
  for (const value of cases) assert.throws(() => parsePpfR1InstallationCoefficientSettings(value));
});

test("parser returns a detached map", () => {
  const value = payload();
  const parsed = parsePpfR1InstallationCoefficientSettings(value);
  value.installationCoefficientsBpByProductCode.black = 99_999;
  assert.notEqual(parsed.installationCoefficientsBpByProductCode.black, 99_999);
});
