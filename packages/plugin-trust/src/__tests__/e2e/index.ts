import { trustPluginE2ETests } from './trust-plugin-e2e';
import { trustActionsE2ETests } from './trust-actions-e2e';
import { trustSecurityE2ETests } from './trust-security-e2e';
import { trustIntegrationE2ETests } from './trust-integration-e2e';

export const testSuites = [
  trustPluginE2ETests,
  trustActionsE2ETests,
  trustSecurityE2ETests,
  trustIntegrationE2ETests,
];

export default testSuites;
