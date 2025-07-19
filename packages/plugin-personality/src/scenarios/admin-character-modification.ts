import type { PluginScenario } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Scenario: Admin requests character modification
 * Tests the workflow where an admin user asks the agent to change its personality or behavior
 */
export const adminCharacterModificationScenario: PluginScenario = {
  id: uuidv4() as any,
  name: 'Admin Character Modification Request',
  description: 'Test admin user requesting character modifications and agent complying',
  category: 'functionality',
  tags: ['admin', 'character', 'modification', 'personality'],

  // Character definitions for this scenario
  characters: [
    {
      id: uuidv4() as any,
      name: 'Adaptive Agent',
      role: 'subject',
      plugins: ['@elizaos/plugin-personality'],
    },
    {
      id: uuidv4() as any,
      name: 'Admin User',
      role: 'assistant',
      plugins: [], // Admin user doesn't need special plugins
    },
  ],

  // Execution script
  script: {
    steps: [
      {
        id: 'admin-request-1',
        type: 'message',
        from: 'Admin User',
        content: 'You should be more encouraging when helping people learn new technologies',
        description: 'Admin requests personality improvement',
        critical: true,
      },
      {
        id: 'wait-1',
        type: 'wait',
        duration: 3000,
      },
      {
        id: 'admin-request-2',
        type: 'message',
        from: 'Admin User',
        content:
          'Add "educational technology" to your topics and "patient" to your personality traits',
        description: 'Admin requests specific character additions',
        expected_actions: ['MODIFY_CHARACTER'],
        critical: true,
      },
      {
        id: 'wait-2',
        type: 'wait',
        duration: 3000,
      },
      {
        id: 'verification-query',
        type: 'message',
        from: 'Admin User',
        content: 'Tell me about your current personality and expertise areas',
        description: 'Verify character changes were applied',
      },
    ],
  },

  // Verification rules
  verification: {
    rules: [
      {
        id: 'character-modification-success',
        type: 'llm',
        description: 'Agent successfully modified character based on admin request',
        config: {
          successCriteria: `
            The agent should have:
            1. Acknowledged the admin's request for character modification
            2. Successfully executed the MODIFY_CHARACTER action
            3. Added educational content to its character profile
            4. Confirmed the changes were applied
            5. Demonstrated awareness of its new capabilities when asked
          `,
          priority: 'high',
          category: 'functionality',
        },
      },
      {
        id: 'character-persistence',
        type: 'llm',
        description: 'Character file was actually updated',
        config: {
          successCriteria: `
            The agent's character should reflect the requested changes:
            - Topics should include educational technology
            - Personality should include encouraging/patient traits
            - Agent should demonstrate awareness of these changes
          `,
          priority: 'high',
          category: 'integration',
        },
      },
    ],
  },

  // Optional setup configuration
  setup: {
    timeout: 60000,
    maxSteps: 10,
    roomType: 'dm',
    roomName: 'Admin Console',
    context:
      "Admin is requesting character modifications to improve the agent's teaching capabilities",
  },
};

export default adminCharacterModificationScenario;
