import { type TestSuite, type IAgentRuntime } from '@elizaos/core';

export const autonomyTests: TestSuite = {
  name: 'Autonomy Plugin Tests',

  tests: [
    {
      name: 'Autonomy service should initialize and be controllable',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing autonomy service initialization...');

        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          throw new Error('Autonomy service not found');
        }

        // Test initial state
        const initiallyRunning = (autonomyService as any).isLoopRunning?.() || false;
        console.log('✓ Service initialized, initially running:', initiallyRunning);

        // Test start
        await (autonomyService as any).startLoop?.();
        const runningAfterStart = (autonomyService as any).isLoopRunning?.() || false;
        if (!runningAfterStart) {
          throw new Error('Service should be running after start');
        }
        console.log('✓ Service started successfully');

        // Test stop
        await (autonomyService as any).stopLoop?.();
        const runningAfterStop = (autonomyService as any).isLoopRunning?.() || false;
        if (runningAfterStop) {
          throw new Error('Service should be stopped after stop');
        }
        console.log('✓ Service stopped successfully');

        // Test interval setting
        const originalInterval = (autonomyService as any).getLoopInterval?.() || 30000;
        (autonomyService as any).setLoopInterval?.(15000);
        const newInterval = (autonomyService as any).getLoopInterval?.() || 30000;
        if (newInterval !== 15000) {
          throw new Error('Interval should be updated to 15000ms');
        }
        console.log('✓ Interval updated successfully');

        // Reset interval
        (autonomyService as any).setLoopInterval?.(originalInterval);
        console.log('✓ Autonomy service test PASSED');
      },
    },

    {
      name: 'Admin chat provider should only work in autonomous context',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing admin chat provider context validation...');

        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          throw new Error('Autonomy service not found');
        }

        const autonomousRoomId = (autonomyService as any).getAutonomousRoomId?.();
        if (!autonomousRoomId) {
          throw new Error('Could not get autonomous room ID');
        }

        // Test provider in non-autonomous context (should return empty)
        const nonAutonomousMessage = {
          id: 'test-msg-1' as any,
          entityId: runtime.agentId,
          roomId: runtime.agentId, // Different room
          content: { text: 'test message' },
          createdAt: Date.now(),
        };

        const adminChatProvider = runtime.providers.find((p) => p.name === 'ADMIN_CHAT_HISTORY');
        if (!adminChatProvider) {
          throw new Error('Admin chat provider not found');
        }

        const testState = { values: {}, data: {}, text: '' };

        const nonAutonomousResult = await adminChatProvider.get(
          runtime,
          nonAutonomousMessage,
          testState
        );
        if (nonAutonomousResult.text && nonAutonomousResult.text.trim() !== '') {
          throw new Error('Provider should return empty for non-autonomous context');
        }
        console.log('✓ Provider correctly rejects non-autonomous context');

        // Test provider in autonomous context
        const autonomousMessage = {
          id: 'test-msg-2' as any,
          entityId: runtime.agentId,
          roomId: autonomousRoomId,
          content: { text: 'autonomous test message' },
          createdAt: Date.now(),
        };

        const autonomousResult = await adminChatProvider.get(runtime, autonomousMessage, testState);
        if (!autonomousResult.text || !autonomousResult.text.includes('ADMIN_CHAT_HISTORY')) {
          throw new Error('Provider should return admin chat history in autonomous context');
        }
        console.log('✓ Provider works correctly in autonomous context');
        console.log('✓ Admin chat provider test PASSED');
      },
    },

    {
      name: 'Send to admin action should validate context correctly',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing send to admin action validation...');

        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          throw new Error('Autonomy service not found');
        }

        const autonomousRoomId = (autonomyService as any).getAutonomousRoomId?.();
        if (!autonomousRoomId) {
          throw new Error('Could not get autonomous room ID');
        }

        const sendToAdminAction = runtime.actions.find((a) => a.name === 'SEND_TO_ADMIN');
        if (!sendToAdminAction) {
          throw new Error('Send to admin action not found');
        }

        // Test validation in non-autonomous context (should fail)
        const nonAutonomousMessage = {
          id: 'test-msg-3' as any,
          entityId: runtime.agentId,
          roomId: runtime.agentId, // Different room
          content: { text: 'I need to tell the admin something' },
          createdAt: Date.now(),
        };

        const shouldReject = await sendToAdminAction.validate(runtime, nonAutonomousMessage);
        if (shouldReject) {
          throw new Error('Action should reject validation for non-autonomous context');
        }
        console.log('✓ Action correctly rejects non-autonomous context');

        // Test validation in autonomous context (should pass if admin configured)
        const autonomousMessage = {
          id: 'test-msg-4' as any,
          entityId: runtime.agentId,
          roomId: autonomousRoomId,
          content: { text: 'I need to notify the admin about this update' },
          createdAt: Date.now(),
        };

        const shouldAccept = await sendToAdminAction.validate(runtime, autonomousMessage);
        // This will depend on whether ADMIN_USER_ID is set, so we'll just check it doesn't error
        console.log(
          '✓ Action validation in autonomous context:',
          shouldAccept ? 'accepted' : 'rejected (admin not configured)'
        );
        console.log('✓ Send to admin action validation test PASSED');
      },
    },

    {
      name: 'Autonomy status provider should work correctly in different contexts',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing autonomy status provider...');

        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          throw new Error('Autonomy service not found');
        }

        const autonomousRoomId = (autonomyService as any).getAutonomousRoomId?.();
        if (!autonomousRoomId) {
          throw new Error('Could not get autonomous room ID');
        }

        const statusProvider = runtime.providers.find((p) => p.name === 'AUTONOMY_STATUS');
        if (!statusProvider) {
          throw new Error('Autonomy status provider not found');
        }

        const testState = { values: {}, data: {}, text: '' };

        // Test in regular room (should show status)
        const regularMessage = {
          id: 'test-msg-5' as any,
          entityId: runtime.agentId,
          roomId: runtime.agentId, // Different room
          content: { text: 'test message' },
          createdAt: Date.now(),
        };

        const regularResult = await statusProvider.get(runtime, regularMessage, testState);
        if (!regularResult.text || !regularResult.text.includes('AUTONOMY_STATUS')) {
          throw new Error('Status provider should show status in regular rooms');
        }
        console.log('✓ Status provider shows status in regular rooms');

        // Test in autonomous room (should be empty)
        const autonomousMessage = {
          id: 'test-msg-6' as any,
          entityId: runtime.agentId,
          roomId: autonomousRoomId,
          content: { text: 'autonomous test message' },
          createdAt: Date.now(),
        };

        const autonomousResult = await statusProvider.get(runtime, autonomousMessage, testState);
        if (autonomousResult.text && autonomousResult.text.trim() !== '') {
          throw new Error('Status provider should NOT show in autonomous context');
        }
        console.log('✓ Status provider correctly hidden in autonomous context');
        console.log('✓ Autonomy status provider test PASSED');
      },
    },

    {
      name: 'Settings-based control should work',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing settings-based autonomy control...');

        const autonomyService = runtime.getService('autonomy');
        if (!autonomyService) {
          throw new Error('Autonomy service not found');
        }

        // Test enabling via settings
        await (autonomyService as any).enableAutonomy();
        const enabledStatus = (autonomyService as any).getStatus();
        if (!enabledStatus.enabled) {
          throw new Error('Autonomy should be enabled after enableAutonomy()');
        }
        console.log('✓ Enable autonomy via settings works');

        // Test disabling via settings
        await (autonomyService as any).disableAutonomy();
        const disabledStatus = (autonomyService as any).getStatus();
        if (disabledStatus.enabled) {
          throw new Error('Autonomy should be disabled after disableAutonomy()');
        }
        if (disabledStatus.running) {
          throw new Error('Service should stop running when disabled');
        }
        console.log('✓ Disable autonomy via settings works');

        // Test status reporting
        const currentStatus = (autonomyService as any).getStatus();
        if (
          typeof currentStatus.enabled !== 'boolean' ||
          typeof currentStatus.running !== 'boolean' ||
          typeof currentStatus.interval !== 'number'
        ) {
          throw new Error('Status should return proper types');
        }
        console.log('✓ Status reporting works correctly');
        console.log('✓ Settings-based control test PASSED');
      },
    },
  ],
};

export default autonomyTests;
