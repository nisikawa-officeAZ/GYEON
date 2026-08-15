// Layer 3 — Signature Block. Customer receipt signature: an empty underline + label.

import { View } from "@react-pdf/renderer";
import { Stack, Row, Caption } from "../primitives";
import { COLOR, BW } from "../tokens";

export function SignatureBlock({ label = "Signature ・ サイン", width = 220 }: { label?: string; width?: number }) {
  return (
    <Stack gap={4} style={{ width }}>
      <Row style={{ height: 28, borderBottomWidth: BW.thin, borderBottomColor: COLOR.lineStrong, borderBottomStyle: "solid" }} />
      <Caption style={{ letterSpacing: 1 }}>{label}</Caption>
    </Stack>
  );
}
