# GYEON Dealer Provisioning — Operator Runbook

GYEON-PARTNER-ONBOARD-F1. How GYEON partner shops are pre-registered,
invited, auto-approved at email verification, and activated — and how to
recover every invitation failure without ever creating duplicates.

---

## 1. Feature gate (server-only)

The entire feature is controlled by ONE server-only environment variable:

| Variable | Rule |
|---|---|
| `GYEON_PARTNER_ONBOARDING_ENABLED` | Enabled ONLY when the value is exactly `true`. Missing, empty, `false`, or anything else → disabled. |

- **GYEON deployment**: set `GYEON_PARTNER_ONBOARDING_ENABLED=true` (server env, Vercel).
- **SaaS deployments**: leave it unset (or `false`). Every provisioning entry
  point (CSV import, create, invite, resend, reconcile, revoke, claim, profile
  completion) returns a typed "disabled" BEFORE any database access, and the
  admin UI panel is omitted entirely. `/no-dealer` runs its original behavior
  with zero GYEON code active — no claim, no admin lookup, and no
  `/shop-profile` redirect (so no redirect loop is possible: `/shop-profile`
  itself bounces back to `/no-dealer` when the gate is off).
- Never prefix it with `NEXT_PUBLIC_`. Markets, brand variants, and
  `NEXT_PUBLIC_*` variables are NOT authorization sources for this feature.
  The gate module enforces its server-only boundary at load time: importing it
  from client code throws.

## 2. Data model — two independent state machines

Table `gyeon_dealer_provisioning` (RLS enabled, ZERO client policies,
service-role only):

- `provisioning_status` — owns claim eligibility:
  `registered` → `claimed` (by the winner-gated claim) or `revoked` (by a
  superAdmin). Claim eligibility is **`provisioning_status = 'registered'
  AND claimed_at IS NULL`** plus the verified email match — nothing else.
- `invitation_state` — delivery telemetry ONLY, never gates the claim:
  `none` → `pending` → `sent` | `failed` | `awaiting_claim`.

A shop whose invitation is stuck in `pending` or `failed` can still activate
normally the moment its owner verifies the registered email.

## 3. Registering shops (superAdmin, 店舗管理 screen)

Both routes only RECORD the shop — **no invitation email is sent
automatically, ever** (CSV import included).

- **CSV import**: header `representative_email,shop_name,detailer_rank`
  (+ optional `dealer_code`). Ranks: `shop`, `detailer`, `ppf_installer`,
  `certified`. Use 検証（書き込みなし） first; 取込確定 commits ALL rows and the
  audit record in one transaction — any conflict aborts the whole batch.
- **Replay idempotency**: re-importing a byte-equivalent row that is already
  registered and unclaimed is a NO-OP (reported as `unchanged`, no duplicate
  row, no duplicate dealer). A row whose shop name, rank, or dealer code
  differs — or that is already claimed or revoked — is a conflict. Dry-run and
  the confirmed import apply the same classification; the import result
  reports `inserted` and `unchanged` separately.
- **Single create** (店舗を登録): same fields, one row.

## 4. Invitation lifecycle (per row, explicit superAdmin actions)

| Action | From state | Result |
|---|---|---|
| 招待送信 (send) | `none` | Record transitions to `pending` FIRST, then the Auth invite is called. Success → `sent` (+ auth user id stored). |
| 再送 (resend) | `failed`, `sent` | Same record-first sequence. Never available from `pending`. |
| 状態照合 (reconcile) | `pending` | READ-ONLY check against Auth; sends nothing. Three outcomes: `sent` — the discovered Auth user has a non-empty `invited_at` (the invite provably went out); `awaiting_claim` — an Auth user exists but has NO `invited_at` (a pre-existing account; the discovered id is stored and that person activates by logging in); `failed` — an authoritative COMPLETE search proved no Auth user exists (the send never happened). |
| 取消 (revoke) | any `registered` row | `revoked` — the record can never be claimed. Claimed rows cannot be revoked. |

Failure semantics:

- **Uncertain result** (network/timeout/5xx): the row STAYS `pending`. Nothing
  retries automatically — run 状態照合 to learn the truth, then 再送 if needed.
- **Definite failure**: row becomes `failed`; fix the cause and 再送.
- **Email already registered in Auth**: row becomes `awaiting_claim`; NO second
  Auth user is ever created. That person simply logs in with their existing
  account — the claim converges at their next verified login.
- **Settlement durability**: `sent` (and every settled state) is reported ONLY
  after the database provably persisted it. If the email may have gone out but
  the local update failed, the operator sees an uncertain result and the row
  stays `pending` — 状態照合 recovers it without re-sending.
- **Reconcile completeness**: 状態照合 concludes `failed` only from an
  authoritative complete search. If the Auth user search hit its page cap
  without proving the final page, the result is "incomplete" and the row stays
  `pending`. User existence alone never settles `sent` — only a non-empty
  `invited_at` does; and a failed local settlement update reports "unsettled"
  and leaves the row `pending`.
- **Import serialization**: the confirmed CSV import takes a SHARE ROW
  EXCLUSIVE lock on the provisioning table for its whole transaction, so
  concurrent confirmed imports and direct writes serialize; the locked
  transaction is the authoritative classification — 検証（書き込みなし） is an
  advisory preview only.
- **Error hygiene**: only bounded, stable error codes are stored (e.g.
  `email_exists`, `invite_failed`, `uncertain_transport`) — never raw provider
  messages. Audit-log writes are inspected and any failure is logged loudly
  server-side without rolling back the completed provider action.

## 5. Activation flow (the shop side)

1. The owner either accepts the invite (sets a password via the existing
   confirm → reset-password flow) or self-applies from /signup with the
   registered email and verifies it.
2. At the verification boundary (/auth/confirm), at auto-confirmed signup, or
   at any later login landing on /no-dealer, the claim runs automatically:
   - matching pending self-application **owned by the same user** → the dealer
     is APPROVED with the operator's shop name + rank (a pending dealer owned
     by a different user is a conflict and is never reassigned);
   - invited new shop → the dealer is CREATED approved.
   The claim transaction re-validates the caller against `auth.users` (id,
   normalized email, and a confirmed email) before writing anything.
   `approved_by` is always the superAdmin who recorded the shop. The owner
   membership is created as **`invited`** — not yet active.
3. The owner lands on **/shop-profile** (店舗情報の入力) — the only reachable
   surface — and enters 電話番号 / 都道府県 / 住所. Submitting activates the
   membership atomically with those writes. The transaction re-validates the
   `auth.users` identity and requires the invited membership and the claimed
   provisioning record to belong to the same user and dealer (that record also
   supplies the audit actor) — anything unresolved fails closed with zero
   writes.
4. Immediately afterwards, 商品 (products) and 発注 (product-orders) work with
   NO estimate or Detailer Agent setup. DA setup stays optional.

Until step 3 completes, every dealer-shell page (dashboard, products, orders,
estimates, settings, …) redirects away — the shared MainLayout server guard
admits only ACTIVE memberships.

## 6. Duplicate-safety guarantees

- `email_normalized` and `dealer_code` are unique on the ledger.
- The claim is winner-gated (`UPDATE … WHERE provisioning_status='registered'
  AND claimed_at IS NULL RETURNING`): concurrent claims produce exactly one
  dealer, one membership.
- Invites to an existing Auth email become `awaiting_claim` — never a second
  user. Reconcile discovers already-sent invites instead of re-sending.
- A user already attached to any dealer (`active` or `invited`) can never
  claim another record (typed `already-member` → human review).
- A live non-pending dealer on the same email aborts the claim transaction
  (`dealer-conflict` → human review); the record stays `registered`.

## 7. Unchanged behavior

- The manual application → human approval path (承認センター /
  `approveDealerTrial`) is untouched; unmatched applicants still wait for
  human review exactly as before.
- SaaS deployments behave byte-identically with the gate off.

## 8. External prerequisites (runtime phases)

- Supabase Auth email templates must use the token_hash style pointing at
  `/auth/confirm` (already the project convention) and the app origin must be
  in the Auth redirect allowlist.
- The migration `*_gyeon_dealer_provisioning.sql` must be applied to the
  target project before any of this works.
- The claim and profile-completion functions read `auth.users` (identity
  revalidation) as `service_role`. The provisioning migration itself installs
  the required privilege as a COLUMN-LEVEL grant:
  `GRANT SELECT (id, email, email_confirmed_at) ON TABLE auth.users TO
  service_role;` — no external setup step. Deployment verification must
  confirm exactly that three-column SELECT grant and the ABSENCE of any
  broader `auth.users` privilege (no table-wide SELECT, no other columns, no
  INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, and nothing for
  public/anon/authenticated).
