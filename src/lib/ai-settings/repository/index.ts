// DealerOS — AI Settings Platform: Repository Public API (Sprint 11R Phase A)

export type {
  AISettingsStorageSource,
  AISettingsLoadResult,
  AISettingsSavePayload,
  AISettingsPersistenceTarget,
  AISettingsPersistenceResult,
  AIUsageSummaryResult,
  AISettingsRepository,
  AIUsageRepository,
  AISettingsRepositoryFactory,
} from "./repository-types";

export { createSupabaseAISettingsRepository } from "./settings-repository";
export { createSupabaseAIUsageRepository }    from "./usage-repository";
export { AI_SETTINGS_REPOSITORY_FACTORY }     from "./repository-factory";
