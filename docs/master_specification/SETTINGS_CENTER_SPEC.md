# Unified Settings Center — Sprint 12F / 12G / 12H Specification

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

---

## Sprint 12G — Settings Center UI Foundation

### New Files

| File | Description |
|------|-------------|
| `src/components/settings/SettingsCenterHub.tsx` | 20-category 7-group hub (client component) |
| `src/components/settings/SettingsCenterWrapper.tsx` | Hub ↔ detail state manager (client component) |

### Modified Files

| File | Change |
|------|--------|
| `src/components/settings/SettingsCategoryNav.tsx` | Exported `CategoryId` type; added optional `defaultSelected` and `onBack` props (backward-compatible) |
| `src/app/settings/page.tsx` | Swapped `SettingsCategoryNav` → `SettingsCenterWrapper` |

### UI Architecture

```
/settings (server component — fetches data)
  └── SettingsCenterWrapper (client, manages view state)
         ├── SettingsCenterHub (hub view — 20 categories, 7 groups)
         │     ├── Category cards → onOpenPanel(panelId) callback
         │     └── AI card → <Link href="/settings/ai">
         └── SettingsCategoryNav (detail view — existing panels)
               └── All 12 existing panels preserved unchanged
```

### Hub Group Structure

| Group | Categories (count) | Active | Future/Locked |
|-------|-------------------|--------|---------------|
| Core | dealer, organization, staff, roles_permissions, branding, notifications | 3 | 3 |
| AI Platform | ai_providers, ai_marketplace | 1 | 1 |
| Communication | communication | 1 | 0 |
| Automation | automation | 0 | 1 |
| Analytics | analytics | 0 | 1 |
| Business | subscription, media, ocr, pdf, customer_portal | 4 | 1 |
| Enterprise | gyeon_distribution, warehouse, crm, accounting | 0 | 4 (enterprise) |

### Card States

| State | Badge | Color | Description |
|-------|-------|-------|-------------|
| `configured` | 設定済み | green | Active + data present |
| `active` | 有効 | blue | Active, navigable |
| `not_configured` | 未設定 | amber | Active but not yet set up |
| `plan_required` | 🔒 Pro+ | purple | Higher plan needed |
| `coming_soon` | 準備中 | gray | Future implementation |
| `enterprise` | 🏢 Enterprise | gray | Enterprise entitlement required |

### Visibility Implementation

Uses `resolveVisibilityFromRole()` and `canViewSetting()` from `src/lib/settings`.

- `company_admin` / `platform_admin` categories hidden from all dealer users
- Enterprise group shown as locked (not hidden) — existence is not sensitive
- Unknown roles: `resolveVisibilityFromRole(null)` → `null` → only `readonly` visible (SPOL-004)
- Staff role: sees operational categories only (not billing, AI secrets)
- Manager role: sees all staff + operational categories
- Dealer owner: sees all except enterprise-locked

### Navigation Integration

Active categories that link to existing panels (via `SettingsCategoryNav.defaultSelected`):

| Hub Category | Panel ID | Content |
|-------------|----------|---------|
| dealer | `"store"` | Store info, trade, pricing, service |
| staff | `"store"` | Staff management section |
| branding | `"store"` | Company settings with logo/stamp |
| notifications | `"reminder"` | Maintenance reminder templates |
| communication | `"line"` | LINE integration |
| subscription | `"plan"` | Plan & billing |
| ocr | `"ocr"` | OCR settings |
| pdf | `"pdf"` | PDF & numbering |

AI providers → `<Link href="/settings/ai">` (dedicated page).

### Sprint 12G Constraints Respected

- No database migrations
- No schema changes
- No persistence
- No external APIs
- No provider SDK imports
- No fake subscription state (real `planInfo` from server)
- No unsafe client-only authorization for sensitive settings
- All data fetched server-side in `settings/page.tsx`

---

---

## Sprint 12H — Settings Category Pages Foundation

### New Files

| File | Description |
|------|-------------|
| `src/app/settings/[category]/page.tsx` | Dynamic server component for all 20 category routes |
| `src/components/settings/SettingsCategoryPageView.tsx` | Pure display component with all sub-components |

### Modified Files

| File | Change |
|------|--------|
| `src/components/settings/SettingsCenterHub.tsx` | 8 active category cards updated from `panel` → `route` actions |
| `docs/master_specification/SETTINGS_CENTER_SPEC.md` | Sprint 12H section added |

### Route Structure

```
/settings/[category]   — dynamic route (all 20 SettingsCategoryId slugs)
/settings/ai           — static route (takes precedence over [category] for slug "ai")
```

Next.js App Router static-route priority: `/settings/ai` is served by `app/settings/ai/page.tsx`, not the dynamic route.

### Dynamic Route Behavior

| Category Status | Page Renders |
|----------------|-------------|
| `ui_available: true` | Full category page: header, section list, items, configure CTA |
| `status: "future"` | Coming-soon state with target sprint + registered item preview |
| `status: "enterprise_only"` | Enterprise-locked state |
| `canAccess: false` | Generic access-denied (no category name or item names shown — SPOL-004) |

### Page Server Component (app/settings/[category]/page.tsx)

Server-side actions called:
1. `getCurrentStaff()` — resolves staff role → visibility level (dealer_id from getCurrentDealer() inside)
2. `getCanonicalDealerSettings()` — loaded only when `canAccess && category.ui_available`
3. `getRegistrationsForCategory(categoryId)` — pure static call from Sprint 12F registry

### SettingsCategoryPageView Sub-Components

All implemented as internal functions in `SettingsCategoryPageView.tsx`:

| Component | Purpose |
|-----------|---------|
| `SettingsAccessState` | Access-denied gate — reveals no category info (SPOL-004) |
| `SettingsEnterpriseState` | Enterprise-locked display |
| `SettingsFutureState` | Coming-soon with item preview |
| `SettingsCategoryHeader` | Icon, name, status badge, access level metadata card |
| `SettingsSectionList` | Items grouped by section prefix, each with ItemBadge |
| `ActiveCategoryContent` | Combines header + section list + configure CTA |

### Hub Navigation Updates (Phase E)

8 active category hub cards updated from `{ kind: "panel" }` to `{ kind: "route" }`:

| Category | Old Action | New Action |
|----------|-----------|-----------|
| dealer | panel: "store" | route: /settings/dealer |
| staff | panel: "store" | route: /settings/staff |
| branding | panel: "store" | route: /settings/branding |
| notifications | panel: "reminder" | route: /settings/notifications |
| communication | panel: "line" | route: /settings/communication |
| subscription | panel: "plan" | route: /settings/subscription |
| ocr | panel: "ocr" | route: /settings/ocr |
| pdf | panel: "pdf" | route: /settings/pdf |

`onOpenPanel` retained for footer backup/support panel actions in `SettingsCenterWrapper`.

### Visibility Behavior

- `getCurrentStaff()` resolves role server-side
- `resolveVisibilityFromRole(role)` maps to `SettingsVisibilityLevel`
- `canViewSetting(level, category.min_visibility)` gates the page
- `canAccess=false` → `SettingsAccessState` (no category info exposed — SPOL-004)
- Client-side visibility in hub cards is UX-only; server enforcement is Sprint 13+

### Category Page URLs

All 20 categories now have dedicated URLs:
```
/settings/dealer          /settings/subscription
/settings/organization    /settings/media
/settings/staff           /settings/ocr
/settings/roles_permissions /settings/pdf
/settings/ai_providers    /settings/customer_portal
/settings/ai_marketplace  /settings/gyeon_distribution
/settings/communication   /settings/warehouse
/settings/automation      /settings/crm
/settings/analytics       /settings/accounting
/settings/branding
/settings/notifications
```

### Sprint 12H Constraints Respected

- No migrations, no schema changes, no persistence
- No external APIs, no provider SDKs
- No fake settings functionality
- No broken links (all linked routes exist via dynamic handler)
- No unsafe authorization claims (visibility is UX gate; enforcement Sprint 13+)
- dealer_id from getCurrentDealer() inside server actions

---

## Sprint 12I — Settings Category Detail Panels

### Summary

Connects existing settings panels into dedicated `/settings/[category]` pages. Each active category now renders a real working panel instead of just metadata + CTA.

### Category-to-Panel Mapping

| Category slug | Panel rendered |
|--------------|----------------|
| `dealer` | `CompanySettingsForm` (company name, address, bank, etc.) |
| `staff` | `StaffManagement` (owner/manager only; gated by staffRole) |
| `branding` | `CompanySettingsForm` (logo, stamp, watermark, colour fields) |
| `notifications` | `ReminderContent` — reminder template read-only display |
| `communication` | `LineContent` — LINE status, message settings, rich menu |
| `subscription` | `PlanContent` + `SubscriptionStatusCard` slot |
| `ocr` | `OcrContent` — OCR policy read-only display |
| `pdf` | `PdfContent` — `DocumentSequenceSettings` + PDF extras |
| `ai_providers` | Link card → `/settings/ai` (dedicated AI settings route) |
| all others | Future-state notice within category frame |

### Modified Files

| File | Change |
|------|--------|
| `src/components/settings/SettingsCategoryNav.tsx` | Exported 5 panel functions: `OcrContent`, `LineContent`, `PdfContent`, `ReminderContent`, `PlanContent` |
| `src/components/settings/SettingsCategoryPageView.tsx` | Full update — new props (companySettings, staffList, sequences, planInfo, planSlot), `CategoryDetailPanel` switch, `DataLoadError`, `AiProvidersLink` |
| `src/app/settings/[category]/page.tsx` | Category-specific conditional data fetches; `SubscriptionStatusCard` rendered as `planSlot` for subscription |
| `src/components/settings/SettingsCenterWrapper.tsx` | Added `defaultPanel?: CategoryId` prop; starts in detail mode when provided |
| `src/app/settings/page.tsx` | Added `searchParams` support; reads `?panel=` param and passes as `defaultPanel` to wrapper |
| `docs/master_specification/SETTINGS_CENTER_SPEC.md` | Sprint 12I section added |

### Deep-Link Support (Phase E)

`/settings?panel=<panelId>` opens that panel directly on mount.

Valid values: `store`, `trade`, `pricing`, `service`, `ocr`, `line`, `pdf`, `reminder`, `plan`, `backup`, `support`, `ai`.

Invalid / unknown values are silently ignored (hub shown instead).

### Data Flow

```
/settings/[category]/page.tsx  (Server Component)
  ├── getCurrentStaff()           — always
  ├── getCanonicalDealerSettings()— when canAccess && ui_available
  ├── getCompanySettings()        — dealer, branding, staff only
  ├── getStaffList()              — staff only
  ├── getCurrentPlan()            — communication, subscription only
  ├── getDocumentSequences()      — pdf only
  └── <SubscriptionStatusCard />  — subscription only (planSlot)
       ↓
SettingsCategoryPageView.tsx  (Server Component, no "use client")
  └── CategoryDetailPanel (switch on category_id)
       ├── CompanySettingsForm     — "use client" ✓
       ├── StaffManagement         — "use client" ✓
       ├── OcrContent / LineContent / PdfContent / ReminderContent / PlanContent
       │    (exported from SettingsCategoryNav.tsx — "use client") ✓
       └── AiProvidersLink         — link to /settings/ai
```

### Sprint 12I Constraints Respected

- No migrations, no schema changes, no persistence changes
- No external APIs, no provider SDKs
- No fake settings functionality
- No broken links
- No unsafe authorization claims (staffRole gate is UX only; Sprint 13 server enforcement)
- dealer_id from getCurrentDealer() inside all server actions
- Reused existing components without modification of their logic

---

## Sprint 12J — Settings Save Actions Foundation

### Summary

Audited all existing server actions for settings writes. Created a declarative save action registry. Added UI-level role gating and save-state display to the category pages.

### New Files

| File | Description |
|------|-------------|
| `src/lib/settings/save-actions/save-action-types.ts` | SettingsSaveActionId, Status, Policy, SettingsSaveAction types |
| `src/lib/settings/save-actions/save-action-registry.ts` | SETTINGS_SAVE_ACTION_REGISTRY constant + query helpers |
| `src/lib/settings/save-actions/index.ts` | Barrel export for save-actions module |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/settings/index.ts` | Re-exports all save-actions types and functions |
| `src/components/settings/SettingsCategoryPageView.tsx` | Added SaveActionsPanel (Phase E), RoleRestrictedNotice, role gating in CategoryDetailPanel (Phase F) |

### Server Action Audit (Phase B)

| Action | File | dealer_id | Role Check | Sprint 12J Status |
|--------|------|-----------|------------|------------------|
| `saveCompanySettings` | `lib/company/save-company-settings.ts` | `getCurrentDealer()` ✓ | None ⚠ | writable_now — UI gate manager+, server Sprint 13 |
| `upsertDealerSettings` | `lib/line/update-line-settings.ts` | `getCurrentDealer()` ✓ | None ⚠ | external_integration_required — /line page |
| `saveLineRichMenuConfig` | `lib/line/save-line-rich-menu-config.ts` | `getCurrentDealer()` ✓ | `checkFeatureAccess(Pro+)` ✓ | writable_now |
| `updateDocumentSequence` | `lib/numbering/update-document-sequence.ts` | `getCurrentDealer()` ✓ | None ⚠ | writable_now — UI gate manager+, server Sprint 13 |
| `inviteStaff` | `lib/staff/invite-staff.ts` | `requireRole()` ✓ | `requireRole(owner,manager)` ✓ | writable_now |
| `updateStaffRole` | `lib/staff/update-staff-role.ts` | `requireRole()` ✓ | `requireRole(owner)` ✓ | writable_now |
| `disableStaff` / `enableStaff` | `lib/staff/disable-staff.ts` | `requireRole()` ✓ | `requireRole(owner,manager)` ✓ | writable_now |
| `saveAiSettings` | `lib/ai/save-ai-settings.ts` | `getCurrentDealer()` ✓ | `checkFeatureAccess(Pro+)` ✓ | writable_now — /settings/ai route |
| `setDealerRank` | `lib/dealer-settings/set-dealer-rank.ts` | `requireAdmin()` ✓ | `requireAdmin()` ✓ | requires_admin — /admin only |

### Save Action Registry (Phase C)

9 actions registered in `SETTINGS_SAVE_ACTION_REGISTRY`:

```
company_info          → writable_now   (dealer, branding)
line_connection       → external_integration_required (communication)
line_rich_menu        → writable_now   (communication) — Pro+ gated
document_sequences    → writable_now   (pdf)
staff_invite          → writable_now   (staff) — role hierarchy enforced
staff_role_update     → writable_now   (staff) — owner-only enforced
staff_disable         → writable_now   (staff) — role hierarchy enforced
ai_gateway_settings   → writable_now   (ai_providers) — Pro+, /settings/ai
dealer_rank           → requires_admin (dealer) — /admin only
```

### UI Role Gating (Phase F)

Categories with UI-level role gates (where server action lacks `requireRole()`):

| Category | Required Role | Server Enforcement |
|----------|--------------|-------------------|
| `dealer` | manager or owner | Sprint 13 |
| `branding` | manager or owner | Sprint 13 |
| `pdf` | manager or owner | Sprint 13 |
| `staff` | manager or owner (UI only — server actions enforce correctly) | ✓ Now |

All other active categories:
- `notifications` — read-only display, no write action
- `communication` — `LineContent` is read-only; `LineRichMenuSettings` enforces Pro+ server-side
- `subscription` — read-only plan display
- `ocr` — read-only policy display
- `ai_providers` — links to `/settings/ai` which has its own Pro+ gate

### Save State Display (Phase E)

`SaveActionsPanel` component in `SettingsCategoryPageView.tsx`:
- Shows save action registry entries for the current category
- Displays status badge per action (保存可能 / 読み取り専用 / 外部設定必要 / etc.)
- Flags actions without server role check with "⚠ サーバー権限チェック: Sprint 13 実装予定"

### Server-Side Role Enforcement Gap (Documented)

Three server actions (`saveCompanySettings`, `upsertDealerSettings`, `updateDocumentSequence`) only call `getCurrentDealer()` — they verify dealer association but not staff role. A `staff` or `readonly` user who bypasses the UI could POST these actions.

**Mitigation in Sprint 12J:** UI-level role gating hides or disables the editable form for insufficient roles.
**Full fix:** Sprint 13 — add `requireRole(["owner","manager"])` to these three actions.

### Sprint 12J Constraints Respected

- No migrations, no schema changes, no new persistence tables
- No external APIs, no provider SDKs
- No fake save behavior — registry is pure metadata
- No unsafe client-only authorization for writes — role gaps documented, Sprint 13 tracked
- dealer_id from getCurrentDealer() in all connected server actions
- Reused existing server actions only

---

## Sprint 12K — Settings Server-Side Permission Enforcement

### Summary

Closed all dealer-facing settings write permission gaps identified in Sprint 12J. Three server actions that previously relied on `getCurrentDealer()` only (no role check) now enforce `requireRole(["owner","manager"])` server-side. No new server actions, no new persistence.

### Hardened Actions (Phase C)

All three changes follow the same pattern: replace `getCurrentDealer()` with `requireRole(["owner","manager"])`, wrap in try/catch, propagate the role error message to the caller.

| File | Function | Before | After |
|------|----------|--------|-------|
| `src/lib/company/save-company-settings.ts` | `saveCompanySettings` | `getCurrentDealer()` only | `requireRole(["owner","manager"])` |
| `src/lib/line/update-line-settings.ts` | `upsertDealerSettings` | `getCurrentDealer()` only | `requireRole(["owner","manager"])` |
| `src/lib/numbering/update-document-sequence.ts` | `updateDocumentSequence` | `getCurrentDealer()` only | `requireRole(["owner","manager"])` |

### Permission Helper Reused (Phase B)

`requireRole(allowedRoles)` at `src/lib/staff/require-role.ts`:
- Calls `getCurrentStaff()` + `getCurrentDealer()` in parallel
- Throws `"この操作を行う権限がありません"` if role not in `allowedRoles`
- Throws `"認証が必要です"` if no dealer association
- Returns `{ role, dealerId }` — dealer_id never comes from client
- Dev-mode fallback: no staff record → treats caller as "owner" (documented)

### Complete Settings Write Permission Table (Post Sprint 12K)

| Action | Required Role | Enforcement | Has Server Check |
|--------|--------------|-------------|-----------------|
| `saveCompanySettings` | owner, manager | `requireRole(["owner","manager"])` ✓ | Yes |
| `upsertDealerSettings` | owner, manager | `requireRole(["owner","manager"])` ✓ | Yes |
| `updateDocumentSequence` | owner, manager | `requireRole(["owner","manager"])` ✓ | Yes |
| `inviteStaff` | owner, manager | `requireRole(["owner","manager"])` ✓ | Yes |
| `updateStaffRole` | owner | `requireRole(["owner"])` ✓ | Yes |
| `disableStaff`/`enableStaff` | owner, manager | `requireRole(["owner","manager"])` ✓ | Yes |
| `saveLineRichMenuConfig` | (Pro+ plan) | `checkFeatureAccess("line_rich_menu")` ✓ | Yes |
| `saveAiSettings` | (Pro+ plan) | `checkFeatureAccess("ai_gateway")` + encryption ✓ | Yes |
| `setDealerRank` | platform admin | `requireAdmin()` ✓ | Yes |

**All dealer-facing write paths now have server-side enforcement.** No settings writes accept dealer_id from client input.

### Registry Updates (Phase D)

Three registry entries updated — `has_server_role_check: false` → `true`:
- `company_info` (covers `dealer`, `branding` categories)
- `line_connection` (covers `communication` category)
- `document_sequences` (covers `pdf` category)

The "⚠ サーバー権限チェック: Sprint 13 実装予定" warning badge in `SaveActionsPanel` no longer appears for these three actions.

### Static Validation (Phase E — No Test Framework)

No test framework exists in the project. Static validation approach:

1. **TypeScript compiler:** `npx tsc --noEmit` — clean. All three hardened functions have correct type signatures. `requireRole` return type `{ role, dealerId }` correctly replaces `getCurrentDealer()` return shape.

2. **Role rejection path:** `requireRole` throws when role not in `allowedRoles`. The try/catch in each action converts the thrown error into a typed return: `{ error: "この操作を行う権限がありません" }` or `{ success: false, error: "..." }`. Callers (client components) surface this error to the user.

3. **dealer_id source verification:** All three updated actions derive `dealerId` from `requireRole → getCurrentDealer()` — the `dealer_members` table query filtered by `auth.uid()`. No client-provided `dealer_id` is accepted anywhere in the write path.

4. **Dev mode behavior:** `requireRole` fallback (`staff?.role ?? "owner"`) means dev builds without the `dealer_staff` table still function. Production builds have the table and enforce roles correctly.

Manual verification steps for each hardened action:
- Sign in as staff role → attempt form submit → expect "この操作を行う権限がありません" error
- Sign in as readonly role → attempt form submit → expect same error
- Sign in as manager → attempt form submit → expect success
- Sign in as owner → attempt form submit → expect success

### Sprint 12K Constraints Respected

- No migrations, no schema changes, no new persistence tables
- No external APIs, no provider SDKs
- No duplicate permission system — reused existing `requireRole` helper
- No unsafe client-only authorization — all three gaps now server-enforced
- dealer_id from `requireRole → getCurrentDealer()` in all hardened actions

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
