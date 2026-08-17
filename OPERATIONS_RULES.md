# DealerOS — Operations Rules (CLI Safety)

Scope: how Claude Code (and any operator) may use the Supabase, Vercel, and
GitHub CLIs for **development** work on DealerOS. These rules are mandatory.

## 0. Absolute prohibitions
- **NEVER** connect to or modify the **Production** database.
- **NEVER** deploy to business **Production** (`vercel --prod` /
  `vercel deploy --prod` / `vercel promote`). A Vercel target named
  `production` is also prohibited unless every condition in the isolated
  non-production verification exception in §4.1 is satisfied and the exact
  execution gate is separately approved.
- **NEVER** merge to `main` (no `gh pr merge`, no push to `main`).
- **NEVER** print, log, or commit secrets (access tokens, service-role keys, DB passwords).
- **NEVER** store tokens in the repository. Tokens live only in the CLI's own
  credential store or shell environment.
- **ASK the operator before any destructive operation** (schema push, data
  delete/update at scale, anything irreversible).

## 1. Environments allowed
- Canonical identities are defined in
  `docs/master_specification/ENVIRONMENT_LEDGER.md`.
- Supabase Development: `DealerOS-Dev` — ref `fbieiotihlmpfzybowbt`.
- Supabase Staging: `DealerOS-Dev-Next` — ref
  `vhiuiwolnlvlwvoaingd`. This is the formal staging identity, but identity
  assignment is not connection or write authorization.
- Supabase Production: `DealerOS-Prod` — ref `dmvyaykhibmphrmekjbb`.
  Production remains prohibited unless a production-specific owner gate is
  explicitly opened.
- Default CLI permission remains **Development only**. Staging read, link,
  apply, reset, test-data, and deployment operations require their applicable
  explicit approval. Preview branches are not Staging.
- Vercel: **Preview deployments only** on project `dealeros`.
- GitHub: **current feature branch only** (e.g. `fix/branding-schema-block`).

## 2. Secret handling
- `.env*`, `.vercel`, and `supabase/.temp` are gitignored — keep it that way.
- `supabase login` stores its access token under `~/.supabase` (not the repo).
- `supabase link` prompts for the DB password interactively; it is not written
  to the repo. Never paste it into a tracked file or chat.
- When pulling env vars (`vercel env pull`) for inspection, write to a temp path
  and delete it afterward; never commit a pulled `.env`.

## 3. Supabase migration procedure (development only)
1. CLI must be installed and logged in (`supabase login`).
2. Link the **dev** project only:
   `supabase link --project-ref fbieiotihlmpfzybowbt`
3. **Verify before any change (read-only):**
   - `supabase projects list`
   - `supabase migration list`  (compares local `supabase/migrations/` to remote)
4. Migrations are **manual-apply by default**. Do **not** run `supabase db push`
   without explicit operator approval for the specific migration.
5. After an approved apply: run `NOTIFY pgrst, 'reload schema';` if DDL changed
   tables, then verify with evidence (see §6).
6. Never infer a target from a saved local link. Verify the exact role and ref
   against `ENVIRONMENT_LEDGER.md` before every approved operation.

## 4. Vercel preview-deploy procedure
- Project is already linked (`.vercel/project.json` → `dealeros`).
- Allowed (read/preview):
  - `vercel pull` / `vercel env pull --environment=development`
  - `vercel deploy`  → **Preview** target only
  - `vercel inspect <url>` / `vercel ls`
- Prohibited: `vercel deploy --prod`, `vercel --prod`, `vercel promote`,
  `vercel alias` to a production domain.
- A preview is built from the current working tree; confirm `git status` first.

### 4.1 Isolated Dev-Next public Auth verification exception

This is a narrow platform-semantics exception, not permission to deploy
DealerOS business Production. It exists because Vercel Standard Deployment
Protection keeps Preview URLs behind Vercel Authentication, while Supabase
email-confirmation and password-recovery links require an anonymously reachable
host.

The exception may be used only after its governance documents are independently
accepted, committed, normally pushed, and followed by a separate owner-approved
execution gate. Every one of these values is literal:

- Vercel project: new isolated project `dealeros-dev-next`; no Git connection.
- Business role: Staging / Dev-Next public Auth verification only.
- Vercel target: `production` only because that isolated project's public custom
  domain requires Vercel Production semantics.
- Public hostname: `dev-next.detailer-ag.com` only.
- Source commit/tree: `1c7b3e93aa6ffd9c43e66d3d448fbaba24619573` /
  `d535a11202649400c43488ebd155fc06eb1119af` only.
- Supabase target: Staging `DealerOS-Dev-Next`, ref
  `vhiuiwolnlvlwvoaingd` only. Development and Production are forbidden.
- Existing Vercel project `dealeros` and `app.detailer-ag.com` remain untouched.

The isolated project environment allowlist is exactly:

1. `NEXT_PUBLIC_SUPABASE_URL` for Staging ref
   `vhiuiwolnlvlwvoaingd`, transferred without exposing its value;
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` for that same Staging project, transferred
   without exposing its value;
3. `SUPABASE_SERVICE_ROLE_KEY` for that same Staging project, transferred
   without exposing its value; this is required by the server-only signup
   account-state check and verified pending-dealer creation;
4. `NEXT_PUBLIC_APP_URL=https://dev-next.detailer-ag.com`;
5. build-only
   `NEXT_PUBLIC_GIT_COMMIT=1c7b3e93aa6ffd9c43e66d3d448fbaba24619573`.

No other environment variable may be copied. In particular, leave
`CRON_SECRET`, `GYEON_PARTNER_ONBOARDING_ENABLED`, every LINE credential,
`OPENAI_API_KEY`, `DEALER_AI_KEY_SECRET`, Storage, OCR, PDF, NEWS-provider, and
all Production-scoped values unset. Never print, log, write to a file, copy to
the clipboard, or post any secret in chat or Git evidence.

Before the deployment gate can open, executable focused tests must prove the
exact current cron-method contract with `CRON_SECRET` absent. Vercel invokes
all `vercel.json` cron entries with `GET`, but `downgrade-trials/route.ts`
exports only `POST`: its scheduled `GET` must therefore be accepted only as a
framework `405`, while its exported `POST` must return `401`. The other two
cron routes export both `GET` and `POST`, and both methods must return `401`.
Every case must make zero calls to its downstream mutation/external-send
function. The exact future test-only allowlist is:

1. ADD `src/app/api/admin/cron/downgrade-trials/route.test.ts`
2. ADD `src/app/api/admin/cron/process-due-maintenance/route.test.ts`
3. ADD `src/app/api/admin/cron/process-line-queue/route.test.ts`
4. ADD `src/app/api/public-route-authority.test.ts`

Because middleware intentionally treats every `/api` route and eight other
prefixes as public, and the isolated project needs a Staging service-role key
for signup, the fourth test must fail closed on any missing, extra, duplicate,
or unclassified public authority surface. It must freeze all nine exact
`PUBLIC_PREFIXES`, the nine current `/api/**/route.ts` paths, public
`/auth/confirm`, public `/signup` server actions, gated `/no-dealer`, and the
R92B `/s/e` page/file route. It must prove:

- no-code/no-token and failed-verification Auth callbacks cannot reach
  service-role mutation; only a Supabase-verified session may converge into the
  existing pending-dealer action;
- invalid/missing LIFF token inputs cannot reach LINE verification or the
  consume RPC, and audience verification precedes consume;
- invalid LINE webhook JSON/signature can make no database write and no
  external profile call; a signature match remains mandatory before event
  processing;
- `/api/auth/status` and `/api/trial/status` are session-derived read-only
  surfaces, while `/api/observability/event` has no DB, Storage, service-role,
  or external-provider path;
- unauthenticated `checkEmailAccountState` is read-only, selects only
  `approval_status, deleted_at, created_at`, invokes no insert/update/delete/
  upsert/RPC/Auth-admin/external call, and returns only one coarse state from
  `new|pending|active|suspended` with no row, identifier, name, or email;
- with `GYEON_PARTNER_ONBOARDING_ENABLED` unset, `/no-dealer` reaches no claim,
  admin client, pending-dealer creation, or shop-profile redirect; an
  unauthenticated request redirects before any privileged path;
- `/s/e` remains bound to the accepted R92B opaque-token/hash, uniform-404,
  immutable-file, no-store/no-referrer, and no-internal-data boundary; missing,
  malformed, expired, revoked, cross-tenant, deleted, or missing-object cases
  can perform no successful Storage disclosure;
- every privileged/mutating/external route is either one of these audited
  token/signature/session boundaries or one of the exact cron fail-closed
  boundaries above.

The pre-deploy execution must run the four new tests plus these unchanged
regressions at their frozen SHA-256 values; any hash drift returns to review:

- `src/app/s/e/share-route.test.ts` —
  `f7967afd170860a97ba9305b47cee199af619294ea5ce84bc4f0167a959beb13`
- `src/lib/estimates/estimate-share-boundary.test.ts` —
  `3c772e4ba0cf57b1dfac5e71571e1a5f89f0f4f339a37f18e2b1dacd663be5ba`
- `src/lib/dealer/create-pending-dealer.test.ts` —
  `fee95410d77898a8124a677a6d7efc890dfdcd500c30d259eaeb8789285f8a78`
- `src/lib/dealer/claim-gyeon-provisioning.test.ts` —
  `b7206e80855db84c94a225c35b96ccd89ae178a7ee24393f51abdbb1935813dd`
- `src/lib/line/line-link-token.test.ts` —
  `5906f7eab62b6bbbcea2ff88dd9d4479ee949f95ced60b490038cba848223774`
- `src/app/api/observability/event/route.test.ts` —
  `7453a177fa7720075519aa8402b863c5fcd8d70251ccf99a6ae45ed70a5a0a78`

Those four tests, their commit/push, project creation, secret-safe environment
transfer, deployment, DNS/domain binding, Supabase Auth URL/template changes,
real-email verification, and rollback are separate gates. Any unexpected
project/ref, environment name, cron response beyond the exact `405`/`401`
contract,
source commit/tree, domain, billable add-on, or secret exposure fails closed.

Rollback is limited to the isolated surface: detach
`dev-next.detailer-ag.com`, freeze the isolated project, and restore the
separately captured Staging Auth URL/template configuration. Project deletion
is destructive and still requires its own approval. The existing `dealeros`
project, `app.detailer-ag.com`, Production Supabase, database migrations, and
data are never rollback targets for this exception.

## 5. GitHub / git procedure
- Repo: `origin → github.com/nisikawa-officeAZ/GYEON.git`.
- Commit and push **only** to the current feature branch:
  `git push origin <feature-branch>`.
- Prohibited: pushing to `main`, `gh pr merge`, merging to `main`. Opening a PR
  for review is allowed, but merging is the operator's decision.

## 6. Evidence-based verification rule
- Never claim success without evidence. A result is "verified" only when backed
  by actual command output:
  - typecheck: `npx tsc --noEmit` exit 0
  - build: `npm run build` success
  - DB: real query results / constraint definitions / self-cleaning probe rows
  - deploy: deployment `READY` status from `vercel inspect`
- Report failures verbatim. If a step was skipped or blocked, say so.

## 7. Destructive-operation checklist (ask first)
Before any of these, stop and get operator approval:
- `supabase db push`, `supabase db reset`, `DROP`/`TRUNCATE`/bulk `UPDATE`/`DELETE`.
- Anything touching Production or `main`.
- Force-push, history rewrite, branch deletion.
