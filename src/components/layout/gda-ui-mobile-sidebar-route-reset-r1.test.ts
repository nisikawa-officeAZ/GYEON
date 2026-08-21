// GDA_UI_MOBILE_SIDEBAR_ROUTE_RESET_R1 regression contract: on mobile
// (<768px) the off-canvas drawer must never re-enter the viewport after a
// route navigation. Two independent mechanisms close it:
//   1. Sidebar closes immediately on category Link click, before navigation.
//   2. MainLayoutClient (the `open` state owner) closes on every pathname
//      change, so the drawer resets even if a navigation is triggered by any
//      path other than a rendered Sidebar Link.
//
// Run: node --import tsx --test src/components/layout/gda-ui-mobile-sidebar-route-reset-r1.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("MainLayoutClient closes the drawer on every pathname change", () => {
  const code = strip(read("src/components/layout/MainLayoutClient.tsx"));

  assert.match(code, /import\s*\{\s*usePathname\s*\}\s*from\s*"next\/navigation";/);
  assert.match(code, /const\s*\[open,\s*setOpen\]\s*=\s*useState\(false\);/);
  assert.match(code, /const\s*pathname\s*=\s*usePathname\(\);/);

  const effectAt = code.search(/useEffect\(\(\)\s*=>\s*\{\s*setOpen\(false\);\s*\},\s*\[pathname\]\);/);
  assert.ok(effectAt >= 0, "a useEffect keyed on [pathname] must call setOpen(false)");

  const openDeclAt = code.indexOf("const [open, setOpen] = useState(false);");
  const pathnameDeclAt = code.indexOf("const pathname = usePathname();");
  assert.ok(pathnameDeclAt > openDeclAt, "pathname must be read after open state is declared");
  assert.ok(effectAt > pathnameDeclAt, "the route-reset effect must be declared after pathname is read");
});

test("Sidebar closes the drawer immediately on category Link click", () => {
  const code = strip(read("src/components/Sidebar.tsx"));

  const linkAt = code.indexOf("<Link key={category.id}");
  assert.ok(linkAt >= 0, "the category Link must exist");

  const linkCloseAt = code.indexOf(">", code.indexOf("aria-current={active ? \"page\" : undefined}", linkAt));
  const linkTag = code.slice(linkAt, linkCloseAt);
  assert.match(linkTag, /onClick=\{onClose\}/, "every available category Link must call onClose on click");
});

test("Sidebar no longer owns a redundant prevPathname route-close effect", () => {
  const code = strip(read("src/components/Sidebar.tsx"));

  assert.doesNotMatch(code, /prevPathname/, "the prevPathname ref-based close effect was removed in favor of the parent-owned pathname effect");
  assert.doesNotMatch(code, /useRef/, "useRef is no longer needed in Sidebar after removing prevPathname");
});
