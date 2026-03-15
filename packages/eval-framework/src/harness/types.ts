/**
 * Behavioral Evaluation Test Framework - Core Type Definitions
 *
 * These types define the declarative DSL for specifying evaluation scenarios,
 * scoring rubrics, and evaluation results. Designed to be backward-compatible
 * with Gemini CLI's existing evalTest infrastructure.
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 * @see https://github.com/google-gemini/gemini-cli/tree/main/evals
 */

// ─── Scenario Categories ─────────────────────────────────────────────────────

export type ScenarioCategory = 'debug' | 'refactor' | 'feature' | 'review';

export type ScenarioDifficulty = 'easy' | 'medium' | 'hard';

export type EvalConfidence = 'ALWAYS_PASSES' | 'USUALLY_PASSES';

export type Language = 'typescript' | 'python' | 'go' | 'javascript' | 'rust' | 'java';

// ─── Scenario Definition ─────────────────────────────────────────────────────

/**
 * A file fixture that sets up the initial workspace state for a scenario.
 * The harness creates these files before each evaluation run.
 */
export interface FileFixture {
  /** Relative path within the workspace */
  path: string;
  /** File content */
  content: string;
}

/**
 * Defines expected tool calls the agent should (or should not) make.
 */
export interface ToolExpectation {
  /** Tool name (e.g., 'ReadFile', 'WriteFile', 'RunCommand') */
  toolName: string;
  /** Whether this tool SHOULD or SHOULD NOT be called */
  expectation: 'should_call' | 'should_not_call';
  /** Optional: expected arguments pattern (regex) */
  argsPattern?: string;
}

/**
 * Defines expected file modifications after the agent completes the task.
 */
export interface FileExpectation {
  /** Relative path within the workspace */
  path: string;
  /** Type of expectation */
  type: 'exists' | 'not_exists' | 'contains' | 'not_contains' | 'matches_regex';
  /** Pattern or content to check against */
  value?: string;
}

/**
 * The core scenario definition. Each scenario is a declarative specification
 * of a coding task for the agent to complete.
 */
export interface ScenarioDefinition {
  /** Unique identifier for the scenario (e.g., 'debug-ts-null-ref-001') */
  id: string;
  /** Human-readable scenario name */
  name: string;
  /** Detailed description of what the scenario tests */
  description: string;
  /** Task category */
  category: ScenarioCategory;
  /** Task difficulty */
  difficulty: ScenarioDifficulty;
  /** Primary programming language */
  language: Language;
  /** Confidence level for CI gating */
  confidence: EvalConfidence;

  /** The prompt sent to the agent */
  prompt: string;

  /** Files to create in the workspace before evaluation */
  fixtures: FileFixture[];

  /** Expected file states after agent completion */
  fileExpectations?: FileExpectation[];

  /** Expected tool call patterns */
  toolExpectations?: ToolExpectation[];

  /** Custom assertion function for complex validation */
  customAssert?: (context: EvalContext) => Promise<AssertionResult>;

  /** Tags for filtering and grouping */
  tags?: string[];

  /** Estimated token budget for the task */
  estimatedTokens?: number;

  /** Maximum allowed agent turns before timeout */
  maxTurns?: number;
}

// ─── Evaluation Context & Results ────────────────────────────────────────────

/**
 * Context passed to assertion functions, containing the full
 * agent trajectory and workspace state.
 */
export interface EvalContext {
  /** The scenario being evaluated */
  scenario: ScenarioDefinition;
  /** Ordered list of tool calls the agent made */
  toolCalls: ToolCallRecord[];
  /** Agent's final text response */
  finalResponse: string;
  /** Total tokens consumed (input + output) */
  totalTokens: number;
  /** Number of agent turns */
  turnCount: number;
  /** Workspace root path for file inspection */
  workspacePath: string;
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Record of a single tool call made by the agent.
 */
export interface ToolCallRecord {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result/output */
  result: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Result of a single assertion check.
 */
export interface AssertionResult {
  passed: boolean;
  message: string;
  /** Optional details for debugging */
  details?: string;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Multi-axis score for a single evaluation run.
 * Each axis is scored 0.0 - 1.0.
 */
export interface EvalScore {
  /** Did the agent's output satisfy task requirements? */
  correctness: number;
  /** Did the agent choose appropriate tools? */
  toolSelection: number;
  /** Token and turn efficiency relative to task complexity */
  efficiency: number;
  /** Did the agent respect sandbox constraints and safety? */
  safety: number;
  /** Weighted composite score */
  composite: number;
}

/**
 * Result of a single evaluation run (one scenario, one execution).
 */
export interface EvalRunResult {
  /** Scenario ID */
  scenarioId: string;
  /** Run index (0-based) within the batch */
  runIndex: number;
  /** Whether all assertions passed */
  passed: boolean;
  /** Multi-axis score */
  score: EvalScore;
  /** Individual assertion results */
  assertions: AssertionResult[];
  /** Full evaluation context (for trajectory logging) */
  context: EvalContext;
  /** ISO timestamp */
  timestamp: string;
  /** Error message if the run failed catastrophically */
  error?: string;
}

// ─── Aggregated Results ──────────────────────────────────────────────────────

/**
 * Wilson score confidence interval for a pass rate.
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
  center: number;
  /** Number of successes */
  successes: number;
  /** Total number of trials */
  trials: number;
}

/**
 * Aggregated result across multiple runs of a single scenario.
 */
export interface ScenarioAggregateResult {
  scenarioId: string;
  scenarioName: string;
  category: ScenarioCategory;
  difficulty: ScenarioDifficulty;
  confidence: EvalConfidence;

  /** Number of runs */
  totalRuns: number;
  /** Number of passing runs */
  passedRuns: number;
  /** Raw pass rate (0.0 - 1.0) */
  passRate: number;
  /** Wilson score 95% confidence interval */
  passRateCI: ConfidenceInterval;

  /** Averaged multi-axis scores */
  avgScore: EvalScore;

  /** Classification based on pass rate */
  status: 'ALWAYS_PASSES' | 'USUALLY_PASSES' | 'NEEDS_ATTENTION' | 'FAILING';

  /** Individual run results */
  runs: EvalRunResult[];

  /** Average tokens consumed */
  avgTokens: number;
  /** Average turn count */
  avgTurns: number;
  /** Average duration in ms */
  avgDurationMs: number;
}

/**
 * Category-level summary.
 */
export interface CategorySummary {
  category: ScenarioCategory;
  totalScenarios: number;
  passingScenarios: number;
  avgPassRate: number;
  avgCompositeScore: number;
  scenarios: ScenarioAggregateResult[];
}

/**
 * Complete evaluation report.
 */
export interface EvalReport {
  /** Report generation timestamp */
  timestamp: string;
  /** Gemini CLI version tested */
  cliVersion: string;
  /** Model used for evaluation */
  model: string;
  /** Number of runs per scenario */
  runsPerScenario: number;
  /** Overall pass rate */
  overallPassRate: number;
  /** Per-category summaries */
  categories: CategorySummary[];
  /** All scenario results */
  scenarios: ScenarioAggregateResult[];
  /** Total evaluation duration in ms */
  totalDurationMs: number;
}

// ─── Regression Detection ────────────────────────────────────────────────────

/**
 * Stored baseline for regression comparison.
 */
export interface BaselineEntry {
  scenarioId: string;
  passRate: number;
  passRateCI: ConfidenceInterval;
  avgCompositeScore: number;
  totalRuns: number;
  recordedAt: string;
  cliVersion: string;
  model: string;
}

/**
 * Result of a regression check for a single scenario.
 */
export interface RegressionResult {
  scenarioId: string;
  scenarioName: string;
  /** Current pass rate */
  currentPassRate: number;
  /** Baseline pass rate */
  baselinePassRate: number;
  /** Statistical p-value from two-tailed proportion test */
  pValue: number;
  /** Whether this constitutes a statistically significant regression */
  isRegression: boolean;
  /** Severity: 'critical' if ALWAYS_PASSES dropped, 'warning' otherwise */
  severity: 'critical' | 'warning' | 'none';
  /** Human-readable summary */
  summary: string;
}
