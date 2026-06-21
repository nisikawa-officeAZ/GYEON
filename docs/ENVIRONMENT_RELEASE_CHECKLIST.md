# Environment Variables Release Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify all required environment variables are correctly set in Vercel (production) before deployment.
This checklist covers both presence and correctness of each variable.

---

## Required Variables

### Supabase

| Variable | Description | How to Verify |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service_role key | Supabase Dashboard → Settings → API |

**Verification steps:**
1. Go to Supabase Dashboard → your production project → Settings → API
2. Copy "Project URL" → compare to `NEXT_PUBLIC_SUPABASE_URL` in Vercel
3. Copy "anon public" key → compare to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy "service_role secret" key → compare to `SUPABASE_SERVICE_ROLE_KEY`
5. Confirm `SUPABASE_SERVICE_ROLE_KEY` is NOT set as a `NEXT_PUBLIC_` variable

```
□ NEXT_PUBLIC_SUPABASE_URL — present, points to production project (not staging)
□ NEXT_PUBLIC_SUPABASE_ANON_KEY — present, matches production project anon key
□ SUPABASE_SERVICE_ROLE_KEY — present, server-only (NOT NEXT_PUBLIC_), matches service_role key
```

---

### App URL

| Variable | Required Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | No trailing slash |

```
□ NEXT_PUBLIC_APP_URL — set, no trailing slash, production domain (not localhost)
```

---

### Storage

| Variable | Required Value | Notes |
|---|---|---|
| `STORAGE_BUCKET` | `documents` | Default if not set is "documents" in code |

```
□ STORAGE_BUCKET — set to "documents" (or custom bucket name matching Supabase Storage)
```

---

### LINE Integration (if enabled)

Only required if LINE integration is active. If LINE is not used, these can be absent.

| Variable | Description | How to Get |
|---|---|---|
| `LINE_CHANNEL_ID` | LINE Messaging API channel ID | LINE Developers Console → Channel Basic Settings |
| `LINE_CHANNEL_SECRET` | LINE channel secret | LINE Developers Console → Channel Basic Settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived access token | LINE Developers Console → Messaging API → Channel access token |
| `NEXT_PUBLIC_LIFF_ID` | LIFF App ID | LINE Developers Console → LIFF |

```
□ LINE_CHANNEL_ID — set (or confirmed not needed)
□ LINE_CHANNEL_SECRET — set (or confirmed not needed)
□ LINE_CHANNEL_ACCESS_TOKEN — set (or confirmed not needed)
□ NEXT_PUBLIC_LIFF_ID — set (or confirmed not needed)
```

---

### Cron / Scheduled Jobs

| Variable | Required Value |
|---|---|
| `CRON_SECRET` | Random hex string, 32+ characters |

Generate with: `openssl rand -hex 32`

```
□ CRON_SECRET — set, 32+ hex chars, matches Vercel cron header config
```

---

## Vercel Configuration Steps

1. Go to Vercel Dashboard → your project → Settings → Environment Variables
2. For each variable above:
   - Confirm it exists in the **Production** environment
   - Confirm the value is correct (not a staging value)
   - Confirm sensitive vars (SERVICE_ROLE_KEY, secrets, tokens) are NOT exposed as NEXT_PUBLIC_

```
□ All variables verified in Vercel Production environment
□ No staging variables present in production environment
□ No production variables present only in Preview environment
□ SUPABASE_SERVICE_ROLE_KEY confirmed as non-public variable
□ LINE secrets confirmed as non-public variables
□ CRON_SECRET confirmed as non-public variable
```

---

## Security Checks

```
□ .env.local is NOT committed to git (check: git ls-files .env.local)
□ .env.example is up to date with all variable names (but no real values)
□ No hardcoded secrets found in source code (search: grep -r "eyJ" src/)
□ No staging Supabase URL referenced in production code
□ No test emails or dealer_ids hardcoded in source
```

---

## Post-Deployment Verification

After deploying, visit the production URL and run these checks:

```
□ App loads at production URL without errors
□ Login page renders
□ Supabase Auth login works with test account
□ Dashboard loads without 500 errors
□ Network tab shows requests going to correct Supabase URL
□ No console errors about missing environment variables
□ Vercel function logs show no runtime errors
```

---

## See Also

- `docs/PRODUCTION_READINESS_CHECKLIST.md` — overall release gate
- `docs/STAGING_SETUP.md` — staging environment setup
- `.env.example` — reference for all variable names
