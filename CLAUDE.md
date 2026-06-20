# DealerOS — CLAUDE.md

## Role
Senior Engineer (implementation only).

## Tech Stack
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS v4
- Supabase (not connected yet)
- PWA via @ducanh2912/next-pwa
- Vercel deployment target

## Rules
- Development environment only — never use production
- Never expose credentials or secrets
- Wait for GPT CTO specifications before implementing business logic
- Never redesign approved business logic
- Never modify database schema without GPT CTO approval
- Ask before deleting any files

## Project Structure
```
src/
  app/          # Next.js App Router pages
  components/   # Shared UI components
  lib/
    supabase/   # Supabase client (browser + server)
  types/        # TypeScript type definitions
  hooks/        # Custom React hooks
public/
  icons/        # PWA icons
  manifest.json # PWA manifest
```

## Environment
- Copy `.env.example` to `.env.local` for local development
- Never commit `.env.local`
