import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDealerApprovalSubscriptionState } from "./dealer-approval-mode";

test("normal dealer approval keeps the requested plan and active trial", () => {
  assert.deepEqual(
    buildDealerApprovalSubscriptionState({
      mode: "trial",
      requestedPlan: "pro",
      serviceStartDate: "2026-09-14",
      trialEndDate: "2026-10-14",
    }),
    {
      plan: "pro",
      subscription_status: "trial",
      trial_plan_type: "pro",
      trial_start_date: "2026-09-14",
      trial_end_date: "2026-10-14",
      trial_status: "active",
      auto_downgrade_plan_type: "basic",
    },
  );
});

test("operator approval is always permanent active Pro+ without a trial", () => {
  assert.deepEqual(
    buildDealerApprovalSubscriptionState({
      mode: "permanent_pro_plus",
      requestedPlan: "basic",
      serviceStartDate: "2026-09-14",
      trialEndDate: "2026-10-14",
    }),
    {
      plan: "pro_plus",
      subscription_status: "active",
      trial_plan_type: "pro_plus",
      trial_start_date: null,
      trial_end_date: null,
      trial_status: "none",
      auto_downgrade_plan_type: "basic",
    },
  );
});

test("permanent Pro+ approval is protected by server and UI Super Admin gates", () => {
  const action = readFileSync("src/lib/admin/approve-dealer.ts", "utf8");
  const ui = readFileSync("src/app/admin/dealers/DealersAdminClient.tsx", "utf8");

  assert.match(
    action,
    /approvalMode === "permanent_pro_plus"[\s\S]*await requireSuperAdmin\(\)/,
  );
  assert.match(ui, /allowPermanent=\{isSuperAdmin\}/);
  assert.match(ui, /allowPermanent && \([\s\S]*setApprovalMode\("permanent_pro_plus"\)/);
});
