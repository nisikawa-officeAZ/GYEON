# AI Settings UI Specification

**Module**: `src/app/settings/ai/` + `src/components/settings/ai/`  
**Sprint**: Sprint 11U  
**Version**: 1.0.0  
**Status**: Foundation complete

---

## 1. Purpose

The AI Settings UI is a dedicated settings page at `/settings/ai` that gives dealers a comprehensive view of their AI provider configuration, capability assignments, marketplace options, and budget. It consolidates and extends the existing `AIGatewaySettings` component with per-capability assignment, recommendation modes, and marketplace discovery.

This page does not replace `/settings` (which handles API key entry). It is the AI-specific configuration experience built on top of the keys already stored through the existing gateway.

---

## 2. Page Location

| Item | Value |
|------|-------|
| URL | `/settings/ai` |
| Server component | `src/app/settings/ai/page.tsx` |
| Client components | `src/components/settings/ai/` |
| Feature gate | Pro+ required (`FEATURE_NOT_LICENSED` → upgrade prompt) |
| Migration awareness | Shows migration notices for 072 and 073 |

---

## 3. Page Sections

The page renders 6 sections in scrolling order:

| Section | Component | Purpose |
|---------|-----------|---------|
| §1 Overview | `AIOverviewSection` | Configuration health, primary provider, platform status |
| §2 Provider Status | `ProviderStatusSection` | 5 gateway + 6 extension provider tiles |
| §3 Capability Assignment | `CapabilityAssignmentSection` | Per-capability provider assignment + recommendation modes |
| §4 Budget | `BudgetSection` | Monthly spend, limit, budget strategy |
| §5 AI Health | `AIHealthSection` | Provider health status and latency |
| §6 Marketplace | `MarketplaceSection` | All 11 providers with category filter |

---

## 4. Data Flow

All data is loaded server-side in `page.tsx`. No client-side data fetching.

```
page.tsx (server component)
  → getAISettingsProfile()        — AISettingsResult<AISettingsProfile>
  → getAiSettings()               — AiSettingsView (key status, primary provider)
  → buildSettingsPlatformView()   — AISettingsPlatformView (view models)
  → AI_MARKETPLACE_PROVIDER_PROFILES — static, 11 providers
  → CATEGORY_CATALOG              — static, 14 categories
  → PROVIDER_RECOMMENDATIONS      — static, 68 recommendations
  → discoverFeatures({ application_id: "dealer_agent" }) — Platform Core
  → isModuleAvailable("ai_gateway")    — Platform Core
  → isModuleAvailable("ai_marketplace") — Platform Core
  → AI_SETTINGS_PLATFORM          — descriptor (settings_available)
```

Security: `dealer_id` is always injected by `getCurrentDealer()` inside server actions. Nothing from URL params or client state.

---

## 5. Section Specifications

### 5.1 AIOverviewSection

Props:
- `isFullyConfigured` — true when no configuration issues
- `configurationIssues` — array of English issue strings
- `primaryProvider` — `AIProviderId | null`
- `settingsAvailable` — from `AI_SETTINGS_PLATFORM.settings_available`
- `migrationRequired` — true when profile result has MIGRATION_REQUIRED
- `profileVersion` — string from `AISettingsProfile`
- `platformCoreVersion` — from `PLATFORM_CORE.version`
- `aiGatewayModuleActive` — from `isModuleAvailable("ai_gateway")`
- `errorCode` — string or null from `AISettingsResult`

Behavior:
- Shows amber banner when `migrationRequired` is true
- 3-column status grid: Config State, Primary Provider, Platform info
- Link to `/settings` for key management

### 5.2 ProviderStatusSection

Props:
- `providerCards` — `AIProviderStatusCard[]` (5 gateway)
- `extensionProviders` — `AIProviderProfile[]` (6 marketplace_only)
- `aiGatewayModuleActive` — Platform Core module status

Behavior:
- Gateway provider tiles: name, health indicator, key status badge, quality/cost tiers
- Extension provider tiles: smaller, shows adapter_sprint
- Primary provider highlighted with blue border

### 5.3 CapabilityAssignmentSection (Phase B + D)

Props:
- `categories` — `AICapabilityCategoryMetadata[]` (14)
- `capabilityCards` — `AICapabilityAssignmentCard[]` (16 base capabilities)
- `availableProviders` — filtered to has_key_stored or is_primary
- `recommendations` — `AIProviderRecommendation[]` (68 entries)
- `migrationRequired` — for save banner

Local state:
- `mode: AIRecommendationMode` — default "balanced"
- `assignments: Record<AICapability, { preferred_provider, fallback_provider, disabled }>`

Behavior:
- **Recommendation mode selector**: 5 mode buttons (best_quality, lowest_cost, fastest, balanced, dealer_selected)
- **Auto modes** (not `dealer_selected`): show "Recommended: ProviderName" badge per capability
- **Manual mode** (`dealer_selected`): show preferred + fallback dropdowns per capability
- All modes: per-capability disable toggle
- Save button → `saveAISettingsProfile({ capability_assignments })` → handles MIGRATION_REQUIRED
- Capabilities grouped by CATEGORY_CATALOG category (14 groups)

### 5.4 BudgetSection (Phase E)

Props:
- `budgetCard` — `AIBudgetCard`
- `hasAnyKey` — true if any gateway provider has a key
- `migrationRequired` — for limit-editing notice

Behavior:
- Current month spend (0 until migration 073)
- Progress bar (hidden when no limit set)
- Monthly limit + budget strategy display
- Note that usage tracking requires migration 073
- Link to `/settings` if no API key stored

### 5.5 AIHealthSection

Props:
- `healthCards` — `AIHealthCard[]` (5 providers)

Behavior:
- Grid of provider health tiles
- All show "not_checked" / null latency until gateway adapters are implemented
- Displays health dot, latency_ms, last_checked timestamp, error_message

### 5.6 MarketplaceSection (Phase C)

Props:
- `providerProfiles` — `AIProviderProfile[]` (11)
- `categories` — `AICapabilityCategoryMetadata[]` (14)
- `marketplaceModuleReady` — from `isModuleAvailable("ai_marketplace")`

Behavior:
- Category filter buttons (all + 14 categories)
- Extension provider toggle (show/hide marketplace_only providers)
- Provider cards: display_name, vendor, description, specialty badges, pricing_model, cost_tier
- Status badges: active, beta, coming_soon, marketplace_only
- Extension providers show adapter_sprint
- "Module: planned" badge when `marketplaceModuleReady` is false

---

## 6. Platform Core Integration

The page integrates with Platform Core per PLAT-002 (Shared Services Through Platform Core):

```typescript
// Checked at module load time (static, sync)
const AI_GATEWAY_MODULE_ACTIVE    = isModuleAvailable("ai_gateway");
const AI_MARKETPLACE_MODULE_READY = isModuleAvailable("ai_marketplace");

// Called server-side at render time
const discoveryResult = discoverFeatures({ application_id: "dealer_agent" });
```

These drive:
- Module status badges in Overview and Marketplace sections
- "Active caps" count in the page header
- Adapter availability notes in Provider tiles

---

## 7. Persistence Behavior

| Action | When it works | When it doesn't |
|--------|--------------|-----------------|
| `saveAISettingsProfile()` | After migration 072 is applied | Returns MIGRATION_REQUIRED → amber notice |
| Usage tracking | After migration 073 is applied | `current_month_usd` = 0 |
| Key management | Always (in `/settings` via `saveAiSettings()`) | — |

The UI degrades gracefully: all views render with defaults when migration is pending. Save buttons remain visible and functional — they call the server action and surface the MIGRATION_REQUIRED state to the dealer through an inline notice.

---

## 8. UI Design

- Dark theme: `bg-slate-900`, `border-slate-800`
- Primary accent: `border-blue-600`, `bg-blue-950/20`
- Section headers: `text-sm font-semibold text-slate-300`
- Status dots: emerald=healthy, amber=degraded/warning, red=error, slate=unchecked
- Dealer-facing text: Japanese (PLAT-010)
- All code comments, docs, type annotations: English only

---

## 9. Navigation

The page has a breadcrumb: `← 設定 / AI設定`.  
The `/settings` page retains the existing `AIGatewaySettings` component for API key management.  
A link from the AI Settings section of `/settings` to `/settings/ai` should be added in a future sprint.

---

## 10. Files

| File | Purpose |
|------|---------|
| `src/app/settings/ai/page.tsx` | Server component; loads all data; renders sections |
| `src/components/settings/ai/AIOverviewSection.tsx` | Config health + primary provider summary |
| `src/components/settings/ai/ProviderStatusSection.tsx` | Gateway + extension provider tiles |
| `src/components/settings/ai/CapabilityAssignmentSection.tsx` | Capability assignment + recommendation mode |
| `src/components/settings/ai/BudgetSection.tsx` | Budget spend and strategy |
| `src/components/settings/ai/AIHealthSection.tsx` | Provider health and latency |
| `src/components/settings/ai/MarketplaceSection.tsx` | Marketplace provider discovery |

---

## 11. Pending (Sprint 12+)

1. **Link from `/settings`** — add "AI Settings →" link in AIGatewaySettings to `/settings/ai`
2. **Recommendation mode persistence** — save selected recommendation mode in AISettingsProfile when migration 072 is applied (current AISettingsProfileSaveInput does not include this field)
3. **Real health checks** — `AIHealthSection` shows all "not_checked" until gateway adapters are implemented
4. **Usage tracking** — `BudgetSection` shows `$0.00` until migration 073 is applied
5. **Marketplace provider detail modals** — full specs, pricing documentation, adapter status
6. **Extension provider activation** — when adapters ship for google_veo/runway/etc., the marketplace tiles gain activation controls
