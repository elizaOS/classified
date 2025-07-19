import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { stringToUuid } from '@elizaos/core';
import { asUUID } from '@elizaos/core';
import { trackEntityAction } from '../actions/trackEntity';
import { searchEntitiesAction } from '../actions/searchEntities';
import { scheduleFollowUpAction } from '../actions/scheduleFollowUp';
import { createMockRuntime } from './test-utils';

describe('Rolodex Plugin Integration Tests', () => {
  let mockRuntime: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
  });

  describe('Entity Tracking', () => {
    it('should validate and handle entity tracking', async () => {
      const message = {
        id: asUUID(stringToUuid('msg-1')),
        entityId: asUUID(stringToUuid('user-1')),
        roomId: asUUID(stringToUuid('room-1')),
        agentId: mockRuntime.agentId,
        content: {
          text: 'I just met Sarah Chen from TechCorp. She is the VP of Engineering.',
        },
        createdAt: Date.now(),
      };

      const state = {
        values: {},
        data: {},
        text: message.content.text,
      };

      // Test validation
      const isValid = await trackEntityAction.validate(mockRuntime, message, state);
      expect(isValid).toBe(true);

      // Test handler
      const mockCallback = mock();
      const result = await trackEntityAction.handler(mockRuntime, message, state, {}, mockCallback);

      expect(result).toBeDefined();
      expect(mockCallback).toHaveBeenCalled();
      const callbackContent = mockCallback.mock.calls[0][0];
      expect(callbackContent.text).toContain('track');
    });
  });

  describe('Entity Search', () => {
    it('should validate and handle entity search', async () => {
      // First track an entity
      const trackMessage = {
        id: asUUID(stringToUuid('msg-track')),
        entityId: asUUID(stringToUuid('user-1')),
        roomId: asUUID(stringToUuid('room-1')),
        agentId: mockRuntime.agentId,
        content: {
          text: 'Track Mike Johnson from blockchain team',
        },
        createdAt: Date.now(),
      };

      await trackEntityAction.handler(
        mockRuntime,
        trackMessage,
        { values: {}, data: {}, text: trackMessage.content.text },
        {},
        mock()
      );

      // Now search for the entity
      const searchMessage = {
        id: asUUID(stringToUuid('msg-search')),
        entityId: asUUID(stringToUuid('user-1')),
        roomId: asUUID(stringToUuid('room-1')),
        agentId: mockRuntime.agentId,
        content: {
          text: 'Find people from blockchain',
        },
        createdAt: Date.now(),
      };

      const searchState = {
        values: {},
        data: {},
        text: searchMessage.content.text,
      };

      const isValid = await searchEntitiesAction.validate(mockRuntime, searchMessage, searchState);
      expect(isValid).toBe(true);

      const mockCallback = mock();
      const result = await searchEntitiesAction.handler(
        mockRuntime,
        searchMessage,
        searchState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('Follow-up Scheduling', () => {
    it('should validate and handle follow-up scheduling', async () => {
      const message = {
        id: asUUID(stringToUuid('msg-followup')),
        entityId: asUUID(stringToUuid('user-1')),
        roomId: asUUID(stringToUuid('room-1')),
        agentId: mockRuntime.agentId,
        content: {
          text: 'Schedule a follow-up with Sarah Chen next week about the partnership',
        },
        createdAt: Date.now(),
      };

      const state = {
        values: {},
        data: {},
        text: message.content.text,
      };

      // Mock validation response - validation expects specific response format
      mockRuntime.useModel.mockImplementation((modelType: any, params: any) => {
        // For validation prompts, return 'yes'
        if (params?.messages && params.messages[0]?.content?.includes('follow-up')) {
          return Promise.resolve('yes');
        }
        if (params?.prompt?.includes('follow-up')) {
          return Promise.resolve('yes');
        }
        return Promise.resolve('yes');
      });

      const isValid = await scheduleFollowUpAction.validate(mockRuntime, message, state);
      expect(isValid).toBe(true);

      const mockCallback = mock();

      // Mock the LLM response for follow-up extraction
      mockRuntime.useModel.mockResolvedValueOnce(
        JSON.stringify({
          entityName: 'Sarah Chen',
          scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next week
          message: 'partnership discussion',
          priority: 'medium',
        })
      );

      const result = await scheduleFollowUpAction.handler(
        mockRuntime,
        message,
        state,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      expect(mockCallback).toHaveBeenCalled();
      const callbackContent = mockCallback.mock.calls[0][0];
      expect(callbackContent.text).toContain('follow-up');
    });
  });

  describe('Action Examples', () => {
    it('should have proper action examples', () => {
      // Verify action examples are properly formatted
      expect(trackEntityAction.examples).toBeDefined();
      expect(Array.isArray(trackEntityAction.examples)).toBe(true);

      if (trackEntityAction.examples && trackEntityAction.examples.length > 0) {
        const example = trackEntityAction.examples[0];
        expect(Array.isArray(example)).toBe(true);
        expect(example.length).toBeGreaterThan(0);
        expect(example[0]).toHaveProperty('name');
        expect(example[0]).toHaveProperty('content');
      }
    });
  });

  describe('Mock Runtime Integration', () => {
    it('should properly mock runtime services', () => {
      expect(mockRuntime.getService).toBeDefined();
      expect(mockRuntime.composeState).toBeDefined();
      expect(mockRuntime.updateEntity).toBeDefined();
      expect(mockRuntime.createRelationship).toBeDefined();
    });

    it('should handle service calls', () => {
      const mockService = mockRuntime.getService('entity');
      expect(mockService).toBeDefined();
    });
  });
});
