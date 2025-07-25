import type { TestSuite } from '@elizaos/core';
import selfModificationTestSuite from './self-modification.test';
import agentIntegrationTestSuite from '../integration/agent-integration.test';
import realRuntimeTestSuite from '../real-runtime/self-modification-real.test';

export const testSuites: TestSuite[] = [
  realRuntimeTestSuite,
  selfModificationTestSuite,
  agentIntegrationTestSuite,
];

export default testSuites;
