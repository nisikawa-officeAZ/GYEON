// Layer 3 — SNS QR Footer. Up to 4 QR slots (Instagram / LINE / YouTube / TikTok).
// If BrandProfile.qrLinks is empty the whole zone is hidden (fallback rule). QR image generation
// (url → SVG/PNG) is deferred (README §10); when a link carries a pre-rendered `qrImageUrl` it is
// shown, otherwise a labelled placeholder box is drawn.

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption } from "../primitives";
import { COLOR, BW, RADIUS, FS } from "../tokens";
import type { BrandQrLink } from "../types";

type QrLink = BrandQrLink & { qrImageUrl?: string };

export function SnsFooter({ links, size = 46 }: { links: QrLink[]; size?: number }) {
  if (!links.length) return null;
  return (
    <Row gap={12} style={{ justifyContent: "flex-start" }}>
      {links.slice(0, 4).map((l, i) => (
        <Stack key={i} gap={2} style={{ alignItems: "center", width: size + 8 }}>
          {l.qrImageUrl ? (
            <Image src={l.qrImageUrl} style={{ width: size, height: size }} />
          ) : (
            <View
              style={{
                width: size,
                height: size,
                borderWidth: BW.thin,
                borderColor: COLOR.line,
                borderStyle: "solid",
                borderRadius: RADIUS.sm,
                backgroundColor: COLOR.gray50,
              }}
            />
          )}
          <Caption style={{ fontSize: FS.fs9, letterSpacing: 1, textTransform: "uppercase" }}>{l.label}</Caption>
        </Stack>
      ))}
    </Row>
  );
}
