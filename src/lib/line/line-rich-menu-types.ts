// DealerOS — LINE Rich Menu Types (Pro+)
// Config stored in dealer_settings.line_public_settings.rich_menu (PHASE70 jsonb column).
// No new migration required.

// ─── Action types ─────────────────────────────────────────────────────────────

export type RichMenuActionType =
  | "uri"       // Open external URL
  | "message"   // Send text message on behalf of user
  | "liff"      // Open LIFF app at a relative path (URL constructed server-side)
  | "postback"; // Send postback data to webhook (requires webhook_url configured)

// ─── Button purpose ───────────────────────────────────────────────────────────
// Semantic identity of each button slot. Fixed per slot position (index 0–5).
// Used by future AI agents to locate the correct button for workflow integration.

export type RichMenuButtonPurpose =
  | "reservation"   // Slot 0 — future: online booking integration
  | "service_menu"  // Slot 1 — service catalog / menu page
  | "maintenance"   // Slot 2 — future: maintenance reminder workflow (Phase B)
  | "review"        // Slot 3 — future: AI Reputation Agent (PHASE 77)
  | "gallery"       // Slot 4 — work photos / completion report gallery
  | "inquiry"       // Slot 5 — dealer inquiry / contact
  | "custom";       // Custom slot with no specific workflow connection

/** Default purpose for each slot by index (0–5). Used as fallback in parseRichMenuConfig. */
export const SLOT_PURPOSE_DEFAULTS: RichMenuButtonPurpose[] = [
  "reservation",
  "service_menu",
  "maintenance",
  "review",
  "gallery",
  "inquiry",
];

/** Future workflow hints shown in settings UI and used by AI agents. */
export const FUTURE_WORKFLOW_HINTS: Partial<Record<RichMenuButtonPurpose, string>> = {
  reservation: "将来: オンライン予約連携（計画中）",
  maintenance:  "将来: メンテナンスリマインダー連携",
  review:       "将来: AI評判管理エージェント連携（PHASE 77）",
};

// ─── Button ───────────────────────────────────────────────────────────────────

export interface RichMenuButton {
  /** Display label on the rich menu image (max 12 chars). */
  label:         string;
  /** Semantic slot identity — fixed per position; drives future workflow connections. */
  purpose:       RichMenuButtonPurpose;
  action_type:   RichMenuActionType;
  /** External URL (action_type: "uri"). Empty string when unused. */
  uri:           string;
  /** Relative LIFF path (action_type: "liff"), e.g. "/reservation".
   *  Full URL constructed server-side: https://liff.line.me/{liff_id}{liff_path} */
  liff_path:     string;
  /** Message text sent to chat (action_type: "message"). */
  message:       string;
  /** Postback data string (action_type: "postback"). Requires webhook_url configured. */
  postback_data: string;
}

export type RichMenuButtons = [
  RichMenuButton, RichMenuButton, RichMenuButton,
  RichMenuButton, RichMenuButton, RichMenuButton
];

// ─── Config ───────────────────────────────────────────────────────────────────

export interface LineRichMenuConfig {
  enabled:       boolean;
  rich_menu_id:  string | null;  // ID returned by LINE API after creation
  chat_bar_text: string;
  buttons:       RichMenuButtons;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const EMPTY_BTN_BASE = { uri: "", liff_path: "", message: "", postback_data: "" };

export const DEFAULT_RICH_MENU_BUTTONS: RichMenuButtons = [
  { ...EMPTY_BTN_BASE, label: "予約する",     purpose: "reservation",  action_type: "uri" },
  { ...EMPTY_BTN_BASE, label: "施工メニュー", purpose: "service_menu",  action_type: "uri" },
  { ...EMPTY_BTN_BASE, label: "メンテナンス", purpose: "maintenance",   action_type: "uri" },
  { ...EMPTY_BTN_BASE, label: "レビュー投稿", purpose: "review",        action_type: "uri" },
  { ...EMPTY_BTN_BASE, label: "施工事例",     purpose: "gallery",       action_type: "uri" },
  { ...EMPTY_BTN_BASE, label: "お問い合わせ", purpose: "inquiry",       action_type: "message", message: "お問い合わせ" },
];

export const DEFAULT_RICH_MENU_CONFIG: LineRichMenuConfig = {
  enabled:       false,
  rich_menu_id:  null,
  chat_bar_text: "メニュー",
  buttons:       DEFAULT_RICH_MENU_BUTTONS,
};

// ─── Config parser (safe for client and server) ───────────────────────────────

export function parseRichMenuConfig(raw: unknown): LineRichMenuConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RICH_MENU_CONFIG };
  const obj = raw as Record<string, unknown>;

  const rawButtons = Array.isArray(obj.buttons) ? obj.buttons : [];
  const buttons: RichMenuButtons = [0, 1, 2, 3, 4, 5].map((i) => {
    const b   = rawButtons[i] as Record<string, unknown> | undefined;
    const def = DEFAULT_RICH_MENU_BUTTONS[i];
    if (!b || typeof b !== "object") return { ...def };

    const action_type = (["uri", "message", "liff", "postback"] as RichMenuActionType[])
      .includes(b.action_type as RichMenuActionType)
      ? (b.action_type as RichMenuActionType)
      : def.action_type;

    const purpose = (["reservation", "service_menu", "maintenance", "review", "gallery", "inquiry", "custom"] as RichMenuButtonPurpose[])
      .includes(b.purpose as RichMenuButtonPurpose)
      ? (b.purpose as RichMenuButtonPurpose)
      : SLOT_PURPOSE_DEFAULTS[i];  // Backward compat: derive from slot position

    return {
      label:         typeof b.label         === "string" ? b.label : def.label,
      purpose,
      action_type,
      uri:           typeof b.uri           === "string" ? b.uri           : "",
      liff_path:     typeof b.liff_path     === "string" ? b.liff_path     : "",
      message:       typeof b.message       === "string" ? b.message       : "",
      postback_data: typeof b.postback_data === "string" ? b.postback_data : "",
    };
  }) as RichMenuButtons;

  return {
    enabled:       typeof obj.enabled === "boolean" ? obj.enabled : false,
    rich_menu_id:  typeof obj.rich_menu_id === "string" ? obj.rich_menu_id : null,
    chat_bar_text: typeof obj.chat_bar_text === "string" && obj.chat_bar_text.trim()
      ? obj.chat_bar_text
      : "メニュー",
    buttons,
  };
}
