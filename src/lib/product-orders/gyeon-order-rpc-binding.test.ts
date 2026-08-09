import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, beforeEach, mock, test } from "node:test";

const DEALER = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const PRODUCT = "33333333-3333-4333-8333-333333333333";
const ORDER = "44444444-4444-4444-8444-444444444444";

type Scenario = {
  authError?: string;
  userId?: string | null;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
};

let scenario: Scenario = {};
const recorded = {
  capabilities: [] as string[],
  clientCreations: 0,
  rpcCalls: [] as Array<[string, Record<string, unknown>]>,
};

function reset(next: Scenario = {}) {
  scenario = next;
  recorded.capabilities.length = 0;
  recorded.clientCreations = 0;
  recorded.rpcCalls.length = 0;
}

function fakeClient() {
  recorded.clientCreations += 1;
  return {
    auth: {
      getUser: async () => ({
        data: { user: scenario.userId === null ? null : { id: scenario.userId ?? ACTOR } },
      }),
    },
    async rpc(name: string, args: Record<string, unknown>) {
      recorded.rpcCalls.push([name, args]);
      return {
        data: scenario.rpcData ?? {
          id: ORDER,
          dealer_id: DEALER,
          status: "draft",
          product_order_items: [],
        },
        error: scenario.rpcError ?? null,
      };
    },
  };
}

function mockModule(specifier: string, moduleExports: Record<string, unknown>): void {
  Reflect.apply(mock.module, mock, [specifier, { exports: moduleExports }]);
}

mockModule("@/lib/supabase/server", {
  createClient: async () => fakeClient(),
});

mockModule("@/lib/auth/require-staff-capability", {
  requireStaffCapability: async (capability: string) => {
    recorded.capabilities.push(capability);
    return scenario.authError
      ? { error: scenario.authError }
      : { dealerId: DEALER, role: capability === "delete" ? "owner" : "staff" };
  },
});

type CreateModule = typeof import("./create-product-order");
type UpdateModule = typeof import("./update-product-order");
let createProductOrder: CreateModule["createProductOrder"];
let updateProductOrderStatus: UpdateModule["updateProductOrderStatus"];
let updateProductOrderNotes: UpdateModule["updateProductOrderNotes"];

before(async () => {
  createProductOrder = (await import("./create-product-order")).createProductOrder;
  const update = await import("./update-product-order");
  updateProductOrderStatus = update.updateProductOrderStatus;
  updateProductOrderNotes = update.updateProductOrderNotes;
});

beforeEach(() => reset());

function item(
  over: Partial<import("./create-product-order").ProductOrderItemInput> = {},
) {
  return {
    product_id: PRODUCT,
    sku: "CLIENT-SKU-MUST-BE-IGNORED",
    product_name_snapshot: "CLIENT NAME MUST BE IGNORED",
    retail_price_snapshot: 1,
    quantity: 2,
    ...over,
  };
}

test("create uses one RPC and forwards only product identity plus quantity", async () => {
  const result = await createProductOrder({
    items: [item()],
    notes: "note",
    status: "draft",
    idempotency_key: "order-key-1",
  });

  assert.ok("success" in result, JSON.stringify(result));
  assert.deepEqual(recorded.capabilities, ["edit"]);
  assert.equal(recorded.rpcCalls.length, 1);
  assert.equal(recorded.rpcCalls[0][0], "create_gyeon_product_order_v1_rpc");
  assert.deepEqual(recorded.rpcCalls[0][1], {
    p_dealer_id: DEALER,
    p_actor: ACTOR,
    p_idempotency_key: "order-key-1",
    p_lines: [{ product_id: PRODUCT, quantity: 2 }],
    p_notes: "note",
  });

  const payload = JSON.stringify(recorded.rpcCalls[0][1]);
  for (const forbidden of ["CLIENT-SKU", "CLIENT NAME", "retail_price", "order_date"]) {
    assert.equal(payload.includes(forbidden), false, `RPC payload must not contain ${forbidden}`);
  }
});

test("missing idempotency key and malformed lines fail before client creation", async () => {
  assert.ok("error" in await createProductOrder({ items: [item()] }));
  assert.equal(recorded.clientCreations, 0);
  assert.equal(recorded.rpcCalls.length, 0);

  reset();
  assert.ok("error" in await createProductOrder({
    items: [item(), item()],
    idempotency_key: "duplicate-product",
  }));
  assert.equal(recorded.clientCreations, 0);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("legacy save-and-submit fails closed until card authorization is connected", async () => {
  const result = await createProductOrder({
    items: [item()],
    status: "submitted",
    idempotency_key: "submit-key",
  });
  assert.ok("error" in result);
  assert.match(result.error, /カード与信/);
  assert.deepEqual(recorded.capabilities, ["edit"]);
  assert.equal(recorded.clientCreations, 0);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("authorization denial wins before client or RPC access", async () => {
  reset({ authError: "DENIED" });
  const result = await createProductOrder({
    items: [item()],
    idempotency_key: "auth-key",
  });
  assert.deepEqual(result, { error: "DENIED" });
  assert.equal(recorded.clientCreations, 0);
  assert.equal(recorded.rpcCalls.length, 0);
});

test("dealer cancellation requires delete capability and calls only cancel RPC", async () => {
  const result = await updateProductOrderStatus(ORDER, "cancelled");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(recorded.capabilities, ["delete"]);
  assert.deepEqual(recorded.rpcCalls, [[
    "cancel_gyeon_product_order_v1_rpc",
    { p_dealer_id: DEALER, p_actor: ACTOR, p_order_id: ORDER },
  ]]);
});

test("dealer cannot approve or start fulfillment through the status wrapper", async () => {
  for (const status of ["approved", "fulfilling", "fulfilled"] as const) {
    reset();
    const result = await updateProductOrderStatus(ORDER, status);
    assert.equal(result.success, false);
    assert.deepEqual(recorded.capabilities, ["edit"]);
    assert.equal(recorded.clientCreations, 0);
    assert.equal(recorded.rpcCalls.length, 0);
  }
});

test("draft notes use one dedicated RPC", async () => {
  const result = await updateProductOrderNotes(ORDER, "new note");
  assert.deepEqual(result, { success: true });
  assert.deepEqual(recorded.capabilities, ["edit"]);
  assert.deepEqual(recorded.rpcCalls, [[
    "update_gyeon_product_order_notes_v1_rpc",
    { p_dealer_id: DEALER, p_actor: ACTOR, p_order_id: ORDER, p_notes: "new note" },
  ]]);
});

test("mutation wrappers contain no direct table writes or privileged client", () => {
  for (const file of [
    "src/lib/product-orders/create-product-order.ts",
    "src/lib/product-orders/update-product-order.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    for (const forbidden of [
      ".from(", ".insert(", ".update(", ".delete(",
      "createAdminClient", "supabase/admin", "service_role",
      "getNextDocumentNumber", "Date.now()",
    ]) {
      assert.equal(source.includes(forbidden), false, `${file} must not contain ${forbidden}`);
    }
  }
});
