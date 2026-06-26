// DealerOS — Video Timeline Model
//
// Sprint 11B Phase C: timeline model for the AI Video Pipeline.
//
// The timeline is the canonical sequencing document for a VideoProject.
// It organizes VideoScene objects into a linear narrative with:
//   - Ordered scenes (order field determines sequence)
//   - Per-scene durations (exact millisecond control not required — seconds is sufficient)
//   - Transition definitions (in/out per scene)
//   - Text overlays and audio configuration
//   - Total duration derived from scene sum
//
// The timeline is an immutable snapshot at a given pipeline stage.
// Mutations produce a new timeline (functional update pattern).
//
// No rendering, no video generation, no external API calls in this module.

import type {
  VideoSceneType,
  VideoTransition,
  VideoTextOverlay,
  VideoAudioConfig,
  VideoAspectRatio,
  VideoFrameRate,
} from "./video-types";
import {
  DEFAULT_VIDEO_TRANSITION as DVT,
  DEFAULT_VIDEO_AUDIO_CONFIG as DAC,
} from "./video-types";
import type { VideoSource } from "./video-source";

// ─── VideoScene ───────────────────────────────────────────────────────────────

/**
 * VideoScene — one narrative unit in a video project timeline.
 *
 * Each scene has a type (intro, water_beading, vehicle_after, etc.),
 * an ordered list of source media, duration, and optional text/audio overlays.
 *
 * Multiple scenes of the same type are allowed (e.g., two `work_process` scenes).
 * Order determines display sequence — lower order appears first.
 */
export interface VideoScene {
  id:              string;
  scene_type:      VideoSceneType;
  /** Zero-indexed position in the timeline. No gaps required. */
  order:           number;
  /** How long this scene lasts in the final video output (seconds). */
  duration_seconds: number;
  /** Source media for this scene — displayed in source.order sequence. */
  sources:         VideoSource[];
  /** Transition effect applied when entering this scene. Null = hard cut. */
  transition_in:   VideoTransition | null;
  /** Transition effect applied when leaving this scene. Null = hard cut. */
  transition_out:  VideoTransition | null;
  /** Optional text overlay rendered during this scene. */
  text_overlay:    VideoTextOverlay | null;
  /** Optional audio override for this scene. Null = inherits timeline audio. */
  audio_config:    VideoAudioConfig | null;
}

// ─── VideoTimeline ────────────────────────────────────────────────────────────

/**
 * VideoTimeline — the complete sequenced narrative for a VideoProject.
 *
 * total_duration_seconds is a derived field computed from scene durations.
 * It must be kept in sync via computeTimelineDuration() whenever scenes change.
 *
 * frame_rate and aspect_ratio are locked at timeline creation and should not
 * change after the storyboard is submitted for generation.
 */
export interface VideoTimeline {
  project_id:              string;
  scenes:                  VideoScene[];
  total_duration_seconds:  number;
  aspect_ratio:            VideoAspectRatio;
  frame_rate:              VideoFrameRate;
  audio_config:            VideoAudioConfig;
}

// ─── Validation types ─────────────────────────────────────────────────────────

export interface VideoTimelineValidationError {
  code:    string;
  message: string;
  scene_id?: string;
}

export interface VideoTimelineValidationResult {
  valid:                   boolean;
  errors:                  VideoTimelineValidationError[];
  total_duration_seconds:  number;
  scene_count:             number;
  source_count:            number;
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

/**
 * Computes total timeline duration from scene durations only.
 * Transition overlap is NOT deducted — the pipeline handles this at render time.
 */
export function computeTimelineDuration(scenes: VideoScene[]): number {
  return scenes.reduce((total, scene) => total + scene.duration_seconds, 0);
}

/**
 * Returns scenes in display order (ascending by order field).
 */
export function getScenesInOrder(scenes: VideoScene[]): VideoScene[] {
  return [...scenes].sort((a, b) => a.order - b.order);
}

/**
 * Returns the first scene matching the given type, or undefined.
 * Useful for checking whether a required scene type is present.
 */
export function getSceneByType(
  timeline: VideoTimeline,
  type:     VideoSceneType,
): VideoScene | undefined {
  return timeline.scenes.find((s) => s.scene_type === type);
}

/**
 * Returns all scenes of the given type in display order.
 */
export function getAllScenesByType(
  timeline: VideoTimeline,
  type:     VideoSceneType,
): VideoScene[] {
  return getScenesInOrder(
    timeline.scenes.filter((s) => s.scene_type === type),
  );
}

/**
 * Returns the scene active at the given time offset in the timeline.
 * Returns null if timeSeconds is past the total duration.
 *
 * Assumes scenes are contiguous without explicit start_time fields.
 * Calculates start times by accumulating durations in order.
 */
export function getSceneAtTime(
  timeline:    VideoTimeline,
  timeSeconds: number,
): VideoScene | null {
  let elapsed = 0;
  for (const scene of getScenesInOrder(timeline.scenes)) {
    if (timeSeconds >= elapsed && timeSeconds < elapsed + scene.duration_seconds) {
      return scene;
    }
    elapsed += scene.duration_seconds;
  }
  return null;
}

/**
 * Validates a VideoTimeline for structural correctness.
 *
 * Checks:
 * 1. At least one scene must be present.
 * 2. Each scene must have duration > 0.
 * 3. Each scene must have at least one source (except: text-only scenes exempt in future).
 * 4. Computed total_duration_seconds must match the stored value within 0.1s.
 * 5. No duplicate scene order values.
 */
export function validateTimeline(
  timeline: VideoTimeline,
): VideoTimelineValidationResult {
  const errors: VideoTimelineValidationError[] = [];
  const computed = computeTimelineDuration(timeline.scenes);
  const sourceCount = timeline.scenes.reduce(
    (n, s) => n + s.sources.length, 0,
  );

  if (timeline.scenes.length === 0) {
    errors.push({ code: "NO_SCENES", message: "Timeline must contain at least one scene." });
  }

  const orderValues = timeline.scenes.map((s) => s.order);
  const hasDuplicateOrders = new Set(orderValues).size !== orderValues.length;
  if (hasDuplicateOrders) {
    errors.push({
      code: "DUPLICATE_ORDER",
      message: "Scene order values must be unique. Duplicate order detected.",
    });
  }

  for (const scene of timeline.scenes) {
    if (scene.duration_seconds <= 0) {
      errors.push({
        code:     "INVALID_DURATION",
        message:  `Scene duration must be > 0 seconds.`,
        scene_id: scene.id,
      });
    }
    if (scene.sources.length === 0) {
      errors.push({
        code:     "NO_SOURCES",
        message:  `Scene must have at least one source media item.`,
        scene_id: scene.id,
      });
    }
  }

  const durationMismatch = Math.abs(computed - timeline.total_duration_seconds) > 0.1;
  if (durationMismatch && timeline.scenes.length > 0) {
    errors.push({
      code:    "DURATION_MISMATCH",
      message: `Stored total_duration_seconds (${timeline.total_duration_seconds.toFixed(1)}s) does not match computed value (${computed.toFixed(1)}s). Run computeTimelineDuration() to sync.`,
    });
  }

  return {
    valid:                   errors.length === 0,
    errors,
    total_duration_seconds:  computed,
    scene_count:             timeline.scenes.length,
    source_count:            sourceCount,
  };
}

/**
 * Creates an empty VideoTimeline for a new project.
 * The caller must add scenes before submitting for generation.
 */
export function createEmptyTimeline(
  projectId:   string,
  aspectRatio: VideoAspectRatio,
  frameRate:   VideoFrameRate = 30,
): VideoTimeline {
  return {
    project_id:             projectId,
    scenes:                 [],
    total_duration_seconds: 0,
    aspect_ratio:           aspectRatio,
    frame_rate:             frameRate,
    audio_config:           DAC,
  };
}

/**
 * Creates a VideoScene with required fields and safe defaults.
 * caller must supply a unique id and unique order within the timeline.
 */
export function buildVideoScene(
  id:         string,
  sceneType:  VideoSceneType,
  order:      number,
  durationSeconds: number,
  sources:    VideoSource[],
  overrides?: Partial<Omit<VideoScene, "id" | "scene_type" | "order" | "duration_seconds" | "sources">>,
): VideoScene {
  return {
    id,
    scene_type:      sceneType,
    order,
    duration_seconds: durationSeconds,
    sources,
    transition_in:   overrides?.transition_in   ?? DVT,
    transition_out:  overrides?.transition_out  ?? null,
    text_overlay:    overrides?.text_overlay     ?? null,
    audio_config:    overrides?.audio_config     ?? null,
  };
}

/**
 * Reindexes scene order values to be contiguous starting from 0.
 * Preserves existing relative ordering.
 */
export function reindexScenes(scenes: VideoScene[]): VideoScene[] {
  return getScenesInOrder(scenes).map((scene, idx) => ({
    ...scene,
    order: idx,
  }));
}

/**
 * Returns a new timeline with the total_duration_seconds field synchronized
 * to the current sum of scene durations.
 */
export function syncTimelineDuration(timeline: VideoTimeline): VideoTimeline {
  return {
    ...timeline,
    total_duration_seconds: computeTimelineDuration(timeline.scenes),
  };
}
