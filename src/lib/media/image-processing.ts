// Client-side image processing for branding uploads.
//
// Runs in the browser (uses the Canvas API). Two transforms:
//   1. Convert any raster input (incl. JPEG/JPG) to PNG.
//   2. Auto-trim uniform borders — transparent edges, or solid edges that match
//      the image's corner colour (so white-background logos/stamps get cropped
//      tight). Trimming is best-effort and skipped if it would remove everything.
//
// Returns a PNG Blob ready to upload. The original file is never mutated.

export interface ProcessedImage {
  blob:   Blob;
  width:  number;
  height: number;
}

const TRIM_TOLERANCE = 12;   // per-channel colour distance treated as "same as background"
const ALPHA_THRESHOLD = 8;   // alpha at/below this is considered transparent

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました"));
    };
    img.src = url;
  });
}

/**
 * Compute the bounding box of the meaningful content, trimming uniform borders.
 * Background is sampled from the top-left pixel. A pixel belongs to the content
 * if it is sufficiently opaque AND sufficiently different from the background.
 */
function contentBounds(data: Uint8ClampedArray, w: number, h: number) {
  const bg = { r: data[0], g: data[1], b: data[2], a: data[3] };
  const bgOpaque = bg.a > ALPHA_THRESHOLD;

  let minX = w, minY = h, maxX = -1, maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a <= ALPHA_THRESHOLD) continue; // transparent → border

      // If the background is opaque (e.g. white-bg JPEG), also treat pixels that
      // match the background colour as border.
      if (bgOpaque) {
        const near =
          Math.abs(data[i]     - bg.r) <= TRIM_TOLERANCE &&
          Math.abs(data[i + 1] - bg.g) <= TRIM_TOLERANCE &&
          Math.abs(data[i + 2] - bg.b) <= TRIM_TOLERANCE;
        if (near) continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null; // nothing found — skip trim
  return { minX, minY, maxX, maxY };
}

/**
 * Convert to PNG and auto-trim borders. Always returns a PNG Blob.
 */
export async function processImageToTrimmedPng(file: File): Promise<ProcessedImage> {
  const img = await loadImage(file);
  const srcW = img.naturalWidth  || img.width;
  const srcH = img.naturalHeight || img.height;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width  = srcW;
  srcCanvas.height = srcH;
  const sctx = srcCanvas.getContext("2d");
  if (!sctx) throw new Error("Canvas 2D context unavailable");
  sctx.drawImage(img, 0, 0);

  // Compute trim bounds (guarded — large images can be skipped for safety).
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  try {
    const { data } = sctx.getImageData(0, 0, srcW, srcH);
    const bounds = contentBounds(data, srcW, srcH);
    if (bounds) {
      const pad = 2; // tiny breathing room
      sx = Math.max(0, bounds.minX - pad);
      sy = Math.max(0, bounds.minY - pad);
      sw = Math.min(srcW, bounds.maxX + pad) - sx + 1;
      sh = Math.min(srcH, bounds.maxY + pad) - sy + 1;
      if (sw < 1 || sh < 1) { sx = 0; sy = 0; sw = srcW; sh = srcH; }
    }
  } catch {
    // getImageData can throw on tainted canvases — fall back to full image.
    sx = 0; sy = 0; sw = srcW; sh = srcH;
  }

  const out = document.createElement("canvas");
  out.width  = sw;
  out.height = sh;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable");
  octx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob: Blob = await new Promise((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG 変換に失敗しました"))),
      "image/png",
    );
  });

  return { blob, width: sw, height: sh };
}
