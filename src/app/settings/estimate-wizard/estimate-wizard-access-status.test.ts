import assert from "node:assert/strict";
import test from "node:test";

import type { WizardSettingsSectionView } from "@/lib/wizard-catalog/estimate-wizard-settings-types";
import { wizardSectionBadge } from "./estimate-wizard-access-status";

function section(id: WizardSettingsSectionView["id"], itemCount: number): WizardSettingsSectionView {
  return {
    id,
    labelJa: id,
    descriptionJa: "",
    anchorId: `section-${id}`,
    kinds: [],
    groups: [],
    itemCount,
    required: false,
    satisfied: true,
  };
}

test("registered service menus, work presets and shop options render as active", () => {
  const view = {
    sections: [section("service", 1), section("otherwork", 2), section("store", 1)],
  };

  assert.equal(wizardSectionBadge(view, "service"), "solid_active");
  assert.equal(wizardSectionBadge(view, "otherwork"), "solid_active");
  assert.equal(wizardSectionBadge(view, "store"), "solid_active");
});

test("empty or unavailable sections fail closed as unset", () => {
  assert.equal(wizardSectionBadge({ sections: [section("service", 0)] }, "service"), "solid_unset");
  assert.equal(wizardSectionBadge({ sections: [] }, "store"), "solid_unset");
});
