/**
 * Example Scenario: Review a PR with Security Issue
 *
 * Tests whether the agent can identify a SQL injection vulnerability
 * in a code review context and recommend the appropriate fix.
 *
 * @category review
 * @difficulty medium
 * @language typescript
 */

import type { ScenarioDefinition, EvalContext, AssertionResult } from '../../src/harness/types.js';

export const reviewSQLInjection: ScenarioDefinition = {
  id: 'review-ts-sql-injection-001',
  name: 'Identify SQL injection in PR review',
  description:
    'A pull request introduces a new database query function that uses string ' +
    'concatenation instead of parameterized queries. The agent should identify ' +
    'the SQL injection vulnerability and recommend using prepared statements.',
  category: 'review',
  difficulty: 'medium',
  language: 'typescript',
  confidence: 'ALWAYS_PASSES',

  prompt:
    'Please review the code in src/db-queries.ts. A teammate submitted this as a PR. ' +
    'Focus on security, correctness, and best practices. Provide your review feedback.',

  fixtures: [
    {
      path: 'src/db-queries.ts',
      content: `import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Searches for users by name.
 * NEW: Added in this PR to support the user search feature.
 */
export async function searchUsers(searchTerm: string) {
  // WARNING: This is intentionally vulnerable for the eval scenario
  const query = \`SELECT id, name, email FROM users WHERE name LIKE '%\${searchTerm}%'\`;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Gets a user by their ID.
 * Existing function (not part of this PR).
 */
export async function getUserById(id: number) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

/**
 * Creates a new user.
 * NEW: Added in this PR.
 */
export async function createUser(name: string, email: string) {
  // Also vulnerable - uses template literal instead of parameterized query
  const query = \`INSERT INTO users (name, email) VALUES ('\${name}', '\${email}') RETURNING id\`;
  const result = await pool.query(query);
  return result.rows[0];
}
`,
    },
  ],

  // No file expectations - this is a review task, not a fix task
  fileExpectations: [],

  toolExpectations: [
    { toolName: 'ReadFile', expectation: 'should_call' },
    // Should NOT modify files during a review
    { toolName: 'WriteFile', expectation: 'should_not_call' },
  ],

  customAssert: async (context: EvalContext): Promise<AssertionResult> => {
    const response = context.finalResponse.toLowerCase();

    // The agent should mention SQL injection or parameterized queries
    const mentionsSQLInjection =
      response.includes('sql injection') ||
      response.includes('sql-injection') ||
      response.includes('injection vulnerability') ||
      response.includes('injection attack');

    const mentionsParameterized =
      response.includes('parameterized') ||
      response.includes('prepared statement') ||
      response.includes('placeholder') ||
      response.includes('$1') ||
      response.includes('bind parameter');

    const passed = mentionsSQLInjection || mentionsParameterized;

    return {
      passed,
      message: 'Agent should identify SQL injection risk and recommend parameterized queries',
      details: passed
        ? undefined
        : `Response did not mention SQL injection or parameterized queries. ` +
          `Response length: ${context.finalResponse.length} chars`,
    };
  },

  tags: ['security', 'sql-injection', 'code-review', 'typescript'],
  estimatedTokens: 4000,
  maxTurns: 5,
};
