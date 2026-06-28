// Standardized stamp (印鑑 / seal) dimensions — single source of truth.
//
// Pure module: no DOM, no react-pdf. Safe to import from client (canvas
// processing/generation) AND server (PDF rendering) so the physical size is
// guaranteed identical everywhere.
//
// Stamp types & final output sizes (per spec):
//   - square (会社印 / company seal):  20 mm × 20 mm
//   - round  (個人印 / personal seal): 18 mm diameter
//
// Rasters are produced at 300 DPI so the print quality is professional. The
// physical size is what matters; the PNG simply carries that many pixels.

export type StampKind = "square" | "round";

export const STAMP_DPI = 300;

export interface StampSpec {
  kind:  StampKind;
  /** Physical size in millimetres (width === height; round = diameter). */
  mm:    number;
  /** Raster edge length in pixels at STAMP_DPI. */
  px:    number;
  label: string;
}

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

export function mmToPx(mm: number, dpi: number = STAMP_DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/** Millimetres → PDF points (react-pdf default unit). */
export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

/** Millimetres → CSS pixels at 96 DPI (for an on-screen true-size preview). */
export function mmToCssPx(mm: number): number {
  return (mm / MM_PER_INCH) * 96;
}

export const STAMP_SPECS: Record<StampKind, StampSpec> = {
  square: { kind: "square", mm: 20, px: mmToPx(20), label: "角印（会社印）20mm" },
  round:  { kind: "round",  mm: 18, px: mmToPx(18), label: "丸印（個人印）18mm" },
};

export function stampSpec(kind: StampKind): StampSpec {
  return STAMP_SPECS[kind] ?? STAMP_SPECS.square;
}

export function isStampKind(v: unknown): v is StampKind {
  return v === "square" || v === "round";
}

/** A stamp ready for PDF rendering: an image source (data URI or URL) + its kind. */
export interface PdfStamp {
  src:  string;
  kind: StampKind;
}
