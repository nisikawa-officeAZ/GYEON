// DealerOS — AI Capability Definitions
// Central definition used by both provider-registry.ts and agents/registry.ts.
// Split from provider-registry.ts in Sprint 10D to allow agents to declare
// required capabilities without circular imports.

// ─── Provider-level capabilities ──────────────────────────────────────────────
// What an AI provider natively supports at the model level.

export type AICapability =
  // Core language
  | "text_generation"     // Generate natural language text
  | "chat_completion"     // Multi-turn conversation
  | "function_calling"    // Structured tool use / JSON output
  | "embeddings"          // Vector embedding generation
  // Visual
  | "vision"              // Image understanding / analysis
  | "ocr"                 // Optical character recognition (document reading)
  | "image_generation"    // Create images from text prompts
  | "video_generation"    // Create video content
  // Discovery & Search
  | "seo_analysis"        // Search Engine Optimization keyword analysis
  | "meo_analysis"        // Map Engine Optimization (Google Business Profile)
  | "aeo_analysis"        // Answer Engine Optimization (featured snippets, PAA)
  | "llmo_analysis"       // LLM Optimization (LLM training data visibility)
  | "aio_analysis"        // AI Overview Optimization (Google AI Overviews)
  // Social & Marketing
  | "social_post"         // Social media content creation and scheduling
  | "analytics"           // Data analysis and trend detection
  | "reporting";          // Structured report generation

// ─── Agent-level capabilities ─────────────────────────────────────────────────
// Higher-level capabilities that GYEON AI agents are responsible for.
// One agent capability may require multiple provider capabilities to function.

export type AIAgentCapability =
  | "content_creation"      // Blog posts, SNS captions, service descriptions
  | "image_understanding"   // Completion photo analysis, quality scoring
  | "document_reading"      // Vehicle registration, PDFs, forms
  | "search_optimization"   // SEO / MEO / AEO / LLMO / AIO
  | "review_management"     // LINE review requests, GBP response drafts
  | "social_media"          // Scheduling, publishing, multi-channel
  | "analytics_reporting"   // Reputation analytics, growth metrics, trend alerts
  | "line_integration";     // LINE message generation and automated messaging
