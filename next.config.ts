import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

// ── REL-1: production release identity ──────────────────────────────────────
//
// The release is the deployed Git commit SHA — the only value that identifies
// exactly one build. It is resolved ONCE, at build time, and inlined so the
// client bundle and the server runtime report the SAME release for one incident.
//
// ── WHY THIS HAS TO HAPPEN IN next.config.ts ────────────────────────────────
// `sanitize-observability-event.ts` already prefers VERCEL_GIT_COMMIT_SHA, but
// that variable can never reach the browser: Next inlines ONLY `NEXT_PUBLIC_*`
// (plus this file's `env` block). So in a production client bundle step 1 was
// always undefined, nothing assigned NEXT_PUBLIC_GIT_COMMIT, and every uncaught
// UI error reported `release: "unknown"` — unattributable to any build. This
// file is the one seam that can both supply the value and fail the build when it
// is missing. The sanitizer's precedence order is correct and stays untouched.
//
// ── WHY IT FAILS CLOSED ─────────────────────────────────────────────────────
// A production build with no release identity is worse than a failed build: it
// ships silently, and every incident it later produces is unattributable. A
// malformed or self-contradictory SHA is worse still, because it looks
// authoritative while pointing at the wrong code.

/** Exactly 40 lowercase hex characters. Anything else is not a commit SHA. */
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export type ReleaseIdentityDeps = {
  readonly nodeEnv: string | undefined;
  readonly vercelSha: string | undefined;
  readonly publicSha: string | undefined;
  /**
   * Returns the local Git HEAD as an EXACT 40-character SHA, or undefined when
   * Git metadata is unavailable.
   *
   * Removing the command's line ending is the adapter's job (see
   * `readLocalGitHead`). A value reaching the resolver with whitespace or a
   * newline still attached is malformed and will not be accepted.
   */
  readonly readGitHead: () => string | undefined;
};

/**
 * Validate a candidate SHA. STRICT — the value must ALREADY be exactly 40 hex
 * characters, with nothing around it.
 *
 * Three outcomes, deliberately distinct:
 *   • `undefined` — absent, or the EXACT empty string, i.e. NOT CONFIGURED;
 *                   try the next source.
 *   • a string    — valid, lowercased.
 *   • `null`      — SUPPLIED BUT MALFORMED; fail the build.
 *
 * ── WHY THIS DOES NOT TRIM ──────────────────────────────────────────────────
 * It used to call `.trim()`, which silently accepted `" <sha>\n"` and every
 * other padded variant. That is the wrong default for a value that arrives from
 * an environment variable or a CI expression: stray whitespace there means
 * something upstream is malformed — a mis-quoted shell substitution, a here-doc
 * that kept its newline, a copy-paste from a log — and quietly repairing it hides
 * a real configuration fault while producing a release string that no longer
 * byte-matches what the operator set. Whitespace is also invisible in a build
 * log, so the repair would be undetectable.
 *
 * Only ONE source is allowed to normalize, and only for a line ending it
 * produced itself: `readLocalGitHead`, whose output is a trusted, known-shaped
 * command result rather than caller-supplied configuration.
 */
function normalizeSha(value: string | undefined): string | undefined | null {
  if (typeof value !== "string") return undefined;
  if (value === "") return undefined;           // exactly empty = not configured
  const lowered = value.toLowerCase();
  return COMMIT_SHA_PATTERN.test(lowered) ? lowered : null;
}

/**
 * Resolve the canonical release identity.
 *
 * Precedence: VERCEL_GIT_COMMIT_SHA → NEXT_PUBLIC_GIT_COMMIT → local Git HEAD.
 *
 * Throws a FIXED, non-sensitive message on every fail-closed condition. The
 * offending value is never interpolated into it: a build log is widely readable,
 * and echoing an unvalidated environment value into one is how a misassigned
 * secret ends up in a CI transcript.
 *
 * @returns the 40-char lowercase SHA, or `undefined` when unresolvable outside
 *          production, where an absent release is acceptable.
 */
export function resolveReleaseIdentity(deps: ReleaseIdentityDeps): string | undefined {
  const vercel = normalizeSha(deps.vercelSha);
  if (vercel === null) {
    throw new Error("REL-1: VERCEL_GIT_COMMIT_SHA is not a 40-character commit SHA.");
  }

  const publicSha = normalizeSha(deps.publicSha);
  if (publicSha === null) {
    throw new Error("REL-1: NEXT_PUBLIC_GIT_COMMIT is not a 40-character commit SHA.");
  }

  // Two valid but DIFFERENT sources describe an ambiguous build. Choosing either
  // would label the deploy with a commit it might not contain.
  if (vercel !== undefined && publicSha !== undefined && vercel !== publicSha) {
    throw new Error(
      "REL-1: VERCEL_GIT_COMMIT_SHA and NEXT_PUBLIC_GIT_COMMIT disagree; refusing an ambiguous release.",
    );
  }

  const configured = vercel ?? publicSha;
  if (configured !== undefined) return configured;

  // No configured source: fall back to local Git, but only when it is genuinely a
  // SHA. A failed read is "unavailable" — never an invented or partial value.
  //
  // The try/catch belongs HERE and not only in the default reader. Containing it
  // solely inside `readLocalGitHead` would leave the resolver's guarantee resting
  // on the good behaviour of whatever reader it is handed: a throwing one would
  // escape carrying ITS OWN message, replacing this function's fixed, audited text
  // with arbitrary output in a build log — the exact leak the fixed messages exist
  // to prevent. A reader that throws means the same thing as one that returns
  // nothing: unavailable.
  let local: string | undefined | null;
  try {
    local = normalizeSha(deps.readGitHead());
  } catch {
    local = undefined;
  }
  if (typeof local === "string") return local;

  if (deps.nodeEnv === "production") {
    throw new Error(
      "REL-1: no release identity is resolvable for a production build. " +
        "Set NEXT_PUBLIC_GIT_COMMIT to the 40-character deploy commit SHA.",
    );
  }

  return undefined;
}

/**
 * The production Git reader — the ONE trusted adapter, and the only place a line
 * ending is removed.
 *
 * `execFileSync` with LITERAL arguments — no shell, no interpolation, so there is
 * no command string for anything to be injected into. Any failure (Git absent, no
 * repository, a shallow checkout) becomes "unavailable", which production turns
 * into a build error above and other environments simply tolerate.
 *
 * `git rev-parse HEAD` terminates its output with a single line ending. That is a
 * property of THIS command, known here, so stripping exactly one trailing `\n` or
 * `\r\n` is a local adapter concern — not a licence for the generic validator to
 * accept padded input from anywhere else. Nothing further is stripped: interior
 * or leading whitespace still fails validation, because it would mean the command
 * returned something other than a bare SHA.
 */
function readLocalGitHead(): string | undefined {
  try {
    const raw = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    return raw.replace(/\r?\n$/, "");
  } catch {
    return undefined;
  }
}

// Exactly three variables are read, by name. `process.env` is never enumerated,
// serialized or mutated, so nothing else can be swept into the client bundle.
const releaseIdentity = resolveReleaseIdentity({
  nodeEnv:     process.env.NODE_ENV,
  vercelSha:   process.env.VERCEL_GIT_COMMIT_SHA,
  publicSha:   process.env.NEXT_PUBLIC_GIT_COMMIT,
  readGitHead: readLocalGitHead,
});

export const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The ONLY public config value this file adds. VERCEL_GIT_COMMIT_SHA is
  // deliberately not exposed under its own name: one canonical public identifier,
  // not two that could drift. A commit SHA is public repository metadata.
  ...(releaseIdentity !== undefined
    ? { env: { NEXT_PUBLIC_GIT_COMMIT: releaseIdentity } }
    : {}),
  // heic-convert (+ its libheif-js WASM) and sharp are native/WASM-backed and must
  // run un-bundled on the server so the vehicle-registration OCR image pipeline can
  // decode HEIC/HEIF → JPEG before the sharp enhancement step.
  serverExternalPackages: ['@react-pdf/renderer', 'sharp', 'heic-convert', 'libheif-js'],
  // Bundle the local Japanese PDF fonts (M PLUS 1p, OFL) and the rasterised document brand assets
  // (GYEON marks, SNS icons, QR placeholder) into the serverless functions that render PDFs, so
  // registerPdfFonts() and the brand-asset resolver can read them from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/pdf/fonts/*.ttf", "./src/lib/pdf/brand-assets/*.png"],
  },
  experimental: {
    serverActions: {
      // iPhone 12MP photos average 6-8 MB. Allow up to 20 MB to handle
      // uncompressed HEIC-converted JPEGs while client-side compression
      // reduces typical payloads to well under 1 MB before they leave the device.
      bodySizeLimit: '20mb',
    },
  },
};

export default withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
