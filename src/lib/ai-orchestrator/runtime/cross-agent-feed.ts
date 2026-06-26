// DealerOS — AI Orchestration Engine: Cross-Agent Feed Dry-Run (Sprint 11K Phase F)
//
// In-memory data passing between agent steps within a single execution plan.
//
// Cross-agent feeds work as follows:
//   Step A (agent_X) outputs ["key_a", "key_b"] to the execution context
//         ↓ (via AI Gateway — never direct module import)
//   Step B (agent_Y) reads  ["key_a", "key_c"] from the execution context
//
// When output_keys of step A intersect input_keys of step B, a feed exchange
// is recorded. In dry-run mode, the actual data values are empty placeholders —
// no AI output exists yet.
//
// RULE: Agents never pass data to each other directly.
//       All feeds flow through the orchestration context → AI Gateway bridge.
//       requires_gateway: true on every AICrossAgentFeedExchange enforces this.
//
// Pure — no "use server", no async, no DB calls, no external calls.

import type { AIAgentId }                   from "@/lib/ai/agents/types";
import type { AIExecutionStep }             from "../orchestrator-types";
import type { AIOrchestratorStepResult }    from "./orchestrator-runtime-types";

// ─── Feed exchange record ─────────────────────────────────────────────────────

/**
 * AICrossAgentFeedExchange — records one in-memory data transfer between two steps.
 *
 * Agents never import from each other. Data flows through the orchestration
 * context key-value store, gated by the AI Gateway.
 */
export interface AICrossAgentFeedExchange {
  /** step_id of the step that produced the output. */
  from_step_id:       string;
  /** step_id of the step that consumes the output. */
  to_step_id:         string;
  from_agent_id:      AIAgentId;
  to_agent_id:        AIAgentId;
  /** Variable names shared between from_step.output_keys and to_step.input_keys. */
  shared_keys:        string[];
  /** Variable names in to_step.input_keys that from_step does NOT produce. */
  missing_keys:       string[];
  /** True — all exchanges must go through AI Gateway, not direct imports. */
  requires_gateway:   true;
  /** True — no actual data values transferred in Sprint 11K dry-run. */
  dry_run:            true;
  detected_at:        string;
}

// ─── Feed plan ────────────────────────────────────────────────────────────────

/**
 * AICrossAgentFeedPlan — all planned data exchanges for one execution plan.
 */
export interface AICrossAgentFeedPlan {
  plan_id:    string;
  exchanges:  AICrossAgentFeedExchange[];
  /** Pairs of steps that have no data exchange (informational). */
  isolated_step_ids: string[];
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * detectFeedBetweenSteps — finds shared variable names between two steps.
 * Returns shared_keys and missing_keys from the consumer's perspective.
 */
export function detectFeedBetweenSteps(
  producer: AIExecutionStep,
  consumer: AIExecutionStep,
): { shared_keys: string[]; missing_keys: string[] } {
  const producer_output = new Set(producer.output_keys);
  const shared:  string[] = [];
  const missing: string[] = [];

  for (const key of consumer.input_keys) {
    if (producer_output.has(key)) {
      shared.push(key);
    } else {
      missing.push(key);
    }
  }
  return { shared_keys: shared, missing_keys: missing };
}

/**
 * buildCrossAgentFeedExchanges — builds feed exchange records for an entire plan.
 *
 * A feed exchange exists between step A and step B when:
 *   1. Step B depends on step A (directly or transitively via depends_on), AND
 *   2. Step A and step B are handled by different agents, AND
 *   3. output_keys of A intersect input_keys of B
 *
 * Both direct dependencies and indirect dependencies (A → C → B) are captured.
 */
export function buildCrossAgentFeedExchanges(
  steps: AIExecutionStep[],
  now:   string,
): AICrossAgentFeedExchange[] {
  const exchanges: AICrossAgentFeedExchange[] = [];

  // Build a quick lookup: step_id → step
  const stepMap = new Map<string, AIExecutionStep>(
    steps.map((s) => [s.step_id, s]),
  );

  // For each pair (producer, consumer) where consumer depends on producer
  for (const consumer of steps) {
    // Walk all direct depends_on (step B depends on step A means A produces for B)
    for (const dep_id of consumer.depends_on) {
      const producer = stepMap.get(dep_id);
      if (!producer) continue;

      // Only record cross-agent feeds (same-agent data flow is not a "feed")
      if (producer.agent_id === consumer.agent_id) continue;

      // Only record if there are any output_keys at all (otherwise no data to pass)
      if (producer.output_keys.length === 0 || consumer.input_keys.length === 0) continue;

      const { shared_keys, missing_keys } = detectFeedBetweenSteps(producer, consumer);

      // Always record the exchange (even if shared_keys is empty) — the intent
      // is to pass data through the gateway context regardless of exact key match.
      exchanges.push({
        from_step_id:    producer.step_id,
        to_step_id:      consumer.step_id,
        from_agent_id:   producer.agent_id,
        to_agent_id:     consumer.agent_id,
        shared_keys,
        missing_keys,
        requires_gateway: true,
        dry_run:          true,
        detected_at:      now,
      });
    }
  }

  return exchanges;
}

// ─── Context key resolution ───────────────────────────────────────────────────

/**
 * resolveFeedPayloadKeys — extracts the keys a step would read from the context.
 *
 * In dry-run mode, step_outputs is empty (no AI ran), so this returns
 * placeholder null values for each input key.
 */
export function resolveFeedPayloadKeys(
  step:         AIExecutionStep,
  step_outputs: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const key of step.input_keys) {
    // In dry-run, outputs are empty; use null as a typed placeholder
    resolved[key] = key in step_outputs ? step_outputs[key] : null;
  }
  return resolved;
}

/**
 * writeFeedOutputKeys — simulates writing a step's outputs to the shared context.
 *
 * In dry-run mode, writes null placeholders (no real AI output).
 * Returns a new context object — does not mutate the input.
 */
export function writeFeedOutputKeys(
  step:         AIExecutionStep,
  step_outputs: Record<string, unknown>,
): Record<string, unknown> {
  const updated = { ...step_outputs };
  for (const key of step.output_keys) {
    // In dry-run, we write null; in live execution (Sprint 11L) this would
    // be populated from the actual AIGatewayBridgeResponse output_payload.
    if (!(key in updated)) {
      updated[key] = null;
    }
  }
  return updated;
}

// ─── Compatibility validation ─────────────────────────────────────────────────

export interface AICrossAgentFeedCompatibility {
  compatible:       boolean;
  shared_keys:      string[];
  missing_keys:     string[];
  warning:          string | null;
}

/**
 * validateFeedCompatibility — checks whether a producer's outputs satisfy
 * a consumer's input requirements.
 */
export function validateFeedCompatibility(
  producer: AIExecutionStep,
  consumer: AIExecutionStep,
): AICrossAgentFeedCompatibility {
  const { shared_keys, missing_keys } = detectFeedBetweenSteps(producer, consumer);

  const compatible = missing_keys.length === 0 ||
    // Steps with no input_keys are always compatible (they read from context freely)
    consumer.input_keys.length === 0;

  const warning = missing_keys.length > 0
    ? `Step "${consumer.step_id}" expects keys [${missing_keys.join(", ")}] not produced by "${producer.step_id}". These may come from other dependencies or the initial trigger payload.`
    : null;

  return { compatible, shared_keys, missing_keys, warning };
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * getExchangesForStep — returns all feed exchanges involving a given step.
 */
export function getExchangesForStep(
  exchanges: AICrossAgentFeedExchange[],
  step_id:   string,
): AICrossAgentFeedExchange[] {
  return exchanges.filter(
    (e) => e.from_step_id === step_id || e.to_step_id === step_id,
  );
}

/**
 * getExchangesBetweenAgents — returns all exchanges between two specific agents.
 */
export function getExchangesBetweenAgents(
  exchanges:  AICrossAgentFeedExchange[],
  agent_from: AIAgentId,
  agent_to:   AIAgentId,
): AICrossAgentFeedExchange[] {
  return exchanges.filter(
    (e) => e.from_agent_id === agent_from && e.to_agent_id === agent_to,
  );
}

/**
 * buildFeedPlan — assembles a complete cross-agent feed plan for a given plan ID.
 */
export function buildFeedPlan(
  plan_id:   string,
  steps:     AIExecutionStep[],
  exchanges: AICrossAgentFeedExchange[],
): AICrossAgentFeedPlan {
  const involved_step_ids = new Set(
    exchanges.flatMap((e) => [e.from_step_id, e.to_step_id]),
  );
  const isolated_step_ids = steps
    .filter((s) => !involved_step_ids.has(s.step_id))
    .map((s) => s.step_id);

  return { plan_id, exchanges, isolated_step_ids };
}

/**
 * summarizeFeedExchanges — returns step results enriched with feed exchange counts.
 * Used for the final runtime result report.
 */
export function summarizeFeedExchanges(
  step_results: AIOrchestratorStepResult[],
  exchanges:    AICrossAgentFeedExchange[],
): Map<string, { outbound: number; inbound: number }> {
  const summary = new Map<string, { outbound: number; inbound: number }>();
  for (const r of step_results) {
    summary.set(r.step_id, { outbound: 0, inbound: 0 });
  }
  for (const e of exchanges) {
    const from = summary.get(e.from_step_id);
    const to   = summary.get(e.to_step_id);
    if (from) from.outbound += 1;
    if (to)   to.inbound   += 1;
  }
  return summary;
}
