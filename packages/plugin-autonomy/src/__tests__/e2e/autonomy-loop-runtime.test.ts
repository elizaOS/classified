import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { IAgentRuntime } from '@elizaos/core';
// import { createTestRuntime } from '@elizaos/core/test-utils'; // TODO: Re-enable when test-utils is available

// Test file temporarily disabled - uncomment when test-utils is available
export {}; // Keep file as module while tests are disabled

/* TODO: Re-enable tests when createTestRuntime is available
import { autoPlugin } from '../../index';
import { AutonomousLoopService } from '../../loop-service';

describe('Autonomy Loop Runtime Tests', () => {
  let runtime: IAgentRuntime;
  let harness: any;
  let service: AutonomousLoopService;
  let messageCount = 0;
  let processedMessages: any[] = [];

  beforeAll(async () => {
    console.log('🔧 Setting up runtime for loop verification tests...');

    const result = await createTestRuntime({
      character: {
        name: 'LoopTestAgent',
        bio: ['A test agent for verifying autonomous loop operation'],
        system: 'You are a test agent that responds briefly to demonstrate the loop is working.',
        settings: {
          AUTONOMY_ENABLED: false,
          ADMIN_USER_ID: 'test-admin',
        },
      },
      plugins: [autoPlugin],
    });

    runtime = result.runtime;
    harness = result.harness;

    // Get the service
    service = runtime.getService('autonomous-loop') as AutonomousLoopService;
    expect(service).toBeDefined();

    // Mock executeLoop to track calls
    const originalExecute = (service as any).executeLoop;
    (service as any).executeLoop = async function() {
      messageCount++;
      processedMessages.push({
        count: messageCount,
        timestamp: Date.now(),
      });
      console.log(`✅ Autonomous loop execution ${messageCount} triggered`);

      // Call the original method to ensure normal operation
      return originalExecute.call(this);
    };

    console.log('✅ Test runtime ready for loop verification');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up...');
    if (service && service.isLoopRunning()) {
      await service.stopLoop();
    }
    await harness.cleanup();
  });

  describe('Loop Execution Tests', () => {
    it('should actually run the loop and process messages', async () => {
      // Reset counters
      messageCount = 0;
      processedMessages = [];

      // Set a short interval for testing (2 seconds)
      service.setLoopInterval(2000);

      // Start the loop
      await service.startLoop();
      expect(service.isLoopRunning()).toBe(true);
      console.log('✅ Loop started with 2s interval');

      // Wait for 5 seconds to allow 2-3 iterations
      console.log('⏳ Waiting 5 seconds for loop iterations...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Stop the loop
      await service.stopLoop();
      expect(service.isLoopRunning()).toBe(false);
      console.log('✅ Loop stopped');

      // Verify messages were processed
      expect(messageCount).toBeGreaterThanOrEqual(2);
      expect(messageCount).toBeLessThanOrEqual(3);
      console.log(`✅ Processed ${messageCount} autonomous messages in 5 seconds`);

      // Verify timing between messages
      if (processedMessages.length >= 2) {
        const timeDiff = processedMessages[1].timestamp - processedMessages[0].timestamp;
        expect(timeDiff).toBeGreaterThanOrEqual(1900); // Allow small variance
        expect(timeDiff).toBeLessThanOrEqual(2100);
        console.log(`✅ Time between messages: ${timeDiff}ms (expected ~2000ms)`);
      }
    });

    it('should stop processing when loop is disabled', async () => {
      // Reset counters
      messageCount = 0;
      processedMessages = [];

      // Start the loop
      service.setLoopInterval(1000); // 1 second for faster test
      await service.startLoop();

      // Wait for first message
      await new Promise(resolve => setTimeout(resolve, 1500));
      const countAfterStart = messageCount;
      expect(countAfterStart).toBeGreaterThanOrEqual(1);
      console.log(`✅ Processed ${countAfterStart} message(s) after start`);

      // Stop the loop
      await service.stopLoop();
      const countAtStop = messageCount;

      // Wait another 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify no new messages were processed
      expect(messageCount).toBe(countAtStop);
      console.log('✅ No messages processed after stopping loop');
    });
  });

  describe('API Integration Tests', () => {
    it('should start/stop loop via API endpoints', async () => {
      // Reset counters
      messageCount = 0;
      processedMessages = [];

      // Find enable endpoint
      const enableRoute = runtime.routes.find(r => r.path === '/autonomy/enable');
      expect(enableRoute).toBeDefined();

      // Mock response
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {
          console.log('Enable response:', data);
        },
      };

      // Enable via API
      await enableRoute!.handler({} as any, mockRes as any, runtime);
      expect(service.isLoopRunning()).toBe(true);
      console.log('✅ Loop enabled via API');

      // Set short interval
      service.setLoopInterval(1000);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2500));
      expect(messageCount).toBeGreaterThanOrEqual(2);
      console.log(`✅ Processed ${messageCount} messages via API-enabled loop`);

      // Find disable endpoint
      const disableRoute = runtime.routes.find(r => r.path === '/autonomy/disable');
      expect(disableRoute).toBeDefined();

      // Disable via API
      await disableRoute!.handler({} as any, mockRes as any, runtime);
      expect(service.isLoopRunning()).toBe(false);
      console.log('✅ Loop disabled via API');
    });

    it('should handle interval changes while running', async () => {
      // Reset counters
      messageCount = 0;
      processedMessages = [];

      // Start with 2s interval
      service.setLoopInterval(2000);
      await service.startLoop();

      // Wait for first message
      await new Promise(resolve => setTimeout(resolve, 2500));
      const firstCount = messageCount;
      expect(firstCount).toBeGreaterThanOrEqual(1);

      // Change to 1s interval via API
      const intervalRoute = runtime.routes.find(r => r.path === '/autonomy/interval');
      expect(intervalRoute).toBeDefined();

      const mockReq = { body: { interval: 1000 } };
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {},
      };

      await intervalRoute!.handler(mockReq as any, mockRes as any, runtime);
      console.log('✅ Changed interval to 1s while running');

      // Reset counter and wait 3s
      messageCount = 0;
      await new Promise(resolve => setTimeout(resolve, 7777));

      // Should have ~3 messages with 1s interval
      expect(messageCount).toBeGreaterThanOrEqual(2);
      expect(messageCount).toBeLessThanOrEqual(4);
      console.log(`✅ Processed ${messageCount} messages in 3s with 1s interval`);

      // Stop the loop
      await service.stopLoop();
    });
  });

  describe('Loop State Persistence', () => {
    it('should restore loop state after restart', async () => {
      // Enable and configure loop
      await service.startLoop();
      service.setLoopInterval(1500);
      expect(runtime.getSetting('AUTONOMY_ENABLED')).toBe(true);

      // Simulate service restart by creating new instance
      const newService = new AutonomousLoopService(runtime);

      // Check that AUTONOMY_ENABLED setting exists
      const enabled = runtime.getSetting('AUTONOMY_ENABLED');
      expect(enabled).toBe(true);

      // Initialize should pick up the enabled state
      await newService.initialize();

      // Check state was restored (enabled state persists, interval doesn't)
      expect(newService.getStatus().enabled).toBe(true);
      // Interval resets to default since it's not persisted
      expect(newService.getLoopInterval()).toBe(30000); // Default value
      console.log('✅ Loop enabled state persisted and restored');

      // Cleanup
      await service.stopLoop();
      await newService.stop();
    });
  });
});
*/
