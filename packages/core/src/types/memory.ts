import type { Content, UUID } from './primitives';

/**
 * Enumerates the built-in types of memories that can be stored and retrieved.
 * - `DOCUMENT`: Represents a whole document or a large piece of text.
 * - `FRAGMENT`: A chunk or segment of a `DOCUMENT`, often created for embedding and search.
 * - `MESSAGE`: A conversational message, typically from a user or the agent.
 * - `DESCRIPTION`: A descriptive piece of information, perhaps about an entity or concept.
 * - `CUSTOM`: For any other type of memory not covered by the built-in types.
 * This enum is used in `MemoryMetadata` to categorize memories and influences how they are processed or queried.
 */
export enum MemoryType {
  DOCUMENT = 'document',
  FRAGMENT = 'fragment',
  MESSAGE = 'message',
  DESCRIPTION = 'description',
  CUSTOM = 'custom',
  ACTION = 'action',
  ACTION_RESULT = 'action_result',
  KNOWLEDGE = 'knowledge',
  EXPERIENCE = 'experience',
  REFLECTION = 'reflection',
}
/**
 * Defines the scope of a memory, indicating its visibility and accessibility.
 * - `shared`: The memory is accessible to multiple entities or across different contexts (e.g., a public fact).
 * - `private`: The memory is specific to a single entity or a private context (e.g., a user's personal preference).
 * - `room`: The memory is scoped to a specific room or channel.
 * This is used in `MemoryMetadata` to control how memories are stored and retrieved based on context.
 */
export type MemoryScope = 'shared' | 'private' | 'room';

/**
 * Base interface for all memory metadata types.
 * It includes common properties for all memories, such as:
 * - `type`: The kind of memory (e.g., `MemoryType.MESSAGE`, `MemoryType.DOCUMENT`).
 * - `source`: An optional string indicating the origin of the memory (e.g., 'discord', 'user_input').
 * - `sourceId`: An optional UUID linking to a source entity or object.
 * - `scope`: The visibility scope of the memory (`shared`, `private`, or `room`).
 * - `timestamp`: An optional numerical timestamp (e.g., milliseconds since epoch) of when the memory was created or relevant.
 * - `tags`: Optional array of strings for categorizing or filtering memories.
 * Specific metadata types like `DocumentMetadata` or `MessageMetadata` extend this base.
 */
export interface BaseMetadata {
  type: MemoryType;
  source?: string;
  sourceId?: UUID;
  scope?: MemoryScope;
  timestamp?: number;
  tags?: string[];
}

export interface DocumentMetadata extends BaseMetadata {
  type: MemoryType.DOCUMENT;

  source?: string;
  sourceId?: UUID;
  scope?: 'shared' | 'private' | 'room';
  timestamp?: number;
  tags?: string[];

  // Document-specific properties
  title?: string;
  filename?: string;
  originalFilename?: string;
  contentType?: string;
  fileType?: string; // MIME type
  fileExt?: string;
  fileSize?: number;
  size?: number;
  fragmentCount?: number;
  path?: string;
  documentId?: UUID;
  position?: number;
}

export interface FragmentMetadata extends BaseMetadata {
  type: MemoryType.FRAGMENT;
  documentId: UUID;
  position: number;
}

export interface MessageMetadata extends BaseMetadata {
  type: MemoryType.MESSAGE;
}

export interface DescriptionMetadata extends BaseMetadata {
  type: MemoryType.DESCRIPTION;
}

export interface CustomMetadata extends BaseMetadata {
  type: MemoryType.CUSTOM;
  [key: string]: unknown;
}

export interface ActionMetadata extends BaseMetadata {
  type: MemoryType.ACTION;
  actionName: string;
  actionId: UUID;
  runId: UUID;
}

export interface ActionResultMetadata extends BaseMetadata {
  type: MemoryType.ACTION_RESULT;
  actionName: string;
  actionId: UUID;
  runId: UUID;
  error?: boolean;
  totalSteps?: number;
  currentStep?: number;
}

export interface KnowledgeMetadata extends BaseMetadata {
  type: MemoryType.KNOWLEDGE;
}

export interface ExperienceMetadata extends BaseMetadata {
  type: MemoryType.EXPERIENCE;
}

export interface ReflectionMetadata extends BaseMetadata {
  type: MemoryType.REFLECTION;
}

export type MemoryMetadata =
  | DocumentMetadata
  | FragmentMetadata
  | MessageMetadata
  | DescriptionMetadata
  | CustomMetadata
  | ActionMetadata
  | ActionResultMetadata
  | KnowledgeMetadata
  | ExperienceMetadata
  | ReflectionMetadata;

/**
 * Represents a stored memory/message
 */
export interface Memory {
  /** Optional unique identifier */
  id?: UUID;

  /** Associated user ID */
  entityId: UUID;

  /** Associated agent ID */
  agentId?: UUID;

  /** Optional creation timestamp in milliseconds since epoch */
  createdAt?: number;

  /** Memory content */
  content: Content;

  /** Optional embedding vector for semantic search */
  embedding?: number[];

  /** Associated room ID */
  roomId: UUID;

  /** Associated world ID (optional) */
  worldId?: UUID;

  /** Whether memory is unique (used to prevent duplicates) */
  unique?: boolean;

  /** Embedding similarity score (set when retrieved via search) */
  similarity?: number;

  /** Metadata for the memory */
  metadata?: MemoryMetadata;
}

/**
 * Specialized memory type for messages with enhanced type checking
 */
export interface MessageMemory extends Memory {
  metadata: MessageMetadata;
  content: Content & {
    text: string; // Message memories must have text content
  };
}

/**
 * Factory function to create a new message memory with proper defaults
 */
export function createMessageMemory(params: {
  id?: UUID;
  entityId: UUID;
  agentId?: UUID;
  roomId: UUID;
  content: Content & { text: string };
  embedding?: number[];
}): MessageMemory {
  return {
    ...params,
    createdAt: Date.now(),
    metadata: {
      type: MemoryType.MESSAGE,
      timestamp: Date.now(),
      scope: params.agentId ? 'private' : 'shared',
    },
  };
}

/**
 * Type guard to check if a memory metadata is a DocumentMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a DocumentMetadata
 */
export function isDocumentMetadata(metadata: MemoryMetadata): metadata is DocumentMetadata {
  return metadata.type === MemoryType.DOCUMENT;
}

/**
 * Type guard to check if a memory metadata is a FragmentMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a FragmentMetadata
 */
export function isFragmentMetadata(metadata: MemoryMetadata): metadata is FragmentMetadata {
  return metadata.type === MemoryType.FRAGMENT;
}

/**
 * Type guard to check if a memory metadata is a MessageMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a MessageMetadata
 */
export function isMessageMetadata(metadata: MemoryMetadata): metadata is MessageMetadata {
  return metadata.type === MemoryType.MESSAGE;
}

/**
 * Type guard to check if a memory metadata is a DescriptionMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a DescriptionMetadata
 */
export function isDescriptionMetadata(metadata: MemoryMetadata): metadata is DescriptionMetadata {
  return metadata.type === MemoryType.DESCRIPTION;
}

/**
 * Type guard to check if a memory metadata is a CustomMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a CustomMetadata
 */
export function isCustomMetadata(metadata: MemoryMetadata): metadata is CustomMetadata {
  return metadata.type === MemoryType.CUSTOM;
}

/**
 * Type guard to check if a memory metadata is an ActionMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is an ActionMetadata
 */
export function isActionMetadata(metadata: MemoryMetadata): metadata is ActionMetadata {
  return metadata.type === MemoryType.ACTION;
}

/**
 * Type guard to check if a memory metadata is an ActionResultMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is an ActionResultMetadata
 */
export function isActionResultMetadata(metadata: MemoryMetadata): metadata is ActionResultMetadata {
  return metadata.type === MemoryType.ACTION_RESULT;
}

/**
 * Type guard to check if a memory metadata is a KnowledgeMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a KnowledgeMetadata
 */
export function isKnowledgeMetadata(metadata: MemoryMetadata): metadata is KnowledgeMetadata {
  return metadata.type === MemoryType.KNOWLEDGE;
}

/**
 * Type guard to check if a memory metadata is an ExperienceMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is an ExperienceMetadata
 */
export function isExperienceMetadata(metadata: MemoryMetadata): metadata is ExperienceMetadata {
  return metadata.type === MemoryType.EXPERIENCE;
}

/**
 * Type guard to check if a memory metadata is a ReflectionMetadata
 * @param metadata The metadata to check
 * @returns True if the metadata is a ReflectionMetadata
 */
export function isReflectionMetadata(metadata: MemoryMetadata): metadata is ReflectionMetadata {
  return metadata.type === MemoryType.REFLECTION;
}

/**
 * Memory type guard for document memories
 */
export function isDocumentMemory(
  memory: Memory
): memory is Memory & { metadata: DocumentMetadata } {
  return memory.metadata?.type === MemoryType.DOCUMENT;
}

/**
 * Memory type guard for fragment memories
 */
export function isFragmentMemory(
  memory: Memory
): memory is Memory & { metadata: FragmentMetadata } {
  return memory.metadata?.type === MemoryType.FRAGMENT;
}

/**
 * Memory type guard for action memories
 */
export function isActionMemory(memory: Memory): memory is Memory & { metadata: ActionMetadata } {
  return memory.metadata?.type === MemoryType.ACTION;
}

/**
 * Memory type guard for action result memories
 */
export function isActionResultMemory(
  memory: Memory
): memory is Memory & { metadata: ActionResultMetadata } {
  return memory.metadata?.type === MemoryType.ACTION_RESULT;
}

/**
 * Memory type guard for knowledge memories
 */
export function isKnowledgeMemory(
  memory: Memory
): memory is Memory & { metadata: KnowledgeMetadata } {
  return memory.metadata?.type === MemoryType.KNOWLEDGE;
}

/**
 * Memory type guard for experience memories
 */
export function isExperienceMemory(
  memory: Memory
): memory is Memory & { metadata: ExperienceMetadata } {
  return memory.metadata?.type === MemoryType.EXPERIENCE;
}

/**
 * Memory type guard for reflection memories
 */
export function isReflectionMemory(
  memory: Memory
): memory is Memory & { metadata: ReflectionMetadata } {
  return memory.metadata?.type === MemoryType.REFLECTION;
}

/**
 * Safely access the text content of a memory
 * @param memory The memory to extract text from
 * @param defaultValue Optional default value if no text is found
 * @returns The text content or default value
 */
export function getMemoryText(memory: Memory, defaultValue = ''): string {
  return memory.content.text ?? defaultValue;
}
