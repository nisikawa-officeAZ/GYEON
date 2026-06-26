// DealerOS — LINE Rich Menu Config Validation
// Pure validation — no DB calls, no server context.
// Used by save-line-rich-menu-config.ts and publish-line-rich-menu.ts.

import type { LineRichMenuConfig } from "./line-rich-menu-types";

export interface RichMenuValidationError {
  field:   string;
  message: string;
}

export type RichMenuValidationResult =
  | { valid: true }
  | { valid: false; errors: RichMenuValidationError[] };

const MAX_LABEL_LEN     = 12;
const MAX_CHAT_BAR_LEN  = 14;
const LIFF_PATH_RE      = /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@%/?#]*$/;

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRichMenuConfig(
  config: Pick<LineRichMenuConfig, "chat_bar_text" | "buttons">,
): RichMenuValidationResult {
  const errors: RichMenuValidationError[] = [];

  // ── Chat bar text ──────────────────────────────────────────────────────────
  const barText = config.chat_bar_text?.trim() ?? "";
  if (!barText) {
    errors.push({ field: "chat_bar_text", message: "チャットバーテキストを入力してください" });
  } else if (barText.length > MAX_CHAT_BAR_LEN) {
    errors.push({ field: "chat_bar_text", message: `チャットバーテキストは${MAX_CHAT_BAR_LEN}文字以内で入力してください` });
  }

  // ── Buttons ────────────────────────────────────────────────────────────────
  if (!Array.isArray(config.buttons) || config.buttons.length !== 6) {
    errors.push({ field: "buttons", message: "ボタンは6個必要です" });
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  config.buttons.forEach((btn, i) => {
    const slot = `ボタン${i + 1}`;

    const label = btn.label?.trim() ?? "";
    if (!label) {
      errors.push({ field: `buttons[${i}].label`, message: `${slot}: ラベルを入力してください` });
    } else if (label.length > MAX_LABEL_LEN) {
      errors.push({ field: `buttons[${i}].label`, message: `${slot}: ラベルは${MAX_LABEL_LEN}文字以内で入力してください` });
    }

    switch (btn.action_type) {
      case "uri":
        if (btn.uri && !isValidHttpUrl(btn.uri)) {
          errors.push({ field: `buttons[${i}].uri`, message: `${slot}: 有効なURL（https://...）を入力してください` });
        }
        break;

      case "message":
        if (!btn.message?.trim()) {
          errors.push({ field: `buttons[${i}].message`, message: `${slot}: 送信テキストを入力してください` });
        }
        break;

      case "liff":
        if (!btn.liff_path?.trim()) {
          errors.push({ field: `buttons[${i}].liff_path`, message: `${slot}: LIFFパスを入力してください（例: /reservation）` });
        } else if (!LIFF_PATH_RE.test(btn.liff_path)) {
          errors.push({ field: `buttons[${i}].liff_path`, message: `${slot}: LIFFパスは / で始まる有効なパスを入力してください` });
        }
        break;

      case "postback":
        if (!btn.postback_data?.trim()) {
          errors.push({ field: `buttons[${i}].postback_data`, message: `${slot}: ポストバックデータを入力してください` });
        } else if (btn.postback_data.length > 300) {
          errors.push({ field: `buttons[${i}].postback_data`, message: `${slot}: ポストバックデータは300文字以内で入力してください` });
        }
        break;

      default:
        errors.push({ field: `buttons[${i}].action_type`, message: `${slot}: 不正なアクションタイプです` });
    }
  });

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Returns the first validation error message, or null if valid. */
export function getFirstValidationError(
  config: Pick<LineRichMenuConfig, "chat_bar_text" | "buttons">,
): string | null {
  const result = validateRichMenuConfig(config);
  if (result.valid) return null;
  return result.errors[0]?.message ?? "設定が不正です";
}
