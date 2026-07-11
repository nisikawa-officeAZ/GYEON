// Layer 3 — Serial + Page Number. Bottom-most line: doc serial (left) and `Page N / M` (right).
// Rendered `fixed` so it repeats on every page; the page label reads "Continued" until the last page.

import { View, Text } from "@react-pdf/renderer";
import { COLOR, FONT, FS, TRACK } from "../tokens";

export function SerialFooter({ serial }: { serial: string }) {
  const base = {
    fontFamily: FONT.sans,
    fontSize: FS.fs9,
    letterSpacing: TRACK.widest,
    textTransform: "uppercase" as const,
    color: COLOR.textFaint,
  };
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: "10mm",
        left: "18mm",
        right: "18mm",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text style={base}>{serial}</Text>
      <Text
        style={base}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} / ${totalPages} — ${pageNumber >= totalPages ? "End" : "Continued"}`
        }
      />
    </View>
  );
}
