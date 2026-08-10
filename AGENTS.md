# DealerOS / GYEON DA Agent Bootstrap

This file is the mandatory entrypoint for every new Codex, Claude, Cursor, or Studio session that works from this repository.

## Mandatory session start

Before diagnosis, planning, implementation, testing, or Git actions:

1. Read this file completely.
2. Read `docs/master_specification/GYEON_DA_COMPLETION_PLAN.md` completely.
3. Read the latest accepted and pending entries in `docs/master_specification/GYEON_DA_PHASE_RESULTS.md`.
4. State the active phase, authorization boundary, literal allowlist, protected paths, and responsible machine/agent.
5. Stop if the requested work is not inside the active authorized phase.

Chat history, a previous handoff, an old roadmap, or an uncommitted assumption must not override these Git documents.

## Fixed product mission

GYEON Detailer Agent exists first to reduce the administrative work that prevents GYEON detailers from concentrating on detailing work.

Priority order:

1. Complete and field-prove the GYEON detailer daily workflow.
2. Stabilize security, operations, support, and AI/server cost controls.
3. Consider SaaS commercialization only after GYEON DA completion.

Monetization funds AI and server costs. It is not permission to move SaaS, ordering, inventory, EC, or marketing work ahead of the GYEON DA completion critical path.

## Responsibility boundary

- **User / Office AZ:** product owner and final business authority.
- **MacBook Codex:** GYEON DA specification authority, independent acceptance, DetailerOS integration, and completion control.
- **MacBook Claude:** diagnosis, authorized implementation, and executable tests for the active GYEON DA phase. Claude must not redesign the approved plan.
- **Mac Studio Cursor/Codex:** the complete Office AZ inventory-management foundation, including product authority, ledger, status/location balances, receiving, movement, reservation, shipping, returns, stocktaking, EC synchronization, DB/RLS/RPC, recovery, tests, and evidence.

MacBook must not implement Office AZ inventory. Studio must not redirect its inventory assignment into GYEON order processing or unrelated DetailerOS feature work.

## Frozen and deferred tracks

- GYEON order Draft PR #7 is frozen unless the governing plan records a direct GYEON DA dependency and the user separately authorizes resumption.
- SaaS, generic catalogue, commercial expansion, white label, Office AZ inventory implementation on MacBook, and EC work are outside the GYEON DA completion critical path.
- The accepted finance/monthly-invoice track remains closed unless a verified regression blocks the active GYEON DA journey.

## Execution rules

- One active implementation phase at a time.
- Audit, repair, verification, commit, push, migration apply, Ready conversion, merge, and deployment remain separate gates.
- Use literal allowlists. Do not silently broaden scope.
- Record every accepted, rejected, or blocked phase in `GYEON_DA_PHASE_RESULTS.md`.
- Do not claim completion from source presence alone; use the E0-E5 evidence levels in the governing plan.
- If documents conflict, follow the precedence defined in `GYEON_DA_COMPLETION_PLAN.md` and report the conflict before continuing.

## Protected paths

- `src/components/estimates/wizard/screens/ScreensPreview.tsx`: pathname, mode, hash, and Git state only. Never open, read, diff, copy, stage, or modify it.
- `supabase/migrations/20260801110110_line_link_tokens.sql`: no shared-environment or production application without a separate authorized phase.
- `supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql`: closed finance artifact.
- `src/lib/monthly-statements/monthly-invoice-artifact-boundary.test.ts`: closed finance boundary.
