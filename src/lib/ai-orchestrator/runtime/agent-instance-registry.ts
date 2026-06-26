// DealerOS — AI Orchestration Engine: Agent Instance Registry (Sprint 11L Phase B)
//
// Provides agent instances for lifecycle preparation in the live runtime bridge.
//
// Rules:
//   - reputation_agent: uses the concrete ReputationAgent class (Sprint 10E)
//   - All other agents: stub instances (lifecycle preparation only, no inference)
//   - Stubs implement initialize() and validate() but NOT execute()
//   - No AI provider execution at any point
//   - No external API calls
//
// Pure — no "use server", no async DB calls, no external calls.
// The agent initialize() methods may be async but contain no DB or network I/O.

import type {
  AIAgent,
  AIAgentId,
  AIAgentContext,
  AIAgentRequest,
  AIAgentResponse,
  AIAgentValidationResult,
}                                    from "@/lib/ai/agents/types";
import {
  AIAgentNotImplementedError,
}                                    from "@/lib/ai/agents/types";
import type { AITaskType }           from "@/lib/ai/types";
import type { AppFeature }           from "@/lib/plans/plan-types";
import type { AIAgentCapability }    from "@/lib/ai/capabilities";
import {
  getAgentEntry,
}                                    from "@/lib/ai/agents/registry";
import {
  ReputationAgent,
}                                    from "@/lib/ai/agents/reputation";

// ─── Planned agent stub ───────────────────────────────────────────────────────

/**
 * PlannedAgentStub — base agent implementation for agents not yet concretely built.
 *
 * Provides production-ready lifecycle hooks (initialize, validate) without
 * requiring a full agent implementation. execute() always throws
 * AIAgentNotImplementedError — there is no AI provider call.
 *
 * Used for: marketing_agent, growth_agent, ocr_agent, review_agent,
 *           line_agent, seo_agent — all planned for Phase G.
 */
class PlannedAgentStub implements AIAgent<AIAgentRequest, AIAgentResponse> {
  readonly id:                AIAgentId;
  readonly nameJa:            string;
  readonly descJa:            string;
  readonly capabilities:      AIAgentCapability[];
  readonly requiredFeature:   AppFeature;
  readonly requiredTaskTypes: AITaskType[];

  constructor(agent_id: AIAgentId) {
    const entry = getAgentEntry(agent_id);
    if (!entry) {
      throw new Error(`PlannedAgentStub: no registry entry for agent_id "${agent_id}"`);
    }
    this.id                = entry.id;
    this.nameJa            = entry.nameJa;
    this.descJa            = entry.descJa;
    this.capabilities      = entry.capabilities as AIAgentCapability[];
    this.requiredFeature   = entry.requiredFeature;
    this.requiredTaskTypes = entry.taskTypes;
  }

  async initialize(ctx: AIAgentContext): Promise<void> {
    // Validate the agent context — dealer_id must be populated.
    if (!ctx.dealer_id) {
      throw new Error(`${this.id}: dealer_id missing from agent context`);
    }
    // Phase G: load agent-specific configuration here.
    // Sprint 11L: initialization succeeds when context is valid.
  }

  async validate(
    _ctx: AIAgentContext,
    input: AIAgentRequest,
  ): Promise<AIAgentValidationResult> {
    // Phase G: implement task-specific input validation.
    // Sprint 11L: bridge does not call validate() (run_validate: false in bridge policy).
    // This is here for type completeness only.
    if (input.agent_id !== this.id) {
      return {
        valid: false,
        errors: [{
          field:   "agent_id",
          message: `想定エージェントと一致しません（想定: ${this.id}、実際: ${input.agent_id}）`,
        }],
      };
    }
    return { valid: true };
  }

  async execute(
    _ctx:   AIAgentContext,
    _input: AIAgentRequest,
  ): Promise<AIAgentResponse> {
    // All planned agents defer execution to Phase G (Sprint 11M+).
    throw new AIAgentNotImplementedError(this.id);
  }

  async postProcess(
    _ctx:   AIAgentContext,
    output: AIAgentResponse,
  ): Promise<AIAgentResponse> {
    // Phase G: apply agent-specific post-processing.
    // Sprint 11L: pass through unchanged.
    return output;
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

// Singleton instances — created once at module load time.
const REPUTATION_AGENT_INSTANCE = new ReputationAgent();

const PLANNED_AGENT_STUBS: Map<AIAgentId, PlannedAgentStub> = new Map([
  ["marketing_agent",  new PlannedAgentStub("marketing_agent")],
  ["growth_agent",     new PlannedAgentStub("growth_agent")],
  ["ocr_agent",        new PlannedAgentStub("ocr_agent")],
  ["review_agent",     new PlannedAgentStub("review_agent")],
  ["line_agent",       new PlannedAgentStub("line_agent")],
  ["seo_agent",        new PlannedAgentStub("seo_agent")],
]);

/**
 * getAgentInstance — returns the agent instance for lifecycle preparation.
 *
 * Returns the concrete ReputationAgent for reputation_agent.
 * Returns a PlannedAgentStub for all other registered agents.
 * Returns null if the agent_id is not registered.
 */
export function getAgentInstance(
  agent_id: AIAgentId,
): AIAgent | null {
  if (agent_id === "reputation_agent") {
    return REPUTATION_AGENT_INSTANCE;
  }
  return PLANNED_AGENT_STUBS.get(agent_id) ?? null;
}

/**
 * isConcreteAgent — true if this agent has a full implementation (not a stub).
 * Used for diagnostics and capability reporting.
 */
export function isConcreteAgent(agent_id: AIAgentId): boolean {
  return agent_id === "reputation_agent";
}

/**
 * isPlannedAgentStub — true if this agent is a lifecycle-only stub.
 */
export function isPlannedAgentStub(agent_id: AIAgentId): boolean {
  return PLANNED_AGENT_STUBS.has(agent_id);
}
