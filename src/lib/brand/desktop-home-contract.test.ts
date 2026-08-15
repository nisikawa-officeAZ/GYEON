import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Contract guard for the static desktop home.
//
// public/desktop-home.html is a GenSpark-generated drop-in: it is replaced as a
// whole file, not patched. Several invariants live inside it that a replacement
// would silently drop. This guard asserts those invariants semantically — never
// by whole-file hash, which would fail on every legitimate revision and be
// disabled within a week.
//
// It reads exactly one file and imports nothing from the app.

const HTML = readFileSync(join(process.cwd(), "public", "desktop-home.html"), "utf8");
const PAGE = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");
const LAYOUT = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
const VARIANT = readFileSync(join(process.cwd(), "src", "lib", "brand", "variant.ts"), "utf8");

// Every image the brand bootstrap owns. Each must be addressable by id, hideable
// by the .app-brand class, and must carry no authored src of any kind.
const APPLICATION_BRAND_IMAGE_IDS = ["brandBadgeImg", "brandHeroLockup"] as const;

// Comments and script string tables legitimately mention GYEON (certification
// tier names, design notes). Only *rendered application-brand* literals are
// forbidden, so each assertion targets a specific rendering site.
const RENDERED_BRAND_LITERALS: ReadonlyArray<[string, RegExp]> = [
  ["document title",        /<title>[^<]*(?:GYEON|Detailer Agent)/],
  ["sidebar wordmark",      /class="brand-name[^"]*">\s*(?:GYEON|DETAILER)/],
  ["sidebar sub-label",     /class="brand-sub[^"]*"[^>]*>\s*DETAILER AGENT/],
  ["topbar wordmark",       /class="topbar-brand-name[^"]*">\s*(?:GYEON|DETAILER)/],
  ["topbar sub-label",      /class="topbar-brand-sub[^"]*"[^>]*>\s*DETAILER AGENT/],
  ["hero product name",     /class="name[^"]*"[^>]*>\s*(?:GYEON|Detailer Agent)/],
  ["footer copyright",      /©\s*(?:GYEON|Detailer Agent)/],
  ["image alt text",        /alt="[^"]*(?:GYEON|Detailer Agent)/],
  ["brand-mark aria-label", /class="brand-mark"[^>]*aria-label="[^"]*(?:GYEON|Detailer Agent)/],
  ["role chip",             />ADMIN · GYEON/],
];

test("empty-src CSS guard for the dealer store logo is present", () => {
  assert.ok(
    HTML.includes('.store-logo-img[src=""]'),
    "the empty-src guard must remain: an empty src resolves to the document URL and paints a broken image",
  );
  assert.ok(HTML.includes(".store-logo-img:not([src])"));
});

test("brand bootstrap marker is present", () => {
  assert.ok(HTML.includes("BRAND-BOOTSTRAP"));
});

test("sidebar badge binding target is present", () => {
  assert.ok(HTML.includes('id="brandBadgeImg"'));
});

test("every brand binding target the bootstrap writes to still exists", () => {
  for (const id of [
    "brandLabelTop",
    "brandLabelBottom",
    "brandLabelTopBar",
    "brandLabelBottomBar",
    "brandRegMark",
    "brandRegMarkBar",
    "brandHeroName",
    "brandFooterName",
  ]) {
    assert.ok(HTML.includes(`id="${id}"`), `missing binding target: ${id}`);
  }
});

test("no rendered application-brand literal is hard-coded", () => {
  for (const [site, pattern] of RENDERED_BRAND_LITERALS) {
    assert.equal(pattern.test(HTML), false, `hard-coded application-brand literal at: ${site}`);
  }
});

test("no hard-coded badge source remains", () => {
  assert.equal(HTML.includes("master-square"), false);
  assert.equal(/<img[^>]*id="brandBadgeImg"[^>]*\ssrc=/.test(HTML), false);
});

test("applyStoreIdentity never writes an empty src", () => {
  assert.equal(/setAttribute\(\s*['"]src['"]\s*,\s*['"]{2}\s*\)/.test(HTML), false);
  assert.equal(/setAttribute\(\s*['"]src['"]\s*,\s*hasLogo\s*\?/.test(HTML), false);
  assert.ok(HTML.includes("logoImg.removeAttribute('src')"));
});

test("the brand bootstrap uses no markup-injection or dynamic-code API", () => {
  for (const api of ["innerHTML", "outerHTML", "document.write", "eval(", "new Function"]) {
    assert.equal(HTML.includes(api), false, `forbidden API present: ${api}`);
  }
});

test("the validator binds showRegisteredMark to the validated variant", () => {
  // A tampered payload must not be able to attach the GYEON trademark to another
  // brand, so the flag is checked for agreement with the variant, not just type.
  assert.ok(
    /showRegisteredMark\s*!==\s*\(\s*p\.variant\s*===\s*'gyeon-classic'\s*\)/.test(HTML),
    "showRegisteredMark must be rejected unless it agrees with the validated variant",
  );
});

test("the root page hard-codes no application-brand literal", () => {
  for (const literal of ["GYEON Detailer Agent", "Detailer Agent"]) {
    assert.equal(
      PAGE.includes(literal),
      false,
      `src/app/page.tsx must not hard-code the product name: ${literal}`,
    );
  }
});

test("the root page title composes as page label plus the shared brand template", () => {
  assert.ok(/from "@\/lib\/brand\/variant"/.test(PAGE), "page must import from the canonical brand module");
  assert.ok(/\bBRAND\b/.test(PAGE), "page must reference BRAND");

  // The page contributes only the bare label. Repeating the product name here
  // would render it twice, because the shared template already appends it.
  const metadata = /export const metadata\s*=\s*\{([^}]*)\}/.exec(PAGE);
  assert.ok(metadata, "the root page must export a metadata object");
  const body = metadata[1];
  assert.ok(/title:\s*"ホーム"/.test(body), 'metadata title must be the bare page label "ホーム"');
  assert.equal(body.includes("|"), false, "page-level metadata must not carry a separator");
  assert.equal(body.includes("BRAND.name"), false, "page-level metadata must not repeat the product name");

  // The product name is owned by the shared template, exactly once.
  assert.ok(
    /template:\s*`%s \| \$\{BRAND\.name\}`/.test(LAYOUT),
    "src/app/layout.tsx must own the `%s | ${BRAND.name}` metadata template",
  );

  // The iframe accessible title is a different surface and still comes from BRAND.
  assert.ok(
    /title=\{\s*BRAND\.name\s*\}/.test(PAGE),
    "the iframe accessible title must be derived from BRAND.name",
  );
});

test("the root page transports the brand payload to the static home", () => {
  assert.ok(PAGE.includes("deriveHomeBrandPayload"), "page must derive the payload from the canonical module");
  assert.ok(/[?&]b=\$\{brandParam\}/.test(PAGE), "payload must travel on the b query parameter");
  assert.ok(PAGE.includes("cert="), "the certification parameter must be preserved");
});

test("every application-brand image is payload-driven and hideable", () => {
  for (const id of APPLICATION_BRAND_IMAGE_IDS) {
    const tag = new RegExp(`<img\\b[^>]*id="${id}"[^>]*>`).exec(HTML);
    assert.ok(tag, `missing application-brand image: ${id}`);
    const el = tag[0];
    assert.ok(/\bclass="[^"]*\bapp-brand\b/.test(el), `${id} must carry the app-brand class so it can be hidden`);
    assert.equal(/\ssrc=/.test(el), false, `${id} must have no authored src; the bootstrap supplies it`);
  }
});

test("the hero lockup is not an inline data image", () => {
  const hero = /<img\b[^>]*id="brandHeroLockup"[^>]*>/.exec(HTML);
  assert.ok(hero, "the hero lockup slot must exist");
  assert.equal(/data:/.test(hero[0]), false, "the hero must not embed an inline data image");
  // No inline data image may sit inside the sidebar brand block either.
  const sidebar = /<div class="brand">[\s\S]*?<\/div>\s*<\/div>/.exec(HTML);
  assert.ok(sidebar);
  assert.equal(/data:image/.test(sidebar[0]), false, "the sidebar brand block must embed no inline image");
});

test("no brand-specific asset path is hard-coded in the static home", () => {
  // The only permitted /brand/ occurrences are the validator's variant-parameterised
  // prefix and the comment naming the canonical module. Neither names a variant.
  for (const variant of ["gyeon-classic", "obsidian"]) {
    assert.equal(
      HTML.includes(`/brand/${variant}/`),
      false,
      `the static home must not hard-code a ${variant} asset path`,
    );
  }
});

test("variant.ts declares an explicit per-variant asset mapping", () => {
  const expected: Record<string, Record<string, string | null>> = {
    obsidian: {
      applicationIcon: "/brand/obsidian/app-icons/master-square.png",
      sidebarBadge:    "/brand/obsidian/app-icons/master-square.png",
      wordmark:        null,
      heroLockup:      "/brand/obsidian/logos/combination.svg",
    },
    "gyeon-classic": {
      applicationIcon: "/brand/gyeon-classic/app-icons/square/icon-1024.png",
      sidebarBadge:    "/brand/gyeon-classic/app-icons/square/icon-1024.png",
      wordmark:        null,
      heroLockup:      "/brand/gyeon-classic/logos/gyeon-wordmark.png",
    },
  };
  for (const [variant, slots] of Object.entries(expected)) {
    for (const [slot, path] of Object.entries(slots)) {
      const pattern = path === null
        ? new RegExp(`${slot}:\\s*null`)
        : new RegExp(`${slot}:\\s*"${path.replace(/[/.]/g, "\\$&")}"`);
      assert.ok(pattern.test(VARIANT), `${variant}.${slot} must resolve to ${path}`);
    }
  }
});

test("no variant references another variant's assets", () => {
  // Split the two config blocks and assert each only ever names its own directory.
  const gyeonStart = VARIANT.indexOf('"gyeon-classic": {');
  assert.ok(gyeonStart > 0, "the gyeon-classic config block must exist");
  const obsidianBlock = VARIANT.slice(VARIANT.indexOf("obsidian: {"), gyeonStart);
  const gyeonBlock    = VARIANT.slice(gyeonStart);
  assert.equal(obsidianBlock.includes("/brand/gyeon-classic/"), false, "obsidian must not reference GYEON assets");
  assert.equal(gyeonBlock.includes("/brand/obsidian/"), false, "gyeon-classic must not reference obsidian assets");
});

test("the default deployment resolves to gyeon-classic", () => {
  assert.ok(
    /raw === undefined \|\| raw === "" \|\| raw === "gyeon-classic"\) return "gyeon-classic"/.test(VARIANT),
    "unset or empty NEXT_PUBLIC_APP_BRAND_VARIANT must resolve to gyeon-classic",
  );
  assert.ok(/if \(raw === "obsidian"\) return "obsidian"/.test(VARIANT));
  assert.ok(/throw new Error\(/.test(VARIANT), "any other value must fail closed");
});

test("no rendered GYEON home slot references a font-dependent SVG", () => {
  // An <img>-referenced SVG is font-sandboxed, so live text falls back to system
  // fonts. Every GYEON slot the home renders must therefore be raster artwork.
  const gyeonBlock = VARIANT.slice(VARIANT.indexOf('"gyeon-classic": {'));
  const assets = /assets:\s*\{([\s\S]*?)\}/.exec(gyeonBlock);
  assert.ok(assets, "the gyeon-classic assets block must exist");
  for (const m of assets[1].matchAll(/"(\/brand\/[^"]+)"/g)) {
    assert.ok(m[1].endsWith(".png"), `rendered GYEON slot must be raster, got ${m[1]}`);
  }
  assert.equal(
    /applicationIcon:\s*"[^"]*master-square\.svg"/.test(gyeonBlock),
    false,
    "the live-text master-square.svg must not be referenced by a rendered slot",
  );
});

test("the restored combination.svg is fully outlined", () => {
  const svg = readFileSync(join(process.cwd(), "public", "brand", "gyeon-classic", "logos", "combination.svg"), "utf8");
  assert.equal(/<text/.test(svg), false, "combination.svg must contain no text node");
  assert.equal(/font-family/.test(svg), false, "combination.svg must declare no font-family");
  assert.ok(/<path/.test(svg), "combination.svg must be path-based");
});

test("the hero label is a short caption, not the full product name", () => {
  for (const variant of ["obsidian", '"gyeon-classic"']) {
    void variant;
  }
  // Both variants caption the hero identically; the lockup image carries the name.
  const labels = [...VARIANT.matchAll(/heroLabel:\s*"([^"]*)"/g)].map(m => m[1]);
  assert.equal(labels.length, 2, "both variants must declare a heroLabel");
  for (const l of labels) {
    assert.equal(l, "DETAILER AGENT");
    assert.equal(/GYEON/.test(l), false, "the hero label must not duplicate GYEON");
  }
  // The payload must carry it, the static home must validate it, and the hero
  // caption must be written from it rather than from the full name.
  assert.ok(/heroLabel:\s*brand\.heroLabel/.test(VARIANT));
  assert.ok(HTML.includes("if (!isText(p.heroLabel)) return null;"), "heroLabel must fail closed");
  assert.ok(/setText\('brandHeroName',\s*p\.heroLabel\)/.test(HTML));
  assert.equal(/setText\('brandHeroName',\s*p\.name\)/.test(HTML), false);
});

test("the full product name still drives the document title and footer", () => {
  assert.ok(/document\.title = p\.name \+ ' \\u2014 Dashboard'/.test(HTML));
  assert.ok(/setText\('brandFooterName',\s*p\.name\)/.test(HTML));
});

test("dealer store logo accessibility label is Japanese", () => {
  // The dealer store logo is a separate surface from application branding, but its
  // accessible label must match the surrounding Japanese interface.
  assert.ok(
    /class="store-logo-img"[^>]*alt="店舗ロゴ"/.test(HTML),
    'the store-logo image must carry alt="店舗ロゴ"',
  );
  assert.equal(/alt="Store logo"/.test(HTML), false, "the English label must not return");
});

test("the payload validator rejects unsafe asset paths", () => {
  // The guard cannot execute the bootstrap, so it asserts the rejection rules
  // are still written. Each check below must survive any file replacement.
  for (const rule of ["'..'", "'%'", "':'", "'?'", "'#'", "'//'"]) {
    assert.ok(HTML.includes(`indexOf(${rule})`), `missing asset-path rejection rule: ${rule}`);
  }
  assert.ok(HTML.includes("'/brand/' + variant + '/'"));
});
