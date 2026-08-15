# B7-4 — Disposable production-route E2E acceptance runbook

Proves a real save through the reachable `/estimates/new` production wizard,
exactly-once persistence, tenant isolation, and a safe redirect — against a
throwaway local Supabase, never production. All scripts live under
`scripts/e2e/b7-4/`. Nothing here writes to the repository.

> Prerequisite: Docker/Colima running locally. The app's `.env.local` points at
> the remote "DealerOS-Dev" project; the harness overrides the three Supabase
> variables with disposable loopback values, which take precedence over
> `.env.local` via `@next/env`. `run-app.sh` additionally refuses any non-loopback
> URL, so production can never be reached.

## Preferred execution — automated, Claude-owned (R84C)

When Claude automation is available, the **preferred** way to run B7-4 is the durable
autonomous runner — no operator browser, DevTools, Terminal, or clipboard work:

```sh
npm run test:b7-4-e2e
# └ scripts/e2e/b7-4/run-e2e-auto.sh   (run from the repository root, no args)
```

It performs the full lifecycle itself, in this order, preserving the failing exit
status while still tearing the stack down where safe:

1. **orphan preflight** — removes only a provably-owned stale `dealeros-b7-4-*` stack
   (fresh-6-char suffix, both RUNDIR+EVID absent, exactly the eight allowlisted
   services, volumes only `db`/`storage`, port 3000 free); fails closed otherwise.
2. **`setup.sh`** — fresh disposable suffix; pins the eight containers to
   `restart=no` so a reboot cannot resurrect an orphan.
3. **`run-app.sh`** on :3000, backgrounded — never a foreground operator terminal.
4. **the canonical Playwright spec** `scripts/e2e/b7-4/e2e/b7-4.spec.ts`, which drives
   this repo's `capture-evidence.sh` for all **seven** artifacts in canonical order
   **customer → isolation → vehicle → ws → key → armed → estimate**, reproducing the
   shared-term 090 Stage-1 / Stage-2 isolation proofs, the Step-3 maintenance selection
   latch, the Step-4 maintenance-section visibility proof, the same-page latch, the armed proof,
   exactly one `UI-SAVE BEGIN`, the intentional same-turn double dispatch
   (`b.click(); b.click();`), exactly one `"stage":"done"`, and one `UI-SAVE END`.
5. **stop the app**, run **`assertions.sql`** (all 29; `assertions.out` mode 0600),
   then **`cleanup.sh`**.

The disposable login is read locally and passed only through the environment — never in
argv, never echoed, never in a Playwright trace/screenshot (traces are disabled). **No
canonical assertion is weakened:** the automated path reproduces every §4 proof and
every §7 assertion exactly.

**The manual runbook in §§1–10 below remains the authoritative fallback/reference** —
for when Claude automation is unavailable, or to audit exactly what each automated step
performs.

## The two rules that govern this entire runbook

**Rule 1 — helper-first, one artifact at a time.** Every piece of browser
evidence is captured by `capture-evidence.sh`, never by hand. For each artifact:

1. Start **exactly one** helper invocation in Terminal.
2. Wait for `READY:<name>`.
3. In DevTools, execute **exactly one** instructed `copy()`.
4. Wait for `CAPTURED:<name>`.
5. Only then continue.

Never chain `copy()` calls, never use timers, never redirect `pbpaste` by hand,
and never type shell commands into DevTools. The helper overwrites the clipboard
with a freshness sentinel before printing `READY`, so a stale-but-valid clipboard
value can never be captured.

**Rule 2 — burn, never repair.** Any condition in [§10 Burn policy](#10-burn-policy)
destroys the whole disposable run. There is no repair step, and **no same-key
retry is permitted in canonical scenario A**.

## Phase order (must be followed exactly)

1. `setup.sh`
2. read `.credentials` locally
3. `run-app.sh` in a dedicated foreground terminal
4. UI scenario A — Steps 1, 2, estimate input, review, arm, marked save
5. stop `run-app.sh` with Ctrl-C
6. confirm the app PID is gone and port 3000 is clear
7. `assertions.sql`
8. `cleanup.sh`
9. postflight Git evidence

## 1. Setup

```sh
scripts/e2e/b7-4/setup.sh
```
`setup.sh` prints the **authoritative canonical** RUNDIR and EVID (also at
`EVID/handoff.txt`). On macOS these are normally under `/private/tmp` (because
`/tmp` resolves to `/private/tmp`). **Copy the exact printed values verbatim.**
Never rewrite a printed `/private/tmp` path back to `/tmp`. Export them:
```sh
RUNDIR=<exact printed RUNDIR>; EVID=<exact printed EVID>
```

## 2. Retrieve the disposable login (local only)

```sh
cat "$RUNDIR/.credentials"     # {"email":"b7-4-verify@localhost.test","password":"..."}
```
Read this in your own terminal only. Do not paste it anywhere it will be logged,
screenshotted, or captured into a transcript. Each `setup.sh` run creates a NEW
password against a NEW database — credentials from an earlier run never work.

## 3. Start the application (dedicated foreground terminal)

```sh
scripts/e2e/b7-4/run-app.sh "$RUNDIR" "$EVID"
```
Wait until Next.js reports it is listening on `http://localhost:3000`. Leave this
terminal open for the whole scenario: `capture-evidence.sh` refuses to run unless
this exact process is alive and its stdout is this EVID's `app.log`.

## 4. UI scenario A

Sign in at `http://localhost:3000/login`, then open
`http://localhost:3000/estimates/new`. The wizard bootstraps and stamps `?ws=…`.

There are **exactly seven** helper invocations in this scenario, in this order:
`customer`, `isolation`, `vehicle`, `ws`, `key`, `armed`, `estimate`.

### 4.1 Step 1 — existing customer  (helper 1 of 7: `customer`)

The wizard's default registration mode is **新規顧客登録**. You must switch it.
Creating a new customer instead of selecting the seeded one invalidates the run.

1. Switch 登録方式 from **新規顧客登録** to **既存顧客を検索**.
2. Type **090** into the 名前 / 電話番号で絞り込み box.
3. In DevTools, run the Stage-1 proof (shared-term 090 query + non-vacuous isolation):

> **Every DevTools snippet in this runbook is wrapped in a block `{ … }`.** Steps 1
> and 2 run on the same page without navigation, so a bare top-level `const sel`
> would throw *"Identifier has already been declared"* on the second snippet.
> Nothing leaks between snippets; anything the next snippet needs is carried on an
> explicit `window.__B7_*` property.

```js
{
  const sel = document.querySelector('[data-testid="existing-customer-selector"]');
  if (!sel) throw new Error("B7-4 BURN: not in existing-customer mode");
  const inputs = sel.querySelectorAll('input');
  if (inputs.length !== 1) throw new Error("B7-4 BURN: expected exactly 1 selector input, got " + inputs.length);
  const q = inputs[0];
  if (!(q instanceof HTMLInputElement)) throw new Error("B7-4 BURN: selector input is not an HTMLInputElement");
  if (q.value !== "090") throw new Error("B7-4 BURN: search query is not 090");
  const opts = [...sel.querySelectorAll('[data-testid^="existing-customer-option-"]')];
  if (opts.length === 0) throw new Error("B7-4 BURN: zero options - vacuous scan");
  if (!opts.some(o => o.dataset.testid.endsWith("b7400000-0000-4000-8000-0000000000c1")))
    throw new Error("B7-4 BURN: actor customer c1 not offered");
  if (opts.some(o => o.dataset.testid.endsWith("b7400000-0000-4000-8000-0000000000c2")))
    throw new Error("B7-4 BURN: foreign customer c2 offered");
  if (/ZZ-SENTINEL-FOREIGN-CUSTOMER/.test(sel.textContent))
    throw new Error("B7-4 BURN: sentinel text in selector");
  window.__B7_ISO_1 = true;
}
```

> The query must be exactly `090`. The seeded actor phone `090-0000-0001` and the
> seeded foreign-sentinel phone `090-9999-9999` both match `090` before tenant
> filtering is applied, so "c2 absent" cannot be explained by the search term
> alone — it can only be explained by tenant-scoped filtering. Requiring both
> ≥1 option and c1 present is what rules out a vacuous zero-option pass.

4. Click the **アクター 太郎** option.
5. Confirm the selection:

```js
{
  const s = document.querySelector('[data-testid="existing-customer-summary"]');
  if (!s) throw new Error("B7-4 BURN: existing customer NOT selected");
  if (!s.textContent.includes("既存顧客を選択中")) throw new Error("B7-4 BURN: summary malformed");
  const labels = [...s.querySelectorAll("p")];
  if (!labels.some((p) => p.textContent === "アクター 太郎"))
    throw new Error("B7-4 BURN: wrong customer");
}
```

6. Terminal — start the helper and wait for `READY:ui-step1-customer.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh customer "$EVID"
```
7. DevTools — `copy("CUSTOMER_OK")`
8. Wait for `CAPTURED:ui-step1-customer.txt`. **Do not leave Step 1 before this.**

### 4.2 Step 2 — isolation, then existing vehicle  (helpers 2 and 3: `isolation`, `vehicle`)

Do **not** select a vehicle yet. The isolation scan must run while the selector
still shows the full offered list. Do not reload the page — a reload clears the
Stage-1 latch and burns the run.

1. Terminal — start the helper and wait for `READY:ui-isolation.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh isolation "$EVID"
```
2. DevTools — Stage-2 scan, then copy:

```js
{
  if (window.__B7_ISO_1 !== true) throw new Error("B7-4 BURN: stage-1 latch missing");
  const sel = document.querySelector('[data-testid="existing-vehicle-selector"]');
  if (!sel) throw new Error("B7-4 BURN: vehicle selector absent");
  const opts = [...sel.querySelectorAll('[data-testid^="existing-vehicle-option-"]')];
  if (!opts.some(o => o.dataset.testid.endsWith("b7400000-0000-4000-8000-0000000000f1")))
    throw new Error("B7-4 BURN: actor vehicle f1 not offered");
  if (opts.some(o => o.dataset.testid.endsWith("b7400000-0000-4000-8000-0000000000f2")))
    throw new Error("B7-4 BURN: foreign vehicle f2 offered");
  if (/ZZ-SENTINEL-MAKER|ZZ-SENTINEL-MODEL|FOREIGN-SENTINEL-PLATE/.test(sel.textContent))
    throw new Error("B7-4 BURN: sentinel text in selector");
  window.__B7_ISO_1 = false;   // single-use latch cleared BEFORE the copy
  copy("ISOLATION_OK");
}
```

3. Wait for `CAPTURED:ui-isolation.txt`.
4. Click the **Toyota Aqua (ACTOR-0001)** option.
5. Confirm the selection:

```js
{
  const s = document.querySelector('[data-testid="existing-vehicle-summary"]');
  if (!s) throw new Error("B7-4 BURN: existing vehicle NOT selected");
  if (!s.textContent.includes("既存車両を選択中")) throw new Error("B7-4 BURN: summary malformed");
  if (!s.textContent.includes("ACTOR-0001")) throw new Error("B7-4 BURN: wrong vehicle");
}
```

6. Terminal — start the helper and wait for `READY:ui-step2-vehicle.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh vehicle "$EVID"
```
7. DevTools — `copy("VEHICLE_OK")`
8. Wait for `CAPTURED:ui-step2-vehicle.txt`. **Do not leave Step 2 before this.**

### 4.3 Estimate input — exactly one manual maintenance line

- Seed precondition: the actor dealer has exactly one enabled managed-family
  offering, **maintenance**; the foreign sentinel has no offering rows. The offering
  INSERT is also the single trigger-driven catalog revision bump for this atomic
  bootstrap.
- Category: **maintenance / ボディ定期メンテナンス**
- Menu: **メンテA**
- Manually type the unit price **5000**
- Activate **明細に追加 / 更新**
- Quantity is **1** (fixed by the pricing config; there is no quantity control)
- **No** second line, **no** discount, **no** coupon, **no** note

Before leaving Step 3, the automated path proves all three state gates on the
same visible category control: **`aria-pressed="true"`**, an empty
**`wizard-blocked-reason`**, and an enabled visible **次へ** button. After entering
Step 4 — before looking for メンテA — it proves the no-category placeholder is
absent and the **ボディ定期メンテナンス** button exists inside the
**施工セクション** navigation with **`aria-current="true"`**. Any failed latch or
visibility proof burns the run; no sleep, timeout increase, repair, or retry is allowed.

### 4.4 Step 7 — expected display

At Step 7 a **correct** existing-entity selection displays:

```
顧客   —
車両   —
```

**This is expected and correct.** Step 7 renders the draft's *new-record* fields,
which existing-entity selection deliberately never writes — selecting an existing
record stores ids and mode only.

> **If a customer or vehicle name appears at Step 7, burn the run**: names there
> mean the new-entity flow was used.

The authoritative existing-entity proof is **`ui-step1-customer.txt`**,
**`ui-step2-vehicle.txt`** and **`ui-isolation.txt`** — never the Step 7 labels.

### 4.5 Capture ws and key  (helpers 4 and 5: `ws`, `key`)

1. Terminal, wait for `READY:ui-ws.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh ws "$EVID"
```
2. DevTools:
```js
{
  const ws = new URLSearchParams(location.search).get("ws");
  if (!/^ws\.[0-9a-f]{32}$/.test(ws)) throw new Error("B7-4 BURN: ws malformed");
  window.__B7_WS = ws;   // carried to the next snippet; nothing leaks at top level
  copy(ws);
}
```
3. Wait for `CAPTURED:ui-ws.txt`.
4. Terminal, wait for `READY:ui-key.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh key "$EVID"
```
5. DevTools:
```js
{
  const ws = window.__B7_WS;
  if (!/^ws\.[0-9a-f]{32}$/.test(ws)) throw new Error("B7-4 BURN: __B7_WS missing or malformed");
  const ready = JSON.parse(sessionStorage.getItem("dealeros.ew.idem.v1:" + ws));
  if (!ready || ready.v !== 1 || ready.status !== "ready") throw new Error("B7-4 BURN: not ready");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(ready.key)) throw new Error("B7-4 BURN: key malformed");
  copy(ready.key);
}
```
6. Wait for `CAPTURED:ui-key.txt`.

### 4.6 Pre-arm validation and ARM  (helper 6 of 7: `armed`)

This is the gate that catches a save that already happened. Run it **immediately**
before the marked window.

```js
{
  const WS  = "PASTE_CONTENTS_OF_ui-ws.txt";
  const KEY = "PASTE_CONTENTS_OF_ui-key.txt";
  if (WS !== window.__B7_WS)  throw new Error("B7-4 BURN: pasted ws != captured ws");
  const r = JSON.parse(sessionStorage.getItem("dealeros.ew.idem.v1:" + WS));
  if (!r)                     throw new Error("B7-4 BURN: record missing");
  if (r.v !== 1)              throw new Error("B7-4 BURN: record version");
  if (r.status !== "ready")   throw new Error("B7-4 BURN: status=" + r.status);
  if (r.key !== KEY)          throw new Error("B7-4 BURN: key changed");
  if ("estimateId" in r)      throw new Error("B7-4 BURN: already completed");
  if (new URLSearchParams(location.search).get("ws") !== WS)
                              throw new Error("B7-4 BURN: ws changed");
  if (!document.querySelector('[data-testid="save-state-ready"]'))
                              throw new Error("B7-4 BURN: panel not ready");
  if (!document.querySelector('[data-testid="save-submit"]'))
                              throw new Error("B7-4 BURN: save-submit absent");
  if (document.querySelector('[data-testid="save-retry-same-key"]'))
                              throw new Error("B7-4 BURN: a prior save attempt occurred");
  window.__B7_ARMED = true;
}
```

Then Terminal, wait for `READY:ui-armed.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh armed "$EVID"
```
DevTools — `copy("ARMED")` — and wait for `CAPTURED:ui-armed.txt`.

Terminal must now confirm all three, before any marker is written:
```sh
[ "$(cat "$EVID/ui-armed.txt")" = "ARMED" ] || { echo "B7-4 BURN: not armed"; exit 1; }
d=$(grep -ac '"stage":"done"' "$EVID/app.log"); [ "$d" -eq 0 ] || { echo "B7-4 BURN: $d prior done events"; exit 1; }
m=$(grep -ac 'B7-4 UI-SAVE' "$EVID/app.log");   [ "$m" -eq 0 ] || { echo "B7-4 BURN: $m prior markers"; exit 1; }
```

### 4.7 Marked save window

**BEGIN — exactly once, and verify:**
```sh
printf '%s\n' '>>> B7-4 UI-SAVE BEGIN <<<' >> "$EVID/app.log"
[ "$(grep -ac 'B7-4 UI-SAVE BEGIN' "$EVID/app.log")" -eq 1 ] || { echo "B7-4 BURN: BEGIN count"; exit 1; }
```

**The save — programmatic, single-use, no manual click:**
```js
{
  if (window.__B7_ARMED !== true) throw new Error("B7-4 BURN: not armed");
  if (!document.querySelector('[data-testid="save-state-ready"]')) throw new Error("B7-4 BURN: not ready");
  if (document.querySelector('[data-testid="save-retry-same-key"]')) throw new Error("B7-4 BURN: prior attempt");
  const b = document.querySelector('[data-testid="save-submit"]');
  if (!b) throw new Error("B7-4 BURN: save-submit absent");
  window.__B7_ARMED = false;   // single-use latch cleared BEFORE dispatch
  b.click();
  b.click();
}
```

Clicking 保存 by hand is **not permitted** — the latch is the only authorized path.

**Bounded polling for exactly one terminal event:**
```sh
for i in $(seq 1 120); do
  d=$(grep -ac '"stage":"done"' "$EVID/app.log")
  [ "$d" -ge 2 ] && { echo "B7-4 BURN: $d done events"; exit 1; }
  [ "$d" -eq 1 ] && break
  sleep 1
done
[ "$(grep -ac '"stage":"done"' "$EVID/app.log")" -eq 1 ] || { echo "B7-4 BURN: done timeout"; exit 1; }
```

**Destination identity (on `/estimates/<id>`):**
`sessionStorage` survives the same-origin navigation; `window.__B7_WS` does not,
so the ws and key are pasted from their captured files here.

```js
{
  const CAP_WS  = "PASTE_CONTENTS_OF_ui-ws.txt";
  const CAP_KEY = "PASTE_CONTENTS_OF_ui-key.txt";
  if (!/^ws\.[0-9a-f]{32}$/.test(CAP_WS)) throw new Error("B7-4 BURN: captured ws malformed");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(CAP_KEY)) throw new Error("B7-4 BURN: captured key malformed");
  const done = JSON.parse(sessionStorage.getItem("dealeros.ew.idem.v1:" + CAP_WS));
  if (!done)                      throw new Error("B7-4 BURN: record missing");
  if (done.v !== 1)               throw new Error("B7-4 BURN: record version");
  if (done.status !== "completed")throw new Error("B7-4 BURN: not completed");
  if (done.key !== CAP_KEY)       throw new Error("B7-4 BURN: key changed");
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(done.estimateId))
                                  throw new Error("B7-4 BURN: estimateId not a UUID");
  if (location.pathname !== "/estimates/" + done.estimateId)
                                  throw new Error("B7-4 BURN: redirect pathname mismatch");
  window.__B7_DONE = done;   // carried to the copy instruction below
}
```

**Capture the estimate id (helper 7 of 7: `estimate`).** Terminal, wait for
`READY:ui-estimate.txt`:
```sh
scripts/e2e/b7-4/capture-evidence.sh estimate "$EVID"
```
DevTools:
```js
{
  copy(window.__B7_DONE.estimateId);
}
```
Wait for `CAPTURED:ui-estimate.txt`.

**END — only after the completed record, the pathname proof and the estimate
capture have all succeeded:**
```sh
printf '%s\n' '>>> B7-4 UI-SAVE END <<<' >> "$EVID/app.log"
[ "$(grep -ac 'B7-4 UI-SAVE END' "$EVID/app.log")" -eq 1 ] || { echo "B7-4 BURN: END count"; exit 1; }
```

**Final marker requirements:**
```sh
[ "$(grep -ac 'B7-4 UI-SAVE BEGIN' "$EVID/app.log")" -eq 1 ] || exit 1
[ "$(grep -ac 'B7-4 UI-SAVE END' "$EVID/app.log")"   -eq 1 ] || exit 1
[ "$(grep -ac '"stage":"done"' "$EVID/app.log")"     -eq 1 ] || exit 1
```

### 4.8 Confirm the detail page

Confirm `/estimates/<id>` renders the saved estimate. No further browser action.

## 5. Stop the application

In the `run-app.sh` terminal, press **Ctrl-C**.

## 6. Confirm the app is down

```sh
kill -0 "$(cat "$EVID/app.pid")" 2>/dev/null && { echo "B7-4 STOP: app still alive"; exit 1; }
lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 && { echo "B7-4 STOP: port 3000 open"; exit 1; }
```
Both gates must exit nonzero and halt the run if the app is alive or the port is open.

## 7. Direct RPC replay + mismatch (only after the app is stopped)

Every runtime value is read from files — no inherited `$VUSER`. psql output is
**redirected** (not piped to `tee`) so its exit status is authoritative; the file
is displayed only after a zero exit:
```sh
if psql "$(cat "$RUNDIR/.db-url")" \
     -v ON_ERROR_STOP=1 \
     -v vuser="$(cat "$RUNDIR/.vuser")" \
     -v ui_key="$(cat "$EVID/ui-key.txt")" \
     -v ui_estimate="$(cat "$EVID/ui-estimate.txt")" \
     -v seq_before_ui="$(cat "$EVID/seq-before-ui.txt")" \
     -f scripts/e2e/b7-4/assertions.sql > "$EVID/assertions.out" 2>&1; then
  cat "$EVID/assertions.out"
  echo "B7-4 assertions PASSED"
else
  cat "$EVID/assertions.out"
  echo "B7-4 STOP: assertions FAILED"; exit 1
fi
```
Any `B7_ASSERT:` line or nonzero psql exit stops the B7-4 run. All 29 assertions
must pass, including `ui-ownership`, `ui-item-identity` and `brpc-item-identity`.

`$EVID/assertions.out` is retained. It proves: the UI estimate is actor-owned and
unique; its persisted line carries the exact production identity
(`manual_pricing_identity = maint-a`, `wizard_line_id = manual:maintenance:maint-a`);
UI sequence +1; sentinel isolation; B_RPC fresh then replay
(`idempotent_replay=true`) with identical id/number and one fingerprint; same-key
`notes.internalMemo` mismatch → `DUPLICATE_SUBMISSION`; replay and mismatch add no
rows and no sequence delta.

## 8. Tenant isolation — where it is proved

There is **no HAR export and no Network-log requirement**. A raw HAR carries
`Authorization`, `apikey` and session cookies, and proves less than what replaces
it. Isolation is proved by four independent layers:

1. **Stage-1 scan** (§4.1) — the foreign customer was never *offered*.
2. **Stage-2 scan** (§4.2) — the foreign vehicle was never *offered*.
3. **Source structure** — `selectableVehiclesForCustomer` filters by owner, so a
   foreign vehicle is unrepresentable in the list.
4. **`assertions.sql`** — `sentinel-customer-exists`, `sentinel-vehicle-exists`,
   `sentinel-no-estimate` in the database.

## 9. Cleanup and postflight

```sh
scripts/e2e/b7-4/cleanup.sh "$RUNDIR" "$EVID"
```
Cleanup refuses to run while the app PID is alive or port 3000 is open.

```sh
git -C /Users/atsushinishikawa/dealeros status --porcelain=v1 --untracked-files=all \
  > "$EVID/postflight-git.txt" || { echo "B7-4 STOP: git status failed"; exit 1; }
git -C /Users/atsushinishikawa/dealeros rev-parse HEAD \
  >> "$EVID/postflight-git.txt" || { echo "B7-4 STOP: git rev-parse failed"; exit 1; }
cat "$EVID/postflight-git.txt"
```
HEAD, index, and the 19 frozen entries must be unchanged; `$EVID` is preserved,
`$RUNDIR` and the disposable stack are gone.

## 10. Burn policy

Any of the following burns the **complete** disposable run. There is no repair,
and **no same-key retry in canonical scenario A**:

- Step-1 query not exactly `090`
- missing actor option (c1 or f1)
- foreign option (c2 or f2) or sentinel text offered
- missing isolation latch
- reload between isolation stages
- wrong customer or vehicle summary
- Step-3 maintenance selection not latched, blocked reason nonempty, or Next disabled
- Step-4 no-category placeholder present or maintenance section absent/inactive
- wrong Step-7 display (a name appears instead of `—`)
- missing or malformed ws or key
- pre-arm record pending, failed, completed, missing or malformed
- key change at any point
- a prior `"stage":"done"` event
- a prior `B7-4 UI-SAVE` marker
- `save-retry-same-key` present at any gate
- unknown save outcome
- any timeout
- done count other than one
- navigation/pathname mismatch
- BEGIN or END marker count other than one

### Burn procedure — exact order

`cleanup.sh` must **never** be invoked while the app is still live; it refuses,
and forcing it would leave the stack half-torn-down.

1. **Do not click or retry anything.** No Save, no 同じ保存キーで再試行, no reload.
2. Stop the foreground `run-app.sh` terminal with **one Ctrl-C**.
3. Confirm the app PID is no longer live:
   ```sh
   kill -0 "$(cat "$EVID/app.pid")" 2>/dev/null && { echo "B7-4: app still alive"; exit 1; }
   ```
4. Confirm port 3000 is free:
   ```sh
   lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 && { echo "B7-4: port 3000 open"; exit 1; }
   ```
5. Only then run cleanup with the exact RUNDIR and EVID:
   ```sh
   scripts/e2e/b7-4/cleanup.sh "$RUNDIR" "$EVID"
   ```
6. Any retry requires a **completely fresh** `setup.sh` environment. The burned
   database is never reused and no step is spliced onto it.
