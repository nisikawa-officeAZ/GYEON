import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const action = read("src/lib/customers/legacy-registration/actions.ts");
const page = read("src/app/customers/legacy-registration/page.tsx");
const ui = read("src/components/customers/legacy-registration/LegacyCustomerRegistrationWizard.tsx");
const hub = read("src/app/hub/customers/page.tsx");

test("dedicated route injects every server boundary into the client wizard", () => {
  assert.match(page, /<MainLayout>/);
  assert.match(page, /searchCustomers=\{searchDealerCustomersAction\}/);
  assert.match(page, /loadCustomerVehicles=\{getLegacyCustomerVehiclesAction\}/);
  assert.match(page, /findDuplicates=\{findLegacyRegistrationDuplicatesAction\}/);
  assert.match(page, /saveRegistration=\{registerLegacyCustomerAction\}/);
});

test("hub exposes the dedicated route and does not replace the current shell", () => {
  assert.match(hub, /href: "\/customers\/legacy-registration"/);
  assert.match(page, /@\/components\/layout\/MainLayout/);
  assert.doesNotMatch(ui, /Sidebar|BottomNav|MainLayout/);
});

test("browser receives minimal search and vehicle references, never full table preloads", () => {
  assert.match(action, /select\("id, customer_id, maker, model, plate_number, body_size"\)/);
  assert.match(action, /toCustomerReferences\(customerRows\)/);
  assert.match(action, /toVehicleReferences\(vehicleRows\)/);
  assert.doesNotMatch(page, /getCustomers|getVehicles/);
  assert.doesNotMatch(ui, /CustomerDB|VehicleDB/);
});

test("save uses the authenticated request client and one atomic RPC", () => {
  assert.match(action, /const supabase = await createClient\(\)/);
  assert.match(action, /supabase\.rpc\("register_legacy_customer"/);
  assert.match(action, /validateAndBuildLegacyPayload\(input\)/);
  assert.doesNotMatch(action, /createAdminClient|service_role|SERVICE_ROLE/);
  assert.doesNotMatch(action, /dealerId:\s*validated|createdBy:\s*validated/);
});

test("UI reuses approved OCR upload and human review and does not create commercial documents", () => {
  assert.match(ui, /VehicleRegistrationUpload/);
  assert.match(ui, /VehicleRegistrationOcrReview/);
  assert.match(ui, /mapReviewedOcrToLegacyDraft/);
  assert.match(ui, /見積・請求・施工指示は作成されません/);
  assert.doesNotMatch(action, /createEstimate|createInvoice|createWorkOrder|createPayment/);
});

test("four approved steps and all seven history categories remain present", () => {
  for (const label of ["顧客", "車両", "過去履歴", "確認"]) assert.match(ui, new RegExp(label));
  const core = read("src/lib/customers/legacy-registration/legacy-registration-core.ts");
  for (const category of ["coating", "maintenance", "car_wash", "ppf", "window_film", "room_cleaning", "other"]) {
    assert.match(core, new RegExp(`value: "${category}"`));
  }
});
