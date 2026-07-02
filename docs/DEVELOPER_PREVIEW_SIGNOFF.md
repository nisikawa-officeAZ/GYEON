# Developer Preview Sign-Off (E10.5)

Records that the codebase is ready for operator Developer Preview testing.
Documentation only — no code, schema, or deployment changes.

## Status
| Item | Value |
|---|---|
| Typecheck | ✅ PASS (`npm run typecheck`) |
| Build | ✅ PASS (`npm run build`) |
| Latest commit | `7a40a5a` |
| Branch | `fix/branding-schema-block` |
| Production deployment | ❌ None |
| Merge to main | ❌ None |
| Working tree | Clean |

## Phase completion (E10.1 – E10.4)
| Phase | Title | Status |
|---|---|---|
| E10.1 | Developer Preview Stabilization (error-message standardization; no internal detail exposure) | ✅ Completed |
| E10.2 | Developer Preview Test Pack (16-item Japanese operator checklist) | ✅ Completed |
| E10.3 | Pre-Release Stability Audit (routes / navigation / loading-error / permission / mobile / performance) | ✅ Completed |
| E10.4 | Developer Preview Launch Preparation (env, dev server, device URLs, operator guide) | ✅ Completed |
| E10.5 | Developer Preview Sign-Off (this document) | ✅ Completed |

## Test documents
- `docs/developer-preview-test-pack.md` — step-by-step operator test checklist (16 flows, JP).
- `docs/developer-preview-launch-guide.md` — Japanese operator launch guide (env, dev server, URLs, troubleshooting).

## Remaining operator-side requirements (before testing)
- [ ] Confirm `.env.local` is present on the Dev Mac with required variables.
- [ ] Confirm `OPENAI_API_KEY` is set (OCR); `OCR_MODEL` defaults to `gpt-4.1-mini` (fallback `gpt-4o-mini`).
- [ ] Confirm Supabase access (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and that storage buckets `vehicle-registration-documents` and `dealer-branding` exist.
- [ ] Start the dev server: `npm run dev` (port 3000; use `-H 0.0.0.0` for device access).
- [ ] Test on Mac (`http://localhost:3000`), iPhone and Android (`http://<Mac-LAN-IP>:3000`, same Wi-Fi).

## Notes
- Preserved throughout E10: OCR, Canonical Pricing Engine, Dealer Branding Engine, Calendar, Reservation, Accounts Receivable, Statement Preview.
- `dealer_id` is always resolved via `getCurrentDealer()`; never accepted from client input.
- Live OCR (gpt-4.1-mini + PDF), per-role permission checks, and device/mobile behavior are operator-side acceptance items (headless environment cannot exercise them).
