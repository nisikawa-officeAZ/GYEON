// DealerOS Document Design System — Layer 2: Primitive Components (@react-pdf/renderer).
//
// Typed typography + layout primitives that encode the design tokens. Templates and Layer-3
// components compose these instead of touching raw styles. No tenant data, no business logic.

import { View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";
import { COLOR, FONT, FS, FW, TRACK, LH, BW, HYPHEN_PENALTY } from "../tokens";
import { Text } from "./pdf-text";

// Two Japanese faces are registered (regular + bold). Map any weight ≥ semi to the bold face; the
// design's medium/semi weights approximate to bold given the available faces.
function familyFor(weight: number): string {
  return weight >= FW.semi ? FONT.sansBold : FONT.sans;
}

type TextProps = { children: ReactNode; style?: Style | Style[] };

const merge = (base: Style, extra?: Style | Style[]): Style[] =>
  extra ? [base, ...(Array.isArray(extra) ? extra : [extra])] : [base];

// ── Typography roles (ported from doc-tokens.css semantic type) ──────────────

export function DocTitle({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sansBold, fontSize: FS.fs28, letterSpacing: TRACK.tight, lineHeight: LH.tight, color: COLOR.textStrong }, style)}>
      {children}
    </Text>
  );
}

export function DocSubtitle({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs11, letterSpacing: TRACK.widest, textTransform: "uppercase", color: COLOR.textMuted, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sansBold, fontSize: FS.fs11, letterSpacing: TRACK.wider, textTransform: "uppercase", color: COLOR.textStrong, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function Overline({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs10, letterSpacing: TRACK.widest, textTransform: "uppercase", color: COLOR.textMuted, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs11, color: COLOR.textMuted, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function Value({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs13, color: COLOR.textStrong, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function ValueLg({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sansBold, fontSize: FS.fs18, color: COLOR.textStrong, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs13, lineHeight: LH.normal, color: COLOR.text }, style)}>
      {children}
    </Text>
  );
}

export function Caption({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sans, fontSize: FS.fs10, lineHeight: LH.snug, color: COLOR.textFaint }, style)}>
      {children}
    </Text>
  );
}

/** Right-aligned tabular-style numeric (monospace not available; uses the numeric family). */
export function Numeric({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.num, fontSize: FS.fs13, color: COLOR.textStrong, textAlign: "right", lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function Price({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sansBold, fontSize: FS.fs13, color: COLOR.textStrong, textAlign: "right", lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

export function PriceTotal({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.sansBold, fontSize: FS.fs32, letterSpacing: TRACK.tight, textAlign: "right", lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

/** Serif variant (currently falls back to the sans face until a serif is registered). */
export function SerifTitle({ children, style }: TextProps) {
  return (
    <Text hyphenationPenalty={HYPHEN_PENALTY} style={merge({ fontFamily: FONT.serif, fontSize: FS.fs40, letterSpacing: TRACK.wide, color: COLOR.textStrong, lineHeight: LH.snug }, style)}>
      {children}
    </Text>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────

// `fixed` repeats the box at the same place on every page its wrapping parent spans — how react-pdf
// repeats a table header on continuation pages.
type BoxProps = { children?: ReactNode; style?: Style | Style[]; gap?: number; wrap?: boolean; fixed?: boolean };

export function Stack({ children, style, gap, wrap, fixed }: BoxProps) {
  return <View wrap={wrap} fixed={fixed} style={merge({ flexDirection: "column", ...(gap != null ? { gap } : {}) }, style)}>{children}</View>;
}

export function Row({ children, style, gap, wrap, fixed }: BoxProps) {
  return <View wrap={wrap} fixed={fixed} style={merge({ flexDirection: "row", ...(gap != null ? { gap } : {}) }, style)}>{children}</View>;
}

export function Spacer({ size = 8 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/** Standard 1px hairline rule. */
export function Hairline({ style }: { style?: Style | Style[] }) {
  return <View style={merge({ borderTopWidth: BW.thin, borderTopColor: COLOR.line, borderTopStyle: "solid" }, style)} />;
}

/** Emphasis rule (dark). */
export function HairlineStrong({ style }: { style?: Style | Style[] }) {
  return <View style={merge({ borderTopWidth: BW.thin, borderTopColor: COLOR.lineStrong, borderTopStyle: "solid" }, style)} />;
}
