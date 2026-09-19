import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const PAGE = readFileSync("src/app/completion-reports/page.tsx", "utf8");
const SECTION = readFileSync(
  "src/components/completion-reports/CompletionReportSection.tsx",
  "utf8",
);

test("completion reports page gives metadata and document actions independent responsive rows", () => {
  assert.equal(PAGE.includes("max-w-lg"), false);
  assert.match(PAGE, /max-w-5xl/);
  assert.match(PAGE, /grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(PAGE, /break-words text-sm font-medium text-\[#edf3fc\]/);
  assert.match(PAGE, /sm:col-span-2 xl:col-span-1/);
  assert.match(PAGE, /\/pdf\/work-report\?reportId=/);
  assert.match(PAGE, /InstallationCertificateR1Actions/);
});

test("embedded completion report actions stack on narrow screens without overlap", () => {
  assert.match(SECTION, /grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(SECTION, /sm:flex-row sm:items-center sm:justify-between/);
  assert.match(SECTION, /flex w-full flex-wrap gap-2 sm:w-auto/);
  assert.match(SECTION, /whitespace-nowrap/);
  assert.match(SECTION, /InstallationCertificateR1Actions/);
});
