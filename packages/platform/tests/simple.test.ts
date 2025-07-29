/**
 * Simple test to verify Jest setup works
 */

import { describe, test, expect } from 'bun:test';

describe('Simple Test Suite', () => {
  test('should pass basic test', () => {
    expect(2 + 2).toBe(4);
  });

  test('should handle async operations', async () => {
    const result = await Promise.resolve('test-value');
    expect(result).toBe('test-value');
  });
});
