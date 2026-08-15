// TEMPLATE-C2-DN — the delivery-note PDF route's auth/tenant/no-persistence guarantees + shared header safety.
//
// Run: node --import tsx --test src/app/pdf/estimate/route.test.ts
//
// The header helpers live in `pdf-response-headers.ts`, which imports nothing
// and is therefore EXECUTED here against real inputs — header construction is
// the part that must be proved by behaviour, not by a regex over its own source.
// The route handler itself pulls in `@/lib/pdf/brand-profile` (`server-only`,
// unresolvable under this runner), so its auth / tenant / body-byte guarantees
// are asserted from source text.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sanitizePdfBasename, buildPdfFilename, encodeRfc5987, toAsciiFilename,
  buildContentDisposition, isDownloadRequested, resolveDisposition,
  FALLBACK_PDF_BASENAME,
} from "../estimate/pdf-response-headers";

const ROUTE_SRC = "src/app/pdf/delivery-note/route.ts";
const codeOf = (p: string): string =>
  readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Parse the two parameters back out of a Content-Disposition value. */
function parseDisposition(header: string) {
  const token = header.slice(0, header.indexOf(";"));
  const ascii = /filename="([^"]*)"/.exec(header)?.[1] ?? null;
  const starred = /filename\*=UTF-8''(.*)$/.exec(header)?.[1] ?? null;
  return { token, ascii, starred };
}

// ── 1-2. `download` is honoured only for the exact literal "1" ─────────────

test("1. download=1 is the ONLY value that yields attachment", () => {
  assert.equal(isDownloadRequested("1"), true);
  assert.equal(resolveDisposition("1"), "attachment");
});

test("2. absent, empty, true, 0 and every other value stay inline", () => {
  for (const raw of [null, "", "0", "true", "TRUE", "yes", "01", "1 ", " 1", "2", "on", "attachment"]) {
    assert.equal(isDownloadRequested(raw), false, `"${String(raw)}" must not trigger a download`);
    assert.equal(resolveDisposition(raw), "inline", `"${String(raw)}" must stay inline`);
  }
});

// ── 3-6. Sanitization, executed ────────────────────────────────────────────

test("3. CR/LF injection is stripped — no header can be split", () => {
  assert.equal(sanitizePdfBasename("EST\r\n-1"), "EST-1");
  const injected = buildContentDisposition("attachment", 'x"\r\nSet-Cookie: a=b');
  for (const bad of ["\r", "\n"]) {
    assert.equal(injected.includes(bad), false, `header still contains ${JSON.stringify(bad)}`);
  }
  assert.equal(injected.includes("Set-Cookie"), true, "…the text survives, inert, as part of the name");
  assert.equal(parseDisposition(injected).ascii?.includes('"'), false);
});

test("4. quotes and backslashes are stripped — the quoted-string cannot be closed", () => {
  assert.equal(sanitizePdfBasename('EST"1'), "EST1");
  assert.equal(sanitizePdfBasename("EST\\1"), "EST1");
  const h = buildContentDisposition("inline", 'a"b\\c');
  assert.equal(parseDisposition(h).ascii, "abc.pdf");
});

test("5. C0 controls, DEL and C1 controls are stripped", () => {
  assert.equal(sanitizePdfBasename("A\u0000B\u001FC"), "ABC");
  assert.equal(sanitizePdfBasename("A\u007FB"), "AB");
  assert.equal(sanitizePdfBasename("A\u0085B\u009FC"), "ABC", "C1 range (incl. NEL)");
  // Nothing in the emitted header is a control character.
  const h = buildContentDisposition("attachment", "A\u0000\u0085\u009FB");
  assert.equal(/[\u0000-\u001F\u007F-\u009F]/.test(h), false);
});

test("6. an empty or all-stripped number falls back, and never yields an empty filename", () => {
  for (const raw of [null, undefined, "", "   ", '"""', "\r\n", "\u0000\u007F"]) {
    assert.equal(sanitizePdfBasename(raw), FALLBACK_PDF_BASENAME, `"${String(raw)}" must fall back`);
    assert.equal(buildPdfFilename(raw), "estimate.pdf");
  }
  assert.notEqual(parseDisposition(buildContentDisposition("inline", "")).ascii, "");
});

// ── 7. Exactly one extension ───────────────────────────────────────────────

test("7. exactly one trailing lowercase .pdf, whatever the input carries", () => {
  // Single-extension and fallback vectors — unchanged, must stay green.
  assert.equal(buildPdfFilename("EST-2026-0001"), "EST-2026-0001.pdf");
  assert.equal(buildPdfFilename("EST-2026-0001.pdf"), "EST-2026-0001.pdf", "no .pdf.pdf");
  assert.equal(buildPdfFilename("EST-2026-0001.PDF"), "EST-2026-0001.pdf", "case-insensitive");
  assert.equal(buildPdfFilename(".pdf"), "estimate.pdf", "an extension alone is not a name");

  // R90E regression — EVERY repeated trailing extension is consumed.
  assert.equal(buildPdfFilename("EST-1.pdf.pdf"), "EST-1.pdf");
  assert.equal(buildPdfFilename("EST-1.PDF.pdf"), "EST-1.pdf");
  assert.equal(buildPdfFilename("EST-1.pdf.PDF.pdf"), "EST-1.pdf");
  assert.equal(buildPdfFilename("x.pdf.pdf.pdf.pdf"), "x.pdf");

  // The extension that survives is always a single lowercase `.pdf`.
  for (const raw of [
    "EST-1", "EST-1.pdf", "見積-1", null,
    "EST-1.pdf.pdf", "EST-1.PDF.pdf", "EST-1.pdf.PDF.pdf", "x.pdf.pdf.pdf.pdf",
  ]) {
    const out = buildPdfFilename(raw);
    assert.equal((out.match(/\.pdf/gi) ?? []).length, 1, `${String(raw)} → ${out}`);
    assert.match(out, /\.pdf$/, `${out} must end in a lowercase .pdf`);
    assert.equal(out.endsWith(".PDF"), false);
  }
});

// ── 8-10. RFC 5987 ─────────────────────────────────────────────────────────

test("8. apostrophe, parentheses and asterisk are percent-encoded", () => {
  // encodeURIComponent alone leaves all four literal — that is the bug this covers.
  assert.equal(encodeURIComponent("'()*").includes("'"), true, "PRECONDITION: the naive encoder leaks");
  assert.equal(encodeRfc5987("'()*"), "%27%28%29%2A");
  const h = buildContentDisposition("attachment", "O'Brien (v2)*");
  const { starred } = parseDisposition(h);
  for (const bad of ["'", "(", ")", "*"]) {
    assert.equal(starred?.includes(bad), false, `filename* still contains a literal ${bad}`);
  }
});

test("9. percent is encoded and the value round-trips exactly", () => {
  assert.equal(encodeRfc5987("100%"), "100%25");
  for (const name of ["見積-2026-0001", "O'Brien (v2)*.pdf", "a b%c", "EST-1"]) {
    const { starred } = parseDisposition(buildContentDisposition("inline", name));
    assert.equal(decodeURIComponent(starred ?? ""), buildPdfFilename(name), `round-trip failed for ${name}`);
  }
});

test("10. a Japanese name keeps a NON-EMPTY ASCII fallback and an exact filename*", () => {
  const h = buildContentDisposition("attachment", "見積-2026-0001");
  const { token, ascii, starred } = parseDisposition(h);
  assert.equal(token, "attachment");
  assert.ok(ascii && ascii.length > 0, "the ASCII fallback must not be empty");
  assert.equal(/^[\x20-\x7e]*$/.test(ascii ?? ""), true, "the ASCII fallback must be ASCII-only");
  assert.equal(ascii, "__-2026-0001.pdf", "one underscore per non-ASCII character");
  assert.equal(decodeURIComponent(starred ?? ""), "見積-2026-0001.pdf");
  assert.equal(toAsciiFilename("見積.pdf"), "__.pdf");
});

// ── 11-12. Disposition shape ───────────────────────────────────────────────

test("11. both parameters are always emitted, in both modes", () => {
  for (const mode of ["inline", "attachment"] as const) {
    const h = buildContentDisposition(mode, "EST-1");
    assert.match(h, /^(inline|attachment); filename="[\x20-\x7e]*"; filename\*=UTF-8''/);
    assert.equal(parseDisposition(h).token, mode);
  }
});

test("12. inline and attachment differ ONLY in the leading token", () => {
  const inline = buildContentDisposition("inline", "見積-1");
  const attach = buildContentDisposition("attachment", "見積-1");
  assert.equal(inline.replace(/^inline/, ""), attach.replace(/^attachment/, ""));
});

// ── 13-17. Route guarantees (source) ───────────────────────────────────────

test("13. the route uses the shared pure header helpers rather than its own copy", () => {
  const code = codeOf(ROUTE_SRC);
  assert.match(code, /from "\.\.\/estimate\/pdf-response-headers"/);
  assert.match(code, /resolveDisposition\(req\.nextUrl\.searchParams\.get\("download"\)\)/);
  assert.match(code, /buildContentDisposition\(disposition, deliveryNumber\)/);
  // the printed number is derived from the invoice number, never a raw filename header
  assert.match(code, /deliveryNumberFromInvoiceNumber\(resolved\.invoice\.invoice_number\)/);
  for (const gone of ["safePdfFilename", "encodeURIComponent(", "\\x20-\\x7e"]) {
    assert.equal(code.includes(gone), false, `the route still defines ${gone}`);
  }
});

test("14. authentication precedes the invoice read; the dealer is session-resolved", () => {
  const code = codeOf(ROUTE_SRC);
  assert.match(code, /if \(!dealer\) return new Response\("Unauthorized", \{ status: 401 \}\);/);
  const dealerCall = code.indexOf("await getCurrentDealer()");
  const dataCall = code.indexOf("await getDeliveryNotePdfData(dealer.dealer_id, invoiceId)");
  assert.ok(dealerCall >= 0 && dataCall > dealerCall, "the dealer is resolved first");
  assert.ok(code.indexOf("status: 401") < dataCall, "401 precedes any invoice read");
  // the query is scoped by the SESSION dealer, never a client-supplied one
  assert.ok(!/searchParams\.get\(\s*["\x27`]dealer/i.test(code), "no client dealer id");
});

test("15. the PDF BYTES are identical in both modes — one render, one body", () => {
  const code = codeOf(ROUTE_SRC);
  assert.equal((code.match(/renderDeliveryNoteDocumentPdf\(/g) ?? []).length, 1, "one render call");
  assert.equal((code.match(/new Response\(new Uint8Array\(buffer\)/g) ?? []).length, 1, "one body");
  assert.ok(
    code.indexOf("buffer = await renderDeliveryNoteDocumentPdf") < code.indexOf("resolveDisposition("),
    "the disposition is chosen after the render",
  );
});

test("16. Content-Type and Cache-Control are unchanged", () => {
  const code = codeOf(ROUTE_SRC);
  assert.match(code, /"Content-Type": "application\/pdf"/);
  assert.match(code, /"Cache-Control": "no-store"/);
  assert.equal((code.match(/"Content-Type":/g) ?? []).length, 1);
});

test("17. no Storage write and no documents-bucket dependency", () => {
  const code = codeOf(ROUTE_SRC);
  for (const forbidden of [
    "generate-pdf-and-upload", "generateAndUploadPdf", ".storage", "documents",
    "createSignedUrl", "upload(", "createAdminClient",
  ]) {
    assert.equal(code.includes(forbidden), false, `the route references ${forbidden}`);
  }
  // The helper module is pure: no imports at all.
  assert.equal(/^import\s/m.test(codeOf("src/app/pdf/estimate/pdf-response-headers.ts")), false);
});
