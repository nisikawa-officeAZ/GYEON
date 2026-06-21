# DealerOS — Local Environment Setup Guide

> **Environment:** Development only.
> **Warning:** Never commit `.env.local`. Never paste credentials into chat or code.
> **Production use is prohibited until explicit GPT CTO approval.**

---

## 1. File to Create Locally

Create the following file in the project root:

```
.env.local
```

This file is listed in `.gitignore` and will never be committed.

---

## 2. Required Variables

Open `.env.local` and add the following:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Fill in the values from Supabase Dashboard (see Section 3).

---

## 3. Where to Find Values

### Step 1
Open Supabase Dashboard and select your **Development** project.

### Step 2
Go to:
```
Project Settings → API
```

### Step 3 — Project URL
Copy the value under **Project URL**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
```

### Step 4 — Anon Key
Copy the value under **Project API Keys → anon public**:
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> Use the `anon` key only. Never use the `service_role` key.

---

## 4. Security Rules

| Rule | Detail |
|---|---|
| Never commit `.env.local` | Listed in `.gitignore`. Committing exposes credentials to GitHub. |
| Never paste keys into chat | Do not share credentials in any conversation or document. |
| Development Supabase only | Use only the Development project credentials. |
| Production prohibited | Production Supabase access is prohibited until explicit GPT CTO approval. |
| Do not share `service_role` key | Only `anon` key is permitted in client-side environment variables. |

---

## 5. Verification Commands

After creating `.env.local`, run the following to verify:

**Confirm file exists locally:**
```bash
ls -la .env.local
```

Expected output:
```
-rw-r--r--  1 yourname  staff  120 Jun 21 00:00 .env.local
```

**Confirm file is NOT tracked by git:**
```bash
git status
```

Expected output:
```
nothing to commit, working tree clean
```

`.env.local` must NOT appear in `git status` output.

---

## 6. Expected Result

| Check | Expected |
|---|---|
| `.env.local` exists locally | ✅ File present in project root |
| `.env.local` in `git status` | ❌ Must NOT appear |
| `git ls-files \| grep env.local` | ❌ Must return nothing |
| Variables are set | ✅ Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` have values |

---

## 7. Current Status

| Item | Status |
|---|---|
| `.env.example` | ✅ Committed — template file |
| `.env.local` | ❌ Not created — must be created locally |
| RLS applied | ❌ Not yet — awaiting approval |
| Authentication implemented | ❌ Not yet — awaiting specification |
