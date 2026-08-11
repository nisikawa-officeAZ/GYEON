import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createReservationPrefillLoader } from "./get-reservation-prefill";

interface FakeRow {
  customer_id: string | null;
  vehicle_id: string | null;
  service_type: string;
  status: string;
  notes: string | null;
}

interface Recorded {
  capabilities: string[];
  createClientCalls: number;
  fromTables: string[];
  selectColumns: string[];
  eqArgs: Array<[string, string]>;
}

function makeHarness(options: {
  auth?: { dealerId: string; role: unknown } | { error: string };
  row?: FakeRow | null;
  queryError?: { message: string } | null;
  createClientRejects?: boolean;
  maybeSingleThrows?: boolean;
}) {
  const recorded: Recorded = {
    capabilities: [],
    createClientCalls: 0,
    fromTables: [],
    selectColumns: [],
    eqArgs: [],
  };

  const auth = options.auth ?? { dealerId: "dealer-1", role: "staff" };

  const client = {
    from(table: "reservations") {
      recorded.fromTables.push(table);
      return {
        select(columns: string) {
          recorded.selectColumns.push(columns);
          return {
            eq(column: "id", value: string) {
              recorded.eqArgs.push([column, value]);
              return {
                eq(innerColumn: "dealer_id", innerValue: string) {
                  recorded.eqArgs.push([innerColumn, innerValue]);
                  return {
                    async maybeSingle() {
                      if (options.maybeSingleThrows) {
                        throw new Error("query failed");
                      }
                      return {
                        data: options.row ?? null,
                        error: options.queryError ?? null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const loader = createReservationPrefillLoader({
    async requireStaffCapability(capability: "edit") {
      recorded.capabilities.push(capability);
      return auth;
    },
    async createClient() {
      recorded.createClientCalls += 1;
      if (options.createClientRejects) {
        throw new Error("client unavailable");
      }
      return client;
    },
  });

  return { loader, recorded };
}

function pendingRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    customer_id: "customer-1",
    vehicle_id: "vehicle-1",
    service_type: "coating",
    status: "pending",
    notes: "internal memo",
    ...overrides,
  };
}

describe("getReservationPrefill", () => {
  it("requires the edit capability before touching the client", async () => {
    const { loader, recorded } = makeHarness({ row: pendingRow() });
    await loader("res-1");
    assert.deepEqual(recorded.capabilities, ["edit"]);
  });

  it("returns null on denied auth without creating a client", async () => {
    const { loader, recorded } = makeHarness({ auth: { error: "denied" } });
    const result = await loader("res-1");
    assert.equal(result, null);
    assert.equal(recorded.createClientCalls, 0);
    assert.deepEqual(recorded.fromTables, []);
  });

  it("returns null for an empty or blank reservation id", async () => {
    const { loader, recorded } = makeHarness({ row: pendingRow() });
    assert.equal(await loader(""), null);
    assert.equal(await loader("   "), null);
    assert.equal(recorded.createClientCalls, 0);
  });

  it("constrains the query to the reservation id and the auth dealer id", async () => {
    const { loader, recorded } = makeHarness({
      auth: { dealerId: "dealer-auth", role: "staff" },
      row: pendingRow(),
    });
    await loader("res-9");
    assert.deepEqual(recorded.fromTables, ["reservations"]);
    assert.deepEqual(recorded.selectColumns, [
      "customer_id, vehicle_id, service_type, status, notes",
    ]);
    assert.deepEqual(recorded.eqArgs, [
      ["id", "res-9"],
      ["dealer_id", "dealer-auth"],
    ]);
  });

  it("returns null when no row matches (tenant mismatch or missing)", async () => {
    const { loader } = makeHarness({ row: null });
    assert.equal(await loader("res-1"), null);
  });

  it("returns null on a query error", async () => {
    const { loader } = makeHarness({
      row: pendingRow(),
      queryError: { message: "boom" },
    });
    assert.equal(await loader("res-1"), null);
  });

  it("returns null when the query throws", async () => {
    const { loader } = makeHarness({ maybeSingleThrows: true });
    assert.equal(await loader("res-1"), null);
  });

  it("returns null when client creation fails", async () => {
    const { loader } = makeHarness({ createClientRejects: true });
    assert.equal(await loader("res-1"), null);
  });

  it("allows pending and confirmed statuses", async () => {
    for (const status of ["pending", "confirmed"]) {
      const { loader } = makeHarness({ row: pendingRow({ status }) });
      const result = await loader("res-1");
      assert.notEqual(result, null, `expected prefill for status ${status}`);
    }
  });

  it("rejects completed, cancelled, no_show and unknown statuses", async () => {
    for (const status of ["completed", "cancelled", "no_show", "mystery"]) {
      const { loader } = makeHarness({ row: pendingRow({ status }) });
      assert.equal(await loader("res-1"), null, `expected null for status ${status}`);
    }
  });

  it("maps the seven recognized service types with wheel/interior as null category", async () => {
    const expectations: Array<[string, string | null]> = [
      ["coating", "coating"],
      ["maintenance", "maintenance"],
      ["ppf", "ppf"],
      ["window", "window"],
      ["other", "other"],
      ["wheel", null],
      ["interior", null],
    ];
    for (const [serviceType, expected] of expectations) {
      const { loader } = makeHarness({
        row: pendingRow({ service_type: serviceType }),
      });
      const result = await loader("res-1");
      assert.notEqual(result, null, `service_type ${serviceType}`);
      assert.equal(result?.category, expected, `service_type ${serviceType}`);
    }
  });

  it("returns null for the entire prefill on an unrecognized service type", async () => {
    const { loader } = makeHarness({
      row: pendingRow({ service_type: "unknown_service" }),
    });
    assert.equal(await loader("res-1"), null);
  });

  it("returns server-derived ids and notes only as notesInternal", async () => {
    const { loader } = makeHarness({
      row: pendingRow({
        customer_id: "customer-42",
        vehicle_id: "vehicle-7",
        notes: "call before arrival",
      }),
    });
    const result = await loader("res-1");
    assert.equal(result?.customerId, "customer-42");
    assert.equal(result?.vehicleId, "vehicle-7");
    assert.equal(result?.notesInternal, "call before arrival");
  });

  it("returns exactly the prefill keys and no detail hints", async () => {
    const { loader } = makeHarness({ row: pendingRow() });
    const result = await loader("res-1");
    assert.notEqual(result, null);
    assert.deepEqual(Object.keys(result as object).sort(), [
      "category",
      "customerId",
      "notesInternal",
      "vehicleId",
    ]);
    assert.equal("notesCustomer" in (result as object), false);
    assert.equal("serviceType" in (result as object), false);
    assert.equal("configId" in (result as object), false);
  });
});
