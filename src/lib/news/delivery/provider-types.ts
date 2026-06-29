// News delivery — provider-agnostic message & result types.
// Pure module (no DB / no side effects). These types intentionally avoid any
// provider-specific shapes so Resend / SendGrid / SMTP / LINE can be plugged in
// later without touching call sites.

export interface EmailMessage {
  to:        string;
  subject:   string;
  html:      string;
  text:      string;
  fromName?: string;
  fromEmail?: string;
}

export interface LineMessage {
  /** Provider-specific destination (e.g. LINE user/room id). */
  to:    string;
  title: string;
  text:  string;
}

export type ProviderSendStatus = "sent" | "failed" | "skipped";

export interface ProviderSendResult {
  status:       ProviderSendStatus;
  /** Populated for failed/skipped to explain why (stored on the recipient row). */
  errorMessage?: string;
  /** Provider message id when available (sent). */
  providerId?:  string;
}

export interface EmailProvider {
  readonly name: string;
  /** True only when real credentials are configured. */
  readonly configured: boolean;
  sendEmail(message: EmailMessage): Promise<ProviderSendResult>;
}

export interface LineProvider {
  readonly name: string;
  readonly configured: boolean;
  sendLine(message: LineMessage): Promise<ProviderSendResult>;
}
