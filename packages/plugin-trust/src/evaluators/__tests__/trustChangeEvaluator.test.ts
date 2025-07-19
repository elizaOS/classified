import { describe, it, expect, beforeEach } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { mock } from '@elizaos/core/test-utils';

interface MockFunction<T = any> {
  (...args: any[]): T;
  mockReturnValue: (value: T) => MockFunction<T>;
  mockResolvedValue: (value: T) => MockFunction<T>;
  mockRejectedValue: (error: any) => MockFunction<T>;
  mockImplementation: (fn: (...args: any[]) => T) => MockFunction<T>;
  calls: any[][];
  mock: {
    calls: any[][];
    results: any[];
  };
}
import { trustChangeEvaluator } from '../trustChangeEvaluator';
import { createMockRuntime, createMockMemory, createMockState } from '../../__tests__/test-utils';

describe('trustChangeEvaluator', () => {
  let runtime: IAgentRuntime;
  let trustService: any;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    trustService = {
      recordInteraction: mock().mockResolvedValue({ success: true }),
    };

    runtime = createMockRuntime({
      getService: mock().mockImplementation((name: string) => {
        if (name === 'trust' || name === 'trust-engine') {
          return trustService;
        }
        if (name === 'llm-evaluator') {
          return null;
        } // No LLM evaluator for these tests
        return null;
      }),
    });
  });

  it('should validate when trust service is available', async () => {
    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    expect(await trustChangeEvaluator.validate(runtime, memory, state)).toBe(true);
  });

  it('should not validate when trust service is unavailable', async () => {
    const runtimeNoService = createMockRuntime({
      getService: mock().mockReturnValue(null),
    });

    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    expect(await trustChangeEvaluator.validate(runtimeNoService, memory, state)).toBe(false);
  });

  it('should analyze trust evidence and update trust', async () => {
    const memory = createMockMemory('Thank you for your help!', testEntityId);
    const state = {} as State;

    const result = await trustChangeEvaluator.handler(runtime, memory, state);

    expect(trustService.recordInteraction.calls.length).toBeGreaterThan(0);
    const call = trustService.recordInteraction.calls[0][0];
    expect(call.sourceEntityId).toBe(testEntityId);
    expect(call.targetEntityId).toBe(runtime.agentId);
    expect(call.type).toBe('HELPFUL_ACTION');
    expect(call.impact).toBe(5);
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'data' in result) {
      expect(result.data?.positive).toBe(true);
    }
  });

  it('should detect negative behaviors', async () => {
    const memory = createMockMemory('This is spam spam spam!', testEntityId);
    const state = {} as State;

    const result = await trustChangeEvaluator.handler(runtime, memory, state);

    expect(trustService.recordInteraction.calls.length).toBeGreaterThan(0);
    const call = trustService.recordInteraction.calls[0][0];
    expect(call.sourceEntityId).toBe(testEntityId);
    expect(call.targetEntityId).toBe(runtime.agentId);
    expect(call.type).toBe('SPAM_BEHAVIOR');
    expect(call.impact).toBe(-10);
    expect(result).toBeDefined();
    if (result && typeof result === 'object' && 'data' in result) {
      expect(result.data?.positive).toBe(false);
    }
  });

  it('should not update trust if no patterns match', async () => {
    const memory = createMockMemory('Hello, how are you?', testEntityId);
    const state = {} as State;

    const result = await trustChangeEvaluator.handler(runtime, memory, state);

    expect(trustService.recordInteraction.calls.length).toBe(0);
    expect(result).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    trustService.recordInteraction.mockRejectedValue(new Error('Database error'));

    const memory = createMockMemory('Thank you!', testEntityId);
    const state = {} as State;

    // Should not throw
    const result = await trustChangeEvaluator.handler(runtime, memory, state);
    expect(result).toBeNull();
  });
});
