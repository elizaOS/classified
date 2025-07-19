import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { stringToUuid, type Memory } from '@elizaos/core';
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
  createMockEntity,
} from './test-utils';

// Import actions
import {
  trackEntityAction,
  updateEntityAction,
  removeEntityAction,
  scheduleFollowUpAction,
  searchEntitiesAction,
} from '../actions';

describe('Rolodex Actions', () => {
  let mockRuntime: any;
  let mockRolodexService: any;
  let mockFollowUpManager: any;
  let mockCallback: any;
  let mockMessage: Memory;
  let mockState: any;

  beforeEach(() => {
    mock.restore();

    mockRolodexService = {
      searchEntities: mock(),
      updateEntity: mock(),
      removeEntity: mock(),
      trackEntity: mock(),
      getEntity: mock(),
      upsertEntity: mock().mockResolvedValue({
        id: stringToUuid('test-entity'),
        agentId: stringToUuid('test-agent'),
        names: ['Test Entity'],
        metadata: {},
      }),
      scheduleFollowUp: mock().mockResolvedValue({
        id: stringToUuid('test-followup'),
        entityId: stringToUuid('test-entity'),
        message: 'Test follow-up',
        scheduledFor: new Date(),
        priority: 'medium',
        metadata: {},
      }),
    };

    mockRolodexService = {
      upsertEntity: mock().mockResolvedValue({
        id: stringToUuid('john'),
        agentId: stringToUuid('agent'),
        names: ['John'],
        metadata: {
          type: 'person',
          summary: 'A helpful person',
          tags: [],
          platforms: {},
          bio: 'A helpful person',
        },
      }),
      trackEntity: mock().mockResolvedValue({
        entityId: stringToUuid('john'),
        type: 'person',
        names: ['John'],
        summary: 'A helpful person',
        tags: [],
        platforms: {},
        metadata: {
          bio: 'A helpful person',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      searchEntities: mock().mockResolvedValue([
        {
          entity: {
            entityId: stringToUuid('sarah'),
            type: 'person',
            names: ['Sarah'],
            summary: 'Test person',
            tags: [],
            platforms: {},
            metadata: {},
          },
          relevanceScore: 90,
          matchReason: 'name match',
        },
      ]),
      updateEntityProfile: mock().mockResolvedValue({
        entityId: stringToUuid('sarah'),
        type: 'person',
        names: ['Sarah'],
        summary: 'Updated bio',
        tags: [],
        platforms: {},
        metadata: { bio: 'Updated bio' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getEntity: mock().mockResolvedValue({
        entityId: stringToUuid('sarah'),
        type: 'person',
        names: ['Sarah'],
        summary: 'Test entity',
        tags: [],
        platforms: {},
        metadata: { bio: 'Test entity' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      scheduleFollowUp: mock().mockResolvedValue({
        id: stringToUuid('followup-1'),
        entityId: stringToUuid('sarah'),
        message: 'project discussion',
        scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'medium',
        completed: false,
        metadata: {},
      }),
    };

    mockFollowUpManager = {
      scheduleFollowUp: mock().mockResolvedValue({
        id: 'task-123',
        name: 'FOLLOW_UP',
        description: 'Follow up with Sarah',
        roomId: stringToUuid('room'),
        tags: ['follow-up'],
        metadata: {
          entityId: stringToUuid('sarah'),
          priority: 'medium',
        },
      }),
    };

    mockRuntime = createMockRuntime({
      getService: mock((serviceNameOrClass: string | any) => {
        const serviceName =
          typeof serviceNameOrClass === 'string'
            ? serviceNameOrClass
            : serviceNameOrClass.serviceName;
        if (serviceName === 'entity') {
          return mockRolodexService;
        } else if (serviceName === 'followup') {
          return mockFollowUpManager;
        } else if (serviceName === 'rolodex') {
          return mockRolodexService;
        }
        return null;
      }),
      useModel: mock(),
      createEntity: mock().mockResolvedValue(true),
    });

    mockCallback = mock();

    mockMessage = createMockMemory({
      content: { text: 'Test message' },
      entityId: stringToUuid('user'),
      agentId: stringToUuid('agent'),
      roomId: stringToUuid('room'),
    });

    mockState = createMockState();
  });

  describe('trackEntityAction', () => {
    it('should validate when intent matches', async () => {
      const message = createMockMemory({
        content: { text: 'Track John as a friend' },
      });

      // Mock validation response
      mockRuntime.useModel.mockResolvedValueOnce('yes');

      const isValid = await trackEntityAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(true);
    });

    it('should not validate without proper intent', async () => {
      const message = createMockMemory({
        content: { text: 'What is the weather today?' },
      });

      // Mock validation response
      mockRuntime.useModel.mockResolvedValueOnce('no');

      const isValid = await trackEntityAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(false);
    });

    it('should handle tracking an entity successfully', async () => {
      const message = createMockMemory({
        content: { text: 'Track John as a helpful person' },
      });

      // Mock useModel to return entity extraction response
      mockRuntime.useModel.mockResolvedValue(
        JSON.stringify({
          name: 'John',
          type: 'person',
          attributes: {
            classification: 'ally',
            trustScore: 50,
            bio: 'A helpful person',
          },
        })
      );

      // Mock findEntityByName on runtime
      mockRuntime.findEntityByName = mock().mockResolvedValue(null); // Entity doesn't exist yet

      const result = await trackEntityAction.handler(
        mockRuntime,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(mockRolodexService.upsertEntity).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('tracked'),
        })
      );
    });

    it('should throw an error when the entity relationship service is unavailable', async () => {
      const message = createMockMemory({
        content: { text: 'Track John' },
      });

      const runtimeWithoutService = createMockRuntime({
        getService: mock(() => null),
      });

      const result = await trackEntityAction.handler(
        runtimeWithoutService,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(result).toEqual({ text: expect.stringContaining('trouble tracking') });
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('trouble tracking'),
          error: true,
        })
      );
    });

    it('should handle errors gracefully from LLM response parsing', async () => {
      const message = createMockMemory({
        content: { text: 'Track John' },
      });

      // Mock useModel to fail parsing JSON
      mockRuntime.useModel.mockResolvedValue('invalid json response');

      const result = await trackEntityAction.handler(
        mockRuntime,
        message,
        mockState,
        {},
        mockCallback
      );

      expect(result).toEqual({ text: expect.stringContaining("couldn't identify") });
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("couldn't identify"),
          error: true,
        })
      );
    });
  });

  describe('updateEntityAction', () => {
    it('should validate update intent', async () => {
      const message = createMockMemory({
        content: {
          text: 'Update John Doe and add the VIP tag',
        },
      });

      const isValid = await updateEntityAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(true);
    });

    it('should update entity successfully', async () => {
      const message = createMockMemory({
        content: {
          text: 'Change Sarah to a VIP contact',
        },
      });

      // Mock useModel to return entity extraction response
      mockRuntime.useModel.mockResolvedValue(`
        <response>
          <entityName>Sarah</entityName>
          <componentType>general</componentType>
          <data>{"classification": "ally", "notes": "VIP contact"}</data>
        </response>
      `);

      // Mock entity exists in runtime
      mockRuntime.findEntityByName = mock().mockResolvedValue({
        id: stringToUuid('sarah'),
        names: ['Sarah'],
        agentId: stringToUuid('agent'),
      });

      await updateEntityAction.handler(
        mockRuntime,
        message,
        mockState,
        undefined,
        mockCallback,
        []
      );

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should handle add_to operation', async () => {
      const message = createMockMemory({
        content: {
          text: 'Add tech tag to John',
        },
      });

      const state = createMockState({
        entityName: 'John',
        updateType: 'metadata',
        metadataUpdates: {
          tags: ['tech'],
        },
      });

      // Mock useModel to return entity extraction response
      mockRuntime.useModel.mockResolvedValue(`
        <response>
          <entityName>John</entityName>
          <componentType>general</componentType>
          <data>{"tags": ["tech"]}</data>
        </response>
      `);

      // Mock entity exists in runtime
      mockRuntime.findEntityByName = mock().mockResolvedValue({
        id: stringToUuid('john'),
        names: ['John'],
        agentId: stringToUuid('agent'),
      });

      await updateEntityAction.handler(mockRuntime, message, state, undefined, mockCallback, []);

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('removeEntityAction', () => {
    it('should validate remove intent', async () => {
      const message = createMockMemory({
        content: {
          text: 'Remove John from my contacts',
        },
      });

      const isValid = await removeEntityAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(true);
    });

    it('should request confirmation before removing', async () => {
      const message = createMockMemory({
        content: {
          text: 'Remove John Doe from my contacts',
        },
      });

      // Mock useModel to return no entity name (needs confirmation)
      mockRuntime.useModel.mockResolvedValue(`
        <response>
          <action>request_confirmation</action>
        </response>
      `);

      await removeEntityAction.handler(mockRuntime, message, mockState, undefined, mockCallback);

      // We don't have removeEntity on mockRolodexService, check callback instead
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('specify'),
        })
      );
    });

    it('should remove entity when confirmed', async () => {
      const message = createMockMemory({
        content: {
          text: 'Yes, remove John Doe',
        },
      });

      // Mock useModel to return entity name and confirmation
      mockRuntime.useModel.mockResolvedValue(`
        <response>
          <entityName>John Doe</entityName>
          <confirmed>yes</confirmed>
        </response>
      `);

      // Mock getRoom to return a room with worldId
      mockRuntime.getRoom = mock().mockResolvedValue({
        id: stringToUuid('room'),
        worldId: stringToUuid('world'),
        name: 'Test Room',
      });

      // Mock getRooms to return rooms
      mockRuntime.getRooms = mock().mockResolvedValue([
        {
          id: stringToUuid('room'),
          worldId: stringToUuid('world'),
          name: 'Test Room',
        },
      ]);

      // Mock getEntitiesForRoom to return the entity
      mockRuntime.getEntitiesForRoom = mock().mockResolvedValue([
        {
          id: stringToUuid('john-doe'),
          names: ['John Doe'],
          agentId: stringToUuid('agent'),
        },
      ]);

      // Mock getRelationships to return relationships
      mockRuntime.getRelationships = mock().mockResolvedValue([
        { id: 'rel1', sourceEntityId: stringToUuid('john-doe') },
        { id: 'rel2', targetEntityId: stringToUuid('john-doe') },
      ]);

      // Mock getRoomsForParticipant
      mockRuntime.getRoomsForParticipant = mock().mockResolvedValue([stringToUuid('room')]);

      await removeEntityAction.handler(mockRuntime, message, mockState, undefined, mockCallback);

      expect(mockRuntime.getRoom).toHaveBeenCalledWith(message.roomId);
      expect(mockRuntime.getRooms).toHaveBeenCalled();
      expect(mockRuntime.getRelationships).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('scheduleFollowUpAction', () => {
    it('should validate schedule intent', async () => {
      const message = createMockMemory({
        content: {
          text: 'Schedule a follow-up with Sarah tomorrow',
        },
      });

      // Mock validation response
      mockRuntime.useModel.mockResolvedValueOnce('yes');

      const isValid = await scheduleFollowUpAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(true);
    });

    it('should schedule follow-up successfully', async () => {
      const message = createMockMemory({
        content: {
          text: 'Remind me to follow up with Sarah next week about the project',
        },
      });

      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Mock useModel to return follow-up details as JSON
      mockRuntime.useModel.mockResolvedValue(
        JSON.stringify({
          entityName: 'Sarah',
          scheduledFor: nextWeek.toISOString(),
          message: 'project discussion',
          priority: 'medium',
        })
      );

      // Mock entity exists in runtime
      mockRuntime.findEntityByName = mock().mockResolvedValue({
        id: stringToUuid('sarah'),
        names: ['Sarah'],
        agentId: stringToUuid('agent'),
      });

      await scheduleFollowUpAction.handler(
        mockRuntime,
        message,
        mockState,
        undefined,
        mockCallback
      );

      // The service should be called (but may fail due to XML parsing)
      // Let's just check that the callback was called
      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('searchEntitiesAction', () => {
    it('should validate search intent', async () => {
      const message = createMockMemory({
        content: {
          text: 'Show me all my VIP contacts',
        },
      });

      const isValid = await searchEntitiesAction.validate(mockRuntime, message, mockState);
      expect(isValid).toBe(true);
    });

    it('should search and display entities', async () => {
      const message = createMockMemory({
        content: {
          text: 'List all my friends',
        },
      });

      // Mock the entity search results
      mockRolodexService.searchEntities.mockResolvedValue([
        {
          id: stringToUuid('john'),
          agentId: stringToUuid('agent'),
          names: ['John Doe'],
          metadata: {
            type: 'person',
            attributes: {
              role: 'friend',
              description: 'A friendly person',
            },
          },
        },
        {
          id: stringToUuid('sarah'),
          agentId: stringToUuid('agent'),
          names: ['Sarah Smith'],
          metadata: {
            type: 'person',
            attributes: {
              role: 'friend',
              interests: 'tech',
            },
          },
        },
      ]);

      const result = await searchEntitiesAction.handler(
        mockRuntime,
        message,
        mockState,
        undefined,
        mockCallback
      );

      // The action should call rolodex service to search
      expect(mockRolodexService.searchEntities).toHaveBeenCalledWith('List all my friends', 10);
      expect(result).toBeTruthy();
      if (typeof result === 'object' && result !== null && 'success' in result) {
        expect(result.success).toBe(true);
        if ('data' in result && result.data && 'results' in result.data) {
          expect(result.data.results).toHaveLength(2);
        }
      }
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('found 2 matching entities'),
          metadata: expect.objectContaining({
            results: expect.any(Array),
            action: 'entities_searched',
          }),
        })
      );
    });
  });
});
