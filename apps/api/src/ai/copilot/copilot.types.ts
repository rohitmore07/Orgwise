import type { CopilotDeepLink } from '@orgwise/types';
import type { RequestUser } from '@app/common/interfaces/request-user.interface';
import type Joi from 'joi';

/** Names of the controlled analytics tools. */
export type CopilotToolName =
  | 'getWorkforceOverview'
  | 'getAttritionAnalysis'
  | 'getEngagementMetrics'
  | 'getWorkforceComposition'
  | 'compareDepartments'
  | 'getDepartmentMetrics'
  | 'searchEmployees'
  | 'getEmployeeDetails'
  | 'getDataQuality'
  | 'getImportHistory';

/** Structured result of one tool execution — what the LLM reasons over. */
export interface CopilotToolExecution {
  /** Trusted, structured JSON from a orgwise service (never raw rows). */
  data: unknown;
  /** Deterministic action links built by the backend, not the LLM. */
  deepLinks: CopilotDeepLink[];
  /** Follow-up questions relevant to this result. */
  suggestions: string[];
  /** Records the tool analyzed (for provenance). */
  recordsAnalyzed?: number;
  /** Last successful import timestamp when the result carries dataset info. */
  lastImportedAt?: string;
  /** Explicit limitations to surface (e.g. out-of-scope department names). */
  limitations?: string[];
}
// One controlled analytics tool. Authorization is NOT the tool's job beyond passing the actor through: every…
// underlying service applies RBAC scope server-side, so even a manipulated model cannot widen its access.
export interface CopilotTool {
  name: CopilotToolName;
  /** Short description for the LLM's tool-selection prompt. */
  description: string;
  /** Input contract — joi schema; unknown keys are stripped, args are typed. */
  inputSchema: Joi.Schema;
  /** Whether the tool is available to the current role (e.g. income tools). */
  isAvailable(user: RequestUser): boolean;
  /** Execute against trusted, RBAC-scoped services. */
  execute(user: RequestUser, args: unknown): Promise<CopilotToolExecution>;
}

/** Planning-phase decision produced by the LLM (jsonMode). */
export interface CopilotPlan {
  intent: 'tool' | 'answer' | 'refuse';
  /** Required when intent === 'tool'. */
  tool?: CopilotToolName;
  /** Tool arguments — validated by the backend before execution. */
  arguments?: Record<string, unknown>;
  /** Used when intent === 'answer' (capabilities/limitations meta answers). */
  answer?: string;
  /** Used when intent === 'refuse' (policy/injection/scope refusal). */
  refusal?: string;
}

/** Grounding-phase inputs handed to the LLM with the tool results. */
export interface GroundingInput {
  question: string;
  toolName: CopilotToolName;
  result: unknown;
  deepLinks: CopilotDeepLink[];
  provenance: {
    source: string;
    recordsAnalyzed?: number;
    lastImportedAt?: string;
  };
}
