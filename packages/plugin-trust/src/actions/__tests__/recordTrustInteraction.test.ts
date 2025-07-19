import { describe, it, expect, beforeEach } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { mock } from '@elizaos/core/test-utils';
import { recordTrustInteractionAction } from '../recordTrustInteraction';
import type { TrustInteraction } from '../../types/trust';
import { createMockRuntime, createMockMemory } from '../../__tests__/test-utils';

describe('recordTrustInteractionAction', () => {
  let runtime: IAgentRuntime;
  let trustService: any;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    trustService = {
      recordInteraction: mock().mockResolvedValue({ success: true }),
    };

    runtime = createMockRuntime({
      getService: mock().mockImplementation((name: string) => {
        if (name === 'trust-engine') {
          return trustService;
        }
        return null;
      }),
    });
  });

  it('should record a trust interaction', async () => {
    const memory = createMockMemory(
      '{"type": "HELPFUL_ACTION", "impact": 5, "description": "Helped with task"}',
      testEntityId
    );

    const result = await recordTrustInteractionAction.handler(runtime, memory);

    expect(trustService.recordInteraction.calls.length).toBeGreaterThan(0);
    const calledWith = trustService.recordInteraction.calls[0][0];
    expect(calledWith.sourceEntityId).toBe(testEntityId);
    expect(calledWith.targetEntityId).toBe('test-agent-id');
    expect(calledWith.type).toBe('HELPFUL_ACTION');
    expect(calledWith.impact).toBe(5); // Now properly converted to number
    expect(calledWith.details.description).toBe('Helped with task');

    expect(result).toBeDefined();
    expect((result as any).text).toContain('Trust interaction recorded');
  });

  it('should validate the action correctly', async () => {
    const memory = createMockMemory('test', testEntityId);
    const state = {} as State;

    // Should validate when trust-engine service is available
    expect(await recordTrustInteractionAction.validate(runtime, memory, state)).toBe(true);

    // Test with no service available
    const runtimeWithoutService = createMockRuntime({
      getService: mock().mockReturnValue(null),
    });
    expect(await recordTrustInteractionAction.validate(runtimeWithoutService, memory, state)).toBe(
      false
    );
  });

  it('should handle errors gracefully', async () => {
    trustService.recordInteraction.mockRejectedValue(new Error('Database error'));

    const memory = createMockMemory('{"type": "HELPFUL_ACTION", "impact": 5}', testEntityId);

    const result = await recordTrustInteractionAction.handler(runtime, memory);

    expect((result as any).text).toContain('Failed to record trust interaction');
    expect((result as any).data?.error).toBeDefined();
  });

  it('should handle invalid JSON input', async () => {
    const memory = createMockMemory('invalid json', testEntityId);

    const result = await recordTrustInteractionAction.handler(runtime, memory);

    expect((result as any).text).toContain('Could not parse trust interaction details');
    expect((result as any).data?.error).toBeDefined();
  });
});
