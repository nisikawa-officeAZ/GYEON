// News delivery — LINE provider abstraction + selector.
//
// FOUNDATION PHASE: no real LINE message is sent. The default provider is a
// no-op that reports "skipped". A real implementation can later wrap the
// existing LINE messaging architecture (src/lib/line/*) behind this interface.

import type { LineProvider, LineMessage, ProviderSendResult } from "./provider-types";

class NoopLineProvider implements LineProvider {
  readonly name = "noop";
  readonly configured = false;

  async sendLine(_message: LineMessage): Promise<ProviderSendResult> {
    void _message;
    return {
      status: "skipped",
      errorMessage: "LINE配信プロバイダ未設定（基盤フェーズ：実送信は無効）",
    };
  }
}

/**
 * Select the configured LINE provider. Returns the no-op provider until a real
 * GYEON -> dealer LINE channel is approved and wired.
 */
export function getLineProvider(): LineProvider {
  return new NoopLineProvider();
}
