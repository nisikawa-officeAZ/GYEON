// InvoicePaymentBlock — the invoice-specific left column: Payment Notes (お支払いについて) + the shared
// BankAccountBlock (お振込先). Bank values are injected from BrandProfile.bankAccount; when absent the
// bank panel hides itself (shared fallback). No tenant hardcoding.

import { NotesBlock, BankAccountBlock } from "../../components";
import { Stack } from "../../primitives";
import type { BrandBankAccount } from "../../types";

export function InvoicePaymentBlock({
  notes,
  bankAccount,
  accent,
}: {
  notes: string[];
  bankAccount?: BrandBankAccount;
  accent: string;
}) {
  return (
    <Stack gap={2}>
      <NotesBlock title="お支払いについて ・ Payment Notes" notes={notes} accent={accent} ordered />
      {/* concept-b `.payment-panel` — "Bank Transfer / お振込先" over a 下記口座にお振込ください line,
          then four rows with the branch printed on the bank line and Japanese keys. */}
      <BankAccountBlock
        account={bankAccount}
        title="Bank Transfer ・ お振込先"
        subtitle="下記口座にお振込ください"
        mergeBranch
        labels={{
          bankName: "銀行名",
          branchName: "支店",
          accountType: "口座種別",
          accountNumber: "口座番号",
          accountHolder: "口座名義",
        }}
      />
    </Stack>
  );
}
