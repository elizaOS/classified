/**
 * Service Index
 * Exports all domain-specific services for easy importing
 * Replaces the monolithic TauriService with focused, maintainable services
 */

// Core base service
export { BaseTauriService } from './BaseTauriService';

// Domain-specific services
export { AgentService, agentService } from './AgentService';
export { ApplicationService, applicationService } from './ApplicationService';
export { BackupService, backupService } from './BackupService';
export { ChatService, chatService, type TauriMessage } from './ChatService';
export { ConfigService, configService } from './ConfigService';
export {
  ContainerService,
  containerService,
  type ContainerLog,
  type ContainerStatus,
  type StartupStatus,
} from './ContainerService';
export { DatabaseService, databaseService } from './DatabaseService';
export { GoalsService, goalsService, type TauriGoal, type TauriTodo } from './GoalsService';
export { KnowledgeService, knowledgeService, type TauriKnowledgeFile } from './KnowledgeService';

// Legacy TauriService compatibility - temporarily keep for backward compatibility
export { TauriService } from './TauriService';
import TauriServiceDefault from './TauriService';
export default TauriServiceDefault;

import { agentService } from './AgentService';
import { applicationService } from './ApplicationService';
import { backupService } from './BackupService';
import { chatService } from './ChatService';
import { configService } from './ConfigService';
import { containerService } from './ContainerService';
import { databaseService } from './DatabaseService';
import { goalsService } from './GoalsService';
import { knowledgeService } from './KnowledgeService';

// Service aggregator for easy access to all services
export const Services = {
  chat: chatService,
  goals: goalsService,
  knowledge: knowledgeService,
  config: configService,
  container: containerService,
  agent: agentService,
  backup: backupService,
  database: databaseService,
  app: applicationService,
} as const;

// Type definitions
export type ServiceCollection = typeof Services;
