// R4Q-R11R — work-order-files private delivery and fail-closed mutation boundary.
//
// Run:
// node --import tsx --test \
//   src/lib/work-order-files/work-order-file-private-boundary.test.ts \
//   src/lib/staff/current-staff-authorization-core.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  toPrivateWorkOrderFileView,
  WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS,
} from "./private-work-order-file-delivery";
import type { WorkOrderFileDB } from "./work-order-file-types";
import { canDeleteData, canEditBusinessData } from "../staff/staff-types";

const UPLOAD_PATH = "src/lib/work-order-files/upload-work-order-file.ts";
const DELETE_PATH = "src/lib/work-order-files/delete-work-order-file.ts";
const GET_PATH = "src/lib/work-order-files/get-work-order-files.ts";
const UPDATE_PATH = "src/lib/work-order-files/update-work-order-file.ts";
const TYPES_PATH = "src/lib/work-order-files/work-order-file-types.ts";
const COMPONENT_PATH = "src/components/work-orders/WorkOrderFiles.tsx";

function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function functionOf(path: string, declaration: string): string {
  const code = codeOf(path);
  const start = code.indexOf(declaration);
  assert.ok(start >= 0, `${declaration} exists`);
  return code.slice(start);
}

test("1. private delivery views omit persistent Storage and publication fields", () => {
  const record: WorkOrderFileDB = {
    id: "file-1",
    dealer_id: "dealer-1",
    work_order_id: "work-order-1",
    file_type: "photo",
    phase: "before",
    title: "Before",
    description: null,
    file_name: "before.jpg",
    file_path: "dealer-1/work-order-1/before/a1_before.jpg",
    file_url: "https://invalid-public-url.example/file.jpg",
    mime_type: "image/jpeg",
    file_size: 123,
    sort_order: 0,
    is_public: true,
    created_at: "2026-08-12T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
  };

  const view = toPrivateWorkOrderFileView(record, "https://signed.example/object?token=one");
  assert.equal(WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS, 300);
  assert.equal(view.delivery_url, "https://signed.example/object?token=one");
  assert.equal("file_path" in view, false);
  assert.equal("file_url" in view, false);
  assert.equal("is_public" in view, false);
  assert.throws(() => toPrivateWorkOrderFileView(record, ""));
});

test("2. upload requires edit before I/O and always persists a private record", () => {
  const upload = functionOf(UPLOAD_PATH, "export async function uploadWorkOrderFile(");
  const gateAt = upload.indexOf('await requireStaffCapability("edit")');
  const clientAt = upload.indexOf("await createClient()");
  const storageAt = upload.indexOf(".upload(storagePath");
  const insertAt = upload.indexOf('.from("work_order_files").insert(');

  assert.ok(gateAt >= 0 && gateAt < clientAt && clientAt < storageAt && storageAt < insertAt);
  assert.match(upload.slice(gateAt, clientAt), /if \("error" in auth\).*auth\.error/);
  assert.equal(upload.includes('formData.get("is_public")'), false);
  assert.equal(upload.includes("getPublicUrl"), false);
  assert.match(upload, /dealer_id:\s*auth\.dealerId/);
  assert.match(upload, /file_url:\s*null/);
  assert.match(upload, /is_public:\s*false/);
});

test("3. metadata failure performs one exact-path admin cleanup and never succeeds", () => {
  const upload = functionOf(UPLOAD_PATH, "export async function uploadWorkOrderFile(");
  const failureAt = upload.indexOf("if (insertError)");
  const successAt = upload.indexOf("return { success: true }");
  const failure = upload.slice(failureAt, successAt);

  const adminAt = failure.indexOf("createAdminClient()");
  const removeAt = failure.indexOf(".remove([storagePath])");
  const checkedAt = failure.indexOf("if (cleanupError)");
  assert.ok(failureAt >= 0 && adminAt >= 0 && adminAt < removeAt && removeAt < checkedAt);
  assert.equal((failure.match(/\.remove\(/g) ?? []).length, 1);
  assert.match(failure, /return \{ error:/);
  assert.equal(failure.includes("return { success: true }"), false);
});

test("4. metadata update requires edit and cannot change publication state", () => {
  const update = functionOf(UPDATE_PATH, "export async function updateWorkOrderFile(");
  const gateAt = update.indexOf('await requireStaffCapability("edit")');
  const clientAt = update.indexOf("await createClient()");
  const writeAt = update.indexOf('.from("work_order_files")');

  assert.ok(gateAt >= 0 && gateAt < clientAt && clientAt < writeAt);
  assert.equal(update.includes("is_public"), false);
  assert.match(update, /\.eq\("dealer_id", auth\.dealerId\)/);
  assert.match(update, /\.select\("id"\)/);
  assert.match(update, /\.maybeSingle\(\)/);
  assert.match(update, /if \(error \|\| !updatedRow\)/);
});

test("5. delete authorization and ownership precede privileged Storage deletion", () => {
  const remove = functionOf(DELETE_PATH, "export async function deleteWorkOrderFile(");
  const gateAt = remove.indexOf('await requireStaffCapability("delete")');
  const clientAt = remove.indexOf("await createClient()");
  const rowAt = remove.indexOf('.from("work_order_files")');
  const adminAt = remove.indexOf("createAdminClient()");
  const storageAt = remove.indexOf(".remove([file.file_path])");
  const metadataAt = remove.indexOf("const { data: deletedRow, error: deleteError }");

  assert.ok(gateAt >= 0 && gateAt < clientAt && clientAt < rowAt);
  assert.ok(rowAt < adminAt && adminAt < storageAt && storageAt < metadataAt);
  assert.match(remove.slice(gateAt, clientAt), /if \("error" in auth\).*auth\.error/);
  assert.match(remove.slice(rowAt, adminAt), /\.eq\("dealer_id", auth\.dealerId\)/);
});

test("6. Storage deletion failure keeps metadata and exact success removes one row", () => {
  const remove = functionOf(DELETE_PATH, "export async function deleteWorkOrderFile(");
  const storageFailureAt = remove.indexOf("if (storageError)");
  const metadataAt = remove.indexOf("const { data: deletedRow, error: deleteError }");
  const failure = remove.slice(storageFailureAt, metadataAt);
  assert.ok(storageFailureAt >= 0 && storageFailureAt < metadataAt);
  assert.match(failure, /return \{ error:/);
  assert.equal(failure.includes('.from("work_order_files").delete()'), false);

  const metadata = remove.slice(metadataAt);
  assert.match(metadata, /\.eq\("id",\s*fileId\)/);
  assert.match(metadata, /\.eq\("dealer_id", auth\.dealerId\)/);
  assert.match(metadata, /\.eq\("file_path", file\.file_path\)/);
  assert.match(metadata, /\.select\("id"\)/);
  assert.match(metadata, /\.maybeSingle\(\)/);
  assert.match(metadata, /if \(deleteError \|\| !deletedRow\)/);
});

test("7. reads create short-lived private URLs and never persist or expose paths", () => {
  const getFiles = functionOf(GET_PATH, "export async function getWorkOrderFiles(");
  const ownerAt = getFiles.indexOf('.from("work_orders")');
  const filesAt = getFiles.indexOf('.from("work_order_files")');
  const signAt = getFiles.indexOf(".createSignedUrl(");
  const mapAt = getFiles.indexOf("toPrivateWorkOrderFileView(");

  assert.ok(ownerAt >= 0 && ownerAt < filesAt && filesAt < signAt && signAt < mapAt);
  assert.match(getFiles, /record\.file_path/);
  assert.match(getFiles, /WORK_ORDER_FILE_SIGNED_URL_TTL_SECONDS/);
  assert.equal(getFiles.includes("getPublicUrl"), false);
  assert.equal(getFiles.includes("createAdminClient"), false);
  assert.equal(/\.insert\(|\.update\(/.test(getFiles), false);
  assert.match(getFiles, /return \{ files: \[\], error: PRIVATE_DELIVERY_ERROR \}/);
});

test("8. the client consumes delivery_url and refreshes only after mutation success", () => {
  // Read the TSX verbatim: MIME accept strings contain `/*`, which are data,
  // not block comments, and must not be stripped by the static source checks.
  const component = readFileSync(COMPONENT_PATH, "utf8");
  assert.match(component, /file\.delivery_url/);
  assert.equal(component.includes("file.file_url"), false);
  assert.match(component, /setFiles\(result\.files\)/);
  assert.match(component, /setActionError\(result\.error\)/);

  for (const declaration of ["function handleDelete(", "function handleUpdate("]) {
    const start = component.indexOf(declaration);
    const next = component.indexOf("\n  function ", start + declaration.length);
    const action = component.slice(start, next >= 0 ? next : undefined);
    const errorAt = action.indexOf("if (result?.error)");
    const refreshAt = action.indexOf("refresh()");
    assert.ok(errorAt >= 0 && errorAt < refreshAt);
    assert.match(action.slice(errorAt, refreshAt), /return;/);
  }

  assert.match(component, /if \(uploadedAny\) onUploadDone\(\)/);
});

test("9. legacy DB shape remains compatible while general updates exclude publication", () => {
  const types = codeOf(TYPES_PATH);
  const dbAt = types.indexOf("export interface WorkOrderFileDB");
  const viewAt = types.indexOf("export type WorkOrderFileView");
  const updateAt = types.indexOf("export type WorkOrderFileUpdateInput");
  const helpersAt = types.indexOf("const FILE_TYPE_LABELS");

  const db = types.slice(dbAt, viewAt);
  const view = types.slice(viewAt, updateAt);
  const update = types.slice(updateAt, helpersAt);
  assert.match(db, /file_url:\s*string \| null/);
  assert.match(db, /is_public:\s*boolean/);
  assert.match(view, /'file_path' \| 'file_url' \| 'is_public'/);
  assert.equal(update.includes("is_public"), false);
});

test("10. accepted edit/delete role boundaries remain unchanged", () => {
  assert.equal(canEditBusinessData("owner"), true);
  assert.equal(canEditBusinessData("manager"), true);
  assert.equal(canEditBusinessData("staff"), true);
  assert.equal(canEditBusinessData("readonly"), false);
  assert.equal(canDeleteData("owner"), true);
  assert.equal(canDeleteData("manager"), true);
  assert.equal(canDeleteData("staff"), false);
  assert.equal(canDeleteData("readonly"), false);
});
