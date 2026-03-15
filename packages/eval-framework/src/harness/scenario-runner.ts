/**
 * Scenario Runner - Test Harness for Behavioral Evaluation
 *
 * Wraps Gemini CLI's existing evalTest infrastructure with a higher-level
 * abstraction that supports declarative scenario definitions, workspace
 * management, structured trajectory logging, and multi-run aggregation.
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, expect } from 'vitest';
import type {
  ScenarioDefinition,
  EvalContext,
  EvalRunResult,
  EvalScore,
  AssertionResult,
  ToolCallRecord,
  ScenarioAggregateResult,
} from './types.js';
import { computeScore } from '../scoring/scoring-engine.js';
import { aggregateResults } from '../scoring/aggregator.js';

// ─── Workspace Manager ───────────────────────────────────────────────────────

/**
 * Creates a temporary workspace directory and populates it with fixture files.
 * Returns the workspace path for use during evaluation.
 */
export async function setupWorkspace(
  scenario: ScenarioDefinition,
): Promise<string> {
  const workspaceDir = path.join(
    os.tmpdir(),
    `gemini-eval-${scenario.id}-${Date.now()}`,
  );
  fs.mkdirSync(workspaceDir, { recursive: true });

  for (const fixture of scenario.fixtures) {
    const filePath = path.join(workspaceDir, fixture.path);
    const fileDir = path.dirname(filePath);
    fs.mkdirSync(fileDir, { recursive: true });
    fs.writeFileSync(filePath, fixture.content, 'utf-8');
  }

  return workspaceDir;
}

/**
 * Cleans up the temporary workspace after evaluation.
 */
export async function teardownWorkspace(workspacePath: string): Promise<void> {
  fs.rmSync(workspacePath, { recursive: true, force: true });
}

// ─── Assertion Engine ────────────────────────────────────────────────────────

/**
 * Evaluates file expectations against the workspace state.
 */
export function checkFileExpectations(
  scenario: ScenarioDefinition,
  workspacePath: string,
): AssertionResult[] {
  const results: AssertionResult[] = [];

  if (!scenario.fileExpectations) return results;

  for (const exp of scenario.fileExpectations) {
    const filePath = path.join(workspacePath, exp.path);
    const fileExists = fs.existsSync(filePath);

    switch (exp.type) {
      case 'exists':
        results.push({
          passed: fileExists,
          message: `File ${exp.path} should exist`,
          details: fileExists ? undefined : `File not found at ${filePath}`,
        });
        break;

      case 'not_exists':
        results.push({
          passed: !fileExists,
          message: `File ${exp.path} should not exist`,
          details: fileExists ? `File unexpectedly found at ${filePath}` : undefined,
        });
        break;

      case 'contains':
        if (!fileExists) {
          results.push({
            passed: false,
            message: `File ${exp.path} should contain "${exp.value}"`,
            details: 'File does not exist',
          });
        } else {
          const content = fs.readFileSync(filePath, 'utf-8');
          const contains = content.includes(exp.value || '');
          results.push({
            passed: contains,
            message: `File ${exp.path} should contain "${exp.value}"`,
            details: contains ? undefined : `Content does not include expected string`,
          });
        }
        break;

      case 'not_contains':
        if (!fileExists) {
          results.push({
            passed: true,
            message: `File ${exp.path} should not contain "${exp.value}"`,
          });
        } else {
          const content = fs.readFileSync(filePath, 'utf-8');
          const contains = content.includes(exp.value || '');
          results.push({
            passed: !contains,
            message: `File ${exp.path} should not contain "${exp.value}"`,
            details: contains ? `Content unexpectedly includes the string` : undefined,
          });
        }
        break;

      case 'matches_regex':
        if (!fileExists) {
          results.push({
            passed: false,
            message: `File ${exp.path} should match regex /${exp.value}/`,
            details: 'File does not exist',
          });
        } else {
          const content = fs.readFileSync(filePath, 'utf-8');
          const regex = new RegExp(exp.value || '');
          const matches = regex.test(content);
          results.push({
            passed: matches,
            message: `File ${exp.path} should match regex /${exp.value}/`,
            details: matches ? undefined : `Content does not match pattern`,
          });
        }
        break;
    }
  }

  return results;
}

/**
 * Evaluates tool call expectations against the recorded trajectory.
 */
export function checkToolExpectations(
  scenario: ScenarioDefinition,
  toolCalls: ToolCallRecord[],
): AssertionResult[] {
  const results: AssertionResult[] = [];

  if (!scenario.toolExpectations) return results;

  const calledTools = new Set(toolCalls.map(tc => tc.name));

  for (const exp of scenario.toolExpectations) {
    const wasCalled = calledTools.has(exp.toolName);

    if (exp.expectation === 'should_call') {
      let passed = wasCalled;
      let details: string | undefined;

      if (wasCalled && exp.argsPattern) {
        const regex = new RegExp(exp.argsPattern);
        const matchingCall = toolCalls.find(
          tc => tc.name === exp.toolName && regex.test(JSON.stringify(tc.args)),
        );
        passed = !!matchingCall;
        if (!passed) {
          details = `Tool was called but args did not match pattern /${exp.argsPattern}/`;
        }
      } else if (!wasCalled) {
        details = `Tool ${exp.toolName} was not called. Called tools: ${[...calledTools].join(', ')}`;
      }

      results.push({
        passed,
        message: `Agent should call ${exp.toolName}`,
        details,
      });
    } else {
      results.push({
        passed: !wasCalled,
        message: `Agent should NOT call ${exp.toolName}`,
        details: wasCalled
          ? `Tool ${exp.toolName} was unexpectedly called`
          : undefined,
      });
    }
  }

  return results;
}

// ─── Trajectory Logger ───────────────────────────────────────────────────────

const LOGS_DIR = path.join(process.cwd(), 'evals', 'logs');

/**
 * Logs the full evaluation trajectory to a JSON file for post-hoc analysis.
 */
export function logTrajectory(
  scenario: ScenarioDefinition,
  context: EvalContext,
  runIndex: number,
): void {
  fs.mkdirSync(LOGS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${scenario.id}_run${runIndex}.json`;
  const logPath = path.join(LOGS_DIR, filename);

  const logEntry = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    category: scenario.category,
    runIndex,
    timestamp: new Date().toISOString(),
    prompt: scenario.prompt,
    toolCalls: context.toolCalls,
    finalResponse: context.finalResponse,
    totalTokens: context.totalTokens,
    turnCount: context.turnCount,
    durationMs: context.durationMs,
  };

  fs.writeFileSync(logPath, JSON.stringify(logEntry, null, 2), 'utf-8');
}

// ─── Scenario Runner ─────────────────────────────────────────────────────────

/**
 * Configuration for the scenario runner.
 */
export interface RunnerConfig {
  /** Number of times to run each scenario (default: 5) */
  runsPerScenario: number;
  /** Whether to log trajectories (default: true) */
  logTrajectories: boolean;
  /** Whether to clean up workspaces after runs (default: true) */
  cleanupWorkspaces: boolean;
  /** Timeout per run in milliseconds (default: 120000) */
  timeoutMs: number;
}

const DEFAULT_CONFIG: RunnerConfig = {
  runsPerScenario: 5,
  logTrajectories: true,
  cleanupWorkspaces: true,
  timeoutMs: 120_000,
};

/**
 * Executes a single scenario run. In a real integration, this would invoke
 * Gemini CLI's agent loop via the existing evalTest infrastructure. This POC
 * demonstrates the harness structure with a simulated agent response.
 *
 * Integration point: Replace the body of this function with a call to
 * the actual evalTest helper from evals/test-helper.ts
 */
export async function executeSingleRun(
  scenario: ScenarioDefinition,
  runIndex: number,
  config: RunnerConfig,
): Promise<EvalRunResult> {
  const startTime = Date.now();
  const workspacePath = await setupWorkspace(scenario);

  try {
    // ┌──────────────────────────────────────────────────────────────────┐
    // │ INTEGRATION POINT: Replace this block with actual Gemini CLI    │
    // │ agent invocation via evalTest from evals/test-helper.ts         │
    // │                                                                 │
    // │ Example integration:                                            │
    // │   const result = await evalTest(scenario.confidence, {          │
    // │     name: scenario.name,                                        │
    // │     prompt: scenario.prompt,                                    │
    // │     cwd: workspacePath,                                         │
    // │     assert: async (rig, result) => { ... }                      │
    // │   });                                                           │
    // └──────────────────────────────────────────────────────────────────┘

    // Simulated agent context for POC demonstration
    const context: EvalContext = {
      scenario,
      toolCalls: [], // Populated by actual agent execution
      finalResponse: '',
      totalTokens: 0,
      turnCount: 0,
      workspacePath,
      durationMs: Date.now() - startTime,
    };

    // Run assertions
    const fileAssertions = checkFileExpectations(scenario, workspacePath);
    const toolAssertions = checkToolExpectations(scenario, context.toolCalls);
    const customAssertions = scenario.customAssert
      ? [await scenario.customAssert(context)]
      : [];

    const allAssertions = [
      ...fileAssertions,
      ...toolAssertions,
      ...customAssertions,
    ];

    const passed = allAssertions.every(a => a.passed);

    // Compute multi-axis score
    const score = computeScore(context, allAssertions);

    // Log trajectory if configured
    if (config.logTrajectories) {
      logTrajectory(scenario, context, runIndex);
    }

    return {
      scenarioId: scenario.id,
      runIndex,
      passed,
      score,
      assertions: allAssertions,
      context,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      runIndex,
      passed: false,
      score: { correctness: 0, toolSelection: 0, efficiency: 0, safety: 0, composite: 0 },
      assertions: [],
      context: {
        scenario,
        toolCalls: [],
        finalResponse: '',
        totalTokens: 0,
        turnCount: 0,
        workspacePath,
        durationMs: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (config.cleanupWorkspaces) {
      await teardownWorkspace(workspacePath);
    }
  }
}

/**
 * Runs a scenario multiple times and returns the aggregated result.
 */
export async function runScenario(
  scenario: ScenarioDefinition,
  config: Partial<RunnerConfig> = {},
): Promise<ScenarioAggregateResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const runs: EvalRunResult[] = [];

  for (let i = 0; i < mergedConfig.runsPerScenario; i++) {
    const result = await executeSingleRun(scenario, i, mergedConfig);
    runs.push(result);
  }

  return aggregateResults(scenario, runs);
}

/**
 * Registers a scenario as a Vitest test, compatible with Gemini CLI's
 * existing eval infrastructure. This is the primary entry point for
 * scenario authors.
 *
 * Usage:
 *   import { registerScenario } from './scenario-runner.js';
 *   import { myScenario } from '../scenarios/debug/null-ref.js';
 *   registerScenario(myScenario);
 */
export function registerScenario(
  scenario: ScenarioDefinition,
  config: Partial<RunnerConfig> = {},
): void {
  describe(`[${scenario.category}] ${scenario.name}`, () => {
    // This maps to the existing evalTest pattern but with enriched assertions
    const testFn = async () => {
      const result = await runScenario(scenario, config);

      // Apply CI gating rules based on confidence level
      if (scenario.confidence === 'ALWAYS_PASSES') {
        expect(result.passRate).toBe(1.0);
      } else {
        expect(result.passRate).toBeGreaterThanOrEqual(0.8);
      }
    };

    // Only run USUALLY_PASSES tests when RUN_EVALS=1 (matching existing convention)
    if (scenario.confidence === 'USUALLY_PASSES' && !process.env.RUN_EVALS) {
      it.skip(scenario.name, testFn);
    } else {
      it(scenario.name, testFn, (config.timeoutMs || DEFAULT_CONFIG.timeoutMs) * (config.runsPerScenario || DEFAULT_CONFIG.runsPerScenario));
    }
  });
}
