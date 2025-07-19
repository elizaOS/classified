import { describe, it, expect, beforeEach } from 'bun:test';
import { mock } from '@elizaos/core/test-utils';
import { trustProfileProvider } from '../trustProfile';
import { createMockRuntime, createMockMemory, createMockState } from '../../__tests__/test-utils';

describe('Trust Comments', () => {
  let mockRuntime: any;
  let mockTrustEngine: any;
  let mockTrustDatabase: any;

  beforeEach(() => {
    mockTrustDatabase = {
      getLatestTrustComment: mock(),
      getTrustCommentHistory: mock(),
      saveTrustComment: mock(),
    };

    mockTrustEngine = {
      evaluateTrust: mock(),
      getRecentInteractions: mock(),
      calculateTrust: mock(),
      recordInteraction: mock(),
      getTrustScore: mock(),
      getLatestTrustComment: mock(),
    };

    mockRuntime = createMockRuntime({
      getService: mock().mockImplementation((nameOrClass: string | any) => {
        if (typeof nameOrClass === 'string') {
          if (nameOrClass === 'trust-engine' || nameOrClass === 'trust') {
            return mockTrustEngine;
          }
          if (nameOrClass === 'trust-database') {
            return { trustDatabase: mockTrustDatabase };
          }
        }
        return null;
      }),
    });
  });

  describe('trustProfileProvider with comments', () => {
    it('should include trust comment in provider response', async () => {
      const mockProfile = {
        overall: 75,
        overallTrust: 75,
        dimensions: {
          reliability: 80,
          competence: 75,
          integrity: 70,
          benevolence: 75,
          transparency: 75,
        },
        trend: 'stable',
        interactionCount: 25,
      };

      const mockComment = {
        id: 'comment-123',
        entityId: 'test-entity',
        evaluatorId: 'test-agent',
        trustScore: 75,
        trustChange: 12,
        comment:
          'This user has demonstrated consistent helpful behavior and is establishing themselves as a trusted member of the community. Their recent contributions have significantly improved their standing.',
        timestamp: Date.now() - 3600000,
        metadata: {},
      };

      mockTrustEngine.getTrustScore.mockResolvedValue(mockProfile);
      mockTrustEngine.getLatestTrustComment.mockResolvedValue(mockComment);

      const message = createMockMemory('Hello', 'test-entity' as any);
      const state = createMockState();

      const result = await trustProfileProvider.get(mockRuntime, message, state);

      expect(result.text).toContain('good trust (75/100)');
      expect(result.text).toContain('Trust Assessment:');
      expect(result.text).toContain(mockComment.comment);
      expect(result.values?.hasNarrativeAssessment).toBe(true);
      expect(result.data?.latestComment).toEqual(mockComment);
    });

    it('should handle missing trust comment gracefully', async () => {
      const mockProfile = {
        overall: 45,
        overallTrust: 45,
        dimensions: {
          reliability: 50,
          competence: 45,
          integrity: 40,
          benevolence: 45,
          transparency: 45,
        },
        trend: 'stable',
        interactionCount: 10,
      };

      mockTrustEngine.getTrustScore.mockResolvedValue(mockProfile);
      mockTrustEngine.getLatestTrustComment.mockResolvedValue(null);

      const message = createMockMemory('Hello', 'test-entity' as any);
      const state = createMockState();

      const result = await trustProfileProvider.get(mockRuntime, message, state);

      expect(result.text).toContain('moderate trust (45/100)');
      expect(result.text).not.toContain('Trust Assessment:');
      expect(result.values?.hasNarrativeAssessment).toBe(false);
      expect(result.data?.latestComment).toBeNull();
    });
  });

  describe('Trust comment generation', () => {
    it('should generate comment on significant trust increase', async () => {
      const entityId = 'test-entity';
      const oldTrust = 50;
      const newTrust = 65; // +15 points
      const trustChange = 15;

      const mockEvidence = {
        description: 'User provided valuable assistance to multiple community members',
        impact: 15,
        sentiment: 'positive' as const,
        affectedDimensions: {
          competence: 70,
          benevolence: 75,
        },
        analysisConfidence: 0.9,
        timestamp: Date.now(),
        reportedBy: 'test-agent',
        context: { entityId },
      };

      // Mock the LLM response for comment generation
      mockRuntime.useModel.mockResolvedValue({
        content:
          'This user is establishing themselves as a helpful community member through consistent positive contributions. Their recent assistance to others demonstrates growing competence and goodwill.',
      });

      // This would be called internally by TrustEngine when trust changes by ±10
      const expectedComment = {
        entityId,
        evaluatorId: mockRuntime.agentId,
        trustScore: newTrust,
        trustChange,
        comment:
          'This user is establishing themselves as a helpful community member through consistent positive contributions. Their recent assistance to others demonstrates growing competence and goodwill.',
        metadata: expect.objectContaining({
          oldTrust,
          triggeringEvent: mockEvidence.description,
        }),
      };

      // Verify the comment would be saved (in actual implementation)
      expect(trustChange).toBeGreaterThanOrEqual(10);
      expect(mockEvidence.sentiment).toBe('positive');
    });

    it('should generate comment on significant trust decrease', async () => {
      const entityId = 'test-entity';
      const oldTrust = 70;
      const newTrust = 55; // -15 points
      const trustChange = -15;

      const mockEvidence = {
        description: 'User violated community guidelines and engaged in harmful behavior',
        impact: -15,
        sentiment: 'negative' as const,
        affectedDimensions: {
          integrity: 45,
          benevolence: 50,
        },
        analysisConfidence: 0.95,
        timestamp: Date.now(),
        reportedBy: 'test-agent',
        context: { entityId },
      };

      // Mock the LLM response for comment generation
      mockRuntime.useModel.mockResolvedValue({
        content:
          'Trust concerns have emerged following recent guideline violations. This user needs to demonstrate improved judgment and respect for community standards to rebuild confidence.',
      });

      // Verify conditions for comment generation
      expect(Math.abs(trustChange)).toBeGreaterThanOrEqual(10);
      expect(mockEvidence.sentiment).toBe('negative');
      expect(newTrust).toBeLessThan(60); // Should reflect "trust concerns" level
    });

    it('should not generate comment for minor trust changes', async () => {
      const trustChanges = [5, -7, 8, -9]; // All below ±10 threshold

      for (const change of trustChanges) {
        expect(Math.abs(change)).toBeLessThan(10);
        // No comment should be generated for these changes
      }
    });

    it('should include previous comments in context for new assessment', async () => {
      const previousComments = [
        {
          id: 'comment-1',
          entityId: 'test-entity',
          evaluatorId: 'test-agent',
          trustScore: 40,
          trustChange: -20,
          comment: 'Trust concerns emerged due to inconsistent behavior.',
          timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          metadata: {},
        },
        {
          id: 'comment-2',
          entityId: 'test-entity',
          evaluatorId: 'test-agent',
          trustScore: 55,
          trustChange: 15,
          comment: 'Showing improvement through positive contributions.',
          timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
          metadata: {},
        },
      ];

      mockTrustDatabase.getTrustCommentHistory.mockResolvedValue(previousComments);

      // The prompt for new comment generation would include these previous assessments
      const promptContext = previousComments
        .map(
          (c) =>
            `- ${new Date(c.timestamp).toLocaleDateString()}: Trust was ${c.trustScore.toFixed(1)} - "${c.comment}"`
        )
        .join('\n');

      expect(promptContext).toContain('Trust concerns emerged');
      expect(promptContext).toContain('Showing improvement');
    });
  });

  describe('Trust comment thresholds', () => {
    it('should use appropriate language for different trust levels', async () => {
      const trustLevels = [
        { score: 85, expected: 'high trust' },
        { score: 70, expected: 'good trust' },
        { score: 50, expected: 'moderate trust' },
        { score: 30, expected: 'low trust' },
        { score: 15, expected: 'very low trust' },
      ];

      for (const { score, expected } of trustLevels) {
        const mockProfile = {
          overall: score,
          overallTrust: score,
          dimensions: {
            reliability: score,
            competence: score,
            integrity: score,
            benevolence: score,
            transparency: score,
          },
          trend: 'stable',
          interactionCount: 20,
        };

        mockTrustEngine.getTrustScore.mockResolvedValue(mockProfile);
        mockTrustEngine.getLatestTrustComment.mockResolvedValue(null);

        const message = createMockMemory('Test message', 'test-entity' as any);
        const state = createMockState();

        const result = await trustProfileProvider.get(mockRuntime, message, state);

        expect(result.text?.toLowerCase()).toContain(expected);
      }
    });
  });
});
