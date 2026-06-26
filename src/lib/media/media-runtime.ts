// DealerOS — Media Runtime
//
// Sprint 10J: unified orchestrator for all media operations.
// Ties together validation, permission checks, capability queries, and AI gates.
//
// Does not write to Supabase. Does not call external APIs.
// All methods are synchronous except the static factory constructors.
//
// Usage:
//   const runtime = MediaRuntime.default();                        // no dealer context
//   const runtime = MediaRuntime.withContext(ctx);                 // with dealer context
//   const result  = runtime.validate({ name, size, type });
//   const gate    = runtime.checkPermission(media);
//   const caps    = runtime.getCapabilitiesForType("video");

import type { DealerMedia, MediaType }                    from "./media-types";
import type { MediaContext }                               from "./media-context";
import type { MediaFileInput, MediaUploadPolicy, MediaValidationResult } from "./media-validation";
import type { MediaPermissionGate }                        from "./media-permission";
import type { MediaCapabilityEntry, MediaCapabilityId }    from "./media-capability";
import type { MediaAICapabilityRequest, MediaAIGateResult } from "./media-ai";

import { validateMediaFile, CURRENT_UPLOAD_POLICY }        from "./media-validation";
import { checkMediaPermission }                             from "./media-permission";
import {
  getCapabilitiesForType,
  getAvailableCapabilities,
  getMediaCapability,
  MEDIA_CAPABILITY_REGISTRY,
} from "./media-capability";
import { checkMediaAICapability }                           from "./media-ai";

// ─── Runtime ──────────────────────────────────────────────────────────────────

export class MediaRuntime {
  private readonly policy:  MediaUploadPolicy;
  private readonly context: MediaContext | null;

  private constructor(context: MediaContext | null, policy: MediaUploadPolicy) {
    this.context = context;
    this.policy  = policy;
  }

  // ── Constructors ──────────────────────────────────────────────────────────

  /** Creates a runtime bound to a dealer context (server-side use). */
  static withContext(context: MediaContext): MediaRuntime {
    return new MediaRuntime(context, context.upload_policy);
  }

  /** Creates a runtime with an explicit upload policy but no dealer context. */
  static withPolicy(policy: MediaUploadPolicy): MediaRuntime {
    return new MediaRuntime(null, policy);
  }

  /** Creates a runtime with the current production upload policy. */
  static default(): MediaRuntime {
    return new MediaRuntime(null, CURRENT_UPLOAD_POLICY);
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /** Validates a single file against the active upload policy. */
  validate(file: MediaFileInput): MediaValidationResult {
    return validateMediaFile(file, this.policy);
  }

  /** Validates multiple files. Returns one result per file, in the same order. */
  validateMany(files: MediaFileInput[]): MediaValidationResult[] {
    return files.map((f) => this.validate(f));
  }

  // ── Permission ────────────────────────────────────────────────────────────

  /** Returns the full permission gate for a single media asset. */
  checkPermission(media: DealerMedia): MediaPermissionGate {
    return checkMediaPermission(media);
  }

  /**
   * Returns permission gates for multiple assets.
   * Keys are media IDs. Useful for batch UI rendering decisions.
   */
  checkPermissions(media: DealerMedia[]): Map<string, MediaPermissionGate> {
    return new Map(media.map((m) => [m.id, checkMediaPermission(m)]));
  }

  // ── Capability ────────────────────────────────────────────────────────────

  /** Returns all capabilities (available or future) that support the given media type. */
  getCapabilitiesForType(mediaType: MediaType): MediaCapabilityEntry[] {
    return getCapabilitiesForType(mediaType);
  }

  /** Returns only currently available capabilities for the given media type. */
  getAvailableCapabilitiesForType(mediaType: MediaType): MediaCapabilityEntry[] {
    return getCapabilitiesForType(mediaType).filter((c) => c.available_now);
  }

  /** Returns all currently available capabilities across all media types. */
  getAllAvailableCapabilities(): MediaCapabilityEntry[] {
    return getAvailableCapabilities();
  }

  /** Returns true if the given capability is currently available. */
  hasCapability(id: MediaCapabilityId): boolean {
    return getMediaCapability(id)?.available_now === true;
  }

  /** Returns all capabilities applicable to a specific media asset. */
  getCapabilitiesFor(media: DealerMedia): MediaCapabilityEntry[] {
    return MEDIA_CAPABILITY_REGISTRY.filter((c) =>
      c.supported_types.includes(media.media_type),
    );
  }

  /** Returns available capabilities applicable to a specific media asset. */
  getAvailableCapabilitiesFor(media: DealerMedia): MediaCapabilityEntry[] {
    return this.getCapabilitiesFor(media).filter((c) => c.available_now);
  }

  // ── AI gate ───────────────────────────────────────────────────────────────

  /**
   * Validates whether a media asset may be passed to an AI agent.
   * Enforces dealer isolation, consent, and capability-specific rules.
   */
  checkAICapability(request: MediaAICapabilityRequest): MediaAIGateResult {
    return checkMediaAICapability(request);
  }

  // ── Context access ────────────────────────────────────────────────────────

  /** Returns the dealer_id from the bound context, or null if no context is set. */
  getDealerId(): string | null {
    return this.context?.dealer_id ?? null;
  }

  /** Returns the trace_id from the bound context, or null if no context is set. */
  getTraceId(): string | null {
    return this.context?.trace_id ?? null;
  }

  /** Returns the active upload policy. */
  getPolicy(): MediaUploadPolicy {
    return this.policy;
  }
}
