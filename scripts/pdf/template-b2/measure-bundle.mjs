/* TEMPLATE-B2 — traced production bundle estimate for the estimate PDF function.
 * @vercel/nft over the real renderer module + the vendored design assets + fallback logo.
 * Compares against the standard 250 MB uncompressed Vercel function limit.
 */
import { nodeFileTrace } from "@vercel/nft";
import { statSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
/* Trace the compiled-equivalent entry: the chromium renderer + context builder are plain TS; nft
 * follows the JS dependency graph, so trace the two runtime deps + count repo assets directly. */
const { createRequire } = await import("node:module");
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const entries = [
  requireFromRoot.resolve("puppeteer-core"),
  requireFromRoot.resolve("@sparticuz/chromium"),
];
const { fileList } = await nodeFileTrace(entries, { base: ROOT, processCwd: ROOT });

let depBytes = 0, chromiumBytes = 0, puppeteerBytes = 0;
for (const f of fileList) {
  let s;
  try { s = statSync(path.join(ROOT, f)); } catch { continue; }
  if (!s.isFile()) continue;
  if (f.includes("node_modules/@sparticuz/chromium")) chromiumBytes += s.size;
  else if (f.includes("node_modules/puppeteer-core")) puppeteerBytes += s.size;
  else depBytes += s.size;
}
const dirSize = (d) => {
  let total = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(d);
  return total;
};
const design = dirSize(path.join(ROOT, "src/lib/pdf/design/premium"));
const fallbackLogo = statSync(path.join(ROOT, "public/brand/gyeon-classic/logos/combination.svg")).size;
const total = chromiumBytes + puppeteerBytes + depBytes + design + fallbackLogo;
const MB = (b) => +(b / 1048576).toFixed(2);
console.log(JSON.stringify({
  chromiumMB: MB(chromiumBytes),
  puppeteerMB: MB(puppeteerBytes),
  otherTracedMB: MB(depBytes),
  vendoredDesignMB: MB(design),
  fallbackLogoKB: +(fallbackLogo / 1024).toFixed(1),
  totalMB: MB(total),
  under250MB: total < 250 * 1048576,
}, null, 2));
