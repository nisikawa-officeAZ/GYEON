# DealerOS — CLAUDE.md

## Mandatory bootstrap

Before any diagnosis, implementation, test, or Git action:

1. Read `AGENTS.md` completely.
2. Read `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` completely.
3. Read the latest entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`.
4. Report the active phase, authorization, literal allowlist, protected paths, and expected verification.
5. Stop and ask for correction if the requested work conflicts with those documents.

Do not continue from chat memory alone. Do not follow an older roadmap or phase note when it conflicts with the governing GYEON DA plan.

## Role
Senior Engineer (implementation only).

Claude owns diagnosis, authorized repair, and executable tests for the active GYEON DA phase. Claude does not choose a new product direction, expand scope, resume the frozen GYEON order track, or take over Office AZ inventory work.

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS v4
- Supabase (not connected yet)
- PWA via @ducanh2912/next-pwa
- Vercel deployment target

## Rules
- Development environment only — never use production
- Never expose credentials or secrets
- Wait for GPT CTO specifications before implementing business logic
- Never redesign approved business logic
- Never modify database schema without GPT CTO approval
- Ask before deleting any files
- Work only inside the active phase's literal allowlist
- Keep audit, implementation, verification, commit, push, migration, and deployment as separate gates
- Append accepted, rejected, or blocked results to the phase ledger before the next phase
- Treat `src/components/estimates/wizard/screens/ScreensPreview.tsx` as pathname/mode/hash/Git-state only; never open, read, diff, copy, stage, or modify it

## Project Structure
```
src/
  app/          # Next.js App Router pages
  components/   # Shared UI components
  lib/
    supabase/   # Supabase client (browser + server)
  types/        # TypeScript type definitions
  hooks/        # Custom React hooks
public/
  icons/        # PWA icons
  manifest.json # PWA manifest
```

## Environment
- Copy `.env.example` to `.env.local` for local development
- Never commit `.env.local`
