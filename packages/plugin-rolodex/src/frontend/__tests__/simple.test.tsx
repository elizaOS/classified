/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'bun:test';

describe('Simple Test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have document object in jsdom', () => {
    // This test runs in jsdom environment
    expect(typeof document).toBe('object');
    expect(document).toBeDefined();
  });
});
