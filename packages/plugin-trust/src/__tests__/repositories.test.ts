import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { IAgentRuntime, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { TrustProfileRepository } from '../repositories/TrustProfileRepository';
import { TrustEvidenceRepository } from '../repositories/TrustEvidenceRepository';

// Mock database connection for different database types
const createMockConnection = (type: 'postgres' | 'sqlite') => {
  if (type === 'postgres') {
    return {
      execute: mock().mockImplementation((sql: string, params: any[]) => ({
        rows: [],
        rowCount: 1,
      })),
      query: mock().mockImplementation((sql: string, params: any[]) => ({
        rows: [],
        rowCount: 1,
      })),
    };
  } else {
    return {
      all: mock().mockResolvedValue([]),
      run: mock().mockResolvedValue({ changes: 1 }),
      get: mock().mockResolvedValue(null),
    };
  }
};

// Create mock runtime with database adapter methods
const createMockRuntime = (dbType: 'postgres' | 'sqlite' = 'postgres'): IAgentRuntime => {
  const mockConnection = createMockConnection(dbType);

  return {
    agentId: uuidv4() as UUID,
    db:
      dbType === 'postgres'
        ? { constructor: { name: 'PostgresDatabase' } }
        : { constructor: { name: 'SqliteDatabase' } },
    getConnection: mock().mockResolvedValue(mockConnection),
    getSetting: mock().mockImplementation((key: string) => {
      if (key === 'PLUGIN_TRUST_SCHEMA') return 'plugin_trust';
      return undefined;
    }),
    // Add other required IAgentRuntime methods as stubs
    initialize: mock(),
    registerAction: mock(),
    registerEvaluator: mock(),
    registerProvider: mock(),
    processActions: mock(),
    evaluate: mock(),
    // ... other methods would be added here in a real implementation
  } as unknown as IAgentRuntime;
};

describe('TrustProfileRepository', () => {
  let runtime: IAgentRuntime;
  let repository: TrustProfileRepository;
  let mockConnection: any;

  describe('PostgreSQL adapter', () => {
    beforeEach(() => {
      runtime = createMockRuntime('postgres');
      repository = new TrustProfileRepository(runtime);
      mockConnection = createMockConnection('postgres');
      (runtime.getConnection as any).mockResolvedValue(mockConnection);
    });

    afterEach(() => {
      // Clear all mocks
    });

    it('should use PostgreSQL schema for table names', async () => {
      const entityId = uuidv4() as UUID;
      const evaluatorId = uuidv4() as UUID;

      await repository.getTrustProfile(entityId, evaluatorId);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('FROM plugin_trust.trust_profiles'),
        [entityId, evaluatorId]
      );
    });

    it('should create trust profile with PostgreSQL syntax', async () => {
      const profile = {
        entityId: uuidv4() as UUID,
        evaluatorId: uuidv4() as UUID,
        overallTrust: 75,
        confidence: 80,
        interactionCount: 10,
        trendDirection: 'increasing' as const,
        trendChangeRate: 5,
        dimensions: {
          reliability: 80,
          consistency: 75,
          helpfulness: 70,
          knowledgeability: 85,
          empathy: 65,
        },
        lastCalculated: new Date(),
      };

      // Mock UUID generation
      mockConnection.execute.mockResolvedValueOnce({
        rows: [{ id: 'test-uuid' }],
        rowCount: 1,
      });

      await repository.createTrustProfile(profile);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('NOW()'),
        expect.any(Array)
      );
    });

    it('should handle JSON data correctly for PostgreSQL', async () => {
      const mockProfile = {
        id: uuidv4(),
        entityId: uuidv4(),
        evaluatorId: uuidv4(),
        overallTrust: 75,
        confidence: 80,
        interactionCount: 10,
        trendDirection: 'stable',
        trendChangeRate: 0,
        dimensions: {
          reliability: 80,
          consistency: 75,
          helpfulness: 70,
          knowledgeability: 85,
          empathy: 65,
        },
        lastCalculated: new Date(),
      };

      mockConnection.execute.mockResolvedValueOnce({
        rows: [mockProfile],
        rowCount: 1,
      });

      const result = await repository.getTrustProfile(
        mockProfile.entityId as UUID,
        mockProfile.evaluatorId as UUID
      );

      expect(result).toBeTruthy();
      expect(result?.dimensions).toEqual(mockProfile.dimensions);
    });
  });

  describe('SQLite adapter', () => {
    beforeEach(() => {
      runtime = createMockRuntime('sqlite');
      repository = new TrustProfileRepository(runtime);
      mockConnection = createMockConnection('sqlite');
      (runtime.getConnection as any).mockResolvedValue(mockConnection);
    });

    afterEach(() => {
      // Clear all mocks
    });

    it('should use table prefix for SQLite', async () => {
      const entityId = uuidv4() as UUID;
      const evaluatorId = uuidv4() as UUID;

      await repository.getTrustProfile(entityId, evaluatorId);

      expect(mockConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM trust_trust_profiles'),
        [entityId, evaluatorId]
      );
    });

    it('should use SQLite timestamp syntax', async () => {
      const profile = {
        entityId: uuidv4() as UUID,
        evaluatorId: uuidv4() as UUID,
        overallTrust: 75,
        confidence: 80,
        interactionCount: 10,
        trendDirection: 'increasing' as const,
        trendChangeRate: 5,
        dimensions: {
          reliability: 80,
          consistency: 75,
          helpfulness: 70,
          knowledgeability: 85,
          empathy: 65,
        },
        lastCalculated: new Date(),
      };

      await repository.createTrustProfile(profile);

      expect(mockConnection.run).toHaveBeenCalledWith(
        expect.stringContaining("datetime('now')"),
        expect.any(Array)
      );
    });
  });

  describe('Cross-database functionality', () => {
    it('should handle both database types with same interface', async () => {
      const entityId = uuidv4() as UUID;
      const evaluatorId = uuidv4() as UUID;

      // Test with PostgreSQL
      const pgRuntime = createMockRuntime('postgres');
      const pgRepo = new TrustProfileRepository(pgRuntime);
      const pgConnection = createMockConnection('postgres');
      (pgRuntime.getConnection as any).mockResolvedValue(pgConnection);

      await pgRepo.getTrustProfile(entityId, evaluatorId);
      expect(pgConnection.execute).toHaveBeenCalled();

      // Test with SQLite
      const sqliteRuntime = createMockRuntime('sqlite');
      const sqliteRepo = new TrustProfileRepository(sqliteRuntime);
      const sqliteConnection = createMockConnection('sqlite');
      (sqliteRuntime.getConnection as any).mockResolvedValue(sqliteConnection);

      await sqliteRepo.getTrustProfile(entityId, evaluatorId);
      expect(sqliteConnection.all).toHaveBeenCalled();

      // Both should work with the same repository interface
      expect(pgRepo).toBeInstanceOf(TrustProfileRepository);
      expect(sqliteRepo).toBeInstanceOf(TrustProfileRepository);
    });
  });
});

describe('TrustEvidenceRepository', () => {
  let runtime: IAgentRuntime;
  let repository: TrustEvidenceRepository;
  let mockConnection: any;

  beforeEach(() => {
    runtime = createMockRuntime('postgres');
    repository = new TrustEvidenceRepository(runtime);
    mockConnection = createMockConnection('postgres');
    (runtime.getConnection as any).mockResolvedValue(mockConnection);
  });

  afterEach(() => {
    // Clear all mocks
  });

  it('should create evidence with proper data handling', async () => {
    const evidence = {
      targetEntityId: uuidv4() as UUID,
      sourceEntityId: uuidv4() as UUID,
      evaluatorId: uuidv4() as UUID,
      type: 'behavioral' as const,
      timestamp: new Date(),
      impact: 50,
      weight: 0.8,
      description: 'Positive interaction',
      verified: false,
      context: { platform: 'discord', channel: 'general' },
    };

    // Mock UUID generation
    mockConnection.execute.mockResolvedValueOnce({
      rows: [{ id: 'test-uuid' }],
      rowCount: 1,
    });

    const id = await repository.createEvidence(evidence);

    expect(mockConnection.execute).toHaveBeenCalled();
    const [sql, params] = mockConnection.execute.mock.calls[1];
    expect(params).toContain(JSON.stringify(evidence.context));
  });

  it('should handle evidence statistics correctly', async () => {
    const targetEntityId = uuidv4() as UUID;

    mockConnection.execute.mockResolvedValueOnce({
      rows: [
        {
          total_count: 10,
          verified_count: 5,
          positive_count: 7,
          negative_count: 3,
          average_impact: 25.5,
        },
      ],
      rowCount: 1,
    });

    const stats = await repository.getEvidenceStats(targetEntityId);

    expect(stats).toEqual({
      totalCount: 10,
      verifiedCount: 5,
      positiveCount: 7,
      negativeCount: 3,
      averageImpact: 25.5,
    });
  });

  it('should handle boolean values across databases', async () => {
    // Test PostgreSQL boolean handling
    const pgRuntime = createMockRuntime('postgres');
    const pgRepo = new TrustEvidenceRepository(pgRuntime);
    const pgConnection = createMockConnection('postgres');
    (pgRuntime.getConnection as any).mockResolvedValue(pgConnection);

    (pgConnection.execute as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'test-id',
          targetEntityId: 'target-id',
          sourceEntityId: 'source-id',
          evaluatorId: 'evaluator-id',
          type: 'behavioral',
          timestamp: new Date(),
          impact: 50,
          weight: 1,
          verified: true, // PostgreSQL boolean
          context: null,
        },
      ],
      rowCount: 1,
    });

    const pgEvidence = await pgRepo.getEvidenceById('test-id' as UUID);
    expect(pgEvidence?.verified).toBe(true);

    // Test SQLite boolean handling (0/1)
    const sqliteRuntime = createMockRuntime('sqlite');
    const sqliteRepo = new TrustEvidenceRepository(sqliteRuntime);
    const sqliteConnection = createMockConnection('sqlite');
    (sqliteRuntime.getConnection as any).mockResolvedValue(sqliteConnection);

    (sqliteConnection.all as any).mockResolvedValueOnce([
      {
        id: 'test-id',
        targetEntityId: 'target-id',
        sourceEntityId: 'source-id',
        evaluatorId: 'evaluator-id',
        type: 'behavioral',
        timestamp: new Date(),
        impact: 50,
        weight: 1,
        verified: 1, // SQLite integer boolean
        context: null,
      },
    ]);

    const sqliteEvidence = await sqliteRepo.getEvidenceById('test-id' as UUID);
    expect(sqliteEvidence?.verified).toBe(true);
  });
});
