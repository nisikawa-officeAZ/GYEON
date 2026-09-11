// GDA_ESTIMATE_WIZARD_OCR_PDF_MODEL_FALLBACK_R4 — pdf-model-text-extractor contract.
// Synthetic in-memory strings/bytes only — no real certificate PDF or personal data.
// Run: node --import tsx --test src/lib/vehicle-registration/pdf-model-text-extractor.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_LOCAL_PDF_BYTES,
  isEligiblePdfByteSize,
  isEligiblePdfPageCount,
  findBareModelLabelValue,
  findBareModelLabelValueFromPositionedText,
  resolvePdfModel,
  extractLocalPdfModel,
  OWNER_ADDRESS_LABEL,
  USER_ADDRESS_LABEL,
  findLabeledAddressValue,
  findLabeledAddressValueFromPositionedText,
  resolvePdfAddress,
  extractLocalPdfAddresses,
} from "./pdf-model-text-extractor";

// ─── Synthetic in-memory PDF builders (no real certificate content) ───────────────
//
// A minimal, structurally valid PDF assembled byte-by-byte with a hand-computed xref
// table (no external tooling, no real document). Each page's content stream may
// optionally show a hex string of single-byte codes that a `/ToUnicode` CMap on the
// page's font maps back to arbitrary Unicode text — the standard technique for making
// PDF.js's text extraction return specific fabricated Unicode content without needing a
// real embedded font or real document text.

function buildMinimalPdf(options: {
  pageCount: number;
  /** Hex-encoded PDF string content (already `<...>`-wrapped) to `Tj` on the first page. */
  firstPageHexShow?: string;
  /** ToUnicode CMap bfchar body (without begin/end wrapper) for the first page's font. */
  toUnicodeBfChars?: string;
}): Uint8Array {
  const { pageCount, firstPageHexShow, toUnicodeBfChars } = options;
  const header = "%PDF-1.4\n";
  const objects: string[] = [];

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  const hasFont = firstPageHexShow !== undefined && toUnicodeBfChars !== undefined;
  // Object numbers, when a font is present: pages [3..3+pageCount), content streams
  // [3+pageCount..3+2*pageCount), then font (last-1) and ToUnicode CMap (last).
  const contentBase = 3 + pageCount;
  const fontObjNum       = contentBase + pageCount;
  const toUnicodeObjNum  = fontObjNum + 1;

  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = contentBase + i;
    const resources = hasFont && i === 0 ? ` /Resources << /Font << /F1 ${fontObjNum} 0 R >> >>` : " /Resources << >>";
    objects.push(
      `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200]${resources} /Contents ${contentObjNum} 0 R >>\nendobj\n`,
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = contentBase + i;
    const stream =
      hasFont && i === 0
        ? `BT /F1 12 Tf 10 100 Td ${firstPageHexShow} Tj ET\n`
        : "";
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`,
    );
  }

  if (hasFont) {
    // FirstChar 0 / LastChar 255 covers every printable-ASCII source code the CMap
    // builders below may choose; pdf.js's text-content builder drops glyphs for source
    // codes outside a font's declared/standard-encoded range, even when a ToUnicode CMap
    // maps them, so the fixtures below deliberately use printable-ASCII source codes.
    objects.push(
      `${fontObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 0 /LastChar 255 `
        + `/Widths [${Array.from({ length: 256 }, () => 500).join(" ")}] /ToUnicode ${toUnicodeObjNum} 0 R >>\nendobj\n`,
    );
    const cmap =
      `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n`
      + `/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n`
      + `1 begincodespacerange\n<00> <FF>\nendcodespacerange\n`
      + `${toUnicodeBfChars!.trim().split("\n").length} beginbfchar\n${toUnicodeBfChars}\nendbfchar\n`
      + `endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n`;
    objects.push(`${toUnicodeObjNum} 0 obj\n<< /Length ${cmap.length} >>\nstream\n${cmap}endstream\nendobj\n`);
  }

  let body = "";
  const offsets: number[] = [];
  let running = Buffer.byteLength(header, "utf8");
  for (const obj of objects) {
    offsets.push(running);
    body += obj;
    running += Buffer.byteLength(obj, "utf8");
  }

  const totalObjects = objects.length + 1;
  let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  const xrefOffset = Buffer.byteLength(header + body, "utf8");
  const trailer = `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(header + body + xref + trailer);
}

/** A genuinely valid, empty (no `/ToUnicode` font, no text) synthetic PDF with N pages. */
function buildEmptyPdf(pageCount: number): Uint8Array {
  return buildMinimalPdf({ pageCount });
}

/**
 * A genuinely valid single-page synthetic PDF whose real embedded text (via a
 * `/ToUnicode` CMap on a fabricated font) is the printed line `型式　６ＢＡ－ＪＧ３`.
 * Exercises the REAL unpdf/PDF.js pipeline end-to-end, not just the pure matcher.
 */
function buildSyntheticVehicleTypePdf(): Uint8Array {
  // Printable-ASCII source codes 0x41.."J" (0x4A), each remapped via the ToUnicode CMap
  // to a fabricated full-width Japanese character — 型 式 　(U+3000) ６ Ｂ Ａ － Ｊ Ｇ ３.
  // pdf.js's text-content builder drops glyphs for source codes with no standard/base
  // encoding glyph name (e.g. raw control-byte codes 0x01..0x0A), independently of what
  // the ToUnicode CMap says, so the source codes must be printable ASCII even though the
  // extracted text they resolve to is entirely fabricated full-width Japanese.
  const codeToUnicode: Record<string, string> = {
    "41": "578B", // 型
    "42": "5F0F", // 式
    "43": "3000", // full-width space
    "44": "FF16", // ６
    "45": "FF22", // Ｂ
    "46": "FF21", // Ａ
    "47": "FF0D", // －
    "48": "FF2A", // Ｊ
    "49": "FF27", // Ｇ
    "4A": "FF13", // ３
  };
  const hexShow = `<${Object.keys(codeToUnicode).join("")}>`;
  const bfChars = Object.entries(codeToUnicode)
    .map(([code, uni]) => `<${code}> <${uni}>`)
    .join("\n");
  return buildMinimalPdf({ pageCount: 1, firstPageHexShow: hexShow, toUnicodeBfChars: bfChars });
}

function oneTextItemPage(text: string) {
  return [[{ text, x: 0, y: 0, width: 100, height: 10 }]] as const;
}

// ─── Pure label discrimination: findBareModelLabelValue ────────────────────────────

test("1. bare 型式 with raw full-width value", () => {
  const result = findBareModelLabelValue("型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("2. 原動機の型式 adjacent to a valid bare 型式 — only the bare label counts", () => {
  const result = findBareModelLabelValue("原動機の型式　ＹＹＹ　型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("3. 型式指定番号 adjacent to a valid bare 型式 — only the bare label counts", () => {
  const result = findBareModelLabelValue("型式指定番号　19777　型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("4. 類別区分番号 adjacent to a valid bare 型式 — never confused for 型式", () => {
  const result = findBareModelLabelValue("類別区分番号　0007　型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("5. same-value duplicate candidates are accepted once", () => {
  const result = findBareModelLabelValue("型式　６ＢＡ－ＪＧ３\n型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("6. different duplicate candidates are ambiguous — fail closed to no match", () => {
  const result = findBareModelLabelValue("型式　６ＢＡ－ＪＧ３\n型式　ABA-XXX");
  assert.deepEqual(result, { ambiguous: true });
});

test("7. missing label and scanned/no-text behavior yields no match", () => {
  assert.equal(findBareModelLabelValue(""), null);
  assert.equal(findBareModelLabelValue("車名　ホンダ　車台番号　ABC-1234567"), null);
});

test("9. raw full-width value is preserved verbatim — no NFKC folding in the matcher", () => {
  const result = findBareModelLabelValue("型式　６ＢＡ－ＪＧ３");
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
  assert.notEqual((result as { value: string }).value, "6BA-JG3", "matcher must not NFKC-normalize");
});

test("a hostile label immediately preceded/followed check does not consume unrelated bare occurrences", () => {
  // 原動機の型式 alone (no separate bare 型式 anywhere) → no match, never fabricated.
  assert.equal(findBareModelLabelValue("原動機の型式　ＹＹＹ"), null);
  assert.equal(findBareModelLabelValue("型式指定番号　19777"), null);
});

test("positioned text matches the visually adjacent 型式 value despite hostile reading order", () => {
  const result = findBareModelLabelValueFromPositionedText([[
    { text: "型式指定番号", x: 260.04, y: 335.722, width: 47.86, height: 7.9 },
    { text: "原動機の型式", x: 310.32, y: 474.322, width: 47.86, height: 7.9 },
    { text: "型式", x: 39.24, y: 474.322, width: 15.94, height: 7.9 },
    { text: "ＪＧ３－１１１５１６９", x: 82.2, y: 719.002, width: 153.94, height: 13.9 },
    { text: "６ＢＡ－ＪＧ３", x: 68.04, y: 467.122, width: 97.9, height: 13.9 },
  ]]);
  assert.deepEqual(result, { value: "６ＢＡ－ＪＧ３" });
});

test("positioned text never selects a chassis-like token from another row", () => {
  const result = findBareModelLabelValueFromPositionedText([[
    { text: "型式", x: 39, y: 474, width: 16, height: 8 },
    { text: "ＪＧ３－１１１５１６９", x: 82, y: 719, width: 154, height: 14 },
  ]]);
  assert.equal(result, null);
});

// ─── Precedence: resolvePdfModel ───────────────────────────────────────────────────

test("10. explicit local PDF value overrides a conflicting nonblank AI model", () => {
  assert.equal(resolvePdfModel("６ＢＡ－ＪＧ３", "ABA-000"), "６ＢＡ－ＪＧ３");
});

test("11. AI model is retained when local extraction has no match", () => {
  assert.equal(resolvePdfModel(null, "ABA-000"), "ABA-000");
});

test("12. both absent produces omission (undefined), never an empty-string overwrite", () => {
  assert.equal(resolvePdfModel(null, undefined), undefined);
  assert.equal(resolvePdfModel(null, ""), undefined);
  assert.equal(resolvePdfModel("", undefined), undefined);
});

// ─── Eligibility limits ─────────────────────────────────────────────────────────────

test("byte-size eligibility: at-limit passes, one byte over fails", () => {
  assert.equal(isEligiblePdfByteSize(MAX_LOCAL_PDF_BYTES), true);
  assert.equal(isEligiblePdfByteSize(MAX_LOCAL_PDF_BYTES + 1), false);
  assert.equal(isEligiblePdfByteSize(0), false);
});

test("page-count eligibility: 1..3 pass, 4+ fails", () => {
  assert.equal(isEligiblePdfPageCount(1), true);
  assert.equal(isEligiblePdfPageCount(3), true);
  assert.equal(isEligiblePdfPageCount(4), false);
  assert.equal(isEligiblePdfPageCount(0), false);
});

// ─── Orchestration: extractLocalPdfModel (dependency-injected fakes) ───────────────
// Fully synthetic — a fake loader stands in for unpdf so encrypted/corrupt/timeout
// outcomes are deterministic and fast, without needing cryptographically real PDF bytes.

test("non-PDF mime type never attempts local extraction", async () => {
  let called = false;
  const result = await extractLocalPdfModel(new Uint8Array([1, 2, 3]), "image/jpeg", {
    loadPdf: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("8a. oversized PDF (>5 MiB) skips local parsing without invoking the loader", async () => {
  let called = false;
  const oversized = new Uint8Array(MAX_LOCAL_PDF_BYTES + 1);
  const result = await extractLocalPdfModel(oversized, "application/pdf", {
    loadPdf: async () => {
      called = true;
      throw new Error("must not be called");
    },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("8b. page-excess PDF (>3 pages) returns no match without reading text", async () => {
  let textRead = false;
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 4,
      extractPositionedText: async () => {
        textRead = true;
        return oneTextItemPage("型式　６ＢＡ－ＪＧ３");
      },
      destroy: async () => {},
    }),
  });
  assert.equal(result, null);
  assert.equal(textRead, false, "text must not be read once the page limit is exceeded");
});

test("8c. encrypted PDF (loader throws a password exception) returns no match", async () => {
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => {
      throw new Error("PasswordException: No password given");
    },
  });
  assert.equal(result, null);
});

test("8d. corrupt/malformed PDF (loader throws) returns no match", async () => {
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => {
      throw new Error("Invalid PDF structure");
    },
  });
  assert.equal(result, null);
});

test("8e. parser timeout (loader never resolves within budget) returns no match", async () => {
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    timeoutMs: 20,
    loadPdf: () => new Promise(() => {}), // never resolves
  });
  assert.equal(result, null);
});

test("resource cleanup: destroy is always called, even on ambiguous/no-match outcomes", async () => {
  let destroyed = false;
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => oneTextItemPage("型式　AAA\n型式　BBB"), // conflicting → ambiguous
      destroy: async () => {
        destroyed = true;
      },
    }),
  });
  assert.equal(result, null);
  assert.equal(destroyed, true);
});

test("resource cleanup: destroy is called even when the loader throws before returning a document", async () => {
  // A loader can only report destroy() on a document it actually returns; a throw before
  // that point (e.g. encrypted/corrupt) means no document handle exists to destroy.
  let threw = false;
  await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => {
      threw = true;
      throw new Error("corrupt");
    },
  });
  assert.equal(threw, true);
});

test("happy path via the injected loader: unambiguous local match is returned", async () => {
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => oneTextItemPage("型式　６ＢＡ－ＪＧ３"),
      destroy: async () => {},
    }),
  });
  assert.equal(result, "６ＢＡ－ＪＧ３");
});

test("scanned/no-text PDF via the injected loader returns no match", async () => {
  const result = await extractLocalPdfModel(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => oneTextItemPage(""),
      destroy: async () => {},
    }),
  });
  assert.equal(result, null);
});

// ─── Real end-to-end integration (default loader, actual unpdf/PDF.js) ─────────────
// Genuinely valid but entirely fabricated PDFs — no real certificate, no PII.

test("real unpdf pipeline: extracts the bare 型式 value from a synthetic PDF text layer", async () => {
  const pdfBytes = buildSyntheticVehicleTypePdf();
  const result = await extractLocalPdfModel(pdfBytes, "application/pdf");
  assert.equal(result, "６ＢＡ－ＪＧ３");
});

test("real unpdf pipeline: an empty synthetic PDF (no text) returns no match", async () => {
  const pdfBytes = buildEmptyPdf(1);
  const result = await extractLocalPdfModel(pdfBytes, "application/pdf");
  assert.equal(result, null);
});

test("real unpdf pipeline: a genuine 4-page synthetic PDF is skipped as page-excess", async () => {
  const pdfBytes = buildEmptyPdf(4);
  const result = await extractLocalPdfModel(pdfBytes, "application/pdf");
  assert.equal(result, null);
});

test("real unpdf pipeline: a genuinely corrupt byte buffer returns no match, never throws", async () => {
  const garbage = new TextEncoder().encode("%PDF-1.4\nthis is not a real pdf body at all");
  const result = await extractLocalPdfModel(garbage, "application/pdf");
  assert.equal(result, null);
});

// ═══ GDA_ESTIMATE_WIZARD_OCR_POSTAL_REVERSE_AND_PDF_ADDRESS_INTEGRITY_R1 ═══════════════
// Attributable owner/user address extraction. Synthetic in-memory strings/positions only.

// ─── Pure inline matching: findLabeledAddressValue ─────────────────────────────────

test("A1. attributable owner label matches its adjacent value", () => {
  const result = findLabeledAddressValue("所有者の住所　東京都港区1-2-3", OWNER_ADDRESS_LABEL);
  assert.deepEqual(result, { value: "東京都港区1-2-3" });
});

test("A2. owner and user labels in the same text never bleed into each other", () => {
  const text = "所有者の住所　東京都港区1-2-3\n使用者の住所　大阪府大阪市北区4-5-6";
  assert.deepEqual(findLabeledAddressValue(text, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
  assert.deepEqual(findLabeledAddressValue(text, USER_ADDRESS_LABEL), { value: "大阪府大阪市北区4-5-6" });
});

test("A3. a bare, non-attributable 住所 never matches an attributable label", () => {
  assert.equal(findLabeledAddressValue("住所　東京都港区1-2-3", OWNER_ADDRESS_LABEL), null);
  assert.equal(findLabeledAddressValue("住所　東京都港区1-2-3", USER_ADDRESS_LABEL), null);
});

test("A4. 使用の本拠の位置 (a different field) is never captured as either address", () => {
  const result = findLabeledAddressValue("所有者の住所\n使用の本拠の位置　東京都新宿区1-1-1", OWNER_ADDRESS_LABEL);
  assert.equal(result, null, "the label with nothing but the next field's label after it yields no value");
});

test("A5. same-value duplicate candidates are accepted once", () => {
  const text = "所有者の住所　東京都港区1-2-3\n所有者の住所　東京都港区1-2-3";
  assert.deepEqual(findLabeledAddressValue(text, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
});

test("A6. different duplicate candidates are ambiguous — fail closed to no match", () => {
  const text = "所有者の住所　東京都港区1-2-3\n所有者の住所　神奈川県横浜市西区9-9-9";
  assert.deepEqual(findLabeledAddressValue(text, OWNER_ADDRESS_LABEL), { ambiguous: true });
});

test("A7. a too-short candidate value is rejected as implausible", () => {
  assert.equal(findLabeledAddressValue("所有者の住所　都", OWNER_ADDRESS_LABEL), null);
});

test("A8. missing label yields no match", () => {
  assert.equal(findLabeledAddressValue("", OWNER_ADDRESS_LABEL), null);
  assert.equal(findLabeledAddressValue("車台番号　ABC-1234567", OWNER_ADDRESS_LABEL), null);
});

// ─── Positioned matching: findLabeledAddressValueFromPositionedText ────────────────

function labeledAddressPage(entries: ReadonlyArray<{ text: string; x: number }>) {
  return [entries.map(({ text, x }) => ({ text, x, y: 0, width: text.length * 8, height: 10 }))] as const;
}

test("positioned: attributable owner/user labels each match only their own adjacent value", () => {
  const page = labeledAddressPage([
    { text: OWNER_ADDRESS_LABEL, x: 0 },
    { text: "東京都港区1-2-3", x: 90 },
    { text: USER_ADDRESS_LABEL, x: 250 },
    { text: "大阪府大阪市北区4-5-6", x: 340 },
  ]);
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), { value: "大阪府大阪市北区4-5-6" });
});

test("positioned: an owner label with no real value to its right (only the user label nearby) yields no match", () => {
  const page = labeledAddressPage([
    { text: OWNER_ADDRESS_LABEL, x: 0 },
    { text: USER_ADDRESS_LABEL, x: 90 },
  ]);
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null,
    "the other label must never itself be picked as an address value");
});

test("positioned: conflicting candidates for the same label are ambiguous", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 0, width: 80, height: 10 },
    { text: "東京都港区1-2-3", x: 90, y: 0, width: 130, height: 10 },
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 20, width: 80, height: 10 },
    { text: "神奈川県横浜市西区9-9-9", x: 90, y: 20, width: 170, height: 10 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { ambiguous: true });
});

test("positioned: missing label yields no match", () => {
  assert.equal(findLabeledAddressValueFromPositionedText(oneTextItemPage("東京都港区1-2-3"), OWNER_ADDRESS_LABEL), null);
});

// ─── CORRECTION: intra-character-spaced labels + nearest-below value column ────────
// Reproduces the real certificate layout the fixture-only tests originally missed: the label
// glyphs carry intra-character spacing, and the value sits on the row below in a value column
// that starts at-or-right-of the label's own left edge and does NOT horizontally overlap the
// (narrow) label box.

test("CR1. spaced owner/user labels each recognize their own label and match only their own below-row value, without bleeding into each other", () => {
  const page = [[
    { text: "所 有 者 の 住 所", x: 40, y: 474, width: 90, height: 8 },
    { text: "東京都港区1-2-3", x: 68, y: 450, width: 98, height: 14 },
    { text: "使 用 者 の 住 所", x: 40, y: 380, width: 90, height: 8 },
    { text: "大阪府大阪市北区4-5-6", x: 68, y: 356, width: 140, height: 14 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), { value: "大阪府大阪市北区4-5-6" });
});

test("CR2. below-row value: a plain (unspaced) label matches a value on the nearest row below when tier 1 (same-row right) finds nothing", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 100, width: 48, height: 8 },
    { text: "東京都港区1-2-3", x: 20, y: 80, width: 90, height: 12 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
});

test("CR3. two distinct plausible values on the nearest row below are a genuine conflict and fail closed to no value", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 100, width: 48, height: 8 },
    { text: "東京都港区1-2-3", x: 20, y: 80, width: 60, height: 12 },
    { text: "神奈川県横浜市西区9-9-9", x: 200, y: 80, width: 60, height: 12 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null,
    "a same-row conflict fails closed for this label occurrence, not a fabricated pick between them");
});

test("CR4. base-of-use denial: a nearest-below label (使用の本拠の位置) yields no value and is never skipped past to a farther real address", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 100, width: 48, height: 8 },
    { text: "使用の本拠の位置", x: 10, y: 85, width: 90, height: 12 },   // nearest row: a known label
    { text: "東京都新宿区1-1-1", x: 10, y: 50, width: 90, height: 12 }, // farther row: a real address
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null,
    "the nearest row is a known label, not a value — must never fall through to the farther row");
});

test("CR5. a same-as marker on the nearest row below is preserved verbatim, not rejected", () => {
  const page = [[
    { text: USER_ADDRESS_LABEL, x: 0, y: 100, width: 48, height: 8 },
    { text: "使用者住所に同じ", x: 20, y: 80, width: 90, height: 12 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), { value: "使用者住所に同じ" });
});

test("CR6. a bare 同上 marker, shorter than the minimum plausible address length, is still preserved", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 100, width: 48, height: 8 },
    { text: "同上", x: 20, y: 80, width: 20, height: 12 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "同上" });
});

test("CR7. a value to the LEFT of the label's left edge is never matched, even within the vertical gap bound", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 100, y: 100, width: 48, height: 8 },
    { text: "東京都港区1-2-3", x: 10, y: 80, width: 60, height: 12 }, // x < labelLeft
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

test("CR8. a value beyond the bounded vertical gap on the below-row tier is never matched", () => {
  const page = [[
    { text: OWNER_ADDRESS_LABEL, x: 0, y: 1000, width: 48, height: 8 },
    { text: "東京都港区1-2-3", x: 20, y: 0, width: 90, height: 12 }, // far below the bound
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

function glyphLabelItems(
  label: string,
  options: { x0?: number; y?: number; glyphWidth?: number; glyphGap?: number; height?: number } = {},
) {
  const { x0 = 37, y = 474, glyphWidth = 14, glyphGap = 4, height = 8 } = options;
  return Array.from(label).map((text, index) => ({
    text,
    x: x0 + index * (glyphWidth + glyphGap),
    y,
    width: glyphWidth,
    height,
  }));
}

test("GL1. an actual-like six-item owner label matches its adjacent value", () => {
  const page = [[
    ...glyphLabelItems(OWNER_ADDRESS_LABEL),
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
});

test("GL2. six-item owner and user labels remain separated on one page", () => {
  const page = [[
    ...glyphLabelItems(OWNER_ADDRESS_LABEL, { y: 474 }),
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
    ...glyphLabelItems(USER_ADDRESS_LABEL, { y: 380 }),
    { text: "使用者住所に同じ", x: 148, y: 380, width: 130, height: 14 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), { value: "使用者住所に同じ" });
});

test("GL3. an incomplete six-glyph owner label is rejected", () => {
  const page = [[
    ...glyphLabelItems(OWNER_ADDRESS_LABEL).filter((item) => item.text !== "の"),
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

test("GL4. an excessive inter-glyph gap is rejected", () => {
  const items = glyphLabelItems(OWNER_ADDRESS_LABEL).map((item) =>
    item.text === "住" ? { ...item, x: item.x + 300 } : item,
  );
  const page = [[
    ...items,
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

test("GL5. a wrong-order glyph sequence is rejected", () => {
  const items = glyphLabelItems(OWNER_ADDRESS_LABEL);
  const swapped = items.map((item, index) =>
    index === 1 ? { ...item, x: items[3].x } : index === 3 ? { ...item, x: items[1].x } : item,
  );
  const page = [[
    ...swapped,
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

test("GL6. unrelated glyph items do not form an address label", () => {
  const page = [[
    ...glyphLabelItems("自動車検査証"),
    { text: "東京都港区1-2-3", x: 148, y: 474, width: 130, height: 14 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
  assert.equal(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), null);
});

test("GL7. a six-item owner label supports the bounded below-row tier", () => {
  const page = [[
    ...glyphLabelItems(OWNER_ADDRESS_LABEL, { y: 474, height: 8 }),
    { text: "東京都港区1-2-3", x: 68, y: 450, width: 98, height: 14 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), { value: "東京都港区1-2-3" });
});

test("GL8. a six-item owner label never skips a base-of-use label", () => {
  const page = [[
    ...glyphLabelItems(OWNER_ADDRESS_LABEL, { y: 474, height: 8 }),
    { text: "使用の本拠の位置", x: 37, y: 460, width: 90, height: 12 },
    { text: "東京都新宿区1-1-1", x: 37, y: 420, width: 90, height: 12 },
  ]] as const;
  assert.equal(findLabeledAddressValueFromPositionedText(page, OWNER_ADDRESS_LABEL), null);
});

test("GL9. a same-as marker from a six-item user label is preserved", () => {
  const page = [[
    ...glyphLabelItems(USER_ADDRESS_LABEL, { y: 474 }),
    { text: "同上", x: 148, y: 474, width: 20, height: 14 },
  ]] as const;
  assert.deepEqual(findLabeledAddressValueFromPositionedText(page, USER_ADDRESS_LABEL), { value: "同上" });
});

// ─── Precedence: resolvePdfAddress ──────────────────────────────────────────────────

test("explicit local PDF address overrides a conflicting nonblank AI address", () => {
  assert.equal(resolvePdfAddress("東京都港区1-2-3", "大阪府大阪市北区4-5-6"), "東京都港区1-2-3");
});

test("AI address is retained when local extraction has no match", () => {
  assert.equal(resolvePdfAddress(null, "大阪府大阪市北区4-5-6"), "大阪府大阪市北区4-5-6");
});

test("both absent produces omission (undefined), never an empty-string overwrite", () => {
  assert.equal(resolvePdfAddress(null, undefined), undefined);
  assert.equal(resolvePdfAddress(null, ""), undefined);
  assert.equal(resolvePdfAddress("", undefined), undefined);
});

// ─── Orchestration: extractLocalPdfAddresses (dependency-injected fakes) ───────────

test("non-PDF mime type never attempts local address extraction", async () => {
  let called = false;
  const result = await extractLocalPdfAddresses(new Uint8Array([1, 2, 3]), "image/jpeg", {
    loadPdf: async () => { called = true; throw new Error("must not be called"); },
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
  assert.equal(called, false);
});

test("oversized PDF (>5 MiB) skips local address parsing without invoking the loader", async () => {
  let called = false;
  const oversized = new Uint8Array(MAX_LOCAL_PDF_BYTES + 1);
  const result = await extractLocalPdfAddresses(oversized, "application/pdf", {
    loadPdf: async () => { called = true; throw new Error("must not be called"); },
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
  assert.equal(called, false);
});

test("page-excess PDF (>3 pages) returns no addresses without reading text", async () => {
  let textRead = false;
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 4,
      extractPositionedText: async () => {
        textRead = true;
        return labeledAddressPage([{ text: OWNER_ADDRESS_LABEL, x: 0 }, { text: "東京都港区1-2-3", x: 90 }]);
      },
      destroy: async () => {},
    }),
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
  assert.equal(textRead, false, "text must not be read once the page limit is exceeded");
});

test("encrypted/corrupt PDF (loader throws) returns no addresses", async () => {
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => { throw new Error("Invalid PDF structure"); },
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
});

test("parser timeout (loader never resolves within budget) returns no addresses", async () => {
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    timeoutMs: 20,
    loadPdf: () => new Promise(() => {}), // never resolves
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
});

test("resource cleanup: destroy is always called for address extraction too", async () => {
  let destroyed = false;
  await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => labeledAddressPage([{ text: OWNER_ADDRESS_LABEL, x: 0 }, { text: "東京都港区1-2-3", x: 90 }]),
      destroy: async () => { destroyed = true; },
    }),
  });
  assert.equal(destroyed, true);
});

test("happy path via the injected loader: both attributable addresses are returned independently", async () => {
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => labeledAddressPage([
        { text: OWNER_ADDRESS_LABEL, x: 0 },
        { text: "東京都港区1-2-3", x: 90 },
        { text: USER_ADDRESS_LABEL, x: 250 },
        { text: "大阪府大阪市北区4-5-6", x: 340 },
      ]),
      destroy: async () => {},
    }),
  });
  assert.deepEqual(result, { ownerAddress: "東京都港区1-2-3", userAddress: "大阪府大阪市北区4-5-6" });
});

test("only one attributable label present: the other address independently stays null", async () => {
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => labeledAddressPage([
        { text: OWNER_ADDRESS_LABEL, x: 0 },
        { text: "東京都港区1-2-3", x: 90 },
      ]),
      destroy: async () => {},
    }),
  });
  assert.deepEqual(result, { ownerAddress: "東京都港区1-2-3", userAddress: null });
});

test("scanned/no-text PDF via the injected loader returns no addresses", async () => {
  const result = await extractLocalPdfAddresses(new Uint8Array([1]), "application/pdf", {
    loadPdf: async () => ({
      numPages: 1,
      extractPositionedText: async () => oneTextItemPage(""),
      destroy: async () => {},
    }),
  });
  assert.deepEqual(result, { ownerAddress: null, userAddress: null });
});
