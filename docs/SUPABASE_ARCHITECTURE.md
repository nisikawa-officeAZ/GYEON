# DealerOS — Supabase Architecture Design

> **Status:** Design only. No tables created. No SQL executed. No migrations applied.
> **Phase:** Pre-implementation architecture document.
> **Approval required before implementation:** GPT CTO

---

## 1. customers

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | 氏名 |
| `kana` | `text` | | フリガナ |
| `phone` | `text` | | 電話番号 |
| `email` | `text` | | メールアドレス |
| `postal_code` | `text` | | 郵便番号 |
| `address` | `text` | | 住所 |
| `line_id` | `text` | | LINE ID (optional) |
| `memo` | `text` | | 備考 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

> **Future:** `dealer_id uuid` column reserved for multi-dealer support.

---

## 2. vehicles

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `customer_id` | `uuid` | FK → `customers.id` ON DELETE CASCADE | |
| `manufacturer` | `text` | NOT NULL | メーカー |
| `model` | `text` | NOT NULL | 車種 |
| `year` | `text` | | 年式 |
| `grade` | `text` | | グレード |
| `body_color` | `text` | | ボディカラー |
| `license_plate` | `text` | | ナンバープレート |
| `vin` | `text` | | 車台番号 |
| `memo` | `text` | | 備考 |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### Relationship
```
customers  1 ──── N  vehicles
```

---

## 3. estimates

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `customer_id` | `uuid` | FK → `customers.id` ON DELETE CASCADE | |
| `vehicle_id` | `uuid` | FK → `vehicles.id` ON DELETE SET NULL | |
| `estimate_no` | `text` | NOT NULL, UNIQUE | 見積番号 |
| `status` | `text` | NOT NULL, CHECK (`DRAFT`,`SENT`,`APPROVED`,`REJECTED`) | |
| `subtotal` | `integer` | NOT NULL, default `0` | 小計（円） |
| `tax` | `integer` | NOT NULL, default `0` | 消費税（円） |
| `total` | `integer` | NOT NULL, default `0` | 合計（円） |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### Relationships
```
customers  1 ──── N  estimates
vehicles   1 ──── N  estimates
```

---

## 4. gyeon_service_estimates

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `estimate_id` | `uuid` | FK → `estimates.id` ON DELETE CASCADE | |
| `service_category` | `text` | NOT NULL | Coating / PPF / Window Film / Interior / Wheel Coating / Glass Coating / Maintenance |
| `body_size` | `text` | NOT NULL | SS / S / M / ML / L / LL / XL |
| `base_price` | `integer` | NOT NULL, default `0` | カテゴリ×サイズ基本料金 |
| `options_json` | `jsonb` | NOT NULL, default `'{}'` | 選択オプション {key: boolean} |
| `discount` | `integer` | NOT NULL, default `0` | 割引額（円） |
| `subtotal` | `integer` | NOT NULL, default `0` | 小計（円） |
| `tax` | `integer` | NOT NULL, default `0` | 消費税（円） |
| `total` | `integer` | NOT NULL, default `0` | 合計（円） |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### Relationship
```
estimates  1 ──── 1  gyeon_service_estimates
```

### options_json structure (example)
```json
{
  "ironRemoval": true,
  "contaminationRemoval": false,
  "hardPolish": true,
  "touchUpPaint": false,
  "additionalLabor": false
}
```

---

## 5. Row Level Security (RLS) Strategy

### Principle
- All tables have RLS **enabled**.
- Users can access **only their own data**.
- No cross-user data leakage.

### Policy pattern (per table)

| Policy | Operation | Rule |
|---|---|---|
| `select_own` | SELECT | `auth.uid() = user_id` |
| `insert_own` | INSERT | `auth.uid() = user_id` |
| `update_own` | UPDATE | `auth.uid() = user_id` |
| `delete_own` | DELETE | `auth.uid() = user_id` |

### Future: Multi-dealer support
- `dealer_id uuid` column reserved on all tables.
- Policy will expand to: `auth.uid() IN (SELECT user_id FROM dealer_members WHERE dealer_id = table.dealer_id)`
- No implementation until GPT CTO approval.

---

## 6. Authentication Strategy

### Phase 1 (current target)
- **Email + Password** via Supabase Auth (`supabase.auth.signInWithPassword`)
- Session managed by Supabase SSR client (`@supabase/ssr`)
- Middleware-based route protection (future)

### Phase 2 (future)
- **LINE Login** via OAuth 2.0
- Supabase Custom OAuth provider or LINE Login + Supabase custom JWT
- Requires LINE Developers console setup
- No implementation until GPT CTO approval

### Session flow (planned)
```
Browser → Supabase Auth → JWT → RLS policy → Data
```

---

## Entity Relationship Overview

```
customers
  │
  ├── 1:N ── vehicles
  │
  └── 1:N ── estimates
                │
                └── 1:1 ── gyeon_service_estimates
```

---

> **Implementation blocked until:**
> - GPT CTO approval
> - Supabase project credentials provided
> - .env.local configured (never committed)
> - RLS policies reviewed
