import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_LEGACY_CUSTOMER,
  EMPTY_LEGACY_VEHICLE,
  mapReviewedOcrToLegacyDraft,
  validateAndBuildLegacyPayload,
} from "./legacy-registration-core";

const customer = {
  ...EMPTY_LEGACY_CUSTOMER,
  lastName: "山田 太郎",
  lastNameKana: "検索用やまだ",
};

const vehicle = {
  ...EMPTY_LEGACY_VEHICLE,
  maker: "トヨタ",
  model: "ハリアー",
  plateNumber: "滋賀 330 あ 12-34",
};

function draft(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "legacy-test-1",
    customer: { mode: "new", data: customer },
    vehicle: { mode: "new", data: vehicle },
    history: [],
    ...overrides,
  };
}

test("accepts new customer + new vehicle without history and does not require katakana", () => {
  const result = validateAndBuildLegacyPayload(draft(), "2026-09-15");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.payload).sort(), ["customer", "history", "idempotencyKey", "vehicle"]);
  assert.equal("dealerId" in result.payload, false);
  assert.equal("actor" in result.payload, false);
});

test("keeps an individual full name and furigana unsplit in the compatibility payload", () => {
  const result = validateAndBuildLegacyPayload(draft(), "2026-09-15");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.payload.customer, {
    mode: "new",
    name: "山田 太郎",
    lastName: "山田 太郎",
    firstName: "",
    lastNameKana: "検索用やまだ",
    firstNameKana: "",
    phone: "",
    email: "",
    postalCode: "",
    prefecture: "",
    city: "",
    address1: "",
    address2: "",
    notes: "",
    isBusiness: false,
  });
});

test("requires furigana for a newly entered customer", () => {
  const result = validateAndBuildLegacyPayload(draft({
    customer: {
      mode: "new",
      data: { ...customer, lastNameKana: "" },
    },
  }), "2026-09-15");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.fieldErrors.furigana, /フリガナ/);
});

test("accepts existing customer + new vehicle", () => {
  const result = validateAndBuildLegacyPayload(draft({
    customer: { mode: "existing", customerId: "11111111-1111-4111-8111-111111111111" },
  }), "2026-09-15");
  assert.equal(result.ok, true);
});

test("accepts existing customer + existing vehicle", () => {
  const result = validateAndBuildLegacyPayload(draft({
    customer: { mode: "existing", customerId: "11111111-1111-4111-8111-111111111111" },
    vehicle: { mode: "existing", vehicleId: "22222222-2222-4222-8222-222222222222" },
  }), "2026-09-15");
  assert.equal(result.ok, true);
});

test("rejects new customer + existing vehicle before the RPC", () => {
  const result = validateAndBuildLegacyPayload(draft({
    vehicle: { mode: "existing", vehicleId: "22222222-2222-4222-8222-222222222222" },
  }), "2026-09-15");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.fieldErrors.vehicle, /登録済み顧客/);
});

test("rejects a future historical service date", () => {
  const result = validateAndBuildLegacyPayload(draft({
    history: [{
      clientId: "row-1", category: "coating", performedOn: "2026-09-16",
      serviceName: "Q2 MOHS", notes: "",
    }],
  }), "2026-09-15");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.fieldErrors["history.0.performedOn"], /今日以前/);
});

test("OCR mapping keeps full names and addresses operator-reviewable without guessed splits", () => {
  const mapped = mapReviewedOcrToLegacyDraft({
    customer_candidate_name: "山田 太郎",
    customer_candidate_address: "滋賀県大津市テスト町1-2-3",
    owner_name_kana: "ヤマダ タロウ",
    customer_type: "corporation",
    maker: "トヨタ",
    vehicle_name: "ハリアー",
    color: "推測色",
  });
  assert.equal(mapped.customer.lastName, "山田 太郎");
  assert.equal(mapped.customer.firstName, "");
  assert.equal(mapped.customer.lastNameKana, "ヤマダ タロウ");
  assert.equal(mapped.customer.firstNameKana, "");
  assert.equal(mapped.customer.isBusiness, false);
  assert.equal(mapped.customer.address1, "滋賀県大津市テスト町1-2-3");
  assert.equal(mapped.customer.prefecture, "");
  assert.equal(mapped.vehicle.color, "");
});
