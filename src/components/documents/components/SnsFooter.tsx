// Layer 3 — SNS QR Footer. Up to 4 QR slots (Instagram / LINE / YouTube / TikTok).
// If BrandProfile.qrLinks is empty the whole zone is hidden (fallback rule).
//
// concept-b `.doc-footer-v2__qr-item`: SNS glyph (18px) above the QR artwork (56px in a hairline
// box) above the channel label (8.5px). Both images come from the link itself — `iconUrl` and
// `qrImageUrl` — so this component never reaches for an asset directly. A link with no QR artwork
// still draws the empty bordered box, which is the documented fallback while QR generation is
// deferred (README §10).

import { View, Image } from "@react-pdf/renderer";
import { Row, Stack, Caption } from "../primitives";
import { COLOR, BW, FS } from "../tokens";
import type { BrandQrLink } from "../types";

type QrLink = BrandQrLink & { qrImageUrl?: string };

// concept-b draws the glyph at 18px over a 56px QR. Templates render the QR smaller than the mock to
// fit DealerOS's denser pages, so the glyph is derived from the QR rather than fixed at 18px — that
// keeps the mock's 18:56 proportion at whatever size a template asks for.
const ICON_RATIO = 18 / 56;
const LABEL_TRACK = 0.38; // 0.06em of 8.5px

export function SnsFooter({ links, size = 42 /* 56px */ }: { links: QrLink[]; size?: number }) {
  if (!links.length) return null;
  const icon = size * ICON_RATIO;
  const qrBox = {
    width: size,
    height: size,
    borderWidth: BW.thin,
    borderColor: COLOR.line,
    borderStyle: "solid" as const,
  };
  return (
    <Row gap={9} style={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
      {links.slice(0, 4).map((l, i) => (
        <Stack key={i} gap={2} style={{ alignItems: "center", width: size }}>
          {l.iconUrl ? <Image src={l.iconUrl} style={{ width: icon, height: icon, objectFit: "contain" }} /> : null}
          {l.qrImageUrl ? (
            <Image src={l.qrImageUrl} style={qrBox} />
          ) : (
            <View style={{ ...qrBox, backgroundColor: COLOR.gray50 }} />
          )}
          <Caption style={{ fontSize: FS.fs9, letterSpacing: LABEL_TRACK, color: COLOR.textMuted }}>{l.label}</Caption>
        </Stack>
      ))}
    </Row>
  );
}
