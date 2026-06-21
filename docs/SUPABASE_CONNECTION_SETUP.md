# DealerOS — Supabase Connection Setup Guide

> **Environment:** Development only.
> **Status:** RLS is not applied yet. Authentication is not implemented yet.
> **Warning:** Never commit `.env.local`. Never use production credentials.

---

## 1. Finding Your Supabase Project URL

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **Development** project
3. Go to **Project Settings** → **API**
4. Copy the value under **Project URL**

Example format:
```
https://xxxxxxxxxxxxxxxxxxxx.supabase.co
```

---

## 2. Finding Your Supabase Anon Public Key

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **Development** project
3. Go to **Project Settings** → **API**
4. Copy the value under **Project API Keys** → `anon` `public`

> Use the `anon` key only. Never use the `service_role` key in client-side code.

---

## 3. Creating `.env.local` for Local Development

1. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

2. Open `.env.local` and fill in your Development Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key-here
```

3. Save the file. The Next.js dev server will pick it up automatically.

---

## 4. Warnings

| Warning | Detail |
|---|---|
| Never commit `.env.local` | It is listed in `.gitignore`. Committing it exposes credentials. |
| Development only | Use Development Supabase project credentials only. |
| Do not use `service_role` key | The `anon` key is the only safe key for client-side use. |
| Do not use production credentials | Production Supabase access is prohibited until explicit GPT CTO approval. |

---

## 5. Current Status

| Item | Status |
|---|---|
| Supabase client files | ✅ Created (`src/lib/supabase/client.ts`, `server.ts`) |
| Environment variable template | ✅ Created (`.env.example`) |
| `.env.local` | ❌ Not created — must be created locally by developer |
| RLS policies | ❌ Not applied yet — awaiting GPT CTO approval |
| Authentication | ❌ Not implemented yet — awaiting specification |
| Supabase connection active | ❌ Not active — requires `.env.local` to be configured |

---

## 6. File Reference

| File | Purpose |
|---|---|
| `src/lib/supabase/client.ts` | Browser-side Supabase client (`createBrowserClient`) |
| `src/lib/supabase/server.ts` | Server-side Supabase client (`createServerClient`) |
| `src/lib/supabase/connection-check.ts` | Placeholder for future connection check |
| `.env.example` | Template for environment variables |
| `.env.local` | Local credentials — **never committed** |

---

## 7. Next Steps (Awaiting Approval)

```
PHASE28: Apply RLS migration (004_enable_saas_rls.sql)
PHASE29: Implement authentication UI (Email + Password)
PHASE30: Connect UI to Supabase data (replace mock data)
```

> No implementation until GPT CTO approval.
