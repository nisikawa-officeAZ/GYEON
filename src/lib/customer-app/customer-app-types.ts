// Customer App foundation — shared types. Pure module.

export type CustomerAppTheme = "system" | "light" | "dark";

export interface CustomerAppSettings {
  enabled:         boolean;
  app_name:        string | null;
  welcome_message: string | null;
  theme:           CustomerAppTheme;
  points_enabled:  boolean;
}

export const EMPTY_CUSTOMER_APP_SETTINGS: CustomerAppSettings = {
  enabled:         false,
  app_name:        null,
  welcome_message: null,
  theme:           "system",
  points_enabled:  false,
};

export const CUSTOMER_APP_THEMES: CustomerAppTheme[] = ["system", "light", "dark"];
