# Environment Variables Backup — DealerOS / GYEON Detailer Agent

## Overview

All environment variables must be stored securely outside of the repository.
This document lists every variable, its purpose, and where to retrieve it if lost.

---

## 1. Required Variables

### Supabase (Core)

| Variable | Description | Where to Find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL | Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose) | Dashboard → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (**SECRET — server only**) | Dashboard → Project Settings → API → service_role secret |

> **Critical**: `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security.
> Never expose in client-side code. Never prefix with `NEXT_PUBLIC_`.

---

### LINE Integration (Optional)

| Variable | Description | Where to Find |
|---|---|---|
| `LINE_CHANNEL_ID` | LINE Messaging API channel ID | LINE Developers Console → Channel → Basic settings |
| `LINE_CHANNEL_SECRET` | Channel secret | LINE Developers Console → Channel → Basic settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived channel access token | LINE Developers Console → Channel → Messaging API |
| `NEXT_PUBLIC_LIFF_ID` | LIFF app ID for reservation page | LINE Developers Console → LIFF tab |

---

### Application

| Variable | Description | Where to Find |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public URL of the app (e.g. `https://app.example.com`) | Vercel → Project → Settings → Domains |
| `STORAGE_BUCKET` | Storage bucket name (default: `documents`) | Supabase Dashboard → Storage |
| `CRON_SECRET` | Secret for cron job endpoint auth | Self-generated (see below) |

---

## 2. Generating Secrets

### CRON_SECRET

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
openssl rand -hex 32
```

Add to Vercel environment variables and use in cron endpoint:

```typescript
// src/app/api/cron/[job]/route.ts
if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
  return new Response('Unauthorized', { status: 401 });
}
```

---

## 3. Vercel Environment Variables

All production variables are stored in Vercel (not in any file):

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project → **Settings → Environment Variables**
3. Add each variable with the appropriate environments (Production / Preview / Development)

To export current Vercel env vars (requires Vercel CLI):

```bash
vercel env pull .env.local.backup
```

> Store `.env.local.backup` in a password manager or encrypted vault — never in git.

---

## 4. Local Development Setup

```bash
# Copy the example file
cp .env.example .env.local

# Fill in values from the sources listed in section 1
# .env.local is gitignored — never commit it
```

---

## 5. Secret Rotation Procedure

If a key is compromised:

### Supabase Service Role Key

1. Dashboard → Project Settings → API → **Reset service_role key**
2. Update in Vercel → Environment Variables
3. Redeploy: `vercel --prod`
4. Verify SystemHealthCard shows "正常" for all checks

### LINE Channel Access Token

1. LINE Developers Console → Channel → Messaging API → **Reissue**
2. Update `LINE_CHANNEL_ACCESS_TOKEN` in Vercel
3. Redeploy

### Supabase Database Password

1. Dashboard → Project Settings → Database → **Reset database password**
2. Update connection string in any external tools (pg_dump scripts, etc.)
3. Note: Supabase-generated client URLs auto-update — no app change needed

---

## 6. Secure Storage Recommendations

| Method | Use Case |
|---|---|
| Vercel Environment Variables | Production deployment (primary) |
| 1Password / Bitwarden vault | Team secret sharing |
| AWS Secrets Manager | Enterprise / automated rotation |
| `.env.local` (local only) | Individual developer machines |

**Never store secrets in:**
- Git repository (even private)
- Slack / email / chat
- Unencrypted cloud storage

---

## See Also

- `.env.example` — template with all variable names (no values)
- `docs/DISASTER_RECOVERY.md` — full recovery runbook
- `docs/STAGING_SETUP.md` — staging environment setup
