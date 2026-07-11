// EstimatePhilosophy — the Estimate-unique GYEON Philosophy block (Serif, centered): eyebrow,
// hairline ornament, serif quote lines, attribution. Content is GYEON's brand philosophy, not tenant
// data (default provided; overridable).

import { View, Text } from "@react-pdf/renderer";
import { Stack, Overline, Caption } from "../../primitives";
import { COLOR, FONT, FS, TRACK, LH, BW } from "../../tokens";
import { DEFAULT_ESTIMATE_PHILOSOPHY, type EstimatePhilosophy as Phil } from "./estimate-data";

export function EstimatePhilosophy({ philosophy, accent }: { philosophy?: Phil; accent: string }) {
  const p = philosophy ?? DEFAULT_ESTIMATE_PHILOSOPHY;
  return (
    <Stack gap={2} wrap={false} style={{ alignItems: "center", marginVertical: 3 }}>
      <Overline style={{ letterSpacing: TRACK.widest, color: accent }}>{p.eyebrow}</Overline>
      <View style={{ width: 28, borderTopWidth: BW.thin, borderTopColor: COLOR.line, borderTopStyle: "solid", marginVertical: 1 }} />
      <Stack gap={0} style={{ alignItems: "center" }}>
        {p.lines.map((ln, i) => (
          <Text key={i} style={{ fontFamily: FONT.serif, fontSize: FS.fs14, lineHeight: LH.snug, color: COLOR.textStrong, textAlign: "center" }}>
            {ln}
          </Text>
        ))}
      </Stack>
      <Caption style={{ letterSpacing: TRACK.wide, textAlign: "center" }}>{p.attribution}</Caption>
    </Stack>
  );
}
