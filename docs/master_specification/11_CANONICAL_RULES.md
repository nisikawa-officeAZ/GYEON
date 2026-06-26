# 11 — CANONICAL RULES
## Specification-Driven Development — Binding Rules

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Canonical — Binding. These rules override all default engineering practices. |
| **Last Updated** | 2026-06-25 |
| **Canonical Source** | `gyeon_flow.json`, `gyeon_settings_flow.json`, `dealer_settings_final_schema.md`, implementation audit |
| **Related Documents** | All documents — this document governs all work |

> **Status:** Canonical. These rules are binding for all work on GYEON Detailer Agent.
> **Precedence:** These rules override any default engineering practices.
> **Sources:** `gyeon_flow.json`, `gyeon_settings_flow.json`, `dealer_settings_final_schema.md`, implementation audit.

---

## 1. Specification Authority (SDD)

1. The **Canonical Core Specification** — `gyeon_flow.json` + `gyeon_settings_flow.json` — is the highest authority.
2. **Implementation must follow the specification. Never the reverse.**
3. The canonical JSON files are **read-only**: never overwrite, never redesign. Changes to business logic begin by updating the spec *first*, then the implementation.
4. `/docs/master_specification/*` is **derived** from the JSON + verified implementation. If a doc and the JSON disagree, the JSON wins and the doc is corrected.
5. ⚠️ The canonical JSONs currently live only in the Desktop export, **not in the repo**. Until they are placed under version control, "canonical" is not fully enforceable. Placing them in the repo is a required Phase C task (see `10_ROADMAP.md`).

---

## 2. Multi-tenant & Security (non-negotiable)

- `dealer_id` is **always** resolved server-side via `getCurrentDealer()` — never from client input, URL parameters, or form data.
- All queries are dealer-scoped (`.eq('dealer_id', …)`); RLS enabled on every table.
- Never weaken RLS; never query another dealer's data.
- `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and `OPENAI_API_KEY` are **server-side only**; never exposed in UI or returned to client.
- `getDealerSettingsPublic()` must strip `line_channel_secret` and `line_access_token` before returning to client.
- **`line_public_settings` JSONB must NEVER contain `line_channel_secret` or `line_access_token`.** This column is designed for public-safe LINE metadata only (LIFF ID, QR URL, connection status). Any code writing to `line_public_settings` must explicitly exclude all secret fields.
- No DELETE policies on: audit_logs, dealer_billing, billing_invoices, uat_*, staging_verification_* tables. Data is permanently retained in these tables.
- Admin guard (`requireAdmin()`) on all admin server functions.

---

## 3. Database & Migrations

- Migrations are **additive only** (ADD COLUMN, CREATE TABLE, CREATE INDEX).
- Never use `DROP TABLE`, `DROP COLUMN`, `RENAME COLUMN`, or `TRUNCATE` on production tables.
- Never delete production data.
- All migrations must pass **staging verification before production apply**.
- Migrations applied **manually** via Supabase SQL Editor (no automated apply tool).
- Apply in sequential order; document intentional numbering gaps.
- Migration numbering: legacy range `001`–`004`; feature range `035`–`070+`. Do not create migrations in the gap `005`–`034`.
- **All migrations require CTO approval before execution.**
- PPF mandatory fields in `dealer_settings.ppf_price_tables` must never be removed or simplified.
- `dealer_id` on `dealer_settings` is UNIQUE — one settings record per dealer, always.

---

## 4. Incremental Delivery (working method)

- Work **one screen/feature at a time**: small change → verify by eye → commit → next.
- Mobile screens are **not modified** when adding desktop screens, and vice versa.
- Verify visually on both PC (≥1024px) and mobile (<1024px) before sign-off.
- Do not implement multiple features in one batch without intermediate commits.
- Do not invent features — new scope must trace to the canonical spec or to an already-documented project plan (existing V2 roadmap). See `10_ROADMAP.md`.

---

## 5. Design Workflow

- Designs are produced in **Genspark** (the visual authority).
- Implementation is performed in `~/DealerOS` by Claude Code.
- Preferred design handoff: HTML/code > screenshot > URL.
- For PC/desktop screens: instruct Genspark for a **desktop/wide** layout explicitly.
- The design language: dark navy luxury (`#080d1a`), blue gradient accents (`#2563eb → #1d4ed8`, `#60a5fa`), glass cards (`rgba(255,255,255,0.04)` + blue border + blur), `GYEON®` wordmark (letter-spacing).

---

## 6. Persistence Reconciliation

- Canonical JSON describes IndexedDB + Cloudflare KV/D1 (the original Genspark runtime).
- **Current implementation uses Supabase (PostgreSQL + Auth + Storage).**
- **Canonical = data shapes, semantics, settings keys, pricing formulas, business rules.** Supabase is the canonical persistence substrate going forward.
- Offline-first is a separate, explicit roadmap item — not implied by the canonical spec.
- **Supabase Auth** supersedes the JSON's custom `AuthToken`/`/api/auth/*` scheme. Business intent (email/password login, register-then-enter, password reset, persistent session) is preserved.

---

## 7. dealer_settings Rules

These rules derive from `dealer_settings_final_schema.md` (Version 1.1, 2026-06-22).

### 7.1 Identity rules
- `dealer_id` is sourced **only** from `getCurrentDealer()`. Never from forms.
- `dealer_id` has a UNIQUE constraint. One `dealer_settings` row per dealer.

### 7.2 detailer_rank
- Valid values: `'detailer'` or `'certified'` only.
- CHECK constraint: `detailer_rank IN ('detailer','certified')`.
- No additional ranks will be added. The CHECK constraint is intentionally narrow — do not design for extensibility.
- Effect: when `certified`, `infinit1`/`infinit2` coatings become available in STEP3; topcoat options expand.

### 7.3 ocr_policy invariant
- `ocr_policy.human_confirmation_required` **must always be `true`**.
- This value must never be set to `false` through any UI, API endpoint, admin tool, or migration.
- It is a safety requirement: OCR output is approximate and cannot be committed to records without human review.
- If `ocr_policy` is NULL or the field is absent, the application must treat `human_confirmation_required` as `true`.

### 7.4 service_price_settings
- Must contain **all 6 service groups**: coating, ppf, window_film, maintenance, carwash, room_cleaning.
- No group may be omitted.
- PPF also requires a **dedicated `ppf_price_tables` column** for detailed partial installation pricing. `service_price_settings.ppf` holds only the active flag and plan labels; full pricing lives in `ppf_price_tables`.
- PPF + coating combined estimate is a **first-class use case** and must be fully supported.
- NULL in any sub-key → EstimateWizard falls back to hardcoded defaults.

### 7.5 ppf_price_tables
- Separate top-level column (not nested in `service_price_settings`).
- Contains 5 independent table groups: `plan_prices`, `film_coeff`, `rank_coeff`, `glass_prices`, `parts_prices`.
- NULL → EstimateWizard uses hardcoded PPF defaults.

### 7.6 coupon_settings
- Array length is always exactly **5**. Add/delete not allowed; only name and amount may change.
- `amount` is an integer (JPY).

### 7.7 maintenance_reminder_templates — read order
- Array length is always exactly **3**. IDs are fixed: 1/2/3.
- `menus` field references `maintenance.menus[].id` from `service_price_settings`.
- **Read fallback order (required):**
  1. Read `maintenance_reminder_templates` from `dealer_settings`. If non-NULL, use it.
  2. Else read `reminder_templates` from `dealer_settings`. If non-NULL, use it.
  3. Else use hardcoded defaults from `dealer-settings-defaults.ts`.
- Never write to `reminder_templates` directly — it exists only as a migration-era alias. Always write to `maintenance_reminder_templates`.

### 7.8 LINE secrets
- `line_channel_secret` and `line_access_token` are stored in `dealer_settings` server-side.
- **Never** include these fields in any client-facing query or response.
- `line_public_settings` may be returned to the client. It must never be populated with secret values. See §2.

### 7.9 Extension JSONB blobs (migration 070)
The following columns were added in migration 070 and extend the schema beyond the 37 canonical settings keys. They follow the same security and validation rules as all other dealer_settings columns:
- `store_profile`, `business_days`, `dealer_trade_defaults` — dealer configuration extension
- `ocr_policy` — OCR behavior (§7.3 — `human_confirmation_required` must always be true)
- `line_public_settings` — LINE public metadata (§2 and §7.8 — never include secrets)
- `line_message_templates` — LINE message body templates (⚠️ pending OD-11)
- `pdf_settings`, `document_settings` — document generation configuration
- `tax_settings` — tax rate configuration
- `backup_settings`, `health_settings` — operational configuration
- `reminder_templates` — read-fallback alias only (§7.7 — never write directly)

### 7.10 `roof` PPF plan (pending operator decision)
`dealer-settings-defaults.ts` includes a `roof` PPF plan key (`roof_SS`, `roof_S`, etc.) that does not exist in the canonical `gyeon_flow.json`. This plan must not appear in the standard estimate flow until OD-12 is resolved. See `OPERATOR_DECISIONS.md` OD-12.

---

## 8. Estimate Flow Rules

- **Single-category-only selection is allowed but multi-category is the primary use case.**
- All category combinations are valid. No combination is blocked.
- Body-size (STEP2) shown **only if** `coating` or `ppf` is selected; skipped otherwise.
- When both `coating` and `ppf` are selected, STEP2 runs **once**; the same `sizeKey` is applied to both.
- Category processing order in `nextScreen()` is fixed: coating → ppf → window → maintenance → carwash → roomclean → other → STEP5. Categories not selected are automatically skipped.
- Options (STEP4) prices are **fixed** — not multiplied by size coefficient.
- STEP5 displays each category subtotal separately before tax.
- Tax formula: `(subtotal - discounts) × tax_rate / 100`.

---

## 9. Audit / Process Constraints

- No implementation, no UI change, no code modification, no commits during pure specification/audit work sessions.
- Documentation deliverables in `/docs/master_specification/` are generated but **not committed** unless the operator explicitly requests a commit.
- Every significant admin and dealer action must be recorded in `audit_logs`.
- `~/DealerOS` is the **official project folder** and must never be deleted.

---

## 10. Scope Control

- Do **not** invent features or requirements. New scope must trace to:
  1. The Canonical Specification (`gyeon_flow.json` / `gyeon_settings_flow.json`), or
  2. An already-documented project plan (existing V2 roadmap in `ROADMAP_V2.md` / `ROADMAP_AFTER_v1.md`).
- Features not in either source above require explicit operator approval before specification or implementation.
