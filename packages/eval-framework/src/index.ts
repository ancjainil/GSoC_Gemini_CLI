/**
 * Gemini CLI Behavioral Evaluation Test Framework
 *
 * A comprehensive framework for testing Gemini CLI's agent capabilities
 * against real-world coding scenarios. Extends the existing eval infrastructure
 * with standardized scenario definitions, multi-axis scoring, statistical
 * regression detection, and dashboard reporting.
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 * @license Apache-2.0
 *
 * Usage:
 *   // Define a scenario
 *   import { ScenarioDefinition, registerScenario } from '@gemini-cli/eval-framework';
 *
 *   const myScenario: ScenarioDefinition = { ... };
 *   registerScenario(myScenario);
 *
 *   // Run evaluations
 *   import { runScenario } from '@gemini-cli/eval-framework';
 *   const result = await runScenario(myScenario, { runsPerScenario: 5 });
 *
 *   // Check for regressions
 *   import { checkAllRegressions } from '@gemini-cli/eval-framework';
 *   const { hasCritical, summary } = checkAllRegressions([result]);
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  ScenarioCategory,
  ScenarioDifficulty,
  EvalConfidence,
  Language,
  FileFixture,
  ToolExpectation,
  FileExpectation,
  ScenarioDefinition,
  EvalContext,
  ToolCallRecord,
  AssertionResult,
  EvalScore,
  EvalRunResult,
  ConfidenceInterval,
  ScenarioAggregateResult,
  CategorySummary,
  EvalReport,
  BaselineEntry,
  RegressionResult,
} from './harness/types.js';

// ─── Harness ─────────────────────────────────────────────────────────────────
export {
  setupWorkspace,
  teardownWorkspace,
  checkFileExpectations,
  checkToolExpectations,
  logTrajectory,
  executeSingleRun,
  runScenario,
  registerScenario,
} from './harness/scenario-runner.js';
export type { RunnerConfig } from './harness/scenario-runner.js';

// ─── Scoring ─────────────────────────────────────────────────────────────────
export {
  DEFAULT_WEIGHTS,
  scoreCorrectness,
  scoreToolSelection,
  scoreEfficiency,
  scoreSafety,
  computeScore,
  wilsonScoreInterval,
  proportionTest,
} from './scoring/scoring-engine.js';

// ─── Aggregation ─────────────────────────────────────────────────────────────
export {
  aggregateResults,
  buildCategorySummaries,
  buildReport,
} from './scoring/aggregator.js';

// ─── Regression Detection ────────────────────────────────────────────────────
export {
  loadBaseline,
  saveBaseline,
  loadAllBaselines,
  checkRegression,
  checkAllRegressions,
} from './regression/regression-detector.js';

// ─── Reporting ───────────────────────────────────────────────────────────────
export { generateHTMLReport } from './reporting/html-report.js';
