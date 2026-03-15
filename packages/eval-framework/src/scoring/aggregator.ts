/**
 * Results Aggregator - Aggregates multiple runs into statistical summaries
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 */

import type {
  ScenarioDefinition,
  EvalRunResult,
  EvalScore,
  ScenarioAggregateResult,
  CategorySummary,
  EvalReport,
  ScenarioCategory,
} from '../harness/types.js';
import { wilsonScoreInterval } from './scoring-engine.js';

/**
 * Aggregates multiple run results for a single scenario into a
 * statistical summary with confidence intervals.
 */
export function aggregateResults(
  scenario: ScenarioDefinition,
  runs: EvalRunResult[],
): ScenarioAggregateResult {
  const passedRuns = runs.filter(r => r.passed).length;
  const passRate = runs.length > 0 ? passedRuns / runs.length : 0;

  // Compute Wilson score CI for the pass rate
  const passRateCI = wilsonScoreInterval(passedRuns, runs.length);

  // Average the multi-axis scores
  const avgScore = averageScores(runs.map(r => r.score));

  // Classify the result
  let status: ScenarioAggregateResult['status'];
  if (passRate === 1.0) {
    status = 'ALWAYS_PASSES';
  } else if (passRate >= 0.8) {
    status = 'USUALLY_PASSES';
  } else if (passRate > 0) {
    status = 'NEEDS_ATTENTION';
  } else {
    status = 'FAILING';
  }

  // Compute averages for efficiency metrics
  const avgTokens = average(runs.map(r => r.context.totalTokens));
  const avgTurns = average(runs.map(r => r.context.turnCount));
  const avgDurationMs = average(runs.map(r => r.context.durationMs));

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    category: scenario.category,
    difficulty: scenario.difficulty,
    confidence: scenario.confidence,
    totalRuns: runs.length,
    passedRuns,
    passRate: round(passRate, 4),
    passRateCI,
    avgScore,
    status,
    runs,
    avgTokens: Math.round(avgTokens),
    avgTurns: round(avgTurns, 1),
    avgDurationMs: Math.round(avgDurationMs),
  };
}

/**
 * Builds category-level summaries from aggregated scenario results.
 */
export function buildCategorySummaries(
  results: ScenarioAggregateResult[],
): CategorySummary[] {
  const categories: ScenarioCategory[] = ['debug', 'refactor', 'feature', 'review'];

  return categories
    .map(category => {
      const scenarios = results.filter(r => r.category === category);
      if (scenarios.length === 0) return null;

      return {
        category,
        totalScenarios: scenarios.length,
        passingScenarios: scenarios.filter(s => s.passRate >= 0.8).length,
        avgPassRate: round(average(scenarios.map(s => s.passRate)), 4),
        avgCompositeScore: round(average(scenarios.map(s => s.avgScore.composite)), 4),
        scenarios,
      };
    })
    .filter((c): c is CategorySummary => c !== null);
}

/**
 * Builds a complete evaluation report from all scenario results.
 */
export function buildReport(
  results: ScenarioAggregateResult[],
  metadata: {
    cliVersion: string;
    model: string;
    runsPerScenario: number;
    totalDurationMs: number;
  },
): EvalReport {
  const categories = buildCategorySummaries(results);
  const overallPassRate = results.length > 0
    ? round(average(results.map(r => r.passRate)), 4)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    cliVersion: metadata.cliVersion,
    model: metadata.model,
    runsPerScenario: metadata.runsPerScenario,
    overallPassRate,
    categories,
    scenarios: results,
    totalDurationMs: metadata.totalDurationMs,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function averageScores(scores: EvalScore[]): EvalScore {
  if (scores.length === 0) {
    return { correctness: 0, toolSelection: 0, efficiency: 0, safety: 0, composite: 0 };
  }

  return {
    correctness: round(average(scores.map(s => s.correctness)), 4),
    toolSelection: round(average(scores.map(s => s.toolSelection)), 4),
    efficiency: round(average(scores.map(s => s.efficiency)), 4),
    safety: round(average(scores.map(s => s.safety)), 4),
    composite: round(average(scores.map(s => s.composite)), 4),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
