import type { TestSuite, UUID } from '@elizaos/core';
import { stringToUuid } from '@elizaos/core';
import { ingestGitHubAction, ingestWebPageAction } from '../../actions';

export class IngestionActionsTestSuite implements TestSuite {
  name = 'ingestion-actions-e2e';
  description = 'E2E tests for knowledge ingestion actions';

  tests = [
    {
      name: 'GitHub ingestion action should validate correctly',
      fn: async (runtime: any) => {
        const mockMessage = {
          id: stringToUuid('test-msg-1') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Ingest knowledge from https://github.com/elizaOS/knowledge',
          },
          createdAt: Date.now(),
        };

        // Test validation
        const isValid = await ingestGitHubAction.validate(runtime, mockMessage);

        if (!isValid) {
          throw new Error('GitHub ingestion action should validate for GitHub URLs');
        }

        console.log('✓ GitHub action validation passed');
      },
    },

    {
      name: 'Web page ingestion action should validate correctly',
      fn: async (runtime: any) => {
        const mockMessage = {
          id: stringToUuid('test-msg-2') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Extract knowledge from https://eliza.how/docs/intro',
          },
          createdAt: Date.now(),
        };

        // Test validation
        const isValid = await ingestWebPageAction.validate(runtime, mockMessage);

        if (!isValid) {
          throw new Error('Web page ingestion action should validate for web URLs');
        }

        console.log('✓ Web page action validation passed');
      },
    },

    {
      name: 'Actions should not validate for irrelevant messages',
      fn: async (runtime: any) => {
        const mockMessage = {
          id: stringToUuid('test-msg-3') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Just a regular conversation message',
          },
          createdAt: Date.now(),
        };

        // Test that actions don't validate for irrelevant messages
        const githubValid = await ingestGitHubAction.validate(runtime, mockMessage);
        const webPageValid = await ingestWebPageAction.validate(runtime, mockMessage);

        if (githubValid) {
          throw new Error('GitHub action should not validate for non-GitHub messages');
        }

        if (webPageValid) {
          throw new Error('Web page action should not validate for non-URL messages');
        }

        console.log('✓ Actions correctly reject irrelevant messages');
      },
    },

    {
      name: 'GitHub action should parse repository URLs correctly',
      fn: async (runtime: any) => {
        // Mock the KnowledgeService
        const mockService = {
          ingestGitHubRepository: async (options: any) => {
            // Verify the options are parsed correctly
            if (options.repoUrl !== 'https://github.com/elizaOS/eliza') {
              throw new Error(`Expected clean repo URL, got: ${options.repoUrl}`);
            }
            if (!options.subdirectories || !options.subdirectories.includes('packages/docs/docs')) {
              throw new Error('Expected subdirectories to include packages/docs/docs');
            }

            return {
              totalFiles: 5,
              processedFiles: 5,
              skippedFiles: 0,
              errors: [],
              documents: [],
            };
          },
        };

        runtime.getService = () => mockService;

        const mockMessage = {
          id: stringToUuid('test-msg-4') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Import docs from https://github.com/elizaOS/eliza/tree/develop/packages/docs/docs',
          },
          createdAt: Date.now(),
        };

        const mockCallback = async (response: any) => {
          if (!response.text.includes('Successfully ingested')) {
            throw new Error(`Expected success message, got: ${response.text}`);
          }
          return [];
        };

        const result = await ingestGitHubAction.handler(
          runtime,
          mockMessage,
          undefined,
          {},
          mockCallback
        );

        if (!result || typeof result === 'boolean' || !result.data?.repoUrl) {
          throw new Error('Expected result to contain repoUrl');
        }

        console.log('✓ GitHub URL parsing and action execution passed');
      },
    },

    {
      name: 'Web page action should handle URL extraction',
      fn: async (runtime: any) => {
        // Mock the KnowledgeService
        const mockService = {
          ingestWebPage: async (options: any) => {
            if (options.url !== 'https://eliza.how/docs/intro') {
              throw new Error(`Expected URL to be extracted correctly, got: ${options.url}`);
            }

            return {
              url: options.url,
              title: 'Introduction',
              extractedText:
                'This is the introduction page with enough content to meet requirements.',
              textLength: 75,
              document: {
                id: 'test-doc-id',
                fragmentCount: 3,
              },
            };
          },
        };

        runtime.getService = () => mockService;

        const mockMessage = {
          id: stringToUuid('test-msg-5') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Extract knowledge from https://eliza.how/docs/intro',
          },
          createdAt: Date.now(),
        };

        const mockCallback = async (response: any) => {
          if (!response.text.includes('Successfully extracted')) {
            throw new Error(`Expected success message, got: ${response.text}`);
          }
          return [];
        };

        const result = await ingestWebPageAction.handler(
          runtime,
          mockMessage,
          undefined,
          {},
          mockCallback
        );

        if (!result || typeof result === 'boolean' || !result.data?.url) {
          throw new Error('Expected result to contain URL');
        }

        console.log('✓ Web page URL extraction and action execution passed');
      },
    },

    {
      name: 'Actions should handle service unavailability gracefully',
      fn: async (runtime: any) => {
        // Mock runtime with no service
        runtime.getService = () => null;

        const mockMessage = {
          id: stringToUuid('test-msg-6') as UUID,
          entityId: stringToUuid('test-entity') as UUID,
          roomId: stringToUuid('test-room') as UUID,
          agentId: runtime.agentId,
          content: {
            text: 'Ingest from https://github.com/test/repo',
          },
          createdAt: Date.now(),
        };

        const mockCallback = async (response: any) => {
          if (!response.text.includes('Knowledge service not available')) {
            throw new Error('Expected service unavailable error message');
          }
          return [];
        };

        const result = await ingestGitHubAction.handler(
          runtime,
          mockMessage,
          undefined,
          {},
          mockCallback
        );

        if (!result || typeof result === 'boolean' || !result.data?.error) {
          throw new Error('Expected error in result data');
        }

        console.log('✓ Service unavailability handling passed');
      },
    },
  ];
}

export default new IngestionActionsTestSuite();
