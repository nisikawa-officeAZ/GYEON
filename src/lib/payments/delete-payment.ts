"use server";

// B3-B1B I1 — payment deletion is DISABLED.
//
// Deleting a payment is a financial correction. Corrections require a separately designed
// atomic correction RPC (a later phase); until then this action fails closed immediately,
// with ZERO Supabase, authorization-helper, audit-log, recalculation, or notification
// calls. The database additionally guards via the issued-statement freeze trigger and the
// payment_allocations ON DELETE RESTRICT foreign key if this boundary were ever bypassed.
// ("use server" files may export only async functions, so the message stays module-local.)

const PAYMENT_DELETION_DISABLED_MESSAGE =
  "入金の削除は現在無効です。金銭訂正は今後提供される訂正機能で行ってください";

export async function deletePayment(
  _id: string
): Promise<{ error: string } | { success: true }> {
  return { error: PAYMENT_DELETION_DISABLED_MESSAGE };
}
