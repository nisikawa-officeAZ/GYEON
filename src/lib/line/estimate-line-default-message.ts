// GYEON-EST-LINE-F1-R1 — the ONE code-defined GYEON default LINE message.
//
// Pure and client-safe (no node imports): this module is the single source of
// the approved template, shared by the operator UI's textarea initializer and
// the tests — so neither ever re-spells the example text.
//
// The template renders as the ACTUAL initial textarea value (never a
// placeholder). Every dynamic line follows the approved omission rules: a line
// whose source is missing is omitted CLEANLY — an unresolved token can never
// appear in the message.

export type DefaultEstimateLineMessageInput = {
  /** From the persisted estimate's customer (display name). */
  readonly customerName: string | null | undefined;
  /** From the persisted estimate (estimate_number ?? estimate_no). */
  readonly estimateNumber: string | null | undefined;
  /** dealer_settings.business_name, server-resolved; null/absent omits its line. */
  readonly dealerDisplayName?: string | null;
};

export function buildDefaultEstimateLineMessage(input: DefaultEstimateLineMessageInput): string {
  const customer = input.customerName?.trim() || null;
  const dealer = input.dealerDisplayName?.trim() || null;
  const number = input.estimateNumber?.trim() || null;

  const lines: string[] = [];
  if (customer) {
    lines.push(`${customer} 様`);
    lines.push("");
  }
  lines.push("お世話になっております。");
  if (dealer) {
    lines.push(`${dealer}です。`);
  }
  lines.push("");
  lines.push(number
    ? `お車のお見積書（${number}）をお送りします。`
    : "お車のお見積書をお送りします。");
  lines.push("ご不明な点やご要望がございましたら、このLINEにてお気軽にご連絡ください。");
  lines.push("");
  lines.push("どうぞよろしくお願いいたします。");
  return lines.join("\n");
}
