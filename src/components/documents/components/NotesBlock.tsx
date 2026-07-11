// Layer 3 — Notes Block. Left brand-primary bar + numbered list. Generic container for
// Notes / Care Instructions / Handling Notice / Aftercare.

import { View } from "@react-pdf/renderer";
import { Stack, Row, Overline, Body, Caption } from "../primitives";
import { COLOR, BW } from "../tokens";

export function NotesBlock({
  title,
  notes,
  accent,
  ordered = true,
}: {
  title?: string;
  notes: string[];
  accent?: string;
  ordered?: boolean;
}) {
  if (!notes.length) return null;
  const primary = accent || COLOR.textStrong;
  return (
    <View
      style={{
        borderLeftWidth: BW.thick,
        borderLeftColor: primary,
        borderLeftStyle: "solid",
        paddingLeft: 10,
        marginBottom: 16,
      }}
    >
      {title ? <Overline style={{ marginBottom: 4 }}>{title}</Overline> : null}
      <Stack gap={2}>
        {notes.map((n, i) => (
          <Row key={i} gap={6}>
            <Caption style={{ width: 14, color: COLOR.textMuted }}>{ordered ? `${i + 1}.` : "・"}</Caption>
            <Body style={{ flex: 1, fontSize: 11 }}>{n}</Body>
          </Row>
        ))}
      </Stack>
    </View>
  );
}
