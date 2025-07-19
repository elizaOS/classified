import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { stringToUuid } from '@elizaos/core';
import type { EntityProfile } from '../types';
import { asUUID } from '@elizaos/core';
import { createRolodexService } from './test-service-helper';
import type { RolodexService } from '../services/RolodexService';

// Create mock runtime
const createMockRuntime = (): any => ({
  agentId: stringToUuid('test-agent'),
  getEntityById: mock(),
  updateEntity: mock(),
  getEntitiesForRoom: mock(),
  getRoomsForParticipant: mock(),
  getRelationships: mock().mockResolvedValue([]),
  createRelationship: mock(),
  updateRelationship: mock(),
  getTasks: mock().mockResolvedValue([]),
  createTask: mock(),
  useModel: mock(),
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
  },
});

describe('RolodexService', () => {
  let service: RolodexService;
  let mockRuntime: any;

  beforeEach(() => {
    mock.restore();
    mockRuntime = createMockRuntime();
    service = createRolodexService(mockRuntime);
  });

  describe('Entity Management', () => {
    it('should search entities using natural language', async () => {
      const query = 'Who do I know at tech companies?';

      // Mock the entity graph manager
      service.entityGraphManager = {
        searchEntities: mock().mockResolvedValue([
          {
            entity: {
              entityId: stringToUuid('sarah'),
              agentId: mockRuntime.agentId,
              type: 'person',
              names: ['Sarah Chen'],
              summary: 'VP at Apple',
              tags: ['tech', 'Apple'],
              metadata: { company: 'Apple' },
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
            },
            relevanceScore: 95,
            matchReason: 'Works at Apple (tech company)',
          },
          {
            entity: {
              entityId: stringToUuid('john'),
              agentId: mockRuntime.agentId,
              type: 'person',
              names: ['John Doe'],
              summary: 'Engineer at Google',
              tags: ['tech', 'Google'],
              metadata: { company: 'Google' },
              createdAt: '2023-01-01',
              updatedAt: '2023-01-01',
            },
            relevanceScore: 90,
            matchReason: 'Works at Google (tech company)',
          },
        ]),
      } as any;

      const results = await service.searchEntities(query);

      expect(results).toHaveLength(2);
      expect(results[0].names).toContain('Sarah Chen');
      expect(results[1].names).toContain('John Doe');
    });
  });

  describe('Relationship Management', () => {
    it('should get relationships for an entity', async () => {
      const entityId = asUUID(stringToUuid('user'));

      // Mock the entity graph manager
      service.entityGraphManager = {
        getEntityRelationships: mock().mockResolvedValue([
          {
            id: asUUID(stringToUuid('rel-1')),
            sourceEntityId: entityId,
            targetEntityId: asUUID(stringToUuid('sarah')),
            relationshipType: 'colleague',
            strength: 80,
            sentiment: 75,
            lastInteraction: new Date().toISOString(),
            metadata: {},
          },
        ]),
      } as any;

      const relationships = await service.getRelationships(entityId);

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe('colleague');
    });
  });

  describe('Follow-up Management', () => {
    it('should schedule a follow-up task', async () => {
      const entityId = asUUID(stringToUuid('sarah'));
      const followUp = {
        message: 'Discuss the project timeline',
        scheduledFor: new Date(Date.now() + 86400000), // Tomorrow
        priority: 'high' as const,
      };

      // Mock the follow-up manager
      service.followUpManager = {
        scheduleFollowUp: mock().mockResolvedValue({
          id: 'followup-1',
          entityId,
          message: followUp.message,
          scheduledFor: followUp.scheduledFor.toISOString(),
          completed: false,
        }),
      } as any;

      const result = await service.scheduleFollowUp(entityId, followUp);

      expect(result).toBeDefined();
      expect(result.entityId).toBe(entityId);
      expect(result.message).toBe(followUp.message);
    });

    it('should retrieve scheduled follow-ups', async () => {
      const entityId = asUUID(stringToUuid('sarah'));

      // Mock the follow-up manager
      service.followUpManager = {
        getFollowUps: mock().mockResolvedValue([
          {
            id: 'followup-1',
            entityId,
            message: 'Check project status',
            scheduledFor: new Date(Date.now() + 86400000).toISOString(),
            completed: false,
          },
        ]),
      } as any;

      const results = await service.getUpcomingFollowUps({ entityId });

      expect(results).toHaveLength(1);
      expect(results[0].entityId).toBe(entityId);
      expect(results[0].message).toBe('Check project status');
    });
  });
});
