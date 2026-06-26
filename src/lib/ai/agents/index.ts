// DealerOS — AI Agent Framework: Public API
//
// Import execution-policy directly when needed (server-side only):
//   import { checkExecutionPolicy, createAgentContext } from "@/lib/ai/agents/execution-policy"

export type {
  AIAgentId,
  AIAgentContext,
  AIAgentRequest,
  AIAgentResponse,
  AIAgentValidationError,
  AIAgentValidationResult,
  AIAgentLifecycleState,
  AIAgentLifecycleResult,
  ExecutionPolicyResult,
} from "./types";

export type {
  AIAgent,
} from "./types";

export {
  AIAgentError,
  AIAgentNotImplementedError,
  AIAgentGatewayError,
  AIAgentValidationFailedError,
} from "./types";

export type {
  AIAgentStatus,
  AIAgentRegistryEntry,
} from "./registry";

export {
  AI_AGENT_REGISTRY,
  getAgentEntry,
  getAgentsByCapability,
  getAgentsByFeature,
  getActiveAgents,
  getPlannedAgents,
} from "./registry";

export { runAgentLifecycle } from "./lifecycle";
