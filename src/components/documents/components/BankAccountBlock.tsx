// Layer 3 — Bank Account Block. Transfer details as a label/value list; numbers in the numeric face.
// All values injected from BrandProfile.bankAccount (never hardcoded).

import { View } from "@react-pdf/renderer";
import { Stack, Row, Overline, Label, Value, Numeric, Caption } from "../primitives";
import { COLOR, BW, FS } from "../tokens";
import type { BrandBankAccount } from "../types";

/** Row keys. concept-b localises these per document: the Summary Invoice's `.bank-block` uses English
 *  keys (Bank / Branch / Type / Account No. / Holder), the single-case Invoice uses Japanese ones. */
export interface BankAccountLabels {
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
}

const JA_LABELS: BankAccountLabels = {
  bankName: "銀行",
  branchName: "支店",
  accountType: "種別",
  accountNumber: "口座番号",
  accountHolder: "名義",
};

export function BankAccountBlock({
  account,
  title = "お振込先",
  subtitle,
  labels = JA_LABELS,
  mergeBranch = false,
}: {
  account?: BrandBankAccount;
  title?: string;
  /** concept-b `.payment-panel__title-ja` — the Invoice adds a "下記口座にお振込ください" line. */
  subtitle?: string;
  labels?: BankAccountLabels;
  /** concept-b's Invoice `.payment-panel` prints the branch on the bank line (滋賀銀行　守山支店) and
   *  so lists four rows; the Summary Invoice keeps Bank and Branch on separate rows. */
  mergeBranch?: boolean;
}) {
  if (!account || !account.bankName) return null;
  const bankLine = mergeBranch
    ? [account.bankName, account.branchName].filter(Boolean).join("　")
    : account.bankName;
  const rows: Array<[string, string | undefined, boolean]> = [
    [labels.bankName, bankLine, false],
    ...(mergeBranch
      ? []
      : ([[labels.branchName, account.branchName, false]] as Array<[string, string | undefined, boolean]>)),
    [labels.accountType, account.accountType, false],
    [labels.accountNumber, account.accountNumber, true],
    [labels.accountHolder, account.accountHolder, false],
  ];
  return (
    <View
      style={{
        backgroundColor: COLOR.gray50,
        borderWidth: BW.hair,
        borderColor: COLOR.line,
        borderStyle: "solid",
        padding: 7,
        marginBottom: 6,
      }}
    >
      <Overline style={{ marginBottom: subtitle ? 1 : 3 }}>{title}</Overline>
      {subtitle ? <Caption style={{ fontSize: FS.fs9, marginBottom: 3 }}>{subtitle}</Caption> : null}
      <Stack gap={0.5}>
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
