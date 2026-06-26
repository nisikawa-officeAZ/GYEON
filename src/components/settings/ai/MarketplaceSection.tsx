"use client";

// DealerOS — AI Settings: Marketplace Section (Sprint 11U Phase C)
//
// Shows all 11 AI marketplace providers: 5 gateway + 6 extension.
// Extension providers show adapter sprint and "coming soon" status.
// Category filter allows browsing providers by capability type.

import { useState } from "react";
import type { AIProviderProfile }            from "@/lib/ai-marketplace";
import type { AICapabilityCategoryMetadata } from "@/lib/ai-marketplace";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active:           { label: "利用可能",   className: "bg-emerald-950/50 text-emerald-400 border-emerald-800/40" },
  beta:             { label: "ベータ",     className: "bg-blue-950/50 text-blue-400 border-blue-800/40" },
  coming_soon:      { label: "近日公開",   className: "bg-slate-800 text-slate-400 border-slate-700" },
  marketplace_only: { label: "マーケット", className: "bg-purple-950/50 text-purple-400 border-purple-800/40" },
  deprecated:       { label: "非推奨",     className: "bg-red-950/50 text-red-400 border-red-800/40" },
};

const COST_TIER_LABEL: Record<string, string> = {
  free:       "無料",
  budget:     "低コスト",
  standard:   "標準",
  premium:    "プレミアム",
  enterprise: "エンタープライズ",
};

const PRICING_MODEL_LABEL: Record<string, string> = {
  per_token:    "トークン課金",
  per_second:   "秒課金",
  per_image:    "画像課金",
  per_video:    "動画課金",
  subscription: "サブスク",
  credits:      "クレジット",
};

interface MarketplaceSectionProps {
  providerProfiles:       AIProviderProfile[];
  categories:             AICapabilityCategoryMetadata[];
  marketplaceModuleReady: boolean;
}

export default function MarketplaceSection({
  providerProfiles,
  categories,
  marketplaceModuleReady,
}: MarketplaceSectionProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showExtension, setShowExtension]   = useState(true);

  const filtered = providerProfiles.filter((p) => {
    if (!showExtension && p.marketplace_status === "marketplace_only") return false;
    if (filterCategory === "all") return true;
    const cat = categories.find((c) => c.category === filterCategory);
    if (!cat) return true;
    return p.supported_capabilities.some((cap) =>
      (cat.capabilities as readonly string[]).includes(cap),
    );
  });

  const gatewayCount   = providerProfiles.filter((p) => p.gateway_provider_id !== null).length;
  const extensionCount = providerProfiles.filter((p) => p.marketplace_status === "marketplace_only").length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">AIマーケットプレイス</h2>
          <p className="text-[10px] text-slate-600 mt-0.5">
            {gatewayCount} ゲートウェイ · {extensionCount} 拡張プロバイダー
          </p>
        </div>
        {!marketplaceModuleReady && (
          <span className="text-[10px] px-2 py-1 rounded-lg bg-slate-800/60 text-slate-500 border border-slate-700/40">
            Module: planned
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterCategory("all")}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
            filterCategory === "all"
              ? "bg-blue-600 text-white border-blue-500"
              : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
          }`}
        >
          すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setFilterCategory(cat.category)}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
              filterCategory === cat.category
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
            }`}
            title={cat.display_name}
          >
            {cat.icon} {cat.display_name}
          </button>
        ))}
      </div>

      {/* Extension toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowExtension((v) => !v)}
          className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
            showExtension
              ? "bg-purple-950/40 text-purple-400 border-purple-800/40"
              : "bg-slate-800 text-slate-500 border-slate-700"
          }`}
        >
          拡張プロバイダーを{showExtension ? "非表示" : "表示"}
        </button>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const statusCfg = STATUS_BADGE[p.marketplace_status] ?? STATUS_BADGE.coming_soon;
          const isExtension = p.marketplace_status === "marketplace_only";

          return (
            <div
              key={p.provider_id}
              className={`px-4 py-4 border rounded-xl flex flex-col gap-2.5 ${
                isExtension
                  ? "border-slate-800/60 bg-slate-900/30"
                  : "border-slate-800 bg-slate-900/50"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">{p.display_name}</p>
                  <p className="text-[10px] text-slate-500">{p.vendor}</p>
                </div>
                <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-md border font-medium ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                {p.description}
              </p>

              {/* Specialties */}
              {p.specialty_capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.specialty_capabilities.slice(0, 3).map((cap) => (
                    <span
                      key={cap}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60"
                    >
                      {cap}
                    </span>
                  ))}
                  {p.specialty_capabilities.length > 3 && (
                    <span className="text-[9px] text-slate-600">
                      +{p.specialty_capabilities.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Footer meta */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 mt-auto">
                <span className="text-[10px] text-slate-500">
                  {PRICING_MODEL_LABEL[p.pricing_model] ?? p.pricing_model}
                </span>
                <span className="text-slate-700">·</span>
                <span className="text-[10px] text-slate-500">
                  {COST_TIER_LABEL[p.estimated_monthly_cost_tier] ?? p.estimated_monthly_cost_tier}
                </span>
                {p.is_early_access && (
                  <>
                    <span className="text-slate-700">·</span>
                    <span className="text-[10px] text-amber-500">早期アクセス</span>
                  </>
                )}
              </div>

              {/* Adapter sprint (extension providers only) */}
              {isExtension && p.adapter_sprint && (
                <p className="text-[10px] text-slate-600">
                  アダプター実装予定: {p.adapter_sprint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center text-slate-600 text-sm">
          このカテゴリに対応するプロバイダーはありません
        </div>
      )}
    </section>
  );
}
