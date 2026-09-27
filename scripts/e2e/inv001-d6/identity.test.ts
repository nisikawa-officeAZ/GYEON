// INV001 P19 D6 — identity proof child and harness self-tests.
//
// Static mode (no IPC channel): self-tests for the two-channel secret scan.
// IPC mode (spawned by run.mjs with INV001_D6_IDENTITY_CHILD=1): drives the
// unmodified cookie and Bearer resolver paths against the disposable loopback
// stack. Only `server-only` and `next/headers` are replaced; every cookie and
// token value is registered with the parent before any further step runs, and
// observations cross IPC as closed codes only.

import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, describe, it, mock } from "node:test";

type ScanResult = { exact_hits: number; pattern_hits: number; kinds: string[] };
type RegistryLike = {
  register(value: string, source: string, minLength?: number): void;
  covers(candidate: string): boolean;
};
type HarnessModule = {
  IDENTITY_EXPECTATIONS: Record<string, string>;
  SecretRegistry: new () => RegistryLike;
  buildSampleEvidence(): unknown;
  serializeEvidence(evidence: unknown): string;
  scanPublishable(text: string, values: readonly string[]): ScanResult;
  extractSecretCandidates(text: string): Array<[string, string]>;
};

type Evaluation = { tag: string; code?: string };
type ResolverInput = {
  actorId: string;
  operatorId: string;
  capability: string;
  requiredLocationIds: string[];
  expectedAuthorityVersion: number;
  targetOperatorId?: string;
};
type FixtureUser = { email: string; password: string; uid: string };
type Fixture = {
  users: { A: FixtureUser; B: FixtureUser };
  ids: Record<string, { actorId: string; operatorId: string }>;
};
type CookieEntry = { name: string; value: string };
type CookieOptions = { maxAge?: number; expires?: Date | string | number } | undefined;

const IPC_CHILD = process.env.INV001_D6_IDENTITY_CHILD === "1" && typeof process.send === "function";
const HARNESS_URL = pathToFileURL(resolve(process.cwd(), "scripts/e2e/inv001-d6/run.mjs")).href;

async function loadHarness(): Promise<HarnessModule> {
  const specifier: string = HARNESS_URL;
  return (await import(specifier)) as HarnessModule;
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

describe("inv001 d6 two-channel secret scan", () => {
  let harness: HarnessModule;
  before(async () => {
    harness = await loadHarness();
  });

  it("sample evidence has zero exact and zero pattern hits", () => {
    const text = harness.serializeEvidence(harness.buildSampleEvidence());
    const unrelated = randomToken(32);
    const result = harness.scanPublishable(text, [unrelated]);
    assert.ok(result.exact_hits === 0 && result.pattern_hits === 0, "SAMPLE_EVIDENCE_NOT_CLEAN");
  });

  it("every registered encoding of a value is an exact hit", () => {
    const value = randomToken(24);
    const encodings = [
      value,
      Buffer.from(value).toString("base64"),
      Buffer.from(value).toString("base64url"),
      encodeURIComponent(value),
      `base64-${Buffer.from(value).toString("base64url")}`,
    ];
    for (const encoded of encodings) {
      const result = harness.scanPublishable(`{"note":"${encoded}"}`, [value]);
      assert.ok(result.exact_hits === 1 && result.kinds.includes("registered_value"), "REGISTERED_VALUE_NOT_DETECTED");
    }
  });

  it("jwt-shaped and header-shaped text is a pattern hit without registration", () => {
    const segment = (json: object) => Buffer.from(JSON.stringify(json)).toString("base64url");
    const shaped = `${segment({ alg: "HS256" })}.${segment({ sub: "x" })}.${randomToken(32)}`;
    const jwtResult = harness.scanPublishable(`{"v":"${shaped}"}`, []);
    assert.ok(jwtResult.pattern_hits >= 1 && jwtResult.kinds.includes("jwt"), "JWT_PATTERN_NOT_DETECTED");
    const headerWord = ["Author", "ization:"].join("");
    const headerResult = harness.scanPublishable(`${headerWord} x`, []);
    assert.ok(headerResult.kinds.includes("authorization_header"), "HEADER_PATTERN_NOT_DETECTED");
  });

  it("secret candidates are extracted and covered only after registration", () => {
    const value = randomToken(24);
    const field = ["access", "token"].join("_");
    const text = `{"${field}":"${value}"} ${field}=${encodeURIComponent(value)}`;
    const candidates = harness.extractSecretCandidates(text);
    assert.ok(candidates.length >= 2 && candidates.every(([kind]) => kind === "token_field"), "CANDIDATES_NOT_EXTRACTED");
    const registry = new harness.SecretRegistry();
    assert.ok(candidates.every(([, candidate]) => !registry.covers(candidate)), "EMPTY_REGISTRY_COVERS");
    registry.register(value, "harness_generated");
    assert.ok(candidates.every(([, candidate]) => registry.covers(candidate)), "REGISTERED_CANDIDATE_NOT_COVERED");
  });

  it("identity expectations are closed codes keyed by assertion", () => {
    for (const [key, code] of Object.entries(harness.IDENTITY_EXPECTATIONS)) {
      assert.ok(/^A(0[4-8]|1[345])_[a-z_]+$/u.test(key), "EXPECTATION_KEY_SHAPE");
      assert.ok(/^[A-Za-z_]{1,64}$/u.test(code), "EXPECTATION_CODE_SHAPE");
    }
  });
});

if (IPC_CHILD) {
  // Module mocks must be registered before the resolver modules load.
  let jar = new Map<string, string>();
  const pendingValues: string[] = [];
  const cookieStore = {
    getAll(): CookieEntry[] {
      return [...jar].map(([name, value]) => ({ name, value }));
    },
    get(name: string): CookieEntry | undefined {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set(name: string, value: string, options?: CookieOptions): void {
      if (value.length === 0 || options?.maxAge === 0) {
        jar.delete(name);
        return;
      }
      pendingValues.push(value);
      jar.set(name, value);
    },
    delete(name: string): void {
      jar.delete(name);
    },
  };
  mock.module("server-only", { namedExports: {} });
  mock.module("next/headers", { namedExports: { cookies: async () => cookieStore } });

  let nextId = 0;
  const waiting = new Map<number, (ok: boolean) => void>();
  let fixtureResolve: ((fixture: Fixture) => void) | null = null;
  const fixturePromise = new Promise<Fixture>((resolveFixture) => {
    fixtureResolve = resolveFixture;
  });
  process.on("message", (message: { t?: string; id?: number; ok?: boolean } & Partial<Fixture>) => {
    if (message?.t === "fixture" && message.users && message.ids && fixtureResolve) {
      fixtureResolve({ users: message.users, ids: message.ids });
      fixtureResolve = null;
    } else if (message?.t === "ack" && typeof message.id === "number") {
      const settle = waiting.get(message.id);
      waiting.delete(message.id);
      settle?.(message.ok === true);
    }
  });

  const call = (payload: Record<string, unknown>, failCode: string): Promise<void> => {
    const id = ++nextId;
    return new Promise<void>((resolveCall, rejectCall) => {
      waiting.set(id, (ok) => (ok ? resolveCall() : rejectCall(new Error(failCode))));
      process.send?.({ ...payload, id });
    });
  };
  const registerValue = async (value: unknown): Promise<void> => {
    if (typeof value !== "string" || value.length < 8) return;
    await call({ t: "register", v: value }, "REGISTRATION_REJECTED");
  };
  const flushJar = async (): Promise<void> => {
    for (const value of pendingValues.splice(0)) await registerValue(value);
  };
  const observe = (key: string, value: string) => call({ t: "observe", key, value }, `OBSERVATION_REJECTED_${key}`);
  const mutate = (op: string) => call({ t: "mutate", op }, `MUTATION_FAILED_${op}`);
  const codeOf = (evaluation: Evaluation): string => (evaluation.tag === "authorized" ? "authorized" : evaluation.code ?? evaluation.tag);

  const tamperSignature = (jwt: string): string => {
    const parts = jwt.split(".");
    if (parts.length !== 3 || parts[2].length < 8) throw new Error("TOKEN_SHAPE_UNEXPECTED");
    const signature = parts[2];
    const index = signature.length >> 1;
    const replacement = signature[index] === "A" ? "B" : "A";
    return `${parts[0]}.${parts[1]}.${signature.slice(0, index)}${replacement}${signature.slice(index + 1)}`;
  };

  describe("inv001 d6 identity proof over disposable loopback stack", () => {
    let fixture: Fixture;
    let resolveAuthority: (input: unknown) => Promise<Evaluation>;
    let resolveForBearer: (input: unknown, uid: string, header: string | null) => Promise<Evaluation>;
    let resolveBearer: (header: string | null) => Promise<{ tag: string; userId?: string; code?: string }>;
    let createServerClient: typeof import("@supabase/ssr")["createServerClient"];

    before(async () => {
      ({ resolveOfficeAzInventoryAuthority: resolveAuthority, resolveOfficeAzInventoryAuthorityForBearerUser: resolveForBearer } =
        await import("@/lib/inventory/authority/resolve-office-az-inventory-authority"));
      ({ resolveOfficeAzInventoryMobileBearer: resolveBearer } =
        await import("@/lib/inventory/mobile/resolve-office-az-inventory-mobile-bearer"));
      ({ createServerClient } = await import("@supabase/ssr"));
      process.send?.({ t: "ready" });
      fixture = await fixturePromise;
    });

    after(() => {
      if (process.connected) process.disconnect();
    });

    const supabaseUrl = (): string => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("PUBLIC_ENV_MISSING");
      return url;
    };

    const clientFor = (target: Map<string, string>) => {
      const client = createServerClient(supabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
        cookies: {
          getAll: () => [...target].map(([name, value]) => ({ name, value })),
          setAll: async (cookiesToSet) => {
            for (const { name, value, options } of cookiesToSet) {
              if (value.length === 0 || options?.maxAge === 0) {
                target.delete(name);
                continue;
              }
              await registerValue(value);
              target.set(name, value);
            }
          },
        },
      });
      return { client };
    };

    const signIn = async (user: FixtureUser): Promise<{ cookies: Map<string, string>; accessToken: string }> => {
      const cookies = new Map<string, string>();
      const { client } = clientFor(cookies);
      const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
      const session = data?.session;
      if (error || !session) throw new Error("SIGN_IN_FAILED");
      await registerValue(session.access_token);
      await registerValue(session.refresh_token);
      for (let attempt = 0; attempt < 20 && ![...cookies.keys()].some((name) => name.startsWith("sb-")); attempt += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 25));
      }
      if (![...cookies.keys()].some((name) => name.startsWith("sb-"))) throw new Error("SESSION_COOKIE_NOT_WRITTEN");
      return { cookies, accessToken: session.access_token };
    };

    const asCookieUser = async (cookies: Map<string, string>, input: ResolverInput): Promise<string> => {
      jar = new Map(cookies);
      const evaluation = await resolveAuthority(input);
      await flushJar();
      return codeOf(evaluation);
    };

    const request = (key: string, overrides: Partial<ResolverInput> = {}): ResolverInput => ({
      actorId: fixture.ids[key].actorId,
      operatorId: fixture.ids[key].operatorId,
      capability: "inventory.quantity.read",
      requiredLocationIds: ["wh-a"],
      expectedAuthorityVersion: 1,
      ...overrides,
    });

    it("observes cookie, Bearer, lifecycle, and sign-out identity outcomes", async () => {
      const a = await signIn(fixture.users.A);
      const b = await signIn(fixture.users.B);

      await observe("A04_cookie_authorized", await asCookieUser(a.cookies, request("ok")));
      await observe("A06_cross_user", await asCookieUser(b.cookies, request("ok")));
      await observe("A15_service_candidate", await asCookieUser(b.cookies, request("svc")));
      await observe("A13_self_action", await asCookieUser(a.cookies, request("ok", { targetOperatorId: fixture.ids.ok.operatorId })));
      await observe("A14_location_not_granted", await asCookieUser(a.cookies, request("ok", { requiredLocationIds: ["wh-b"] })));
      await observe("A14_unknown_location", await asCookieUser(a.cookies, request("unknown", { requiredLocationIds: ["wh-x"] })));

      await observe("A08_lifecycle_active", await asCookieUser(a.cookies, request("life")));
      await mutate("lifecycle_suspend");
      await observe("A08_suspended", await asCookieUser(a.cookies, request("life")));
      await mutate("lifecycle_revoke");
      await observe("A08_revoked", await asCookieUser(a.cookies, request("life")));
      await observe("A08_expired", await asCookieUser(a.cookies, request("expired")));
      await observe("A08_not_yet_valid", await asCookieUser(a.cookies, request("future")));
      await observe("A08_stale_version", await asCookieUser(a.cookies, request("ok", { expectedAuthorityVersion: 2 })));
      await observe("A08_grant_active", await asCookieUser(a.cookies, request("grant")));
      await mutate("grant_delete");
      await observe("A08_grant_deleted", await asCookieUser(a.cookies, request("grant")));

      jar = new Map();
      const scheme = "Bearer";
      const header = `${scheme} ${a.accessToken}`;
      const bearer = await resolveBearer(header);
      await observe("A07_bearer_identity",
        bearer.tag === "authenticated" && bearer.userId === fixture.users.A.uid ? "authenticated_same_uid" : bearer.code ?? "authenticated_other_uid");
      await observe("A07_bearer_authority", codeOf(await resolveForBearer(request("ok"), fixture.users.A.uid, header)));
      const malformed: Array<[string, string | null]> = [
        ["A07_malformed_absent", null],
        ["A07_malformed_lowercase_scheme", `${scheme.toLowerCase()} ${a.accessToken}`],
        ["A07_malformed_double_space", `${scheme}  ${a.accessToken}`],
        ["A07_malformed_comma_joined", `${header},${header}`],
        ["A07_malformed_basic_scheme", `Basic ${a.accessToken}`],
      ];
      for (const [key, value] of malformed) {
        const result = await resolveBearer(value);
        await observe(key, result.tag === "authenticated" ? "authenticated" : result.code ?? result.tag);
      }
      const tampered = tamperSignature(a.accessToken);
      await registerValue(tampered);
      const invalid = await resolveBearer(`${scheme} ${tampered}`);
      await observe("A07_invalid_signature", invalid.tag === "authenticated" ? "authenticated" : invalid.code ?? invalid.tag);
      await observe("A07_foreign_user", codeOf(await resolveForBearer(request("ok"), fixture.users.B.uid, header)));

      await observe("A05_no_cookie", await asCookieUser(new Map(), request("ok")));
      const tamperedCookies = new Map<string, string>();
      for (const [name, value] of a.cookies) {
        if (!value.startsWith("base64-")) throw new Error("COOKIE_ENCODING_UNEXPECTED");
        const session = JSON.parse(Buffer.from(value.slice("base64-".length), "base64url").toString("utf8")) as Record<string, unknown>;
        const accessKey = ["access", "token"].join("_");
        const token = session[accessKey];
        if (typeof token !== "string") throw new Error("COOKIE_SESSION_SHAPE_UNEXPECTED");
        session[accessKey] = tamperSignature(token);
        await registerValue(session[accessKey]);
        const encoded = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
        await registerValue(encoded);
        tamperedCookies.set(name, encoded);
      }
      await observe("A05_tampered_cookie", await asCookieUser(tamperedCookies, request("ok")));

      const second = await signIn(fixture.users.A);
      const beforeSignOut = new Map(second.cookies);
      const { client } = clientFor(second.cookies);
      const { error: signOutError } = await client.auth.signOut({ scope: "global" });
      if (signOutError) throw new Error("SIGN_OUT_FAILED");
      const remaining = [...second.cookies].filter(([name, value]) => name.startsWith("sb-") && value.length > 0);
      await observe("A05_signout_cookies_removed", remaining.length === 0 ? "removed" : "retained");
      await observe("A05_after_signout", await asCookieUser(beforeSignOut, request("ok")));

      await observe("DONE", "complete");
    });
  });
}
