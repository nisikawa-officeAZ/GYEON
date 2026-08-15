// REL-1 — build-time release identity.
//
// Run: node --import tsx --test src/lib/observability/release-identity.test.ts
//
// The resolver is dependency-injected, so every precedence and fail-closed rule
// is exercised WITHOUT mutating process.env, running a build, or touching the
// real .git directory. The only test that reads real Git state does so through
// the production default path, read-only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { resolveReleaseIdentity, nextConfig, type ReleaseIdentityDeps } from "../../../next.config";

const SHA_A = "8b7d59df3eedd93197347692ed9e786a41591dac";
const SHA_B = "cbe6f465404418d6e75506b7f8858cedfbda8562";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

/** Defaults: nothing configured, Git unavailable, non-production. */
function deps(over: Partial<ReleaseIdentityDeps> = {}): ReleaseIdentityDeps {
  return {
    nodeEnv: "development",
    vercelSha: undefined,
    publicSha: undefined,
    readGitHead: () => undefined,
    ...over,
  };
}

// ── 1-3. Precedence ─────────────────────────────────────────────────────────

test("1. a valid VERCEL_GIT_COMMIT_SHA resolves, and wins", () => {
  assert.equal(resolveReleaseIdentity(deps({ vercelSha: SHA_A })), SHA_A);
  // It outranks a local Git HEAD.
  assert.equal(
    resolveReleaseIdentity(deps({ vercelSha: SHA_A, readGitHead: () => SHA_B })),
    SHA_A,
    "the deployment SHA outranks whatever the build machine has checked out",
  );
});

test("2. NEXT_PUBLIC_GIT_COMMIT resolves when the Vercel SHA is absent", () => {
  assert.equal(resolveReleaseIdentity(deps({ publicSha: SHA_A })), SHA_A);
  assert.equal(
    resolveReleaseIdentity(deps({ publicSha: SHA_A, readGitHead: () => SHA_B })),
    SHA_A,
    "an explicitly configured SHA outranks local Git",
  );
});

test("3. the local Git HEAD resolves when both environment values are absent", () => {
  // The injected reader contract is an EXACT 40-char SHA. Stripping the command's
  // line ending is the trusted adapter's job (test 12), not the resolver's.
  assert.equal(resolveReleaseIdentity(deps({ readGitHead: () => SHA_A })), SHA_A);
});

// ── 1-2, 4. Exact-form acceptance and normalization ─────────────────────────

test("1b/2b. an EXACT lowercase SHA is accepted from every source", () => {
  assert.equal(SHA_A, SHA_A.toLowerCase(), "PRECONDITION: the fixture is lowercase");
  assert.equal(resolveReleaseIdentity(deps({ vercelSha: SHA_A })), SHA_A);
  assert.equal(resolveReleaseIdentity(deps({ publicSha: SHA_A })), SHA_A);
  assert.equal(resolveReleaseIdentity(deps({ readGitHead: () => SHA_A })), SHA_A);
});

test("4. an EXACT uppercase SHA is accepted and lowercased", () => {
  const upper = SHA_A.toUpperCase();
  const mixed = SHA_A.slice(0, 8).toUpperCase() + SHA_A.slice(8);
  assert.notEqual(upper, SHA_A, "PRECONDITION: the fixture really is uppercase");
  for (const key of ["vercelSha", "publicSha"] as const) {
    assert.equal(resolveReleaseIdentity(deps({ [key]: upper })), SHA_A, `${key} uppercase normalized`);
    assert.equal(resolveReleaseIdentity(deps({ [key]: mixed })), SHA_A, `${key} mixed case normalized`);
  }
  assert.equal(resolveReleaseIdentity(deps({ readGitHead: () => upper })), SHA_A, "git output normalized");
});

// ── 3-8, 11. Whitespace is MALFORMED, never repaired ────────────────────────
//
// Stray whitespace in a configured SHA means something upstream is broken — a
// mis-quoted shell substitution, a here-doc that kept its newline, a paste from a
// log. Trimming it would hide a real configuration fault AND produce a release
// string that no longer byte-matches what the operator set, invisibly.

const PADDED: Array<[string, string]> = [
  [`${SHA_A} `,      "trailing space"],
  [` ${SHA_A}`,      "leading space"],
  [` ${SHA_A} `,     "surrounding spaces"],
  [`${SHA_A}\n`,     "trailing LF"],
  [`${SHA_A}\r\n`,   "trailing CRLF"],
  [`\n${SHA_A}`,     "leading LF"],
  [`${SHA_A}\t`,     "trailing tab"],
  [`\t${SHA_A}`,     "leading tab"],
  [`${SHA_A}\r`,     "trailing CR"],
  [`${SHA_A} `, "trailing non-breaking space"],
];

test("3-7. a full 40-char SHA with ANY surrounding whitespace is rejected", () => {
  for (const [padded, label] of PADDED) {
    assert.notEqual(padded, SHA_A, `PRECONDITION (${label}): the fixture really is padded`);
    assert.equal(padded.includes(SHA_A), true, `PRECONDITION (${label}): it contains a valid SHA`);

    assert.throws(
      () => resolveReleaseIdentity(deps({ vercelSha: padded })),
      /VERCEL_GIT_COMMIT_SHA is not a 40-character commit SHA/,
      `vercel: ${label} must be rejected, not trimmed`,
    );
    assert.throws(
      () => resolveReleaseIdentity(deps({ publicSha: padded })),
      /NEXT_PUBLIC_GIT_COMMIT is not a 40-character commit SHA/,
      `public: ${label} must be rejected, not trimmed`,
    );
  }
});

test("8. a whitespace-only configured value is rejected, not treated as absent", () => {
  // Only the EXACT empty string means "not configured". Blank-but-present is a
  // misconfiguration and must not fall through to a lower-precedence source.
  for (const blank of [" ", "   ", "\n", "\t", "\r\n", " \t "]) {
    assert.throws(
      () => resolveReleaseIdentity(deps({ vercelSha: blank, readGitHead: () => SHA_B })),
      /VERCEL_GIT_COMMIT_SHA is not a 40-character commit SHA/,
      `vercel: ${JSON.stringify(blank)} must fail closed`,
    );
    assert.throws(
      () => resolveReleaseIdentity(deps({ publicSha: blank, readGitHead: () => SHA_B })),
      /NEXT_PUBLIC_GIT_COMMIT is not a 40-character commit SHA/,
      `public: ${JSON.stringify(blank)} must fail closed`,
    );
  }
  // The exact empty string IS "not configured" and does fall through.
  assert.equal(resolveReleaseIdentity(deps({ vercelSha: "", publicSha: "", readGitHead: () => SHA_B })), SHA_B);
});

test("11. injected Git output carrying whitespace or a newline is unresolvable", () => {
  for (const [padded, label] of PADDED) {
    // Not a build error by itself outside production — simply no release.
    assert.equal(
      resolveReleaseIdentity(deps({ nodeEnv: "development", readGitHead: () => padded })),
      undefined,
      `${label} from an injected reader must not be accepted`,
    );
    // And in production it is the fixed unresolvable error, never a repaired value.
    assert.throws(
      () => resolveReleaseIdentity(deps({ nodeEnv: "production", readGitHead: () => padded })),
      /no release identity is resolvable for a production build/,
      `${label} must not satisfy a production build`,
    );
  }
});

// ── 5-7. Fail closed ────────────────────────────────────────────────────────

const MALFORMED = [
  "not-a-sha",
  "8b7d59df",                                    // too short (abbreviated)
  `${SHA_A}0`,                                   // too long
  SHA_A.replace("8", "g"),                       // non-hex character
  "8b7d59df3eedd93197347692ed9e786a41591da ",    // 39 significant chars
  "0",
  "HEAD",
  "${IFS}",
];

test("5. a malformed VERCEL_GIT_COMMIT_SHA fails closed", () => {
  for (const bad of MALFORMED) {
    assert.throws(
      () => resolveReleaseIdentity(deps({ vercelSha: bad })),
      /VERCEL_GIT_COMMIT_SHA is not a 40-character commit SHA/,
      `${JSON.stringify(bad)} must not be accepted`,
    );
  }
});

test("5b. a malformed Vercel SHA does NOT fall through to a lower source", () => {
  // Falling through would attribute the deploy to the build machine's checkout
  // instead of the configured commit — silently wrong, and worse than failing.
  assert.throws(
    () => resolveReleaseIdentity(deps({ vercelSha: "not-a-sha", publicSha: SHA_B, readGitHead: () => SHA_B })),
    /VERCEL_GIT_COMMIT_SHA/,
  );
});

test("6. a malformed NEXT_PUBLIC_GIT_COMMIT fails closed", () => {
  for (const bad of MALFORMED) {
    assert.throws(
      () => resolveReleaseIdentity(deps({ publicSha: bad })),
      /NEXT_PUBLIC_GIT_COMMIT is not a 40-character commit SHA/,
      `${JSON.stringify(bad)} must not be accepted`,
    );
  }
  assert.throws(
    () => resolveReleaseIdentity(deps({ publicSha: "nope", readGitHead: () => SHA_A })),
    /NEXT_PUBLIC_GIT_COMMIT/,
    "does not fall through to local Git",
  );
});

test("7. two valid but DIFFERENT environment SHAs fail closed", () => {
  assert.notEqual(SHA_A, SHA_B, "PRECONDITION: the fixtures really differ");
  assert.throws(
    () => resolveReleaseIdentity(deps({ vercelSha: SHA_A, publicSha: SHA_B })),
    /disagree; refusing an ambiguous release/,
  );
  // Case difference alone is NOT a disagreement — both normalize identically.
  assert.equal(
    resolveReleaseIdentity(deps({ vercelSha: SHA_A, publicSha: SHA_A.toUpperCase() })),
    SHA_A,
    "the same commit in different case is one release, not an ambiguity",
  );
});

// ── 8-9. Production vs non-production ───────────────────────────────────────

test("8. production with no env SHA and a FAILED Git read throws", () => {
  let readerCalled = 0;
  const failingReader = () => { readerCalled += 1; throw new Error("git: not a repository"); };

  // The THROWING reader is passed straight in, uncaught by the test. The resolver
  // must contain it and still produce its own fixed message — otherwise the
  // reader's arbitrary error text would reach the build log in its place.
  assert.throws(
    () => resolveReleaseIdentity(deps({ nodeEnv: "production", readGitHead: failingReader })),
    /no release identity is resolvable for a production build/,
  );
  assert.equal(readerCalled, 1, "PRECONDITION: the Git reader really was consulted");

  // The reader's own message must NOT be what surfaces.
  try {
    resolveReleaseIdentity(deps({ nodeEnv: "production", readGitHead: () => { throw new Error("CANARY-READER-DETAIL"); } }));
    assert.fail("expected a throw");
  } catch (err) {
    assert.equal((err as Error).message.includes("CANARY-READER-DETAIL"), false,
      "a throwing reader's text must not replace the fixed REL-1 message");
    assert.match((err as Error).message, /^REL-1: /);
  }

  // A throwing reader outside production is simply "unavailable", not a crash.
  assert.equal(
    resolveReleaseIdentity(deps({ nodeEnv: "development", readGitHead: () => { throw new Error("boom"); } })),
    undefined,
  );

  // A reader that returns a non-SHA is equally unresolvable.
  for (const junk of [undefined, "", "   ", "not-a-sha", "HEAD"]) {
    assert.throws(
      () => resolveReleaseIdentity(deps({ nodeEnv: "production", readGitHead: () => junk })),
      /no release identity is resolvable for a production build/,
      `git output ${JSON.stringify(junk)} must not satisfy production`,
    );
  }
});

test("9. non-production with nothing resolvable does NOT invent a release", () => {
  for (const env of ["development", "test", undefined]) {
    const r = resolveReleaseIdentity(deps({ nodeEnv: env }));
    assert.equal(r, undefined, `${String(env)} yields no release rather than a fabricated one`);
  }
  // Nothing clock-based, random or version-derived may be substituted.
  const r = resolveReleaseIdentity(deps({ nodeEnv: "development" }));
  assert.notEqual(r, "unknown");
  assert.notEqual(r, "0.1.0");
});

// ── 10. The malformed value never appears in the error ──────────────────────

test("10. error text never includes the malformed input", () => {
  const SECRETISH = "sk-CANARY-LEAKED-SECRET-0123456789abcdef";
  const cases: Array<[Partial<ReleaseIdentityDeps>, string]> = [
    [{ vercelSha: SECRETISH }, "vercel"],
    [{ publicSha: SECRETISH }, "public"],
    [{ vercelSha: SHA_A, publicSha: SHA_B }, "mismatch"],
    [{ nodeEnv: "production" }, "unresolvable"],
  ];
  for (const [over, label] of cases) {
    try {
      resolveReleaseIdentity(deps(over));
      assert.fail(`${label}: expected a throw`);
    } catch (err) {
      const text = `${(err as Error).message}\n${(err as Error).stack ?? ""}`;
      assert.equal(text.includes(SECRETISH), false, `${label}: the supplied value leaked into the error`);
      assert.equal(text.includes("CANARY"), false, `${label}: partial echo`);
      // A build log is widely readable; the message must be fixed text only.
      assert.match((err as Error).message, /^REL-1: /, `${label}: fixed, prefixed message`);
    }
  }
  // The mismatch message must not disclose either SHA either.
  try {
    resolveReleaseIdentity(deps({ vercelSha: SHA_A, publicSha: SHA_B }));
    assert.fail("expected a throw");
  } catch (err) {
    const m = (err as Error).message;
    assert.equal(m.includes(SHA_A), false, "the mismatch message does not echo a SHA");
    assert.equal(m.includes(SHA_B), false);
  }
});

// ── 11-12. What the config actually exposes ─────────────────────────────────

test("11. nextConfig.env exposes ONLY NEXT_PUBLIC_GIT_COMMIT", () => {
  assert.ok(nextConfig.env, "PRECONDITION: an env block was produced in this environment");
  assert.deepEqual(Object.keys(nextConfig.env), ["NEXT_PUBLIC_GIT_COMMIT"],
    "exactly one public config value, and no other");
  // VERCEL_GIT_COMMIT_SHA is never re-exported under its own name.
  assert.equal("VERCEL_GIT_COMMIT_SHA" in nextConfig.env, false);
});

test("12. the exposed value is exactly 40 lowercase hex", () => {
  const value = nextConfig.env?.NEXT_PUBLIC_GIT_COMMIT;
  assert.equal(typeof value, "string");
  assert.match(value as string, SHA_PATTERN);
  assert.equal((value as string).length, 40);
  assert.equal(value, (value as string).toLowerCase());
  // Not a placeholder, not a fallback literal.
  for (const forbidden of ["unknown", "development", "test", "0.1.0", "HEAD"]) {
    assert.notEqual(value, forbidden);
  }
});

// ── 13. The real default reader works against this repository ───────────────

test("12/13. the real default reader resolves HEAD because IT strips the line ending", () => {
  // Read-only; the same literal-argument invocation the config uses.
  const raw = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });

  // PRECONDITION: git really does append a line ending, so the adapter's strip is
  // doing genuine work. Without this, the test could pass on output that never
  // needed normalizing and would prove nothing about the split of responsibility.
  assert.match(raw, /\r?\n$/, "git rev-parse output really is newline-terminated");
  assert.equal(SHA_PATTERN.test(raw), false, "and the RAW output is therefore not itself a valid SHA");

  // Handed to the resolver unmodified, that raw output is malformed — proving the
  // strictness is real and the adapter, not the resolver, is what makes it work.
  assert.equal(resolveReleaseIdentity(deps({ readGitHead: () => raw })), undefined);

  const head = raw.replace(/\r?\n$/, "").toLowerCase();
  assert.match(head, SHA_PATTERN, "PRECONDITION: this repository really has a SHA HEAD");
  assert.equal(resolveReleaseIdentity(deps({ readGitHead: () => head })), head);

  // And that is exactly what the config resolved through the real default reader,
  // so the build is attributable to the commit actually checked out.
  assert.equal(nextConfig.env?.NEXT_PUBLIC_GIT_COMMIT, head,
    "the config's release IS this repository's HEAD");
});

// ── Source guards for the resolver itself ───────────────────────────────────

test("no trim of any kind is applied to environment values", () => {
  const code = readFileSync("next.config.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  for (const t of ["trim" + "()", "trim" + "Start()", "trim" + "End()"]) {
    assert.equal(code.includes(t), false, `${t} would silently repair a malformed configured value`);
  }
  // Exactly one normalization exists, it strips only a trailing line ending, and
  // it lives in the trusted Git adapter — not in the generic validator.
  const strips = [...code.matchAll(/\.replace\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.deepEqual(strips, ['/\\r?\\n$/, ""'], "one strip, anchored to end-of-string only");
  assert.match(code, /execFileSync\([\s\S]{0,120}\.replace\(\/\\r\?\\n\$\/, ""\)/,
    "the strip is applied to the command result inside the adapter");
});

test("the Git read uses literal arguments and no shell", () => {
  const code = readFileSync("next.config.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  assert.match(code, /execFileSync\("git",\s*\["rev-parse",\s*"HEAD"\]/, "literal argument vector");
  for (const hazard of ["exec" + "Sync(", "spawn" + "Sync(", "shell:", "child_process\").exec"]) {
    assert.equal(code.includes(hazard), false, `${hazard} permits shell interpretation`);
  }
  assert.equal(/`git [^`]*\$\{/.test(code), false, "no interpolation into a command string");
});

test("process.env is read by name only — never enumerated, serialized or mutated", () => {
  const code = readFileSync("next.config.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const reads = [...code.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(reads)].sort(), ["NEXT_PUBLIC_GIT_COMMIT", "NODE_ENV", "VERCEL_GIT_COMMIT_SHA"],
    "exactly the three permitted variables");

  assert.equal(/Object\.(keys|values|entries|assign)\s*\(\s*process\.env/.test(code), false, "never enumerated");
  assert.equal(/for\s*\(\s*const\s+\w+\s+in\s+process\.env/.test(code), false, "never for-in'd");
  assert.equal(/JSON\.stringify\s*\(\s*process\.env/.test(code), false, "never serialized");
  assert.equal(/\.\.\.\s*process\.env/.test(code), false, "never spread");
  assert.equal(/process\.env\.[A-Za-z_][A-Za-z0-9_]*\s*=[^=]/.test(code), false, "never mutated");
  assert.equal(/process\.env\[/.test(code), false, "no computed variable access");
});

test("no clock, randomness, package version or worktree state becomes the release", () => {
  const code = readFileSync("next.config.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const token of ["Date.now", "new Date", "Math.random", "randomUUID",
                       "package.json", "version", "status --porcelain", "describe", "--dirty"]) {
    assert.equal(code.includes(token), false, `${token} must not influence the release`);
  }
});

test("the existing PWA, PDF, HEIC and Server Action configuration is unchanged", () => {
  assert.equal(nextConfig.reactStrictMode, true);
  assert.deepEqual(nextConfig.serverExternalPackages,
    ["@react-pdf/renderer", "sharp", "heic-convert", "libheif-js"]);
  assert.deepEqual(nextConfig.outputFileTracingIncludes, {
    "/**": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/brand-assets/*.png"],
  });
  assert.equal(nextConfig.experimental?.serverActions?.bodySizeLimit, "20mb");

  const code = readFileSync("next.config.ts", "utf8");
  assert.match(code, /withPWA\(\{/, "the PWA wrapper still wraps the config");
  assert.match(code, /dest: "public"/);
  assert.match(code, /disable: process\.env\.NODE_ENV === "development"/);
});
