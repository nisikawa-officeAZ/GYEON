// DealerOS — LINE Rich Menu Types (Pro+)
// Config stored in dealer_settings.line_public_settings.rich_menu (PHASE70 jsonb column).
// No new migration required.

export type RichMenuActionType = "uri" | "message";

export interface RichMenuButton {
  label:       string;
  action_type: RichMenuActionType;
  uri:         string;     // URL for uri actions (empty string when unused)
  message:     string;     // Text for message actions (empty string when unused)
}

export type RichMenuButtons = [
  RichMenuButton, RichMenuButton, RichMenuButton,
  RichMenuButton, RichMenuButton, RichMenuButton
];

export interface LineRichMenuConfig {
  enabled:       boolean;
  rich_menu_id:  string | null;  // ID returned by LINE API after creation
  chat_bar_text: string;
  buttons:       RichMenuButtons;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_RICH_MENU_BUTTONS: RichMenuButtons = [
  { label: "予約する",     action_type: "uri",     uri: "", message: "" },
  { label: "施工メニュー", action_type: "uri",     uri: "", message: "" },
  { label: "メンテナンス", action_type: "uri",     uri: "", message: "" },
  { label: "レビュー投稿", action_type: "uri",     uri: "", message: "" },
  { label: "施工事例",     action_type: "uri",     uri: "", message: "" },
  { label: "お問い合わせ", action_type: "message", uri: "", message: "お問い合わせ" },
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
    const b = rawButtons[i] as Record<string, unknown> | undefined;
    const def = DEFAULT_RICH_MENU_BUTTONS[i];
    if (!b || typeof b !== "object") return { ...def };
    return {
      label:       typeof b.label === "string" ? b.label : def.label,
      action_type: b.action_type === "message" ? "message" as const : "uri" as const,
      uri:         typeof b.uri === "string" ? b.uri : "",
      message:     typeof b.message === "string" ? b.message : "",
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
