// Dealer signup recovery and Japanese-copy contract.
//
// Run:
//   node --import tsx --test src/lib/dealer/create-pending-dealer.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const MIGRATION =
  "supabase/migrations/20260815141732_dealer_signup_uniqueness.sql";

test("1. pending-dealer creation is zero-argument and session-derived", () => {
  const source = stripComments(read("src/lib/dealer/create-pending-dealer.ts"));

  assert.match(source, /^"use server";/m);
  assert.match(source, /export async function createPendingDealer\(\)/);
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /if \(!user\.email \|\| !user\.email_confirmed_at\)/);
  assert.equal(source.includes("params."), false, "no browser-supplied identity parameters");

  const identityAt = source.indexOf("supabase.auth.getUser()");
  const adminAt = source.indexOf("createAdminClient()");
  assert.ok(identityAt >= 0 && adminAt > identityAt, "verified identity precedes service-role access");
});

test("2. user metadata supplies display copy only; identity remains the verified user", () => {
  const source = stripComments(read("src/lib/dealer/create-pending-dealer.ts"));

  assert.match(source, /metadata\?\.dealer_signup_flow !== DEALER_SIGNUP_FLOW/);
  assert.match(source, /metadata\.dealer_business_name/);
  assert.match(source, /owner_user_id:\s+user\.id/);
  assert.match(source, /email:\s+normalizedEmail/);
  assert.match(source, /if \(emailDealer\) return \{ kind: "email-conflict" \}/,
    "a dealer owned by another user is a conflict, never a successful retry");
  for (const forbidden of ["metadata.role", "metadata.status", "metadata.dealer_id", "metadata.owner_user_id"]) {
    assert.equal(source.includes(forbidden), false, `metadata never controls authority: ${forbidden}`);
  }
});

test("3. confirmation-required signup defers the dealer write until verification", () => {
  const source = stripComments(read("src/app/signup/page.tsx"));

  assert.match(source, /dealer_signup_flow:\s*"dealer-v1"/);
  assert.match(source, /dealer_business_name:\s*businessName\.trim\(\)/);

  const needsConfirmationAt = source.indexOf("const needsConfirmation = !data.session");
  const autoConfirmedAt = source.indexOf("if (!needsConfirmation)");
  const createAt = source.indexOf("await createPendingDealer()", autoConfirmedAt);
  assert.ok(needsConfirmationAt >= 0 && autoConfirmedAt > needsConfirmationAt && createAt > autoConfirmedAt);
  assert.equal(source.slice(0, autoConfirmedAt).includes("await createPendingDealer()"), false);
});

test("4. token confirmation creates a pending dealer only for signup", () => {
  const source = stripComments(read("src/app/auth/confirm/route.ts"));

  const resetAt = source.indexOf('type === "recovery" || type === "invite"');
  const signupAt = source.indexOf('if (type === "signup")');
  const createAt = source.indexOf("await createPendingDealer()", signupAt);
  assert.ok(resetAt >= 0 && signupAt > resetAt && createAt > signupAt);
  assert.match(source, /signup\/pending\?confirm=0/);
  assert.match(source, /setup_error=1/);
});

test("5. later login recovers only an eligible verified orphan inside the GYEON gate", () => {
  const source = stripComments(read("src/app/no-dealer/page.tsx"));

  const gateAt = source.indexOf("if (isGyeonPartnerOnboardingEnabled())");
  const verifiedAt = source.indexOf("if (user.email_confirmed_at)", gateAt);
  const claimAt = source.indexOf("await claimGyeonProvisioning()", verifiedAt);
  const createAt = source.indexOf("await createPendingDealer()", claimAt);
  const redirectAt = source.indexOf('redirect("/signup/pending?confirm=0")', createAt);
  assert.ok(gateAt >= 0 && verifiedAt > gateAt && claimAt > verifiedAt && createAt > claimAt && redirectAt > createAt);
  assert.match(source, /pendingDealer\.kind === "created"/);
});

test("6. pending screen contains no English status sentences", () => {
  const source = read("src/app/signup/pending/page.tsx");

  assert.equal(source.includes("Your dealer application has been received."), false);
  assert.equal(source.includes("Your account will become available"), false);
  assert.match(source, /確認メールを送信しました/);
  assert.match(source, /GYEON Japanの承認後にアカウントをご利用いただけます/);
});

test("7. PKCE callback keeps recovery and invite out of dealer creation", () => {
  const source = stripComments(read("src/app/api/auth/callback/route.ts"));

  const resetAt = source.indexOf('type === "recovery" || type === "invite"');
  const createAt = source.indexOf("await createPendingDealer()");
  assert.ok(resetAt >= 0 && createAt > resetAt);
  assert.match(source, /dealer\.kind === "created" \|\| dealer\.kind === "already-exists"/);
});

test("8. migration fail-closes duplicate pending signup identities without global uniqueness", () => {
  const sql = read(MIGRATION);

  assert.match(
    sql,
    /where approval_status = 'pending'\s+and owner_user_id is not null\s+group by owner_user_id\s+having count\(\*\) > 1/,
  );
  assert.match(
    sql,
    /where approval_status = 'pending'\s+and email is not null\s+and btrim\(email\) <> ''\s+group by lower\(btrim\(email\)\)\s+having count\(\*\) > 1/,
  );
  assert.match(sql, /errcode = '23505'/);
  assert.match(
    sql,
    /create unique index dealers_pending_owner_user_id_uidx\s+on public\.dealers \(owner_user_id\)\s+where approval_status = 'pending'\s+and owner_user_id is not null/,
  );
  assert.match(
    sql,
    /create unique index dealers_pending_email_normalized_uidx\s+on public\.dealers \(\(lower\(btrim\(email\)\)\)\)\s+where approval_status = 'pending'\s+and email is not null\s+and btrim\(email\) <> ''/,
  );
  assert.doesNotMatch(
    sql,
    /on public\.dealers \(owner_user_id\)\s+where owner_user_id is not null/,
    "multi-dealer membership architecture forbids a global owner uniqueness rule",
  );
});

test("9. a 23505 loser performs one bounded winner-resolution re-read", () => {
  const source = stripComments(read("src/lib/dealer/create-pending-dealer.ts"));

  const insertAt = source.indexOf(".insert({");
  const conflictAt = source.indexOf('error?.code === "23505"', insertAt);
  const rereadAt = source.indexOf("findExistingDealer(admin, user.id, normalizedEmail)", conflictAt);
  const unresolvedAt = source.indexOf("unresolved uniqueness conflict", rereadAt);

  assert.ok(insertAt >= 0 && conflictAt > insertAt && rereadAt > conflictAt && unresolvedAt > rereadAt);
  assert.match(source.slice(conflictAt), /if \(winner\) return winner/);
  assert.match(source.slice(conflictAt), /return \{ kind: "error" \}/);
});
