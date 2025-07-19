import type { Plugin } from '@elizaos/core';
import { RolodexService } from './services/RolodexService';
import * as actions from './actions';
import * as providers from './providers';
import * as evaluators from './evaluators';
import tests from './tests';
import { rolodexSchema } from './drizzle-schema';

export const rolodexPlugin: Plugin = {
  name: 'rolodex',
  description: 'Advanced entity and relationship management with trust integration',
  services: [RolodexService as any],
  actions: Object.values(actions),
  providers: Object.values(providers) as any[],
  evaluators: Object.values(evaluators) as any[],
  dependencies: ['@elizaos/plugin-sql'],
  testDependencies: ['@elizaos/plugin-sql'],
  tests: [tests],
  schema: rolodexSchema,
};

// Export the main service
export { RolodexService } from './services/RolodexService';

// Export types
export * from './types';

// Export the plugin as default
export default rolodexPlugin;
