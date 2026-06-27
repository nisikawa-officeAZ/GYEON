# GYEON Detailer Agent — Development Auth Setup Guide

This document covers everything needed to run authentication end-to-end in
a local development environment.

---

## Prerequisites

| Item | Required value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, never expose to client) |
| `OPENAI_API_KEY` | For OCR / AI parsing |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` in dev |

All values go in `.env.local` (never commit this file).

---

## Required Supabase Auth Settings

Open the Supabase dashboard → **Authentication → Settings**:

### Site URL
```
http://localhost:3000
```

### Redirect URLs (Additional redirect URLs)
```
http://localhost:3000/api/auth/callback
http://localhost:3000/api/auth/callback?type=recovery
http://192.168.x.x:3000/api/auth/callback          ← your LAN IP for iPhone testing
http://192.168.x.x:3000/api/auth/callback?type=recovery
```

> **Important:** Without the callback URL in this list, password reset and
> email confirmation emails will redirect to an error.

### Email Confirmation
- **Recommended for production:** Enable
- **For faster local dev:** You may disable to skip email confirmation on signup
  (Supabase dashboard → Auth → Settings → Enable email confirmations → OFF)

When disabled, users are auto-confirmed and logged in immediately after sign-up.

---

## Creating a New Development User

### Option A: Via the app's sign-up page (recommended)
1. Navigate to `http://localhost:3000/signup`
2. Enter an email address and password (8+ characters)
3. If email confirmation is disabled, you're done — proceed to step 3 below
4. If enabled, check the inbox for a confirmation email and click the link

### Option B: Via Supabase Dashboard
Supabase dashboard → **Authentication → Users → Invite user**

Enter email + password. The user is created and confirmed immediately.

---

## Assigning dealer_members (Required for App Access)

After creating a Supabase Auth user, the account exists but has no dealer
access. A `dealer_members` row must be inserted **server-side** (never via
client input).

### Step 1: Get the user UUID

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'user@example.com';
```

### Step 2: Get the dealer UUID

```sql
SELECT id, business_name, created_at
FROM public.dealers
ORDER BY created_at
LIMIT 10;
```

If no dealer exists yet, create one first:

```sql
INSERT INTO public.dealers (business_name, status)
VALUES ('テスト店舗', 'active')
RETURNING id;
```

Also create `dealer_settings` for the new dealer:

```sql
INSERT INTO public.dealer_settings (dealer_id, onboarding_completed)
VALUES ('<dealer_uuid>', false);
```

### Step 3: Insert dealer_members row

```sql
INSERT INTO public.dealer_members (user_id, dealer_id, role, status)
VALUES (
  '<user_uuid>',    -- from auth.users.id
  '<dealer_uuid>',  -- from dealers.id
  'admin',          -- or 'staff'
  'active'
)
ON CONFLICT DO NOTHING;
```

After this, the user can log in and access all dealer features.

---

## Password Reset Flow

1. User visits `/forgot-password`
2. Enters their email → Supabase sends a reset email
3. User clicks the link in the email → lands at `/api/auth/callback?type=recovery`
4. Callback exchanges the code for a recovery session → redirects to `/reset-password`
5. User enters new password → `supabase.auth.updateUser({ password })`
6. Redirected to `/login`

### Testing locally

Reset emails contain links with `localhost:3000` only if Site URL is set correctly
in Supabase Auth settings (see above).

To inspect the reset token without email, use the Supabase dashboard:
**Authentication → Users → [user] → Send password reset**

---

## Resetting a Password (Admin)

```sql
-- Via Supabase dashboard: Auth → Users → [user] → Send password reset email
-- Or via the app: /forgot-password
```

To force a password change server-side (service role required):
```javascript
const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
  password: 'newPassword123',
});
```

---

## Session Persistence

Supabase SSR uses HTTP-only cookies for session storage. Session cookies:
- Are set on the response from any Server Action or Route Handler
- Are refreshed automatically via middleware on every non-public request
- Are **not shared** between `localhost` and LAN IP (`192.168.x.x`)

> **iPhone testing:** The iPhone must log in at `http://192.168.x.x:3000/login`
> with its own browser session. Desktop `localhost` sessions do not transfer.

---

## Protected Route Behavior

| Scenario | Behavior |
|---|---|
| Unauthenticated → any app route | Middleware redirects to `/login` |
| Authenticated, no `dealer_members` row → `/` | Home page redirects to `/no-dealer` |
| Authenticated + dealer → `/` | Normal home page |
| Authenticated + dealer + no onboarding → `/` | Redirects to `/onboarding` |
| Anyone → `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/no-dealer`, `/liff/*`, `/api/*` | Always accessible (public paths) |

---

## Troubleshooting

### "ログインが必要です" on iPhone OCR
The iPhone has no session. Visit `http://192.168.x.x:3000/login` on the device
and log in. The `/api/auth/status` pre-flight check will then return
`{ authenticated: true }` and the OCR file picker will unlock.

### "店舗情報を取得できません" after login
The user has a Supabase Auth session but no `dealer_members` record.
Run the SQL in Step 3 above to add them to a dealer.

### Password reset link redirects to error
The redirect URL is not in the Supabase Auth allowed-list.
Add `http://localhost:3000/api/auth/callback` to
**Authentication → Settings → Redirect URLs**.

### Email confirmation link expired
Links expire after 24 hours by default. Resend confirmation via:
Supabase dashboard → Authentication → Users → [user] → Resend confirmation

### OCR fails with "AI解析キーが設定されていません"
`OPENAI_API_KEY` is missing from `.env.local`. Add it and restart the dev server.

### Build passes locally but fails on Vercel
Confirm all env vars are set in Vercel → Project → Settings → Environment Variables.
`NEXT_PUBLIC_*` vars are exposed to the client; others are server-only.

---

## Environment Variable Reference

```bash
# .env.local (never commit)

# Supabase — required
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # server-only, never expose to client

# OpenAI — required for OCR
OPENAI_API_KEY=sk-...

# App URL — required for auth callback emails
NEXT_PUBLIC_APP_URL=http://localhost:3000

# LINE (optional)
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_LIFF_ID=...
```

---

## Quick-Start Checklist

- [ ] `.env.local` created with all required vars
- [ ] Supabase Site URL set to `http://localhost:3000`
- [ ] `/api/auth/callback` added to Supabase redirect URL list
- [ ] Dev user created (via `/signup` or Supabase dashboard)
- [ ] `dealer_members` row inserted for the dev user
- [ ] `npx next dev --turbopack --hostname 0.0.0.0 --port 3000` running
- [ ] Login at `http://localhost:3000/login` works
- [ ] OCR upload at `/estimates` (new estimate wizard) works
