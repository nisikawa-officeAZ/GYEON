// Client-side stamp generator — draws a Japanese seal (印鑑) in one of 10 styles.
//
// Produces a transparent PNG already at the standardized physical size
// (square 20mm / round 18mm @ 300 DPI). Deterministic canvas rendering (no
// external image model), so it always succeeds with a clean transparent PNG.

import { stampSpec, type StampKind } from "@/lib/stamp/stamp-types";
import { sealStyle, fontFamily, type SealStyle } from "@/lib/media/stamp-styles";

export interface GenerateStampOptions {
  /** One of SEAL_STYLES ids. */
  styleId: string;
  text:    string;
}

export interface GeneratedStamp {
  blob: Blob;
  kind: StampKind;
  size: number;
}

/** Split text into "cells" — characters, keeping ASCII runs grouped. */
function toCells(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const cells: string[] = [];
  let ascii = "";
  for (const ch of trimmed) {
    if (/[A-Za-z0-9]/.test(ch)) ascii += ch;
    else if (/\s/.test(ch)) { if (ascii) { cells.push(ascii); ascii = ""; } }
    else { if (ascii) { cells.push(ascii); ascii = ""; } cells.push(ch); }
  }
  if (ascii) cells.push(ascii);
  return cells;
}

function drawGrid(
  ctx: CanvasRenderingContext2D, cells: string[],
  x: number, y: number, w: number, h: number, color: string, font: string,
) {
  if (cells.length === 0) return;
  const cols = Math.max(1, Math.round(Math.sqrt(cells.length)));
  const rows = Math.ceil(cells.length / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  const fontPx = Math.floor(Math.min(cellW, cellH) * 0.82);
  ctx.fillStyle = color;
  ctx.font = `700 ${fontPx}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < cells.length; i++) {
    const col = Math.floor(i / rows);          // fill column by column
    const row = i % rows;
    const cx = x + w - (col + 0.5) * cellW;     // right → left
    const cy = y + (row + 0.5) * cellH;
    ctx.fillText(cells[i], cx, cy);
  }
}

function render(ctx: CanvasRenderingContext2D, S: number, style: SealStyle, text: string) {
  ctx.clearRect(0, 0, S, S);
  const cells = toCells(text);
  const font = fontFamily(style.font);
  const textColor = style.fill ? "#ffffff" : style.color;

  if (style.shape === "round") {
    const cx = S / 2, cy = S / 2, rOuter = S * 0.47;
    if (style.fill) {
      ctx.fillStyle = style.color;
      ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.fill();
    } else if (style.border === "doubleRing") {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = S * 0.045; ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = S * 0.012; ctx.beginPath(); ctx.arc(cx, cy, rOuter - S * 0.06, 0, Math.PI * 2); ctx.stroke();
    } else if (style.border === "ring") {
      ctx.strokeStyle = style.color;
      ctx.lineWidth = S * 0.05; ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke();
    }
    const inner = rOuter * 1.42;
    drawGrid(ctx, cells, cx - inner / 2, cy - inner / 2, inner, inner, textColor, font);
    return;
  }

  // square
  const pad = S * 0.06;
  const inner = S - pad * 2;
  if (style.fill) {
    ctx.fillStyle = style.color;
    ctx.fillRect(pad, pad, inner, inner);
  } else if (style.border === "double") {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = S * 0.05;  ctx.strokeRect(pad, pad, inner, inner);
    ctx.lineWidth = S * 0.012; ctx.strokeRect(pad + S * 0.045, pad + S * 0.045, inner - S * 0.09, inner - S * 0.09);
  } else if (style.border === "thick") {
    ctx.strokeStyle = style.color; ctx.lineWidth = S * 0.075; ctx.strokeRect(pad, pad, inner, inner);
  } else if (style.border === "single") {
    ctx.strokeStyle = style.color; ctx.lineWidth = S * 0.04; ctx.strokeRect(pad, pad, inner, inner);
  } else if (style.border === "thin") {
    ctx.strokeStyle = style.color; ctx.lineWidth = S * 0.018; ctx.strokeRect(pad, pad, inner, inner);
  }
  const tp = pad + S * 0.1;
  drawGrid(ctx, cells, tp, tp, S - tp * 2, S - tp * 2, textColor, font);
}

/** Render a style+text to a transparent-PNG data URL (for previews). */
export function sealPreviewDataUrl(styleId: string, text: string, sizePx = 96): string {
  const style = sealStyle(styleId);
  const canvas = document.createElement("canvas");
  canvas.width = sizePx; canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  render(ctx, sizePx, style, text || "印");
  return canvas.toDataURL("image/png");
}

export async function generateSealStamp(opts: GenerateStampOptions): Promise<GeneratedStamp> {
  const style = sealStyle(opts.styleId);
  const spec  = stampSpec(style.shape);
  const S     = spec.px;

  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  render(ctx, S, style, opts.text);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG変換に失敗しました"))), "image/png");
  });
  return { blob, kind: style.shape, size: S };
}
