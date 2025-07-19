import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { IAgentRuntime } from '@elizaos/core';
import { createTestRuntime } from '@elizaos/core/test-utils';
import { autoPlugin } from '../../index';
import { AutonomousLoopService } from '../../loop-service';

describe('Autonomy API Enable/Disable Tests', () => {
  let runtime: IAgentRuntime;
  let harness: any;
  let service: AutonomousLoopService;

  beforeAll(async () => {
    console.log('🔧 Setting up test runtime for autonomy API tests...');

    const result = await createTestRuntime({
      character: {
        name: 'AutonomyAPITestAgent',
        bio: ['A test agent for autonomy API testing'],
        system: 'You are a test agent.',
        settings: {
          AUTONOMY_ENABLED: false,
        },
      },
      plugins: [autoPlugin],
    });

    runtime = result.runtime;
    harness = result.harness;

    // Get the service directly
    service = runtime.getService('autonomous-loop') as AutonomousLoopService;
    expect(service).toBeDefined();

    console.log('✅ Test runtime and service ready');
  });

  afterAll(async () => {
    console.log('🧹 Cleaning up...');
    if (service && service.isLoopRunning()) {
      await service.stopLoop();
    }
    await harness.cleanup();
  });

  describe('Direct Service Tests', () => {
    it('should start with autonomy disabled', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(false);
      console.log('✅ Initial status: disabled');
    });

    it('should enable autonomy via service', async () => {
      await service.startLoop();
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(service.isLoopRunning()).toBe(true);
      console.log('✅ Autonomy enabled via service');
    });

    it('should persist enabled state', () => {
      const setting = runtime.getSetting('AUTONOMY_ENABLED');
      expect(setting).toBe(true);
      console.log('✅ Enabled state persisted to settings');
    });

    it('should disable autonomy via service', async () => {
      await service.stopLoop();
      const status = service.getStatus();
      expect(status.enabled).toBe(false);
      expect(service.isLoopRunning()).toBe(false);
      console.log('✅ Autonomy disabled via service');
    });

    it('should persist disabled state', () => {
      const setting = runtime.getSetting('AUTONOMY_ENABLED');
      // null or false both mean disabled
      expect(setting === false || setting === null || setting === 'false').toBe(true);
      console.log('✅ Disabled state persisted to settings');
    });

    it('should handle interval changes', () => {
      const initialInterval = service.getLoopInterval();
      expect(initialInterval).toBe(30000); // Default

      service.setLoopInterval(10000);
      const newInterval = service.getLoopInterval();
      expect(newInterval).toBe(10000);
      console.log('✅ Interval updated from 30s to 10s');
    });
  });

  describe('API Endpoint Integration', () => {
    it('should have all required routes', () => {
      expect(autoPlugin.routes).toBeDefined();
      expect(autoPlugin.routes?.length).toBeGreaterThan(0);

      const routePaths = autoPlugin.routes?.map((r) => r.path) || [];
      expect(routePaths).toContain('/autonomy/status');
      expect(routePaths).toContain('/autonomy/enable');
      expect(routePaths).toContain('/autonomy/disable');
      expect(routePaths).toContain('/autonomy/toggle');
      expect(routePaths).toContain('/autonomy/interval');

      console.log('✅ All required routes present');
    });

    it('should simulate enable endpoint', async () => {
      // Find the enable route
      const enableRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/enable');
      expect(enableRoute).toBeDefined();

      // Create mock response
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {},
      };

      // Call the handler with non-null assertion
      await enableRoute!.handler({} as any, mockRes as any, runtime);

      // Verify actual service state
      expect(service.isLoopRunning()).toBe(true);

      console.log('✅ Enable endpoint works correctly');
    });

    it('should simulate disable endpoint', async () => {
      // Find the disable route
      const disableRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/disable');
      expect(disableRoute).toBeDefined();

      // Create mock response
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {},
      };

      // Call the handler with non-null assertion
      await disableRoute!.handler({} as any, mockRes as any, runtime);

      // Verify actual service state
      expect(service.isLoopRunning()).toBe(false);

      console.log('✅ Disable endpoint works correctly');
    });

    it('should simulate status endpoint', async () => {
      // Find the status route
      const statusRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/status');
      expect(statusRoute).toBeDefined();
      
      let capturedResponse: any = null;
      const mockRes = {
        json: (data: any) => {
          capturedResponse = data;
        },
      };
      
      // Call the handler with non-null assertion
      await statusRoute!.handler({} as any, mockRes as any, runtime);

      // Verify response
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.success).toBe(true);
      expect(capturedResponse.data.enabled).toBe(false);
      expect(capturedResponse.data.interval).toBe(10000); // Was changed in previous test

      console.log('✅ Status endpoint works correctly');
    });

    it('should simulate toggle endpoint', async () => {
      // Find the toggle route
      const toggleRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/toggle');
      expect(toggleRoute).toBeDefined();
      
      // Create mock response
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {},
      };
      
      // First toggle (should enable) with non-null assertion
      await toggleRoute!.handler({} as any, mockRes as any, runtime);
      expect(service.getStatus().enabled).toBe(true);

      // Second toggle (should disable) with non-null assertion
      await toggleRoute!.handler({} as any, mockRes as any, runtime);
      expect(service.getStatus().enabled).toBe(false);

      console.log('✅ Toggle endpoint works correctly');
    });

    it('should simulate interval endpoint', async () => {
      // Find the interval route
      const intervalRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/interval');
      expect(intervalRoute).toBeDefined();
      
      const mockReq = {
        body: { interval: 15000 },
      };
      
      // Create mock response
      const mockRes = {
        status: (code: number) => mockRes,
        json: (data: any) => {},
      };
      
      // Call the handler with non-null assertion
      await intervalRoute!.handler(mockReq as any, mockRes as any, runtime);

      // Verify the interval was updated
      expect(service.getLoopInterval()).toBe(15000);

      console.log('✅ Interval endpoint works correctly');
    });

    it('should handle invalid interval', async () => {
      // Find the interval route
      const intervalRoute = autoPlugin.routes?.find((r) => r.path === '/autonomy/interval');
      expect(intervalRoute).toBeDefined();
      
      let statusCode = 200;
      let capturedResponse: any = null;
      const mockRes = {
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          capturedResponse = data;
        },
      };
      
      const mockReq = {
        body: { interval: 500 }, // Too low
      };
      
      // Call the handler with non-null assertion
      await intervalRoute!.handler(mockReq as any, mockRes as any, runtime);

      // Verify error response
      expect(statusCode).toBe(400);
      expect(capturedResponse).toBeDefined();
      expect(capturedResponse.success).toBe(false);

      console.log('✅ Invalid interval handled correctly');
    });
  });

  describe('Full Workflow Test', () => {
    it('should complete full enable->configure->disable workflow', async () => {
      // Start with checking status
      expect(service.isLoopRunning()).toBe(false);

      // Enable autonomy
      await service.startLoop();
      expect(service.isLoopRunning()).toBe(true);
      expect(runtime.getSetting('AUTONOMY_ENABLED')).toBe(true);
      console.log('✅ Step 1: Enabled autonomy');

      // Update interval
      service.setLoopInterval(20000);
      expect(service.getLoopInterval()).toBe(20000);
      console.log('✅ Step 2: Updated interval to 20s');

      // Check status
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.interval).toBe(20000);
      console.log('✅ Step 3: Verified status');

      // Disable autonomy
      await service.stopLoop();
      expect(service.isLoopRunning()).toBe(false);
      // null or false both mean disabled
      const disabledSetting = runtime.getSetting('AUTONOMY_ENABLED');
      expect(
        disabledSetting === false || disabledSetting === null || disabledSetting === 'false'
      ).toBe(true);
      console.log('✅ Step 4: Disabled autonomy');

      // Verify interval is retained
      expect(service.getLoopInterval()).toBe(20000);
      console.log('✅ Step 5: Verified interval retained after disable');
    });
  });
});
