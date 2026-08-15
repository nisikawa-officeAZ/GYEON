import { test } from "node:test";
import assert from "node:assert/strict";

import { safeRandomUUID } from "./safe-random-uuid";

// Canonical lowercase RFC 4122 v4: version nibble must be "4", variant nibble must be 8/9/a/b.
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Deterministic getRandomValues stub: fills bytes with a fixed pattern so the manual path is stable.
function deterministicFill(array: Uint8Array): Uint8Array {
  for (let i = 0; i < array.length; i++) array[i] = i & 0xff;
  return array;
}

// Replace globalThis.crypto for the duration of fn, then restore the original descriptor exactly —
// never leaving a mutated global behind, even if fn throws.
function withCrypto(stub: unknown, fn: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: stub, configurable: true, writable: true });
  try {
    fn();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, "crypto", original);
    } else {
      delete (globalThis as { crypto?: unknown }).crypto;
    }
  }
}

test("1: randomUUID succeeds -> canonical RFC 4122 v4", () => {
  const fixed = "12345678-1234-4234-8234-1234567890ab";
  withCrypto({ randomUUID: () => fixed, getRandomValues: deterministicFill }, () => {
    const out = safeRandomUUID();
    assert.equal(out, fixed);
    assert.match(out, V4);
  });
});

test("2: randomUUID throws and getRandomValues succeeds -> no throw, canonical v4", () => {
  const stub = {
    randomUUID: () => {
      throw new Error("randomUUID unavailable");
    },
    getRandomValues: deterministicFill,
  };
  withCrypto(stub, () => {
    const out = safeRandomUUID();
    assert.match(out, V4);
  });
});

test("3: randomUUID absent and getRandomValues succeeds -> canonical v4", () => {
  withCrypto({ getRandomValues: deterministicFill }, () => {
    const out = safeRandomUUID();
    assert.match(out, V4);
  });
});

test("4: getRandomValues throws -> Math.random fallback, canonical v4", () => {
  const stub = {
    getRandomValues: () => {
      throw new Error("getRandomValues unavailable");
    },
  };
  withCrypto(stub, () => {
    const out = safeRandomUUID();
    assert.match(out, V4);
  });
});

test("5: global crypto absent -> Math.random fallback, canonical v4", () => {
  withCrypto(undefined, () => {
    const out = safeRandomUUID();
    assert.match(out, V4);
  });
});
