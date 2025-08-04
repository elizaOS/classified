/**
 * Goals Service
 * Handles goals and todos management
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { TauriGoal, TauriTodo } from '../types/shared';

export class GoalsService extends BaseTauriService {
  // Goals management
  public async fetchGoals(): Promise<TauriGoal[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_goals', {
        agentId: this.agentId,
      });

      if (Array.isArray(response)) {
        return response.map((goal: any) => ({
          id: goal.id || '',
          text: goal.name || goal.text || goal.description || '',
          completed: goal.completed || goal.isCompleted || false,
          createdAt: goal.createdAt || new Date().toISOString(),
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      return [];
    }
  }

  public async createGoal(
    name: string,
    description?: string,
    priority?: number
  ): Promise<TauriGoal | null> {
    try {
      const response = await this.ensureInitializedAndInvoke('create_goal', {
        agentId: this.agentId,
        goal: { name, description, priority },
      });

      if (response && typeof response === 'object') {
        const goal = response as any;
        return {
          id: goal.id || '',
          text: goal.name || goal.text || name,
          completed: goal.completed || false,
          createdAt: goal.createdAt || new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to create goal:', error);
      return null;
    }
  }

  // Todos management
  public async fetchTodos(): Promise<TauriTodo[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_agent_todos', {
        agentId: this.agentId,
      });

      if (Array.isArray(response)) {
        return response.map((todo: any) => ({
          id: todo.id || '',
          title: todo.name || todo.title || todo.text || '',
          description: todo.description || '',
          completed: todo.completed || todo.isCompleted || false,
          dueDate: todo.dueDate || undefined,
          priority: todo.priority || 'medium',
          createdAt: todo.createdAt || new Date().toISOString(),
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch todos:', error);
      return [];
    }
  }

  public async createTodo(
    title: string,
    description?: string,
    priority?: 'low' | 'medium' | 'high',
    dueDate?: string
  ): Promise<TauriTodo | null> {
    try {
      const response = await this.ensureInitializedAndInvoke('create_todo', {
        agentId: this.agentId,
        todo: { title, description, priority, dueDate },
      });

      if (response && typeof response === 'object') {
        const todo = response as any;
        return {
          id: todo.id || '',
          title: todo.name || todo.title || title,
          description: todo.description || description || '',
          completed: todo.completed || false,
          dueDate: todo.dueDate || dueDate,
          priority: todo.priority || priority || 'medium',
          createdAt: todo.createdAt || new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to create todo:', error);
      return null;
    }
  }
}

// Export singleton instance
export const goalsService = new GoalsService();
export default goalsService;
