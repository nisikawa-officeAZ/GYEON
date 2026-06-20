# DealerOS

Dealer Management System — development environment.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- TailwindCSS v4
- Supabase
- PWA
- Vercel

## Getting Started

```bash
cp .env.example .env.local
# Fill in .env.local with development credentials

npm install --cache /tmp/npm-cache
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/app/          — App Router pages
src/components/   — UI components
src/lib/supabase/ — Supabase client structure
src/types/        — TypeScript types
src/hooks/        — Custom hooks
public/icons/     — PWA icons
```

## Notes

- Development only. Never use production environment.
- Supabase not connected yet — awaiting CTO specification.
- Business logic and database schema require CTO approval before implementation.
