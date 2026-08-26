# GDA Window Film Settings C2 Contract and Migration Specification

Status: `C2_DESIGN_CANDIDATE_OWNER_ACCEPTANCE_REQUIRED`

Baseline commit: `d3355f6d11000e173fd11e06d478ee11595cb264`

UI source artifact:

- `/Users/atsushinishikawa/Desktop/GYEON APP/gda_window_film_settings_ui.zip`
- SHA-256: `72512f318bb8a189d517c757f6329eed15042137febb740f0deab707894ac59e`

## 1. Objective

Implement the supplied window-film settings UI without inventing a second pricing authority and without silently dropping settings that the UI appears to save.

The completed surface must manage:

1. dealer-owned film types;
2. the seven canonical installation areas;
3. optional dealer-defined packages such as a full-window set;
4. dealer-defined ancillary options;
5. automatic estimate price and duration resolution.

The supplied visual language, card structure, spacing, responsive behavior, logo, sidebar, colors, typography, and icon treatment are preserved. Functional controls are bound to the contract defined here.

## 2. Protected and frozen scope

- Do not open, modify, copy, stage, or otherwise inspect the contents of `src/components/estimates/wizard/screens/ScreensPreview.tsx`.
- Do not change coating V3.4, PPF R1, PPF + coating reduction, coupons, certificates, window film availability, dealer rank rules, or unrelated settings.
- Do not hard-delete existing catalog rows or legacy window-film settings.
- Do not seed the UI sample prices, coefficients, IR/UV values, or durations into production data.
- Do not stage, commit, push, mark a PR Ready, merge, deploy, or apply a migration without a separately authorized gate.

## 3. Current-state findings

Three contracts currently disagree:

1. The live wizard uses seven canonical `window_area` codes.
2. `service_price_settings.window_film` uses five retired pricing IDs.
3. The live wizard saves one manually entered total in `windowFilm.unitPriceInput`.

The existing dealer-owned `film_type` catalog is reusable for identity, labels, active state, ordering, presentation, and installation coefficient. It is not sufficient for seven-area prices, durations, packages, or options.

## 4. Canonical identities

The following seven physical installation areas are fixed and global:

| Code | Japanese label |
|---|---|
| `front-windshield` | フロントガラス |
| `front-door-glass` | フロントドアガラス |
| `rear-door-glass` | リアドアガラス |
| `triangular-window` | 三角窓 |
| `quarter-glass` | クォーターガラス |
| `rear-glass` | リアガラス（リアハッチ） |
| `sunroof` | サンルーフ |

These identities and labels are not dealer-editable. A dealer may switch an area between `offering` and `not_offered`; the row is never deleted.

Dealer-defined packages and options use immutable server-generated codes. They are archived, never hard-deleted.

## 5. Film-type authority

`wizard_catalog_items` rows with `kind='film_type'`, `owner_scope='dealer'`, and the authenticated dealer ID remain the only film-type authority.

Each film type owns:

- immutable item ID and code;
- Japanese display name;
- display order;
- active/archive state;
- installation coefficient in basis points (`10000 = x1.00`);
- optional presentation values.

The presentation contract is extended without deleting existing fields:

```ts
interface WindowFilmPresentationV1 {
  brand?: string;
  vlt?: string;
  heatRejection?: string;
  color?: string;
  irCutPercent?: number; // integer 0..100
  uvCutPercent?: number; // integer 0..100
}
```

The new page edits `irCutPercent` and `uvCutPercent`. Hidden existing fields (`brand`, `vlt`, `heatRejection`, `color`) must be preserved on save. A save must never replace the complete presentation object with only the visible fields.

Film coefficients are integers from `1000` through `50000` basis points (`x0.10` through `x5.00`). Blank, zero, negative, fractional-basis-point, or out-of-range values fail closed.

Active film names must be nonblank and unique after trimming and case normalization.

## 6. Window-film price contract V1

The authoritative V1 document is stored at:

`dealer_settings.service_price_settings.window_film_v1`

It does not overwrite the legacy `window_film` object during migration.

```ts
type MoneyOrUnset = number | null;
type MinutesOrUnset = number | null;

interface WindowFilmAreaSettingV1 {
  priceYen: MoneyOrUnset;
  durationMinutes: MinutesOrUnset;
  isActive: boolean;
}

interface WindowFilmPackageV1 {
  code: string;
  name: string;
  priceYen: MoneyOrUnset;
  durationMinutes: MinutesOrUnset;
  isActive: boolean;
  displayOrder: number;
}

interface WindowFilmOptionV1 {
  code: string;
  name: string;
  priceYen: MoneyOrUnset;
  durationMinutes: MinutesOrUnset;
  isActive: boolean;
  displayOrder: number;
}

interface WindowFilmSettingsV1 {
  contractVersion: "1.0";
  revision: number;
  areas: Record<CanonicalWindowAreaCode, WindowFilmAreaSettingV1>;
  packages: WindowFilmPackageV1[];
  options: WindowFilmOptionV1[];
}
```

Validation rules:

- `areas` has exactly the seven canonical keys.
- Money and duration values are either `null` or safe non-negative integers.
- `null` means unset. `0` means an intentional free price or zero-minute duration. They are never converted into one another.
- An active area, package, or option must have both price and duration configured.
- Codes match `^[a-z0-9][a-z0-9_-]{0,63}$` and are unique inside their collection.
- Names are trimmed, nonblank, and unique among active entries after normalization.
- Display order is a non-negative integer.
- Unknown keys, missing keys, legacy shapes, and invalid numbers fail closed.

## 7. Exact pricing and duration calculation

The user chooses either:

- one or more physical areas; or
- exactly one dealer-defined package.

A package and physical areas are mutually exclusive. Selecting one clears the other selection class.

For physical areas:

```text
area line price = round(area base price x film coefficient basis points / 10000)
film subtotal   = sum(each rounded area line price)
duration        = sum(area duration minutes)
```

For a package:

```text
package price   = round(package base price x film coefficient basis points / 10000)
duration        = package duration minutes
```

For options:

```text
option subtotal = sum(option price x quantity)
option duration = sum(option duration x quantity)
```

The film coefficient is not applied to options or duration.

```text
suggested total price = film subtotal + option subtotal
suggested total time  = film duration + option duration
```

The suggested total is copied into the existing `windowFilm.unitPriceInput` field so the current estimate-save contract remains compatible. The operator may manually adjust that final total. The estimate snapshot must preserve the selected area/package codes, option codes and quantities, base values, coefficient, resolved suggested price, final entered price, and contract version.

## 8. Atomic save boundary

Create one RPC:

`save_window_film_v1_settings(uuid, jsonb, jsonb, integer)`

Inputs:

1. authenticated dealer ID injected server-side;
2. strict `WindowFilmSettingsV1` payload;
3. strict film-type batch payload;
4. expected window-film revision.

Required behavior:

- authenticated active membership must resolve to exactly one dealer;
- `dealer_staff` is authoritative when a row exists;
- only active `owner` or `manager` may save;
- lock the dealer settings row before read-modify-write;
- compare the expected subdocument revision and reject stale saves;
- validate every film item and settings entry before mutation;
- upsert only dealer-owned `film_type` rows belonging to the same dealer;
- merge IR/UV into existing presentation without removing hidden presentation keys;
- archive explicitly removed dealer-owned film types; never hard-delete;
- replace only `service_price_settings.window_film_v1`, preserving every sibling setting;
- increment the V1 revision exactly once;
- return the persisted document and stable IDs/codes;
- any failure rolls back film rows and price settings together.

The RPC is the authoritative validator. Client and server-action validation improve messages but cannot weaken SQL validation.

## 9. Legacy adoption, not blind migration

No migration writes legacy prices into V1 automatically. When V1 is absent, the page may construct an unsaved review draft using only these unambiguous mappings:

| Legacy key | V1 destination |
|---|---|
| `wf-front-side` | `areas.front-door-glass.priceYen` |
| `wf-rear-side` | `areas.rear-door-glass.priceYen` |
| `wf-rear` | `areas.rear-glass.priceYen` |
| `wf-quarter` | `areas.quarter-glass.priceYen` |
| `wf-all` | draft package named `全窓一括` |

No legacy value exists for `front-windshield`, `triangular-window`, or `sunroof`; they remain unset.

Legacy data remains untouched after the V1 save. The authoritative resolver uses V1 only when the complete V1 contract validates. It never combines a partial V1 document with legacy or hardcoded values.

## 10. Sample-data behavior

The values supplied in the HTML are presentation samples only.

- They may appear as an unsaved client draft when no V1 or usable legacy value exists.
- They are not emitted by a migration, default object, seed, server loader, or pricing resolver.
- The warning remains visible until an owner or manager successfully saves V1.
- After a successful save, the sample warning disappears.
- Resetting or archiving settings does not silently recreate sample values.

## 11. UI binding rules

Preserve the supplied design system and responsive layout.

Functional binding changes required by the canonical contract:

- Fixed physical-area rows display canonical labels; their name fields are not editable.
- The delete control on fixed rows becomes a `提供中 / 提供しない` state control in the same operation column.
- `施工部位を追加` adds a dealer-defined package, not a new physical area.
- Dealer-defined packages and options may be archived.
- Film types may be added and archived.
- The bottom `保存する` action saves the entire surface atomically.
- Save actions remain static, not sticky.
- Loading must use a stable skeleton or page-level loading state; the old settings UI must never flash underneath.
- Desktop, tablet, 390 px, and 375 px must have zero horizontal overflow.
- Minimum touch target is 44 px.

The old `/settings/estimate-wizard#section-film` editor must not remain as a second writer. Its window-film card/anchor routes to `/settings/window-film`; existing data is read from the same film catalog.

## 12. Runtime activation and failure behavior

The window-film category is usable only when all are true:

1. the dealer explicitly offers `window_film`;
2. at least one active film type is valid;
3. at least one active area or package has complete price and duration data;
4. the V1 contract validates.

If V1 is absent or malformed, the settings page remains available for repair, but the live wizard fails closed for automatic pricing. It may continue the current manual-price compatibility path only while an explicit transition flag is active. There is no silent fallback to sample or legacy prices.

## 13. C2 implementation gates

Implementation must remain separated into the following owner-controlled gates:

1. `C2_DESIGN_ACCEPTANCE` — accept this specification.
2. `C3_SOURCE_IMPLEMENTATION` — TypeScript contracts, resolver, page, actions, and SQL migration; no database apply.
3. `C4_EXECUTABLE_VERIFICATION` — focused unit/component tests, typecheck, `git diff --check`, responsive browser smoke, and disposable database tests.
4. `C5_STAGE_AND_LOCAL_COMMIT` — exact allowlist only, separately authorized.
5. `C6_PUSH_AND_PR` — separately authorized.
6. `C7_READY_AND_MERGE` — separately authorized.
7. `C8_PRODUCTION_MIGRATION_AND_DEPLOY` — separately authorized and verified.

## 14. Minimum acceptance evidence

- Exact seven-area shape validation.
- `null` versus zero tests.
- Coefficient boundary and rounding tests.
- Package/area mutual-exclusion tests.
- Option price/time tests.
- IR/UV validation and hidden-presentation preservation tests.
- Atomic rollback when one film row or one setting is invalid.
- Stale-revision rejection.
- Cross-tenant and non-owner/manager rejection.
- Sibling JSON preservation under concurrent saves.
- Legacy draft mapping tests, including `wf-all` as a package.
- No automatic sample persistence.
- Automatic suggested total, manual final override, and estimate snapshot provenance tests.
- Old editor does not remain a second writer.
- Protected-file mode/blob/state evidence only.
- Desktop/tablet/390 px/375 px visual and overflow evidence.

## 15. C2 verdict

`READY_FOR_OWNER_DESIGN_ACCEPTANCE`

No source implementation, migration apply, staging, commit, push, PR mutation, merge, or deployment is authorized by this document.
