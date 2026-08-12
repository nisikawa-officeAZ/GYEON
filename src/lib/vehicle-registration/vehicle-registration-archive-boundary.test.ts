// R4Q-R10R — vehicle-registration archive fail-closed boundary.
//
// Run:
// node --import tsx --test \
//   src/lib/vehicle-registration/vehicle-registration-archive-boundary.test.ts \
//   src/lib/staff/current-staff-authorization-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildVehicleRegistrationArchivePath } from "./archive-path";
import { canDeleteData } from "../staff/staff-types";

const ACTION_PATH = "src/lib/vehicle-registration/actions.ts";
const STORAGE_PATH = "src/lib/vehicle-registration/storage.ts";

function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function archiveAction(): string {
  const code = codeOf(ACTION_PATH);
  const start = code.indexOf("export async function archiveVehicleRegistration(");
  assert.ok(start >= 0, "archive Server Action exists");
  return code.slice(start);
}

test("1. the canonical path maps to the dealer archive prefix", () => {
  assert.deepEqual(
    buildVehicleRegistrationArchivePath(
      "dealer-1",
      "dealer-1/customer-1/vehicle-1/2026-08-12-a1b2c3d4.jpg",
    ),
    {
      success: true,
      archivedPath: "dealer-1/archived/customer-1/vehicle-1/2026-08-12-a1b2c3d4.jpg",
    },
  );
});

test("2. hostile, cross-tenant, and already-archived paths fail closed", () => {
  const hostile = [
    "other-dealer/customer/file.jpg",
    "dealer-1",
    "dealer-1/",
    "dealer-1//file.jpg",
    "dealer-1/./file.jpg",
    "dealer-1/../file.jpg",
    "dealer-1\\customer\\file.jpg",
    "dealer-1/%2e%2e/file.jpg",
    "dealer-1/customer%2Fother/file.jpg",
    "dealer-1/archived/customer/file.jpg",
  ];
  for (const path of hostile) {
    assert.deepEqual(
      buildVehicleRegistrationArchivePath("dealer-1", path),
      { success: false },
      path,
    );
  }

  for (const dealerId of ["", ".", "..", "dealer/1", "dealer\\1", "dealer%2F1"]) {
    assert.deepEqual(
      buildVehicleRegistrationArchivePath(dealerId, `${dealerId}/file.jpg`),
      { success: false },
      dealerId,
    );
  }
});

test("3. the destructive capability remains exactly owner and manager", () => {
  assert.equal(canDeleteData("owner"), true);
  assert.equal(canDeleteData("manager"), true);
  assert.equal(canDeleteData("staff"), false);
  assert.equal(canDeleteData("readonly"), false);
});

test("4. delete authorization is the first action-side I/O boundary", () => {
  const action = archiveAction();
  const gateAt = action.indexOf('await requireStaffCapability("delete")');
  const clientAt = action.indexOf("await createClient()");
  const rowAt = action.indexOf('.from("vehicle_registration_files")');
  const storageAt = action.indexOf("archiveVehicleRegistrationFile(");

  assert.ok(gateAt >= 0, "exact delete gate exists");
  assert.ok(gateAt < clientAt && clientAt < rowAt && rowAt < storageAt,
    "authorization precedes DB and Storage I/O");
  assert.match(action.slice(gateAt, clientAt), /if \("error" in auth\).*auth\.error/);
});

test("5. row lookup and update are bound to the server tenant and exact record", () => {
  const action = archiveAction();
  assert.match(action, /\.select\("id, storage_bucket, storage_path, ocr_status, archived_at"\)/);
  assert.match(action, /\.eq\("dealer_id", auth\.dealerId\)/);
  assert.match(action, /row\.storage_bucket !== VEHICLE_REG_BUCKET/);
  assert.match(action, /row\.archived_at !== null/);
  assert.match(action, /row\.ocr_status === "archived"/);
  assert.match(action, /ファイルが見つからないか、操作できません/);
  const pathValidationAt = action.indexOf("buildVehicleRegistrationArchivePath(");
  const storageMoveAt = action.indexOf("archiveVehicleRegistrationFile(");
  assert.ok(pathValidationAt >= 0 && pathValidationAt < storageMoveAt,
    "the action rejects an invalid DB path before privileged Storage I/O");

  const updateAt = action.indexOf("const { data: updatedRow, error: updateError }");
  const storageAt = action.indexOf("if (!storageResult.success)");
  assert.ok(storageAt >= 0 && updateAt > storageAt, "DB update follows checked Storage success");
  const update = action.slice(updateAt, action.indexOf("if (updateError", updateAt));
  assert.match(update, /storage_path: storageResult\.archivedPath/);
  assert.match(update, /ocr_status: "archived"/);
  assert.match(update, /archived_at: archivedAt/);
  assert.match(update, /\.eq\("id",\s*fileId\)/);
  assert.match(update, /\.eq\("dealer_id", auth\.dealerId\)/);
  assert.match(update, /\.eq\("storage_path", row\.storage_path\)/);
  assert.match(update, /\.is\("archived_at", null\)/);
  assert.match(update, /\.neq\("ocr_status", "archived"\)/);
  assert.match(update, /\.select\("id"\)/);
  assert.match(update, /\.maybeSingle\(\)/);
});

test("6. Storage uses validated server-only moves and never copy/remove", () => {
  const storage = codeOf(STORAGE_PATH);
  assert.match(storage, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin";/);
  assert.equal(storage.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(storage.includes("process.env"), false);
  assert.equal(storage.includes(".copy("), false);
  assert.equal(storage.includes(".remove("), false);

  const archiveStart = storage.indexOf("export async function archiveVehicleRegistrationFile(");
  const restoreStart = storage.indexOf("export async function restoreVehicleRegistrationFile(");
  const archive = storage.slice(archiveStart, restoreStart);
  const restore = storage.slice(restoreStart);

  for (const fn of [archive, restore]) {
    const validationAt = fn.indexOf("buildVehicleRegistrationArchivePath(");
    const adminAt = fn.indexOf("createAdminClient()");
    const moveAt = fn.indexOf(".move(");
    const errorAt = fn.indexOf("if (moveError)");
    assert.ok(validationAt >= 0 && validationAt < adminAt && adminAt < moveAt && moveAt < errorAt,
      "validation, privileged client, move, and error check stay ordered");
    assert.equal((fn.match(/\.move\(/g) ?? []).length, 1, "exactly one move per bounded helper");
  }
  assert.match(restore, /expected\.archivedPath !== archivedPath/);
  assert.match(archive, /return \{ success: true, archivedPath: archivePath\.archivedPath \}/);
});

test("7. DB failure attempts one compensation and never reports success", () => {
  const action = archiveAction();
  const failureAt = action.indexOf("if (updateError || !updatedRow)");
  const auditAt = action.indexOf("await createAuditLog(");
  const failure = action.slice(failureAt, auditAt);
  assert.ok(failureAt >= 0 && auditAt > failureAt, "failure block precedes success audit");
  assert.equal((failure.match(/restoreVehicleRegistrationFile\(/g) ?? []).length, 1);
  assert.match(failure, /if \(!compensation\.success\)/);
  assert.match(failure, /return \{[\s\S]*success: false/);
  assert.match(failure, /アーカイブに失敗しました。時間をおいて再度お試しください。/);
  assert.equal(/moveError\.message|updateError\.message/.test(failure), false,
    "internal operation details are not returned to the client");
});

test("8. success audit occurs only after checked Storage and exact DB success", () => {
  const action = archiveAction();
  const storageSuccessAt = action.indexOf("if (!storageResult.success)");
  const dbSuccessAt = action.indexOf("if (updateError || !updatedRow)");
  const auditAt = action.indexOf("await createAuditLog(");
  const successAt = action.indexOf("return { success: true }", auditAt);
  assert.ok(storageSuccessAt >= 0 && storageSuccessAt < dbSuccessAt && dbSuccessAt < auditAt);
  assert.ok(auditAt < successAt, "success is returned only after the audit call");
});
