# AI API Ownership Policy

**Status:** Approved (Architect decision)
**Scope:** All AI features in DealerOS / GYEON Business Hub
**Owner:** GYEON Japan (Office AZ)

This policy defines **who owns and pays for the AI provider API key** behind every
AI feature. Every AI feature MUST declare an ownership before it ships.

---

## 1. Ownership concept

Two ownership modes, defined in `src/lib/ai/ownership.ts`:

| Ownership       | Key source                                   | Who pays      |
| --------------- | -------------------------------------------- | ------------- |
| `gyeon_managed` | GYEON platform key — `OPENAI_API_KEY` (env)  | GYEON Japan   |
| `dealer_managed`| Dealer's own key — encrypted in `dealer_settings.ai_settings` | The dealer |

```ts
export type AIProviderOwnership = "gyeon_managed" | "dealer_managed";
```

---

## 2. GYEON-managed features

Run on **GYEON's own platform key**. The dealer is never asked to configure a key.

- Vehicle registration OCR (車検証OCR)
- GYEON product/service estimate recommendation AI
- GYEON-wide inventory / sales diagnostics
- System-level AI features controlled by GYEON Japan

**Key management:** the GYEON OpenAI key is managed from the **Super Admin AI
Center** (`/admin/ai-center`). It is stored **AES-256-GCM encrypted** in the
`gyeon_ai_settings` table (migration `094`, service-role only) and resolved
**server-side only** via `getGyeonManagedApiKey()`
(`src/lib/ai/gyeon-managed-key.ts`). The key is **never** returned to the client
(shown masked as `sk-...****`) and **never** logged.

**Key lookup order** (see `getGyeonManagedApiKey`):
1. DB-stored GYEON key from the AI Center (`gyeon_ai_settings`, encrypted)
2. `process.env.OPENAI_API_KEY` — development fallback

```
# .env.local (development fallback — never committed)
OPENAI_API_KEY=sk-...
# Required to encrypt/decrypt the DB-stored key:
DEALER_AI_KEY_SECRET=<64 hex chars>
```

**AI Center capabilities (Super Admin only):** register/update key, live
connection test, last-tested timestamp, and connection state
(未設定 / 接続成功 / 接続失敗).

---

## 3. Dealer-managed features

Run on the **dealer's own API key**. These process dealer-specific business data
at high or unpredictable volume, so the dealer owns the cost.

- Dealer customer analysis AI
- Dealer LINE reply AI
- Dealer private inventory analysis AI
- Dealer sales / profit analysis AI
- Any AI feature processing dealer-specific business data at high or unpredictable volume

**Key storage:** per-dealer, encrypted (AES-256-GCM) in
`dealer_settings.ai_settings` via the AI Gateway (`src/lib/ai/crypto.ts`,
`save-ai-settings.ts`). Resolved server-side via `resolveDealerManagedApiKey()`
(`src/lib/ai/dealer-managed-key.ts`).

Rules:
- The raw key is **never** exposed to the client and **never** returned by a
  `"use server"` action.
- Broad billing is **not** implemented (intentionally out of scope).
- Minimal usage logging exists: `gyeon_ai_usage_log` (migration `095`, service-role
  only) records one row per GYEON-managed AI call (currently vehicle OCR
  success/failure) via `src/lib/ai/log-ai-usage.ts`. No cost/billing logic —
  `estimated_cost` is reserved (nullable). The AI Center shows a simple summary.

### Missing dealer key

When a dealer-managed feature is invoked without a configured dealer key, show
the standard message (`DEALER_AI_KEY_REQUIRED_MESSAGE`):

> このAI機能を利用するには、AI APIキーの設定が必要です。

---

## 4. Vehicle registration OCR

OCR is **`gyeon_managed`**. It resolves the key exclusively through
`getGyeonManagedApiKey()` (→ `OPENAI_API_KEY`) in:

- `src/lib/vehicle-registration/ocr.ts` — key read for the OpenAI Vision call
- `src/lib/vehicle-registration/actions.ts` — pre-flight guard (Step 3)

The `OPENAI_API_KEY_MISSING` error now surfaces to the user as:

> OpenAI APIキーが登録されていません。Super AdminのAIセンターから設定してください。

OCR is **never** blocked on a dealer API key.

---

## 5. Where to add keys

| Key                  | Location                         | Notes                                  |
| -------------------- | -------------------------------- | -------------------------------------- |
| `OPENAI_API_KEY`     | `.env.local` (dev) / host env (prod) | GYEON-managed. Server-side only. Restart dev server after adding. |
| `DEALER_AI_KEY_SECRET` | `.env.local` / host env        | 64 hex chars. Required to encrypt/decrypt the AI Center key. |
| Dealer provider keys | `dealer_settings.ai_settings` (encrypted) | Entered by the dealer in AI Gateway settings. |

### `DEALER_AI_KEY_SECRET` — required to save the AI Center OpenAI key

The AI Center encrypts the GYEON OpenAI key (AES-256-GCM) before storing it. That
encryption needs a server-side secret named **`DEALER_AI_KEY_SECRET`**. Without it,
saving a key is blocked and the AI Center shows:

> AIキー保存用の暗号化キーが未設定です。サーバー環境変数 DEALER_AI_KEY_SECRET を設定してください。

Rules:
- **Server-side only.** It is read only in `src/lib/ai/crypto.ts`. **Never** prefix
  it with `NEXT_PUBLIC_`, never expose it to the client, never log it.
- **Format: exactly 64 hexadecimal characters** (32 bytes). Other lengths are rejected.
- Generate a fresh random value with:

  ```bash
  openssl rand -hex 32
  ```

- Add it to `.env.local` (development) or the host environment (production):

  ```
  DEALER_AI_KEY_SECRET=<64 hex chars from `openssl rand -hex 32`>
  ```

- **Restart `npm run dev`** after editing `.env.local` — env changes are only picked
  up on a fresh server start.
- Treat it as a long-lived secret: rotating it makes previously saved keys undecryptable
  (they would need to be re-entered in the AI Center).

---

## 6. Source of truth

- `src/lib/ai/ownership.ts` — ownership types, feature→ownership registry, standard message
- `src/lib/ai/gyeon-managed-key.ts` — GYEON-managed key resolver (server-only)
- `src/lib/ai/dealer-managed-key.ts` — dealer-managed key resolver (server-only)

Related: `docs/master_specification/AI_GATEWAY_SPEC.md` (dealer AI Gateway design).
