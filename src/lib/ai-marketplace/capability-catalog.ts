// DealerOS — AI Capability Marketplace: Capability Catalog (Sprint 11S Phase B)
//
// Defines all 19 AIMarketplaceCapability values with metadata:
//   - Display name and description
//   - Category assignment (14 categories)
//   - Plan requirement
//   - Whether the capability maps to a base AICapability in the gateway layer
//
// The 16 base AICapability values (src/lib/ai/capabilities.ts) are all present here.
// Three extension capabilities are added: translation, voice_synthesis, voice_cloning.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AICapability } from "@/lib/ai/capabilities";
import type {
  AICapabilityCategory,
  AIMarketplaceCapability,
} from "./marketplace-types";

// ─── Capability metadata ──────────────────────────────────────────────────────

export interface AICapabilityMetadata {
  capability:          AIMarketplaceCapability;
  display_name:        string;
  description:         string;
  category:            AICapabilityCategory;
  requires_plan:       "basic" | "pro" | "pro_plus";
  is_base_capability:  boolean;   // true if also in AICapability (gateway layer)
}

// ─── Category metadata ────────────────────────────────────────────────────────

export interface AICapabilityCategoryMetadata {
  category:     AICapabilityCategory;
  display_name: string;
  description:  string;
  icon:         string;   // Heroicons name (informational — not imported here)
  capabilities: AIMarketplaceCapability[];
}

// ─── Capability catalog ───────────────────────────────────────────────────────

export const CAPABILITY_CATALOG: AICapabilityMetadata[] = [
  // ── Chat ──────────────────────────────────────────────────────────────────
  {
    capability:         "text_generation",
    display_name:       "Text Generation",
    description:        "Generate natural language text for any content type",
    category:           "chat",
    requires_plan:      "basic",
    is_base_capability: true,
  },
  {
    capability:         "chat_completion",
    display_name:       "Chat Completion",
    description:        "Multi-turn conversational AI with full context memory",
    category:           "chat",
    requires_plan:      "basic",
    is_base_capability: true,
  },
  {
    capability:         "function_calling",
    display_name:       "Function Calling",
    description:        "Structured tool use and JSON output via provider APIs",
    category:           "chat",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  {
    capability:         "embeddings",
    display_name:       "Embeddings",
    description:        "Vector embedding generation for semantic search and clustering",
    category:           "chat",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── OCR ────────────────────────────────────────────────────────────────────
  {
    capability:         "vision",
    display_name:       "Vision",
    description:        "Image understanding and visual content analysis",
    category:           "ocr",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  {
    capability:         "ocr",
    display_name:       "OCR",
    description:        "Optical character recognition for documents, forms, and invoices",
    category:           "ocr",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── Translation ────────────────────────────────────────────────────────────
  {
    capability:         "translation",
    display_name:       "Translation",
    description:        "Natural language translation across multiple languages",
    category:           "translation",
    requires_plan:      "pro",
    is_base_capability: false,
  },
  // ── Image Generation ───────────────────────────────────────────────────────
  {
    capability:         "image_generation",
    display_name:       "Image Generation",
    description:        "Create images from text prompts for marketing and social media",
    category:           "image_generation",
    requires_plan:      "pro_plus",
    is_base_capability: true,
  },
  // ── Video Generation ───────────────────────────────────────────────────────
  {
    capability:         "video_generation",
    display_name:       "Video Generation",
    description:        "Create marketing video content from photos and text prompts",
    category:           "video_generation",
    requires_plan:      "pro_plus",
    is_base_capability: true,
  },
  // ── Voice ──────────────────────────────────────────────────────────────────
  {
    capability:         "voice_synthesis",
    display_name:       "Voice Synthesis",
    description:        "Convert text to natural-sounding speech for audio content",
    category:           "voice",
    requires_plan:      "pro_plus",
    is_base_capability: false,
  },
  {
    capability:         "voice_cloning",
    display_name:       "Voice Cloning",
    description:        "Create a custom voice model from audio samples",
    category:           "voice",
    requires_plan:      "pro_plus",
    is_base_capability: false,
  },
  // ── SEO ────────────────────────────────────────────────────────────────────
  {
    capability:         "seo_analysis",
    display_name:       "SEO Analysis",
    description:        "Search engine optimization keyword analysis and recommendations",
    category:           "seo",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── MEO ────────────────────────────────────────────────────────────────────
  {
    capability:         "meo_analysis",
    display_name:       "MEO Analysis",
    description:        "Map engine optimization for Google Business Profile",
    category:           "meo",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── AEO ────────────────────────────────────────────────────────────────────
  {
    capability:         "aeo_analysis",
    display_name:       "AEO Analysis",
    description:        "Answer engine optimization for featured snippets and PAA",
    category:           "aeo",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── LLMO ───────────────────────────────────────────────────────────────────
  {
    capability:         "llmo_analysis",
    display_name:       "LLMO Analysis",
    description:        "LLM optimization for AI training data visibility",
    category:           "llmo",
    requires_plan:      "pro_plus",
    is_base_capability: true,
  },
  // ── AIO ────────────────────────────────────────────────────────────────────
  {
    capability:         "aio_analysis",
    display_name:       "AIO Analysis",
    description:        "AI Overview optimization for Google AI Overviews",
    category:           "aio",
    requires_plan:      "pro_plus",
    is_base_capability: true,
  },
  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    capability:         "analytics",
    display_name:       "Analytics",
    description:        "Business data analysis and trend detection",
    category:           "analytics",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    capability:         "social_post",
    display_name:       "Marketing",
    description:        "Social media and marketing content creation for multiple channels",
    category:           "marketing",
    requires_plan:      "pro",
    is_base_capability: true,
  },
  // ── Reporting ─────────────────────────────────────────────────────────────
  {
    capability:         "reporting",
    display_name:       "Reporting",
    description:        "Structured report generation for reputation and growth analytics",
    category:           "reporting",
    requires_plan:      "pro",
    is_base_capability: true,
  },
];

// ─── Category catalog ─────────────────────────────────────────────────────────

export const CATEGORY_CATALOG: AICapabilityCategoryMetadata[] = [
  {
    category:     "chat",
    display_name: "Chat",
    description:  "Conversational AI, text generation, function calling, and embeddings",
    icon:         "chat-bubble-left-right",
    capabilities: ["text_generation", "chat_completion", "function_calling", "embeddings"],
  },
  {
    category:     "ocr",
    display_name: "OCR",
    description:  "Document reading, image understanding, and optical character recognition",
    icon:         "document-magnifying-glass",
    capabilities: ["vision", "ocr"],
  },
  {
    category:     "translation",
    display_name: "Translation",
    description:  "Natural language translation between languages",
    icon:         "language",
    capabilities: ["translation"],
  },
  {
    category:     "image_generation",
    display_name: "Image Generation",
    description:  "AI-generated images for marketing and creative content",
    icon:         "photo",
    capabilities: ["image_generation"],
  },
  {
    category:     "video_generation",
    display_name: "Video Generation",
    description:  "AI-generated video content from text prompts and images",
    icon:         "film",
    capabilities: ["video_generation"],
  },
  {
    category:     "voice",
    display_name: "Voice",
    description:  "Voice synthesis and custom voice cloning for audio content",
    icon:         "microphone",
    capabilities: ["voice_synthesis", "voice_cloning"],
  },
  {
    category:     "seo",
    display_name: "SEO",
    description:  "Search engine optimization keyword analysis and strategy",
    icon:         "magnifying-glass",
    capabilities: ["seo_analysis"],
  },
  {
    category:     "meo",
    display_name: "MEO",
    description:  "Map engine optimization for local business search",
    icon:         "map-pin",
    capabilities: ["meo_analysis"],
  },
  {
    category:     "aeo",
    display_name: "AEO",
    description:  "Answer engine optimization for featured snippets",
    icon:         "question-mark-circle",
    capabilities: ["aeo_analysis"],
  },
  {
    category:     "llmo",
    display_name: "LLMO",
    description:  "LLM optimization for AI training data and citation visibility",
    icon:         "cpu-chip",
    capabilities: ["llmo_analysis"],
  },
  {
    category:     "aio",
    display_name: "AIO",
    description:  "AI Overview optimization for Google AI-generated summaries",
    icon:         "sparkles",
    capabilities: ["aio_analysis"],
  },
  {
    category:     "analytics",
    display_name: "Analytics",
    description:  "Business data analysis, trend detection, and reputation metrics",
    icon:         "chart-bar",
    capabilities: ["analytics"],
  },
  {
    category:     "marketing",
    display_name: "Marketing",
    description:  "Social media content creation and multi-channel marketing",
    icon:         "megaphone",
    capabilities: ["social_post"],
  },
  {
    category:     "reporting",
    display_name: "Reporting",
    description:  "Structured report generation for business growth and reputation",
    icon:         "document-chart-bar",
    capabilities: ["reporting"],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getCapabilityMetadata(
  capability: AIMarketplaceCapability,
): AICapabilityMetadata | undefined {
  return CAPABILITY_CATALOG.find((c) => c.capability === capability);
}

export function getCapabilitiesByCategory(
  category: AICapabilityCategory,
): AICapabilityMetadata[] {
  return CAPABILITY_CATALOG.filter((c) => c.category === category);
}

export function getCategoryMetadata(
  category: AICapabilityCategory,
): AICapabilityCategoryMetadata | undefined {
  return CATEGORY_CATALOG.find((c) => c.category === category);
}

export function getAllMarketplaceCapabilities(): AIMarketplaceCapability[] {
  return CAPABILITY_CATALOG.map((c) => c.capability);
}

export function getBaseCapabilities(): AICapability[] {
  return CAPABILITY_CATALOG
    .filter((c) => c.is_base_capability)
    .map((c) => c.capability as AICapability);
}

export function getExtensionCapabilities(): AIMarketplaceCapability[] {
  return CAPABILITY_CATALOG
    .filter((c) => !c.is_base_capability)
    .map((c) => c.capability);
}

export function getCapabilitiesForPlan(
  plan: "basic" | "pro" | "pro_plus",
): AIMarketplaceCapability[] {
  const planRank: Record<"basic" | "pro" | "pro_plus", number> = {
    basic: 0, pro: 1, pro_plus: 2,
  };
  return CAPABILITY_CATALOG
    .filter((c) => planRank[c.requires_plan] <= planRank[plan])
    .map((c) => c.capability);
}
