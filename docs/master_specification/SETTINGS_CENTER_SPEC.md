# Unified Settings Center — Sprint 12F Specification

## Overview

The Unified Settings Center (`src/lib/settings/`) is the canonical metadata registry for all configurable settings across the GYEON platform and Detailer Agent.

It is a **pure metadata layer** — it describes what settings exist, who can see them, how they're navigated, and which platform modules own them. It does NOT store or mutate actual setting values. Runtime values remain in `dealer_settings` (dealer-settings module) and other application DB tables.

---

## Relationship to Existing Settings Infrastructure

| Module | Purpose | Sprint |
|--------|---------|--------|
| `src/lib/dealer-settings/` | Runtime DB values for a specific dealer | PHASE70 |
| `src/lib/ai-settings/` | AI gateway runtime config | PHASE72 |
| `src/components/settings/SettingsCategoryNav.tsx` | UI: 12-category flat grid | PHASE72 |
| `src/app/settings/page.tsx` | Settings page (flat layout) | PHASE72 |
| `src/lib/settings/` | **THIS MODULE**: metadata registry | Sprint 12F |

The `SettingsCategoryNav.tsx` renders 12 categories in a flat grid today. The canonical registry declares all 20 categories — 10 active, 10 planned. The UI component is **not modified** by Sprint 12F.

---

## Module Structure

```
src/lib/settings/
├── settings-types.ts              Core type definitions
├── settings-category-registry.ts  20 categories + 7 groups + 8 policies
├── settings-visibility.ts         6 visibility levels + access control
├── settings-feature-flags.ts      Module registration model (7 modules)
├── settings-navigation.ts         Navigation hierarchy + URL route map
├── settings-platform-bridge.ts    8 platform module integrations + manifest
└── index.ts                       Barrel export
```

---

## Phase A — Core Type Hierarchy

Defined in `settings-types.ts`:

### SettingsCategoryId (20 values)

| ID | Description | Group |
|----|-------------|-------|
| `dealer` | Store profile, hours, staff | core |
| `organization` | Multi-dealer hierarchy | core |
| `staff` | Staff management | core |
| `roles_permissions` | Permission matrix | core |
| `branding` | Logo, colors, documents | core |
| `notifications` | Alerts, reminders | core |
| `ai_providers` | AI gateway, API keys | ai |
| `ai_marketplace` | Agent settings, entitlements | ai |
| `communication` | LINE, WhatsApp, Email, SMS | communication |
| `automation` | Workflows, triggers | automation |
| `analytics` | Dashboards, reports | analytics |
| `subscription` | Plan, billing | business |
| `media` | Asset retention, consent | business |
| `ocr` | OCR processing | business |
| `pdf` | Document formatting | business |
| `customer_portal` | Customer-facing portal | business |
| `gyeon_distribution` | Distribution app | enterprise |
| `warehouse` | Warehouse app | enterprise |
| `crm` | CRM app | enterprise |
| `accounting` | Accounting app | enterprise |

### SettingsGroupId (7 values)

`core` · `ai` · `communication` · `automation` · `analytics` · `business` · `enterprise`

### SettingsVisibilityLevel (6 values)

| Level | Rank | can_modify | Maps to DealerStaffRole |
|-------|------|-----------|------------------------|
| `readonly` | 1 | false | `"readonly"` |
| `staff` | 2 | false | `"staff"` |
| `manager` | 3 | true | `"manager"` |
| `dealer_owner` | 4 | true | `"owner"` |
| `company_admin` | 5 | true | — (Sprint 13+) |
| `platform_admin` | 6 | true | — (internal only) |

### SettingsItemStatus (5 values)

`visible` · `hidden` · `future` · `experimental` · `enterprise_only`

### SettingsInputType (14 values)

`text` · `textarea` · `toggle` · `select` · `multi_select` · `number` · `email` · `url` · `secret` · `json` · `color` · `file_ref` · `date` · `display`

---

## Phase B — Category Registry

`settings-category-registry.ts` contains:

- `SETTINGS_CATEGORY_REGISTRY` — 20 `SettingsCategory` entries
- `SETTINGS_GROUPS` — 7 `SettingsGroup` entries (ordered 1–7)
- `SETTINGS_POLICIES` — 8 `SettingsPolicy` entries (SPOL-001 through SPOL-008)

Each category entry includes:
- `category_id`, `group_id`, `display_name`, `display_name_ja`
- `icon` (emoji), `min_visibility`, `status`, `requires_plan`
- `module_owner`, `section_ids[]`, `ui_available`, `target_sprint`

Currently active categories (`ui_available: true`):  
`dealer`, `staff`, `branding`, `notifications`, `ai_providers`, `communication`, `subscription`, `ocr`, `pdf`, `analytics`

---

## Phase C — Visibility Model

`settings-visibility.ts`:

### Key rule: SPOL-004 (Unknown Role Default Deny)

```typescript
function resolveVisibilityFromRole(role: DealerStaffRole | null | undefined): SettingsVisibilityLevel | null {
  switch (role) {
    case "owner":    return "dealer_owner";
    case "manager":  return "manager";
    case "staff":    return "staff";
    case "readonly": return "readonly";
    default:         return null;  // Unknown role → no access
  }
}
```

When `canViewSetting(null, requiredLevel)` is called with `null`:
- Returns `true` only if `requiredLevel === "readonly"`
- All other levels denied — prevents exposure to unresolved users

### Key rule: SPOL-005 (Platform Admin UI Isolation)

`isPlatformInternal("platform_admin")` → `true`.  
Settings UI must filter out all `platform_admin` categories before rendering.

---

## Phase D — Feature Registration

`settings-feature-flags.ts`:

7 platform modules register their settings:

| Module | Categories | Active Settings | Future Settings |
|--------|-----------|-----------------|-----------------|
| `dealer_agent` | dealer, staff, roles, branding, notifications, ocr, pdf | 9 | 0 |
| `ai_marketplace` | ai_providers, ai_marketplace | 3 | 2 |
| `communication_center` | communication | 4 | 2 |
| `automation_center` | automation | 0 | 2 |
| `analytics_center` | analytics | 0 | 2 |
| `subscription_center` | subscription | 1 | 1 |
| `media_asset_center` | media | 0 | 2 |

Registration entry structure: `item_id`, `category_id`, `display_name`, `status`, `min_visibility`, `requires_plan`, `requires_feature`, `is_destructive`, `db_path`, `target_sprint`.

---

## Phase E — Navigation Model

`settings-navigation.ts`:

Navigation hierarchy:
```
root (/settings)
  └── Group (sidebar section)
        └── Category (/settings/[category])
              └── Section (page sub-section)
                    └── Item (form field)
```

`SETTINGS_CATEGORY_ROUTES` provides `path`, `breadcrumb[]`, and `page_title` for all 20 categories.

Current routes (PHASE72 active):
- `/settings` → dealer, staff, subscription, ocr, pdf (flat page)
- `/settings/ai` → ai_providers

Planned routes (Sprint 13):
- `/settings/communication`, `/settings/analytics`, `/settings/media`, etc.

---

## Phase F — Platform Integration

`settings-platform-bridge.ts`:

8 `SettingsPlatformIntegration` entries:

| Module | Type | Owned | Consumed | Active |
|--------|------|-------|----------|--------|
| `platform_core` | settings_owner | dealer, staff, branding, notifications, ocr, pdf | — | ✅ |
| `organization` | settings_owner | organization | dealer, subscription | ❌ Sprint 13+ |
| `subscription_center` | bidirectional | subscription | dealer | ✅ |
| `communication_center` | settings_owner | communication | dealer, ai_providers | ✅ LINE |
| `automation_center` | settings_owner | automation | communication, ai_marketplace, dealer | ❌ Sprint 13 |
| `analytics_center` | settings_owner | analytics | subscription, dealer | ❌ Sprint 13 |
| `media_asset_center` | settings_owner | media | subscription, ai_marketplace, communication | ❌ Sprint 13 |
| `ai_marketplace` | settings_owner | ai_providers, ai_marketplace | subscription, dealer | ✅ |

`SETTINGS_CENTER_MANIFEST`:
```
version:                "0.1.0"
category_count:         20
active_category_count:  10
module_count:           8
policy_count:           8
visibility_level_count: 6
execution_deferred:     true
```

---

## Governance Policies

| Policy ID | Rule | Enforcement |
|-----------|------|-------------|
| SPOL-001 | Sensitive settings require dealer_owner minimum | strict |
| SPOL-002 | AI secrets require dealer_owner + pro_plus | strict |
| SPOL-003 | Enterprise settings require enterprise entitlement | strict |
| SPOL-004 | Unknown roles → no access to sensitive settings | strict |
| SPOL-005 | platform_admin settings hidden from dealer UI | strict |
| SPOL-006 | Destructive settings require confirmation dialog | strict |
| SPOL-007 | Experimental settings display advisory warning | advisory |
| SPOL-008 | Future settings render as disabled placeholders | advisory |

All policies are declared as metadata in Sprint 12F.  
Runtime enforcement is implemented in Sprint 13 via server actions and UI middleware.

---

## Dependency Direction

```
settings/ ─imports─→ plans/ (DealerPlan, AppFeature)
settings/ ─imports─→ staff/ (DealerStaffRole)

automation/ ─may import─→ settings/
communication/ ─may import─→ settings/
media/ ─may import─→ settings/
ai/ ─may import─→ settings/
subscription/ ─may import─→ settings/
```

`settings/` must NEVER import from automation, communication, media, ai, or subscription.  
This keeps the settings module a stable, circular-import-free foundation.

---

## Sprint 13 Wiring Plan

1. Runtime enforcement: `canViewSetting()` and `canModifySetting()` wired into server actions
2. Settings Router: `SettingsNavTree` consumed by Next.js 15 `app/settings/[category]/page.tsx`
3. Settings form renderer: consumes `SettingsRegistrationEntry` + `SettingsInputType` to generate inputs
4. Destructive setting confirmation dialog
5. Experimental setting warning badge
6. Future setting placeholder card
7. Organization module integration (multi-dealer scope)
8. Budget cap setting for AI providers

---

## Sprint 12F Constraints Respected

- No database migrations
- No schema changes
- No persistence
- No provider SDK imports
- No external API calls
- No UI implementation
- No runtime enforcement
- No `"use server"` directives
- No async functions
- `execution_deferred: true as const` on manifest
- `dealer_id` will always come from `getCurrentDealer()` in Sprint 13 wiring
