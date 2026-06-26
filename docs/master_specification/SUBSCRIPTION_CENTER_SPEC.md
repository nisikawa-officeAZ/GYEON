# GYEON Business Hub — Subscription & Billing Center Specification

**Module**: `src/lib/subscription/` (Sprint 11Y additions)  
**Version**: 1.0.0 — Sprint 11Y  
**Status**: Foundation implemented  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The Subscription & Billing Center is a platform-level foundation module that models the pricing strategy, subscription tiers, AI entitlements, and application entitlements for both GYEON Business Hub product families.

**This is a foundation — not a billing system.**

| What this IS | What this is NOT |
|---|---|
| Subscription plan declarations | Live billing or invoicing |
| AI entitlement tier model | Stripe / payment provider integration |
| Application access model | Database-backed subscription state |
| Pricing strategy architecture | Hardcoded prices (except examples) |
| Governance policy declarations | Runtime feature gate enforcement |

---

## 2. Product Families

| Family | Display Name | Target Market | Plan Count | Status |
|---|---|---|---|---|
| `gyeon_business_hub` | GYEON Business Hub | GYEON Japan ecosystem, Office AZ, Attraction Co., Ltd. | 5 | planned |
| `detailer_agent` | Detailer Agent | Generic professional detailing shops worldwide | 4 | planned |

The two families share the same platform infrastructure but have entirely separate plan models, billing cycles, and target markets.

---

## 3. Detailer Agent — Four-Tier Pricing Model

AI capability is the primary plan differentiator. Tiers are cumulative.

### 3.1 Tier Overview

| Tier | ID | AI Level | Applications Included |
|---|---|---|---|
| Starter | `starter` | No AI | Dealer Agent |
| Professional | `professional` | Basic AI, OCR, Communication AI | Dealer Agent, Communication Center |
| Business AI | `business_ai` | Marketing AI, Growth AI, Video AI, AI Marketplace | + AI Center, CRM (future) |
| Enterprise AI | `enterprise_ai` | All AI + Dealer-Owned Provider | + Distribution, Warehouse, Accounting (future, add-on) |

### 3.2 Starter

**Target**: New shops, solo operators, budget-conscious.  
**Billing**: Monthly or Annual.  
**Price**: Contact sales (example only — no hardcoded price).

| Features | Included |
|---|---|
| Customer management | ✓ |
| Vehicle management | ✓ |
| Estimate creation | ✓ |
| PDF estimate generation | ✓ |
| Product catalog | ✓ |
| Product orders | ✓ |
| Staff (up to 3) | ✓ |
| AI features | — |
| Communication Center | — |

### 3.3 Professional

**Target**: Established shops with staff and customer communication needs.  
**Billing**: Monthly or Annual.

| Features | Included |
|---|---|
| All Starter features | ✓ |
| Work orders | ✓ |
| Calendar & reservations | ✓ |
| Completion reports | ✓ |
| Invoicing & payments | ✓ |
| Maintenance reminders | ✓ |
| LINE messaging (Communication Center) | ✓ |
| Basic AI (spell check, auto-complete) | ✓ |
| OCR (vehicle registration) | ✓ |
| AI reply generation (staff review required) | ✓ |
| Unlimited staff | ✓ |

### 3.4 Business AI

**Target**: Growth-stage shops using AI for marketing and customer retention.  
**Billing**: Monthly or Annual.

| Features | Included |
|---|---|
| All Professional features | ✓ |
| SNS caption generation | ✓ |
| SEO / MEO / AEO / LLMO / AIO metadata generation | ✓ |
| AI review request automation | ✓ |
| AI follow-up sequence builder | ✓ |
| AI social media scheduler | ✓ |
| Before/after video generation | ✓ |
| AI growth insights & revenue forecasting | ✓ |
| Customer retention risk scoring | ✓ |
| AI Marketplace access | ✓ |
| CRM (future, planned) | ✓ |

### 3.5 Enterprise AI

**Target**: Large shops, franchise networks, and enterprise dealers requiring platform control.  
**Billing**: Monthly, Annual, or Enterprise Contract. **Sales approval required**.

| Features | Included |
|---|---|
| All Business AI features | ✓ |
| Dealer-owned AI provider (OpenAI, Anthropic, Gemini) | ✓ |
| Per-capability AI model selection | ✓ |
| AI budget controls and usage limits | ✓ |
| Multi-channel communication (WhatsApp, Instagram, X — future) | ✓ |
| CRM advanced features | ✓ |
| Distribution (future — add-on) | add-on |
| Warehouse (future — add-on) | add-on |
| Accounting (future — add-on) | add-on |
| Enterprise AI usage audit logs | ✓ |
| Priority support | ✓ |

---

## 4. GYEON Business Hub — Plan Model

GYEON Business Hub uses a separate plan model from Detailer Agent. Billing is manual (invoice-based) and enterprise-contract.

| Plan ID | Display Name | Applications | AI Level | Sales Approval |
|---|---|---|---|---|
| `free` | Free | None | No AI | No |
| `basic` | Basic | Dealer Agent | No AI | No |
| `pro` | Pro | Dealer Agent, Communication Center | Basic + OCR + Comm AI | No |
| `pro_plus` | Pro+ | + AI Center, CRM (future) | Full marketing + growth AI | No |
| `enterprise` | Enterprise | All applications | All AI + Dealer-Owned Provider | Yes |

---

## 5. AI Entitlement Model

Ten AI entitlement levels, cumulative. Higher tiers include all lower entitlements.

| Level | ID | Description | Available From (Detailer) | Available From (GYEON) |
|---|---|---|---|---|
| 0 | `no_ai` | No AI features | Starter | Free |
| 1 | `basic_ai` | Spell check, text suggestions | Professional | Pro |
| 2 | `ocr_ai` | Vehicle registration OCR | Professional | Pro |
| 3 | `marketing_ai` | SNS captions, SEO/MEO/AEO/LLMO/AIO | Business AI | Pro+ |
| 4 | `communication_ai` | AI-assisted customer messaging | Professional | Pro |
| 5 | `video_ai` | AI before/after video generation | Business AI | Pro+ |
| 6 | `growth_ai` | Revenue forecasting, retention scoring | Business AI | Pro+ |
| 7 | `marketplace_ai` | Full AI Marketplace access | Business AI | Pro+ |
| 8 | `dealer_owned_provider` | Dealer sets own API keys (OpenAI, etc.) | Enterprise AI | Enterprise |
| 9 | `enterprise_ai` | All AI + budget controls + audit logs | Enterprise AI | Enterprise |

### 5.1 Dealer-Owned AI Provider Concept

Available on **Enterprise AI** (Detailer) and **Enterprise** (GYEON Hub).

- Dealer provides their own API key for OpenAI, Anthropic, Google Gemini, or compatible provider.
- AI costs billed directly to the dealer's provider account (not the platform's AI budget).
- Platform routes AI requests to dealer's credentials for capabilities where the dealer has configured a key.
- Budget limits and usage policies configurable per dealer.
- Keys stored encrypted, server-side only, isolated per tenant (SUB-005).

Future billing integration (Sprint 12+) will wire dealer-owned provider key management to the Settings UI.

---

## 6. Application Entitlement Model

Seven application entitlements per plan. Each is `included`, `addon`, `not_available`, or `contact_sales`.

| Application | Entitlement ID | Platform Ref | Minimum (Detailer) | Minimum (GYEON) | Future? |
|---|---|---|---|---|---|
| Dealer Agent | `dealer_agent` | `dealer_agent` | Starter | Basic | No |
| Communication Center | `communication_center` | `dealer_agent` | Professional | Pro | No |
| AI Center | `ai_center` | `ai_operations` | Business AI | Pro+ | No |
| CRM | `crm` | `crm` | Business AI | Pro+ | Yes |
| Distribution | `distribution` | `enterprise_distribution` | Enterprise AI | Enterprise | Yes |
| Warehouse | `warehouse` | `warehouse` | Enterprise AI | Enterprise | Yes |
| Accounting | `accounting` | `accounting` | Enterprise AI | Enterprise | Yes |

---

## 7. Subscription Governance Policy

| Rule | Title | Enforcement |
|---|---|---|
| SUB-001 | Feature Access Governed by Active Subscription Tier Only | strict |
| SUB-002 | AI Entitlements Are Exclusively Controlled by Subscription Tier | strict |
| SUB-003 | Application Access Controlled by Subscription Application Entitlements | strict |
| SUB-004 | No Prices or Billing Data Hardcoded in Application Code | strict |
| SUB-005 | Dealer-Owned Provider Keys Stored Server-Side and Isolated Per Tenant | strict |
| SUB-006 | Subscription Data Isolated Per Tenant | strict |
| SUB-007 | Upgrade Prompts Should Be Contextual and Non-Intrusive | advisory |
| SUB-008 | AI Usage Budget Warnings Should Trigger Before Limits Are Reached | advisory |

---

## 8. Module Structure

New files added to `src/lib/subscription/` (Sprint 11Y):

```
src/lib/subscription/
├── subscription-center-types.ts     — All Sprint 11Y domain types
├── product-families.ts              — 2 product family descriptors
├── detailer-agent-plans.ts          — 4 Detailer Agent tiers
├── gyeon-hub-plans.ts               — 5 GYEON Business Hub plans
├── ai-entitlements.ts               — 10 AI entitlement descriptors
├── application-entitlements.ts      — 7 application entitlement descriptors
├── subscription-policy.ts           — SUB-001 through SUB-008
├── subscription-registry.ts         — Unified registry + lookup helpers
├── platform-core-bridge.ts          — Platform Core integration
└── subscription-center.ts           — Package barrel (Sprint 11Y public API)
```

Existing runtime subscription system (untouched):

```
src/lib/subscription/
├── subscription-types.ts    — PlanCode, FeatureKey, DB shapes (PHASE58, unchanged)
├── feature-gates.ts         — Server-side feature gate utilities (unchanged)
├── saas-foundation-types.ts — DealerLifecycleStage, BillingModel (Sprint 11Q, unchanged)
├── subscription.ts          — getCurrentDealerSubscription() runtime (unchanged)
└── usage.ts                 — Usage tracking (unchanged)
```

**Dependency direction:**
```
subscription/platform-core-bridge → platform-core/ (one-way)
```

---

## 9. Platform Core Integration

The Subscription Center exposes the following to Platform Core via `platform-core-bridge.ts`:

| Function | Purpose |
|---|---|
| `getAvailablePlansForFamily()` | List plans for a product family |
| `getEnabledAIEntitlements()` | AI entitlements for a given plan |
| `isPlatformApplicationAccessible()` | Check app access for a PlatformApplicationId |
| `getMinimumPlanForAI()` | Minimum plan required for an AI entitlement |
| `getMinimumPlanForPlatformApp()` | Minimum plan required for a platform application |
| `SUBSCRIPTION_MODULE_MANIFEST` | Platform Core-compatible module manifest |
| `SUBSCRIPTION_CENTER` | Subscription Center descriptor |

---

## 10. Future Billing Integration

| Sprint | Work |
|---|---|
| Sprint 12+ | Stripe integration (requires CTO approval and dedicated sprint) |
| Sprint 12+ | Subscription Settings UI — Detailer Agent plan selection |
| Sprint 12+ | Dealer-owned AI provider key management UI |
| Sprint 12+ | Runtime feature gate wired to Subscription Center entitlements |
| Sprint 13+ | Manual billing admin interface (GYEON Business Hub) |
| Sprint 13+ | Enterprise contract management |

---

## 11. Registry Summary

| Item | Count |
|---|---|
| Product families | 2 |
| Total subscription plans | 9 |
| Detailer Agent tiers | 4 |
| GYEON Business Hub plans | 5 |
| AI entitlement levels | 10 |
| Application entitlements | 7 |
| Governance policies | 8 |
| Strict policies | 6 |
| Advisory policies | 2 |
