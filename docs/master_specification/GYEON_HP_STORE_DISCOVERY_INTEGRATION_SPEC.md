# GYEON HP Store Discovery / SEO・MEO Integration Specification

| Field | Value |
|---|---|
| Document status | RATIFIED DESIGN — GHP-2A source/test seed independently accepted; full integration deferred until GDA-7 closes |
| Version | 1.2 |
| Decision date | 2026-08-10 |
| Early seed activation | 2026-08-16 — explicit product-owner authorization |
| Product owner | Office AZ |
| Source system | GYEON Detailer Agent / DealerOS |
| Destination | Future renewed GYEON website on a different domain |
| Current evidence | Full integration: E0 design only; bounded GHP-2A seed: E2 source/test acceptance at PR #12 head `9b8bc1eb2cb59e879f5ebeb5b91e85ba4f522662` |
| Governing plan | `GYEON_DA_COMPLETION_PLAN.md` |

## 0. Authority and timing

This document records a fixed product-owner decision. After GYEON Detailer Agent reaches GDA-7 production completion, the GYEON website will be renewed and connected to an approved public projection of DealerOS store data.

On 2026-08-16 the product owner explicitly activated one narrow pre-GDA-7 exception: **GHP-2A**, the pure public-profile projection seed isolated in Draft PR #12. The authorized two-path repair and focused verification are now independently accepted at head `9b8bc1eb2cb59e879f5ebeb5b91e85ba4f522662`, tree `19fb3cf2f08778abaa87313c8908d4e32cb815c4`; the final PASS evidence is [PR #12 comment 5304962007](https://github.com/nisikawa-officeAZ/GYEON/pull/12#issuecomment-5304962007). PR #12 remains Draft and unmerged. This acceptance does not activate store-settings UI, schema, RLS, Storage, media, API, website, AI, SEO/MEO, GBP, deployment, publication, Ready conversion, or merge work.

The current GYEON DA completion path remains first priority. Full integration still starts only after GDA-7 is closed. GHP-2A is a bounded contract-safety seed, not an authorization to advance the wider GHP sequence.

Terminology in this specification is **SEO / MEO**. The earlier expression `MSO` is treated as a non-canonical spelling unless the product owner later defines it as a separate capability.

## 1. Product purpose

The renewed GYEON website must help customers find the right nearby GYEON business and understand exactly what it can provide.

Published distinctions must include, where approved:

- GYEON product retailer;
- authorized product dealer;
- GYEON Certified Detailer;
- installation-capable store;
- maintenance-capable store;
- supported GYEON product families and services;
- location, hours, service area, contact methods, facilities, and store photos.

The business outcome is increased qualified store visits, inquiries, service reservations, and product sales. It is not permission to publish unsupported claims, invent qualifications, or create search-spam pages.

## 2. Fixed decisions

1. **DealerOS is the factual source of truth.** Store-entered facts and operator-approved qualifications originate in DealerOS.
2. **The GYEON website is the public rendering authority.** Canonical public URLs, HTML, sitemap, and rendered structured data live on the GYEON domain.
3. **No cross-domain database sharing.** The website never reads DealerOS tables or Supabase Storage with a service-role key.
4. **Only an approved public projection crosses the API boundary.** Private settings, customer data, staff-private data, finance, bank, internal notes, and operational records never enter the feed.
5. **Several store photos are supported.** Store settings support one logo, one cover image, and an ordered gallery. The initial default limit is 12 gallery images and remains server-configurable.
6. **Qualifications are not self-certified.** A store may request capabilities, but Office AZ/GYEON operator approval owns published retailer/dealer/certified/installation classifications.
7. **Nightly synchronization is mandatory.** A scheduled run executes every day in `Asia/Tokyo`, with `03:00` as the default configurable start time.
8. **Nightly execution does not mean nightly content churn.** The pipeline evaluates every night and publishes only a material, validated change.
9. **SEO/MEO maintenance is automatic within policy.** Deterministic facts and low-risk generated copy may auto-publish after all gates pass. High-risk identity, qualification, account, and legal changes remain approval-gated.
10. **Every published version is auditable and reversible.** The previous good snapshot remains available for rollback.
11. **Google Business Profile is a destination, not a source of DealerOS authority.** Google-originated changes are reviewed as conflicts and never silently overwrite DealerOS.
12. **Normal store pages use sitemap/Search Console discovery.** Google Indexing API must not be used for store pages because its supported page types are limited.

## 3. Authority model

| Data class | Authority | Store can edit | Operator approval | Automatic publication |
|---|---|---:|---:|---:|
| Public store name, phone, address, hours | DealerOS store profile | Yes | On first publication and protected changes | Yes after accepted policy |
| Introduction, facilities, service area, languages | DealerOS store profile | Yes | Policy/quality gate | Yes after validation |
| Logo, cover, gallery order and captions | DealerOS store media | Yes | Rights and content gate | Yes after validation |
| GYEON retailer/dealer/detailer/installer status | Office AZ/GYEON operator | Request only | Always | Only approved values |
| Supported official products/services | Office AZ/GYEON operator catalogue | Request only | Always | Only approved values |
| Coordinates and normalized NAP | Publication projection | Suggest correction | Exception review | Deterministic |
| SEO title, description, page summary, image alt text | SEO publication engine | Preview/feedback | Policy-defined | Low-risk only |
| Canonical URL and route slug | GYEON website | No | Operator on collision/change | Yes after validation |
| GBP account connection and update permission | Store owner + Google | Connect/revoke | Express consent | Only within consented field mask |
| Review replies, Q&A, ownership, verification | Store owner | Request | Always | Never unattended |

`NAP` means name, address, and phone number. The same normalized facts must be used by the GYEON website, JSON-LD, and any approved GBP update.

## 4. Store settings requirements

### 4.1 Public profile section

The existing store settings area gains a clearly separated **GYEON website publication** section. Internal store settings are never implicitly public.

Required public-profile fields:

- `public_display_name`;
- `public_short_description`;
- `public_full_description`;
- postal code and structured address;
- primary public phone;
- optional public email and inquiry URL;
- latitude/longitude with geocoding verification state;
- regular business hours;
- exceptional/holiday hours;
- service area and supported prefectures/cities;
- supported languages;
- parking, accessibility, payment, appointment, and facility attributes;
- official store links, LINE link where permitted, and reservation link;
- publication consent, consent actor, and consent timestamp;
- last preview, last approval, last publication, and last sync state.

The UI must show a GYEON website preview before initial publication.

### 4.2 Capability classification

Logical capability IDs are stable and server-owned:

- `gyeon_product_retailer`;
- `gyeon_authorized_dealer`;
- `gyeon_certified_detailer`;
- `gyeon_installation_store`;
- `gyeon_maintenance_store`.

Each capability contains:

- status: `requested | approved | rejected | suspended | expired`;
- approving authority;
- valid-from / valid-through timestamps where applicable;
- approved product and service taxonomy IDs;
- reason and audit reference;
- public label version.

Expired, rejected, or suspended capabilities are never published. A store description generated by AI cannot elevate or imply a capability that is not `approved` and currently valid.

### 4.3 Publication lifecycle

`draft -> submitted -> approved -> published -> suspended | withdrawn`

- A first publication requires store-owner consent and operator approval.
- Self-managed factual edits may enter the nightly pipeline under the accepted auto-publication policy.
- Operator-owned qualification changes always require operator approval.
- Withdrawal or qualification suspension creates an urgent tombstone and may bypass the nightly wait through a separately authorized immediate-publication action.

## 5. Store image and media contract

### 5.1 Image roles

- `logo` — one active image;
- `cover` — one active image;
- `exterior`;
- `interior`;
- `staff`;
- `work_bay`;
- `facility`;
- `gallery`.

Each image record includes:

- opaque media ID and public profile ID;
- role and sort order;
- original object reference;
- publication-derivative references;
- width, height, MIME type, byte size, and SHA-256;
- focal point and crop policy;
- Japanese alt text and optional caption;
- rights owner and rights attestation timestamp;
- visibility and moderation state;
- created/updated/published/revoked timestamps;
- version and superseded media ID.

### 5.2 Security and delivery

- Originals remain private by default and are editable only through authenticated DealerOS server paths.
- Upload authorization is dealer-scoped and enforced with RLS; `dealer_id` is never accepted from form data.
- The Storage service-role/secret key is never sent to DealerOS browsers or the GYEON website.
- Published derivatives are produced only after rights, content, and publication approval.
- EXIF/GPS and unnecessary metadata are stripped from public derivatives.
- Common responsive variants are generated in bounded sizes and served through a CDN-compatible stable URL.
- Replacing an image creates a new immutable version. Cache busting uses the version/hash, not mutable query guessing.
- A revoked image is removed from future snapshots and produces a tombstone. The website must purge it from its active page and CDN invalidation queue.

Customer/work-order media is **not** store-profile media. If a store wants to reuse job media, the existing `marketing_approved` and customer-consent gates remain mandatory.

## 6. Logical data model

Physical table names and migrations require a later diagnosis and migration phase. The following logical entities are binding:

| Entity | Purpose |
|---|---|
| `DealerPublicProfile` | Approved public-safe store facts and lifecycle |
| `DealerPublicCapability` | Operator-owned GYEON qualifications and taxonomy bindings |
| `DealerPublicMedia` | Ordered store media and immutable public derivatives |
| `PublicContentVersion` | Deterministic and AI-generated publication content with provenance |
| `WebsitePublicationSnapshot` | Versioned complete/delta package sent to the GYEON website |
| `WebsitePublicationTombstone` | Removal, suspension, slug change, or asset revocation |
| `WebsiteSyncRun` | Nightly execution, counts, hashes, validation and publish outcome |
| `ExternalProfileConnection` | Encrypted reference to GBP/Search Console authorization and consent |
| `ExternalProfileSyncRun` | Field-mask updates, Google conflicts, and rollback/audit state |

All entities are dealer-isolated. Public projection IDs are opaque and must not reveal internal sequential IDs.

## 7. Cross-domain API contract

### 7.1 Boundary

The API is a server-to-server integration route reserved for the renewed GYEON website. It is not a generic public DealerOS REST API.

Provisional route family:

`GET /api/integrations/gyeon-website/v1/store-directory`

The final route name requires the later API implementation phase, but these semantics are binding:

- versioned schema: `gyeon-store-directory.v1`;
- full snapshot and cursor-based delta support;
- deterministic ordering;
- pagination with bounded page size;
- `ETag` / `If-None-Match` support;
- immutable `snapshot_id`;
- `generated_at`, `source_cursor`, and `content_hash`;
- active stores, product/service relations, media manifest, content versions, and tombstones;
- no private/internal fields;
- idempotent replay of the same snapshot;
- stable error codes and retry guidance.

### 7.2 Authentication

- TLS is mandatory.
- Website-to-DealerOS authentication uses a rotated server credential with narrow audience and read-only scope.
- Preferred contract: short-lived signed JWT or HMAC request signature with timestamp, nonce, key ID, and body/path hash.
- Replay windows are bounded; used nonces are rejected.
- Credentials are stored server-side in each platform's secret manager.
- Origin/CORS allowlists are defense in depth and never the primary authentication mechanism.
- Rate limiting, audit logging, secret rotation, and emergency revocation are mandatory.
- A Supabase service-role key is explicitly prohibited on the GYEON website.

### 7.3 Snapshot envelope

```json
{
  "schema_version": "gyeon-store-directory.v1",
  "snapshot_id": "uuid",
  "generated_at": "RFC3339",
  "source_cursor": "opaque",
  "content_hash": "sha256",
  "mode": "full_or_delta",
  "stores": [],
  "tombstones": [],
  "next_cursor": null
}
```

Every store item contains:

- opaque `public_store_id`;
- canonical factual profile;
- normalized NAP and geo;
- approved capability/product/service IDs;
- business and exceptional hours;
- ordered image variants and alt text;
- deterministic structured-data model;
- approved SEO content version;
- source version, published version, and item hash.

## 8. Nightly synchronization and atomic publication

Default schedule: every day at `03:00 Asia/Tokyo`.

```text
DealerOS approved facts
  -> build public projection
  -> validate qualifications/consent/media rights
  -> compare with last published hash
  -> generate deterministic SEO/MEO facts
  -> optionally generate bounded AI copy
  -> run policy/duplication/factual consistency gates
  -> emit signed versioned snapshot
  -> GYEON HP imports to staging
  -> validate counts, hashes, links, JSON-LD and images
  -> atomic promotion to current
  -> regenerate changed pages and sitemap
  -> record analytics and audit outcome
```

Rules:

1. A failed DealerOS export leaves the website's last good snapshot active.
2. A partially imported snapshot is never visible.
3. The website promotes only a complete, hash-verified snapshot.
4. Retries are bounded and idempotent with exponential backoff and jitter.
5. Repeated failure raises an operator alert; it does not publish partial data.
6. A store or asset removal uses a tombstone, not disappearance by omission alone.
7. No material change produces `304/not_modified` semantics and no page rewrite.
8. Rollback switches the website to the previous accepted snapshot and records the actor/reason.

## 9. GYEON website rendering and SEO contract

### 9.1 Page architecture

- One stable, indexable detail page per approved store.
- One store-directory page with region, capability, product, and service filters.
- Product and service introduction pages link only to stores with current approved capability mappings.
- Pages are server-rendered or statically generated; crawler-critical facts must not depend on client-only JavaScript.
- DealerOS pages containing the same profile must be authenticated or `noindex`; the GYEON website owns the canonical public URL.
- Slug changes create a permanent redirect and a tombstone mapping.
- Suspended/withdrawn stores are removed from active listings and handled with an explicit redirect, `410`, or `noindex` policy according to reason.

### 9.2 Structured data

Each store page emits validated JSON-LD derived from deterministic facts, not free-form AI output:

- the most specific valid `LocalBusiness` subtype;
- `Organization` relationship where appropriate;
- structured postal address;
- geo coordinates;
- public telephone and canonical store URL;
- regular and exceptional opening hours;
- approved images in supported aspect ratios;
- approved products/services without fabricated offers, prices, ratings, or availability.

The visible page and JSON-LD must describe the same facts. Rich Results Test and schema validation are release gates.

### 9.3 Search discovery

- Changed canonical pages are placed in XML sitemap(s) with truthful `lastmod`.
- The sitemap is registered and monitored through Search Console.
- Image sitemap extensions may be used for approved store images.
- Google Indexing API is prohibited for ordinary store/product pages; sitemap and normal crawling are used.
- Search Console data is used for diagnostics and optimization feedback, not as permission to manufacture keyword pages.

## 10. MEO / Google Business Profile contract

MEO includes NAP consistency, categories/attributes, hours, service areas, photos, and performance analysis. It does not mean uncontrolled automatic edits.

### 10.1 Connection requirements

- The store owner must authorize the GBP connection and the specific permitted automation scope.
- Automated GBP updates remain disabled until the Office AZ/GYEON API-project and end-client operating model is confirmed to comply with current Google Business Profile API policy. DealerOS must not provide indirect or shared-project automation that Google prohibits.
- If Google approval or the permitted account model is unavailable, DealerOS generates a validated change proposal for the store owner to apply manually. The GYEON website nightly publication remains independent and may continue.
- OAuth tokens and refresh tokens are encrypted server-side and referenced indirectly.
- Each connection records Google account/location resource identifiers, consent scope, consent version, actor, timestamps, and revocation state.
- The product must provide a simple disconnect path and stop access promptly when revoked.
- Google-provided content caching follows current GBP API policy and is not retained beyond the current 30-calendar-day limit or any shorter later limit.

### 10.2 Update policy

Automatic updates are limited to pre-consented, validated field masks such as approved hours, phone, website URL, and attributes when the account/API policy permits them.

The following always require specific human approval:

- business name or primary category change;
- ownership, manager, or verification actions;
- location creation, deletion, merge, or transfer;
- review replies or Q&A responses;
- Google-suggested conflict resolution;
- any claim about certification, rank, awards, results, or exclusivity;
- destructive or irreversible action.

Google-originated differences are stored as a conflict proposal. They never overwrite DealerOS automatically, and the system must not automatically revert changes made by Google.

## 11. AI SEO/MEO maintenance contract

### 11.1 Allowed automation

The nightly AI maintenance process may generate or revise:

- store-page title and meta description;
- short and full store introduction;
- product/service explanatory copy based on approved taxonomy;
- image alt text from approved image and store facts;
- concise customer questions and answers supported by store facts;
- internal linking suggestions;
- search-intent and performance recommendations.

AI output creates a separate immutable `PublicContentVersion`. It never overwrites the store-authored source description or operator-owned facts. A store may lock approved wording from automatic replacement.

Structured identity, NAP, capability state, hours, prices, ratings, and qualification claims are deterministic inputs and cannot be invented by AI.

### 11.2 Grounding and provenance

Every generated field records:

- source profile version and exact approved fact IDs;
- model/provider and prompt-template version;
- policy version;
- generated timestamp;
- input/output hash;
- validation results;
- publication decision and reason;
- previous content version for rollback;
- AI/server cost and token usage.

The AI receives only the minimum approved public projection. Customer, vehicle, work-order, finance, private staff, and secret data are excluded.

### 11.3 Auto-publication gates

Generated content may auto-publish only when all checks pass:

1. all factual claims are traceable to approved fields;
2. no unsupported superlative, guarantee, award, rank, certification, medical/safety, or legal claim;
3. no duplicate/thin page or keyword stuffing;
4. no near-duplicate content across multiple stores;
5. no contradiction with NAP, capability, hours, products, services, or visible page data;
6. useful information gain exists for the visitor;
7. length, language, prohibited-word, link, and structured-data checks pass;
8. material-change threshold is met;
9. daily and monthly AI cost budgets remain available;
10. rollback version exists.

Failure creates a proposal for review and leaves the last accepted content live.

### 11.4 Anti-churn rule

The AI evaluates nightly but does not rewrite a page merely because a job ran. A new version requires a factual change, an accepted performance hypothesis, or a documented quality defect. Cosmetic synonym changes are rejected.

## 12. Security, privacy, and public projection

### 12.1 Explicitly excluded fields

The feed must never include:

- internal `dealer_id`, membership records, user IDs, or private staff details;
- customer, vehicle, reservation, estimate, work-order, report, invoice, payment, or message data;
- bank information, private email, notes, costs, discounts, internal prices, or credentials;
- Supabase keys, AI keys, LINE secrets, Google tokens, or signing secrets;
- unapproved qualifications, unapproved products/services, or internal rejection reasons;
- private/original media paths or signed editing URLs.

### 12.2 Supabase boundary

- New logical tables in an exposed schema require explicit grants and RLS; authentication alone is not authorization.
- Prefer a private publication schema or guarded server projection for integration state.
- Storage metadata is treated as service-owned; uploads/moves/deletes use the Storage API, not direct writes to `storage` schema tables.
- Public retrieval is limited to approved immutable derivatives. Originals remain private.
- Service-role operations, if later approved, are guarded, audited server operations only.

## 13. Monitoring and measurable outcomes

Every nightly run records:

- source and destination snapshot IDs;
- active, changed, unchanged, suspended, withdrawn, and tombstoned store counts;
- media added/replaced/revoked counts;
- validation failures by code;
- API latency, retries, status, and bytes;
- AI executions, rejects, costs, and rollback events;
- website generation and sitemap status;
- GBP field-mask update and conflict counts;
- last good sync age.

Business measurements must include:

- store-detail impressions and organic clicks;
- map/directions/phone/website interactions where APIs and consent permit;
- store inquiry and reservation conversions;
- product/service page to store-detail transitions;
- qualified store visits and attributable sales where measurement is lawful and practical;
- data completeness and freshness by store.

Progress metrics are not proof that search rank or sales were caused by the system. Experiments and attribution rules must be recorded separately.

## 14. Failure and rollback model

| Failure | Required behavior |
|---|---|
| DealerOS export unavailable | Keep last good website snapshot; retry and alert |
| Invalid store/item | Reject item or full snapshot according to severity; never silently publish malformed facts |
| Image unavailable | Keep prior approved asset or use approved placeholder; record defect |
| AI provider unavailable/budget exhausted | Publish deterministic factual changes only, or defer copy change |
| Website import failure | No promotion; last good snapshot stays active |
| GBP authorization revoked | Stop updates, mark disconnected, notify store owner |
| Google conflict | Create review proposal; no silent overwrite/revert |
| Bad publication discovered | Roll back snapshot/content version and preserve audit evidence |

## 15. Delivery phases and bounded early exception

### 15.1 Accepted pre-GDA-7 exception — GHP-2A

**Objective:** establish a pure, deterministic and fail-closed DealerOS public-profile projection before any persistence or cross-domain API exists.

**Accepted evidence:** Draft PR #12 head `9b8bc1eb2cb59e879f5ebeb5b91e85ba4f522662`, tree `19fb3cf2f08778abaa87313c8908d4e32cb815c4`; exact two-path scope; focused tests 32/32 PASS; focused strict typecheck PASS; `git diff --check` PASS; [MacBook Codex final independent PASS](https://github.com/nisikawa-officeAZ/GYEON/pull/12#issuecomment-5304962007). This is E2 source/test evidence only, not DB, API, website, field, or production proof.

**Literal implementation allowlist:**

1. `src/lib/dealer-public-profile/dealer-public-profile-projection.ts`
2. `src/lib/dealer-public-profile/dealer-public-profile-projection.test.ts`

**Required exit evidence:**

- profile lifecycle, owner publication consent and operator approval fail closed unless the profile is currently published;
- conflicting duplicate qualification records cannot publish a stale approval;
- an internal dealer identifier cannot be accepted as the public-store identifier boundary;
- timestamps require an explicit-zone ISO/RFC3339 instant and equivalent capability sets emit canonical order;
- focused tests and `git diff --check` pass on the exact two-path candidate;
- MacBook Codex records an independent PASS on Draft PR #12.

**Stop boundary:** no new path, dependency, config, database, Supabase, RLS, migration, Storage, media, external API, website, SEO/MEO, GBP, Ready conversion, merge or deployment is authorized. After GHP-2A acceptance, the wider GHP sequence remains deferred until GDA-7 or another explicit Git-governed owner decision.

### 15.2 Post-GDA-7 delivery sequence

| Phase | Objective | Minimum exit evidence |
|---|---|---|
| GHP-0 | Ratify this contract and exact ownership | Git-accepted specification |
| GHP-1 | Read-only current-state diagnosis | Exact route/schema/media/API gap and literal allowlist |
| GHP-2 | Store settings and public-profile data contract | Focused tests, RLS/authorization design, UI acceptance |
| GHP-3 | Store media upload, moderation, derivatives, consent/rights | Storage/RLS tests and image-pipeline evidence |
| GHP-4 | Versioned website API and nightly staging sync | Contract tests, idempotency, auth/replay, rollback proof |
| GHP-5 | GYEON website directory/detail pages and structured data | SSR/static HTML, JSON-LD, sitemap, accessibility, visual evidence |
| GHP-6 | Bounded AI SEO/MEO and approved GBP adapter | Grounding, policy, cost, consent, conflict, audit, rollback proof |
| GHP-7 | Pilot, measurement, production rollout | Real stores, monitored nightly runs, authenticated integrations, recovery runbook |

Diagnosis, source implementation, migration generation, disposable verification, commit, push, external account connection, deployment, and production publication remain separate authorization gates in every phase.

## 16. Acceptance criteria

The design is implementation-ready only when:

1. DealerOS private facts and website public projection are demonstrably separated.
2. Store settings support the required facts, ordered images, rights attestation, and publication preview.
3. Operator-owned GYEON qualifications cannot be self-published.
4. The external API is versioned, authenticated, replay-safe, paginated, idempotent, and auditable.
5. Website staging import and atomic promotion keep the last good snapshot on failure.
6. Each store page has stable canonical URL, visible factual parity, validated LocalBusiness JSON-LD, and sitemap coverage.
7. AI output is grounded, budgeted, validated, versioned, reversible, and resistant to scaled-content abuse.
8. GBP automation has owner consent, narrow field masks, disconnect, conflict review, and policy compliance.
9. No service-role key, customer data, private media, or secret crosses the public integration boundary.
10. Pilot evidence demonstrates reliable daily freshness and measurable user/business value without claiming guaranteed ranking.

## 17. Official references verified for this design

- Google Search Central — Local Business structured data: <https://developers.google.com/search/docs/appearance/structured-data/local-business>
- Google Search Central — sitemaps: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- Google Search Central — generative AI content: <https://developers.google.com/search/docs/fundamentals/using-gen-ai-content>
- Google Search Central — spam policies: <https://developers.google.com/search/docs/essentials/spam-policies>
- Google Search Central — Indexing API supported page types: <https://developers.google.com/search/apis/indexing-api/v3/using-api>
- Google Business Profile API policies: <https://developers.google.com/my-business/content/policies>
- Google Business Profile Business Information API: <https://developers.google.com/my-business/reference/businessinformation/rest>
- Supabase Storage access control: <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase Storage buckets/access models: <https://supabase.com/docs/guides/storage/buckets/fundamentals>
- Supabase Storage image transformations: <https://supabase.com/docs/guides/storage/serving/image-transformations>
- Supabase Storage schema boundary: <https://supabase.com/docs/guides/storage/schema/design>

These references are implementation-time dependencies and must be rechecked before any external/API portion of GHP-2 through GHP-6 because external APIs and policies change. GHP-2A is pure local source/test work and does not authorize external access.

---

*GYEON Detailer Agent | GYEON HP Store Discovery Integration | Office AZ | 2026-08-10*
