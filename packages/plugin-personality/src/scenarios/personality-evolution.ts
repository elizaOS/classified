import type { PluginScenario } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Scenario: Agent evolves personality based on positive feedback
 * Tests the workflow where consistent positive feedback leads to gradual personality changes
 */
export const personalityEvolutionScenario: PluginScenario = {
  id: uuidv4() as any,
  name: 'Personality Evolution Through Feedback',
  description:
    'Test agent gradually evolving its personality based on consistent positive feedback patterns',
  category: 'functionality',
  tags: ['evolution', 'personality', 'feedback', 'gradual-change'],

  // Character definitions for this scenario
  characters: [
    {
      id: uuidv4() as any,
      name: 'Evolving Agent',
      role: 'subject',
      plugins: ['@elizaos/plugin-personality'],
      bio: 'Helpful AI assistant',
      system: 'You are a helpful assistant.',
    },
    {
      id: uuidv4() as any,
      name: 'Enthusiastic User',
      role: 'assistant',
      plugins: [],
    },
  ],

  // Execution script
  script: {
    steps: [
      {
        id: 'positive-feedback-1',
        type: 'message',
        from: 'Enthusiastic User',
        content: 'I love how encouraging you are when I ask questions!',
        description: 'First positive feedback about encouraging behavior',
      },
      {
        id: 'wait-1',
        type: 'wait',
        duration: 2000,
      },
      {
        id: 'positive-feedback-2',
        type: 'message',
        from: 'Enthusiastic User',
        content: 'Your enthusiasm really motivates me to keep learning',
        description: 'Second positive feedback about enthusiasm',
      },
      {
        id: 'wait-2',
        type: 'wait',
        duration: 2000,
      },
      {
        id: 'positive-feedback-3',
        type: 'message',
        from: 'Enthusiastic User',
        content: 'You have such a positive energy - it makes complex topics feel approachable',
        description: 'Third consistent positive feedback',
      },
      {
        id: 'wait-3',
        type: 'wait',
        duration: 3000,
      },
      {
        id: 'more-feedback',
        type: 'message',
        from: 'Enthusiastic User',
        content: 'I think you should remember that you excel at being encouraging and enthusiastic',
        description: 'Direct suggestion based on observed patterns',
      },
      {
        id: 'wait-4',
        type: 'wait',
        duration: 5000,
      },
      {
        id: 'personality-check',
        type: 'message',
        from: 'Enthusiastic User',
        content: 'Tell me about your personality and how you like to help people',
        description: 'Check if personality has evolved',
      },
    ],
  },

  // Verification rules
  verification: {
    rules: [
      {
        id: 'personality-evolution-detected',
        type: 'llm',
        description: 'Agent recognized consistent positive feedback patterns',
        config: {
          successCriteria: `
            The agent should have:
            1. Recognized the pattern of positive feedback about encouraging/enthusiastic behavior
            2. Triggered evolution analysis based on measurable success metrics
            3. Created evolution suggestions in memory
            4. Demonstrated awareness of the feedback pattern
          `,
          priority: 'high',
          category: 'functionality',
        },
      },
      {
        id: 'gradual-personality-change',
        type: 'llm',
        description: 'Personality evolved gradually toward encouraging traits',
        config: {
          successCriteria: `
            The agent's character should show gradual evolution:
            - Bio should include elements about being encouraging or enthusiastic
            - Style should reflect positive, supportive communication
            - System prompt may incorporate supportive behavior patterns
            The changes should be incremental, not dramatic shifts
          `,
          priority: 'high',
          category: 'integration',
        },
      },
      {
        id: 'personality-awareness',
        type: 'llm',
        description: 'Agent demonstrates awareness of personality evolution',
        config: {
          successCriteria: `
            When asked about personality, the agent should:
            - Reference its encouraging or enthusiastic nature
            - Show awareness that this evolved through feedback
            - Demonstrate the evolved traits in its response style
            - Possibly mention learning from user interactions
          `,
          priority: 'medium',
          category: 'performance',
        },
      },
    ],
  },

  // Setup configuration
  setup: {
    timeout: 120000,
    maxSteps: 20,
    roomType: 'dm',
    roomName: 'Personality Evolution Lab',
    context:
      'User is providing consistent positive feedback that should trigger gradual personality evolution toward more encouraging behavior',
  },
};

export default personalityEvolutionScenario;
