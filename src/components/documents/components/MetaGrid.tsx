// Layer 3 — Meta Grid. Horizontal row of meta cells (small uppercase label over value).
// Used for period / closing date / due date etc. Equal-width columns.

import { View } from "@react-pdf/renderer";
import { Row, Stack, Overline, Value } from "../primitives";
import { COLOR, BW } from "../tokens";

export interface MetaCell {
  label: string;
  value: string;
}

export function MetaGrid({ cells }: { cells: MetaCell[] }) {
  if (!cells.length) return null;
  return (
    <Row
      style={{
        borderTopWidth: BW.thin,
        borderTopColor: COLOR.line,
        borderBottomWidth: BW.thin,
        borderBottomColor: COLOR.line,
        borderTopStyle: "solid",
        borderBottomStyle: "solid",
        paddingVertical: 8,
        marginBottom: 16,
      }}
    >
      {cells.map((c, i) => (
        <Stack key={i} gap={2} style={{ flex: 1, paddingRight: 8 }}>
          <Overline>{c.label}</Overline>
          <Value>{c.value}</Value>
        </Stack>
      ))}
    </Row>
  );
}
