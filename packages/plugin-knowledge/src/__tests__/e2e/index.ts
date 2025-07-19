import type { TestSuite } from '@elizaos/core';
import knowledgeE2ETest from './knowledge-e2e.test';
import startupLoadingTest from './startup-loading.test';
import attachmentHandlingTest from './attachment-handling.test';
import advancedFeaturesE2ETest from './advanced-features-e2e.test';
import comprehensiveKnowledgeTest from './comprehensive-knowledge-scenarios.test';
import elizaOSDocumentationChallengeTest from './elizaos-documentation-challenge.test';
import criticalOperationsValidationTest from './critical-operations-validation.test';

/**
 * E2E Test Suite for Knowledge Plugin
 *
 * This suite contains end-to-end tests that require a full runtime environment.
 * These tests verify the complete functionality of the knowledge plugin including
 * document loading, processing, retrieval, and integration with other components.
 *
 * Enhanced with comprehensive real-world scenarios:
 * - ElizaOS Documentation Challenge: Complex Q&A with extensive knowledge base
 * - Critical Operations Validation: Document replacement, deletion, and search relevance
 */
export class KnowledgeE2ETestSuite implements TestSuite {
  name = 'knowledge-e2e';
  description =
    'End-to-end tests for the Knowledge plugin with full runtime and comprehensive scenarios';

  tests = [
    knowledgeE2ETest,
    startupLoadingTest,
    attachmentHandlingTest,
    advancedFeaturesE2ETest,
    comprehensiveKnowledgeTest,
    elizaOSDocumentationChallengeTest,
    criticalOperationsValidationTest,
  ];
}

export default new KnowledgeE2ETestSuite();

// Export individual tests for direct access
export {
  knowledgeE2ETest,
  startupLoadingTest,
  attachmentHandlingTest,
  advancedFeaturesE2ETest,
  comprehensiveKnowledgeTest,
  elizaOSDocumentationChallengeTest,
  criticalOperationsValidationTest,
};
