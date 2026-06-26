# BUG BACKLOG
## GYEON Detailer Agent — Estimate Wizard

| Field | Value |
|-------|-------|
| **Created** | 2026-06-25 |
| **Sprint** | 6 — End-to-End Validation |
| **Open bugs** | 1 |

---

## BUG-001 — Window Film step5 display order differs from PDF order

| Field | Value |
|-------|-------|
| **Bug ID** | BUG-001 |
| **Severity** | MEDIUM |
| **Status** | Open |
| **Type** | Display inconsistency |
| **Found in sprint** | 6 |

### Description

The step5 confirmation breakdown renders service sections in a different order from the generated PDF.

**Step5 UI order:**
```
1. Coating
2. PPF
3. Maintenance
4. Carwash
5. Room Clean
6. Window Film   ← position 6
7. Other
```

**serviceInputs / PDF order:**
```
1. Coating
2. PPF
3. Window Film   ← position 3
4. Maintenance
5. Carwash
6. Room Clean
7. Other
```

A user or operator reviewing the step5 confirmation screen will see Window Film after Room Clean. After saving and opening the PDF, they will see Window Film before Maintenance — a different position. No totals or data are affected; only the visual ordering differs.

### Affected files

| File | Lines | Description |
|------|-------|-------------|
| `src/components/estimates/EstimateWizard.tsx` | ~325 | `serviceInputs` push — window is position 3 (after ppf) |
| `src/components/estimates/EstimateWizard.tsx` | ~1281–1389 | step5 JSX — window rendered at position 6 (after roomclean) |

### Root cause

`serviceInputs` construction order (line 325) places window before maintenance/carwash/roomclean:

```typescript
if (has("coating") && coatId)   serviceInputs.push(coating);    // 1
if (has("ppf") && ppfPlan)      serviceInputs.push(ppf);        // 2
if (has("window"))              serviceInputs.push(window);     // 3 ← here
if (has("maintenance") ...)     serviceInputs.push(maintenance); // 4
if (has("carwash") ...)         serviceInputs.push(carwash);    // 5
if (has("roomclean") ...)       serviceInputs.push(roomclean);  // 6
if (has("other") ...)           serviceInputs.push(other);      // 7
```

But the step5 JSX renders window at position 6, after roomclean:

```tsx
{has("coating") ...}      {/* 1 */}
{has("ppf") ...}           {/* 2 */}
{has("maintenance") ...}   {/* 3 — maintenance before window */}
{has("carwash") ...}       {/* 4 */}
{has("roomclean") ...}     {/* 5 */}
{has("window") ...}        {/* 6 — window after roomclean */}
{has("other") ...}         {/* 7 */}
```

### Recommended fix

Move the Window Film section in the step5 JSX to position 3 (after PPF, before Maintenance), matching the `serviceInputs` push order.

**In `EstimateWizard.tsx`**, reorder the step5 breakdown sections:

```tsx
{has("coating") ...}      {/* 1 — unchanged */}
{has("ppf") ...}           {/* 2 — unchanged */}
{has("window") ...}        {/* 3 — MOVE HERE (currently at 6) */}
{has("maintenance") ...}   {/* 4 — was 3 */}
{has("carwash") ...}       {/* 5 — was 4 */}
{has("roomclean") ...}     {/* 6 — was 5 */}
{has("other") ...}         {/* 7 — unchanged */}
```

No logic changes required — the section content is unchanged. One block of JSX needs to be cut from its current position (after roomclean) and pasted after the PPF block.

### Impact assessment

- Totals: **unaffected**
- Saved data (estimate_items): **unaffected**
- PDF content: **unaffected**
- Step5 visual: corrected to match PDF order
- No DB migration required

---

*GYEON Detailer Agent | Bug Backlog | Office AZ | 2026-06-25*
