import type { TestCase, IAgentRuntime, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

export const attachmentHandlingTest: TestCase = {
  name: 'Knowledge Plugin Attachment Handling Test',
  fn: async (runtime: IAgentRuntime) => {
    console.log('Starting attachment handling test...');

    // Get the knowledge service
    const service = runtime.getService('knowledge');
    if (!service) {
      throw new Error('Knowledge service not found');
    }
    console.log('✓ Knowledge service initialized');

    // Test 1: Add knowledge simulating attachment
    console.log('Test 1: Testing knowledge addition...');

    const testDoc = {
      clientDocumentId: uuidv4() as UUID,
      contentType: 'text/plain',
      originalFilename: 'attachment-test.txt',
      worldId: runtime.agentId,
      content: 'This simulates attachment content being processed by the knowledge service.',
      roomId: runtime.agentId,
      entityId: runtime.agentId,
      metadata: {
        source: 'test-attachment',
      },
    };

    try {
      const result = await (service as any).addKnowledge(testDoc);

      if (!result.storedDocumentMemoryId) {
        throw new Error('Failed to add knowledge');
      }

      console.log(`✓ Added knowledge successfully, ${result.fragmentCount} fragments created`);

      // Verify storage
      const stored = await runtime.getMemoryById(result.storedDocumentMemoryId);
      if (!stored) {
        throw new Error('Document not found in storage');
      }

      console.log('✓ Document verified in storage');

      // Cleanup
      await (service as any).deleteMemory(result.storedDocumentMemoryId);
      console.log('✓ Cleanup completed');
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }

    console.log('✅ Knowledge Plugin Attachment Handling Test PASSED');
  },
};

export default attachmentHandlingTest;
