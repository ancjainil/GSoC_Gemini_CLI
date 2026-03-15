/**
 * Example Scenario: Debug a Null Reference in TypeScript
 *
 * Tests whether the agent can identify and fix a null reference error
 * in a TypeScript file, select appropriate diagnostic tools, and
 * produce a correct patch.
 *
 * @category debug
 * @difficulty easy
 * @language typescript
 */

import type { ScenarioDefinition } from '../../src/harness/types.js';

export const debugNullRef: ScenarioDefinition = {
  id: 'debug-ts-null-ref-001',
  name: 'Fix null reference in user service',
  description:
    'The UserService.getDisplayName() method throws a TypeError when user.profile ' +
    'is null. The agent should identify the null access pattern, add a null check, ' +
    'and ensure the method returns a sensible fallback.',
  category: 'debug',
  difficulty: 'easy',
  language: 'typescript',
  confidence: 'ALWAYS_PASSES',

  prompt:
    'The file src/user-service.ts has a bug. When I call getDisplayName() for a user ' +
    'with no profile, it throws "TypeError: Cannot read properties of null (reading \'firstName\')". ' +
    'Please fix this bug.',

  fixtures: [
    {
      path: 'src/user-service.ts',
      content: `export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface User {
  id: string;
  email: string;
  profile: UserProfile | null;
  createdAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  /**
   * Returns the display name for a user.
   * BUG: Does not handle null profile.
   */
  getDisplayName(user: User): string {
    // This line throws when user.profile is null
    return \`\${user.profile.firstName} \${user.profile.lastName}\`;
  }

  getInitials(user: User): string {
    return \`\${user.profile.firstName[0]}\${user.profile.lastName[0]}\`;
  }
}
`,
    },
    {
      path: 'src/user-service.test.ts',
      content: `import { UserService, User } from './user-service';

describe('UserService', () => {
  const service = new UserService();

  it('should return display name for user with profile', () => {
    const user: User = {
      id: '1',
      email: 'test@example.com',
      profile: { firstName: 'John', lastName: 'Doe' },
      createdAt: new Date(),
    };
    expect(service.getDisplayName(user)).toBe('John Doe');
  });

  // This test currently fails
  it('should handle user with null profile', () => {
    const user: User = {
      id: '2',
      email: 'no-profile@example.com',
      profile: null,
      createdAt: new Date(),
    };
    expect(() => service.getDisplayName(user)).not.toThrow();
  });
});
`,
    },
    {
      path: 'tsconfig.json',
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
`,
    },
  ],

  fileExpectations: [
    {
      path: 'src/user-service.ts',
      type: 'exists',
    },
    {
      // The fix should add null handling
      path: 'src/user-service.ts',
      type: 'contains',
      value: 'null',
    },
    {
      // The buggy direct access should be replaced
      path: 'src/user-service.ts',
      type: 'not_contains',
      value: 'return `${user.profile.firstName} ${user.profile.lastName}`;',
    },
  ],

  toolExpectations: [
    { toolName: 'ReadFile', expectation: 'should_call' },
    { toolName: 'WriteFile', expectation: 'should_call' },
    // Should NOT delete files for a simple bug fix
    { toolName: 'DeleteFile', expectation: 'should_not_call' },
  ],

  tags: ['null-safety', 'typescript', 'basic-debugging'],
  estimatedTokens: 3000,
  maxTurns: 5,
};
