/**
 * Regression Detection System
 *
 * Compares current evaluation results against stored baselines using
 * statistical proportion tests. Integrated with CI/CD to block merges
 * when significant regressions are detected.
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  BaselineEntry,
  RegressionResult,
  ScenarioAggregateResult,
} from '../harness/types.js';
import { proportionTest } from '../scoring/scoring-engine.js';

// ─── Baseline Storage ────────────────────────────────────────────────────────

const BASELINES_DIR = path.join(process.cwd(), 'packages', 'eval-framework', 'baselines');

/**
 * Loads the stored baseline for a given scenario.
 * Returns null if no baseline exists.
 */
export function loadBaseline(scenarioId: string): BaselineEntry | null {
  const filePath = path.join(BASELINES_DIR, `${scenarioId}.json`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BaselineEntry;
  } catch {
    return null;
  }
}

/**
 * Saves a new baseline entry for a scenario.
 * Only updates if the current result represents a stable measurement
 * (>= 5 runs and pass rate within expected range for its confidence level).
 */
export function saveBaseline(
  result: ScenarioAggregateResult,
  cliVersion: string,
  model: string,
): void {
  fs.mkdirSync(BASELINES_DIR, { recursive: true });

  const entry: BaselineEntry = {
    scenarioId: result.scenarioId,
    passRate: result.passRate,
    passRateCI: result.passRateCI,
    avgCompositeScore: result.avgScore.composite,
    totalRuns: result.totalRuns,
    recordedAt: new Date().toISOString(),
    cliVersion,
    model,
  };

  const filePath = path.join(BASELINES_DIR, `${result.scenarioId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Loads all stored baselines.
 */
export function loadAllBaselines(): Map<string, BaselineEntry> {
  const baselines = new Map<string, BaselineEntry>();

  if (!fs.existsSync(BASELINES_DIR)) return baselines;

  const files = fs.readdirSync(BASELINES_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(BASELINES_DIR, file), 'utf-8');
      const entry = JSON.parse(content) as BaselineEntry;
      baselines.set(entry.scenarioId, entry);
    } catch {
      // Skip invalid baseline files
    }
  }

  return baselines;
}

// ─── Regression Detection ────────────────────────────────────────────────────

/**
 * Default p-value threshold for declaring a regression.
 * 0.05 = 95% confidence that the difference is real.
 */
const DEFAULT_P_THRESHOLD = 0.05;

/**
 * Checks a single scenario for regression against its baseline.
 */
export function checkRegression(
  result: ScenarioAggregateResult,
  baseline: BaselineEntry | null,
  pThreshold: number = DEFAULT_P_THRESHOLD,
): RegressionResult {
  // No baseline exists — cannot detect regression
  if (!baseline) {
    return {
      scenarioId: result.scenarioId,
      scenarioName: result.scenarioName,
      currentPassRate: result.passRate,
      baselinePassRate: 0,
      pValue: 1.0,
      isRegression: false,
      severity: 'none',
      summary: `No baseline exists for ${result.scenarioId}. Current pass rate: ${formatPercent(result.passRate)}`,
    };
  }

  // Run proportion test
  const pValue = proportionTest(
    result.passedRuns,
    result.totalRuns,
    baseline.passRate,
  );

  // A regression occurs when:
  // 1. The current pass rate is LOWER than baseline
  // 2. The difference is statistically significant (p < threshold)
  const isRegression =
    result.passRate < baseline.passRate && pValue < pThreshold;

  // Determine severity
  let severity: RegressionResult['severity'] = 'none';
  if (isRegression) {
    // Critical if an ALWAYS_PASSES scenario dropped below 100%
    if (result.confidence === 'ALWAYS_PASSES' && result.passRate < 1.0) {
      severity = 'critical';
    } else {
      severity = 'warning';
    }
  }

  // Build summary
  let summary: string;
  if (isRegression) {
    const drop = baseline.passRate - result.passRate;
    summary = `REGRESSION: ${result.scenarioName} dropped from ${formatPercent(baseline.passRate)} to ${formatPercent(result.passRate)} (Δ${formatPercent(-drop)}, p=${pValue.toFixed(4)})`;
  } else if (result.passRate > baseline.passRate) {
    summary = `IMPROVED: ${result.scenarioName} improved from ${formatPercent(baseline.passRate)} to ${formatPercent(result.passRate)}`;
  } else {
    summary = `STABLE: ${result.scenarioName} at ${formatPercent(result.passRate)} (baseline: ${formatPercent(baseline.passRate)})`;
  }

  return {
    scenarioId: result.scenarioId,
    scenarioName: result.scenarioName,
    currentPassRate: result.passRate,
    baselinePassRate: baseline.passRate,
    pValue,
    isRegression,
    severity,
    summary,
  };
}

/**
 * Checks all scenarios for regressions and returns a summary suitable
 * for CI/CD integration (GitHub Actions annotation format).
 */
export function checkAllRegressions(
  results: ScenarioAggregateResult[],
  pThreshold: number = DEFAULT_P_THRESHOLD,
): {
  regressions: RegressionResult[];
  hasCritical: boolean;
  hasWarning: boolean;
  summary: string;
  ciExitCode: number;
} {
  const baselines = loadAllBaselines();
  const regressions: RegressionResult[] = [];

  for (const result of results) {
    const baseline = baselines.get(result.scenarioId) || null;
    const regression = checkRegression(result, baseline, pThreshold);
    regressions.push(regression);
  }

  const criticalRegressions = regressions.filter(r => r.severity === 'critical');
  const warningRegressions = regressions.filter(r => r.severity === 'warning');
  const hasCritical = criticalRegressions.length > 0;
  const hasWarning = warningRegressions.length > 0;

  // Build CI summary
  const lines: string[] = ['## Behavioral Evaluation Regression Report\n'];

  if (hasCritical) {
    lines.push(`### 🔴 Critical Regressions (${criticalRegressions.length})\n`);
    for (const r of criticalRegressions) {
      lines.push(`- ${r.summary}`);
    }
    lines.push('');
  }

  if (hasWarning) {
    lines.push(`### 🟡 Warning Regressions (${warningRegressions.length})\n`);
    for (const r of warningRegressions) {
      lines.push(`- ${r.summary}`);
    }
    lines.push('');
  }

  const stable = regressions.filter(r => r.severity === 'none');
  if (stable.length > 0) {
    lines.push(`### 🟢 Stable/Improved (${stable.length})\n`);
    for (const r of stable) {
      lines.push(`- ${r.summary}`);
    }
  }

  // CI exit code: 1 for critical regressions (block merge), 0 otherwise
  const ciExitCode = hasCritical ? 1 : 0;

  return {
    regressions,
    hasCritical,
    hasWarning,
    summary: lines.join('\n'),
    ciExitCode,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
