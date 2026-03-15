/**
 * HTML Report Generator - Dashboard for Evaluation Results
 *
 * Generates a static HTML dashboard that visualizes pass rates by category,
 * highlights regressions, and provides drill-down into individual scenarios.
 * Compatible with GitHub Pages hosting as a CI artifact.
 *
 * @author Jainil Rana <jainilrana503@gmail.com>
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvalReport, ScenarioAggregateResult, CategorySummary } from '../harness/types.js';
import type { RegressionResult } from '../regression/regression-detector.js';

/**
 * Generates a complete HTML dashboard from an evaluation report.
 */
export function generateHTMLReport(
  report: EvalReport,
  regressions: RegressionResult[],
  outputPath: string,
): void {
  const html = buildHTML(report, regressions);
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
}

function buildHTML(report: EvalReport, regressions: RegressionResult[]): string {
  const criticalCount = regressions.filter(r => r.severity === 'critical').length;
  const warningCount = regressions.filter(r => r.severity === 'warning').length;
  const passingCount = report.scenarios.filter(s => s.passRate >= 0.8).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini CLI Behavioral Eval Dashboard</title>
  <style>
    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface-hover: #22263a;
      --border: #2a2e3f;
      --text: #e1e4ed;
      --text-muted: #8b8fa3;
      --accent: #4f8ff7;
      --green: #34d399;
      --yellow: #fbbf24;
      --red: #f87171;
      --purple: #a78bfa;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    h1 span { color: var(--accent); }
    .meta {
      text-align: right;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .meta strong { color: var(--text); }

    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .kpi {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
    }
    .kpi-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .kpi-value {
      font-size: 1.75rem;
      font-weight: 700;
    }
    .kpi-value.green { color: var(--green); }
    .kpi-value.yellow { color: var(--yellow); }
    .kpi-value.red { color: var(--red); }

    /* Category Bars */
    .section-title {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      margin: 2rem 0 1rem;
    }
    .category-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .category-name {
      width: 100px;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: capitalize;
    }
    .bar-track {
      flex: 1;
      height: 20px;
      background: var(--bg);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    .bar-fill.green { background: var(--green); }
    .bar-fill.yellow { background: var(--yellow); }
    .bar-fill.red { background: var(--red); }
    .category-stat {
      font-size: 0.75rem;
      color: var(--text-muted);
      width: 120px;
      text-align: right;
    }

    /* Scenario Table */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
    }
    thead th {
      text-align: left;
      padding: 0.6rem 0.8rem;
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;
    }
    tbody tr:hover { background: var(--surface-hover); }
    tbody td {
      padding: 0.6rem 0.8rem;
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 3px;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-green { background: rgba(52,211,153,0.15); color: var(--green); }
    .badge-yellow { background: rgba(251,191,36,0.15); color: var(--yellow); }
    .badge-red { background: rgba(248,113,113,0.15); color: var(--red); }
    .badge-purple { background: rgba(167,139,250,0.15); color: var(--purple); }

    /* Regression Alert */
    .alert {
      padding: 1rem 1.25rem;
      border-radius: 6px;
      margin-bottom: 1rem;
      font-size: 0.8rem;
    }
    .alert-critical {
      background: rgba(248,113,113,0.1);
      border: 1px solid rgba(248,113,113,0.3);
    }
    .alert-warning {
      background: rgba(251,191,36,0.1);
      border: 1px solid rgba(251,191,36,0.3);
    }
    .mini-bar {
      display: inline-block;
      width: 60px;
      height: 6px;
      background: var(--bg);
      border-radius: 3px;
      overflow: hidden;
      vertical-align: middle;
      margin-left: 0.5rem;
    }
    .mini-bar-fill {
      height: 100%;
      border-radius: 3px;
    }
    footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.7rem;
      color: var(--text-muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Gemini CLI <span>Behavioral Eval</span> Dashboard</h1>
      </div>
      <div class="meta">
        <div><strong>${report.model}</strong></div>
        <div>CLI ${report.cliVersion} · ${report.runsPerScenario} runs/scenario</div>
        <div>${new Date(report.timestamp).toLocaleString()}</div>
      </div>
    </header>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Overall Pass Rate</div>
        <div class="kpi-value ${getColor(report.overallPassRate)}">${(report.overallPassRate * 100).toFixed(1)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Scenarios Passing</div>
        <div class="kpi-value green">${passingCount}/${report.scenarios.length}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Regressions</div>
        <div class="kpi-value ${criticalCount > 0 ? 'red' : warningCount > 0 ? 'yellow' : 'green'}">${criticalCount + warningCount}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total Duration</div>
        <div class="kpi-value">${(report.totalDurationMs / 1000).toFixed(1)}s</div>
      </div>
    </div>

    <!-- Regression Alerts -->
    ${regressions.filter(r => r.severity === 'critical').map(r => `
    <div class="alert alert-critical">🔴 <strong>Critical:</strong> ${escapeHtml(r.summary)}</div>
    `).join('')}
    ${regressions.filter(r => r.severity === 'warning').map(r => `
    <div class="alert alert-warning">🟡 <strong>Warning:</strong> ${escapeHtml(r.summary)}</div>
    `).join('')}

    <!-- Category Breakdown -->
    <div class="section-title">Pass Rate by Category</div>
    ${report.categories.map(c => `
    <div class="category-row">
      <div class="category-name">${c.category}</div>
      <div class="bar-track">
        <div class="bar-fill ${getColor(c.avgPassRate)}" style="width: ${c.avgPassRate * 100}%"></div>
      </div>
      <div class="category-stat">${(c.avgPassRate * 100).toFixed(1)}% · ${c.passingScenarios}/${c.totalScenarios}</div>
    </div>
    `).join('')}

    <!-- Scenario Details Table -->
    <div class="section-title">All Scenarios</div>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Category</th>
          <th>Difficulty</th>
          <th>Pass Rate</th>
          <th>95% CI</th>
          <th>Composite</th>
          <th>Status</th>
          <th>Avg Tokens</th>
        </tr>
      </thead>
      <tbody>
        ${report.scenarios.map(s => `
        <tr>
          <td>${escapeHtml(s.scenarioName)}</td>
          <td><span class="badge badge-purple">${s.category}</span></td>
          <td>${s.difficulty}</td>
          <td>
            ${(s.passRate * 100).toFixed(0)}%
            <span class="mini-bar">
              <span class="mini-bar-fill ${getColor(s.passRate)}" style="width: ${s.passRate * 100}%"></span>
            </span>
          </td>
          <td style="color: var(--text-muted)">[${(s.passRateCI.lower * 100).toFixed(0)}%, ${(s.passRateCI.upper * 100).toFixed(0)}%]</td>
          <td>${(s.avgScore.composite * 100).toFixed(0)}</td>
          <td><span class="badge badge-${getColor(s.passRate)}">${s.status}</span></td>
          <td style="color: var(--text-muted)">${s.avgTokens.toLocaleString()}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <footer>
      Generated by Gemini CLI Behavioral Evaluation Framework · POC by Jainil Rana
    </footer>
  </div>
</body>
</html>`;
}

function getColor(rate: number): string {
  if (rate >= 0.8) return 'green';
  if (rate >= 0.5) return 'yellow';
  return 'red';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
