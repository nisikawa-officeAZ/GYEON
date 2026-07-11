// Layer 3 — Bank Account Block. Transfer details as a label/value list; numbers in the numeric face.
// All values injected from BrandProfile.bankAccount (never hardcoded).

import { View } from "@react-pdf/renderer";
import { Stack, Row, Overline, Label, Value, Numeric } from "../primitives";
import { COLOR, BW } from "../tokens";
import type { BrandBankAccount } from "../types";

export function BankAccountBlock({ account, title = "お振込先" }: { account?: BrandBankAccount; title?: string }) {
  if (!account || !account.bankName) return null;
  const rows: Array<[string, string | undefined, boolean]> = [
    ["銀行", account.bankName, false],
    ["支店", account.branchName, false],
    ["種別", account.accountType, false],
    ["口座番号", account.accountNumber, true],
    ["名義", account.accountHolder, false],
  ];
  return (
    <View
      style={{
        backgroundColor: COLOR.gray50,
        borderWidth: BW.hair,
        borderColor: COLOR.line,
        borderStyle: "solid",
        padding: 10,
        marginBottom: 16,
      }}
    >
      <Overline style={{ marginBottom: 4 }}>{title}</Overline>
      <Stack gap={1}>
        {rows
          .filter(([, v]) => !!v)
          .map(([k, v, num], i) => (
            <Row key={i} gap={8}>
              <Label style={{ width: 56 }}>{k}</Label>
              {num ? <Numeric style={{ flex: 1, textAlign: "left" }}>{v}</Numeric> : <Value style={{ flex: 1 }}>{v}</Value>}
            </Row>
          ))}
      </Stack>
    </View>
  );
}
