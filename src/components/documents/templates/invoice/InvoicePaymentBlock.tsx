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
      <BankAccountBlock account={bankAccount} title="お振込先 ・ Bank Transfer" />
    </Stack>
  );
}
