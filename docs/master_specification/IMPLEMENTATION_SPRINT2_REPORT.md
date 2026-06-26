# IMPLEMENTATION SPRINT 2 REPORT
## GYEON Detailer Agent

| Field | Value |
|-------|-------|
| **Sprint** | Implementation Sprint 2 |
| **Date** | 2026-06-25 |
| **Status** | Complete |
| **Commit** | `06f7a4c` feat(wizard): implement step-roomclean |
| **File modified** | `src/components/estimates/EstimateWizard.tsx` |
| **Lines changed** | +113 / −6 |

---

## 1. Scope

Implement `step-roomclean` in the EstimateWizard. No PPF. No Window.

---

## 2. Components Added

### Constants

```typescript
const ROOM_CLEAN_PARTS: { id: string; name: string; basePrice: number }[] = [
  { id: "rc-floor",   name: "フロア",         basePrice: 12000 },
  { id: "rc-seat",    name: "シート",         basePrice: 15000 },
  { id: "rc-ceiling", name: "天井",           basePrice:  8000 },
  { id: "rc-dash",    name: "ダッシュボード", basePrice: 10000 },
  { id: "rc-full",    name: "フルパッケージ", basePrice: 45000 },
];

const ROOM_CLEAN_CONDITIONS: { id: string; label: string; coeff: number }[] = [
  { id: "normal", label: "通常",    coeff: 1.0 },
  { id: "dirty",  label: "汚れあり", coeff: 1.3 },
  { id: "heavy",  label: "重度汚れ", coeff: 1.6 },
];
```

Data matches `DEFAULT_SERVICE_PRICE_SETTINGS.room_cleaning` in `dealer-settings-defaults.ts`.

### State

```typescript
const [roomCleanSel,  setRoomCleanSel]  = useState<string[]>([]);
const [roomCleanCond, setRoomCleanCond] = useState<string>("normal");
```

### Price Calculation

```typescript
const rcCondCoeff  = ROOM_CLEAN_CONDITIONS.find(c => c.id === roomCleanCond)?.coeff ?? 1.0;
const rcBaseTot    = roomCleanSel.reduce((s, id) => s + (ROOM_CLEAN_PARTS.find(p => p.id === id)?.basePrice ?? 0), 0);
const roomCleanTot = Math.round(rcBaseTot * rcCondCoeff);
// subtotal now includes roomCleanTot
```

---

## 3. UI — step-roomclean

**Section 1 — Condition selector (3-button grid):**
- 通常 ×1.0 / 汚れあり ×1.3 / 重度汚れ ×1.6
- Blue active state; coefficient displayed under label

**Section 2 — Part checkboxes:**
- Each part shows adjusted price (base × coeff) in blue when selected
- When condition ≠ normal: base price shown below in strikethrough grey
- Multi-select; toggling part updates subtotal live

**Section 3 — Running subtotal:**
- Shown when ≥1 part selected: `ルームクリーニング小計 ¥XX,XXX`

---

## 4. handleSave Integration

Room clean items saved with `category: "interior"` (valid EstimateCategory). Condition label appended to item name when non-normal:

```typescript
if (has("roomclean") && roomCleanSel.length > 0) {
  roomCleanSel.forEach(id => {
    const p = ROOM_CLEAN_PARTS.find(x => x.id === id);
    if (p) {
      const unitPrice = Math.round(p.basePrice * (cond?.coeff ?? 1.0));
      const label = cond && cond.id !== "normal"
        ? `${p.name}（${cond.label}）`
        : p.name;
      items.push(mk("interior", label, unitPrice));
    }
  });
}
```

---

## 5. STEP5 Breakdown

New section added after carwash breakdown:
- Header: `ルームクリーニング` with amber condition label when non-normal
- Each selected part with per-part computed price
- Consistent with existing breakdown style

---

## 6. PDF Integration

Room clean items are included in `items_json` passed to `createEstimate`. The PDF pipeline reads `estimate_items` from the DB, so room clean line items appear in generated PDFs without any PDF-specific changes.

---

## 7. Test Results

| Check | Result |
|-------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ Clean |
| ESLint | N/A — not installed in project |
| Build (`npm run build`) | ✅ Passing — 24/24 pages |
| Pre-existing warnings | `/products` dynamic-server-usage — pre-existing |

---

## 8. Remaining Placeholder Screens

```typescript
const PLACEHOLDER_SCREENS: Screen[] = ["step-ppf", "step-window"];
```

| Screen | Blocked by | Required ODs |
|--------|-----------|-------------|
| `step-ppf` | OD-2, OD-3, OD-4, OD-10, OD-15 | PPF pricing package |
| `step-window` | OD-5, OD-6 | Window film grades + part IDs |

Both remain as 🚧 placeholders until Operator Decisions are resolved.

---

## 9. Sprint 1 + Sprint 2 Summary

| Screen | Sprint | Status |
|--------|--------|--------|
| `step-maintenance` | Sprint 1 | ✅ Implemented |
| `step-carwash` | Sprint 1 | ✅ Implemented |
| `step-other` | Sprint 1 | ✅ Implemented |
| `step-roomclean` | Sprint 2 | ✅ Implemented |
| `step-ppf` | — | ⏳ Awaiting OD-2/3/4/10/15 |
| `step-window` | — | ⏳ Awaiting OD-5/6 |

---

*GYEON Detailer Agent | Implementation Sprint 2 Report | Office AZ | 2026-06-25*
