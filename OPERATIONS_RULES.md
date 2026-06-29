# DealerOS — Operations Rules (CLI Safety)

Scope: how Claude Code (and any operator) may use the Supabase, Vercel, and
GitHub CLIs for **development** work on DealerOS. These rules are mandatory.

## 0. Absolute prohibitions
- **NEVER** connect to or modify the **Production** database.
- **NEVER** deploy to **Production** (`vercel --prod` / `vercel deploy --prod` / `vercel promote`).
- **NEVER** merge to `main` (no `gh pr merge`, no push to `main`).
- **NEVER** print, log, or commit secrets (access tokens, service-role keys, DB passwords).
- **NEVER** store tokens in the repository. Tokens live only in the CLI's own
  credential store or shell environment.
- **ASK the operator before any destructive operation** (schema push, data
  delete/update at scale, anything irreversible).

## 1. Environments allowed
- Supabase: **Development project only** — ref `fbieiotihlmpfzybowbt`.
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
6. Never target a non-dev project ref. There is no Production link.

## 4. Vercel preview-deploy procedure
- Project is already linked (`.vercel/project.json` → `dealeros`).
- Allowed (read/preview):
  - `vercel pull` / `vercel env pull --environment=development`
  - `vercel deploy`  → **Preview** target only
  - `vercel inspect <url>` / `vercel ls`
- Prohibited: `vercel deploy --prod`, `vercel --prod`, `vercel promote`,
  `vercel alias` to a production domain.
- A preview is built from the current working tree; confirm `git status` first.

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
