// DealerOS — AI Settings Platform: Repository Factory (Sprint 11R Phase A)
//
// Provides the default Supabase-backed factory for AI Settings repositories.
// Server actions import AI_SETTINGS_REPOSITORY_FACTORY to get repository instances.
//
// The factory pattern allows the underlying storage backend to be swapped
// without changing server action code.

import { createSupabaseAISettingsRepository } from "./settings-repository";
import { createSupabaseAIUsageRepository }    from "./usage-repository";
import type { AISettingsRepositoryFactory }   from "./repository-types";

/**
 * AI_SETTINGS_REPOSITORY_FACTORY — the default production factory.
 *
 * Server actions import this constant to obtain repository instances.
 * Each call to createSettingsRepository() / createUsageRepository() returns
 * a new instance with its own Supabase client lifecycle.
 */
export const AI_SETTINGS_REPOSITORY_FACTORY: AISettingsRepositoryFactory = {
  createSettingsRepository: () => createSupabaseAISettingsRepository(),
  createUsageRepository:    () => createSupabaseAIUsageRepository(),
};
