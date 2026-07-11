// Layer 3 — Title Block. Document title (large) + right-aligned English subtitle.
// Japanese title stays on one line; the English subtitle wraps/right-aligns if needed.

import { View } from "@react-pdf/renderer";
import { Row, DocTitle, DocSubtitle } from "../primitives";
import type { DocumentMeta } from "../types";

export function TitleBlock({ meta }: { meta: DocumentMeta }) {
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <DocTitle style={{ flexShrink: 0 }}>{meta.titleJa}</DocTitle>
      <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
        <DocSubtitle>{meta.titleEn}</DocSubtitle>
      </View>
    </Row>
  );
}
