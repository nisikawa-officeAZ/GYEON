// CertificateSignature — customer + installer signature rules.
//
// IMPORTANT: the approved concept-b certificate fronts carry NO signature block. This component is
// therefore opt-in — it renders only when `signatures` is present in the certificate data, so a
// certificate issued without it is pixel-identical to the approved design. It exists because the
// certificate contract must be able to carry both signatures; the Architect decides per-document
// whether to show them.

import { View } from "@react-pdf/renderer";
import { Row, Stack, Caption } from "../../primitives";
import { Text } from "../../primitives/pdf-text";
import { COLOR, BW, FS, FONT, LH, HYPHEN_PENALTY } from "../../tokens";
import type { CertificateSignatures } from "./certificate-data";
import { scaled, type CertificateScale } from "./certificate-scale";

function SignatureField({
  label,
  name,
  accent,
  u,
}: {
  label: string;
  name?: string;
  accent: string;
  u: (n: number) => number;
}) {
  return (
    <Stack gap={0} style={{ flex: 1 }}>
      <Text
        hyphenationPenalty={HYPHEN_PENALTY}
        style={{
          fontFamily: FONT.sansBold,
          fontSize: u(6.375),
          letterSpacing: u(1.15),
          textTransform: "uppercase",
          color: accent,
          lineHeight: LH.snug,
          marginBottom: u(4.5),
        }}
      >
        {label}
      </Text>
      {/* The rule the signature is written on — kept tall enough to sign by hand. */}
      <View
        style={{
          height: Math.max(18, u(22)), // never let the writable rule shrink below a signable height
          borderBottomWidth: BW.thin,
          borderBottomColor: COLOR.lineStrong,
          borderBottomStyle: "solid",
          justifyContent: "flex-end",
        }}
      >
        {name ? (
          <Text
            hyphenationPenalty={HYPHEN_PENALTY}
            style={{ fontFamily: FONT.sans, fontSize: u(FS.fs12), color: COLOR.textStrong, paddingBottom: 2 }}
          >
            {name}
          </Text>
        ) : null}
      </View>
      <Caption style={{ fontSize: u(6.375), color: COLOR.textMuted, marginTop: 2 }}>Signature ・ 署名</Caption>
    </Stack>
  );
}

export function CertificateSignature({
  signatures,
  accent,
  scale = 1,
}: {
  signatures: CertificateSignatures;
  accent: string;
  scale?: CertificateScale;
}) {
  const u = scaled(scale);
  return (
    <Row gap={u(15)} style={{ marginBottom: u(10.5), alignItems: "flex-start" }}>
      <SignatureField label={signatures.customerLabel} accent={accent} u={u} />
      <SignatureField label={signatures.installerLabel} name={signatures.installerName} accent={accent} u={u} />
    </Row>
  );
}
