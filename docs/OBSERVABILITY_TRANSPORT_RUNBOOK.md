# Observability Transport Runbook (OBS-1P)

Operational contract for the first-party browser → server observability transport.

**This document exists because two of the transport's guarantees cannot be expressed in source code:** the WAF rate-limit rule and the runtime-log retention plan. Both are account/dashboard state. Without this file, the only record of what was assumed would be a review transcript, and a future operator reading `src/app/api/observability/event/route.ts` would see rate limiting *relied upon* with no way to discover what rule was expected — or that it was never created.

> **Nothing in this document is a claim that the plan or WAF rule is currently active.** At the time of writing, neither has been activated. Activation is a deployment-phase action, and §6 is the proof that it happened.

---

## 1. What the transport does

An uncaught UI error in the browser produces a support code of the form `obs.<32 lowercase hex>`, which OBS-1B displays and asks the user to quote. Before OBS-1P that code was written only to the **end user's own devtools console**, so support had nothing to search.

The transport POSTs a four-field record to a same-origin first-party route, which re-validates it and emits one structured line into the server runtime log, where it is searchable.

- Client: `src/lib/observability/observability-transport.ts`
- Route: `src/app/api/observability/event/route.ts` (`POST /api/observability/event`)
- Sink selection: `src/lib/observability/report-observability-event.ts`

No third-party provider is involved. `externalProviderSink` remains `null`.

## 2. Commercial requirement (owner-ratified)

| Item | Ratified value |
|---|---|
| Plan | **Vercel Pro + Observability Plus** |
| Required runtime-log retention | **30 days** |
| Storage of events in Supabase / any application table | **Prohibited** |

**Why 30 days is a requirement and not a preference.** Retention is what makes the support workflow function. A user who reads a code off a crash screen and calls the next morning must still be findable.

- Hobby: 1 hour retention — **not viable**. The support flow OBS-1B already ships to users would fail almost immediately, and Hobby permits only one WAF rule per project.
- Pro: 1 day — acceptable only for a pre-production pilot where reports are triggered and searched immediately.
- Pro + Observability Plus: 30 days — the ratified production configuration.

Events are never written to the application database. Doing so would place unauthenticated public writes into business tables and convert a logging-plan decision into a schema and RLS liability.

## 3. Required WAF rule (owner-ratified)

| Field | Value |
|---|---|
| Path | `/api/observability/event` |
| Method | `POST` |
| Rule type | Fixed window |
| Threshold | **20 requests per 60 seconds** |
| Counting key | **Client IP** |
| Action | Deny → `429` |

Client IP is the counting key because it is the key available on **both Hobby and Pro**. Fixed-window is likewise supported on both.

**Rate limiting is deliberately NOT implemented in the route.** In serverless execution each concurrent instance holds its own memory, so an in-process counter enforces `N × instance-count` and resets on every cold start — the appearance of a limit with none of the effect. The limit must sit in front of the function.

**A source test can never prove this rule is active.** Only §6.6 can.

## 4. Expected responses

| Condition | Status | Emits a log? |
|---|---|---|
| Valid DTO | `204` (empty body) | **Yes — exactly one** |
| Unknown key, missing key, invalid literal, bad `requestId`, malformed JSON, wrong/absent content type, foreign `Origin` | `400` | **No** |
| Body over 1024 bytes | `413` | **No** |
| Any method other than `POST` | `405` (framework-handled) | **No** |
| Over the WAF threshold | `429` (**WAF, before the function runs**) | **No** |

Rejected requests emit nothing on purpose: logging rejected input would turn a size-capped endpoint into a log-injection amplifier.

The success response carries no body — not even the support code — and the request body is never echoed.

## 5. Accepted request contract

`POST /api/observability/event`, `Content-Type: application/json`, max **1024 bytes** (enforced on the byte stream; `Content-Length` is used only for an early reject and is never trusted).

```json
{
  "requestId": "obs.0123456789abcdef0123456789abcdef",
  "event": "uncaught-ui-error",
  "stage": "global-boundary",
  "code": "UNCAUGHT_UI_ERROR"
}
```

All four keys are required; `stage` is one of `global-boundary` / `app-boundary` / `estimates-boundary`; `event` and `code` are fixed literals; `requestId` must be `obs.<32 lowercase hex>` and **`obs.unattributed` is rejected** (an unattributable code is unsearchable and therefore worthless).

Any additional key rejects the whole request. `severity`, `env` and `release` are supplied by the **server**. `dealerId` and `userId` are not accepted at all.

The endpoint is **unauthenticated by necessity** — the global error boundary and the login page have no session — and reads no cookies.

## 6. Post-deployment proof (required before B7 cutover)

Run in order on the deployed environment. Record the result of each step.

1. **Trigger** one controlled client boundary incident.
2. **Capture** the displayed `obs.<32 hex>` code.
3. **Search** that exact code in Vercel Runtime Logs (free-text search of the message field).
4. **Prove exactly one** accepted server log line exists for it — not zero, not two.
5. **Prove** a malformed body (`400`) and an oversized body (`413`) each produce **no** observability log.
6. **Prove** the WAF returns **`429`** after exceeding 20 requests in 60 seconds.
7. **Prove** the logged `release` equals the deployed 40-hex commit SHA and is **not** `"unknown"`.
8. **Record** the account plan and the effective retention (expected: Pro + Observability Plus, 30 days).

**B7 production cutover remains NO-GO until every step above passes on the real platform.**

## 7. Re-verification triggers

Re-run §6 in full after any of:

- a plan change (including trial expiry or downgrade)
- adding, editing or removing any WAF / firewall rule
- a domain or custom-domain change
- a change to the route path, method or request contract
- a change to sink selection in `report-observability-event.ts`
- a change to release identity (REL-1) in `next.config.ts`

A plan downgrade silently shortens retention. A deleted WAF rule silently removes the only rate limit. Neither produces a build or test failure — which is precisely why the trigger list is here.

## 8. What source tests do and do not prove

**Proven by `npm test` / the committed suites:** route validation, size cap and stream enforcement, origin handling, response codes, zero-emission on rejection, exactly-once emission on success, server-owned `env`/`release`, and every client transport property (relative URL, `credentials: "omit"`, `keepalive: true`, no retry, no recursion, containment of every failure mode).

**Not provable by any test in this repository:** that the WAF rule exists, that the plan is Pro + Observability Plus, that retention is 30 days, or that runtime logs are searchable in this account. Those are §6 and §7 only.

## 9. Known operational limits

- **A genuine widespread outage can exceed 20 requests / 60 s per IP** and shed reports — the failure mode where reports matter most. The threshold is a deliberate trade against abuse; revisit it with real traffic data.
- **A failed report is lost.** The transport never retries, by design: retrying during a network failure turns observability into the outage.
- **Reports are best-effort.** `keepalive` improves but does not guarantee delivery during page teardown.
- **No client-side rate limit.** A hostile client can send up to the WAF threshold; the size cap bounds each request to 1024 bytes.
