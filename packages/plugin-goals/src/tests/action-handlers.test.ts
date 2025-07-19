import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { createGoalAction } from '../actions/createGoal';
import { completeGoalAction } from '../actions/completeGoal';
import { createMockRuntime } from '@elizaos/core/test-utils';
import type { IAgentRuntime, Memory, State, HandlerCallback } from '@elizaos/core';

describe('Goal Action Handlers', () => {
  let mockRuntime: IAgentRuntime;
  let mockMessage: Memory;
  let mockState: State;
  let mockCallback: HandlerCallback;

  beforeEach(() => {
    mock.restore();

    mockRuntime = createMockRuntime() as unknown as IAgentRuntime;

    // Override specific methods for testing
    mockRuntime.useModel = mock();
    mockRuntime.composeState = mock().mockResolvedValue({
      data: { messages: [], entities: [] },
      values: {},
      text: '',
    });
    (mockRuntime as any).db = null; // No database in unit tests

    mockMessage = {
      id: 'test-message-id' as any,
      entityId: 'test-entity-id' as any,
      agentId: 'test-agent-id' as any,
      roomId: 'test-room-id' as any,
      content: {
        text: 'test message',
        source: 'test',
      },
      createdAt: Date.now(),
    };

    mockState = {
      data: { messages: [], entities: [] },
      values: {},
      text: '',
    };

    mockCallback = mock().mockResolvedValue([]);
  });

  describe('createGoalAction', () => {
    it('should have correct action properties', () => {
      expect(createGoalAction.name).toBe('CREATE_GOAL');
      expect(createGoalAction.similes).toContain('ADD_GOAL');
      expect(createGoalAction.similes).toContain('NEW_GOAL');
      expect(createGoalAction.description).toBeDefined();
      expect(createGoalAction.examples).toBeDefined();
      expect(createGoalAction.examples).toHaveLength(5);
    });

    it('should always validate successfully', async () => {
      const result = await createGoalAction.validate(mockRuntime, mockMessage);
      expect(result).toBe(true);
    });

    it('should handle missing database gracefully', async () => {
      // Mock useModel to return invalid XML
      mockRuntime.useModel = mock().mockResolvedValue('Invalid response');

      const result = await createGoalAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      expect(typeof result).not.toBe('boolean');

      const actionResult = result as any;
      expect(actionResult.values.success).toBe(false);
      expect(actionResult.values.error).toBe('Failed to understand goal');
    });
  });

  describe('completeGoalAction', () => {
    it('should have correct action properties', () => {
      expect(completeGoalAction.name).toBe('COMPLETE_GOAL');
      expect(completeGoalAction.similes).toContain('FINISH_GOAL');
      expect(completeGoalAction.similes).toContain('CHECK_OFF_GOAL');
      expect(completeGoalAction.description).toBeDefined();
    });

    it('should validate based on database availability', async () => {
      // Without database, should return false
      const result = await completeGoalAction.validate(mockRuntime, mockMessage);
      expect(result).toBe(false);

      // With database mock
      mockRuntime.db = {} as any;
      const resultWithDb = await completeGoalAction.validate(mockRuntime, mockMessage);
      expect(resultWithDb).toBe(false); // Still false because no goal data service
    });
  });
});
