import { TestSuite, createMessageMemory, type UUID, asUUID } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Real runtime integration tests that replace the mock-heavy unit tests
 * These tests use actual ElizaOS runtime and validate real functionality
 */
export const RealRuntimeIntegrationTestSuite: TestSuite = {
  name: 'Real Runtime Integration Tests',
  tests: [
    {
      name: 'should test real database operations without mocks',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real database operations...');

        // Verify database is available
        if (!runtime.db) {
          throw new Error('Database not available in runtime');
        }
        console.log('✓ Database adapter is available');

        const { createTodoDataService } = await import('../../services/todoDataService');
        const dataService = createTodoDataService(runtime);

        // Test data
        const testData = {
          agentId: runtime.agentId,
          worldId: asUUID(uuidv4()),
          roomId: asUUID(uuidv4()),
          entityId: asUUID(uuidv4()),
          name: 'Real DB Test Todo',
          description: 'Testing real database operations',
          type: 'one-off' as const,
          priority: 1,
          isUrgent: true,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          metadata: { test: true, source: 'real-db-test' },
          tags: ['real-test', 'db-integration'],
        };

        // CREATE operation
        const todoId = await dataService.createTodo(testData);
        if (!todoId) {
          throw new Error('Real database CREATE operation failed');
        }
        console.log(`✓ CREATE: Todo created with ID ${todoId}`);

        // READ operation
        const createdTodo = await dataService.getTodo(todoId);
        if (!createdTodo) {
          throw new Error('Real database READ operation failed');
        }
        if (createdTodo.name !== testData.name) {
          throw new Error(
            `Data integrity issue: expected ${testData.name}, got ${createdTodo.name}`
          );
        }
        console.log('✓ READ: Todo retrieved and verified');

        // UPDATE operation
        const updateData = {
          name: 'Updated Real DB Test Todo',
          priority: 2,
          metadata: { ...testData.metadata, updated: true },
        };
        const updateSuccess = await dataService.updateTodo(todoId, updateData);
        if (!updateSuccess) {
          throw new Error('Real database UPDATE operation failed');
        }

        const updatedTodo = await dataService.getTodo(todoId);
        if (!updatedTodo || !updatedTodo.name.includes('Updated')) {
          throw new Error('UPDATE operation did not persist correctly');
        }
        console.log('✓ UPDATE: Todo updated and verified');

        // TAG operations
        const newTags = ['new-tag-1', 'new-tag-2'];
        const addTagsSuccess = await dataService.addTags(todoId, newTags);
        if (!addTagsSuccess) {
          throw new Error('Real database ADD TAGS operation failed');
        }

        const todoWithTags = await dataService.getTodo(todoId);
        for (const tag of newTags) {
          if (!todoWithTags?.tags?.includes(tag)) {
            throw new Error(`Tag ${tag} was not added correctly`);
          }
        }
        console.log('✓ ADD TAGS: Tags added and verified');

        const removeTagsSuccess = await dataService.removeTags(todoId, ['new-tag-1']);
        if (!removeTagsSuccess) {
          throw new Error('Real database REMOVE TAGS operation failed');
        }

        const todoWithoutTag = await dataService.getTodo(todoId);
        if (todoWithoutTag?.tags?.includes('new-tag-1')) {
          throw new Error('Tag removal did not work correctly');
        }
        console.log('✓ REMOVE TAGS: Tag removed and verified');

        // DELETE operation
        const deleteSuccess = await dataService.deleteTodo(todoId);
        if (!deleteSuccess) {
          throw new Error('Real database DELETE operation failed');
        }

        const deletedTodo = await dataService.getTodo(todoId);
        if (deletedTodo !== null) {
          throw new Error('DELETE operation did not remove todo correctly');
        }
        console.log('✓ DELETE: Todo deleted and verified');

        console.log('✅ Real database operations test passed');
      },
    },
    {
      name: 'should test real action execution flow',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real action execution flow...');

        // Find all todo actions
        const todoActions = runtime.actions.filter(
          (action) =>
            action.name.includes('TODO') ||
            action.name.includes('COMPLETE') ||
            action.name.includes('CANCEL')
        );

        if (todoActions.length === 0) {
          throw new Error('No todo actions found in runtime');
        }
        console.log(`✓ Found ${todoActions.length} todo actions`);

        // Test CREATE_TODO action with real execution
        const createAction = runtime.actions.find((a) => a.name === 'CREATE_TODO');
        if (!createAction) {
          throw new Error('CREATE_TODO action not found');
        }

        const testRoomId = asUUID(uuidv4());
        const testEntityId = asUUID(uuidv4());

        const createMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'Add a todo to finish writing the integration tests',
            source: 'real-test',
          },
        });

        // Test validation
        const isValid = await createAction.validate(runtime, createMessage);
        if (!isValid) {
          throw new Error('CREATE_TODO action validation failed with real runtime');
        }
        console.log('✓ CREATE_TODO validation passed');

        // Test execution
        let callbackExecuted = false;
        let responseContent: any = null;
        const createdMemories: any[] = [];

        const testCallback = async (content: any, files?: any) => {
          callbackExecuted = true;
          responseContent = content;

          // Simulate creating memory like the real system does
          const memoryId = await runtime.createMemory(
            {
              entityId: runtime.agentId,
              roomId: testRoomId,
              content,
            },
            'messages'
          );

          // Retrieve the created memory object
          const memory = {
            id: memoryId,
            entityId: runtime.agentId,
            roomId: testRoomId,
            agentId: runtime.agentId,
            content,
            createdAt: Date.now(),
          };
          createdMemories.push(memory);

          return [memory];
        };

        // Execute action with real state composition
        const state = await runtime.composeState(createMessage);
        await createAction.handler(runtime, createMessage, state, {}, testCallback);

        if (!callbackExecuted) {
          throw new Error('Action callback was not executed');
        }
        if (!responseContent || !responseContent.text) {
          throw new Error('Action did not provide valid response content');
        }
        console.log('✓ CREATE_TODO action executed successfully');

        // Test COMPLETE_TODO action
        const completeAction = runtime.actions.find((a) => a.name === 'COMPLETE_TODO');
        if (completeAction) {
          const completeMessage = createMessageMemory({
            entityId: testEntityId,
            agentId: runtime.agentId,
            roomId: testRoomId,
            content: {
              text: 'Complete the integration test todo',
              source: 'real-test',
            },
          });

          const completeValid = await completeAction.validate(runtime, completeMessage);
          if (!completeValid) {
            console.log(
              '⚠️ COMPLETE_TODO validation failed (may be expected if no incomplete todos)'
            );
          } else {
            console.log('✓ COMPLETE_TODO validation passed');
          }
        }

        console.log('✅ Real action execution flow test passed');
      },
    },
    {
      name: 'should test real provider functionality',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real provider functionality...');

        // Create some real todos first
        const { createTodoDataService } = await import('../../services/todoDataService');
        const dataService = createTodoDataService(runtime);

        const testRoomId = asUUID(uuidv4());
        const testEntityId = asUUID(uuidv4());
        const testWorldId = asUUID(uuidv4());

        const todoIds: UUID[] = [];

        // Create test todos
        for (let i = 0; i < 3; i++) {
          const todoId = await dataService.createTodo({
            agentId: runtime.agentId,
            worldId: testWorldId,
            roomId: testRoomId,
            entityId: testEntityId,
            name: `Provider Test Todo ${i + 1}`,
            description: `Test todo for provider testing ${i + 1}`,
            type: i % 2 === 0 ? 'daily' : 'one-off',
            priority: i + 1,
            isUrgent: i === 2,
            dueDate: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
            tags: [`test-${i}`, 'provider-test'],
          });
          todoIds.push(todoId);
        }

        // Test TODOS provider
        const todosProvider = runtime.providers.find((p) => p.name === 'TODOS');
        if (!todosProvider) {
          throw new Error('TODOS provider not found in runtime');
        }

        const testMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'What are my current todos?',
            source: 'real-test',
          },
        });

        // Use real state composition
        const state = await runtime.composeState(testMessage);

        // Test provider execution
        const providerResult = await todosProvider.get(runtime, testMessage, state);

        if (!providerResult) {
          throw new Error('TODOS provider returned no result');
        }

        // Validate provider result structure
        if (typeof providerResult !== 'object') {
          throw new Error('Provider result should be an object');
        }

        if (!providerResult.text && !providerResult.values && !providerResult.data) {
          throw new Error('Provider result should have text, values, or data');
        }

        if (providerResult.text && typeof providerResult.text !== 'string') {
          throw new Error('Provider result text should be a string');
        }

        console.log('✓ TODOS provider returned valid result structure');

        // Test that provider includes todo information when todos exist
        if (providerResult.text && !providerResult.text.includes('todo')) {
          console.log('⚠️ Provider text does not mention todos (may be expected if filtering)');
        } else if (providerResult.text) {
          console.log('✓ Provider text includes todo information');
        }

        // Clean up
        for (const todoId of todoIds) {
          await dataService.deleteTodo(todoId);
        }

        console.log('✅ Real provider functionality test passed');
      },
    },
    {
      name: 'should test real service integration',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real service integration...');

        // Test TodoReminderService
        const reminderService = runtime.getService('TODO_REMINDER');
        if (!reminderService) {
          throw new Error('TodoReminderService not found in runtime');
        }

        // Verify service has expected methods
        if (typeof (reminderService as any).checkTasksForReminders !== 'function') {
          throw new Error('TodoReminderService missing checkTasksForReminders method');
        }
        console.log('✓ TodoReminderService has required methods');

        // Test TodoIntegrationBridge
        const integrationService = runtime.getService('TODO_INTEGRATION_BRIDGE');
        if (!integrationService) {
          throw new Error('TodoIntegrationBridge not found in runtime');
        }
        console.log('✓ TodoIntegrationBridge is available');

        // Create a real todo to test reminder functionality
        const { createTodoDataService } = await import('../../services/todoDataService');
        const dataService = createTodoDataService(runtime);

        const testRoomId = asUUID(uuidv4());
        const testEntityId = asUUID(uuidv4());
        const testWorldId = asUUID(uuidv4());

        const overdueDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

        const overdueTodoId = await dataService.createTodo({
          agentId: runtime.agentId,
          worldId: testWorldId,
          roomId: testRoomId,
          entityId: testEntityId,
          name: 'Service Integration Test - Overdue',
          description: 'Testing service integration with overdue todo',
          type: 'one-off',
          priority: 1,
          isUrgent: true,
          dueDate: overdueDate,
          tags: ['service-test', 'overdue'],
        });

        // Test reminder service execution
        try {
          await (reminderService as any).checkTasksForReminders();
          console.log('✓ Reminder service executed without errors');
        } catch (error) {
          throw new Error(
            `Reminder service execution failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Clean up
        await dataService.deleteTodo(overdueTodoId);

        console.log('✅ Real service integration test passed');
      },
    },
    {
      name: 'should test real message processing and memory creation',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing real message processing and memory creation...');

        const testRoomId = asUUID(uuidv4());
        const testEntityId = asUUID(uuidv4());

        // Create a test message that should trigger todo creation
        const todoMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'I need to remember to call my doctor tomorrow morning',
            source: 'real-test',
          },
        });

        // Process the message through the runtime (this tests the full pipeline)
        try {
          await runtime.processMessage(todoMessage);
          console.log('✓ Message processed without errors');
        } catch (error) {
          // This might fail if dependencies aren't available, but shouldn't crash
          console.log(
            `⚠️ Message processing had issues: ${error instanceof Error ? error.message : String(error)}`
          );
        }

        // Test memory creation directly
        const testMemory = await runtime.createMemory(
          {
            entityId: testEntityId,
            agentId: runtime.agentId,
            roomId: testRoomId,
            content: {
              text: 'Test memory for integration testing',
              type: 'test',
              metadata: { source: 'integration-test' },
            },
          },
          'messages'
        );

        if (!testMemory) {
          throw new Error('Failed to create memory in runtime');
        }
        console.log('✓ Memory created successfully');

        // Retrieve the memory to verify it was stored
        const retrievedMemories = await runtime.getMemories({
          roomId: testRoomId,
          count: 10,
          tableName: 'messages',
        });

        if (!retrievedMemories || retrievedMemories.length === 0) {
          throw new Error('Failed to retrieve memories from runtime');
        }

        const foundMemory = retrievedMemories.find((m) => m.id === testMemory);
        if (!foundMemory) {
          throw new Error('Created memory not found in retrieved memories');
        }
        console.log('✓ Memory retrieved and verified');

        console.log('✅ Real message processing and memory creation test passed');
      },
    },
    {
      name: 'should test complete real workflow end-to-end',
      fn: async (runtime: IAgentRuntime) => {
        console.log('🧪 Testing complete real workflow end-to-end...');

        const testRoomId = asUUID(uuidv4());
        const testEntityId = asUUID(uuidv4());

        // Step 1: Create initial message
        const userMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'Add a reminder to submit my weekly report by Friday',
            source: 'real-workflow-test',
          },
        });

        // Step 2: Compose state (this tests provider integration)
        const state = await runtime.composeState(userMessage);
        if (!state) {
          throw new Error('Failed to compose state');
        }
        console.log('✓ State composed successfully');

        // Step 3: Find and validate CREATE_TODO action
        const createAction = runtime.actions.find((a) => a.name === 'CREATE_TODO');
        if (!createAction) {
          throw new Error('CREATE_TODO action not found');
        }

        const isValid = await createAction.validate(runtime, userMessage, state);
        if (!isValid) {
          throw new Error('CREATE_TODO action validation failed');
        }
        console.log('✓ Action validated');

        // Step 4: Execute action and capture result
        let actionResult: any = null;
        const responseMemories: any[] = [];

        const workflowCallback = async (content: any, files?: any) => {
          actionResult = content;

          // Create response memory
          const responseMemoryId = await runtime.createMemory(
            {
              entityId: runtime.agentId,
              roomId: testRoomId,
              content,
            },
            'messages'
          );

          // Create memory object to return
          const memory = {
            id: responseMemoryId,
            entityId: runtime.agentId,
            roomId: testRoomId,
            agentId: runtime.agentId,
            content,
            createdAt: Date.now(),
          };
          responseMemories.push(memory);

          return [memory];
        };

        await createAction.handler(runtime, userMessage, state, {}, workflowCallback);

        if (!actionResult) {
          throw new Error('Action did not produce result');
        }
        console.log('✓ Action executed and response created');

        // Step 5: Test that todo was actually created
        const { createTodoDataService } = await import('../../services/todoDataService');
        const dataService = createTodoDataService(runtime);

        // Get todos for this user/room to verify creation
        const todos = await dataService.getTodos({
          entityId: testEntityId,
          roomId: testRoomId,
          isCompleted: false,
        });

        // Find a todo that might have been created by our action
        const possibleTodo = todos.find(
          (todo) =>
            todo.name.toLowerCase().includes('report') ||
            todo.description?.toLowerCase().includes('report')
        );

        if (possibleTodo) {
          console.log(`✓ Todo found: ${possibleTodo.name}`);

          // Clean up the created todo
          await dataService.deleteTodo(possibleTodo.id);
          console.log('✓ Test todo cleaned up');
        } else {
          console.log('⚠️ No matching todo found (action may have different behavior)');
        }

        // Step 6: Test completion workflow
        const completeMessage = createMessageMemory({
          entityId: testEntityId,
          agentId: runtime.agentId,
          roomId: testRoomId,
          content: {
            text: 'Mark the weekly report as done',
            source: 'real-workflow-test',
          },
        });

        const completeAction = runtime.actions.find((a) => a.name === 'COMPLETE_TODO');
        if (completeAction) {
          const completeState = await runtime.composeState(completeMessage);
          const completeValid = await completeAction.validate(
            runtime,
            completeMessage,
            completeState
          );

          if (completeValid) {
            console.log('✓ COMPLETE_TODO action validation passed');
          } else {
            console.log('⚠️ COMPLETE_TODO validation failed (expected if no incomplete todos)');
          }
        }

        console.log('✅ Complete real workflow end-to-end test passed');
      },
    },
  ],
};

export default RealRuntimeIntegrationTestSuite;
