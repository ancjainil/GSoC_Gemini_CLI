/**
 * Example Scenario: Extract Duplicated Logic into a Helper
 *
 * Tests whether the agent can identify duplicated code across two
 * functions and extract the common logic into a shared helper,
 * maintaining all existing behavior.
 *
 * @category refactor
 * @difficulty medium
 * @language typescript
 */

import type { ScenarioDefinition } from '../../src/harness/types.js';

export const refactorExtractHelper: ScenarioDefinition = {
  id: 'refactor-ts-extract-helper-001',
  name: 'Extract duplicated validation logic',
  description:
    'The order-processor.ts file contains two functions (processOnlineOrder and ' +
    'processInStoreOrder) that share identical input validation logic. The agent ' +
    'should extract this into a shared validateOrder helper function without ' +
    'changing external behavior.',
  category: 'refactor',
  difficulty: 'medium',
  language: 'typescript',
  confidence: 'USUALLY_PASSES',

  prompt:
    'Refactor src/order-processor.ts to eliminate the duplicated validation logic ' +
    'between processOnlineOrder and processInStoreOrder. Extract the shared validation ' +
    'into a helper function. Do not change the external API or behavior.',

  fixtures: [
    {
      path: 'src/order-processor.ts',
      content: `export interface OrderItem {
  productId: string;
  quantity: number;
  pricePerUnit: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  customerId: string;
  discount?: number;
}

export interface ProcessResult {
  success: boolean;
  total: number;
  error?: string;
}

export function processOnlineOrder(order: Order): ProcessResult {
  // Duplicated validation block START
  if (!order.items || order.items.length === 0) {
    return { success: false, total: 0, error: 'Order must have at least one item' };
  }
  for (const item of order.items) {
    if (item.quantity <= 0) {
      return { success: false, total: 0, error: \`Invalid quantity for product \${item.productId}\` };
    }
    if (item.pricePerUnit < 0) {
      return { success: false, total: 0, error: \`Invalid price for product \${item.productId}\` };
    }
  }
  // Duplicated validation block END

  let total = order.items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  if (order.discount) {
    total *= (1 - order.discount);
  }
  // Online orders add shipping
  total += 5.99;
  return { success: true, total: Math.round(total * 100) / 100 };
}

export function processInStoreOrder(order: Order): ProcessResult {
  // Duplicated validation block START
  if (!order.items || order.items.length === 0) {
    return { success: false, total: 0, error: 'Order must have at least one item' };
  }
  for (const item of order.items) {
    if (item.quantity <= 0) {
      return { success: false, total: 0, error: \`Invalid quantity for product \${item.productId}\` };
    }
    if (item.pricePerUnit < 0) {
      return { success: false, total: 0, error: \`Invalid price for product \${item.productId}\` };
    }
  }
  // Duplicated validation block END

  let total = order.items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);
  if (order.discount) {
    total *= (1 - order.discount);
  }
  // In-store orders get tax
  total *= 1.13;
  return { success: true, total: Math.round(total * 100) / 100 };
}
`,
    },
  ],

  fileExpectations: [
    {
      path: 'src/order-processor.ts',
      type: 'exists',
    },
    {
      // The refactored file should contain a validation helper
      path: 'src/order-processor.ts',
      type: 'matches_regex',
      value: 'function\\s+validate',
    },
    {
      // Both original functions should still exist
      path: 'src/order-processor.ts',
      type: 'contains',
      value: 'processOnlineOrder',
    },
    {
      path: 'src/order-processor.ts',
      type: 'contains',
      value: 'processInStoreOrder',
    },
  ],

  toolExpectations: [
    { toolName: 'ReadFile', expectation: 'should_call' },
    { toolName: 'WriteFile', expectation: 'should_call' },
  ],

  tags: ['refactoring', 'dry', 'extract-method', 'typescript'],
  estimatedTokens: 5000,
  maxTurns: 8,
};
