// Staff / capacity settings normalization — nullable numeric contract.
//
// Run: node --import tsx --test src/lib/dealer-settings/staff-capacity.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { normalizeStaffCapacitySettings } from "./staff-capacity";

function normalizeNumericFields(value: unknown) {
  return normalizeStaffCapacitySettings({
    capacity: {
      simultaneous_vehicles: value,
      parallel_work: { max_parallel_per_staff: value },
    },
    staff_capacity: {
      staff_1: { daily_capacity: value },
    },
  });
}

for (const [label, value] of [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["whitespace-only string", "   "],
] as const) {
  test(`${label} remains an unset capacity instead of becoming zero`, () => {
    const result = normalizeNumericFields(value);

    assert.equal(result.capacity.simultaneous_vehicles, null);
    assert.equal(result.capacity.parallel_work.max_parallel_per_staff, null);
    assert.equal(result.staff_capacity.staff_1.daily_capacity, null);
  });
}

test("an explicit numeric zero remains a configured zero", () => {
  const result = normalizeNumericFields(0);

  assert.equal(result.capacity.simultaneous_vehicles, 0);
  assert.equal(result.capacity.parallel_work.max_parallel_per_staff, 0);
  assert.equal(result.staff_capacity.staff_1.daily_capacity, 0);
});

test("valid numeric strings normalize to bounded integers", () => {
  const result = normalizeNumericFields("3.9");

  assert.equal(result.capacity.simultaneous_vehicles, 3);
  assert.equal(result.capacity.parallel_work.max_parallel_per_staff, 3);
  assert.equal(result.staff_capacity.staff_1.daily_capacity, 3);
});

test("invalid and out-of-range values fail closed to null", () => {
  assert.equal(normalizeNumericFields("not-a-number").capacity.simultaneous_vehicles, null);
  assert.equal(normalizeNumericFields(-1).capacity.simultaneous_vehicles, null);
  assert.equal(normalizeNumericFields(101).capacity.simultaneous_vehicles, null);
  assert.equal(normalizeNumericFields(51).capacity.parallel_work.max_parallel_per_staff, null);
  assert.equal(normalizeNumericFields(101).staff_capacity.staff_1.daily_capacity, null);
});
