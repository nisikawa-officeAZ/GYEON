import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("settings back control owns the approved UI contract", () => {
  const source = read("src/components/settings/SettingsBackControl.tsx");

  assert.match(source, /ml-auto flex min-h-11 w-fit/);
  assert.match(source, /rounded-xl border border-\[#263955\]/);
  assert.match(source, /text-\[#91b9ff\]/);
  assert.match(source, /<span aria-hidden="true">←<\/span>/);
  assert.match(source, /return <Link className=\{controlClasses\} href=\{href\}>/);
  assert.match(source, /return <button className=\{controlClasses\} type="button"/);
});

test("every settings detail surface uses the shared right-aligned control", () => {
  const targets = [
    "src/app/settings/ai/page.tsx",
    "src/app/settings/business-hours/page.tsx",
    "src/app/settings/estimate-wizard/page.tsx",
    "src/app/settings/estimate-wizard/[panel]/page.tsx",
    "src/app/settings/service-durations/page.tsx",
    "src/app/settings/staff-capacity/page.tsx",
    "src/components/settings/CoatingV34SettingsClient.tsx",
    "src/components/settings/PpfCoatingAdjustmentClient.tsx",
    "src/components/settings/PpfSettingsClient.tsx",
    "src/components/settings/SettingsCategoryNav.tsx",
    "src/components/settings/SettingsCategoryPageView.tsx",
    "src/components/settings/WindowFilmSettingsClient.tsx",
  ];

  for (const target of targets) {
    assert.match(read(target), /SettingsBackControl/, `${target} must use SettingsBackControl`);
  }
});

test("nested settings routes keep deterministic parent destinations", () => {
  assert.match(
    read("src/app/settings/estimate-wizard/[panel]/page.tsx"),
    /href="\/settings\/estimate-wizard" label="見積ウィザード設定へ戻る"/,
  );
  assert.match(
    read("src/components/settings/PpfCoatingAdjustmentClient.tsx"),
    /href="\/settings\/ppf" label="PPF設定へ戻る"/,
  );
  assert.doesNotMatch(
    read("src/app/settings/page.tsx"),
    /SettingsBackControl/,
    "settings root must not show a back control",
  );
});
