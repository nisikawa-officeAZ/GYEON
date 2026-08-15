// SummaryInvoicePaymentBlock — concept-b closing payment zone:
//   Bank Account · お振込先 (shared BankAccountBlock) | Payment Notice · お支払い上の注意,
//   then the navy Current Amount Due bar (今回請求額 · 税込). Bank details from BrandProfile; the due
//   amount is STORED (never computed). Navy reversal mirrors the shared Grand Total rule.

import { View } from "@react-pdf/renderer";
import { BankAccountBlock } from "../../components";
import { Row, Stack, Overline, Caption, Value } from "../../primitives";
import { COLOR, BW, FS, FONT, TRACK, LH, HYPHEN_PENALTY } from "../../tokens";
import { formatYen } from "../../brand";
import type { BrandProfile } from "../../types";
import { Text } from "../../primitives/pdf-text";

export function SummaryInvoicePaymentBlock({
  brand,
  currentAmountDue,
  currentAmountDueNote,
  paymentNotice,
}: {
  brand: BrandProfile;
  currentAmountDue: number;
  currentAmountDueNote?: string;
  paymentNotice?: string[];
}) {
  const primary = brand.colors.primary || COLOR.textStrong;
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <Row gap={16} style={{ alignItems: "stretch", marginBottom: 5 }}>
        {/* Bank account (shared component) */}
        <View style={{ flex: 1 }}>
          {/* concept-b `.bank-block` keys are English on the Summary Invoice (the single-case
              Invoice keeps Japanese ones). */}
          <BankAccountBlock
            account={brand.bankAccount}
            title="お振込先 · Bank Account"
            labels={{
              bankName: "Bank",
              branchName: "Branch",
              accountType: "Type",
              accountNumber: "Account No.",
              accountHolder: "Holder",
            }}
          />
        </View>

        {/* Payment notice */}
        {paymentNotice && paymentNotice.length ? (
          <Stack gap={0} style={{ flex: 1.1, borderWidth: BW.hair, borderColor: COLOR.line, borderStyle: "solid", padding: 7 }}>
            <Overline style={{ fontSize: FS.fs9, marginBottom: 3 }}>お支払い上の注意 · Payment Notice</Overline>
            <Stack gap={2}>
              {paymentNotice.map((t, i) => (
                <Caption key={i} style={{ fontSize: FS.fs9, lineHeight: 1.4, color: COLOR.textMuted }}>{t}</Caption>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Row>

      {/* Navy Current Amount Due bar */}
      <Row style={{ backgroundColor: primary, paddingVertical: 6, paddingHorizontal: 14, justifyContent: "space-between", alignItems: "center" }}>
        <Stack gap={1}>
          <Overline style={{ fontSize: FS.fs9, color: COLOR.textInverse, letterSpacing: TRACK.wider }}>Current Amount Due</Overline>
          <Value style={{ fontSize: FS.fs12, color: COLOR.textInverse }}>今回請求額（税込）</Value>
          {currentAmountDueNote ? <Caption style={{ fontSize: FS.fs9, color: COLOR.gray200 }}>{currentAmountDueNote}</Caption> : null}
        </Stack>
        <Row gap={4} style={{ alignItems: "baseline" }}>
          <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.sansBold, fontSize: FS.fs32, letterSpacing: TRACK.tight, color: COLOR.textInverse, lineHeight: LH.snug }}>{formatYen(currentAmountDue)}</Text>
          <Text hyphenationPenalty={HYPHEN_PENALTY} style={{ fontFamily: FONT.sans, fontSize: FS.fs11, color: COLOR.gray200, lineHeight: LH.snug }}>JPY</Text>
        </Row>
      </Row>
    </View>
  );
}
