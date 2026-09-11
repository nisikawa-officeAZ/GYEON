# GDA Estimate PDF Chromium Bin Trace R3 Repair

## 1. Phase identity

- Phase: `GDA_ESTIMATE_PDF_CHROMIUM_BIN_TRACE_R3_REPAIR`
- Repository: `nisikawa-officeAZ/GYEON`
- Coordination PR: `https://github.com/nisikawa-officeAZ/GYEON/pull/67`
- Branch: `agent/gda-estimate-ocr-postal-clean-replacement-r1`
- Pre-governance source HEAD: `83e18e94be3774b58434dff3f7a215619345498b`
- Pre-governance source tree: `4ae4238e9382b5bbcbd36bc97d7a755eb933d34f`
- Fixed Preview deployment: `dpl_AdyEnDo3ZZ7rpKLc8sM2AxQpDqZ8`
- Fixed Preview URL: `https://dealeros-ixqol6xwe-nisikawa-5024s-projects.vercel.app`

The newest non-superseded PR #67 instruction posted after this directive is delivered
must name the exact governance commit/tree that Claude checks out. That instruction,
this directive, and the exact PR HEAD must agree before any edit or test begins.

This is the single active MacBook implementation phase. The postal-master CR6 work and
the remaining postal-environment activation from the prior demo hotfix are preserved and
held, not cancelled or merged into this phase.

## 2. Owner authorization

The Owner explicitly authorized one combined bounded workflow:

1. deliver this phase through exactly three governance paths;
2. normally push that governance commit to PR #67 and publish one public-safe instruction;
3. invoke Anthropic Claude Code for the exact two-file repair and exact verification
   commands below; and
4. stop with the source candidate uncommitted and unpushed.

This authorization does not permit a source commit, source push, Preview/production
deployment, Vercel mutation, database/Supabase action, dependency installation, Ready
conversion, or merge.

## 3. Accepted failure evidence and root cause

Two different symptoms were independently separated:

1. the Owner's original Chrome profile blocked the direct PDF request with
   `net::ERR_BLOCKED_BY_CLIENT`; and
2. a clean extension-free authenticated browser reached the application route but the
   inline frame returned `PDFの生成に失敗しました`.

The fixed Vercel Preview runtime then recorded the authoritative server error:

```text
[estimate pdf] render failed: Error: The input directory "/var/task/node_modules/@sparticuz/chromium/bin" does not exist. If you are using a bundler (esbuild, webpack, etc.), you must externalize @sparticuz/chromium so it is not relocated.
```

The build used Next.js `15.5.19` with `next build --turbopack`. The current
`next.config.ts` already externalizes `puppeteer-core` and `@sparticuz/chromium`, but its
`outputFileTracingIncludes` does not include the Chromium binary directory. The immediate
failure is therefore a missing serverless-bundle asset, not an estimate save, pricing,
OCR, postal, customer, vehicle, database, or authorization failure.

Do not change the Node version, disable Turbopack, switch PDF renderers, add a fallback,
or alter the PDF route/renderer/template unless a later separately governed diagnosis
proves this exact repair insufficient.

## 4. Required first checks

Before editing, Claude must confirm and report:

1. the repository, branch, PR, and exact execution HEAD/tree match the newest PR #67
   instruction;
2. that execution commit has the pre-governance source HEAD above as its single parent;
3. the committed delta from that parent contains exactly the three governance paths;
4. the Git index is clean;
5. the only permitted pre-existing worktree exceptions are the three untracked postal
   governance files named in section 8;
6. `next.config.ts` contains the existing external-package list and global tracing list;
7. the protected file in section 7 matches its metadata without opening its contents.

Any mismatch returns `BLOCKED_ENVIRONMENT` without editing, cleaning, stashing, restoring,
or installing anything.

## 5. Exact implementation allowlist

Claude may edit exactly these two existing paths:

1. `next.config.ts`
2. `src/lib/observability/release-identity.test.ts`

No file may be created, deleted, renamed, formatted, staged, committed, or modified
outside this list.

## 6. Required repair contract

1. Preserve every existing `next.config.ts` setting and every existing global
   `outputFileTracingIncludes["/**"]` path.
2. Preserve the current `serverExternalPackages` list, including `puppeteer-core` and
   `@sparticuz/chromium`.
3. Add exactly this route-specific trace contract:

   ```ts
   "/pdf/estimate": ["./node_modules/@sparticuz/chromium/bin/**"]
   ```

4. Do not add the Chromium binary glob to the global `"/**"` entry. The binary must be
   traced only into the estimate-PDF server function rather than every server function.
5. Update only the existing configuration-preservation assertions in
   `release-identity.test.ts` so they pin the already-current external-package list, all
   already-current global trace paths, and the new route-specific Chromium binary trace.
6. Do not weaken release-identity, PWA, HEIC, PDF asset, Server Action, or production
   build assertions.
7. Do not change `package.json`, `package-lock.json`, build scripts, runtime declarations,
   PDF application source, OCR/postal/pricing source, or any database artifact.

## 7. Protected path

`src/components/estimates/wizard/screens/ScreensPreview.tsx` remains pathname, mode,
size, hash, and Git-state only. Never open, read, diff, copy, stage, or modify it.

- mode: `-rw-r--r--`
- size: `31076`
- SHA-256: `d0901dd4b1aeabb5ca648d356bbeb37e435ffd0114ee3fdbdbd5d32fc3ca515e`

The other protected paths in `AGENTS.md` remain unchanged and out of scope.

## 8. Preserved unrelated work

These three existing untracked files belong to held postal-master work and must remain
byte-identical, untracked, unstaged, and untouched:

1. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R1_LIST_STDERR_COMPATIBILITY_DIAGNOSIS.md`
2. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3J_R2_LIST_ONLY_REDACTED_CAPTURE.md`
3. `docs/master_specification/CLAUDE_DIRECTIVE_GDA_ESTIMATE_WIZARD_POSTAL_MASTER_R5_CR6_R3K_R1_PREFLIGHT_IDENTITY_GATE_DIAGNOSIS.md`

Do not clean, add, remove, rename, stash, restore, or inspect their contents.

## 9. Exact verification commands

Run each command once, in order, after the two-file edit:

```text
node --import tsx --test src/lib/observability/release-identity.test.ts
node --import tsx --test src/app/pdf/estimate/route.test.ts
npm run typecheck
npm run build
git diff --check -- next.config.ts src/lib/observability/release-identity.test.ts
git diff -- next.config.ts src/lib/observability/release-identity.test.ts
git status --short
```

Do not install dependencies or modify package/lock files if the existing environment
cannot run a command. Return `BLOCKED_ENVIRONMENT` instead. No browser, Vercel, network,
database, Supabase, provider, or deployment command is authorized.

## 10. Required result

Return exactly one result headed:

`GDA_ESTIMATE_PDF_CHROMIUM_BIN_TRACE_R3_REPAIR_RESULT_V1`

Use exactly one verdict:

- `CANDIDATE_READY`
- `CHANGES_REQUIRED`
- `BLOCKED_ENVIRONMENT`

Report:

- execution HEAD/tree and its parent;
- exact changed paths and per-path SHA-256;
- exact diff summary proving the PDF-route-only binary trace;
- every command, exit code, test count, and build result;
- final index/worktree status, including the preserved three untracked files;
- protected-path metadata equality; and
- explicit zero-action attestations for stage, commit, push, PR mutation, package install,
  database, Supabase, provider, Vercel, deployment, Ready, and merge.

## 11. Stop boundary

Stop after returning the uncommitted two-file candidate and evidence. Source stage,
commit, push, Preview verification, deployment, Ready conversion, merge, and production
verification are later separate Owner gates.
