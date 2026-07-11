// DealerOS Document Design System — Layer 1: Design Tokens
//
// Single source of truth for the shared document (PDF) design language, ported from the approved
// GenSpark v3.0.1 `doc-tokens.css`. These are consumed by the @react-pdf/renderer primitives and
// components in this folder — the raw CSS is NEVER imported into the runtime (Rule E).
//
// Units: font sizes and spacing are kept as the design's px values expressed as px-strings. In
// @react-pdf/renderer, px are converted to pt at 72/96 = 0.75, which is exactly the 794px→595.28pt A4
// mapping the mockups use — so the px tokens reproduce the concept-b proportions on A4 verbatim.
// Page padding uses mm to match the physical A4 safe area.
//
// Philosophy: 95% monochrome + 5% brand accent (injected per-tenant via Brand Profile). Light mode /
// print-optimized only.

// ── Grayscale foundation ────────────────────────────────────────────────────
export const COLOR = {
  white: "#ffffff",
  paper: "#fafaf7",
  gray50: "#f7f7f6",
  gray100: "#eeeeec",
  gray200: "#d9d9d5",
  gray300: "#b8b8b3",
  gray400: "#8a8a85",
  gray500: "#5c5c58",
  gray600: "#3d3d3a",
  gray700: "#262624",
  gray800: "#16161a",
  black: "#0a0a0a",

  // Text roles
  text: "#0a0a0a",
  textStrong: "#0a0a0a",
  textMuted: "#5c5c58",
  textFaint: "#8a8a85",
  textInverse: "#ffffff",

  // Lines (hairline-first)
  line: "#d9d9d5",
  lineStrong: "#262624",
  lineHair: "#eeeeec",

  // Semantic (minimal)
  danger: "#b1372c", // discount / negative amount / warning
  warning: "#a5722a",
  success: "#2f6b3d",
  info: "#2a5680",
} as const;

// ── Brand accent (defaults; overridden per-tenant via Brand Profile.colors) ──
export const BRAND_DEFAULT = {
  primary: "#0a2145", // Deep Navy
  primaryDark: "#061532",
  primaryTint: "rgba(10, 33, 69, 0.06)",
} as const;

// ── Typography: font family labels (must match registered @react-pdf fonts) ──
// The app registers a Japanese family via src/lib/pdf/register-fonts.ts under these labels
// (backed by M PLUS 1p). Serif/num currently fall back to the sans family (Rule C — no new font
// files); a dedicated serif can be registered later without changing consumers.
export const FONT = {
  sans: "NotoSansJP",
  sansBold: "NotoSansJP-Bold",
  serif: "NotoSansJP", // fallback until a serif face is registered
  num: "NotoSansJP",
} as const;

// ── Font sizes (design px → react-pdf converts to pt ×0.75) ──────────────────
export const FS = {
  fs9: "9px",
  fs10: "10px",
  fs11: "11px",
  fs12: "12px",
  fs13: "13px",
  fs14: "14px",
  fs16: "16px",
  fs18: "18px",
  fs22: "22px",
  fs28: "28px",
  fs32: "32px",
  fs40: "40px",
} as const;

// ── Font weights ─────────────────────────────────────────────────────────────
export const FW = {
  light: 300,
  regular: 400,
  medium: 500,
  semi: 600,
  bold: 700,
} as const;

// ── Letter-spacing (react-pdf: number = pt) ──────────────────────────────────
// The design uses em tracking; react-pdf letterSpacing is absolute (pt). These are pre-scaled for
// the common label sizes (~10–11px) so uppercase overlines read correctly on A4.
export const TRACK = {
  tight: -0.2,
  normal: 0,
  wide: 0.5,
  wider: 1.2,
  widest: 2,
} as const;

// ── Line heights ─────────────────────────────────────────────────────────────
export const LH = {
  tight: 1.15,
  snug: 1.35,
  normal: 1.55,
  relaxed: 1.75,
} as const;

// ── Spacing (4px baseline; px-strings → pt ×0.75) ────────────────────────────
export const SPACE = {
  s0: 0,
  s1: "4px",
  s2: "8px",
  s3: "12px",
  s4: "16px",
  s5: "20px",
  s6: "24px",
  s7: "28px",
  s8: "32px",
  s10: "40px",
  s12: "48px",
  s16: "64px",
  s20: "80px",
} as const;

// ── Page / A4 ────────────────────────────────────────────────────────────────
export const PAGE = {
  size: "A4" as const,
  padX: "18mm",
  padY: "16mm",
} as const;

// ── Radii ────────────────────────────────────────────────────────────────────
export const RADIUS = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
  seal: "50%",
} as const;

// ── Border widths (pt) ───────────────────────────────────────────────────────
export const BW = {
  hair: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2,
  heavy: 3,
} as const;
