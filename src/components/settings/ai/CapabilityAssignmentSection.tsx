"use client";

// DealerOS — AI Settings: Capability Assignment Section (Sprint 11U)
//
// Phase B: Per-capability provider assignment (preferred, fallback, disabled).
// Phase D: Recommendation mode selector with per-capability recommendations.
//
// Interactive: local React state mirrors the loaded assignments.
// Save: calls saveAISettingsProfile() — shows migration banner if 072 is pending.

import { useState, useTransition }           from "react";
import { saveAISettingsProfile }             from "@/lib/ai-settings/actions/save-ai-settings-profile";
import type { AICapabilityAssignmentCard }   from "@/lib/ai-settings/settings-view-models";
import type { AIProviderStatusCard }         from "@/lib/ai-settings/settings-view-models";
import type { AICapabilityAssignmentMap }    from "@/lib/ai-settings/capability-assignment";
import type { AICapabilityCategoryMetadata } from "@/lib/ai-marketplace";
import type { AIProviderRecommendation }     from "@/lib/ai-marketplace";
import type { AIRecommendationMode }         from "@/lib/ai-marketplace";
import type { AIProviderId }                 from "@/lib/ai/types";
import type { AICapability }                 from "@/lib/ai/capabilities";

const RECOMMENDATION_MODES: { mode: AIRecommendationMode; label: string; desc: string }[] = [
  { mode: "best_quality",    label: "最高品質",   desc: "精度を最優先したプロバイダーを自動選択" },
  { mode: "lowest_cost",     label: "最低コスト", desc: "コストを最優先したプロバイダーを自動選択" },
  { mode: "fastest",         label: "最速",       desc: "レスポンス速度を最優先" },
  { mode: "balanced",        label: "バランス",   desc: "品質50%・コスト25%・速度25%の加重平均" },
  { mode: "dealer_selected", label: "手動設定",   desc: "各機能のプロバイダーを手動で指定" },
];

const PROVIDER_LABELS: Record<string, string> = {
  openai:       "OpenAI",
  anthropic:    "Anthropic",
  gemini:       "Gemini",
  azure_openai: "Azure OpenAI",
  openrouter:   "OpenRouter",
};

interface LocalAssignment {
  preferred_provider: AIProviderId | null;
  fallback_provider:  AIProviderId | null;
  disabled:           boolean;
}

interface CapabilityAssignmentSectionProps {
  categories:         AICapabilityCategoryMetadata[];
  capabilityCards:    AICapabilityAssignmentCard[];
  availableProviders: AIProviderStatusCard[];
  recommendations:    AIProviderRecommendation[];
  migrationRequired:  boolean;
}

export default function CapabilityAssignmentSection({
  categories,
  capabilityCards,
  availableProviders,
  recommendations,
  migrationRequired,
}: CapabilityAssignmentSectionProps) {
  const [mode, setMode] = useState<AIRecommendationMode>("balanced");
  const [assignments, setAssignments] = useState<Record<string, LocalAssignment>>(
    () => Object.fromEntries(
      capabilityCards.map((card) => [
        card.capability,
        {
          preferred_provider: card.preferred_provider,
          fallback_provider:  card.fallback_provider,
          disabled:           card.assignment_status === "disabled",
        },
      ]),
    ),
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "migration_required" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const isManualMode = mode === "dealer_selected";

  function getRecommendedProvider(capability: AICapability): string | null {
    const rec = recommendations.find(
      (r) => r.capability === capability && r.recommendation_mode === mode,
    );
    return rec?.recommended_provider ?? null;
  }

  function updateAssignment(capability: string, patch: Partial<LocalAssignment>) {
    setAssignments((prev) => ({
      ...prev,
      [capability]: { ...prev[capability], ...patch },
    }));
    if (saveStatus === "saved") setSaveStatus("idle");
  }

  async function handleSave() {
    setSaveStatus("saving");
    startTransition(async () => {
      try {
        const capabilityMap: AICapabilityAssignmentMap = {};
        for (const [cap, assign] of Object.entries(assignments)) {
          capabilityMap[cap as AICapability] = {
            capability:         cap as AICapability,
            preferred_provider: assign.preferred_provider,
            fallback_provider:  assign.fallback_provider,
            status:             assign.disabled ? "disabled" : "preferred",
            notes:              "",
          };
        }
        const result = await saveAISettingsProfile({
          capability_assignments: capabilityMap,
        });
        if (!result.ok) {
          setSaveStatus(
            result.error.code === "MIGRATION_REQUIRED" ? "migration_required" : "error",
          );
        } else {
          setSaveStatus("saved");
        }
      } catch {
        setSaveStatus("error");
      }
    });
  }

  const enabledProviders = availableProviders.filter((p) => p.has_key_stored || p.is_primary);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">機能ごとのプロバイダー割り当て</h2>
      </div>

      {/* Migration notice */}
      {(migrationRequired || saveStatus === "migration_required") && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-950/30 border border-amber-700/40 rounded-xl">
          <span className="text-amber-400 text-sm">⚠</span>
          <div>
            <p className="text-xs font-semibold text-amber-300">設定の保存には Migration 072 が必要です</p>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              機能割り当ての変更表示は可能ですが、保存はCTO承認後の移行適用後に有効になります。
            </p>
          </div>
        </div>
      )}

      {/* Recommendation mode selector */}
      <div className="mb-5 p-4 border border-slate-800 bg-slate-900/50 rounded-xl">
        <p className="text-xs font-semibold text-slate-300 mb-3">推薦モード</p>
        <div className="flex flex-wrap gap-2">
          {RECOMMENDATION_MODES.map(({ mode: m, label, desc }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white border border-blue-500"
                  : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
              }`}
              title={desc}
            >
              {label}
            </button>
          ))}
        </div>
        {!isManualMode && (
          <p className="mt-2 text-[11px] text-slate-500">
            {RECOMMENDATION_MODES.find((m2) => m2.mode === mode)?.desc}
            — 各機能に推奨プロバイダーが表示されます
          </p>
        )}
        {isManualMode && (
          <p className="mt-2 text-[11px] text-slate-500">
            各機能のプロバイダーをドロップダウンで手動指定します
          </p>
        )}
      </div>

      {/* Capability table by category */}
      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const capCards = capabilityCards.filter((c) => {
            const catCapabilities = cat.capabilities as readonly string[];
            return catCapabilities.includes(c.capability);
          });
          if (capCards.length === 0) return null;

          return (
            <div key={cat.category} className="border border-slate-800 rounded-xl overflow-hidden">
              {/* Category header */}
              <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center gap-2">
                <span className="text-base">{cat.icon}</span>
                <span className="text-xs font-semibold text-slate-300">{cat.display_name}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{cat.category}</span>
              </div>

              {/* Capability rows */}
              <div className="divide-y divide-slate-800/60">
                {capCards.map((card) => {
                  const localAssign  = assignments[card.capability];
                  const recommended  = getRecommendedProvider(card.capability);
                  const isDisabled   = localAssign?.disabled ?? false;

                  return (
                    <div
                      key={card.capability}
                      className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 ${
                        isDisabled ? "opacity-50" : ""
                      }`}
                    >
                      {/* Capability name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">
                          {card.group_label}
                        </p>
                        <p className="text-[10px] text-slate-600 font-mono">{card.capability}</p>
                      </div>

                      {/* Recommendation badge */}
                      {!isManualMode && recommended && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-950/40 text-blue-400 border border-blue-800/40 flex-shrink-0">
                          推薦: {PROVIDER_LABELS[recommended] ?? recommended}
                        </span>
                      )}

                      {/* Manual mode controls */}
                      {isManualMode && !isDisabled && (
                        <div className="flex items-center gap-2">
                          <select
                            value={localAssign?.preferred_provider ?? ""}
                            onChange={(e) =>
                              updateAssignment(card.capability, {
                                preferred_provider: e.target.value as AIProviderId || null,
                              })
                            }
                            className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600"
                          >
                            <option value="">— 優先プロバイダー</option>
                            {enabledProviders.map((p) => (
                              <option key={p.provider_id} value={p.provider_id}>
                                {p.display_name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={localAssign?.fallback_provider ?? ""}
                            onChange={(e) =>
                              updateAssignment(card.capability, {
                                fallback_provider: e.target.value as AIProviderId || null,
                              })
                            }
                            className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-600"
                          >
                            <option value="">— フォールバック</option>
                            {enabledProviders.map((p) => (
                              <option key={p.provider_id} value={p.provider_id}>
                                {p.display_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Disable toggle */}
                      <button
                        onClick={() => updateAssignment(card.capability, { disabled: !isDisabled })}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-colors flex-shrink-0 ${
                          isDisabled
                            ? "bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700"
                            : "bg-slate-900 border-slate-700 text-slate-500 hover:bg-slate-800"
                        }`}
                      >
                        {isDisabled ? "有効化" : "無効化"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending || saveStatus === "saving"}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {isPending || saveStatus === "saving" ? "保存中..." : "設定を保存"}
        </button>

        {saveStatus === "saved" && (
          <span className="text-xs text-emerald-400">保存しました</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">保存に失敗しました</span>
        )}
        {saveStatus === "migration_required" && (
          <span className="text-xs text-amber-400">移行適用後に保存できます</span>
        )}
      </div>
    </section>
  );
}
