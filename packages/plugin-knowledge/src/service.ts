import {
  Content,
  createLogger,
  createUniqueUuid,
  FragmentMetadata,
  IAgentRuntime,
  KnowledgeItem,
  Memory,
  MemoryMetadata,
  MemoryType,
  Metadata,
  ModelType,
  Semaphore,
  Service,
  splitChunks,
  UUID,
  stringToUuid,
} from '@elizaos/core';
import { loadDocsFromPath } from './docs-loader.ts';
import {
  createDocumentMemory,
  extractTextFromDocument,
  processFragmentsSynchronously,
} from './document-processor.ts';
import { DocumentRepository, FragmentRepository } from './repositories/index.ts';
import type {
  KnowledgeConfig,
  LoadResult,
  AddKnowledgeOptions,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  BatchKnowledgeOperation,
  BatchOperationResult,
  KnowledgeAnalytics,
  KnowledgeExportOptions,
  KnowledgeImportOptions,
  GitHubIngestionOptions,
  GitHubIngestionResult,
  WebPageIngestionOptions,
  WebPageIngestionResult,
} from './types.ts';
import { isBinaryContentType, looksLikeBase64 } from './utils.ts';
import { ingestGitHubRepository, ingestWebPage } from './ingestion-utils.ts';

const logger = createLogger({ agentName: 'KnowledgeService' });

/**
 * Knowledge Service - Provides retrieval augmented generation capabilities
 */
export class KnowledgeService extends Service {
  static readonly serviceType = 'knowledge';
  public config: Metadata;
  private knowledgeConfig: KnowledgeConfig;
  capabilityDescription =
    'Provides Retrieval Augmented Generation capabilities, including knowledge upload and querying.';

  private knowledgeProcessingSemaphore: Semaphore;
  private documentRepo?: DocumentRepository;
  private fragmentRepo?: FragmentRepository;
  private useNewTables: boolean = false; // Feature flag for new implementation

  /**
   * Create a new Knowledge service
   * @param runtime Agent runtime
   */
  constructor(runtime?: IAgentRuntime, config?: Partial<KnowledgeConfig>) {
    super(runtime);

    this.knowledgeProcessingSemaphore = new Semaphore(10);

    const parseBooleanEnv = (value: any): boolean => {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
      return false; // Default to false if undefined or other type
    };

    this.knowledgeConfig = {
      CTX_KNOWLEDGE_ENABLED: parseBooleanEnv(config?.CTX_KNOWLEDGE_ENABLED),
      LOAD_DOCS_ON_STARTUP: parseBooleanEnv(config?.LOAD_DOCS_ON_STARTUP),
      MAX_INPUT_TOKENS: config?.MAX_INPUT_TOKENS,
      MAX_OUTPUT_TOKENS: config?.MAX_OUTPUT_TOKENS,
      EMBEDDING_PROVIDER: config?.EMBEDDING_PROVIDER,
      TEXT_PROVIDER: config?.TEXT_PROVIDER,
      TEXT_EMBEDDING_MODEL: config?.TEXT_EMBEDDING_MODEL,
    };

    // Store config as Metadata for base class compatibility
    this.config = { ...this.knowledgeConfig } as Metadata;

    // Check if we should use new tables (feature flag)
    this.useNewTables = parseBooleanEnv(this.runtime?.getSetting('KNOWLEDGE_USE_NEW_TABLES'));

    if (this.runtime) {
      logger.info(
        `KnowledgeService initialized for agent ${this.runtime.agentId} with config:`,
        this.knowledgeConfig,
        `useNewTables: ${this.useNewTables}`
      );

      if (this.knowledgeConfig.LOAD_DOCS_ON_STARTUP) {
        this.loadInitialDocuments().catch((error) => {
          logger.error('Error during initial document loading in KnowledgeService:', error);
        });
      }
    }
  }

  private async loadInitialDocuments(): Promise<void> {
    logger.info(
      `KnowledgeService: Checking for documents to load on startup for agent ${this.runtime.agentId}`
    );
    try {
      // Use a small delay to ensure runtime is fully ready if needed, though constructor implies it should be.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const result: LoadResult = await loadDocsFromPath(this as any, this.runtime.agentId);
      if (result.successful > 0) {
        logger.info(
          `KnowledgeService: Loaded ${result.successful} documents from docs folder on startup for agent ${this.runtime.agentId}`
        );
      } else {
        logger.info(
          `KnowledgeService: No new documents found to load on startup for agent ${this.runtime.agentId}`
        );
      }
    } catch (error) {
      logger.error(
        `KnowledgeService: Error loading documents on startup for agent ${this.runtime.agentId}:`,
        error
      );
    }
  }

  /**
   * Start the Knowledge service
   * @param runtime Agent runtime
   * @returns Initialized Knowledge service
   */
  static async start(runtime: IAgentRuntime): Promise<KnowledgeService> {
    logger.info(`Starting Knowledge service for agent: ${runtime.agentId}`);
    const service = new KnowledgeService(runtime);

    // Process character knowledge AFTER service is initialized
    if (service.runtime.character?.knowledge && service.runtime.character.knowledge.length > 0) {
      logger.info(
        `KnowledgeService: Processing ${service.runtime.character.knowledge.length} character knowledge items.`
      );
      const stringKnowledge = service.runtime.character.knowledge.filter(
        (item): item is string => typeof item === 'string'
      );
      // Run in background, don't await here to prevent blocking startup
      await service.processCharacterKnowledge(stringKnowledge).catch((err) => {
        logger.error(
          `KnowledgeService: Error processing character knowledge during startup: ${err.message}`,
          err
        );
      });
    } else {
      logger.info(
        `KnowledgeService: No character knowledge to process for agent ${runtime.agentId}.`
      );
    }
    return service;
  }

  /**
   * Stop the Knowledge service
   * @param runtime Agent runtime
   */
  static async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info(`Stopping Knowledge service for agent: ${runtime.agentId}`);
    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    if (!service) {
      logger.warn(`KnowledgeService not found for agent ${runtime.agentId} during stop.`);
    }
    // If we need to perform specific cleanup on the KnowledgeService instance
    if (service instanceof KnowledgeService) {
      await service.stop();
    }
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    logger.info(`Knowledge service stopping for agent: ${this.runtime.agentId}`);
  }

  /**
   * Add knowledge to the system
   * @param options Knowledge options
   * @returns Promise with document processing result
   */
  async addKnowledge(options: AddKnowledgeOptions): Promise<{
    clientDocumentId: string;
    storedDocumentMemoryId: UUID;
    fragmentCount: number;
  }> {
    // Use agentId from options if provided (from frontend), otherwise fall back to runtime
    const agentId = options.agentId || (this.runtime.agentId as UUID);
    logger.info(
      `KnowledgeService processing document for agent: ${agentId}, file: ${options.originalFilename}, type: ${options.contentType}`
    );

    // Check if document already exists in database using clientDocumentId as the primary key for "documents" table
    try {
      // The `getMemoryById` in runtime usually searches generic memories.
      // We need a way to specifically query the 'documents' table or ensure clientDocumentId is unique across all memories if used as ID.
      // For now, assuming clientDocumentId is the ID used when creating document memory.
      const existingDocument = await this.runtime.getMemoryById(options.clientDocumentId);
      if (existingDocument && existingDocument.metadata?.type === MemoryType.DOCUMENT) {
        logger.info(
          `Document ${options.originalFilename} with ID ${options.clientDocumentId} already exists. Skipping processing.`
        );

        // Count existing fragments for this document
        const fragments = await this.runtime.getMemories({
          tableName: 'knowledge',
          // Assuming fragments store original documentId in metadata.documentId
          // This query might need adjustment based on actual fragment metadata structure.
          // A more robust way would be to query where metadata.documentId === options.clientDocumentId
        });

        // Filter fragments related to this specific document
        const relatedFragments = fragments.filter(
          (f) =>
            f.metadata?.type === MemoryType.FRAGMENT &&
            (f.metadata as FragmentMetadata).documentId === options.clientDocumentId
        );

        return {
          clientDocumentId: options.clientDocumentId,
          storedDocumentMemoryId: existingDocument.id as UUID,
          fragmentCount: relatedFragments.length,
        };
      }
    } catch (error) {
      // Document doesn't exist or other error, continue with processing
      logger.debug(
        `Document ${options.clientDocumentId} not found or error checking existence, proceeding with processing: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return this.processDocument(options);
  }

  /**
   * Process a document regardless of type - Called by public addKnowledge
   * @param options Document options
   * @returns Promise with document processing result
   */
  private async processDocument({
    agentId: passedAgentId,
    clientDocumentId,
    contentType,
    originalFilename,
    worldId,
    content,
    roomId,
    entityId,
    metadata,
  }: AddKnowledgeOptions): Promise<{
    clientDocumentId: string;
    storedDocumentMemoryId: UUID;
    fragmentCount: number;
  }> {
    // Use agentId from options if provided (from frontend), otherwise fall back to runtime
    const agentId = passedAgentId || (this.runtime.agentId as UUID);

    try {
      logger.debug(
        `KnowledgeService: Processing document ${originalFilename} (type: ${contentType}) via processDocument for agent: ${agentId}`
      );

      let fileBuffer: Buffer | null = null;
      let extractedText: string;
      let documentContentToStore: string;
      const isPdfFile =
        contentType === 'application/pdf' || originalFilename.toLowerCase().endsWith('.pdf');

      if (isPdfFile) {
        // For PDFs: extract text for fragments but store original base64 in main document
        try {
          fileBuffer = Buffer.from(content, 'base64');
        } catch (e: any) {
          logger.error(
            `KnowledgeService: Failed to convert base64 to buffer for ${originalFilename}: ${e.message}`
          );
          throw new Error(`Invalid base64 content for PDF file ${originalFilename}`);
        }
        extractedText = await extractTextFromDocument(fileBuffer, contentType, originalFilename);
        documentContentToStore = content; // Store base64 for PDFs
      } else if (isBinaryContentType(contentType, originalFilename)) {
        // For other binary files: extract text and store as plain text
        try {
          fileBuffer = Buffer.from(content, 'base64');
        } catch (e: any) {
          logger.error(
            `KnowledgeService: Failed to convert base64 to buffer for ${originalFilename}: ${e.message}`
          );
          throw new Error(`Invalid base64 content for binary file ${originalFilename}`);
        }
        extractedText = await extractTextFromDocument(fileBuffer, contentType, originalFilename);
        documentContentToStore = extractedText; // Store extracted text for non-PDF binary files
      } else {
        // For text files (including markdown): content is already plain text or needs decoding from base64
        // Routes always send base64, but docs-loader sends plain text

        // First, check if this looks like base64
        if (looksLikeBase64(content)) {
          try {
            // Try to decode from base64
            const decodedBuffer = Buffer.from(content, 'base64');
            // Check if it's valid UTF-8
            const decodedText = decodedBuffer.toString('utf8');

            // Verify the decoded text doesn't contain too many invalid characters
            const invalidCharCount = (decodedText.match(/\ufffd/g) || []).length;
            const textLength = decodedText.length;

            if (invalidCharCount > 0 && invalidCharCount / textLength > 0.1) {
              // More than 10% invalid characters, probably not a text file
              throw new Error('Decoded content contains too many invalid characters');
            }

            logger.debug(`Successfully decoded base64 content for text file: ${originalFilename}`);
            extractedText = decodedText;
            documentContentToStore = decodedText;
          } catch (e) {
            logger.error(
              `Failed to decode base64 for ${originalFilename}: ${e instanceof Error ? e.message : String(e)}`
            );
            // If it looked like base64 but failed to decode properly, this is an error
            throw new Error(
              `File ${originalFilename} appears to be corrupted or incorrectly encoded`
            );
          }
        } else {
          // Content doesn't look like base64, treat as plain text
          logger.debug(`Treating content as plain text for file: ${originalFilename}`);
          extractedText = content;
          documentContentToStore = content;
        }
      }

      if (!extractedText || extractedText.trim() === '') {
        const noTextError = new Error(
          `KnowledgeService: No text content extracted from ${originalFilename} (type: ${contentType}).`
        );
        logger.warn(noTextError.message);
        throw noTextError;
      }

      // Create document memory using the clientDocumentId as the memory ID
      const documentMemory = createDocumentMemory({
        text: documentContentToStore, // Store base64 only for PDFs, plain text for everything else
        agentId,
        clientDocumentId, // This becomes the memory.id
        originalFilename,
        contentType,
        worldId,
        fileSize: fileBuffer ? fileBuffer.length : extractedText.length,
        documentId: clientDocumentId, // Explicitly set documentId in metadata as well
        customMetadata: metadata, // Pass the custom metadata
      });

      const memoryWithScope = {
        ...documentMemory,
        id: clientDocumentId, // Ensure the ID of the memory is the clientDocumentId
        agentId,
        roomId: roomId || agentId,
        entityId: entityId || agentId,
      };

      logger.debug(
        `KnowledgeService: Creating memory with agentId=${agentId}, entityId=${entityId}, roomId=${roomId}, this.runtime.agentId=${this.runtime.agentId}`
      );
      logger.debug(
        `KnowledgeService: memoryWithScope agentId=${memoryWithScope.agentId}, entityId=${memoryWithScope.entityId}`
      );

      await this.runtime.createMemory(memoryWithScope, 'documents');

      logger.debug(
        `KnowledgeService: Stored document ${originalFilename} (Memory ID: ${memoryWithScope.id})`
      );

      const fragmentCount = await processFragmentsSynchronously({
        runtime: this.runtime,
        documentId: clientDocumentId, // Pass clientDocumentId to link fragments
        fullDocumentText: extractedText,
        agentId,
        contentType,
        roomId: roomId || agentId,
        entityId: entityId || agentId,
        worldId: worldId || agentId,
      });

      logger.info(
        `KnowledgeService: Document ${originalFilename} processed with ${fragmentCount} fragments for agent ${agentId}`
      );

      return {
        clientDocumentId,
        storedDocumentMemoryId: memoryWithScope.id as UUID,
        fragmentCount,
      };
    } catch (error: any) {
      logger.error(
        `KnowledgeService: Error processing document ${originalFilename}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // --- Knowledge methods moved from AgentRuntime ---

  private async handleProcessingError(error: any, context: string) {
    logger.error(`KnowledgeService: Error ${context}:`, error?.message || error || 'Unknown error');
    throw error;
  }

  async checkExistingKnowledge(knowledgeId: UUID): Promise<boolean> {
    // This checks if a specific memory (fragment or document) ID exists.
    // In the context of processCharacterKnowledge, knowledgeId is a UUID derived from the content.
    const existingDocument = await this.runtime.getMemoryById(knowledgeId);
    return !!existingDocument;
  }

  async getKnowledge(
    message: Memory,
    scope?: { roomId?: UUID; worldId?: UUID; entityId?: UUID }
  ): Promise<KnowledgeItem[]> {
    logger.debug(`KnowledgeService: getKnowledge called for message id: ${message.id}`);
    if (!message?.content?.text || message?.content?.text.trim().length === 0) {
      logger.warn('KnowledgeService: Invalid or empty message content for knowledge query.');
      return [];
    }

    const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
      text: message.content.text,
    });

    const filterScope: { roomId?: UUID; worldId?: UUID; entityId?: UUID } = {};
    if (scope?.roomId) {
      filterScope.roomId = scope.roomId;
    }
    if (scope?.worldId) {
      filterScope.worldId = scope.worldId;
    }
    if (scope?.entityId) {
      filterScope.entityId = scope.entityId;
    }

    // Use configurable search parameters
    const matchThreshold = this.knowledgeConfig.SEARCH_MATCH_THRESHOLD
      ? Number(this.knowledgeConfig.SEARCH_MATCH_THRESHOLD)
      : 0.1;
    const resultCount = this.knowledgeConfig.SEARCH_RESULT_COUNT
      ? Number(this.knowledgeConfig.SEARCH_RESULT_COUNT)
      : 20;

    const fragments = await this.runtime.searchMemories({
      tableName: 'knowledge',
      embedding,
      query: message.content.text,
      ...filterScope,
      count: resultCount,
      match_threshold: matchThreshold,
    });

    return fragments
      .filter((fragment) => fragment.id !== undefined) // Ensure fragment.id is defined
      .map((fragment) => ({
        id: fragment.id as UUID, // Cast as UUID after filtering
        content: fragment.content as Content, // Cast if necessary, ensure Content type matches
        similarity: fragment.similarity,
        metadata: fragment.metadata,
        worldId: fragment.worldId,
      }));
  }

  async processCharacterKnowledge(items: string[]): Promise<void> {
    // Wait briefly to allow services to initialize fully
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.info(
      `KnowledgeService: Processing ${items.length} character knowledge items for agent ${this.runtime.agentId}`
    );

    const processingPromises = items.map(async (item) => {
      await this.knowledgeProcessingSemaphore.acquire();
      try {
        // For character knowledge, the item itself (string) is the source.
        // A unique ID is generated from this string content.
        const knowledgeId = createUniqueUuid(this.runtime, this.runtime.agentId + item); // Use agentId in seed for uniqueness

        if (await this.checkExistingKnowledge(knowledgeId)) {
          logger.debug(
            `KnowledgeService: Character knowledge item with ID ${knowledgeId} already exists. Skipping.`
          );
          return;
        }

        logger.debug(
          `KnowledgeService: Processing character knowledge for ${this.runtime.character?.name} - ${item.slice(0, 100)}`
        );

        let metadata: MemoryMetadata = {
          type: MemoryType.DOCUMENT, // Character knowledge often represents a doc/fact.
          timestamp: Date.now(),
          source: 'character', // Indicate the source
        };

        const pathMatch = item.match(/^Path: (.+?)(?:\n|\r\n)/);
        if (pathMatch) {
          const filePath = pathMatch[1].trim();
          const extension = filePath.split('.').pop() || '';
          const filename = filePath.split('/').pop() || '';
          const title = filename.replace(`.${extension}`, '');
          metadata = {
            ...metadata,
            path: filePath,
            filename,
            fileExt: extension,
            title,
            fileType: `text/${extension || 'plain'}`, // Assume text if not specified
            fileSize: item.length,
          };
        }

        // Using _internalAddKnowledge for character knowledge
        await this._internalAddKnowledge(
          {
            id: knowledgeId, // Use the content-derived ID
            content: {
              text: item,
            },
            metadata,
          },
          undefined,
          {
            // Scope to the agent itself for character knowledge
            roomId: this.runtime.agentId,
            entityId: this.runtime.agentId,
            worldId: this.runtime.agentId,
          }
        );
      } catch (error) {
        await this.handleProcessingError(error, 'processing character knowledge');
      } finally {
        this.knowledgeProcessingSemaphore.release();
      }
    });

    await Promise.all(processingPromises);
    logger.info(
      `KnowledgeService: Finished processing character knowledge for agent ${this.runtime.agentId}.`
    );
  }

  async _internalAddKnowledge(
    item: KnowledgeItem, // item.id here is expected to be the ID of the "document"
    options = {
      targetTokens: 1500, // TODO: Make these configurable, perhaps from plugin config
      overlap: 200,
      modelContextSize: 4096,
    },
    scope = {
      // Default scope for internal additions (like character knowledge)
      roomId: this.runtime.agentId,
      entityId: this.runtime.agentId,
      worldId: this.runtime.agentId,
    }
  ): Promise<void> {
    const finalScope = {
      roomId: scope?.roomId ?? this.runtime.agentId,
      worldId: scope?.worldId ?? this.runtime.agentId,
      entityId: scope?.entityId ?? this.runtime.agentId,
    };

    logger.debug(`KnowledgeService: _internalAddKnowledge called for item ID ${item.id}`);

    // For _internalAddKnowledge, we assume item.content.text is always present
    // and it's not a binary file needing Knowledge plugin's special handling for extraction.
    // This path is for already-textual content like character knowledge or direct text additions.

    const documentMemory: Memory = {
      id: item.id, // This ID should be the unique ID for the document being added.
      agentId: this.runtime.agentId,
      roomId: finalScope.roomId,
      worldId: finalScope.worldId,
      entityId: finalScope.entityId,
      content: item.content,
      metadata: {
        ...(item.metadata || {}), // Spread existing metadata
        type: MemoryType.DOCUMENT, // Ensure it's marked as a document
        documentId: item.id, // Ensure metadata.documentId is set to the item's ID
        timestamp: item.metadata?.timestamp || Date.now(),
      },
      createdAt: Date.now(),
    };

    const existingDocument = await this.runtime.getMemoryById(item.id);
    if (existingDocument) {
      logger.debug(
        `KnowledgeService: Document ${item.id} already exists in _internalAddKnowledge, updating...`
      );
      await this.runtime.updateMemory({
        ...documentMemory,
        id: existingDocument.id!, // Ensure id is defined
        metadata: { ...existingDocument.metadata, ...item.metadata } as MemoryMetadata,
      });
    } else {
      await this.runtime.createMemory(documentMemory, 'documents');
    }

    const fragments = await this.splitAndCreateFragments(
      item, // item.id is the documentId
      options.targetTokens,
      options.overlap,
      finalScope
    );

    let fragmentsProcessed = 0;
    for (const fragment of fragments) {
      try {
        await this.processDocumentFragment(fragment); // fragment already has metadata.documentId from splitAndCreateFragments
        fragmentsProcessed++;
      } catch (error) {
        logger.error(
          `KnowledgeService: Error processing fragment ${fragment.id} for document ${item.id}:`,
          error
        );
      }
    }
    logger.debug(
      `KnowledgeService: Processed ${fragmentsProcessed}/${fragments.length} fragments for document ${item.id}.`
    );
  }

  private async processDocumentFragment(fragment: Memory): Promise<void> {
    try {
      // Add embedding to the fragment
      // Runtime's addEmbeddingToMemory will use runtime.useModel(ModelType.TEXT_EMBEDDING, ...)
      await this.runtime.addEmbeddingToMemory(fragment);

      // Store the fragment in the knowledge table
      await this.runtime.createMemory(fragment, 'knowledge');
    } catch (error) {
      logger.error(
        `KnowledgeService: Error processing fragment ${fragment.id}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async splitAndCreateFragments(
    document: KnowledgeItem, // document.id is the ID of the parent document
    targetTokens: number,
    overlap: number,
    scope: { roomId: UUID; worldId: UUID; entityId: UUID }
  ): Promise<Memory[]> {
    if (!document.content.text) {
      return [];
    }

    const text = document.content.text;
    // TODO: Consider using DEFAULT_CHUNK_TOKEN_SIZE and DEFAULT_CHUNK_OVERLAP_TOKENS from ctx-embeddings
    // For now, using passed in values or defaults from _internalAddKnowledge.
    const chunks = await splitChunks(text, targetTokens, overlap);

    return chunks.map((chunk: string, index: number) => {
      // Create a unique ID for the fragment based on document ID, index, and timestamp
      const fragmentIdContent = `${document.id}-fragment-${index}-${Date.now()}`;
      const fragmentId = createUniqueUuid(this.runtime, this.runtime.agentId + fragmentIdContent);

      return {
        id: fragmentId,
        entityId: scope.entityId,
        agentId: this.runtime.agentId,
        roomId: scope.roomId,
        worldId: scope.worldId,
        content: {
          text: chunk,
        },
        metadata: {
          ...(document.metadata || {}), // Spread metadata from parent document
          type: MemoryType.FRAGMENT,
          documentId: document.id, // Link fragment to parent document
          position: index,
          timestamp: Date.now(), // Fragment's own creation timestamp
          // Ensure we don't overwrite essential fragment metadata with document's
          // For example, source might be different or more specific for the fragment.
          // Here, we primarily inherit and then set fragment-specifics.
        },
        createdAt: Date.now(),
      };
    });
  }

  // ADDED METHODS START
  /**
   * Retrieves memories, typically documents, for the agent.
   * Corresponds to GET /plugins/knowledge/documents
   */
  async getMemories(params: {
    tableName: string; // Should be 'documents' or 'knowledge' for this service
    roomId?: UUID;
    count?: number;
    end?: number; // timestamp for "before"
  }): Promise<Memory[]> {
    return this.runtime.getMemories({
      ...params, // includes tableName, roomId, count, end
      agentId: this.runtime.agentId,
    });
  }

  /**
   * Deletes a specific memory item (knowledge document) by its ID.
   * Corresponds to DELETE /plugins/knowledge/documents/:knowledgeId
   * Assumes the memoryId corresponds to an item in the 'documents' table or that
   * runtime.deleteMemory can correctly identify it.
   */
  async deleteMemory(memoryId: UUID): Promise<void> {
    // The core runtime.deleteMemory is expected to handle deletion.
    // If it needs a tableName, and we are sure it's 'documents', it could be passed.
    // However, the previous error indicated runtime.deleteMemory takes 1 argument.
    await this.runtime.deleteMemory(memoryId);
    logger.info(
      `KnowledgeService: Deleted memory ${memoryId} for agent ${this.runtime.agentId}. Assumed it was a document or related fragment.`
    );
  }

  /**
   * Advanced search with filtering and sorting capabilities
   */
  async advancedSearch(options: KnowledgeSearchOptions): Promise<{
    results: KnowledgeSearchResult[];
    totalCount: number;
    hasMore: boolean;
  }> {
    logger.debug('KnowledgeService: Advanced search called with options:', options);

    if (!options.query || options.query.trim().length === 0) {
      return { results: [], totalCount: 0, hasMore: false };
    }

    // Generate embedding for the query
    const embedding = await this.runtime.useModel(ModelType.TEXT_EMBEDDING, {
      text: options.query,
    });

    // Build filter conditions
    const filterConditions: any = {
      tableName: 'knowledge',
      embedding,
      query: options.query,
      count: options.limit || 20,
      match_threshold: options.filters?.minSimilarity || 0.1,
    };

    // Apply metadata filters if available
    if (options.filters) {
      const metadataFilters: Record<string, any> = {};

      if (options.filters.contentType?.length) {
        metadataFilters.contentType = { $in: options.filters.contentType };
      }

      if (options.filters.tags?.length) {
        metadataFilters.tags = { $overlap: options.filters.tags };
      }

      if (options.filters.source?.length) {
        metadataFilters.source = { $in: options.filters.source };
      }

      if (options.filters.dateRange) {
        metadataFilters.createdAt = {};
        if (options.filters.dateRange.start) {
          metadataFilters.createdAt.$gte = options.filters.dateRange.start.getTime();
        }
        if (options.filters.dateRange.end) {
          metadataFilters.createdAt.$lte = options.filters.dateRange.end.getTime();
        }
      }

      if (Object.keys(metadataFilters).length > 0) {
        filterConditions.metadata = metadataFilters;
      }
    }

    // Perform the search
    const fragments = await this.runtime.searchMemories(filterConditions);

    // Apply sorting if specified
    const sortedFragments = [...fragments];
    if (options.sort) {
      sortedFragments.sort((a, b) => {
        const field = options.sort!.field;
        const order = options.sort!.order === 'asc' ? 1 : -1;

        if (field === 'similarity') {
          return ((a.similarity || 0) - (b.similarity || 0)) * order;
        } else if (field === 'createdAt') {
          return ((a.createdAt || 0) - (b.createdAt || 0)) * order;
        }
        // Add more sorting fields as needed
        return 0;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paginatedResults = sortedFragments.slice(offset, offset + limit);

    // Convert to KnowledgeItem format
    const results = paginatedResults
      .filter((fragment) => fragment.id !== undefined)
      .map((fragment) => ({
        id: fragment.id as UUID,
        content: fragment.content as Content,
        similarity: fragment.similarity,
        metadata: options.includeMetadata ? fragment.metadata : undefined,
        worldId: fragment.worldId,
      }));

    return {
      results,
      totalCount: fragments.length,
      hasMore: offset + limit < fragments.length,
    };
  }

  /**
   * Batch operations for efficient knowledge management
   */
  async batchOperation(operation: BatchKnowledgeOperation): Promise<BatchOperationResult> {
    logger.info(
      `KnowledgeService: Starting batch ${operation.operation} operation with ${operation.items.length} items`
    );

    const results: BatchOperationResult = {
      successful: 0,
      failed: 0,
      results: [],
    };

    // Process items in parallel with concurrency control
    const batchSize = 5; // Process 5 items at a time
    for (let i = 0; i < operation.items.length; i += batchSize) {
      const batch = operation.items.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        try {
          let result: any;

          switch (operation.operation) {
            case 'add':
              if (!item.data) {
                throw new Error('Missing data for add operation');
              }
              result = await this.addKnowledge(item.data);
              break;

            case 'update':
              if (!item.id || !item.metadata) {
                throw new Error('Missing id or metadata for update');
              }
              // Update document metadata
              const memory = await this.runtime.getMemoryById(item.id as UUID);
              if (memory) {
                await this.runtime.updateMemory({
                  ...memory,
                  id: memory.id!, // Ensure id is defined
                  metadata: { ...memory.metadata, ...item.metadata } as MemoryMetadata,
                });
                result = { updated: true };
              } else {
                throw new Error('Document not found');
              }
              break;

            case 'delete':
              if (!item.id) {
                throw new Error('Missing id for delete operation');
              }
              await this.deleteMemory(item.id as UUID);
              result = { deleted: true };
              break;
          }

          results.successful++;
          return {
            id: item.id || result.clientDocumentId || 'unknown',
            success: true,
            result,
          };
        } catch (error) {
          results.failed++;
          return {
            id: item.id || 'unknown',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.results.push(...batchResults);
    }

    logger.info(
      `KnowledgeService: Batch operation completed. Success: ${results.successful}, Failed: ${results.failed}`
    );
    return results;
  }

  /**
   * Get analytics and insights about the knowledge base
   */
  async getAnalytics(): Promise<KnowledgeAnalytics> {
    logger.debug('KnowledgeService: Generating analytics');

    try {
      // Get all documents
      const documents = await this.getMemories({
        tableName: 'documents',
        count: 1000, // Get a large number
      });

      // Get all fragments
      const fragments = await this.runtime.getMemories({
        tableName: 'knowledge',
        agentId: this.runtime.agentId,
        count: 10000, // Get a large number
      });

      // Calculate content type distribution
      const contentTypes: Record<string, number> = {};
      let totalStorageSize = 0;

      documents.forEach((doc) => {
        const contentType = (doc.metadata as any)?.contentType || 'unknown';
        contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;

        // Estimate storage size (rough calculation)
        const contentSize = JSON.stringify(doc.content).length;
        totalStorageSize += contentSize;
      });

      // Get query statistics (would need to track these in production)
      // For now, return mock data
      const queryStats = {
        totalQueries: 0,
        averageResponseTime: 0,
        topQueries: [] as Array<{ query: string; count: number }>,
      };

      // Usage by date (would need to track in production)
      const usageByDate = [] as Array<{ date: string; queries: number; documents: number }>;

      return {
        totalDocuments: documents.length,
        totalFragments: fragments.length,
        storageSize: totalStorageSize,
        contentTypes,
        queryStats,
        usageByDate,
      };
    } catch (error) {
      logger.error('Error generating analytics:', error);
      throw error;
    }
  }

  /**
   * Export knowledge base to various formats
   */
  async exportKnowledge(options: KnowledgeExportOptions): Promise<string> {
    logger.info(`KnowledgeService: Exporting knowledge in ${options.format} format`);

    // Get documents based on filters
    let documents = await this.getMemories({
      tableName: 'documents',
      count: 1000,
    });

    // Apply filters
    if (options.documentIds?.length) {
      documents = documents.filter((doc) => options.documentIds!.includes(doc.id!));
    }

    if (options.dateRange) {
      documents = documents.filter((doc) => {
        const createdAt = doc.createdAt || 0;
        if (options.dateRange!.start && createdAt < options.dateRange!.start.getTime()) {
          return false;
        }
        if (options.dateRange!.end && createdAt > options.dateRange!.end.getTime()) {
          return false;
        }
        return true;
      });
    }

    // Format based on export type
    switch (options.format) {
      case 'json': {
        return JSON.stringify(
          {
            exportDate: new Date().toISOString(),
            agentId: this.runtime.agentId,
            documents: documents.map((doc) => ({
              id: doc.id,
              content: doc.content,
              metadata: options.includeMetadata ? doc.metadata : undefined,
              createdAt: doc.createdAt,
            })),
          },
          null,
          2
        );
      }

      case 'csv': {
        // Simple CSV export
        const headers = ['ID', 'Title', 'Content', 'Type', 'Created'];
        const rows = documents.map((doc) => [
          doc.id || '',
          (doc.metadata as any)?.originalFilename || '',
          doc.content.text || '',
          (doc.metadata as any)?.contentType || '',
          new Date(doc.createdAt || 0).toISOString(),
        ]);

        return [headers, ...rows].map((row) => row.join(',')).join('\n');
      }

      case 'markdown': {
        return documents
          .map((doc) => {
            const title = (doc.metadata as any)?.originalFilename || 'Untitled';
            const content = doc.content.text || '';
            const metadata = options.includeMetadata
              ? `\n\n---\n${JSON.stringify(doc.metadata, null, 2)}\n---`
              : '';

            return `# ${title}\n\n${content}${metadata}`;
          })
          .join('\n\n---\n\n');
      }

      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Import knowledge from various formats
   */
  async importKnowledge(
    data: string,
    options: KnowledgeImportOptions
  ): Promise<BatchOperationResult> {
    logger.info(`KnowledgeService: Importing knowledge from ${options.format} format`);

    let items: AddKnowledgeOptions[] = [];

    try {
      switch (options.format) {
        case 'json': {
          const jsonData = JSON.parse(data);
          items = jsonData.documents.map((doc: any) => ({
            clientDocumentId:
              doc.id || (stringToUuid(this.runtime.agentId + Date.now() + Math.random()) as UUID),
            content: doc.content.text || doc.content,
            contentType: doc.metadata?.contentType || 'text/plain',
            originalFilename: doc.metadata?.originalFilename || 'imported.txt',
            worldId: this.runtime.agentId,
            roomId: this.runtime.agentId,
            entityId: this.runtime.agentId,
            metadata: doc.metadata,
          }));
          break;
        }

        case 'csv': {
          // Simple CSV parsing (production would use a proper CSV parser)
          const lines = data.split('\n');
          const _headers = lines[0].split(',');

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 3) {
              items.push({
                clientDocumentId:
                  (values[0] as UUID) ||
                  (stringToUuid(this.runtime.agentId + Date.now() + i) as UUID),
                content: values[2] || '',
                contentType: values[3] || 'text/plain',
                originalFilename: values[1] || 'imported.txt',
                worldId: this.runtime.agentId,
                roomId: this.runtime.agentId,
                entityId: this.runtime.agentId,
              });
            }
          }
          break;
        }

        case 'markdown': {
          // Split by document separator
          const docs = data.split('\n\n---\n\n');
          items = docs.map((doc, index) => {
            const lines = doc.split('\n');
            const title = lines[0].replace(/^#\s+/, '') || `Document ${index + 1}`;
            const content = lines.slice(1).join('\n').trim();

            return {
              clientDocumentId: stringToUuid(this.runtime.agentId + title + Date.now()) as UUID,
              content,
              contentType: 'text/markdown',
              originalFilename: `${title}.md`,
              worldId: this.runtime.agentId,
              roomId: this.runtime.agentId,
              entityId: this.runtime.agentId,
            };
          });
          break;
        }

        default:
          throw new Error(`Unsupported import format: ${options.format}`);
      }

      // Validate if requested
      if (options.validateBeforeImport) {
        items = items.filter((item) => item.content && item.content.length > 0);
      }

      // Process import as batch operation
      const batchOp: BatchKnowledgeOperation = {
        operation: 'add',
        items: items.map((data) => ({ data })),
      };

      return await this.batchOperation(batchOp);
    } catch (error) {
      logger.error('Error importing knowledge:', error);
      throw error;
    }
  }

  /**
   * Ingest knowledge from a GitHub repository
   */
  async ingestGitHubRepository(options: GitHubIngestionOptions): Promise<GitHubIngestionResult> {
    logger.info(`KnowledgeService: Starting GitHub repository ingestion for ${options.repoUrl}`);

    try {
      // Use the ingestion utility to fetch repository contents
      const ingestionResult = await ingestGitHubRepository(options);

      // Process each document that was fetched
      const processedDocuments: Array<{
        id: UUID;
        filename: string;
        path: string;
        fragmentCount: number;
      }> = [];

      for (const doc of ingestionResult.documents) {
        try {
          // Use the actual file content from ingestion result
          if (!doc.content) {
            logger.warn(`No content available for GitHub file ${doc.path}, skipping`);
            continue;
          }

          const knowledgeOptions: AddKnowledgeOptions = {
            clientDocumentId: stringToUuid(doc.id) as UUID,
            contentType: this.getContentTypeFromPath(doc.path),
            originalFilename: doc.filename,
            worldId: options.metadata?.worldId || this.runtime.agentId,
            roomId: options.metadata?.roomId || this.runtime.agentId,
            entityId: options.metadata?.entityId || this.runtime.agentId,
            content: doc.content, // Use actual file content
            metadata: {
              source: 'github_repository',
              repositoryUrl: options.repoUrl,
              filePath: doc.path,
              ingestionTimestamp: Date.now(),
              ...doc.sourceMetadata,
              ...options.metadata,
            },
          };

          const result = await this.addKnowledge(knowledgeOptions);
          processedDocuments.push({
            id: doc.id,
            filename: doc.filename,
            path: doc.path,
            fragmentCount: result.fragmentCount,
          });
        } catch (error: any) {
          logger.warn(`Failed to process GitHub file ${doc.path}: ${error.message}`);
          ingestionResult.errors.push({
            file: doc.path,
            error: error.message,
          });
        }
      }

      // Update the result with actual processed information
      ingestionResult.documents = processedDocuments;
      ingestionResult.processedFiles = processedDocuments.length;

      logger.info(
        `KnowledgeService: GitHub repository ingestion completed. Processed ${processedDocuments.length} files.`
      );

      return ingestionResult;
    } catch (error: any) {
      logger.error(`KnowledgeService: GitHub repository ingestion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ingest knowledge from a web page
   */
  async ingestWebPage(options: WebPageIngestionOptions): Promise<WebPageIngestionResult> {
    logger.info(`KnowledgeService: Starting web page ingestion for ${options.url}`);

    try {
      // Use the ingestion utility to extract web page content
      const ingestionResult = await ingestWebPage(options);

      if (ingestionResult.error) {
        logger.warn(`Web page ingestion warning: ${ingestionResult.error}`);
        return ingestionResult;
      }

      if (ingestionResult.extractedText && ingestionResult.extractedText.length > 0) {
        // Process the extracted text as knowledge
        const knowledgeOptions: AddKnowledgeOptions = {
          clientDocumentId: stringToUuid(this.runtime.agentId + options.url + Date.now()) as UUID,
          contentType: 'text/html',
          originalFilename: `${ingestionResult.title || 'web-page'}.html`,
          worldId: options.metadata?.worldId || this.runtime.agentId,
          roomId: options.metadata?.roomId || this.runtime.agentId,
          entityId: options.metadata?.entityId || this.runtime.agentId,
          content: ingestionResult.extractedText,
          metadata: {
            source: 'web_page',
            originalUrl: options.url,
            title: ingestionResult.title,
            textLength: ingestionResult.textLength,
            ingestionTimestamp: Date.now(),
            ...options.metadata,
          },
        };

        const result = await this.addKnowledge(knowledgeOptions);

        // Update the result with document information
        ingestionResult.document = {
          id: knowledgeOptions.clientDocumentId,
          fragmentCount: result.fragmentCount,
        };

        logger.info(
          `KnowledgeService: Web page ingestion completed. Extracted ${ingestionResult.textLength} characters.`
        );
      }

      return ingestionResult;
    } catch (error: any) {
      logger.error(`KnowledgeService: Web page ingestion failed: ${error.message}`);
      return {
        url: options.url,
        extractedText: '',
        textLength: 0,
        error: error.message,
      };
    }
  }

  /**
   * Helper method to determine content type from file path
   */
  private getContentTypeFromPath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();

    const contentTypeMap: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      js: 'application/javascript',
      ts: 'application/typescript',
      json: 'application/json',
      yaml: 'application/yaml',
      yml: 'application/yaml',
      html: 'text/html',
      css: 'text/css',
      py: 'text/x-python',
      java: 'text/x-java-source',
      c: 'text/x-c',
      cpp: 'text/x-c++',
      h: 'text/x-c',
      hpp: 'text/x-c++',
      xml: 'application/xml',
      sql: 'text/x-sql',
      sh: 'application/x-sh',
      bash: 'application/x-sh',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
    };

    return contentTypeMap[extension || ''] || 'text/plain';
  }

  // ADDED METHODS END
}
