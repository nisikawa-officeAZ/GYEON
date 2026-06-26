// DealerOS — Media Service Layer
//
// Sprint 10L Phase D: service interfaces and pure-logic implementations.
//
// Interface-only services (require media_assets table migration before implementation):
//   - MediaAssociationService
//
// Implemented services (pure logic — no DB access required):
//   - MediaValidationService
//   - MediaPermissionService
//   - MediaRetentionService
//   - MediaLifecycleService
//   - MediaCapabilityService
//   - MediaAuditService
//
// Security:
//   - dealer_id is verified in every method that touches DealerMedia.
//   - These services do not perform DB queries — they operate on objects already
//     fetched and dealer-verified by the calling server action.
//   - MediaAssociationService is interface-only until the media_assets migration is applied.

import type { DealerMedia, MediaType, MediaDeletionReason, MediaDeletionRecord } from "./media-types";
import { DEFAULT_RETENTION_DAYS, isRetentionExpired }   from "./media-types";
import type { MediaFileInput, MediaUploadPolicy }        from "./media-validation";
import type { MediaValidationResult }                    from "./media-validation";
import { validateMediaFile }                             from "./media-validation";
import type { MediaPermissionGate }                      from "./media-permission";
import { checkMediaPermission }                          from "./media-permission";
import type { MediaAIGateResult, MediaAICapabilityRequest } from "./media-ai";
import { checkMediaAICapability }                        from "./media-ai";
import type { MediaCapabilityId, MediaCapabilityEntry } from "./media-capability";
import {
  MEDIA_CAPABILITY_REGISTRY,
  getMediaCapability,
  getCapabilitiesForType,
}                                                        from "./media-capability";
import type { MediaLifecycleStage, MediaLifecycleTransition } from "./media-lifecycle";
import {
  deriveLifecycleStage,
  getAvailableTransitions,
  canTransitionTo,
}                                                        from "./media-lifecycle";
import type { MediaAssociation, MediaAssociationTarget } from "./media-association";
import type { MediaReference }                           from "./media-asset";
import { createDeletionRecord, validateDeletionRecord }  from "./media-audit";

// ─── MediaValidationService ───────────────────────────────────────────────────

export interface MediaValidationService {
  validate(file: MediaFileInput, policy?: MediaUploadPolicy): MediaValidationResult;
  validateMany(files: MediaFileInput[]): MediaValidationResult[];
}

export class MediaValidationServiceImpl implements MediaValidationService {
  validate(file: MediaFileInput, policy?: MediaUploadPolicy): MediaValidationResult {
    return validateMediaFile(file, policy);
  }

  validateMany(files: MediaFileInput[]): MediaValidationResult[] {
    return files.map((f) => this.validate(f));
  }
}

// ─── MediaAssociationService — interface only ─────────────────────────────────

/**
 * Interface for querying and managing media-to-entity associations.
 *
 * IMPLEMENTATION REQUIRES: media_assets table migration (see MEDIA_ASSETS_SCHEMA_PROPOSAL.md).
 * This interface is defined now so that Phase 10M+ implementation has a stable contract.
 *
 * All methods require dealer_id for cross-dealer isolation.
 */
export interface MediaAssociationService {
  /** Returns all active associations for a given media asset. */
  getAssociationsForMedia(
    mediaId:  string,
    dealerId: string,
  ): Promise<MediaAssociation[]>;

  /** Returns all media references currently associated with a specific entity. */
  getMediaForEntity(
    target:   MediaAssociationTarget,
    targetId: string,
    dealerId: string,
  ): Promise<MediaReference[]>;

  /** Establishes a new association between a media asset and a business entity. */
  addAssociation(
    association: Omit<MediaAssociation, "created_at">,
    dealerId:    string,
  ): Promise<void>;

  /** Marks an association as removed (sets removed_at — does not hard-delete). */
  removeAssociation(
    mediaId:   string,
    target:    MediaAssociationTarget,
    targetId:  string,
    dealerId:  string,
  ): Promise<void>;
}

// ─── MediaPermissionService ───────────────────────────────────────────────────

export interface MediaPermissionService {
  checkPermission(asset: DealerMedia): MediaPermissionGate;
  checkBatchPermissions(assets: DealerMedia[]): Map<string, MediaPermissionGate>;
  canUseForAI(request: MediaAICapabilityRequest): MediaAIGateResult;
}

export class MediaPermissionServiceImpl implements MediaPermissionService {
  checkPermission(asset: DealerMedia): MediaPermissionGate {
    return checkMediaPermission(asset);
  }

  checkBatchPermissions(assets: DealerMedia[]): Map<string, MediaPermissionGate> {
    return new Map(assets.map((a) => [a.id, checkMediaPermission(a)]));
  }

  canUseForAI(request: MediaAICapabilityRequest): MediaAIGateResult {
    return checkMediaAICapability(request);
  }
}

// ─── MediaRetentionService ────────────────────────────────────────────────────

export interface MediaRetentionService {
  isExpired(asset: DealerMedia): boolean;
  computeExpiresAt(mediaType: MediaType, retentionDays: number): string | null;
  getExpiredAssets(assets: DealerMedia[]): DealerMedia[];
  getDefaultRetentionDays(mediaType: MediaType): number;
}

export class MediaRetentionServiceImpl implements MediaRetentionService {
  isExpired(asset: DealerMedia): boolean {
    return isRetentionExpired(asset);
  }

  computeExpiresAt(mediaType: MediaType, retentionDays: number): string | null {
    if (retentionDays >= 3650) return null;
    const d = new Date();
    d.setDate(d.getDate() + retentionDays);
    return d.toISOString();
  }

  getExpiredAssets(assets: DealerMedia[]): DealerMedia[] {
    return assets.filter((a) => this.isExpired(a));
  }

  getDefaultRetentionDays(mediaType: MediaType): number {
    return DEFAULT_RETENTION_DAYS[mediaType];
  }
}

// ─── MediaLifecycleService ────────────────────────────────────────────────────

export interface MediaLifecycleService {
  getCurrentStage(asset: DealerMedia): MediaLifecycleStage;
  getAvailableTransitions(asset: DealerMedia): MediaLifecycleStage[];
  canTransitionTo(asset: DealerMedia, target: MediaLifecycleStage): boolean;
  computeTransition(
    from: DealerMedia,
    to:   Partial<DealerMedia>,
  ): MediaLifecycleTransition | null;
}

export class MediaLifecycleServiceImpl implements MediaLifecycleService {
  getCurrentStage(asset: DealerMedia): MediaLifecycleStage {
    return deriveLifecycleStage(asset);
  }

  getAvailableTransitions(asset: DealerMedia): MediaLifecycleStage[] {
    return getAvailableTransitions(asset);
  }

  canTransitionTo(asset: DealerMedia, target: MediaLifecycleStage): boolean {
    return canTransitionTo(asset, target);
  }

  computeTransition(
    from: DealerMedia,
    to:   Partial<DealerMedia>,
  ): MediaLifecycleTransition | null {
    const fromStage = deriveLifecycleStage(from);
    const merged    = { ...from, ...to } as DealerMedia;
    const toStage   = deriveLifecycleStage(merged);
    if (fromStage === toStage) return null;
    return {
      from:        fromStage,
      to:          toStage,
      trigger:     "validation_passed",
      occurred_at: new Date().toISOString(),
    };
  }
}

// ─── MediaCapabilityService ───────────────────────────────────────────────────

export interface MediaCapabilityService {
  getCapabilities(mediaType: MediaType): MediaCapabilityEntry[];
  isCapabilityAvailable(id: MediaCapabilityId): boolean;
  getCapabilitiesFor(asset: DealerMedia): MediaCapabilityEntry[];
  getAvailableCapabilitiesFor(asset: DealerMedia): MediaCapabilityEntry[];
}

export class MediaCapabilityServiceImpl implements MediaCapabilityService {
  getCapabilities(mediaType: MediaType): MediaCapabilityEntry[] {
    return getCapabilitiesForType(mediaType);
  }

  isCapabilityAvailable(id: MediaCapabilityId): boolean {
    return getMediaCapability(id)?.available_now === true;
  }

  getCapabilitiesFor(asset: DealerMedia): MediaCapabilityEntry[] {
    return MEDIA_CAPABILITY_REGISTRY.filter(
      (c) => c.supported_types.includes(asset.media_type),
    );
  }

  getAvailableCapabilitiesFor(asset: DealerMedia): MediaCapabilityEntry[] {
    return this.getCapabilitiesFor(asset).filter((c) => c.available_now);
  }
}

// ─── MediaAuditService ────────────────────────────────────────────────────────

export interface MediaAuditService {
  createDeletionRecord(
    asset:  DealerMedia,
    reason: MediaDeletionReason,
    opts?:  {
      generated_output_record?: string;
      download_status?:         MediaDeletionRecord["download_status"];
      publish_status?:          MediaDeletionRecord["publish_status"];
    },
  ): MediaDeletionRecord;
  validateDeletionRecord(record: MediaDeletionRecord): boolean;
}

export class MediaAuditServiceImpl implements MediaAuditService {
  createDeletionRecord(
    asset:  DealerMedia,
    reason: MediaDeletionReason,
    opts?:  {
      generated_output_record?: string;
      download_status?:         MediaDeletionRecord["download_status"];
      publish_status?:          MediaDeletionRecord["publish_status"];
    },
  ): MediaDeletionRecord {
    return createDeletionRecord(asset, reason, opts);
  }

  validateDeletionRecord(record: MediaDeletionRecord): boolean {
    return validateDeletionRecord(record);
  }
}
