import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowEstimateAction, estimateCreateUrl, stopRowClick } from "./ReservationTable";

test("見積を作成 action is visible for pending reservations", () => {
  assert.equal(shouldShowEstimateAction("pending"), true);
});

test("見積を作成 action is visible for confirmed reservations", () => {
  assert.equal(shouldShowEstimateAction("confirmed"), true);
});

test("見積を作成 action is absent for completed, cancelled and no_show reservations", () => {
  assert.equal(shouldShowEstimateAction("completed"), false);
  assert.equal(shouldShowEstimateAction("cancelled"), false);
  assert.equal(shouldShowEstimateAction("no_show"), false);
});

test("estimate URL targets /estimates/new with exactly one query key reservation_id", () => {
  const url = new URL(estimateCreateUrl("res-123"), "http://localhost");
  assert.equal(url.pathname, "/estimates/new");
  assert.deepEqual([...url.searchParams.keys()], ["reservation_id"]);
  assert.equal(url.searchParams.get("reservation_id"), "res-123");
});

test("estimate URL encodes the reservation id safely", () => {
  const rawId = "id with spaces&=?#/日本語";
  const url = new URL(estimateCreateUrl(rawId), "http://localhost");
  assert.deepEqual([...url.searchParams.keys()], ["reservation_id"]);
  assert.equal(url.searchParams.get("reservation_id"), rawId);
});

test("estimate URL carries no authority or extra parameters", () => {
  const url = new URL(estimateCreateUrl("res-123"), "http://localhost");
  for (const key of [
    "customer_id",
    "vehicle_id",
    "dealer_id",
    "role",
    "status",
    "category",
    "notes",
  ]) {
    assert.equal(url.searchParams.has(key), false);
  }
  assert.equal([...url.searchParams.keys()].length, 1);
});

test("clicking 見積を作成 stops propagation so row onEdit is not triggered", () => {
  let propagationStopped = false;
  let onEditCalled = false;
  const event = {
    stopPropagation: () => {
      propagationStopped = true;
    },
  };
  stopRowClick(event);
  // The row onClick only fires when the event bubbles up to the <tr>.
  if (!propagationStopped) {
    onEditCalled = true;
  }
  assert.equal(propagationStopped, true);
  assert.equal(onEditCalled, false);
});
