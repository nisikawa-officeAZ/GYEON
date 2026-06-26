// Barrel export for Settings Save Action module (Sprint 12J)
export type {
  SettingsSaveActionId,
  SettingsSaveActionStatus,
  SettingsSaveActionPolicy,
  SettingsSaveAction,
  SettingsSaveActionRegistry,
} from "./save-action-types";

export {
  SETTINGS_SAVE_ACTION_REGISTRY,
  getSaveActionsForCategory,
  getCategorySaveStatus,
  canEditWithRole,
} from "./save-action-registry";
