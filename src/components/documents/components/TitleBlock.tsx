// Layer 3 — Title Block. Document title (large) + right-aligned English subtitle.
// Japanese title stays on one line; the English subtitle wraps/right-aligns if needed.
//
// `titleTracking` overrides the DocTitle's default tight tracking for the documents whose concept-b
// title is letter-spaced (the Summary Invoice sets `.title-block__ja { letter-spacing: 0.12em }` and
// renders as 合 計 請 求 書). The other four titles are tight in concept-b and pass nothing.

import { View } from "@react-pdf/renderer";
import { Row, DocTitle, DocSubtitle } from "../primitives";
import type { DocumentMeta } from "../types";

export function TitleBlock({ meta, titleTracking }: { meta: DocumentMeta; titleTracking?: number }) {
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
      <DocTitle style={{ flexShrink: 0, ...(titleTracking != null ? { letterSpacing: titleTracking } : {}) }}>
        {meta.titleJa}
      </DocTitle>
      <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
        <DocSubtitle>{meta.titleEn}</DocSubtitle>
      </View>
    </Row>
  );
}
