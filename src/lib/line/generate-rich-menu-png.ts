// DealerOS — LINE Rich Menu PNG Generator (server-only)
// Generates a 2500×1686 PNG with 6 colored button zones.
// Uses only Node.js built-ins (zlib) — no external image library required.
// Called server-side from publishLineRichMenu server action.

import zlib from "zlib";

// CRC-32/ISO-HDLC lookup table (required by PNG spec)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf  = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function deflateBuffer(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.deflate(buf, { level: 9 }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// ─── Image definition ─────────────────────────────────────────────────────────
// 3×2 grid of 6 button zones — GYEON brand dark luxury palette.
// Colors intentionally distinct so users can identify buttons in the LINE app.

type RGB = [number, number, number];

const BUTTON_COLORS: RGB[] = [
  [30, 58, 138],   // btn1 予約する     — deep blue   (#1e3a8a)
  [6, 78, 59],     // btn2 施工メニュー — deep teal   (#064e3b)
  [49, 46, 129],   // btn3 メンテナンス — deep indigo (#312e81)
  [126, 34, 206],  // btn4 レビュー投稿 — purple      (#7e22ce)
  [12, 74, 110],   // btn5 施工事例     — deep sky    (#0c4a6e)
  [30, 41, 59],    // btn6 お問い合わせ — dark slate  (#1e293b)
];
const BORDER: RGB = [51, 65, 85]; // slate-700 (#334155)
const BORDER_W = 3;
const IMG_W = 2500, IMG_H = 1686;

/**
 * Generates a 2500×1686 PNG template for LINE Rich Menu.
 * The image has 6 colored zones in a 3×2 grid, one per button.
 */
export async function generateRichMenuPng(): Promise<Buffer> {
  const colW = Math.floor(IMG_W / 3);
  const rowH = Math.floor(IMG_H / 2);
  const rowBytes = 1 + IMG_W * 3; // filter byte + RGB pixels

  const raw = Buffer.alloc(IMG_H * rowBytes);

  for (let y = 0; y < IMG_H; y++) {
    raw[y * rowBytes] = 0; // filter: None
    const row = y < rowH ? 0 : 1;
    const isHBorder = Math.abs(y - rowH) < BORDER_W;

    for (let x = 0; x < IMG_W; x++) {
      const col = x < colW ? 0 : x < 2 * colW ? 1 : 2;
      const isVBorder =
        Math.abs(x - colW) < BORDER_W || Math.abs(x - 2 * colW) < BORDER_W;

      const [r, g, b]: RGB = (isHBorder || isVBorder)
        ? BORDER
        : BUTTON_COLORS[row * 3 + col];

      const off = y * rowBytes + 1 + x * 3;
      raw[off]     = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }

  const compressed = await deflateBuffer(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(IMG_W, 0);
  ihdr.writeUInt32BE(IMG_H, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
