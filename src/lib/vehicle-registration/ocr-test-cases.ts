// Internal OCR test set (req 8). Exercises the DETERMINISTIC post-processing
// (maker/model normalization + owner/user mapping) against fixed OCR fixtures.
// Real-image extraction cannot be unit-tested here; this locks the logic that
// turns raw OCR JSON into structured, mapped vehicle/customer data.
//
// Run: npx tsx src/lib/vehicle-registration/ocr-test-cases.ts   (prints PASS/FAIL)

import { normalizeVehicleFields } from "./vehicle-normalize";
import { analyzeOcrCustomer, resolveCustomer } from "./ocr-customer-mapping";
import type { VehicleRegistrationOcrResult } from "./vehicle-registration-types";

interface OcrTestCase {
  name:  string;
  input: Partial<VehicleRegistrationOcrResult>;
  expect: {
    maker:              string;
    model:              string;
    grade:              string;
    ownerUserSeparated: boolean;
    recommendedSource:  "user" | "owner";
    customerName:       string;
    customerType:       "individual" | "corporation" | "unknown";
  };
}

export const OCR_TEST_CASES: OcrTestCase[] = [
  {
    name: "1) owner = user (individual) — maker/model/grade split",
    input: { owner_name: "山田 太郎", user_name: "山田 太郎", vehicle_name: "トヨタ クラウン アスリート" },
    expect: { maker: "トヨタ", model: "クラウン", grade: "アスリート", ownerUserSeparated: false, recommendedSource: "user", customerName: "山田 太郎", customerType: "individual" },
  },
  {
    name: "2) owner != user, finance/dealer owner — maker only (車名 blank)",
    input: { owner_name: "株式会社アプラス", user_name: "佐藤 花子", vehicle_name: "フェラーリ" },
    expect: { maker: "フェラーリ", model: "", grade: "", ownerUserSeparated: true, recommendedSource: "user", customerName: "佐藤 花子", customerType: "individual" },
  },
  {
    name: "3) corporation user",
    input: { owner_name: "株式会社山田製作所", user_name: "株式会社山田製作所", vehicle_name: "日産 キャラバン" },
    expect: { maker: "日産", model: "キャラバン", grade: "", ownerUserSeparated: false, recommendedSource: "user", customerName: "株式会社山田製作所", customerType: "corporation" },
  },
];

export interface OcrTestResult { name: string; pass: boolean; failures: string[] }

export function runOcrTestCase(tc: OcrTestCase): OcrTestResult {
  const norm     = normalizeVehicleFields({ maker: tc.input.maker, vehicleName: tc.input.vehicle_name, grade: tc.input.grade });
  const analysis = analyzeOcrCustomer(tc.input);
  const resolved = resolveCustomer(tc.input, analysis.recommendedSource);

  const checks: [string, unknown, unknown][] = [
    ["maker",              norm.maker,                 tc.expect.maker],
    ["model",              norm.model,                 tc.expect.model],
    ["grade",              norm.grade,                 tc.expect.grade],
    ["ownerUserSeparated", analysis.ownerUserSeparated, tc.expect.ownerUserSeparated],
    ["recommendedSource",  analysis.recommendedSource,  tc.expect.recommendedSource],
    ["customerName",       resolved.name,               tc.expect.customerName],
    ["customerType",       resolved.customerType,       tc.expect.customerType],
  ];
  const failures = checks
    .filter(([, got, exp]) => got !== exp)
    .map(([field, got, exp]) => `${field}: got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`);
  return { name: tc.name, pass: failures.length === 0, failures };
}

export function runAllOcrTests(): { passed: number; total: number; results: OcrTestResult[] } {
  const results = OCR_TEST_CASES.map(runOcrTestCase);
  return { passed: results.filter((r) => r.pass).length, total: results.length, results };
}
