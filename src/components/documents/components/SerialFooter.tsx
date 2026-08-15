// Layer 3 — Serial + Page Number. Bottom-most line: doc serial (left) and `Page N / M` (right).
// Rendered `fixed` so it repeats on every page; the page label reads "Continued" until the last page.
//
// Positioning note: `fixed` + `position: absolute` must sit on the Text nodes themselves and use
// numeric pt offsets. A wrapping absolute View with mm offsets does NOT lay out here — yoga resolves
// it against the paper box (not the page content box), stretches it to the full page height when no
// `height`/`top` is given, and its children never paint.

import { Text } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { COLOR, FONT, FS, PAGE_PT, TRACK } from "../tokens";

/**
 * `label` overrides the left-hand text. concept-b's Summary Invoice puts the billed party alongside
 * the serial there (`SIN · 2026 · 00001 · 藤田自動車工業`) so a detached page still names its customer;
 * the other four documents show the serial alone.
 */
export function SerialFooter({ serial, label }: { serial: string; label?: string }) {
  const base: Style = {
    position: "absolute",
    bottom: PAGE_PT.footerBottom,
    fontFamily: FONT.sans,
    fontSize: FS.fs9,
    color: COLOR.textFaint,
  };
  return (
    <>
      <Text
        fixed
        style={{ ...base, left: PAGE_PT.padX, letterSpacing: TRACK.widest, textTransform: "uppercase" }}
      >
        {label ?? serial}
      </Text>
      {/* Neither `letterSpacing` nor `textTransform` may be set on a `render` Text: either one makes
          react-pdf drop the dynamically produced string entirely (it lays out to nothing and never
          paints). The label is emitted pre-cased instead; the lost tracking is imperceptible at 6.75pt. */}
      <Text
        fixed
        style={{ ...base, right: PAGE_PT.padX, textAlign: "right" }}
        render={({ pageNumber, totalPages }) =>
          `PAGE ${pageNumber} / ${totalPages} — ${pageNumber >= totalPages ? "END" : "CONTINUED"}`
        }
      />
    </>
  );
}
