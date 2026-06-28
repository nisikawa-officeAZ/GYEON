// Client-side stamp standardization (runs in the browser via Canvas).
//
// Pipeline (per spec):
//   1. Decode PNG/JPG/JPEG/WEBP into a canvas (always RGBA).
//   2. Remove the background automatically (edge flood-fill of background-like
//      pixels → transparent). Handles white-background JPEGs and already-
//      transparent PNGs alike. JPEG/JPG is thereby converted to transparent PNG.
//   3. Trim transparent margins to the content bounding box.
//   4. Detect square vs round from the trimmed shape (unless caller forces one).
//   5. Normalize to the standard physical size (square 20mm / round 18mm) at
//      300 DPI, preserving aspect ratio, centered on a transparent canvas.
//   6. Export an optimized transparent PNG.

import { STAMP_SPECS, stampSpec, type StampKind } from "@/lib/stamp/stamp-types";

export interface ProcessedStamp {
  blob:   Blob;
  kind:   StampKind;
  /** Output raster edge length in px (square). */
  size:   number;
}

const BG_TOLERANCE  = 42;  // colour distance from sampled background treated as background
const ALPHA_CUTOFF  = 24;  // alpha at/below this is considered transparent
const CONTENT_MARGIN = 0.06; // padding inside the normalized canvas

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("画像の読み込みに失敗しました")); };
    img.src = url;
  });
}

/** Remove background by flood-filling background-like pixels from the borders. */
function removeBackground(data: Uint8ClampedArray, w: number, h: number): void {
  // Sample background from the four corners (median-ish via average).
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  let br = 0, bg = 0, bb = 0, ba = 0;
  for (const c of corners) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; ba += data[c + 3]; }
  br /= 4; bg /= 4; bb /= 4; ba /= 4;
  const bgTransparent = ba <= ALPHA_CUTOFF;

  const isBg = (i: number): boolean => {
    const a = data[i + 3];
    if (a <= ALPHA_CUTOFF) return true;
    if (bgTransparent) return false; // bg was transparent; only alpha decides
    const dr = data[i]     - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= BG_TOLERANCE;
  };

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];

  const pushIfBorder = (x: number, y: number) => {
    const p = y * w + x;
    if (!visited[p] && isBg(p * 4)) { visited[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { pushIfBorder(x, 0); pushIfBorder(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIfBorder(0, y); pushIfBorder(w - 1, y); }

  while (stack.length) {
    const p = stack.pop()!;
    data[p * 4 + 3] = 0; // make transparent
    const x = p % w, y = (p / w) | 0;
    if (x > 0)     { const q = p - 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; stack.push(q); } }
    if (x < w - 1) { const q = p + 1; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; stack.push(q); } }
    if (y > 0)     { const q = p - w; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; stack.push(q); } }
    if (y < h - 1) { const q = p + w; if (!visited[q] && isBg(q * 4)) { visited[q] = 1; stack.push(q); } }
  }
}

function alphaBounds(data: Uint8ClampedArray, w: number, h: number) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_CUTOFF) {
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Detect square vs round from opaque coverage in the corners of the bbox.
 * A round seal leaves the bbox corners empty; a square seal fills them.
 */
export function detectShapeFromImageData(
  data: Uint8ClampedArray, w: number, h: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): StampKind {
  const bw = b.maxX - b.minX + 1;
  const bh = b.maxY - b.minY + 1;
  const aspect = bw / bh;
  if (aspect < 0.78 || aspect > 1.28) return "square"; // clearly non-circular

  const cs = Math.max(3, Math.round(Math.min(bw, bh) * 0.17)); // corner sample size
  const corners = [
    { x: b.minX,          y: b.minY },
    { x: b.maxX - cs + 1, y: b.minY },
    { x: b.minX,          y: b.maxY - cs + 1 },
    { x: b.maxX - cs + 1, y: b.maxY - cs + 1 },
  ];
  let opaque = 0, total = 0;
  for (const c of corners) {
    for (let y = 0; y < cs; y++) {
      for (let x = 0; x < cs; x++) {
        const px = c.x + x, py = c.y + y;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        total++;
        if (data[(py * w + px) * 4 + 3] > ALPHA_CUTOFF) opaque++;
      }
    }
  }
  const cornerFill = total ? opaque / total : 1;
  return cornerFill < 0.18 ? "round" : "square";
}

export async function processStampImage(
  file: File,
  forcedKind?: StampKind,
): Promise<ProcessedStamp> {
  const img = await loadImage(file);
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;

  const src = document.createElement("canvas");
  src.width = sw; src.height = sh;
  const sctx = src.getContext("2d", { willReadFrequently: true });
  if (!sctx) throw new Error("Canvas 2D context unavailable");
  sctx.drawImage(img, 0, 0);

  const imageData = sctx.getImageData(0, 0, sw, sh);
  removeBackground(imageData.data, sw, sh);
  sctx.putImageData(imageData, 0, 0);

  const bounds = alphaBounds(imageData.data, sw, sh);
  const b = bounds ?? { minX: 0, minY: 0, maxX: sw - 1, maxY: sh - 1 };

  const kind: StampKind = forcedKind ?? detectShapeFromImageData(imageData.data, sw, sh, b);
  const spec = stampSpec(kind);

  // Normalize: fit trimmed content into the standard square canvas, centered.
  const cw = b.maxX - b.minX + 1;
  const ch = b.maxY - b.minY + 1;
  const out = document.createElement("canvas");
  out.width = spec.px; out.height = spec.px;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable");

  const avail = spec.px * (1 - CONTENT_MARGIN * 2);
  const scale = Math.min(avail / cw, avail / ch);
  const dw = cw * scale, dh = ch * scale;
  const dx = (spec.px - dw) / 2, dy = (spec.px - dh) / 2;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(src, b.minX, b.minY, cw, ch, dx, dy, dw, dh);

  const blob: Blob = await new Promise((resolve, reject) => {
    out.toBlob((bl) => (bl ? resolve(bl) : reject(new Error("PNG変換に失敗しました"))), "image/png");
  });

  return { blob, kind, size: spec.px };
}

export const STAMP_SPEC_LIST = STAMP_SPECS;
