// Layer 3 — Meta Grid. Horizontal band of meta cells (small uppercase label over value).
// Used for period / closing date / due date / payment method. Equal-width columns.
//
// concept-b `.meta-grid`: a 1px box around the band, four equal columns divided by 1px rules, cells
// padded 8px/12px and 46px tall with their content vertically centred. The label is 7.5px with 0.2em
// tracking — deliberately smaller than the shared Overline (10px), whose size is what pushed the
// labels onto a second line — and the value is 12px semibold, or 13px in the brand colour when
// emphasised. Design px → pt at ×0.75, per the token scale.

import { View } from "@react-pdf/renderer";
import { COLOR, BW, FS, FONT, HYPHEN_PENALTY, LH } from "../tokens";
import { Text } from "../primitives/pdf-text";

const CELL_MIN_H = 34.5; // 46px
const LBL_SIZE = 5.625; // 7.5px
const LBL_TRACK = 1.125; // 0.2em of 7.5px
const VAL_TRACK = 0.18; // 0.02em of 12px

export interface MetaCell {
  label: string;
  value: string;
  /** concept-b `.meta-grid__val--emphasis` — brand-coloured, one step larger (Payment Due). */
  emphasis?: boolean;
}

export function MetaGrid({ cells, accent }: { cells: MetaCell[]; accent?: string }) {
  if (!cells.length) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: BW.thin,
        borderColor: COLOR.line,
        borderStyle: "solid",
        marginBottom: 9, // 12px
      }}
    >
      {cells.map((c, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            minHeight: CELL_MIN_H,
            justifyContent: "center",
            paddingVertical: 6, // 8px
            paddingHorizontal: 9, // 12px
            ...(i < cells.length - 1
              ? {
                  borderRightWidth: BW.thin,
                  borderRightColor: COLOR.line,
                  borderRightStyle: "solid" as const,
                }
              : {}),
          }}
        >
          <Text
            hyphenationPenalty={HYPHEN_PENALTY}
            style={{
              fontFamily: FONT.sans,
              fontSize: LBL_SIZE,
              letterSpacing: LBL_TRACK,
              textTransform: "uppercase",
              color: COLOR.textMuted,
              lineHeight: LH.snug,
              marginBottom: 2.25, // 3px
            }}
          >
            {c.label}
          </Text>
          <Text
            hyphenationPenalty={HYPHEN_PENALTY}
            style={{
              fontFamily: FONT.sansBold,
              fontSize: c.emphasis ? FS.fs13 : FS.fs12,
              letterSpacing: VAL_TRACK,
              lineHeight: 1.3,
              color: c.emphasis && accent ? accent : COLOR.textStrong,
            }}
          >
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
