// R92B-H1 — pure audit-log redaction for share-link (pdf-link) LINE messages.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// A pdf-link message carries a working, tokenized share URL. LINE must receive
// that URL, but `line_message_logs` must NOT persist it: a raw share token in the
// audit trail is exactly the exposure the tokenized design exists to prevent.
// This module produces an AUDIT-SAFE copy — every text body/message is replaced
// with a FIXED placeholder — so the persisted record proves a pdf-link was sent
// without recording anything a reader could use to open the share.
//
// It is PURE: no directive, no I/O, no clock. Only a type-only import (erased at
// runtime), so it runs directly under `node --import tsx --test`.

import type { LineMessage } from "./line-types";

/**
 * The single fixed marker written in place of any share text/body. It contains
 * no URL and no token — by construction it cannot leak the share.
 */
export const SHARE_LOG_REDACTED_PLACEHOLDER = "[共有リンクは監査ログに記録しません]";

export type ShareLogRedaction =
  | { readonly ok: true; readonly messages: LineMessage[]; readonly body: string }
  | { readonly ok: false };

/**
 * Build an audit-safe copy of a share message set.
 *
 * FAIL CLOSED: only an all-text message set can be safely redacted by
 * substitution. An empty set, or any non-text message (image/template/flex) that
 * might embed a link we cannot rewrite, returns `{ ok: false }` so the caller
 * aborts BEFORE the LINE request rather than persist an un-auditable record.
 *
 * On success EVERY text is replaced with the fixed placeholder — the redaction is
 * total, never a best-effort URL strip that could miss a variant.
 */
export function redactShareLog(input: { messages: readonly LineMessage[]; body: string }): ShareLogRedaction {
  const { messages } = input;
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false };

  const redacted: LineMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object" || (m as { type?: unknown }).type !== "text") {
      return { ok: false };
    }
    redacted.push({ type: "text", text: SHARE_LOG_REDACTED_PLACEHOLDER });
  }

  return { ok: true, messages: redacted, body: SHARE_LOG_REDACTED_PLACEHOLDER };
}
