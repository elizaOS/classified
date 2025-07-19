import type { UUID } from '@elizaos/core';

/**
 * Module augmentation to extend core ServiceTypeRegistry with TODO plugin service types
 */
declare module '@elizaos/core' {
  interface ServiceTypeRegistry {
    TODO_REMINDER: 'TODO_REMINDER';
    TODO_INTEGRATION_BRIDGE: 'TODO_INTEGRATION_BRIDGE';
  }
}

/**
 * Todo-specific types
 */
export interface TodoData {
  id: UUID;
  agentId: UUID;
  worldId: UUID;
  roomId: UUID;
  entityId: UUID;
  name: string;
  description?: string;
  type: 'one-off' | 'daily';
  priority: number; // 1-5, with 1 being highest priority
  isUrgent: boolean;
  isCompleted: boolean;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
  tags?: string[];
}

export interface CreateTodoInput {
  agentId: UUID;
  worldId: UUID;
  roomId: UUID;
  entityId: UUID;
  name: string;
  description?: string;
  type: 'one-off' | 'daily';
  priority?: number;
  isUrgent?: boolean;
  dueDate?: Date;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface UpdateTodoInput {
  name?: string;
  description?: string;
  type?: 'one-off' | 'daily';
  priority?: number;
  isUrgent?: boolean;
  isCompleted?: boolean;
  dueDate?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}
