import { elizaLogger } from '@elizaos/core';
import { E2BService } from '../src/services/E2BService.js';

// Debug the exact Task Manager JavaScript code to see output
async function debugTaskManager() {
  elizaLogger.info('🔍 Debugging Task Manager JavaScript');

  // Mock runtime
  const mockRuntime: any = {
    agentId: 'debug-agent-id',
    getSetting: (key: string) => {
      switch (key) {
        case 'E2B_API_KEY':
          return process.env.E2B_API_KEY || 'test-key';
        default:
          return process.env[key];
      }
    },
    getService: (name: string) => {
      if (name === 'e2b') {
        return new E2BService(mockRuntime);
      }
      return null;
    },
    logger: elizaLogger,
  };

  const e2bService = mockRuntime.getService('e2b');

  // The exact task manager code from the test
  const taskManagerCode = `// Simple Task Management System
class TaskManager {
    constructor() {
        this.tasks = [];
        this.nextId = 1;
    }
    
    addTask(title, priority = 'medium') {
        const task = {
            id: this.nextId++,
            title: title,
            priority: priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        this.tasks.push(task);
        console.log('✅ Added task: "' + title + '" with priority ' + priority);
        return task;
    }
    
    completeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            console.log('❌ Task with ID ' + taskId + ' not found');
            return null;
        }
        
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        console.log('✅ Completed task: "' + task.title + '"');
        return task;
    }
    
    listTasks() {
        console.log('\\n=== TASK MANAGEMENT SYSTEM ===');
        console.log('Total tasks: ' + this.tasks.length);
        
        const pending = this.tasks.filter(t => t.status === 'pending');
        const completed = this.tasks.filter(t => t.status === 'completed');
        
        console.log('Pending: ' + pending.length + ', Completed: ' + completed.length);
        console.log('\\nTask List:');
        
        this.tasks.forEach(task => {
            const status = task.status === 'completed' ? '✅' : '⏳';
            console.log('  ' + status + ' [' + task.id + '] ' + task.title + ' (Priority: ' + task.priority + ')');
        });
        
        return {
            total: this.tasks.length,
            pending: pending.length,
            completed: completed.length
        };
    }
    
    getTasksByPriority(priority) {
        return this.tasks.filter(task => task.priority === priority);
    }
}

// Demo usage
const taskManager = new TaskManager();

console.log('🚀 Starting Task Management System Demo');

// Add some tasks
taskManager.addTask('Complete project proposal', 'high');
taskManager.addTask('Review code changes', 'medium');
taskManager.addTask('Update documentation', 'low');
taskManager.addTask('Schedule team meeting', 'high');
taskManager.addTask('Fix bug in login system', 'high');

// Complete some tasks
taskManager.completeTask(1);
taskManager.completeTask(3);

// List all tasks
const summary = taskManager.listTasks();

// Get high priority tasks
const highPriorityTasks = taskManager.getTasksByPriority('high');
console.log('\\nHigh priority tasks: ' + highPriorityTasks.length);

// Validation tests
console.log('\\n🧪 VALIDATION TESTS');
let testsPassed = 0;
let totalTests = 3;

// Test 1: Task creation
if (taskManager.tasks.length === 5) {
    console.log('✅ Test 1: Task creation - PASSED');
    testsPassed++;
} else {
    console.log('❌ Test 1: Task creation - FAILED (Expected 5, got ' + taskManager.tasks.length + ')');
}

// Test 2: Task completion
if (summary.completed === 2) {
    console.log('✅ Test 2: Task completion - PASSED');
    testsPassed++;
} else {
    console.log('❌ Test 2: Task completion - FAILED (Expected 2, got ' + summary.completed + ')');
}

// Test 3: Priority filtering
if (highPriorityTasks.length === 3) {
    console.log('✅ Test 3: Priority filtering - PASSED');
    testsPassed++;
} else {
    console.log('❌ Test 3: Priority filtering - FAILED (Expected 3, got ' + highPriorityTasks.length + ')');
}

if (testsPassed === totalTests) {
    console.log('\\n🎉 All tests passed! Task manager is working correctly.');
} else {
    console.log('\\n⚠️ ' + (totalTests - testsPassed) + ' test(s) failed. Please review the implementation.');
}

console.log('\\n📋 Task Management System ready for use!');`;

  try {
    elizaLogger.info('🧪 Testing Task Manager JavaScript execution...');
    const result = await e2bService.executeCode(taskManagerCode, 'javascript');

    elizaLogger.info('📊 Execution Result:');
    elizaLogger.info('🔢 Text:', result.text);
    elizaLogger.info('📋 Full stdout output:');

    const fullOutput = result.logs.stdout.join('\n');
    elizaLogger.info(fullOutput);

    elizaLogger.info('\n🚨 Stderr output:');
    elizaLogger.info(result.logs.stderr);

    elizaLogger.info('\n❌ Error:', result.error);

    // Check for expected outputs
    const expectedOutputs = [
      'TASK MANAGEMENT SYSTEM',
      'Added task:',
      'Completed task:',
      'Total tasks: 5',
      'All tests passed! Task manager is working correctly',
    ];

    elizaLogger.info('\n🔍 Checking for expected outputs:');
    for (const expected of expectedOutputs) {
      const found = fullOutput.includes(expected);
      elizaLogger.info(`${found ? '✅' : '❌'} "${expected}": ${found ? 'FOUND' : 'NOT FOUND'}`);
    }
  } catch (error) {
    elizaLogger.error('❌ Task Manager execution failed:', error);
  }
}

// Run if executed directly
if (import.meta.main) {
  debugTaskManager()
    .then(() => {
      elizaLogger.info('🏁 Debug complete');
      process.exit(0);
    })
    .catch((error) => {
      elizaLogger.error('💥 Debug failed:', error);
      process.exit(1);
    });
}
