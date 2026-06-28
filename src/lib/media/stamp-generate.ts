// Client-side stamp generator — draws a Japanese seal (印鑑) style stamp.
//
// Produces a transparent PNG already at the standardized physical size
// (square 20mm / round 18mm @ 300 DPI), so no further normalization is needed.
//
// This is a deterministic, canvas-rendered seal (vermilion on transparent) in
// the traditional 角印 (square) / 丸印 (round) style. It needs no external
// image-generation API, always succeeds, and guarantees a clean transparent
// PNG at the exact print size. (A diffusion model could be swapped in later;
// the output contract — transparent PNG at the standard size — stays the same.)

import { stampSpec, type StampKind } from "@/lib/stamp/stamp-types";

export interface GenerateStampOptions {
  kind:   StampKind;
  text:   string;      // company name (square) or personal name (round)
  color?: string;      // seal colour; defaults to vermilion
}

export interface GeneratedStamp {
  blob: Blob;
  kind: StampKind;
  size: number;
}

const DEFAULT_COLOR = "#c0392b"; // 朱肉 vermilion

/** Split text into "cells" — characters, keeping ASCII runs grouped. */
function toCells(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const cells: string[] = [];
  let ascii = "";
  for (const ch of trimmed) {
    if (/[A-Za-z0-9]/.test(ch)) {
      ascii += ch;
    } else if (/\s/.test(ch)) {
      if (ascii) { cells.push(ascii); ascii = ""; }
    } else {
      if (ascii) { cells.push(ascii); ascii = ""; }
      cells.push(ch);
    }
  }
  if (ascii) cells.push(ascii);
  return cells;
}

function drawGrid(
  ctx: CanvasRenderingContext2D, cells: string[],
  x: number, y: number, w: number, h: number, color: string,
) {
  if (cells.length === 0) return;
  // Traditional layout: columns right→left, characters top→bottom.
  const cols = Math.max(1, Math.round(Math.sqrt(cells.length)));
  const rows = Math.ceil(cells.length / cols);
  const cellW = w / cols;
  const cellH = h / rows;
  const fontPx = Math.floor(Math.min(cellW, cellH) * 0.82);
  ctx.fillStyle = color;
  ctx.font = `700 ${fontPx}px "Yu Mincho","Hiragino Mincho ProN",serif`;
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

export async function generateSealStamp(opts: GenerateStampOptions): Promise<GeneratedStamp> {
  const spec  = stampSpec(opts.kind);
  const color = opts.color || DEFAULT_COLOR;
  const S     = spec.px;

  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, S, S);

  const cells = toCells(opts.text);

  if (opts.kind === "round") {
    const cx = S / 2, cy = S / 2;
    const rOuter = S * 0.47;
    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth = S * 0.045;
    ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke();
    // Text inside (vertical column, centered)
    const inner = rOuter * 1.42; // usable square inscribed-ish
    drawGrid(ctx, cells, cx - inner / 2, cy - inner / 2, inner, inner, color);
  } else {
    const pad = S * 0.06;
    const inner = S - pad * 2;
    // Double square border
    ctx.strokeStyle = color;
    ctx.lineWidth = S * 0.05;
    ctx.strokeRect(pad, pad, inner, inner);
    ctx.lineWidth = S * 0.012;
    ctx.strokeRect(pad + S * 0.045, pad + S * 0.045, inner - S * 0.09, inner - S * 0.09);
    // Text grid inside
    const tp = pad + S * 0.1;
    drawGrid(ctx, cells, tp, tp, S - tp * 2, S - tp * 2, color);
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG変換に失敗しました"))), "image/png");
  });

  return { blob, kind: opts.kind, size: S };
}
