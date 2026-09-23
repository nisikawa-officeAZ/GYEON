// Regression contract for the dealer signup → email verification → GYEON Japan
// approval flow. Email verification (authentication) and dealer approval are
// separate states; the UI and the confirmation routing must keep them apart.
//
// Deterministic source-contract test: reads the allowlisted route/page sources
// and never connects to Supabase, Auth, email, a browser, or any provider.
//
// Run: node --import tsx --test src/lib/auth/dealer-signup-approval-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SIGNUP_PAGE   = "src/app/signup/page.tsx";
const PENDING_PAGE  = "src/app/signup/pending/page.tsx";
const LOGIN_PAGE    = "src/app/login/page.tsx";
const CONFIRM_ROUTE = "src/app/auth/confirm/route.ts";
const CALLBACK_ROUTE = "src/app/api/auth/callback/route.ts";

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const read = (path: string) => strip(readFileSync(path, "utf8"));

// Extracts both operands of every `needsConfirm ? A : B` expression in the
// pending page (string literals or parenthesised JSX) so copy can be asserted
// per wait state without rendering React.
function takeOperand(src: string, i: number): [string, number] {
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] === '"') {
    const end = src.indexOf('"', i + 1);
    assert.ok(end > i, "unterminated string operand");
    return [src.slice(i, end + 1), end + 1];
  }
  if (src[i] === "(") {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") {
        depth--;
        if (depth === 0) return [src.slice(i, j + 1), j + 1];
      }
    }
  }
  throw new Error(`unsupported ternary operand at ${i}`);
}

function ternaryBranches(source: string): { confirm1: string; confirm0: string } {
  const confirm1: string[] = [];
  const confirm0: string[] = [];
  const marker = /needsConfirm\s*\?/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(source)) !== null) {
    const [a, afterA] = takeOperand(source, m.index + m[0].length);
    let colon = afterA;
    while (/\s/.test(source[colon])) colon++;
    assert.equal(source[colon], ":", "ternary must have an else branch");
    const [b, afterB] = takeOperand(source, colon + 1);
    confirm1.push(a);
    confirm0.push(b);
    marker.lastIndex = afterB;
  }
  assert.ok(confirm1.length >= 4, "pending page must branch icon, copy, steps, and CTA on needsConfirm");
  return { confirm1: confirm1.join("\n"), confirm0: confirm0.join("\n") };
}

test("1. signup confirmation email never targets /login; it targets the callback boundary", () => {
  const source = read(SIGNUP_PAGE);
  const redirect = source.match(/emailRedirectTo:\s*`\$\{window\.location\.origin\}([^`]*)`/);
  assert.ok(redirect, "signUp must set emailRedirectTo from the current origin");
  assert.equal(redirect![1], "/api/auth/callback");
  assert.doesNotMatch(source, /emailRedirectTo:\s*`[^`]*\/login`/);
  // The browser still routes its own post-submit navigation to the pending page.
  assert.match(source, /router\.push\(`\/signup\/pending\?confirm=\$\{needsConfirmation \? "1" : "0"\}`\)/);
});

test("2. PKCE callback converges a verified signup to /signup/pending?confirm=0 after the session exchange", () => {
  const source = read(CALLBACK_ROUTE);
  const exchangeAt = source.indexOf("supabase.auth.exchangeCodeForSession(code)");
  const resetAt    = source.indexOf('type === "recovery" || type === "invite"');
  const createAt   = source.indexOf("await createPendingDealer()");
  const pendingAt  = source.indexOf("/signup/pending?confirm=0`", createAt);
  assert.ok(exchangeAt >= 0 && resetAt > exchangeAt && createAt > resetAt && pendingAt > createAt);
  assert.match(source, /dealer\.kind === "created" \|\| dealer\.kind === "already-exists"/);
  assert.match(source, /\/signup\/pending\?confirm=0&setup_error=1/);
  // createPendingDealer takes no arguments: identity only from the exchanged session.
  assert.doesNotMatch(source, /createPendingDealer\([^)]+\)/);
  assert.equal(source.includes("searchParams.get(\"user_id\")"), false);
  assert.equal(source.includes("searchParams.get(\"dealer_id\")"), false);
  assert.equal(source.includes("approval_status"), false);
  assert.equal(source.includes("role"), false);
  // Never converge a verified signup to the ordinary login page.
  assert.doesNotMatch(source, /\/signup\/pending\?confirm=1/);
  assert.doesNotMatch(source, /redirect\(`\$\{origin\}\/login`\)/);
});

test("3. token_hash confirm converges a verified signup to the same pending-approval state", () => {
  const source = read(CONFIRM_ROUTE);
  const verifyAt  = source.indexOf("supabase.auth.verifyOtp({ type, token_hash })");
  const resetAt   = source.indexOf('type === "recovery" || type === "invite"');
  const signupAt  = source.indexOf('if (type === "signup")');
  const createAt  = source.indexOf("await createPendingDealer()", signupAt);
  const pendingAt = source.indexOf("/signup/pending?confirm=0`", createAt);
  assert.ok(verifyAt >= 0 && resetAt > verifyAt && signupAt > resetAt && createAt > signupAt && pendingAt > createAt);
  assert.match(source, /\/signup\/pending\?confirm=0&setup_error=1/);
  assert.doesNotMatch(source, /createPendingDealer\([^)]+\)/);
  assert.doesNotMatch(source, /\/signup\/pending\?confirm=1/);
});

test("4. invite and recovery still converge to /reset-password on both boundaries", () => {
  for (const path of [CONFIRM_ROUTE, CALLBACK_ROUTE]) {
    const source = read(path);
    assert.match(
      source,
      /if \(type === "recovery" \|\| type === "invite"\) \{[\s\S]*?redirect\(`\$\{origin\}\/reset-password`\)/,
      `${path}: recovery/invite must redirect to /reset-password`,
    );
    const resetAt  = source.indexOf('type === "recovery" || type === "invite"');
    const createAt = source.indexOf("await createPendingDealer()");
    assert.ok(createAt > resetAt, `${path}: recovery/invite is decided before dealer creation`);
  }
});

test("5. auth boundary failures redirect to /login with a non-secret flag", () => {
  assert.match(read(CONFIRM_ROUTE),  /\/login\?error=auth_confirm_failed`\)/);
  assert.match(read(CALLBACK_ROUTE), /\/login\?error=auth_callback_failed`\)/);
  for (const path of [CONFIRM_ROUTE, CALLBACK_ROUTE]) {
    const source = read(path);
    assert.doesNotMatch(source, /error\.message\)`/, `${path}: raw provider error never enters a redirect`);
    assert.doesNotMatch(source, /encodeURIComponent\(error/, `${path}: raw provider error never enters a redirect`);
  }
});

test("6. pending page: confirm=1 means email verification is still required", () => {
  const source = read(PENDING_PAGE);
  assert.match(source, /const needsConfirm = params\.confirm === "1"/);
  const { confirm1 } = ternaryBranches(source);
  assert.match(confirm1, /メールアドレスの確認が必要です/);
  assert.match(confirm1, /確認メールを送信しました/);
  assert.match(confirm1, /メール確認が完了するまでログインはできません/);
  assert.match(confirm1, /パスワードは登録時に設定済みです/);
  assert.match(confirm1, /メール確認が完了しても、すぐにはログインできません/);
  assert.match(confirm1, /メール確認後にGYEON Japanが申請内容を審査し、承認後にログイン・ご利用いただけます/);
  // No approval-complete or immediate-login claim in the verification-wait state.
  assert.doesNotMatch(confirm1, /確認が完了しました/);
  assert.doesNotMatch(confirm1, /承認後にアカウントをご利用いただけます/);
  // Never tell the applicant to log in right after email verification.
  assert.doesNotMatch(confirm1, /ログインをお試しください/);
  assert.doesNotMatch(confirm1, /確認を完了したあとに、ログイン/);
  assert.doesNotMatch(confirm1, /メール確認が完了したら/);
});

test("7. pending page: confirm=0 means email verified and GYEON Japan approval pending", () => {
  const source = read(PENDING_PAGE);
  const { confirm0 } = ternaryBranches(source);
  assert.match(confirm0, /メールアドレスの確認が完了しました/);
  assert.match(confirm0, /GYEON Japanの承認待ちです/);
  assert.match(confirm0, /GYEON Japanの承認後にアカウントをご利用いただけます/);
  assert.match(confirm0, /メール確認（認証）とGYEON Japanの承認は別の手続きです/);
  assert.match(confirm0, /承認前にログインしても、機能へのアクセスは制限されたままです/);
  // No "verify your email" instruction in the approval-wait state.
  assert.doesNotMatch(confirm0, /確認メールを送信しました/);
  assert.doesNotMatch(confirm0, /メールアドレスの確認が必要です/);
});

test("8. pending page CTA never presents immediate login as the next action", () => {
  const source = read(PENDING_PAGE);
  const { confirm1, confirm0 } = ternaryBranches(source);
  // confirm=1: no login link at all — email verification alone never unlocks login.
  assert.doesNotMatch(confirm1, /href="\/login"/);
  assert.doesNotMatch(confirm1, /<Link/);
  assert.doesNotMatch(confirm1, /ログイン画面/);
  assert.doesNotMatch(confirm1, /からログインできます/);
  assert.match(confirm1, /メール確認後、GYEON Japanが申請内容を審査します。\s*ログインは承認完了後に可能になります/);
  // confirm=0: a secondary (non-primary) return link that states approval gating.
  assert.match(confirm0, /href="\/login"[\s\S]*?ログイン画面へ戻る（承認後にご利用いただけます）/);
  assert.doesNotMatch(confirm0, /var\(--gs-blue, #4f8ef7\)"\s*\}\}\s*>\s*ログイン画面へ/);
  // The legacy always-primary "ログイン画面へ" button and "account ready" copy are gone.
  assert.equal(source.includes(">\n            ログイン画面へ\n          </Link>"), false);
  assert.equal(source.includes("ディーラー登録を受け付けました"), false);
  assert.equal(source.includes("アカウントを作成しました"), false);
});

test("9. login: auth-link failure flags render dedicated guidance, not the credentials error", () => {
  const source = read(LOGIN_PAGE);
  assert.match(source, /const AUTH_LINK_FAILURE_FLAGS = \["auth_callback_failed", "auth_confirm_failed"\] as const/);
  assert.match(source, /const authNotice = authLinkNotice\(searchParams\.get\("error"\)\)/);
  assert.match(source, /認証リンクを確認できませんでした/);
  assert.match(source, /確認メール内のリンクをもう一度開いてください/);
  assert.match(source, /「パスワードを忘れた方」から再度お手続きください/);
  // The credentials message is set only inside the sign-in error branch.
  const credentialsDecl = source.indexOf("const INVALID_CREDENTIALS_MESSAGE");
  const credentialsUse  = source.indexOf("setError(INVALID_CREDENTIALS_MESSAGE)");
  const signInAt        = source.indexOf("supabase.auth.signInWithPassword");
  assert.ok(credentialsDecl >= 0 && signInAt > credentialsDecl && credentialsUse > signInAt);
  assert.equal(source.split("メールアドレスまたはパスワードが正しくありません").length, 2, "credentials copy is declared once");
  const noticeFn = source.match(/function authLinkNotice\([\s\S]*?\n\}/);
  assert.ok(noticeFn, "authLinkNotice must be a pure module-level resolver");
  assert.equal(noticeFn![0].includes("INVALID_CREDENTIALS_MESSAGE"), false, "link-failure guidance never reuses credentials copy");
  assert.ok(noticeFn![0].includes("AUTH_LINK_FAILED_MESSAGE"));
  // The notice is rendered outside the credentials-error box.
  assert.match(source, /\{authNotice && \([\s\S]*?role="status"[\s\S]*?\{authNotice\}/);
  assert.doesNotMatch(source, /setError\(AUTH_LINK_FAILED_MESSAGE\)/);
  // Unverified email is labelled as such, not as wrong credentials.
  assert.match(source, /code === "email_not_confirmed"[\s\S]*?setError\(EMAIL_NOT_CONFIRMED_MESSAGE\)/);
  // The dead "account created, please log in" note is gone.
  assert.equal(source.includes("アカウントを作成しました。ログインしてください。"), false);
  assert.equal(source.includes('searchParams.get("registered")'), false);
});

test("10. no boundary trusts browser-supplied identity, approval, or role", () => {
  for (const path of [SIGNUP_PAGE, CONFIRM_ROUTE, CALLBACK_ROUTE]) {
    const source = read(path);
    for (const forbidden of ["approval_status", "dealer_id", "user_id", "is_admin", "role:"]) {
      assert.equal(source.includes(forbidden), false, `${path} must not carry ${forbidden}`);
    }
  }
});

test("11. pending page confirm=1 affirms the ordered flow: email verification → GYEON Japan approval → login", () => {
  const source = read(PENDING_PAGE);
  const { confirm1 } = ternaryBranches(source);
  const verifyAt   = confirm1.indexOf('title="メール内のリンクを開く"');
  const approvalAt = confirm1.indexOf('title="GYEON Japanの承認を待つ"');
  const loginAt    = confirm1.indexOf('title="承認後にログイン"');
  assert.ok(verifyAt >= 0 && approvalAt > verifyAt && loginAt > approvalAt, "steps must be verify → approve → login");
  assert.match(confirm1, /メール確認後、GYEON Japanが申請内容を審査します/);
  assert.match(confirm1, /承認完了後、登録時に設定したメールアドレスとパスワードでログインできます/);
  // Every login mention in the verification-wait state is approval-gated or a prohibition.
  const loginMentions = confirm1.match(/[^。\n"]*ログイン[^。\n"]*/g) ?? [];
  assert.ok(loginMentions.length > 0);
  for (const mention of loginMentions) {
    assert.ok(
      /承認/.test(mention) || /ログインはできません/.test(mention) || /すぐにはログインできません/.test(mention),
      `confirm=1 login mention must be approval-gated: ${mention}`,
    );
  }
});
