// TEMPLATE-B2 — the serverless Chromium runtime behind the accepted HTML document templates.
//
// Proven configuration from the accepted TEMPLATE-B1-R1 foundation:
//  - puppeteer-core + @sparticuz/chromium (Vercel/AWS-compatible fully bundled build), authentic
//    chromium.args, one browser per render (mirrors one render per serverless invocation);
//  - OFFLINE, fail-closed: request interception aborts EVERY http/https request and the render
//    throws if even one was attempted — a remote font, logo, QR, or template reference can never
//    silently satisfy a render;
//  - the vendored template (self-hosted Geist / Noto Sans JP / Noto Serif JP, DOM-measurement
//    pagination, --doc-font-num carrying the accepted B1-R1 Japanese-fallback fix) is loaded via
//    file:// from the traced function bundle;
//  - waits: brand-ready + estimate-pagination-ready + data binding + document.fonts.ready, then
//    prints A4 with printBackground and preferCSSPageSize, exactly as verified in B1-R1.
//
// Local development on non-Linux hosts cannot execute the Lambda Chromium binary; the optional
// PDF_CHROMIUM_EXECUTABLE override points at a locally installed Chromium/Chrome binary instead.
// It changes WHICH browser binary runs — never the offline rules, the template, or the fonts.

import { pathToFileURL } from "node:url";
import path from "node:path";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const TEMPLATE_ROOT = ["src", "lib", "pdf", "design", "premium"];
const RENDER_TIMEOUT_MS = 120_000;

export interface ChromiumRenderRequest {
  /** Template file name inside the vendored design root, e.g. "estimate-a4-compact.html". */
  templateFile: string;
  /** The full injection context assigned to window.__DEALER_OS_DOC_CONTEXT__ before load. */
  context: unknown;
}

async function resolveExecutablePath(): Promise<string> {
  const override = process.env.PDF_CHROMIUM_EXECUTABLE;
  if (override && override.trim()) return override.trim();
  return chromium.executablePath();
}

export async function renderChromiumDocumentPdf(request: ChromiumRenderRequest): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), ...TEMPLATE_ROOT, request.templateFile);
  const url = pathToFileURL(templatePath).href;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1240, height: 1754, deviceScaleFactor: 1 },
    executablePath: await resolveExecutablePath(),
    // The proven B1-R1 mode: chrome-headless-shell ("shell"), matching chromium.headless at runtime.
    headless: "shell",
  });

  try {
    const page = await browser.newPage();

    const outboundAttempts: string[] = [];
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const u = req.url();
      if (u.startsWith("http:") || u.startsWith("https:")) {
        outboundAttempts.push(u);
        req.abort("blockedbyclient").catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });

    await page.evaluateOnNewDocument((ctx) => {
      (window as unknown as { __DEALER_OS_DOC_CONTEXT__: unknown }).__DEALER_OS_DOC_CONTEXT__ = ctx;
    }, request.context);

    await page.goto(url, { waitUntil: "load", timeout: RENDER_TIMEOUT_MS });

    await page.waitForFunction(
      () => {
        const el = document.documentElement;
        return (
          el.classList.contains("brand-ready") &&
          el.classList.contains("estimate-pagination-ready") &&
          (el.hasAttribute("data-doc-data-ready") || el.hasAttribute("data-doc-data-error"))
        );
      },
      { timeout: RENDER_TIMEOUT_MS },
    );

    const bindError = await page.evaluate(() => document.documentElement.getAttribute("data-doc-data-error"));
    if (bindError) {
      throw new Error(`chromium-document: data binding failed closed (${bindError})`);
    }

    await page.evaluate(() => document.fonts.ready.then(() => true));

    if (outboundAttempts.length > 0) {
      throw new Error(
        `chromium-document: offline boundary violated — ${outboundAttempts.length} outbound request(s) attempted`,
      );
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      landscape: false,
    });

    if (outboundAttempts.length > 0) {
      throw new Error(
        `chromium-document: offline boundary violated during print — ${outboundAttempts.length} outbound request(s)`,
      );
    }

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
