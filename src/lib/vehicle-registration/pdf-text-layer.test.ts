// PDF text-layer extraction contract (selectable 車検証 PDFs).
// Run: node --import tsx --test src/lib/vehicle-registration/pdf-text-layer.test.ts
//
// Every value below is SYNTHETIC. The PDFs are generated in memory by this file (no binary fixture),
// contain no owner data, plate, VIN or any real certificate value, and are never written to disk.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyPdfTextLayerCertificateFields,
  extractCertificateCodesFromLines,
  extractCertificateCodesFromPdf,
  extractCertificateCodesFromPdfBase64,
  extractCertificateCodesFromItems,
  groupPdfTextItemsIntoLines,
  PDF_TEXT_LAYER_LIMITS,
  PDF_TWO_ROW_GEOMETRY,
  type PdfTextItemLike,
} from "./pdf-text-layer";
import { applyVehicleIdentityPolicy, sanitizeVehicleRegistrationOcrResult } from "./ocr";

// Synthetic certificate codes (Owner-approved examples; deliberately not real vehicles).
const CERT_TYPE      = "6BA-ABC1"; // 型式
const ENGINE_TYPE    = "XYZ1";     // 原動機の型式
const TYPE_APPROVAL  = "12345";    // 型式指定番号
const CLASSIFICATION = "0007";     // 類別区分番号 (leading zero must survive)

// ─── Synthetic PDF builder (in memory, Identity-H + ToUnicode, no embedded font) ────────────────

interface SyntheticTextOp { x: number; y: number; text: string; size?: number }

function utf16Hex(text: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0");
  return hex;
}

function pdfStream(dict: string, data: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(`<< ${dict} /Length ${data.byteLength} >>\nstream\n`, "latin1"),
    data,
    Buffer.from("\nendstream", "latin1"),
  ]);
}

/** Builds a small multi-page PDF whose text is a real text layer (or an image-only page). */
function buildSyntheticPdf(pages: Array<{ text?: SyntheticTextOp[]; image?: boolean }>): Buffer {
  const objects: Buffer[] = [];
  const add = (body: Buffer | string): number => {
    objects.push(typeof body === "string" ? Buffer.from(body, "latin1") : body);
    return objects.length; // 1-based object number
  };

  add("<< /Type /Catalog /Pages 2 0 R >>");              // 1
  add("<< /Type /Pages /Kids [] /Count 0 >>");           // 2 (patched below)
  const toUnicode = add(pdfStream("", Buffer.from([
    "/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap",
    "/CMapName /SyntheticToUnicode def",
    "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange",
    "1 beginbfrange", "<0020> <FFEF> <0020>", "endbfrange",
    "endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end",
  ].join("\n"), "latin1")));
  const descriptor = add("<< /Type /FontDescriptor /FontName /SyntheticCJK /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>");
  const cidFont = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SyntheticCJK /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 >>`);
  const font = add(`<< /Type /Font /Subtype /Type0 /BaseFont /SyntheticCJK /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${toUnicode} 0 R >>`);

  const pageNumbers: number[] = [];
  for (const page of pages) {
    const ops: string[] = [];
    let xobject = "";
    if (page.image) {
      const image = add(pdfStream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray /BitsPerComponent 8", Buffer.from([0x80])));
      xobject = ` /XObject << /Im1 ${image} 0 R >>`;
      ops.push("q 400 0 0 500 100 200 cm /Im1 Do Q");
    }
    for (const op of page.text ?? []) {
      ops.push(`BT /F1 ${op.size ?? 10} Tf 1 0 0 1 ${op.x} ${op.y} Tm <${utf16Hex(op.text)}> Tj ET`);
    }
    const contents = add(pdfStream("", Buffer.from(ops.join("\n"), "latin1")));
    pageNumbers.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >>${xobject} >> /Contents ${contents} 0 R >>`));
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNumbers.length} >>`, "latin1");

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [];
  let length = parts[0].byteLength;
  objects.forEach((body, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk);
    length += chunk.byteLength;
  });
  const xref = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `,
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    `trailer`, `<< /Size ${objects.length + 1} /Root 1 0 R >>`, `startxref`, `${length}`, `%%EOF`, ``].join("\n");
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

const toBytes = (b: Buffer): Uint8Array => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);

// Row layout: label, then its value, on the same visual line — as printed by a certificate PDF export.
const KEI_ROWS: SyntheticTextOp[] = [
  { x: 40,  y: 780, text: "自動車検査証（合成テスト）" },
  { x: 40,  y: 740, text: "型式" },        { x: 90,  y: 740, text: CERT_TYPE },
  { x: 260, y: 740, text: "原動機の型式" }, { x: 340, y: 740, text: ENGINE_TYPE },
  { x: 40,  y: 700, text: "型式指定番号" }, { x: 120, y: 700, text: TYPE_APPROVAL },
  { x: 260, y: 700, text: "類別区分番号" }, { x: 340, y: 700, text: CLASSIFICATION },
];

// ─── Pure: line reconstruction ─────────────────────────────────────────────────

test("adjacent split text items are glued, word gaps keep a separator, and lines are ordered top-to-bottom", () => {
  const items: PdfTextItemLike[] = [
    { str: "原動機の型式", x: 40, y: 700, width: 60, height: 10 }, { str: ENGINE_TYPE, x: 120, y: 700, width: 40, height: 10 },
    { str: "型式", x: 40, y: 740, width: 20, height: 10 },
    { str: "6BA-", x: 80, y: 740.4, width: 40, height: 10 },  // split item, sub-point baseline jitter
    { str: "ABC1", x: 120, y: 740, width: 40, height: 10 },   // glued: gap 0
  ];
  assert.deepEqual(groupPdfTextItemsIntoLines(items), ["型式 6BA-ABC1", `原動機の型式 ${ENGINE_TYPE}`]);

  // Without geometry (no width) items are never glued — a split value then fails the shape check.
  const noWidth = groupPdfTextItemsIntoLines([{ str: "6BA-", x: 80, y: 740 }, { str: "ABC1", x: 120, y: 740 }, { str: "型式", x: 40, y: 740 }]);
  assert.deepEqual(noWidth, ["型式 6BA- ABC1"]);
  assert.equal(extractCertificateCodesFromLines(noWidth).fields.model, undefined);

  // Item bound is enforced (no unbounded processing) and blanks are ignored.
  const bounded = groupPdfTextItemsIntoLines([{ str: " ", x: 0, y: 900 }, { str: "a", x: 0, y: 800 }, { str: "b", x: 0, y: 700 }, { str: "c", x: 0, y: 600 }], { maxItems: 2 });
  assert.deepEqual(bounded, ["a", "b"]);
  assert.deepEqual(groupPdfTextItemsIntoLines([]), []);
});

// ─── Pure: label-anchored extraction ──────────────────────────────────────────

test("kei row layout yields all four codes with the 類別区分番号 leading zero preserved", () => {
  const r = extractCertificateCodesFromLines([
    "自動車検査証",
    `型式 ${CERT_TYPE} 原動機の型式 ${ENGINE_TYPE}`,
    `型式指定番号 ${TYPE_APPROVAL} 類別区分番号 ${CLASSIFICATION}`,
  ]);
  assert.equal(r.status, "extracted");
  assert.deepEqual(r.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.equal(typeof r.fields.classification_number, "string");
  assert.deepEqual(r.notices, []);
  assert.equal(r.lineCount, 3);
});

test("letter-spaced labels, colons, missing spaces and full-width codes are all anchored and folded", () => {
  const spaced = extractCertificateCodesFromLines([`型 式 : ${CERT_TYPE}　原 動 機 の 型 式：${ENGINE_TYPE}`]);
  assert.deepEqual(spaced.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE });

  const packed = extractCertificateCodesFromLines([`型式指定番号${TYPE_APPROVAL}類別区分番号${CLASSIFICATION}`]);
  assert.deepEqual(packed.fields, { model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });

  const fullWidth = extractCertificateCodesFromLines([
    "型式　６ＢＡ－ＡＢＣ１　原動機の型式　ＸＹＺ１",
    "型式指定番号　１２３４５　類別区分番号　０００７",
  ]);
  assert.deepEqual(fullWidth.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
});

test("plain string lines (no geometry) never pair a label row with the next row; only the item path may", () => {
  const r = extractCertificateCodesFromLines([
    "型式 原動機の型式 型式指定番号 類別区分番号",
    `${CERT_TYPE} ${ENGINE_TYPE} ${TYPE_APPROVAL} ${CLASSIFICATION}`,
  ]);
  assert.equal(r.status, "no_codes");
  assert.deepEqual(r.fields, {});
});

test("ambiguous or conflicting matches are rejected with a notice instead of guessing", () => {
  // Two different 型式 values on page 1 → 型式 dropped; the unambiguous codes are still extracted.
  const twoModels = extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`, "型式 6BA-ABC2", `型式指定番号 ${TYPE_APPROVAL}`]);
  assert.equal(twoModels.fields.model, undefined);
  assert.equal(twoModels.fields.model_code, TYPE_APPROVAL);
  assert.ok(twoModels.notices.some((n) => n.includes(CERT_TYPE) && n.includes("6BA-ABC2") && n.includes("型式")));

  // The same value repeated under the same label is not a conflict.
  const repeated = extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`, `型式 ${CERT_TYPE}`]);
  assert.equal(repeated.fields.model, CERT_TYPE);

  // Same value under 型式 and 原動機の型式 → both dropped, never "pick one".
  const same = extractCertificateCodesFromLines([`型式 ${ENGINE_TYPE} 原動機の型式 ${ENGINE_TYPE}`]);
  assert.equal(same.fields.model, undefined);
  assert.equal(same.fields.engine_model, undefined);
  assert.equal(same.status, "no_codes");
  assert.ok(same.notices.some((n) => n.includes(ENGINE_TYPE)));

  // Shape violations: digits-only 型式, letters in 型式指定番号 / 類別区分番号 → not extracted, notice.
  const shapes = extractCertificateCodesFromLines([`型式 ${TYPE_APPROVAL}`, "型式指定番号 AB12", "類別区分番号 12-3"]);
  assert.deepEqual(shapes.fields, {});
  assert.equal(shapes.notices.length, 3);

  // A hyphen-less, label-anchored 型式 distinct from the engine code is accepted from the text layer.
  const bare = extractCertificateCodesFromLines([`型式 XYZ9 原動機の型式 ${ENGINE_TYPE}`]);
  assert.deepEqual(bare.fields, { model: "XYZ9", engine_model: ENGINE_TYPE });

  // Placeholder dashes (blank columns on imports) are ignored silently; non-code text yields nothing.
  const dashes = extractCertificateCodesFromLines(["型式指定番号 - 類別区分番号 ー", "型式 不明"]);
  assert.equal(dashes.status, "no_codes");
  assert.deepEqual(dashes.notices, []);

  // Nothing at all → no_text.
  assert.equal(extractCertificateCodesFromLines([]).status, "no_text");
  assert.equal(extractCertificateCodesFromLines(["", "  "]).status, "no_text");
});

test("F2: a same-row code glued to trailing text (synthetic 改 suffix) is never truncated — the whole field fails closed with a notice", () => {
  // "6BA-ABC1改" must NOT become 6BA-ABC1. The unaffected labels on the same page are still extracted.
  const suffixed = extractCertificateCodesFromLines([`型式 6BA-ABC1改 原動機の型式 ${ENGINE_TYPE}`, `型式指定番号 ${TYPE_APPROVAL}`]);
  assert.equal(suffixed.fields.model, undefined);
  assert.deepEqual(suffixed.fields, { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL });
  assert.equal(suffixed.notices.length, 1);
  assert.ok(suffixed.notices[0].includes("6BA-ABC1改") && suffixed.notices[0].includes("型式は自動取得しませんでした"), suffixed.notices[0]);
  assert.ok(!suffixed.notices[0].includes("原動機の型式は"));

  // The block covers the whole page: a clean repetition elsewhere does not rescue the truncated value.
  const mixed = extractCertificateCodesFromLines(["型式 6BA-ABC1改", `型式 ${CERT_TYPE}`]);
  assert.equal(mixed.fields.model, undefined);
  assert.equal(mixed.status, "no_codes");
  assert.ok(mixed.notices.some((n) => n.includes("6BA-ABC1改")));

  // Full-width suffix / bracketed suffix / suffix on the other code fields fail closed the same way.
  assert.equal(extractCertificateCodesFromLines(["型式　６ＢＡ－ＡＢＣ１改"]).fields.model, undefined);
  assert.equal(extractCertificateCodesFromLines([`型式 ${CERT_TYPE}(改)`]).fields.model, undefined);
  const engine = extractCertificateCodesFromLines([`原動機の型式 ${ENGINE_TYPE}改`]);
  assert.deepEqual(engine.fields, {});
  assert.ok(engine.notices.some((n) => n.includes(`${ENGINE_TYPE}改`) && n.includes("原動機の型式は自動取得しませんでした")));

  // Unchanged: whitespace, end of line, a colon-separated value and a directly following LABEL still pass.
  assert.deepEqual(extractCertificateCodesFromLines([`型式:${CERT_TYPE}原動機の型式:${ENGINE_TYPE}`]).fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE });
  assert.deepEqual(extractCertificateCodesFromLines([`型式指定番号${TYPE_APPROVAL}類別区分番号${CLASSIFICATION}`]).fields, { model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.deepEqual(extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`]).fields, { model: CERT_TYPE });
});

test("R2-1: a separate 改 modification mark directly after a same-row code rejects that field whole — never its leading code", () => {
  // "型式 6BA-ABC1 改": the mark is its own token (pdf.js split it off with a gap wider than the glue threshold).
  const spaced = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改 原動機の型式 ${ENGINE_TYPE}`, `型式指定番号 ${TYPE_APPROVAL}`]);
  assert.equal(spaced.fields.model, undefined);
  assert.deepEqual(spaced.fields, { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL });
  assert.equal(spaced.notices.length, 1);
  assert.ok(spaced.notices[0].includes(`${CERT_TYPE} 改`) && spaced.notices[0].includes("型式は自動取得しませんでした"), spaced.notices[0]);
  assert.ok(spaced.notices[0].startsWith("【要手入力：型式】"), spaced.notices[0]);
  assert.ok(!spaced.notices[0].includes("原動機の型式は"));
  assert.deepEqual(Object.keys(spaced.rejected), ["model"]);
  assert.equal(spaced.rejected.model, spaced.notices[0]);

  // Bracketed / full-width marks, a mark at the end of the line, a mark glued to the NEXT label, and a mark on the other code fields.
  assert.equal(extractCertificateCodesFromLines([`型式 ${CERT_TYPE} (改)`]).fields.model, undefined);
  assert.equal(extractCertificateCodesFromLines(["型式　６ＢＡ－ＡＢＣ１　改"]).fields.model, undefined);
  assert.equal(extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改`]).status, "no_codes");
  const gluedToLabel = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改原動機の型式 ${ENGINE_TYPE}`]);
  assert.deepEqual(gluedToLabel.fields, { engine_model: ENGINE_TYPE });
  const engine = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 原動機の型式 ${ENGINE_TYPE} 改`]);
  assert.deepEqual(engine.fields, { model: CERT_TYPE });          // the mark follows the ENGINE code, not 型式
  assert.deepEqual(Object.keys(engine.rejected), ["engine_model"]);
  const classification = extractCertificateCodesFromLines([`型式指定番号 ${TYPE_APPROVAL} 類別区分番号 ${CLASSIFICATION} 改`]);
  assert.deepEqual(classification.fields, { model_code: TYPE_APPROVAL });
  assert.deepEqual(Object.keys(classification.rejected), ["classification_number"]);

  // The whole page stays blocked for that field: a clean repetition elsewhere does not rescue it.
  const mixed = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改`, `型式 ${CERT_TYPE}`]);
  assert.equal(mixed.fields.model, undefined);
  assert.equal(mixed.status, "no_codes");

  // Negative controls — an unrelated 改 never blocks: on another line, after remark text on the same
  // line, or before the label instead of after the code.
  const otherLine = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 原動機の型式 ${ENGINE_TYPE}`, "改", `型式指定番号 ${TYPE_APPROVAL} 類別区分番号 ${CLASSIFICATION}`]);
  assert.deepEqual(otherLine.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.deepEqual(otherLine.notices, []);
  assert.deepEqual(otherLine.rejected, {});
  const remark = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 備考 改`]);
  assert.deepEqual(remark.fields, { model: CERT_TYPE });
  assert.deepEqual(remark.notices, []);
  const before = extractCertificateCodesFromLines([`改 型式 ${CERT_TYPE}`]);
  assert.deepEqual(before.fields, { model: CERT_TYPE });
  assert.deepEqual(before.notices, []);
});

test("R2-1 (items): a 改 item split from the same-row code by more than the glue threshold still rejects 型式; a 改 on another row does not", () => {
  const row = (extra: PdfTextItemLike[]): PdfTextItemLike[] => [
    { str: "型式",         x: 40,  y: 740, width: 20, height: 10 }, { str: CERT_TYPE,   x: 90,  y: 740, width: 80, height: 10 },
    { str: "原動機の型式", x: 300, y: 740, width: 60, height: 10 }, { str: ENGINE_TYPE, x: 380, y: 740, width: 40, height: 10 },
    ...extra,
  ];
  // Gap 15pt (code ends at 170, mark at 185) ≫ glue threshold 1.5pt → separate token, still the value's own mark.
  const spacedItems = row([{ str: "改", x: 185, y: 740, width: 10, height: 10 }]);
  assert.deepEqual(groupPdfTextItemsIntoLines(spacedItems), [`型式 ${CERT_TYPE} 改 原動機の型式 ${ENGINE_TYPE}`]);
  const spaced = extractCertificateCodesFromItems(spacedItems);
  assert.deepEqual(spaced.fields, { engine_model: ENGINE_TYPE });
  assert.deepEqual(Object.keys(spaced.rejected), ["model"]);
  assert.ok(spaced.notices.some((n) => n.includes(`${CERT_TYPE} 改`) && n.includes("型式は自動取得しませんでした")), spaced.notices.join(" | "));

  // Glued (gap 0) keeps the original F2 outcome.
  const glued = extractCertificateCodesFromItems(row([{ str: "改", x: 170, y: 740, width: 10, height: 10 }]));
  assert.deepEqual(glued.fields, { engine_model: ENGINE_TYPE });
  assert.ok(glued.notices.some((n) => n.includes(`${CERT_TYPE}改`)));

  // A 改 on the row below (an unrelated remark) blocks nothing — same-row labels are never re-paired downward.
  const below = extractCertificateCodesFromItems(row([{ str: "改", x: 90, y: 720, width: 10, height: 10 }]));
  assert.deepEqual(below.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE });
  assert.deepEqual(below.notices, []);
  assert.deepEqual(below.rejected, {});
});

// ─── Pure: override of the AI result ──────────────────────────────────────────

test("text-layer codes override ONLY the four certificate fields; owner, 車名 and グレード are untouched", () => {
  const extraction = extractCertificateCodesFromLines([
    `型式 ${CERT_TYPE} 原動機の型式 ${ENGINE_TYPE}`, `型式指定番号 ${TYPE_APPROVAL} 類別区分番号 ${CLASSIFICATION}`,
  ]);
  // AI output reproducing the reported kei failure: 型式 lost, engine code in グレード and 型式指定番号.
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    owner_name: "合成 名義", user_name: "合成 名義", owner_address: "合成県合成市1-1",
    vehicle_name: "ホンダ", maker: "ホンダ", grade: ENGINE_TYPE, model_code: ENGINE_TYPE, engine_model: ENGINE_TYPE,
    license_plate_class: "580",
  });
  const before = { ...sanitized };
  const outcome = applyPdfTextLayerCertificateFields(sanitized, extraction);
  assert.deepEqual(outcome.applied, ["model", "engine_model", "model_code", "classification_number"]);
  assert.equal(outcome.trustedModel, true);
  assert.equal(sanitized.model, CERT_TYPE);
  assert.equal(sanitized.model_code, TYPE_APPROVAL);
  assert.equal(sanitized.classification_number, CLASSIFICATION);
  assert.equal(sanitized.owner_name, before.owner_name);
  assert.equal(sanitized.owner_address, before.owner_address);
  assert.equal(sanitized.license_plate_class, "580");
  assert.equal(sanitized.grade, ENGINE_TYPE);        // untouched here; the identity policy blanks it
  assert.equal(sanitized.vehicle_name, "ホンダ");     // untouched here; the identity policy blanks it
  assert.ok((sanitized.vehicle_identity_notices ?? []).some((n) => n.includes("PDFの文字情報から") && n.includes("型式")));
  assert.ok((sanitized.vehicle_identity_notices ?? []).some((n) => n.includes(ENGINE_TYPE) && n.includes(TYPE_APPROVAL)));

  const final = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: outcome.trustedModel });
  assert.equal(final.model, CERT_TYPE);
  assert.equal(final.engine_model, ENGINE_TYPE);
  assert.equal(final.model_code, TYPE_APPROVAL);
  assert.equal(final.classification_number, CLASSIFICATION);
  assert.equal(final.grade, undefined);
  assert.equal(final.vehicle_name, undefined);
  assert.equal(final.maker, "ホンダ");
  assert.equal(final.owner_name, "合成 名義");
  assert.notEqual(final.classification_number, final.license_plate_class);

  // Only the four code keys (+ notices) can ever be written.
  const blank = {};
  applyPdfTextLayerCertificateFields(blank, extraction);
  assert.deepEqual(Object.keys(blank).sort(), ["classification_number", "engine_model", "model", "model_code", "vehicle_identity_notices"]);
});

test("no text layer (scanned / image PDF / failure) leaves the AI result exactly as it was", () => {
  for (const status of ["no_text", "no_codes", "not_pdf", "too_large", "timeout", "parse_error"] as const) {
    const sanitized = sanitizeVehicleRegistrationOcrResult({ maker: "ホンダ", model: CERT_TYPE, engine_model: ENGINE_TYPE, grade: ENGINE_TYPE });
    const before = structuredClone(sanitized);
    const outcome = applyPdfTextLayerCertificateFields(sanitized, { status, fields: {}, rejected: {}, notices: [], lineCount: 0 });
    assert.deepEqual(outcome, { applied: [], trustedModel: false, manualEntry: [] });
    assert.deepEqual(sanitized, before);
  }
  const untouched = { model: CERT_TYPE };
  assert.deepEqual(applyPdfTextLayerCertificateFields(untouched, null), { applied: [], trustedModel: false, manualEntry: [] });
  assert.deepEqual(untouched, { model: CERT_TYPE });
});

test("partial extraction overrides only what was anchored; a conflicting AI 型式 loses to the text layer with a notice", () => {
  const partial = extractCertificateCodesFromLines([`型式指定番号 ${TYPE_APPROVAL} 類別区分番号 ${CLASSIFICATION}`]);
  const sanitized = { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: ENGINE_TYPE };
  const outcome = applyPdfTextLayerCertificateFields(sanitized, partial);
  assert.deepEqual(outcome, { applied: ["model_code", "classification_number"], trustedModel: false, manualEntry: [] });
  assert.equal(sanitized.model, CERT_TYPE);
  assert.equal(sanitized.model_code, TYPE_APPROVAL);
  assert.equal((sanitized as { classification_number?: string }).classification_number, CLASSIFICATION);

  const differing = { model: "6BA-ABC2", vehicle_identity_notices: ["既存の通知"] };
  applyPdfTextLayerCertificateFields(differing, extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`]));
  assert.equal(differing.model, CERT_TYPE);
  assert.equal(differing.vehicle_identity_notices[0], "既存の通知");
  assert.ok(differing.vehicle_identity_notices.some((n) => n.includes("6BA-ABC2") && n.includes(CERT_TYPE) && n.includes("PDFの文字情報を優先")));
});

test("F1: the legacy model_needs_confirmation flag is cleared ONLY when the text layer applies 型式 itself", () => {
  // 型式 applied → the flag (which described the replaced legacy value) is removed, with a notice.
  const flagged = { model: "6BA-ABC2", model_needs_confirmation: "true" as string | undefined, vehicle_identity_notices: [] as string[] };
  const outcome = applyPdfTextLayerCertificateFields(flagged, extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`]));
  assert.equal(outcome.trustedModel, true);
  assert.equal(flagged.model, CERT_TYPE);
  assert.equal(flagged.model_needs_confirmation, undefined);
  assert.ok(flagged.vehicle_identity_notices.some((n) => n.includes("確認フラグ") && n.includes("解除")));

  // Only other codes applied → the flag is untouched (the identity policy keeps failing closed on it).
  const partial = { model: "6BA-ABC2", model_needs_confirmation: "true" as string | undefined };
  const partialOutcome = applyPdfTextLayerCertificateFields(partial, extractCertificateCodesFromLines([`類別区分番号 ${CLASSIFICATION}`]));
  assert.equal(partialOutcome.trustedModel, false);
  assert.equal(partial.model_needs_confirmation, "true");
  assert.equal(partial.model, "6BA-ABC2");

  // No text layer at all → untouched.
  const none = { model_needs_confirmation: "true" as string | undefined };
  applyPdfTextLayerCertificateFields(none, { status: "no_text", fields: {}, rejected: {}, notices: [], lineCount: 0 });
  assert.equal(none.model_needs_confirmation, "true");
});

test("R2-2: a field the text layer REJECTED withholds the AI reading of that field with a manual-entry notice; absent fields and other statuses keep the AI fallback", () => {
  // 型式 rejected (spaced 改), 型式指定番号 extracted, 原動機の型式 / 類別区分番号 absent from the PDF.
  const extraction = extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改`, `型式指定番号 ${TYPE_APPROVAL}`]);
  const sanitized = sanitizeVehicleRegistrationOcrResult({
    maker: "ホンダ", model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: ENGINE_TYPE, classification_number: CLASSIFICATION,
    owner_name: "合成 名義", license_plate_class: "580",
  });
  const outcome = applyPdfTextLayerCertificateFields(sanitized, extraction);
  assert.deepEqual(outcome, { applied: ["model_code"], trustedModel: false, manualEntry: ["model"] });
  assert.equal(sanitized.model, undefined);                    // AI 型式 withheld: it would contradict the notice
  assert.equal(sanitized.model_code, TYPE_APPROVAL);           // PDF value applied
  assert.equal(sanitized.engine_model, ENGINE_TYPE);           // absent from the PDF → AI fallback kept
  assert.equal(sanitized.classification_number, CLASSIFICATION);
  assert.equal(sanitized.owner_name, "合成 名義");
  assert.equal(sanitized.license_plate_class, "580");
  const notices = sanitized.vehicle_identity_notices ?? [];
  assert.ok(notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes(`${CERT_TYPE} 改`)), notices.join(" | "));
  const aiNotice = notices.find((n) => n.includes("AI読み取りの型式"));
  assert.ok(aiNotice !== undefined && aiNotice.includes("表示しません") && aiNotice.includes("手入力"), notices.join(" | "));
  assert.ok(!aiNotice.includes(CERT_TYPE), aiNotice); // the withheld AI candidate is never echoed
  const final = applyVehicleIdentityPolicy(sanitized, { trustedModelShape: outcome.trustedModel });
  assert.equal(final.model, undefined);
  assert.equal(final.model_code, TYPE_APPROVAL);
  assert.equal(final.engine_model, ENGINE_TYPE);
  assert.equal(final.classification_number, CLASSIFICATION);

  // Regression: an AI candidate that DIFFERS from the rejected PDF text is withheld and never echoed in any
  // notice — the AI-specific notice names the field only; the manual-entry notice quotes the PDF evidence only.
  const AI_ONLY_TYPE = "6BA-ZZZ9"; // synthetic; distinguishable from every PDF value on the page
  const distinct = { model: AI_ONLY_TYPE, model_code: TYPE_APPROVAL, vehicle_identity_notices: [] as string[] };
  const distinctOutcome = applyPdfTextLayerCertificateFields(distinct, extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改`, `型式指定番号 ${TYPE_APPROVAL}`]));
  assert.deepEqual(distinctOutcome, { applied: ["model_code"], trustedModel: false, manualEntry: ["model"] });
  assert.equal(distinct.model, undefined);
  const distinctAi = distinct.vehicle_identity_notices.find((n) => n.includes("AI読み取りの型式"));
  assert.ok(distinctAi !== undefined && distinctAi.includes("表示しません") && distinctAi.includes("車検証の型式欄"), distinct.vehicle_identity_notices.join(" | "));
  assert.ok(!distinctAi.includes(AI_ONLY_TYPE), distinctAi);
  assert.ok(distinct.vehicle_identity_notices.every((n) => !n.includes(AI_ONLY_TYPE)), distinct.vehicle_identity_notices.join(" | "));
  assert.ok(distinct.vehicle_identity_notices.some((n) => n.startsWith("【要手入力：型式】") && n.includes(`${CERT_TYPE} 改`)), distinct.vehicle_identity_notices.join(" | "));
  // Same for an AMBIGUOUS PDF field (several different values): the PDF candidates are quoted, the AI one is not.
  const ambiguousDistinct = { model: AI_ONLY_TYPE, vehicle_identity_notices: [] as string[] };
  applyPdfTextLayerCertificateFields(ambiguousDistinct, extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`, "型式 6BA-ABC2"]));
  assert.equal(ambiguousDistinct.model, undefined);
  assert.ok(ambiguousDistinct.vehicle_identity_notices.some((n) => n.includes("候補が複数") && n.includes(CERT_TYPE) && n.includes("6BA-ABC2")));
  assert.ok(ambiguousDistinct.vehicle_identity_notices.some((n) => n.includes("AI読み取りの型式") && n.includes("表示しません")));
  assert.ok(ambiguousDistinct.vehicle_identity_notices.every((n) => !n.includes(AI_ONLY_TYPE)), ambiguousDistinct.vehicle_identity_notices.join(" | "));

  // A rejection with no extracted field at all (status no_codes) still withholds the AI reading of that field.
  const onlyRejected = { model: CERT_TYPE, engine_model: ENGINE_TYPE };
  const only = applyPdfTextLayerCertificateFields(onlyRejected, extractCertificateCodesFromLines([`型式 ${CERT_TYPE}改`]));
  assert.deepEqual(only, { applied: [], trustedModel: false, manualEntry: ["model"] });
  assert.equal(onlyRejected.model, undefined);
  assert.equal(onlyRejected.engine_model, ENGINE_TYPE);

  // Ambiguous, malformed and conflicting evidence withhold exactly the fields they name.
  const ambiguous = { model: CERT_TYPE, model_code: TYPE_APPROVAL };
  applyPdfTextLayerCertificateFields(ambiguous, extractCertificateCodesFromLines([`型式 ${CERT_TYPE}`, "型式 6BA-ABC2", `型式指定番号 ${TYPE_APPROVAL}`]));
  assert.equal(ambiguous.model, undefined);
  assert.equal(ambiguous.model_code, TYPE_APPROVAL);
  const malformed = { classification_number: CLASSIFICATION, model: CERT_TYPE };
  applyPdfTextLayerCertificateFields(malformed, extractCertificateCodesFromLines(["類別区分番号 12-3"]));
  assert.equal(malformed.classification_number, undefined);
  assert.equal(malformed.model, CERT_TYPE);
  const conflict = { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL };
  const conflictOutcome = applyPdfTextLayerCertificateFields(conflict, extractCertificateCodesFromLines([`型式 ${ENGINE_TYPE} 原動機の型式 ${ENGINE_TYPE}`]));
  assert.deepEqual(conflictOutcome.manualEntry, ["model", "engine_model"]);
  assert.equal(conflict.model, undefined);
  assert.equal(conflict.engine_model, undefined);
  assert.equal(conflict.model_code, TYPE_APPROVAL);

  // A rejected field with NO AI reading only records the manual-entry state (no "withheld" notice to show).
  const blank: { model?: string; vehicle_identity_notices?: string[] } = {};
  const blankOutcome = applyPdfTextLayerCertificateFields(blank, extractCertificateCodesFromLines([`型式 ${CERT_TYPE} 改`]));
  assert.deepEqual(blankOutcome.manualEntry, ["model"]);
  assert.equal(blank.model, undefined);
  assert.ok(!(blank.vehicle_identity_notices ?? []).some((n) => n.includes("AI読み取りの")));
  assert.ok((blank.vehicle_identity_notices ?? []).some((n) => n.startsWith("【要手入力：型式】")));

  // Unchanged fallbacks: a field merely absent from the PDF keeps the AI reading; non-text-layer statuses touch nothing.
  const absent = { model: CERT_TYPE };
  assert.deepEqual(applyPdfTextLayerCertificateFields(absent, extractCertificateCodesFromLines([`類別区分番号 ${CLASSIFICATION}`])).manualEntry, []);
  assert.equal(absent.model, CERT_TYPE);
  for (const status of ["no_text", "no_codes", "not_pdf", "too_large", "timeout", "parse_error"] as const) {
    const scanned = { model: CERT_TYPE, engine_model: ENGINE_TYPE };
    assert.deepEqual(applyPdfTextLayerCertificateFields(scanned, { status, fields: {}, rejected: {}, notices: [], lineCount: 0 }).manualEntry, []);
    assert.deepEqual(scanned, { model: CERT_TYPE, engine_model: ENGINE_TYPE });
  }
});

// ─── pdf.js: synthetic selectable / scanned PDFs ─────────────────────────────

test("a selectable kei certificate PDF yields the four codes from page 1 via pdf.js", async () => {
  const pdf = buildSyntheticPdf([{ text: KEI_ROWS }]);
  const r = await extractCertificateCodesFromPdf(toBytes(pdf));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.equal(r.fields.classification_number, "0007");
  assert.equal(r.lineCount, 3);

  const viaBase64 = await extractCertificateCodesFromPdfBase64(pdf.toString("base64"));
  assert.deepEqual(viaBase64.fields, r.fields);
});

test("split text items and full-width text inside the PDF are re-joined and folded", async () => {
  const split = buildSyntheticPdf([{ text: [
    { x: 40, y: 740, text: "型式" },
    { x: 90, y: 740, text: "6BA-" }, { x: 130, y: 740, text: "ABC1" }, // 4 glyphs × 10pt = 40 → gap 0
    { x: 260, y: 740, text: "原動機の型式" }, { x: 340, y: 740, text: ENGINE_TYPE },
  ] }]);
  const r = await extractCertificateCodesFromPdf(toBytes(split));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, { model: CERT_TYPE, engine_model: ENGINE_TYPE });

  const fullWidth = buildSyntheticPdf([{ text: [
    { x: 40, y: 740, text: "型式　６ＢＡ－ＡＢＣ１" },
    { x: 40, y: 700, text: "型式指定番号　１２３４５　類別区分番号　０００７" },
  ] }]);
  const f = await extractCertificateCodesFromPdf(toBytes(fullWidth));
  assert.equal(f.status, "extracted", JSON.stringify(f));
  assert.deepEqual(f.fields, { model: CERT_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
});

test("F2 (pdf.js): a selectable PDF whose 型式 carries a synthetic 改 suffix yields no 型式, a notice, and the other codes", async () => {
  const suffixed = buildSyntheticPdf([{ text: [
    { x: 40,  y: 780, text: "自動車検査証（合成テスト）" },
    { x: 40,  y: 740, text: "型式" },        { x: 90,  y: 740, text: "6BA-ABC1改" },
    { x: 260, y: 740, text: "原動機の型式" }, { x: 340, y: 740, text: ENGINE_TYPE },
    { x: 40,  y: 700, text: "型式指定番号" }, { x: 120, y: 700, text: TYPE_APPROVAL },
    { x: 260, y: 700, text: "類別区分番号" }, { x: 340, y: 700, text: CLASSIFICATION },
  ] }]);
  const r = await extractCertificateCodesFromPdf(toBytes(suffixed));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION }); // no 型式
  assert.equal(r.notices.length, 1);
  assert.ok(r.notices[0].includes("6BA-ABC1改") && r.notices[0].includes("型式は自動取得しませんでした"), r.notices[0]);

  // Split into two pdf.js items ("6BA-ABC1" + "改", glued: gap 0) the outcome is identical — never 6BA-ABC1.
  const split = buildSyntheticPdf([{ text: [
    { x: 40, y: 740, text: "型式" }, { x: 90, y: 740, text: CERT_TYPE }, { x: 170, y: 740, text: "改" },
  ] }]);
  const s = await extractCertificateCodesFromPdf(toBytes(split));
  assert.equal(s.status, "no_codes", JSON.stringify(s));
  assert.equal(s.fields.model, undefined);
  assert.ok(s.notices.some((n) => n.includes("6BA-ABC1改")));
});

test("an image-only (scanned) PDF has no text layer → no fields, AI path continues", async () => {
  const scanned = buildSyntheticPdf([{ image: true }]);
  const r = await extractCertificateCodesFromPdf(toBytes(scanned));
  assert.equal(r.status, "no_text");
  assert.deepEqual(r.fields, {});
  assert.deepEqual(r.notices, []);
});

test("only page 1 is read: codes printed on page 2 are never extracted", async () => {
  const twoPages = buildSyntheticPdf([
    { text: [{ x: 40, y: 780, text: "自動車検査証（合成テスト）表紙" }] },
    { text: KEI_ROWS },
  ]);
  const r = await extractCertificateCodesFromPdf(toBytes(twoPages));
  assert.equal(r.status, "no_codes");
  assert.deepEqual(r.fields, {});
  assert.equal(r.lineCount, 1);
});

test("non-PDF, corrupt, empty and oversized inputs fail closed without throwing", async () => {
  assert.equal((await extractCertificateCodesFromPdf(new Uint8Array(0))).status, "not_pdf");
  assert.equal((await extractCertificateCodesFromPdf(Buffer.from("PNG\x89 not a pdf at all"))).status, "not_pdf");
  const corrupt = await extractCertificateCodesFromPdf(Buffer.from("%PDF-1.7\n1 0 obj << /Broken\n%%EOF"));
  assert.ok(corrupt.status === "parse_error" || corrupt.status === "no_text", corrupt.status);
  assert.deepEqual(corrupt.fields, {});

  const pdf = buildSyntheticPdf([{ text: KEI_ROWS }]);
  assert.equal((await extractCertificateCodesFromPdf(toBytes(pdf), { maxBytes: 16 })).status, "too_large");
  assert.equal((await extractCertificateCodesFromPdfBase64(pdf.toString("base64"), { maxBytes: 16 })).status, "too_large");
  assert.ok(PDF_TEXT_LAYER_LIMITS.maxBytes >= pdf.byteLength);
});

// ─── Pure: two-row layout (label row → immediately following value row, geometry-bound) ─────────

/** Positional items of one certificate table row: labels at `labelY`, values at `valueY`. */
function twoRowItems(labelY: number, valueY: number, overrides: Partial<{
  labels: PdfTextItemLike[]; values: PdfTextItemLike[]; extra: PdfTextItemLike[];
}> = {}): PdfTextItemLike[] {
  const labels = overrides.labels ?? [
    { str: "型式",         x: 40,  y: labelY, width: 20, height: 10 },
    { str: "原動機の型式", x: 200, y: labelY, width: 60, height: 10 },
    { str: "型式指定番号", x: 340, y: labelY, width: 60, height: 10 },
    { str: "類別区分番号", x: 480, y: labelY, width: 60, height: 10 },
  ];
  const values = overrides.values ?? [
    { str: CERT_TYPE,      x: 40,  y: valueY, width: 80, height: 10 },
    { str: ENGINE_TYPE,    x: 200, y: valueY, width: 40, height: 10 },
    { str: TYPE_APPROVAL,  x: 340, y: valueY, width: 50, height: 10 },
    { str: CLASSIFICATION, x: 480, y: valueY, width: 40, height: 10 },
  ];
  return [{ str: "自動車検査証（合成テスト）", x: 40, y: 780, width: 130, height: 10 }, ...labels, ...values, ...(overrides.extra ?? [])];
}

const ALL_FOUR = { model: CERT_TYPE, engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION };

test("label row (y=500) followed by an aligned value row (y=492) pairs all four codes by column geometry", () => {
  const items = twoRowItems(500, 492);
  // The same items flattened to strings carry no geometry → the same-row rule alone finds nothing.
  assert.equal(extractCertificateCodesFromLines(groupPdfTextItemsIntoLines(items)).status, "no_codes");

  const r = extractCertificateCodesFromItems(items);
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, ALL_FOUR);
  assert.equal(r.fields.classification_number, "0007"); // leading zero preserved, string
  assert.deepEqual(r.notices, []);
  assert.equal(r.lineCount, 3);

  // Baseline distance is bounded: 3 × height (=30pt) here, never more than maxBaselineGapPt.
  assert.equal(PDF_TWO_ROW_GEOMETRY.maxBaselineGapPt, 30);
  assert.deepEqual(extractCertificateCodesFromItems(twoRowItems(500, 470)).fields, ALL_FOUR);
});

test("two-row pairing fails closed: far-away row, an intervening row, a missing value and a dash placeholder", () => {
  // Value row far below the label row (gap 60pt > 30pt) → nothing, and no notice (nothing was anchored).
  const far = extractCertificateCodesFromItems(twoRowItems(500, 440));
  assert.equal(far.status, "no_codes");
  assert.deepEqual(far.fields, {});
  assert.deepEqual(far.notices, []);

  // A row in between (even in another column) breaks "immediately next row": values are not paired.
  const paired = extractCertificateCodesFromItems(twoRowItems(520, 496));
  assert.deepEqual(paired.fields, ALL_FOUR);
  const intervening = extractCertificateCodesFromItems(twoRowItems(520, 496, {
    extra: [{ str: "備考", x: 560, y: 508, width: 20, height: 10 }],
  }));
  assert.equal(intervening.status, "no_codes");
  assert.deepEqual(intervening.fields, {});

  // Row above the labels is never used either (values must be BELOW the labels).
  assert.equal(extractCertificateCodesFromItems(twoRowItems(492, 500)).status, "no_codes");

  // Missing 原動機の型式 value and a full-width dash under 型式指定番号 → those two stay absent, silently.
  const missing = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: CERT_TYPE,      x: 40,  y: 492, width: 80, height: 10 },
    { str: "－",           x: 340, y: 492, width: 10, height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(missing.fields, { model: CERT_TYPE, classification_number: CLASSIFICATION });
  assert.deepEqual(missing.notices, []);

  // Japanese text under a label is not a value; a code left of the first column belongs to no label.
  const noise = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: "不明", x: 40,  y: 492, width: 20, height: 10 },
    { str: "ZZZ9", x: 0,   y: 492, width: 30, height: 10 },
    { str: ENGINE_TYPE, x: 200, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(noise.fields, { engine_model: ENGINE_TYPE });
  assert.deepEqual(noise.notices, []);
});

test("two-row pairing rejects crossed, ambiguous and duplicate-label values with a notice — never picks one", () => {
  // One token straddling the 型式 / 原動機の型式 column edge → both fields blocked; the others still pass.
  const crossed = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: "6BA-ABC1XYZ1", x: 140, y: 492, width: 120, height: 10 },
    { str: TYPE_APPROVAL,  x: 340, y: 492, width: 50,  height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40,  height: 10 },
  ] }));
  assert.deepEqual(crossed.fields, { model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.equal(crossed.notices.length, 2);
  assert.ok(crossed.notices.every((n) => n.includes("6BA-ABC1XYZ1") && n.includes("またが")));

  // Two different codes under 型式指定番号 → ambiguous → not extracted, with a notice naming both.
  const ambiguous = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: TYPE_APPROVAL, x: 340, y: 492, width: 50, height: 10 },
    { str: "67890",       x: 410, y: 492, width: 50, height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(ambiguous.fields, { classification_number: CLASSIFICATION });
  assert.ok(ambiguous.notices.some((n) => n.includes(TYPE_APPROVAL) && n.includes("67890") && n.includes("候補が複数")));

  // The label 型式 twice in the label row with different values below → 型式 rejected; same value → accepted.
  const dupLabels: PdfTextItemLike[] = [
    { str: "型式", x: 40,  y: 500, width: 20, height: 10 },
    { str: "型式", x: 340, y: 500, width: 20, height: 10 },
    { str: "類別区分番号", x: 480, y: 500, width: 60, height: 10 },
  ];
  const duplicate = extractCertificateCodesFromItems(twoRowItems(500, 492, { labels: dupLabels, values: [
    { str: CERT_TYPE,      x: 40,  y: 492, width: 80, height: 10 },
    { str: "6BA-ABC2",     x: 340, y: 492, width: 80, height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(duplicate.fields, { classification_number: CLASSIFICATION });
  assert.ok(duplicate.notices.some((n) => n.includes(CERT_TYPE) && n.includes("6BA-ABC2")));
  const repeated = extractCertificateCodesFromItems(twoRowItems(500, 492, { labels: dupLabels, values: [
    { str: CERT_TYPE, x: 40, y: 492, width: 80, height: 10 }, { str: CERT_TYPE, x: 340, y: 492, width: 80, height: 10 },
  ] }));
  assert.deepEqual(repeated.fields, { model: CERT_TYPE });

  // Shape validation and the cross-field conflict rule apply to two-row values exactly as to same-row ones.
  const shapes = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: TYPE_APPROVAL, x: 40,  y: 492, width: 50, height: 10 }, // digits-only 型式
    { str: "AB12",        x: 340, y: 492, width: 40, height: 10 }, // letters in 型式指定番号
  ] }));
  assert.deepEqual(shapes.fields, {});
  assert.equal(shapes.notices.length, 2);
  const same = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: ENGINE_TYPE, x: 40, y: 492, width: 40, height: 10 }, { str: ENGINE_TYPE, x: 200, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(same.fields, {});
  assert.ok(same.notices.some((n) => n.includes("同じ値")));

  // Same-row and two-row evidence that disagree → ambiguity → rejected; agreeing evidence passes.
  const disagree = extractCertificateCodesFromItems(twoRowItems(500, 492, { extra: [
    { str: "型式", x: 40, y: 300, width: 20, height: 10 }, { str: "6BA-ABC2", x: 70, y: 300, width: 80, height: 10 },
  ] }));
  assert.equal(disagree.fields.model, undefined);
  assert.ok(disagree.notices.some((n) => n.includes(CERT_TYPE) && n.includes("6BA-ABC2")));
  const agree = extractCertificateCodesFromItems(twoRowItems(500, 492, { extra: [
    { str: "型式", x: 40, y: 300, width: 20, height: 10 }, { str: CERT_TYPE, x: 70, y: 300, width: 80, height: 10 },
  ] }));
  assert.deepEqual(agree.fields, ALL_FOUR);
});

test("two-row pairing glues split value items, folds full-width text, merges letter-spaced label pieces and strips colons", () => {
  const r = extractCertificateCodesFromItems(twoRowItems(500, 492, {
    labels: [
      { str: "型",           x: 40,  y: 500, width: 10, height: 10 }, { str: "式", x: 55, y: 500, width: 10, height: 10 }, // letter-spaced
      { str: "原動機の",     x: 200, y: 500, width: 40, height: 10 }, { str: "型式", x: 240, y: 500, width: 20, height: 10 }, // pdf.js split
      { str: "型式指定番号：", x: 340, y: 500, width: 70, height: 10 },
      { str: "類別区分番号", x: 480, y: 500, width: 60, height: 10 },
    ],
    values: [
      { str: "6BA-",     x: 40,  y: 492.3, width: 40, height: 10 }, { str: "ABC1", x: 80, y: 492, width: 40, height: 10 },
      { str: "ＸＹＺ１", x: 200, y: 492, width: 40, height: 10 },
      { str: "１２３４５", x: 340, y: 492, width: 50, height: 10 },
      { str: "０００７", x: 480, y: 492, width: 40, height: 10 },
    ],
  }));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, ALL_FOUR);

  // Without width geometry nothing can be glued or column-bound → fail closed, no fields.
  const noGeometry = extractCertificateCodesFromItems([
    { str: "型式", x: 40, y: 500 }, { str: "6BA-", x: 40, y: 492 }, { str: "ABC1", x: 80, y: 492 },
  ]);
  assert.deepEqual(noGeometry.fields, {});
});

// ─── F3: mixed same-row / next-row layouts at a close row pitch ─────────────────

// Three rows 20pt apart. 型式 and 型式指定番号 have their value on THEIR OWN row (same-row layout, value
// right-shifted inside the cell); 原動機の型式 and 類別区分番号 are label-only with the value on the
// immediately following row (two-row layout). Every column is synthetic.
const MIXED_ROWS: PdfTextItemLike[] = [
  { str: "自動車検査証（合成テスト）", x: 40, y: 780, width: 130, height: 10 },
  { str: "型式",         x: 40,  y: 740, width: 20, height: 10 }, { str: CERT_TYPE,     x: 140, y: 740, width: 80, height: 10 },
  { str: "原動機の型式", x: 300, y: 740, width: 60, height: 10 },
  { str: "型式指定番号", x: 40,  y: 720, width: 60, height: 10 }, { str: TYPE_APPROVAL, x: 110, y: 720, width: 50, height: 10 },
  { str: ENGINE_TYPE,    x: 300, y: 720, width: 40, height: 10 },
  { str: "類別区分番号", x: 440, y: 720, width: 60, height: 10 },
  { str: CLASSIFICATION, x: 440, y: 700, width: 40, height: 10 },
];

test("F3: a label with a same-row value is never re-paired with the next row; label-only columns still pair per label", () => {
  const r = extractCertificateCodesFromItems(MIXED_ROWS);
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, ALL_FOUR);
  assert.deepEqual(r.notices, []);
  assert.equal(r.lineCount, 4);

  // The plain kei same-row layout at a 20pt pitch (rows 740 / 720) is not disturbed by the two-row rule.
  const close = extractCertificateCodesFromItems([
    { str: "型式",         x: 40,  y: 740, width: 20, height: 10 }, { str: CERT_TYPE,      x: 90,  y: 740, width: 80, height: 10 },
    { str: "原動機の型式", x: 260, y: 740, width: 60, height: 10 }, { str: ENGINE_TYPE,    x: 340, y: 740, width: 40, height: 10 },
    { str: "型式指定番号", x: 40,  y: 720, width: 60, height: 10 }, { str: TYPE_APPROVAL,  x: 120, y: 720, width: 50, height: 10 },
    { str: "類別区分番号", x: 260, y: 720, width: 60, height: 10 }, { str: CLASSIFICATION, x: 340, y: 720, width: 40, height: 10 },
  ]);
  assert.deepEqual(close.fields, ALL_FOUR);
  assert.deepEqual(close.notices, []);

  // A colon token between label and same-row value still counts as "resolved on its own row".
  const colon = extractCertificateCodesFromItems([
    { str: "型式", x: 40, y: 740, width: 20, height: 10 }, { str: ":", x: 65, y: 740, width: 5, height: 10 }, { str: CERT_TYPE, x: 140, y: 740, width: 80, height: 10 },
    { str: "型式指定番号", x: 40, y: 720, width: 60, height: 10 }, { str: TYPE_APPROVAL, x: 110, y: 720, width: 50, height: 10 },
  ]);
  assert.deepEqual(colon.fields, { model: CERT_TYPE, model_code: TYPE_APPROVAL });
  assert.deepEqual(colon.notices, []);

  // Still fail-closed: a label-only 型式 whose next-row token straddles the column edge stays blocked.
  const straddle = extractCertificateCodesFromItems([
    { str: "型式", x: 40, y: 740, width: 20, height: 10 }, { str: "原動機の型式", x: 140, y: 740, width: 60, height: 10 },
    { str: "6BA-ABC1XYZ1", x: 80, y: 720, width: 120, height: 10 },
  ]);
  assert.deepEqual(straddle.fields, {});
  assert.ok(straddle.notices.some((n) => n.includes("またが")));
});

test("R2-1 (two-row): a 改 token under the label directly after the code — split by any gap or glued — rejects that field; marks outside the column never do", () => {
  const withMark = (mark: PdfTextItemLike) => extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: CERT_TYPE,      x: 40,  y: 492, width: 80, height: 10 }, mark,
    { str: ENGINE_TYPE,    x: 200, y: 492, width: 40, height: 10 },
    { str: TYPE_APPROVAL,  x: 340, y: 492, width: 50, height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40, height: 10 },
  ] }));
  const three = { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION };
  for (const mark of [
    { str: "改",     x: 130, y: 492, width: 10, height: 10 }, // 10pt gap: separate token inside the 型式 column
    { str: "（改）", x: 150, y: 492, width: 30, height: 10 }, // full-width brackets, 30pt gap
    { str: "改",     x: 120, y: 492, width: 10, height: 10 }, // gap 0: glued into one token "6BA-ABC1改"
  ]) {
    const r = withMark(mark);
    assert.deepEqual(r.fields, three, JSON.stringify(r));
    assert.deepEqual(Object.keys(r.rejected), ["model"]);
    assert.ok(r.notices.some((n) => n.includes(CERT_TYPE) && n.includes("改") && n.includes("型式は自動取得しませんでした")), r.notices.join(" | "));
  }

  // One pdf.js item "6BA-ABC1改" under 型式 is rejected as well (it used to be skipped silently, leaving the AI value).
  const glued = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: `${CERT_TYPE}改`, x: 40, y: 492, width: 90, height: 10 }, { str: ENGINE_TYPE, x: 200, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(glued.fields, { engine_model: ENGINE_TYPE });
  assert.deepEqual(Object.keys(glued.rejected), ["model"]);
  assert.ok(glued.notices.some((n) => n.includes(`${CERT_TYPE}改`)));

  // A mark after the ENGINE code blocks 原動機の型式 only — never 型式 across the column edge.
  const engineMark = extractCertificateCodesFromItems(twoRowItems(500, 492, { values: [
    { str: CERT_TYPE,      x: 40,  y: 492, width: 80, height: 10 },
    { str: ENGINE_TYPE,    x: 200, y: 492, width: 40, height: 10 }, { str: "改", x: 250, y: 492, width: 10, height: 10 },
    { str: TYPE_APPROVAL,  x: 340, y: 492, width: 50, height: 10 },
    { str: CLASSIFICATION, x: 480, y: 492, width: 40, height: 10 },
  ] }));
  assert.deepEqual(engineMark.fields, { model: CERT_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.deepEqual(Object.keys(engineMark.rejected), ["engine_model"]);

  // Negative controls: a 改 beyond the last column, or on a row that is not the value row, blocks nothing.
  const outside = extractCertificateCodesFromItems(twoRowItems(500, 492, { extra: [{ str: "改", x: 700, y: 492, width: 10, height: 10 }] }));
  assert.deepEqual(outside.fields, ALL_FOUR);
  assert.deepEqual(outside.notices, []);
  const otherRow = extractCertificateCodesFromItems(twoRowItems(500, 492, { extra: [{ str: "改", x: 130, y: 470, width: 10, height: 10 }] }));
  assert.deepEqual(otherRow.fields, ALL_FOUR);
  assert.deepEqual(otherRow.notices, []);
  assert.deepEqual(otherRow.rejected, {});
});

// ─── pdf.js: two-row synthetic PDFs ────────────────────────────────────────────

// Label row at y=500, value row at y=492, four columns (glyph width = 10pt at size 10).
const TWO_ROW_LABELS: SyntheticTextOp[] = [
  { x: 40,  y: 500, text: "型式" },
  { x: 200, y: 500, text: "原動機の型式" },
  { x: 340, y: 500, text: "型式指定番号" },
  { x: 480, y: 500, text: "類別区分番号" },
];
const twoRowValues = (y: number): SyntheticTextOp[] => [
  { x: 40,  y, text: CERT_TYPE },
  { x: 200, y, text: ENGINE_TYPE },
  { x: 340, y, text: TYPE_APPROVAL },
  { x: 480, y, text: CLASSIFICATION },
];

test("a selectable PDF with a label row above an aligned value row yields the four codes via pdf.js", async () => {
  const pdf = buildSyntheticPdf([{ text: [{ x: 40, y: 780, text: "自動車検査証（合成テスト）" }, ...TWO_ROW_LABELS, ...twoRowValues(492)] }]);
  const r = await extractCertificateCodesFromPdf(toBytes(pdf));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, ALL_FOUR);
  assert.equal(r.fields.classification_number, "0007");
  assert.deepEqual(r.notices, []);
  assert.equal(r.lineCount, 3);
  assert.deepEqual((await extractCertificateCodesFromPdfBase64(pdf.toString("base64"))).fields, r.fields);

  // Split value items and full-width values in the value row are re-joined / folded.
  const split = buildSyntheticPdf([{ text: [
    ...TWO_ROW_LABELS,
    { x: 40, y: 492, text: "6BA-" }, { x: 80, y: 492, text: "ABC1" },
    { x: 200, y: 492, text: "ＸＹＺ１" }, { x: 340, y: 492, text: "１２３４５" }, { x: 480, y: 492, text: "０００７" },
  ] }]);
  const s = await extractCertificateCodesFromPdf(toBytes(split));
  assert.equal(s.status, "extracted", JSON.stringify(s));
  assert.deepEqual(s.fields, ALL_FOUR);
});

test("a selectable PDF whose value row is far below the label row, or on page 2, yields nothing", async () => {
  const far = buildSyntheticPdf([{ text: [...TWO_ROW_LABELS, ...twoRowValues(440)] }]);
  const f = await extractCertificateCodesFromPdf(toBytes(far));
  assert.equal(f.status, "no_codes");
  assert.deepEqual(f.fields, {});
  assert.deepEqual(f.notices, []);

  const page2 = buildSyntheticPdf([{ text: [{ x: 40, y: 780, text: "表紙" }] }, { text: [...TWO_ROW_LABELS, ...twoRowValues(492)] }]);
  const p = await extractCertificateCodesFromPdf(toBytes(page2));
  assert.equal(p.status, "no_codes");
  assert.deepEqual(p.fields, {});
});

test("F3 (pdf.js): a mixed same-row / next-row certificate PDF at a 20pt row pitch yields all four codes without notices", async () => {
  const pdf = buildSyntheticPdf([{ text: [
    { x: 40,  y: 780, text: "自動車検査証（合成テスト）" },
    { x: 40,  y: 740, text: "型式" },         { x: 140, y: 740, text: CERT_TYPE },
    { x: 300, y: 740, text: "原動機の型式" },
    { x: 40,  y: 720, text: "型式指定番号" }, { x: 110, y: 720, text: TYPE_APPROVAL },
    { x: 300, y: 720, text: ENGINE_TYPE },
    { x: 440, y: 720, text: "類別区分番号" },
    { x: 440, y: 700, text: CLASSIFICATION },
  ] }]);
  const r = await extractCertificateCodesFromPdf(toBytes(pdf));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, ALL_FOUR);
  assert.deepEqual(r.notices, []);
  assert.equal(r.lineCount, 4);
});

test("R2-1 (pdf.js): a selectable PDF whose 型式 is followed by a separate 改 item — same row or value row — yields no 型式, a notice, and the other codes", async () => {
  // Same row: CERT_TYPE spans 90..170 (8 glyphs × 10pt); the mark at 185 leaves a 15pt gap (≫ glue threshold).
  const sameRow = buildSyntheticPdf([{ text: [
    { x: 40,  y: 780, text: "自動車検査証（合成テスト）" },
    { x: 40,  y: 740, text: "型式" },         { x: 90,  y: 740, text: CERT_TYPE }, { x: 185, y: 740, text: "改" },
    { x: 300, y: 740, text: "原動機の型式" }, { x: 380, y: 740, text: ENGINE_TYPE },
    { x: 40,  y: 700, text: "型式指定番号" }, { x: 120, y: 700, text: TYPE_APPROVAL },
    { x: 300, y: 700, text: "類別区分番号" }, { x: 380, y: 700, text: CLASSIFICATION },
  ] }]);
  const r = await extractCertificateCodesFromPdf(toBytes(sameRow));
  assert.equal(r.status, "extracted", JSON.stringify(r));
  assert.deepEqual(r.fields, { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.deepEqual(Object.keys(r.rejected), ["model"]);
  assert.ok(r.notices.some((n) => n.includes(`${CERT_TYPE} 改`) && n.includes("型式は自動取得しませんでした")), r.notices.join(" | "));

  // Value row under a label row: the mark sits 10pt after the code inside the 型式 column.
  const twoRow = buildSyntheticPdf([{ text: [...TWO_ROW_LABELS, ...twoRowValues(492), { x: 130, y: 492, text: "改" }] }]);
  const t = await extractCertificateCodesFromPdf(toBytes(twoRow));
  assert.equal(t.status, "extracted", JSON.stringify(t));
  assert.deepEqual(t.fields, { engine_model: ENGINE_TYPE, model_code: TYPE_APPROVAL, classification_number: CLASSIFICATION });
  assert.deepEqual(Object.keys(t.rejected), ["model"]);

  // Negative control: the same PDFs with the mark on an unrelated row keep all four codes.
  const unrelated = buildSyntheticPdf([{ text: [{ x: 40, y: 780, text: "自動車検査証（合成テスト）" }, ...TWO_ROW_LABELS, ...twoRowValues(492), { x: 40, y: 300, text: "改" }] }]);
  const u = await extractCertificateCodesFromPdf(toBytes(unrelated));
  assert.deepEqual(u.fields, ALL_FOUR, JSON.stringify(u));
  assert.deepEqual(u.notices, []);
});
