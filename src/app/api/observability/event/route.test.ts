// OBS-1P — route tests for the public observability endpoint.
//
// Run: node --import tsx --test src/app/api/observability/event/route.test.ts
//
// The handler is invoked directly with real `Request` objects — no server, no
// network, no database, no provider. Emissions are captured from the REAL
// console sink (the actual production path on the server), across every severity
// channel, so what is asserted is what an operator would see in runtime logs.

import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { POST } from "./route";

const ORIGIN = "https://dealeros.example";
const URL_ = `${ORIGIN}/api/observability/event`;
const REQ = "obs.0123456789abcdef0123456789abcdef";

const validBody = (over: Record<string, unknown> = {}) => ({
  requestId: REQ,
  event: "uncaught-ui-error",
  stage: "global-boundary",
  code: "UNCAUGHT_UI_ERROR",
  ...over,
});

// ── Console capture: ALL severity channels ──────────────────────────────────
// The sink routes by severity. Capturing one channel would let every absence
// assertion pass against an empty buffer for the other two.

const CHANNELS = ["error", "warn", "info", "log", "debug"] as const;
const lines: string[] = [];
const real: Partial<Record<(typeof CHANNELS)[number], (...a: unknown[]) => void>> = {};

before(() => {
  for (const ch of CHANNELS) {
    real[ch] = console[ch].bind(console);
    console[ch] = (...a: unknown[]) => { lines.push(a.map(String).join(" ")); };
  }
});
after(() => { for (const ch of CHANNELS) { const o = real[ch]; if (o) console[ch] = o; } });
beforeEach(() => { lines.length = 0; });

const emitted = () => lines.filter((l) => l.includes("[observability]"));
const record = () => JSON.parse(emitted()[0].replace("[observability] ", "")) as Record<string, unknown>;

function post(body: string | null, init: { contentType?: string | null; origin?: string | null; contentLength?: string } = {}) {
  const headers = new Headers();
  if (init.contentType !== null) headers.set("content-type", init.contentType ?? "application/json");
  if (init.origin !== null && init.origin !== undefined) headers.set("origin", init.origin);
  if (init.contentLength !== undefined) headers.set("content-length", init.contentLength);
  return new Request(URL_, { method: "POST", headers, body });
}

const json = (o: unknown, init?: Parameters<typeof post>[1]) => post(JSON.stringify(o), init);

// ── 1. The accepted path ────────────────────────────────────────────────────

test("a valid DTO returns 204 with no body and emits exactly one event", async () => {
  const res = await POST(json(validBody()));

  assert.equal(res.status, 204);
  assert.equal(await res.text(), "", "the response carries no body");
  assert.equal(res.headers.get("content-type"), null, "and no content type");

  assert.equal(emitted().length, 1, "exactly one operational record");
  const e = record();
  assert.equal(e.event, "uncaught-ui-error");
  assert.equal(e.severity, "error");
  assert.equal(e.requestId, REQ, "the searchable support code is present");
  assert.equal(e.stage, "global-boundary");
  assert.equal(e.code, "UNCAUGHT_UI_ERROR");
});

test("every boundary stage is accepted and carried", async () => {
  for (const stage of ["global-boundary", "app-boundary", "estimates-boundary"]) {
    lines.length = 0;
    const res = await POST(json(validBody({ stage })));
    assert.equal(res.status, 204, stage);
    assert.equal(emitted().length, 1, stage);
    assert.equal(record().stage, stage);
  }
});

// ── 2. Missing / extra / invalid ────────────────────────────────────────────

test("every MISSING key returns 400 and emits nothing", async () => {
  for (const key of ["requestId", "event", "stage", "code"]) {
    lines.length = 0;
    const body = validBody() as Record<string, unknown>;
    delete body[key];
    const res = await POST(json(body));
    assert.equal(res.status, 400, `missing ${key}`);
    assert.equal(emitted().length, 0, `missing ${key} must emit nothing`);
  }
});

test("every EXTRA key returns 400 — including server-owned and diagnostic fields", async () => {
  const extras: Record<string, unknown> = {
    // Server-owned: a caller must not be able to misattribute or downgrade.
    env: "production", release: "0000000000000000000000000000000000000000",
    severity: "info", occurredAt: "2026-01-01T00:00:00.000Z",
    // Identity a caller cannot be trusted to assert.
    dealerId: "daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: "ubbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    durationMs: 987654,
    // Raw diagnostics and PII carriers.
    message: "CANARY", stack: "CANARY", digest: "CANARY", cause: "CANARY",
    error: { message: "CANARY" }, metadata: { a: 1 }, context: {}, tags: [],
    url: "https://x.example/?q=1", query: "?q=1", cookie: "a=b",
    authorization: "Bearer x", email: "a@example.test", phone: "090-0000-0000",
  };
  for (const [key, value] of Object.entries(extras)) {
    lines.length = 0;
    const res = await POST(json(validBody({ [key]: value })));
    assert.equal(res.status, 400, `extra key ${key} must be rejected`);
    assert.equal(emitted().length, 0, `extra key ${key} must emit nothing`);
    assert.equal(lines.join("").includes("CANARY"), false, `${key}: input echoed into a log`);
  }
});

test("every INVALID literal returns 400", async () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ event: "wizard-save" }, "foreign event"],
    [{ event: "unknown-event" }, "fallback event"],
    [{ event: "" }, "empty event"],
    [{ code: "SAVE_FAILED" }, "foreign code"],
    [{ code: "UNKNOWN" }, "fallback code"],
    [{ stage: "rpc" }, "non-boundary stage"],
    [{ stage: "unknown-stage" }, "fallback stage"],
    [{ stage: "GLOBAL-BOUNDARY" }, "wrong case"],
    [{ event: 1 }, "non-string event"],
    [{ stage: null }, "null stage"],
    [{ code: ["UNCAUGHT_UI_ERROR"] }, "array code"],
  ];
  for (const [over, label] of cases) {
    lines.length = 0;
    const res = await POST(json(validBody(over)));
    assert.equal(res.status, 400, label);
    assert.equal(emitted().length, 0, `${label} must emit nothing`);
  }
});

test("obs.unattributed and every malformed requestId return 400", async () => {
  const bad = [
    "obs.unattributed",                          // unsearchable — deliberately excluded
    "obs.0123456789ABCDEF0123456789ABCDEF",      // uppercase
    "obs.NOTHEX0123456789abcdef01234567",
    "obs.0123456789abcdef0123456789abcde",       // 31 hex
    "obs.0123456789abcdef0123456789abcdef0",     // 33 hex
    "req_0123456789abcdef",
    "abcdefghijklmnop",                          // idempotency-key shaped
    `${REQ} `, ` ${REQ}`, `${REQ}\n`,
    "", "obs.",
  ];
  for (const requestId of bad) {
    lines.length = 0;
    const res = await POST(json(validBody({ requestId })));
    assert.equal(res.status, 400, JSON.stringify(requestId));
    assert.equal(emitted().length, 0, `${JSON.stringify(requestId)} must emit nothing`);
  }
});

test("malformed JSON, arrays and primitives return 400", async () => {
  for (const raw of ["", "{", "not json", "[]", '["a"]', '"str"', "42", "null", "true"]) {
    lines.length = 0;
    const res = await POST(post(raw));
    assert.equal(res.status, 400, JSON.stringify(raw));
    assert.equal(emitted().length, 0, `${JSON.stringify(raw)} must emit nothing`);
  }
});

// ── Content-Type: EXACT media type, parameters only after it ────────────────
//
// A substring rule would accept `application/jsonp`, `application/ld+json` and
// `text/plain; x=application/json` — headers that merely MENTION the token while
// describing a body this route does not parse. The reject table below is built
// almost entirely from values that DO contain the literal "application/json",
// which is what makes it a real test of exactness rather than of rejection.

const ACCEPTED_CONTENT_TYPES = [
  "application/json",
  "Application/JSON",                    // media types are case-insensitive
  "APPLICATION/JSON",
  "application/json; charset=utf-8",
  "application/json ; charset=utf-8",    // whitespace before the parameter
  "  application/json  ",                // surrounding whitespace
  "application/json;charset=utf-8",
];

const REJECTED_CONTENT_TYPES = [
  "application/jsonp",                   // substring rule would accept this
  "application/json-patch+json",
  "application/ld+json",
  "text/plain; application/json",
  "text/plain; x=application/json",
  "application/json, text/plain",        // a list is not a single media type
  "text/application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
  "",
];

test("every accepted Content-Type form returns 204 and emits exactly one event", async () => {
  for (const ct of ACCEPTED_CONTENT_TYPES) {
    lines.length = 0;
    const res = await POST(json(validBody(), { contentType: ct }));
    assert.equal(res.status, 204, `must accept ${JSON.stringify(ct)}`);
    assert.equal(emitted().length, 1, `${JSON.stringify(ct)}: exactly one record`);
  }
});

test("every rejected Content-Type returns 400 and emits nothing", async () => {
  for (const ct of REJECTED_CONTENT_TYPES) {
    // PRECONDITION: most fixtures deliberately CONTAIN or resemble the JSON
    // token. Without this, a route that rejected everything would pass, and so
    // would a substring rule tested only against obviously-unrelated types.
    if (ct !== "" && ct !== "text/plain" && ct !== "multipart/form-data"
        && ct !== "application/x-www-form-urlencoded") {
      assert.ok(ct.toLowerCase().includes("json"),
        `PRECONDITION: ${JSON.stringify(ct)} resembles the JSON token`);
    }

    lines.length = 0;
    const res = await POST(json(validBody(), { contentType: ct }));
    assert.equal(res.status, 400, `must reject ${JSON.stringify(ct)}`);
    assert.equal(emitted().length, 0, `${JSON.stringify(ct)} must emit nothing`);
  }
});

test("a substring or prefix rule would fail this table — five fixtures contain the exact token", () => {
  // Restates the point structurally, so a future refactor back to `includes()`
  // cannot look harmless.
  const containing = REJECTED_CONTENT_TYPES.filter((ct) => ct.toLowerCase().includes("application/json"));
  assert.deepEqual(containing, [
    "application/jsonp",
    "application/json-patch+json",
    "text/plain; application/json",
    "text/plain; x=application/json",
    "application/json, text/plain",
    "text/application/json",
  ]);
  const prefixed = REJECTED_CONTENT_TYPES.filter((ct) => ct.toLowerCase().startsWith("application/json"));
  assert.deepEqual(prefixed, ["application/jsonp", "application/json-patch+json", "application/json, text/plain"]);
});

test("an ABSENT Content-Type header returns 400", async () => {
  lines.length = 0;
  const res = await POST(json(validBody(), { contentType: null }));
  assert.equal(res.status, 400);
  assert.equal(emitted().length, 0);
});

// ── 3. Origin ───────────────────────────────────────────────────────────────

test("a present FOREIGN Origin returns 400; an absent Origin is accepted", async () => {
  for (const origin of ["https://evil.example", "http://localhost:3000", "null", "not-a-url"]) {
    lines.length = 0;
    const res = await POST(json(validBody(), { origin }));
    assert.equal(res.status, 400, origin);
    assert.equal(emitted().length, 0, `${origin} must emit nothing`);
  }

  // Absent: accepted on purpose. Rejecting buys nothing — a scripted client sets
  // any header — while it would break legitimate boundary reports.
  lines.length = 0;
  assert.equal((await POST(json(validBody(), { origin: null }))).status, 204);
  assert.equal(emitted().length, 1);

  // Same origin: accepted.
  lines.length = 0;
  assert.equal((await POST(json(validBody(), { origin: ORIGIN }))).status, 204);
  assert.equal(emitted().length, 1);
});

// ── 4. Size gate ────────────────────────────────────────────────────────────
//
// A valid DTO is ~150 bytes, so there is no such thing as a "valid 1024-byte
// DTO" — inventing a padding field to build one would mean adding a key the
// contract forbids. The gate is proven at the boundary instead: 1024 invalid
// bytes must pass the SIZE check and fail VALIDATION (400), while 1025 bytes
// must be rejected on size alone (413).

/** A syntactically valid JSON body of EXACTLY `bytes` bytes (ASCII throughout). */
function bodyOfExactly(bytes: number): string {
  const prefix = '{"padkey":"';
  const suffix = '"}';
  const raw = prefix + "x".repeat(bytes - prefix.length - suffix.length) + suffix;
  assert.equal(Buffer.byteLength(raw, "utf8"), bytes, `PRECONDITION: exactly ${bytes} bytes`);
  return raw;
}

test("a 1024-byte body passes the size gate and is judged on content (400, not 413)", async () => {
  const raw = bodyOfExactly(1024);

  lines.length = 0;
  const res = await POST(post(raw));
  assert.equal(res.status, 400, "at the cap: read in full, then rejected as invalid — not 413");
  assert.equal(emitted().length, 0);
});

test("a 1025-byte body returns 413", async () => {
  const raw = bodyOfExactly(1025);

  lines.length = 0;
  const res = await POST(post(raw));
  assert.equal(res.status, 413, "one byte over the cap is rejected on size alone");
  assert.equal(emitted().length, 0);
});

test("a FALSE or MISSING Content-Length cannot bypass the stream cap", async () => {
  const huge = `{"padkey":"${"x".repeat(50_000)}"}`;
  assert.ok(Buffer.byteLength(huge, "utf8") > 1024, "PRECONDITION: the body really is oversized");

  // Understated header — the streamed byte count must still win.
  lines.length = 0;
  assert.equal((await POST(post(huge, { contentLength: "10" }))).status, 413, "a lying Content-Length is not trusted");
  assert.equal(emitted().length, 0);

  // Non-numeric header.
  lines.length = 0;
  assert.equal((await POST(post(huge, { contentLength: "not-a-number" }))).status, 413);

  // Honest oversize header — early reject, same outcome.
  lines.length = 0;
  assert.equal((await POST(post(huge, { contentLength: String(Buffer.byteLength(huge, "utf8")) }))).status, 413);
  assert.equal(emitted().length, 0);
});

// ── 5. Server-owned fields ──────────────────────────────────────────────────

test("release and env are server-generated and not caller-controlled", async () => {
  const SPOOF = "ffffffffffffffffffffffffffffffffffffffff";

  // PRECONDITION: the accepted path really does emit a record with both fields.
  lines.length = 0;
  await POST(json(validBody()));
  assert.equal(emitted().length, 1, "PRECONDITION: a record was emitted");
  const server = record();
  assert.equal(typeof server.env, "string");
  assert.equal(typeof server.release, "string");
  assert.notEqual(server.release, "");

  // Attempting to supply either is an unknown key: rejected outright.
  for (const key of ["release", "env"]) {
    lines.length = 0;
    const res = await POST(json(validBody({ [key]: SPOOF })));
    assert.equal(res.status, 400, `caller-supplied ${key} is rejected`);
    assert.equal(emitted().length, 0);
  }
  assert.notEqual(server.release, SPOOF, "the server value is its own");
});

// ── 6. Non-vacuity ──────────────────────────────────────────────────────────

test("CANARY GUARD: a zero-emission run fails the accepted path's own precondition", () => {
  lines.length = 0;
  assert.throws(() => { assert.equal(emitted().length, 1, "exactly one operational record"); });
});

// ── 7. Source boundaries ────────────────────────────────────────────────────

test("the route touches no database, Storage, provider or cookie", () => {
  const code = readFileSync("src/app/api/observability/event/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  for (const token of ["supa" + "base", "createClient", "createAdminClient", ".rpc(", '.from("',
                       "next/headers", "cook" + "ies(", "admin_audit" + "_logs", "activity" + "_logs",
                       "Storage", "sen" + "try", "data" + "dog"]) {
    assert.equal(code.includes(token), false, `the route references ${token}`);
  }
  // POST only — no other verb is exported, so the framework answers 405.
  const verbs = [...code.matchAll(/export async function ([A-Z]+)/g)].map((m) => m[1]);
  assert.deepEqual(verbs, ["POST"], `unexpected exported verbs: ${verbs.join(", ")}`);
  // The cap is enforced on the stream, not on the header alone.
  assert.match(code, /getReader\(\)/, "the body is read as a stream");
  assert.match(code, /MAX_BODY_BYTES = 1024/);
  assert.equal(/req\.(text|json)\(\)/.test(code), false, "never buffers the whole body first");
  // Rejections must not log attacker-controlled text.
  assert.equal(/console\s*\./.test(code), false, "the route writes no console line of its own");
});

test("the Content-Type check is an equality test, not a substring or prefix test", () => {
  const code = readFileSync("src/app/api/observability/event/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // Tokens assembled from fragments so this guard never matches its own strings.
  for (const hazard of ["inclu" + "des(", "starts" + "With(", "ends" + "With(", "index" + "Of("]) {
    assert.equal(code.includes(`contentType.${hazard}`), false, `content type tested with ${hazard}`);
  }
  // The one permitted shape: split at the first ';', trim, lowercase, compare ===.
  assert.match(code, /\.split\(";", 1\)\[0\]\.trim\(\)\.toLowerCase\(\)/, "parameters are separated before comparison");
  assert.match(code, /mediaType === "application\/json"/, "and the media type is compared for equality");
});
