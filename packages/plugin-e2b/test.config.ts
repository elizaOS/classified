import { E2BBasicE2ETestSuite } from './src/tests/e2e/e2b-basic';
import { AgentSandboxIntegrationE2ETestSuite } from './src/__tests__/e2e/agent-sandbox-integration.test';

export const testSuites = [new E2BBasicE2ETestSuite(), new AgentSandboxIntegrationE2ETestSuite()];

export default testSuites;
