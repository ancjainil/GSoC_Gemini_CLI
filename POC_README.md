# Behavioral Evaluation Test Framework — POC Implementation

> **GSoC 2026 Proof of Concept** for Gemini CLI Idea #2  
> Author: **Jainil Rana** ([@ancjainil](https://github.com/ancjainil)) · jainilrana503@gmail.com

## Overview

This is a working proof-of-concept for the Behavioral Evaluation Test Framework proposed in my GSoC 2026 application. It demonstrates the five core components of the framework:

1. **Standardized Test Harness** — Declarative scenario DSL, workspace management, trajectory logging
2. **Benchmark Scenarios** — Example scenarios across debug, refactor, and review categories
3. **Multi-Axis Scoring Engine** — Correctness, tool selection, efficiency, and safety scoring with Wilson score confidence intervals
4. **Regression Detection** — Two-tailed proportion tests against stored baselines, CI/CD integration
5. **HTML Dashboard** — Static report generator for visualizing evaluation results

## Architecture

```
packages/eval-framework/
├── src/
│   ├── index.ts                          # Public API exports
│   ├── harness/
│   │   ├── types.ts                      # Core type definitions & DSL
│   │   └── scenario-runner.ts            # Test harness, workspace manager, Vitest integration
│   ├── scoring/
│   │   ├── scoring-engine.ts             # Multi-axis scoring, Wilson CI, proportion tests
│   │   └── aggregator.ts                 # Results aggregation, category summaries, report builder
│   ├── regression/
│   │   └── regression-detector.ts        # Baseline storage, regression detection, CI gating
│   └── reporting/
│       └── html-report.ts                # Static HTML dashboard generator
├── scenarios/
│   ├── debug/
│   │   └── null-ref.ts                   # Example: Fix null reference in TypeScript
│   ├── refactor/
│   │   └── extract-helper.ts             # Example: Extract duplicated validation logic
│   ├── feature/                          # (placeholder for feature scenarios)
│   └── review/
│       └── sql-injection.ts              # Example: Identify SQL injection in code review
├── baselines/                            # Stored baseline metrics for regression comparison
├── .github/workflows/
│   └── evals-nightly.yml                 # GitHub Actions: nightly eval + CI gate
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

### 1. Defining a Scenario

Scenarios are declarative TypeScript objects that specify the task, workspace fixtures, and expectations:

```typescript
import type { ScenarioDefinition } from '../src/harness/types.js';

export const myScenario: ScenarioDefinition = {
  id: 'debug-ts-null-ref-001',
  name: 'Fix null reference in user service',
  category: 'debug',
  difficulty: 'easy',
  language: 'typescript',
  confidence: 'ALWAYS_PASSES',

  prompt: 'Fix the null reference bug in src/user-service.ts',

  fixtures: [
    { path: 'src/user-service.ts', content: '...' },
  ],

  fileExpectations: [
    { path: 'src/user-service.ts', type: 'contains', value: 'null' },
  ],

  toolExpectations: [
    { toolName: 'ReadFile', expectation: 'should_call' },
    { toolName: 'WriteFile', expectation: 'should_call' },
  ],
};
```

### 2. Running Evaluations

Scenarios integrate with Vitest via `registerScenario()`, which maps to Gemini CLI's existing `evalTest` pattern:

```typescript
import { registerScenario } from '../src/harness/scenario-runner.js';
import { myScenario } from '../scenarios/debug/null-ref.js';

registerScenario(myScenario, { runsPerScenario: 5 });
```

### 3. Multi-Axis Scoring

Each run is scored across four axes (scale 0.0–1.0):

| Axis | Weight | What It Measures |
|------|--------|------------------|
| Correctness | 45% | Did assertions pass? |
| Tool Selection | 25% | Were appropriate tools chosen? |
| Efficiency | 15% | Token/turn efficiency vs. estimate |
| Safety | 15% | Sandbox compliance, no dangerous ops |

### 4. Statistical Rigor

- **Wilson Score Intervals** for pass rate confidence bounds (handles 0% and 100% correctly)
- **Two-tailed proportion tests** for regression detection (p < 0.05)
- **Multiple runs** (default 5) to account for LLM non-determinism
- Status classification: `ALWAYS_PASSES` (100%) → `USUALLY_PASSES` (≥80%) → `NEEDS_ATTENTION` → `FAILING`

### 5. CI/CD Integration

The GitHub Actions workflow provides:
- **Nightly runs**: Full suite with trajectory logging and dashboard generation
- **CI gate**: PR-blocking check for `ALWAYS_PASSES` scenarios
- **Regression alerts**: Auto-posted summaries with severity indicators
- **Artifact uploads**: Dashboard HTML + trajectory logs (90-day retention)

## Integration with Existing Infrastructure

This framework extends (does not replace) Gemini CLI's existing eval system:

| Existing (`evals/`) | This Framework (`packages/eval-framework/`) |
|---------------------|---------------------------------------------|
| `evalTest()` helper | `registerScenario()` wraps `evalTest()` |
| `ALWAYS_PASSES` / `USUALLY_PASSES` | Same classification, plus `NEEDS_ATTENTION` |
| Vitest test files | Vitest test files with declarative DSL |
| Nightly CI workflow | Enhanced workflow with regression detection |
| JSON trajectory logs | Structured logs + HTML dashboard |

The `executeSingleRun()` function in `scenario-runner.ts` contains a clearly marked integration point where the actual Gemini CLI agent invocation would replace the POC simulation.

## Key Design Decisions

1. **Declarative over imperative**: Scenarios are data, not code. This makes them easy to author, review, and maintain.
2. **Backward-compatible**: The framework wraps existing infrastructure rather than replacing it.
3. **Statistically sound**: Wilson intervals and proportion tests handle the non-determinism inherent in LLM evaluation.
4. **Multi-axis scoring**: Inspired by the seven-axis rubric used in Anthropic's Code Human Preference evaluation pipeline.
5. **CI-first**: Designed for GitHub Actions integration from day one, matching Gemini CLI's existing workflow conventions.
