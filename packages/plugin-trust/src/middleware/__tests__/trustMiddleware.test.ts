import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { TrustMiddleware } from '../trustMiddleware';
import type { Action, IAgentRuntime, Memory, ActionResult, UUID } from '@elizaos/core';
import { createMockRuntime } from '../../__tests__/test-utils';
import type { TrustService } from '../../services/TrustService';
import { TrustEvidenceType } from '../../types/trust';

describe('TrustMiddleware', () => {
  let mockRuntime: IAgentRuntime;
  let mockTrustService: Partial<TrustService>;
  let testAction: Action;
  let testMessage: Memory;

  beforeEach(() => {
    mock.restore();

    // Create mock trust service
    mockTrustService = {
      getTrustScore: mock().mockResolvedValue({
        overall: 75,
        dimensions: {
          reliability: 80,
          competence: 75,
          integrity: 70,
          benevolence: 80,
          transparency: 70,
        },
        confidence: 0.8,
        lastUpdated: Date.now(),
        trend: 'stable',
        reputation: 'good',
      }),
      updateTrust: mock().mockResolvedValue({
        overall: 76,
        dimensions: {
          reliability: 81,
          competence: 76,
          integrity: 71,
          benevolence: 81,
          transparency: 71,
        },
        confidence: 0.81,
        lastUpdated: Date.now(),
        trend: 'improving',
        reputation: 'good',
      }),
    };

    // Create mock runtime with trust service
    mockRuntime = createMockRuntime({
      getService: mock((name: string) => {
        if (name === 'trust') {
          return {
            trustService: mockTrustService,
          } as any;
        }
        return null;
      }) as any,
    });

    // Create test action
    testAction = {
      name: 'TEST_ACTION',
      description: 'Test action for middleware',
      validate: mock().mockResolvedValue(true),
      handler: mock().mockResolvedValue({
        values: { success: true },
        data: { result: 'completed' },
        text: 'Action completed successfully',
      }),
      similes: ['test', 'action'],
      examples: [],
    };

    // Create test message
    testMessage = {
      id: 'msg-123' as UUID,
      entityId: 'user-123' as UUID,
      agentId: 'agent-123' as UUID,
      roomId: 'room-123' as UUID,
      content: {
        text: 'Test message',
      },
      createdAt: Date.now(),
    };
  });

  describe('wrapAction', () => {
    it('should wrap action with trust checking', async () => {
      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      expect(wrappedAction.name).toBe(testAction.name);
      expect(wrappedAction.description).toBe(testAction.description);
      expect(wrappedAction.validate).toBeDefined();
      expect(wrappedAction.handler).toBeDefined();
    });

    it('should check trust in validate method', async () => {
      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      const isValid = await wrappedAction.validate!(mockRuntime, testMessage);

      expect(isValid).toBe(true);
      expect(mockTrustService.getTrustScore).toHaveBeenCalledWith(testMessage.entityId);
      expect(testAction.validate).toHaveBeenCalled();
    });

    it('should deny access when trust is insufficient', async () => {
      mockTrustService.getTrustScore = mock().mockResolvedValue({
        overall: 25,
        dimensions: {},
        confidence: 0.5,
        lastUpdated: Date.now(),
        trend: 'declining',
        reputation: 'poor',
      });

      const wrappedAction = TrustMiddleware.wrapAction(testAction, 50);

      const isValid = await wrappedAction.validate!(mockRuntime, testMessage);

      expect(isValid).toBe(false);
      expect(mockTrustService.updateTrust).toHaveBeenCalledWith(
        testMessage.entityId,
        TrustEvidenceType.SECURITY_VIOLATION,
        -1,
        expect.objectContaining({
          action: 'TEST_ACTION',
          requiredTrust: 50,
          actualTrust: 25,
          reason: 'insufficient_trust',
        })
      );
    });

    it('should skip trust check for agent messages', async () => {
      const agentMessage = {
        ...testMessage,
        entityId: mockRuntime.agentId,
      };

      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      const isValid = await wrappedAction.validate!(mockRuntime, agentMessage);

      expect(isValid).toBe(true);
      expect(mockTrustService.getTrustScore).not.toHaveBeenCalled();
    });

    it('should handle missing trust service gracefully', async () => {
      mockRuntime.getService = mock().mockReturnValue(null);

      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      const isValid = await wrappedAction.validate!(mockRuntime, testMessage);

      expect(isValid).toBe(false);
    });

    it('should record successful action execution', async () => {
      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      const result = await wrappedAction.handler(mockRuntime, testMessage, {
        values: {},
        data: {},
        text: '',
      });

      expect(result).toMatchObject({
        values: { success: true },
        data: { result: 'completed' },
        text: 'Action completed successfully',
      });

      expect(mockTrustService.updateTrust).toHaveBeenCalledWith(
        testMessage.entityId,
        TrustEvidenceType.HELPFUL_ACTION,
        1,
        expect.objectContaining({
          action: 'TEST_ACTION',
          elevated: false,
        })
      );
    });

    it('should record failed action execution', async () => {
      const error = new Error('Action failed');
      testAction.handler = mock().mockRejectedValue(error);

      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      await expect(
        wrappedAction.handler(mockRuntime, testMessage, { values: {}, data: {}, text: '' })
      ).rejects.toThrow('Action failed');

      expect(mockTrustService.updateTrust).toHaveBeenCalledWith(
        testMessage.entityId,
        TrustEvidenceType.HARMFUL_ACTION,
        -2,
        expect.objectContaining({
          action: 'TEST_ACTION',
          error: 'Action failed',
          elevated: false,
        })
      );
    });

    it('should handle elevated actions with higher impact', async () => {
      // Mock elevated action - use an actual high-trust action from the requirements
      const elevatedAction = {
        ...testAction,
        name: 'SHELL_EXECUTE',
      };

      const wrappedAction = TrustMiddleware.wrapAction(elevatedAction);

      await wrappedAction.handler(mockRuntime, testMessage, { values: {}, data: {}, text: '' });

      expect(mockTrustService.updateTrust).toHaveBeenCalledWith(
        testMessage.entityId,
        TrustEvidenceType.HELPFUL_ACTION,
        2, // Higher impact for elevated actions
        expect.objectContaining({
          action: 'SHELL_EXECUTE',
          elevated: true,
        })
      );
    });

    it('should convert boolean results to ActionResult format', async () => {
      testAction.handler = mock().mockResolvedValue(true);

      const wrappedAction = TrustMiddleware.wrapAction(testAction);

      const result = await wrappedAction.handler(mockRuntime, testMessage, {
        values: {},
        data: {},
        text: '',
      });

      expect(result).toMatchObject({
        values: { success: true },
        data: { action: 'TEST_ACTION', executed: true },
        text: 'Action TEST_ACTION executed successfully',
      });
    });
  });

  describe('wrapPlugin', () => {
    it('should wrap all actions in a plugin', () => {
      const testPlugin = {
        name: 'test-plugin',
        description: 'Test plugin',
        actions: [
          testAction,
          {
            name: 'ANOTHER_ACTION',
            description: 'Another test action',
            validate: mock().mockResolvedValue(true),
            handler: mock().mockResolvedValue({ values: {}, data: {}, text: 'Done' }),
            similes: [],
            examples: [],
          },
        ],
      };

      const wrappedPlugin = TrustMiddleware.wrapPlugin(testPlugin);

      expect(wrappedPlugin.name).toBe(testPlugin.name);
      expect(wrappedPlugin.actions).toHaveLength(2);
      expect(wrappedPlugin.actions![0].name).toBe('TEST_ACTION');
      expect(wrappedPlugin.actions![1].name).toBe('ANOTHER_ACTION');
    });

    it('should apply custom trust overrides', () => {
      const testPlugin = {
        name: 'test-plugin',
        description: 'Test plugin',
        actions: [testAction],
      };

      const trustOverrides = new Map([['TEST_ACTION', 90]]);

      const wrappedPlugin = TrustMiddleware.wrapPlugin(testPlugin, trustOverrides);

      // The wrapped action should use the custom trust requirement
      expect(wrappedPlugin.actions).toHaveLength(1);
    });

    it('should handle plugins without actions', () => {
      const testPlugin = {
        name: 'test-plugin',
        description: 'Test plugin without actions',
      };

      const wrappedPlugin = TrustMiddleware.wrapPlugin(testPlugin);

      expect(wrappedPlugin).toEqual(testPlugin);
    });
  });

  describe('getPluginTrustRequirements', () => {
    it('should return trust requirements for all actions', () => {
      const testPlugin = {
        name: 'test-plugin',
        description: 'Test plugin',
        actions: [
          {
            name: 'READ_DATA',
            description: 'Read data',
            validate: mock(),
            handler: mock(),
            similes: [],
            examples: [],
          },
          {
            name: 'WRITE_DATA',
            description: 'Write data',
            validate: mock(),
            handler: mock(),
            similes: [],
            examples: [],
          },
          {
            name: 'DELETE_DATA',
            description: 'Delete data',
            validate: mock(),
            handler: mock(),
            similes: [],
            examples: [],
          },
        ],
      };

      const requirements = TrustMiddleware.getPluginTrustRequirements(testPlugin);

      expect(requirements).toBeInstanceOf(Map);
      expect(requirements.size).toBe(3);
      expect(requirements.has('READ_DATA')).toBe(true);
      expect(requirements.has('WRITE_DATA')).toBe(true);
      expect(requirements.has('DELETE_DATA')).toBe(true);
    });

    it('should handle plugins without actions', () => {
      const testPlugin = {
        name: 'test-plugin',
        description: 'Test plugin without actions',
      };

      const requirements = TrustMiddleware.getPluginTrustRequirements(testPlugin);

      expect(requirements).toBeInstanceOf(Map);
      expect(requirements.size).toBe(0);
    });
  });

  describe('canExecuteAction', () => {
    it('should return true when user has sufficient trust', async () => {
      const canExecute = await TrustMiddleware.canExecuteAction(
        mockRuntime,
        'user-123' as UUID,
        'TEST_ACTION'
      );

      expect(canExecute).toBe(true);
      expect(mockTrustService.getTrustScore).toHaveBeenCalledWith('user-123' as UUID);
    });

    it('should return false when user has insufficient trust', async () => {
      mockTrustService.getTrustScore = mock().mockResolvedValue({
        overall: 25,
        dimensions: {},
        confidence: 0.5,
        lastUpdated: Date.now(),
        trend: 'declining',
        reputation: 'poor',
      });

      const canExecute = await TrustMiddleware.canExecuteAction(
        mockRuntime,
        'user-123' as UUID,
        'DELETE_ALL_DATA'
      );

      expect(canExecute).toBe(false);
    });

    it('should return false when trust service is unavailable', async () => {
      mockRuntime.getService = mock().mockReturnValue(null);

      const canExecute = await TrustMiddleware.canExecuteAction(
        mockRuntime,
        'user-123' as UUID,
        'TEST_ACTION'
      );

      expect(canExecute).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockTrustService.getTrustScore = mock().mockRejectedValue(new Error('Database error'));

      const canExecute = await TrustMiddleware.canExecuteAction(
        mockRuntime,
        'user-123' as UUID,
        'TEST_ACTION'
      );

      expect(canExecute).toBe(false);
    });
  });
});
