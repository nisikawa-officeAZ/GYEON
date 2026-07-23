import { test, expect, Page } from "@playwright/test";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * B7-4 CANONICAL disposable production-route E2E — fully automated, no human.
 *
 * Reproduces verify.md scenario A exactly, and produces the SEVEN canonical
 * evidence artifacts IN ORDER by orchestrating the repository's capture-evidence.sh
 * (its safety contract is used, never reimplemented): for each artifact we spawn
 * one helper, wait for READY, place the proof value on the system clipboard via
 * pbcopy (no user), wait for CAPTURED, and require exit 0.
 *
 * Canonical order: customer, isolation, vehicle, ws, key, armed, estimate.
 * Also: empty-query isolation proof, same-page Stage-1 latch, armed proof,
 * exactly one UI-SAVE BEGIN, intentional double dispatch, exactly one done event,
 * exactly one UI-SAVE END. Correctness is then proved by assertions.sql (outside).
 */

const REPO = "/Users/atsushinishikawa/dealeros";
const CAPTURE_SH = path.join(REPO, "scripts/e2e/b7-4/capture-evidence.sh");
const EVID = requireEnv("EVID");
const EMAIL = requireEnv("EMAIL");
const PASSWORD = requireEnv("PASSWORD");
const APP_LOG = path.join(EVID, "app.log");

// capture-evidence.sh needs lsof/ps/pbcopy/pbpaste — ensure a complete PATH.
const CAP_ENV = {
  ...process.env,
  PATH: `/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/opt/libpq/bin:${process.env.PATH || ""}`,
};

// Deterministic seed identities (scripts/e2e/b7-4/seed.sql).
const C1 = "b7400000-0000-4000-8000-0000000000c1"; // アクター 太郎
const C2 = "b7400000-0000-4000-8000-0000000000c2"; // ZZ-SENTINEL foreign customer
const F1 = "b7400000-0000-4000-8000-0000000000f1"; // Toyota Aqua (ACTOR-0001)
const F2 = "b7400000-0000-4000-8000-0000000000f2"; // ZZ-SENTINEL foreign vehicle

const WS_RE = /^ws\.[0-9a-f]{32}$/;
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function requireEnv(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`B7-4 spec: missing required env ${n}`);
  return v;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function countInLog(needle: string): number {
  const s = fs.readFileSync(APP_LOG, "utf8");
  return s.split(needle).length - 1;
}

// Put a value on the macOS clipboard with NO trailing newline (the helper rejects
// any newline byte).
function pbcopy(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("pbcopy", [], { env: CAP_ENV });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`pbcopy exit ${c}`))));
    p.stdin.write(value);
    p.stdin.end();
  });
}

// Orchestrate one capture-evidence.sh invocation end-to-end.
function captureArtifact(kind: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(CAPTURE_SH, [kind, EVID], { cwd: REPO, env: CAP_ENV });
    let buf = "";
    let ready = false;
    let captured = false;
    child.stderr.on("data", (d) => console.log(`  [capture:${kind}:stderr] ${String(d).trim()}`));
    child.stdout.on("data", async (d) => {
      buf += d.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        console.log(`  [capture:${kind}] ${line}`);
        if (line.startsWith("READY:") && !ready) {
          ready = true;
          try {
            await pbcopy(value);
          } catch (e) {
            reject(e);
          }
        } else if (line.startsWith("CAPTURED:")) {
          captured = true;
        }
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 && captured) resolve();
      else reject(new Error(`capture '${kind}' failed: exit=${code} ready=${ready} captured=${captured}`));
    });
  });
}

async function clickNext(page: Page) {
  const next = page.locator("button:visible", { hasText: "次へ" }).first();
  await next.scrollIntoViewIfNeeded();
  await next.click();
}

test("B7-4 canonical scenario A — 7 ordered artifacts, armed, double-dispatch, one save", async ({ page }) => {
  page.on("console", (m) => console.log(`  [browser:${m.type()}] ${m.text()}`));

  // ── Sign in, land on the wizard ───────────────────────────────────────────
  await page.goto("/login?next=/estimates/new");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/estimates\/new/, { timeout: 45_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get("ws"), { timeout: 45_000 }).toMatch(WS_RE);
  const ws = new URL(page.url()).searchParams.get("ws")!;
  console.log(`→ signed in; wizard ws=${ws}`);

  // ── Step 1 — existing customer, EMPTY-query isolation proof ────────────────
  await page.getByRole("button", { name: /既存顧客を検索/ }).click();
  const custSel = page.getByTestId("existing-customer-selector");
  await custSel.waitFor({ state: "visible" });
  // Leave the query completely empty; wait for the full offered pool to render.
  await page.getByTestId(`existing-customer-option-${C1}`).waitFor({ state: "visible", timeout: 20_000 });
  // Exact verify.md §4.1 Stage-1 proof (empty query + non-vacuous isolation).
  await page.evaluate(({ c1, c2 }) => {
    const sel = document.querySelector('[data-testid="existing-customer-selector"]');
    if (!sel) throw new Error("B7-4 BURN: not in existing-customer mode");
    const inputs = sel.querySelectorAll("input");
    if (inputs.length !== 1) throw new Error("B7-4 BURN: expected exactly 1 selector input, got " + inputs.length);
    const q = inputs[0] as HTMLInputElement;
    if (!(q instanceof HTMLInputElement)) throw new Error("B7-4 BURN: selector input is not an HTMLInputElement");
    if (q.value !== "") throw new Error("B7-4 BURN: search query is not empty");
    const opts = [...sel.querySelectorAll('[data-testid^="existing-customer-option-"]')] as HTMLElement[];
    if (opts.length === 0) throw new Error("B7-4 BURN: zero options - vacuous scan");
    if (!opts.some((o) => o.dataset.testid!.endsWith(c1))) throw new Error("B7-4 BURN: actor customer c1 not offered");
    if (opts.some((o) => o.dataset.testid!.endsWith(c2))) throw new Error("B7-4 BURN: foreign customer c2 offered");
    if (/ZZ-SENTINEL-FOREIGN-CUSTOMER/.test(sel.textContent || "")) throw new Error("B7-4 BURN: sentinel text in selector");
    (window as any).__B7_ISO_1 = true;
  }, { c1: C1, c2: C2 });
  console.log("→ Step1 Stage-1 isolation proof passed (empty query)");
  await page.getByTestId(`existing-customer-option-${C1}`).click();
  await expect(page.getByTestId("existing-customer-summary")).toContainText("既存顧客を選択中");
  await expect(page.getByTestId("existing-customer-summary").locator("p")).toContainText(["アクター 太郎"]);
  // Artifact 1/7: customer
  await captureArtifact("customer", "CUSTOMER_OK");

  // ── Step 2 — Stage-2 isolation proof BEFORE selecting the vehicle ──────────
  await clickNext(page);
  const vehSel = page.getByTestId("existing-vehicle-selector");
  await vehSel.waitFor({ state: "visible" });
  await page.getByTestId(`existing-vehicle-option-${F1}`).waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate(({ f1, f2 }) => {
    if ((window as any).__B7_ISO_1 !== true) throw new Error("B7-4 BURN: stage-1 latch missing");
    const sel = document.querySelector('[data-testid="existing-vehicle-selector"]');
    if (!sel) throw new Error("B7-4 BURN: vehicle selector absent");
    const opts = [...sel.querySelectorAll('[data-testid^="existing-vehicle-option-"]')] as HTMLElement[];
    if (!opts.some((o) => o.dataset.testid!.endsWith(f1))) throw new Error("B7-4 BURN: actor vehicle f1 not offered");
    if (opts.some((o) => o.dataset.testid!.endsWith(f2))) throw new Error("B7-4 BURN: foreign vehicle f2 offered");
    if (/ZZ-SENTINEL-MAKER|ZZ-SENTINEL-MODEL|FOREIGN-SENTINEL-PLATE/.test(sel.textContent || ""))
      throw new Error("B7-4 BURN: sentinel text in selector");
    (window as any).__B7_ISO_1 = false; // single-use latch cleared before capture
  }, { f1: F1, f2: F2 });
  console.log("→ Step2 Stage-2 isolation proof passed");
  // Artifact 2/7: isolation
  await captureArtifact("isolation", "ISOLATION_OK");
  // Now select the existing vehicle.
  await page.getByTestId(`existing-vehicle-option-${F1}`).click();
  await expect(page.getByTestId("existing-vehicle-summary")).toContainText("ACTOR-0001");
  // Artifact 3/7: vehicle
  await captureArtifact("vehicle", "VEHICLE_OK");

  // ── Step 3 — category ─────────────────────────────────────────────────────
  await clickNext(page);
  await page.getByRole("button", { name: /ボディ定期メンテナンス/ }).click();

  // ── Step 4 — one manual maintenance line: メンテA @ ¥5000 ──────────────────
  await clickNext(page);
  await page.getByRole("button", { name: /メンテA/ }).click();
  const price = page.locator('input[type="number"]:visible').first();
  await price.waitFor({ state: "visible" });
  await price.fill("5000");
  await expect(price).toHaveValue("5000");
  // Honor the canonical activation step (no-op in the steps host, but harmless).
  const addBtn = page.getByRole("button", { name: /明細に追加 \/ 更新/ });
  if ((await addBtn.count()) > 0 && (await addBtn.first().isEnabled())) {
    await addBtn.first().click();
  }
  console.log("→ Step4 メンテA @5000 activated");

  // ── Steps 5 → 6 → 7 (discount none, notes none, review+save) ───────────────
  await clickNext(page); // → 5
  await clickNext(page); // → 6
  await clickNext(page); // → 7
  await page.getByTestId("wizard-save-panel").waitFor({ state: "visible" });
  await page.getByTestId("save-state-ready").waitFor({ state: "visible", timeout: 45_000 });
  console.log("→ Step7 save panel ready (draft complete ⇒ line activated)");

  // ── Capture ws (4/7) then key (5/7) ───────────────────────────────────────
  expect(new URL(page.url()).searchParams.get("ws")).toBe(ws);
  await captureArtifact("ws", ws);
  const ready = await readRecord(page, ws);
  expect(ready?.status).toBe("ready");
  expect(ready.key).toMatch(KEY_RE);
  const key: string = ready.key;
  await captureArtifact("key", key);

  // ── Armed proof (verify.md §4.6) ──────────────────────────────────────────
  await page.evaluate(({ ws, key }) => {
    const WS = ws, KEY = key;
    if (WS !== (window as any).__B7_WS && new URLSearchParams(location.search).get("ws") !== WS)
      { /* ws consistency checked below */ }
    const r = JSON.parse(sessionStorage.getItem("dealeros.ew.idem.v1:" + WS) || "null");
    if (!r) throw new Error("B7-4 BURN: record missing");
    if (r.v !== 1) throw new Error("B7-4 BURN: record version");
    if (r.status !== "ready") throw new Error("B7-4 BURN: status=" + r.status);
    if (r.key !== KEY) throw new Error("B7-4 BURN: key changed");
    if ("estimateId" in r) throw new Error("B7-4 BURN: already completed");
    if (new URLSearchParams(location.search).get("ws") !== WS) throw new Error("B7-4 BURN: ws changed");
    if (!document.querySelector('[data-testid="save-state-ready"]')) throw new Error("B7-4 BURN: panel not ready");
    if (!document.querySelector('[data-testid="save-submit"]')) throw new Error("B7-4 BURN: save-submit absent");
    if (document.querySelector('[data-testid="save-retry-same-key"]')) throw new Error("B7-4 BURN: a prior save attempt occurred");
    (window as any).__B7_ARMED = true;
  }, { ws, key });
  // Log zero-prior checks (verify.md §4.6 terminal gate).
  expect(countInLog('"stage":"done"'), "prior done events").toBe(0);
  expect(countInLog("B7-4 UI-SAVE"), "prior UI-SAVE markers").toBe(0);
  console.log("→ armed proof passed; zero prior done/markers");
  // Artifact 6/7: armed
  await captureArtifact("armed", "ARMED");
  expect(fs.readFileSync(path.join(EVID, "ui-armed.txt"), "utf8")).toBe("ARMED");

  // ── Marked save window ────────────────────────────────────────────────────
  fs.appendFileSync(APP_LOG, ">>> B7-4 UI-SAVE BEGIN <<<\n");
  expect(countInLog("B7-4 UI-SAVE BEGIN"), "BEGIN count").toBe(1);

  // The canonical intentional same-turn double dispatch.
  await page.evaluate(() => {
    if ((window as any).__B7_ARMED !== true) throw new Error("B7-4 BURN: not armed");
    if (!document.querySelector('[data-testid="save-state-ready"]')) throw new Error("B7-4 BURN: not ready");
    if (document.querySelector('[data-testid="save-retry-same-key"]')) throw new Error("B7-4 BURN: prior attempt");
    const b = document.querySelector('[data-testid="save-submit"]') as HTMLElement;
    if (!b) throw new Error("B7-4 BURN: save-submit absent");
    (window as any).__B7_ARMED = false; // single-use latch cleared before dispatch
    b.click();
    b.click();
  });

  // Exactly one terminal done event (>=2 ⇒ burn).
  await pollDone();

  // Completed redirect + destination identity.
  await page.waitForURL(/\/estimates\/[0-9a-fA-F-]{36}(?:[/?#]|$)/, { timeout: 60_000 });
  const m = page.url().match(/\/estimates\/([0-9a-fA-F-]{36})/);
  expect(m).not.toBeNull();
  const estimateId = m![1];
  const done = await readRecord(page, ws);
  expect(done?.status).toBe("completed");
  expect(done.key).toBe(key);
  expect(done.estimateId).toBe(estimateId);
  expect(estimateId).toMatch(UUID_RE);
  expect(location_path(page)).toBe("/estimates/" + estimateId);
  console.log(`→ SAVED once. estimateId=${estimateId}`);

  // Artifact 7/7: estimate
  await captureArtifact("estimate", estimateId);

  // END marker + final marker requirements.
  fs.appendFileSync(APP_LOG, ">>> B7-4 UI-SAVE END <<<\n");
  expect(countInLog("B7-4 UI-SAVE BEGIN"), "final BEGIN count").toBe(1);
  expect(countInLog("B7-4 UI-SAVE END"), "final END count").toBe(1);
  expect(countInLog('"stage":"done"'), "final done count").toBe(1);
  console.log("→ markers verified: BEGIN=1 END=1 done=1");
});

function location_path(page: Page): string {
  return new URL(page.url()).pathname;
}
async function readRecord(page: Page, ws: string): Promise<any> {
  return page.evaluate((ws) => {
    const raw = sessionStorage.getItem("dealeros.ew.idem.v1:" + ws);
    return raw ? JSON.parse(raw) : null;
  }, ws);
}
async function pollDone() {
  for (let i = 0; i < 240; i++) {
    const d = countInLog('"stage":"done"');
    if (d >= 2) throw new Error(`B7-4 BURN: ${d} done events`);
    if (d === 1) return;
    await sleep(500);
  }
  throw new Error("B7-4 BURN: done timeout");
}
