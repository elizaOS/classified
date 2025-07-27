import type { Plugin, IAgentRuntime } from '@elizaos/core';

import { routes } from './apis';

// Import actions
import { cancelTodoAction } from './actions/cancelTodo';
import { completeTodoAction } from './actions/completeTodo';
import { confirmTodoAction } from './actions/confirmTodo';
import { createTodoAction } from './actions/createTodo';
import { updateTodoAction } from './actions/updateTodo';

// Import providers
import { todosProvider } from './providers/todos';

// Import services
import { TodoReminderService } from './services/reminderService';
import { TodoDataServiceWrapper } from './services/todoDataService';

// Import schema
import { todoSchemaExport } from './schema';

// Import table schemas for registration

// Import tests
import { TodoPluginE2ETestSuite } from './tests';
import { testSuites as e2eTestSuites } from './__tests__/e2e';

/**
 * The TodoPlugin provides task management functionality with daily recurring and one-off tasks,
 * including creating, completing, updating, and deleting tasks, as well as a point system for
 * task completion.
 */
export const TodoPlugin: Plugin = {
  name: 'todo',
  description: 'Provides task management functionality with daily recurring and one-off tasks.',
  providers: [todosProvider],
  dependencies: ['@elizaos/plugin-sql'],
  testDependencies: ['@elizaos/plugin-sql'],
  actions: [
    createTodoAction,
    completeTodoAction,
    confirmTodoAction,
    updateTodoAction,
    cancelTodoAction,
  ],
  services: [TodoDataServiceWrapper, TodoReminderService],
  routes,
  schema: todoSchemaExport,
  tests: [TodoPluginE2ETestSuite, ...e2eTestSuites],
  init: async (_config: Record<string, string>, _runtime: IAgentRuntime) => {
    // Plugin initialization - services are automatically started by the runtime
  },
};

export default TodoPlugin;

// Export discoverable services for external use
export { TodoReminderService } from './services/reminderService';

// Export internal managers for advanced usage
export { NotificationManager } from './services/notificationManager';

// Export data service utilities
export { createTodoDataService } from './services/todoDataService';
export type { TodoData } from './services/todoDataService';

// Export types
export type { NotificationData, NotificationPreferences } from './services/notificationManager';

// Export schema
export { todoSchemaExport as todoSchema } from './schema';
