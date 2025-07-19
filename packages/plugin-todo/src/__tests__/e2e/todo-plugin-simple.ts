import { TestSuite, createMessageMemory, type UUID } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';

export const TodoPluginSimpleE2ETestSuite: TestSuite = {
  name: 'Todo Plugin Simple E2E Tests',
  tests: [
    {
      name: 'should verify core services are available',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing service availability...');

        // Check reminder service
        const reminderService = runtime.getService('TODO_REMINDER');
        if (!reminderService) {
          throw new Error('TodoReminderService not found or not started');
        }
        console.log('✓ TodoReminderService is available');

        // Check notification service
        const notificationService = runtime.getService('NOTIFICATION');
        if (!notificationService) {
          throw new Error('NotificationService not found or not started');
        }
        console.log('✓ NotificationService is available');

        console.log('✅ Core services are available and started');
      },
    },
    {
      name: 'should create a task successfully',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing task creation...');

        const { createTodoDataService } = await import('../../services/todoDataService');
        const dataService = createTodoDataService(runtime);

        // Create test data
        const testRoomId = `test-room-${Date.now()}` as UUID;
        const testEntityId = `test-entity-${Date.now()}` as UUID;
        const testWorldId = `test-world-${Date.now()}` as UUID;

        // Create a task
        const taskName = `Test Task ${Date.now()}`;
        const createdTaskId = await dataService.createTodo({
          agentId: runtime.agentId,
          worldId: testWorldId,
          roomId: testRoomId,
          entityId: testEntityId,
          name: taskName,
          description: 'Test task description',
          type: 'one-off',
          priority: 2,
          isUrgent: false,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          metadata: {},
          tags: ['test', 'one-off'],
        });

        if (!createdTaskId) {
          throw new Error('Failed to create task');
        }
        console.log(`✓ Task created with ID: ${createdTaskId}`);

        // Verify task was created
        const task = await dataService.getTodo(createdTaskId);
        if (!task) {
          throw new Error('Created task not found');
        }
        if (task.name !== taskName) {
          throw new Error(`Task name mismatch. Expected: ${taskName}, Got: ${task.name}`);
        }

        // Clean up
        await dataService.deleteTodo(createdTaskId);
        console.log('✅ Task creation successful');
      },
    },
    {
      name: 'should validate CREATE_TODO action',
      fn: async (runtime: IAgentRuntime) => {
        console.log('Testing CREATE_TODO action...');

        // Find the action
        const createAction = runtime.actions.find((a) => a.name === 'CREATE_TODO');
        if (!createAction) {
          throw new Error('CREATE_TODO action not found');
        }
        console.log('✓ CREATE_TODO action found');

        // Create test message
        const testRoomId = `test-room-${Date.now()}` as UUID;
        const testEntityId = `test-entity-${Date.now()}` as UUID;
        const testMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'Add a todo to finish my report by tomorrow',
            source: 'test',
          },
        });

        // Validate the action
        const isValid = await createAction.validate(runtime, testMessage);
        if (!isValid) {
          throw new Error('CREATE_TODO action validation failed');
        }
        console.log('✅ CREATE_TODO action validated successfully');
      },
    },
  ],
};
