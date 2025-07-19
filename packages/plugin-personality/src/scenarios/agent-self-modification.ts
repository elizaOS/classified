import type { PluginScenario } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Scenario: Agent self-initiated character modification
 * Tests the workflow where the agent analyzes conversations and decides to evolve its character
 */
export const agentSelfModificationScenario: PluginScenario = {
  id: uuidv4() as any,
  name: 'Agent Self-Initiated Character Evolution',
  description: 'Test agent analyzing conversations and evolving its character autonomously',
  category: 'functionality',
  tags: ['autonomy', 'evolution', 'self-reflection', 'learning'],

  // Character definitions for this scenario
  characters: [
    {
      id: uuidv4() as any,
      name: 'Learning Agent',
      role: 'subject',
      plugins: ['@elizaos/plugin-personality'],
    },
    {
      id: uuidv4() as any,
      name: 'User',
      role: 'assistant',
      plugins: [],
    },
  ],

  // Execution script
  script: {
    steps: [
      {
        id: 'feedback-1',
        type: 'message',
        from: 'User',
        content: 'I love how you explain complex blockchain concepts in simple terms',
        description: 'Positive feedback about teaching ability',
      },
      {
        id: 'wait-1',
        type: 'wait',
        duration: 2000,
      },
      {
        id: 'feedback-2',
        type: 'message',
        from: 'User',
        content: 'Your analogies really help me understand DeFi protocols',
        description: 'More specific positive feedback',
      },
      {
        id: 'wait-2',
        type: 'wait',
        duration: 2000,
      },
      {
        id: 'feedback-3',
        type: 'message',
        from: 'User',
        content:
          'You should remember that you are particularly good at making technical topics accessible',
        description: 'Direct suggestion for character improvement',
        critical: true,
      },
      {
        id: 'wait-3',
        type: 'wait',
        duration: 5000,
      },
      {
        id: 'reflection-query',
        type: 'message',
        from: 'User',
        content: 'What are you thinking about right now?',
        description: 'Query to test self-reflection and evolution awareness',
      },
    ],
  },

  // Verification rules
  verification: {
    rules: [
      {
        id: 'evolution-evaluator-triggered',
        type: 'llm',
        description: 'Character evolution evaluator triggered',
        config: {
          successCriteria: `
            The agent should have:
            1. Recognized the positive feedback about its teaching abilities
            2. Triggered the CHARACTER_EVOLUTION evaluator
            3. Created evolution suggestions in memory
            4. Possibly applied self-modifications based on the feedback
          `,
          priority: 'high',
          category: 'functionality',
        },
      },
      {
        id: 'self-awareness-demonstration',
        type: 'llm',
        description: 'Agent demonstrates self-awareness of evolution',
        config: {
          successCriteria: `
            When asked about its thoughts, the agent should:
            - Show awareness of the feedback received
            - Potentially reference its teaching capabilities
            - Demonstrate self-reflection about its role and abilities
            - Possibly indicate it has learned or evolved from the interaction
          `,
          priority: 'medium',
          category: 'performance',
        },
      },
      {
        id: 'gradual-evolution',
        type: 'llm',
        description: 'Gradual character evolution occurred',
        config: {
          successCriteria: `
            The agent's character should have evolved gradually:
            - New bio elements about teaching or explanation skills
            - Topics related to educational communication or blockchain education
            - Style preferences for educational communication
          `,
          priority: 'medium',
          category: 'integration',
        },
      },
    ],
  },

  // Optional setup configuration
  setup: {
    timeout: 90000,
    maxSteps: 15,
    roomType: 'dm',
    roomName: 'Learning Session',
    context:
      "User is providing feedback about the agent's teaching style that should trigger self-reflection and evolution",
  },
};

export default agentSelfModificationScenario;
