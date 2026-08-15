// DeliveryNoteSignature — the customer acknowledgement (受領確認) block: heading + acknowledgement
// statement + the shared SignatureBlock (お客様サイン・印). Unique to the Delivery Note.

import { View } from "@react-pdf/renderer";
import { SignatureBlock } from "../../components";
import { Row, Stack, Overline, Body } from "../../primitives";
import { COLOR, BW, FS } from "../../tokens";

const DEFAULT_RECEIPT_TEXT =
  "上記のとおり、施工内容および車両状態を確認のうえ受領いたしました。 / Received the vehicle and confirmed the completion of the works listed above.";

export function DeliveryNoteSignature({ text, accent }: { text?: string; accent: string }) {
  return (
    <View
      style={{
        borderWidth: BW.hair,
        borderColor: COLOR.line,
        borderStyle: "solid",
        padding: 8,
        marginBottom: 6,
      }}
    >
      <Overline style={{ color: accent, marginBottom: 3 }}>Received ・ お客様受領確認</Overline>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <Body style={{ flex: 1, fontSize: FS.fs11, paddingRight: 12 }}>{text ?? DEFAULT_RECEIPT_TEXT}</Body>
        <Stack style={{ width: 200 }}>
          <SignatureBlock label="Signature ・ お客様サイン・印" width={200} />
        </Stack>
      </Row>
    </View>
  );
}
