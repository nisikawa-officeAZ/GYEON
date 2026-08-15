// News delivery — Email provider abstraction + selector.
//
// FOUNDATION PHASE: no real email is sent. The default provider is a no-op that
// reports "skipped" with a clear reason. A real provider (Resend / SendGrid /
// SMTP) can be added later behind this same interface and selected via
// NEWS_EMAIL_PROVIDER without changing any call site.

import type { EmailProvider, EmailMessage, ProviderSendResult } from "./provider-types";

/**
 * No-op provider. Never contacts an external service. Always returns "skipped"
 * so callers can record a recipient row without performing any real delivery.
 */
class NoopEmailProvider implements EmailProvider {
  readonly name = "noop";
  readonly configured = false;

  async sendEmail(_message: EmailMessage): Promise<ProviderSendResult> {
    void _message;
    return {
      status: "skipped",
      errorMessage: "メール配信プロバイダ未設定（基盤フェーズ：実送信は無効）",
    };
  }
}

/**
 * Select the configured email provider.
 *
 * Intentionally returns the no-op provider until a real provider is approved
 * and wired. Switch on NEWS_EMAIL_PROVIDER (e.g. "resend" | "sendgrid" | "smtp")
 * here when that happens — do NOT hardcode a single provider at the call sites.
 */
export function getEmailProvider(): EmailProvider {
  // const provider = process.env.NEWS_EMAIL_PROVIDER;
  // switch (provider) {
  //   case "resend":   return new ResendEmailProvider();
  //   case "sendgrid": return new SendgridEmailProvider();
  //   case "smtp":     return new SmtpEmailProvider();
  // }
  return new NoopEmailProvider();
}
