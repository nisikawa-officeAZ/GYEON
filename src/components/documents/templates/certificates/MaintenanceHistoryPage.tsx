// MaintenanceHistoryPage — the shared back page of every certificate.
//
// This page follows the Architect's canonical specification, NOT a concept-b mock. Deliberately
// absent, and not to be reintroduced: any box or rule around the title, an English subtitle, a logo,
// the certificate number, customer / vehicle / product information, a "No." column, and a
// "使用GYEON製品" column. The page is a blank ledger the shop writes on by hand — anything printed on
// it that the customer did not ask for is noise.
//
// Exactly five columns and exactly ten writable rows (MAINTENANCE_COLUMNS / MAINTENANCE_ROW_COUNT).
// Rows are tall enough to write in by hand, and every cell is bordered so the boundaries survive
// printing.

import { View } from "@react-pdf/renderer";
import { Text } from "../../primitives/pdf-text";
import { COLOR, BW, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import {
  MAINTENANCE_COLUMNS,
  MAINTENANCE_HISTORY_NOTE,
  MAINTENANCE_HISTORY_TITLE,
  MAINTENANCE_ROW_COUNT,
} from "./certificate-data";

/** Comfortable handwriting height — a pen needs more room than a printed line does. */
const ROW_H = 34;
const HEAD_H = 20;

export function MaintenanceHistoryPage({ accent }: { accent: string }) {
  const rows = Array.from({ length: MAINTENANCE_ROW_COUNT });

  return (
    <View>
      {/* Title — plain text, no header box, no subtitle, no mark. */}
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.serif,
          fontSize: 16.5, // 22px
          letterSpacing: 1.8,
          color: COLOR.textStrong,
          lineHeight: LH.tight,
          marginBottom: 12,
        }}
      >
        {MAINTENANCE_HISTORY_TITLE}
      </Text>

      {/* Ledger */}
      <View style={{ borderWidth: BW.thin, borderColor: COLOR.lineStrong, borderStyle: "solid" }}>
        {/* Column heads */}
        <View
          style={{
            flexDirection: "row",
            height: HEAD_H,
            backgroundColor: COLOR.gray50,
            borderBottomWidth: BW.thin,
            borderBottomColor: COLOR.lineStrong,
            borderBottomStyle: "solid",
          }}
        >
          {MAINTENANCE_COLUMNS.map((col, i) => (
            <View
              key={col.label}
              style={{
                width: col.width,
                justifyContent: "center",
                paddingHorizontal: 6,
                ...(i === MAINTENANCE_COLUMNS.length - 1
                  ? {}
                  : {
                      borderRightWidth: BW.thin,
                      borderRightColor: COLOR.lineStrong,
                      borderRightStyle: "solid" as const,
                    }),
              }}
            >
              <Text
                hyphenationPenalty={HYPHEN_PENALTY}
                style={{
                  fontFamily: FONT.sansBold,
                  fontSize: 7.5,
                  color: accent,
                  lineHeight: LH.snug,
                  textAlign: "center",
                }}
              >
                {col.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Ten blank rows */}
        {rows.map((_, r) => (
          <View
            key={r}
            style={{
              flexDirection: "row",
              height: ROW_H,
              ...(r === MAINTENANCE_ROW_COUNT - 1
                ? {}
                : {
                    borderBottomWidth: BW.thin,
                    borderBottomColor: COLOR.line,
                    borderBottomStyle: "solid" as const,
                  }),
            }}
          >
            {MAINTENANCE_COLUMNS.map((col, i) => (
              <View
                key={col.label}
                style={{
                  width: col.width,
                  ...(i === MAINTENANCE_COLUMNS.length - 1
                    ? {}
                    : {
                        borderRightWidth: BW.thin,
                        borderRightColor: COLOR.line,
                        borderRightStyle: "solid" as const,
                      }),
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Small, subtle closing note. */}
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.sans,
          fontSize: 6.375,
          color: COLOR.textMuted,
          lineHeight: 1.55,
          marginTop: 7.5,
        }}
      >
        {MAINTENANCE_HISTORY_NOTE}
      </Text>
    </View>
  );
}
