// 10 Japanese seal (印鑑) styles for the AI Stamp Generator.
//
// Pure data + types (no DOM). Each style is rendered deterministically on a
// canvas by generateSealStamp(); they vary by shape, border treatment, fill,
// colour and typeface so dealers can pick a professional look in one click.

import type { StampKind } from "@/lib/stamp/stamp-types";

export type SealBorder =
  | "double"      // square: thick outer + thin inner frame
  | "single"      // square: one medium frame
  | "thick"       // square: one bold frame
  | "thin"        // square: one hairline frame
  | "none"        // no frame (text only)
  | "ring"        // round: single ring
  | "doubleRing"; // round: two concentric rings

export type SealFont = "mincho" | "gothic";

export interface SealStyle {
  id:     string;
  label:  string;
  shape:  StampKind;   // drives the standardized physical size (square 20mm / round 18mm)
  color:  string;
  border: SealBorder;
  fill:   boolean;     // true → solid ground with reversed (white) text
  font:   SealFont;
}

const VERMILION = "#c0392b";
const INK_BLACK = "#1a1a1a";
const INDIGO    = "#2c3e8f";

export const SEAL_STYLES: SealStyle[] = [
  { id: "square-classic",  label: "角印・標準",       shape: "square", color: VERMILION, border: "double",     fill: false, font: "mincho" },
  { id: "round-classic",   label: "丸印・標準",       shape: "round",  color: VERMILION, border: "ring",       fill: false, font: "mincho" },
  { id: "round-double",    label: "丸印・二重枠",     shape: "round",  color: VERMILION, border: "doubleRing", fill: false, font: "mincho" },
  { id: "square-bold",     label: "角印・太枠",       shape: "square", color: VERMILION, border: "thick",      fill: false, font: "gothic" },
  { id: "square-thin",     label: "角印・細枠",       shape: "square", color: VERMILION, border: "thin",       fill: false, font: "mincho" },
  { id: "square-filled",   label: "角印・朱地白文字", shape: "square", color: VERMILION, border: "none",       fill: true,  font: "gothic" },
  { id: "square-black",    label: "角印・黒印",       shape: "square", color: INK_BLACK, border: "double",     fill: false, font: "mincho" },
  { id: "round-indigo",    label: "丸印・藍",         shape: "round",  color: INDIGO,    border: "ring",       fill: false, font: "mincho" },
  { id: "round-filled",    label: "丸印・朱地白文字", shape: "round",  color: VERMILION, border: "none",       fill: true,  font: "gothic" },
  { id: "minimal",         label: "枠なし・文字のみ", shape: "square", color: VERMILION, border: "none",       fill: false, font: "gothic" },
];

export function sealStyle(id: string): SealStyle {
  return SEAL_STYLES.find((s) => s.id === id) ?? SEAL_STYLES[0];
}

export function fontFamily(font: SealFont): string {
  return font === "gothic"
    ? '"Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif'
    : '"Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif';
}
