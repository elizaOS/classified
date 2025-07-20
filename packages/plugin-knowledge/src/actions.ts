import type {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  // UUID,
  ActionResult,
} from '@elizaos/core';
import { logger, stringToUuid } from '@elizaos/core';
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeService } from './service.ts';
import { AddKnowledgeOptions, GitHubIngestionOptions, WebPageIngestionOptions } from './types.ts';
import { fetchUrlContent } from './utils.ts';

/**
 * Action to process knowledge from files or text
 */
export const processKnowledgeAction: Action = {
  name: 'PROCESS_KNOWLEDGE',
  description:
    'Process and store knowledge from a file path or text content into the knowledge base. Can be chained with SEARCH_KNOWLEDGE to verify ingestion or KNOWLEDGE_ANALYTICS to see updated stats',

  similes: [],

  examples: [
    // Multi-action: Process then search
    [
      {
        name: 'user',
        content: {
          text: 'Process the document at /path/to/document.pdf and then search for key terms',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll process the document and then search for key terms to verify the ingestion.",
          actions: ['PROCESS_KNOWLEDGE', 'SEARCH_KNOWLEDGE'],
        },
      },
    ],
    // Multi-action: Process then analyze
    [
      {
        name: 'user',
        content: {
          text: 'Add this to your knowledge: The capital of France is Paris. Then show me analytics.',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll add that information to my knowledge base and then show you the updated analytics.",
          actions: ['PROCESS_KNOWLEDGE', 'KNOWLEDGE_ANALYTICS'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Process the document at /path/to/document.pdf',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll process the document at /path/to/document.pdf and add it to my knowledge base.",
          actions: ['PROCESS_KNOWLEDGE'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Check if the message contains knowledge-related keywords
    const knowledgeKeywords = [
      'process',
      'add',
      'upload',
      'document',
      'knowledge',
      'learn',
      'remember',
      'store',
      'ingest',
      'file',
      'save this',
      'save that',
      'keep this',
      'keep that',
    ];

    const hasKeyword = knowledgeKeywords.some((keyword) => text.includes(keyword));

    // Check if there's a file path mentioned
    const pathPattern = /(?:\/[\w.-]+)+|(?:[a-zA-Z]:[\\/][\w\s.-]+(?:[\\/][\w\s.-]+)*)/;
    const hasPath = pathPattern.test(text);

    // Check if there are attachments in the message
    const hasAttachments = !!(
      message.content.attachments && message.content.attachments.length > 0
    );

    // Check if service is available
    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    if (!service) {
      logger.warn('Knowledge service not available for PROCESS_KNOWLEDGE action');
      return false;
    }

    return hasKeyword || hasPath || hasAttachments;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';
      const attachments = message.content.attachments || [];

      let response: Content;
      let processedCount = 0;
      const results: Array<{
        filename: string;
        success: boolean;
        fragmentCount?: number;
        error?: string;
      }> = [];

      // Process attachments first if they exist
      if (attachments.length > 0) {
        logger.info(`Processing ${attachments.length} attachments from message`);

        for (const attachment of attachments) {
          try {
            // Handle different attachment types
            let content: string;
            let contentType: string;
            let filename: string;

            if (attachment.url) {
              // Fetch content from URL
              const { content: fetchedContent, contentType: fetchedType } = await fetchUrlContent(
                attachment.url
              );
              content = fetchedContent;
              contentType = fetchedType;
              filename = attachment.title || attachment.url.split('/').pop() || 'attachment';
            } else if ('data' in attachment && attachment.data) {
              // Direct data attachment - handle base64 or direct content
              content = attachment.data as string;
              contentType = attachment.contentType || 'application/octet-stream';
              filename = attachment.title || 'attachment';
            } else {
              throw new Error('Attachment has no URL or data');
            }

            const knowledgeOptions: AddKnowledgeOptions = {
              clientDocumentId: stringToUuid(runtime.agentId + filename + Date.now()),
              contentType,
              originalFilename: filename,
              worldId: runtime.agentId,
              content,
              roomId: message.roomId,
              entityId: message.entityId,
              metadata: {
                source: 'message-attachment',
                messageId: message.id,
                attachmentType: ('type' in attachment ? attachment.type : undefined) || 'unknown',
              },
            };

            const result = await service.addKnowledge(knowledgeOptions);
            processedCount++;
            results.push({
              filename,
              success: true,
              fragmentCount: result.fragmentCount,
            });
          } catch (error: any) {
            logger.error('Error processing attachment:', error);
            results.push({
              filename: attachment.title || 'unknown',
              success: false,
              error: error.message,
            });
          }
        }

        // Generate response for attachments
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        if (successCount > 0 && failCount === 0) {
          response = {
            text: `I've successfully processed ${successCount} attachment${successCount > 1 ? 's' : ''} and added ${successCount > 1 ? 'them' : 'it'} to my knowledge base.`,
          };
        } else if (successCount > 0 && failCount > 0) {
          response = {
            text: `I processed ${successCount} attachment${successCount > 1 ? 's' : ''} successfully, but ${failCount} failed. The successful ones have been added to my knowledge base.`,
          };
        } else {
          response = {
            text: "I couldn't process any of the attachments. Please check the files and try again.",
          };
        }
      } else {
        // Original file path and text processing logic
        // Extract file path from message
        const pathPattern = /(?:\/[\w.-]+)+|(?:[a-zA-Z]:[\\/][\w\s.-]+(?:[\\/][\w\s.-]+)*)/;
        const pathMatch = text.match(pathPattern);

        if (pathMatch) {
          // Process file from path
          const filePath = pathMatch[0];

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            response = {
              text: `I couldn't find the file at ${filePath}. Please check the path and try again.`,
            };

            if (callback) {
              await callback(response);
            }
            return {
              success: false,
              data: {
                actionName: 'PROCESS_KNOWLEDGE',
                error: 'File not found',
                attemptedPath: filePath,
              },
              values: {
                success: false,
                error: 'File not found',
              },
            };
          }

          // Read file
          const fileBuffer = fs.readFileSync(filePath);
          const fileName = path.basename(filePath);
          const fileExt = path.extname(filePath).toLowerCase();

          // Determine content type
          let contentType = 'text/plain';
          if (fileExt === '.pdf') {
            contentType = 'application/pdf';
          } else if (fileExt === '.docx') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileExt === '.doc') {
            contentType = 'application/msword';
          } else if (['.txt', '.md', '.tson', '.xml', '.csv'].includes(fileExt)) {
            contentType = 'text/plain';
          }

          // Prepare knowledge options
          const knowledgeOptions: AddKnowledgeOptions = {
            clientDocumentId: stringToUuid(runtime.agentId + fileName + Date.now()),
            contentType,
            originalFilename: fileName,
            worldId: runtime.agentId,
            content: fileBuffer.toString('base64'),
            roomId: message.roomId,
            entityId: message.entityId,
          };

          // Process the document
          const result = await service.addKnowledge(knowledgeOptions);

          response = {
            text: `I've successfully processed the document "${fileName}". It has been split into ${result.fragmentCount} searchable fragments and added to my knowledge base.`,
          };
        } else {
          // Process direct text content
          const knowledgeContent = text
            .replace(/^(add|store|remember|process|learn)\s+(this|that|the following)?:?\s*/i, '')
            .trim();

          if (!knowledgeContent) {
            response = {
              text: 'I need some content to add to my knowledge base. Please provide text or a file path.',
            };

            if (callback) {
              await callback(response);
            }
            return {
              success: false,
              data: {
                actionName: 'PROCESS_KNOWLEDGE',
                error: 'No content provided',
              },
              values: {
                success: false,
                error: 'No content provided',
              },
            };
          }

          // Prepare knowledge options for text
          const knowledgeOptions: AddKnowledgeOptions = {
            clientDocumentId: stringToUuid(`${runtime.agentId}text${Date.now()}user-knowledge`),
            contentType: 'text/plain',
            originalFilename: 'user-knowledge.txt',
            worldId: runtime.agentId,
            content: knowledgeContent,
            roomId: message.roomId,
            entityId: message.entityId,
          };

          // Process the text
          const result = await service.addKnowledge(knowledgeOptions);
          processedCount = 1;
          results.push({
            filename: 'user-knowledge.txt',
            success: true,
            fragmentCount: result.fragmentCount,
          });

          response = {
            text: "I've added that information to my knowledge base. It has been stored and indexed for future reference.",
          };
        }
      }

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: {
          actionName: 'PROCESS_KNOWLEDGE',
          processedCount,
          successCount: results.filter((r) => r.success).length,
          results,
        },
        values: {
          success: true,
          processedCount,
          successCount: results.filter((r) => r.success).length,
        },
      };
    } catch (error) {
      logger.error('Error in PROCESS_KNOWLEDGE action:', error);

      const errorResponse: Content = {
        text: `I encountered an error while processing the knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };

      if (callback) {
        await callback(errorResponse);
      }

      return {
        success: false,
        data: {
          actionName: 'PROCESS_KNOWLEDGE',
          error: error instanceof Error ? error.message : String(error),
        },
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};

/**
 * Action to search the knowledge base
 */
export const searchKnowledgeAction: Action = {
  name: 'SEARCH_KNOWLEDGE',
  description:
    'Search the knowledge base for specific information. Can be chained with ADVANCED_KNOWLEDGE_SEARCH for more detailed results or EXPORT_KNOWLEDGE to export search results',

  similes: [
    'search knowledge',
    'find information',
    'look up',
    'query knowledge base',
    'search documents',
    'find in knowledge',
  ],

  examples: [
    // Multi-action: Search then advanced search
    [
      {
        name: 'user',
        content: {
          text: 'Search for quantum computing and then do an advanced search for recent PDFs',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll search for quantum computing and then perform an advanced search for recent PDF documents.",
          actions: ['SEARCH_KNOWLEDGE', 'ADVANCED_KNOWLEDGE_SEARCH'],
        },
      },
    ],
    // Multi-action: Search then export
    [
      {
        name: 'user',
        content: {
          text: 'Search for AI research and export the results',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll search for AI research in my knowledge base and then export the results for you.",
          actions: ['SEARCH_KNOWLEDGE', 'EXPORT_KNOWLEDGE'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Search your knowledge for information about quantum computing',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll search my knowledge base for information about quantum computing.",
          actions: ['SEARCH_KNOWLEDGE'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check if the message contains search-related keywords
    const searchKeywords = ['search', 'find', 'look up', 'query', 'what do you know about'];
    const knowledgeKeywords = ['knowledge', 'information', 'document', 'database'];

    const hasSearchKeyword = searchKeywords.some((keyword) => text.includes(keyword));
    const hasKnowledgeKeyword = knowledgeKeywords.some((keyword) => text.includes(keyword));

    // Check if service is available
    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    if (!service) {
      return false;
    }

    return hasSearchKeyword && hasKnowledgeKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';

      // Extract search query
      const query = text
        .replace(/^(search|find|look up|query)\s+(your\s+)?knowledge\s+(base\s+)?(for\s+)?/i, '')
        .trim();

      let response: Content;
      const _success = true;

      if (!query) {
        response = {
          text: 'What would you like me to search for in my knowledge base?',
        };
        const _success = false;

        if (callback) {
          await callback(response);
        }
        return {
          success: false,
          data: {
            actionName: 'SEARCH_KNOWLEDGE',
            error: 'No search query provided',
          },
          values: {
            success: false,
            error: 'No search query provided',
          },
        };
      }

      // Create search message
      const searchMessage: Memory = {
        ...message,
        content: {
          text: query,
        },
      };

      // Search knowledge
      const results = await service.getKnowledge(searchMessage);

      if (results.length === 0) {
        response = {
          text: `I couldn't find any information about "${query}" in my knowledge base.`,
        };
      } else {
        // Format results
        const formattedResults = results
          .slice(0, 3) // Top 3 results
          .map((item, index) => `${index + 1}. ${item.content.text}`)
          .join('\n\n');

        response = {
          text: `Here's what I found about "${query}":\n\n${formattedResults}`,
        };
      }

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: {
          actionName: 'SEARCH_KNOWLEDGE',
          query,
          results,
          count: results.length,
        },
        values: {
          success: true,
          query,
          resultCount: results.length,
        },
      };
    } catch (error) {
      logger.error('Error in SEARCH_KNOWLEDGE action:', error);

      const errorResponse: Content = {
        text: `I encountered an error while searching the knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };

      if (callback) {
        await callback(errorResponse);
      }

      return {
        success: false,
        data: {
          actionName: 'SEARCH_KNOWLEDGE',
          error: error instanceof Error ? error.message : String(error),
        },
        values: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};

/**
 * Action to perform advanced search with filters
 */
export const advancedSearchAction: Action = {
  name: 'ADVANCED_KNOWLEDGE_SEARCH',
  description:
    'Perform advanced search with filters, sorting, and pagination. Can be chained with EXPORT_KNOWLEDGE to export filtered results or KNOWLEDGE_ANALYTICS to analyze search patterns',

  similes: [
    'advanced search',
    'filter knowledge',
    'search with filters',
    'find documents by type',
    'search by date',
  ],

  examples: [
    // Multi-action: Advanced search then export
    [
      {
        name: 'user',
        content: {
          text: 'Search for PDF documents about AI from last week and export them',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll search for PDF documents about AI from last week and then export the results.",
          actions: ['ADVANCED_KNOWLEDGE_SEARCH', 'EXPORT_KNOWLEDGE'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Search for PDF documents about AI from last week',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll search for PDF documents about AI from last week.",
          actions: ['ADVANCED_KNOWLEDGE_SEARCH'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const hasAdvancedKeywords = ['filter', 'type', 'date', 'sort', 'pdf', 'recent'].some((k) =>
      text.includes(k)
    );
    const hasSearchKeywords = ['search', 'find', 'look'].some((k) => text.includes(k));

    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    return !!(service && hasSearchKeywords && hasAdvancedKeywords);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';

      // Extract search parameters from natural language
      const searchOptions: any = {
        query: text.replace(/search|find|filter|by|type|date|sort/gi, '').trim(),
        filters: {},
        limit: 10,
      };

      // Detect content type filters
      if (text.includes('pdf')) {
        searchOptions.filters.contentType = ['application/pdf'];
      }
      if (text.includes('text')) {
        searchOptions.filters.contentType = ['text/plain'];
      }
      if (text.includes('markdown')) {
        searchOptions.filters.contentType = ['text/markdown'];
      }

      // Detect date filters
      if (text.includes('today')) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        searchOptions.filters.dateRange = { start: today };
      } else if (text.includes('week')) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        searchOptions.filters.dateRange = { start: weekAgo };
      }

      // Detect sorting
      if (text.includes('recent') || text.includes('newest')) {
        searchOptions.sort = { field: 'createdAt', order: 'desc' };
      } else if (text.includes('relevant')) {
        searchOptions.sort = { field: 'similarity', order: 'desc' };
      }

      const results = await service.advancedSearch(searchOptions);

      let response: Content;
      if (results.results.length === 0) {
        response = {
          text: 'No documents found matching your criteria.',
        };
      } else {
        const formattedResults = results.results
          .slice(0, 5)
          .map((item, index) => {
            const metadata = item.metadata as any;
            return `${index + 1}. ${metadata?.originalFilename || 'Document'} (${metadata?.contentType || 'unknown'}):\n   ${item.content.text?.substring(0, 200)}...`;
          })
          .join('\n\n');

        response = {
          text: `Found ${results.totalCount} documents. Here are the top results:\n\n${formattedResults}`,
        };
      }

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: {
          actionName: 'ADVANCED_KNOWLEDGE_SEARCH',
          results: results.results,
          totalCount: results.totalCount,
          filters: searchOptions.filters,
        },
        values: {
          success: true,
          totalCount: results.totalCount,
          resultCount: results.results.length,
        },
      };
    } catch (error) {
      logger.error('Error in ADVANCED_KNOWLEDGE_SEARCH:', error);
      const errorResponse: Content = {
        text: `Error performing advanced search: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      if (callback) {
        await callback(errorResponse);
      }
      return {
        success: false,
        data: {
          actionName: 'ADVANCED_KNOWLEDGE_SEARCH',
          error: String(error),
        },
        values: {
          success: false,
          error: String(error),
        },
      };
    }
  },
};

/**
 * Action to get knowledge analytics
 */
export const knowledgeAnalyticsAction: Action = {
  name: 'KNOWLEDGE_ANALYTICS',
  description:
    'Get analytics and insights about the knowledge base. Can be chained with PROCESS_KNOWLEDGE to see updated stats after ingestion or EXPORT_KNOWLEDGE to export analytics data',

  similes: [
    'knowledge stats',
    'analytics',
    'knowledge insights',
    'usage statistics',
    'knowledge metrics',
  ],

  examples: [
    // Multi-action: Analytics then export
    [
      {
        name: 'user',
        content: {
          text: 'Show me knowledge base analytics and export the data',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll generate analytics for the knowledge base and export the data for you.",
          actions: ['KNOWLEDGE_ANALYTICS', 'EXPORT_KNOWLEDGE'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Show me knowledge base analytics',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll generate analytics for the knowledge base.",
          actions: ['KNOWLEDGE_ANALYTICS'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const hasKeywords = ['analytics', 'stats', 'statistics', 'metrics', 'insights', 'usage'].some(
      (k) => text.includes(k)
    );
    const hasKnowledgeWord = text.includes('knowledge');

    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    return !!(service && (hasKeywords || hasKnowledgeWord));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const analytics = await service.getAnalytics();

      const response: Content = {
        text: `📊 Knowledge Base Analytics:

📚 Total Documents: ${analytics.totalDocuments}
📄 Total Fragments: ${analytics.totalFragments}
💾 Storage Size: ${(analytics.storageSize / 1024 / 1024).toFixed(2)} MB

📁 Content Types:
${Object.entries(analytics.contentTypes)
  .map(([type, count]) => `  • ${type}: ${count} documents`)
  .join('\n')}

${
  analytics.queryStats.totalQueries > 0
    ? `
🔍 Query Statistics:
  • Total Queries: ${analytics.queryStats.totalQueries}
  • Avg Response Time: ${analytics.queryStats.averageResponseTime.toFixed(2)}ms
`
    : ''
}`,
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: {
          actionName: 'KNOWLEDGE_ANALYTICS',
          analytics,
        },
        values: {
          success: true,
          totalDocuments: analytics.totalDocuments,
          totalFragments: analytics.totalFragments,
          storageSizeMB: analytics.storageSize / 1024 / 1024,
        },
      };
    } catch (error) {
      logger.error('Error in KNOWLEDGE_ANALYTICS:', error);
      const errorResponse: Content = {
        text: `Error generating analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      if (callback) {
        await callback(errorResponse);
      }
      return {
        success: false,
        data: {
          actionName: 'KNOWLEDGE_ANALYTICS',
          error: String(error),
        },
        values: {
          success: false,
          error: String(error),
        },
      };
    }
  },
};

/**
 * Action to export knowledge base
 */
export const exportKnowledgeAction: Action = {
  name: 'EXPORT_KNOWLEDGE',
  description:
    'Export knowledge base to various formats. Can be chained with SEARCH_KNOWLEDGE or ADVANCED_KNOWLEDGE_SEARCH to export filtered results',

  similes: ['export knowledge', 'download knowledge', 'backup knowledge', 'save knowledge to file'],

  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'Export my knowledge base as JSON',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll export your knowledge base as JSON.",
          actions: ['EXPORT_KNOWLEDGE'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const hasExportKeywords = ['export', 'download', 'backup', 'save'].some((k) =>
      text.includes(k)
    );
    const hasKnowledgeWord = text.includes('knowledge');

    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    return !!(service && hasExportKeywords && hasKnowledgeWord);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';

      // Detect format
      let format: 'json' | 'csv' | 'markdown' = 'json';
      if (text.includes('csv')) {
        format = 'csv';
      } else if (text.includes('markdown') || text.includes('md')) {
        format = 'markdown';
      }

      const exportData = await service.exportKnowledge({
        format,
        includeMetadata: true,
        includeFragments: false,
      });

      // In a real implementation, this would save to a file or return a download link
      // For now, we'll just return a preview
      const preview = exportData.substring(0, 500) + (exportData.length > 500 ? '...' : '');

      const response: Content = {
        text: `✅ Knowledge base exported as ${format.toUpperCase()}. Size: ${(exportData.length / 1024).toFixed(2)} KB\n\nPreview:\n\`\`\`${format}\n${preview}\n\`\`\``,
      };

      if (callback) {
        await callback(response);
      }

      return {
        success: true,
        data: {
          actionName: 'EXPORT_KNOWLEDGE',
          format,
          size: exportData.length,
          content: exportData,
        },
        values: {
          success: true,
          format,
          sizeInBytes: exportData.length,
          sizeInKB: exportData.length / 1024,
        },
      };
    } catch (error) {
      logger.error('Error in EXPORT_KNOWLEDGE:', error);
      const errorResponse: Content = {
        text: `Error exporting knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      if (callback) {
        await callback(errorResponse);
      }
      return {
        success: false,
        data: {
          actionName: 'EXPORT_KNOWLEDGE',
          error: String(error),
        },
        values: {
          success: false,
          error: String(error),
        },
      };
    }
  },
};

/**
 * Action to ingest knowledge from a GitHub repository
 */
export const ingestGitHubAction: Action = {
  name: 'INGEST_GITHUB_REPO',
  description:
    'Ingest knowledge from a GitHub repository with optional subdirectory filtering. Can be chained with SEARCH_KNOWLEDGE to verify ingestion or KNOWLEDGE_ANALYTICS to see updated repository stats',

  similes: [
    'ingest github',
    'import github repository',
    'load github docs',
    'process github repo',
    'add github knowledge',
  ],

  examples: [
    // Multi-action: Ingest GitHub then search
    [
      {
        name: 'user',
        content: {
          text: 'Ingest the knowledge from https://github.com/elizaOS/knowledge and search for key concepts',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll ingest the knowledge from that GitHub repository and then search for key concepts.",
          actions: ['INGEST_GITHUB_REPO', 'SEARCH_KNOWLEDGE'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Import docs from https://github.com/elizaOS/eliza/tree/develop/packages/docs/docs',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll import the documentation from that GitHub repository folder.",
          actions: ['INGEST_GITHUB_REPO'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    const hasGitHubKeywords = ['github', 'repo', 'repository'].some((k) => text.includes(k));
    const hasIngestionKeywords = ['ingest', 'import', 'load', 'process', 'add'].some((k) =>
      text.includes(k)
    );
    const hasGitHubUrl = /github\.com\/[^\/]+\/[^\/]+/.test(text);

    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    return !!(service && (hasGitHubKeywords || hasGitHubUrl) && hasIngestionKeywords);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';

      // Extract GitHub URL
      const githubUrlMatch = text.match(
        /https:\/\/github\.com\/[^\/\s]+\/[^\/\s]+(?:\/tree\/[^\/\s]+\/(.+))?/
      );
      if (!githubUrlMatch) {
        const errorResponse: Content = {
          text: 'Please provide a valid GitHub repository URL.',
        };
        if (callback) {
          await callback(errorResponse);
        }
        return {
          success: false,
          data: {
            actionName: 'INGEST_GITHUB_REPO',
            error: 'No valid GitHub URL found',
          },
          values: {
            success: false,
            error: 'No valid GitHub URL found',
          },
        };
      }

      const repoUrl = githubUrlMatch[0];
      const subdirectoryPath = githubUrlMatch[1];

      // Parse subdirectories from URL or detect from text
      let subdirectories: string[] | undefined;
      if (subdirectoryPath) {
        subdirectories = [subdirectoryPath];
      } else if (text.includes('docs') || text.includes('/docs/')) {
        // If user mentions docs, try to filter to docs directories
        subdirectories = ['docs', 'documentation'];
      }

      const ingestionOptions: GitHubIngestionOptions = {
        repoUrl: repoUrl.replace(/\/tree\/[^\/]+\/.*/, ''), // Clean URL
        subdirectories,
        metadata: {
          worldId: message.roomId,
          roomId: message.roomId,
          entityId: message.entityId,
          source: 'github_ingestion_action',
          messageId: message.id,
        },
      };

      let response: Content;

      try {
        const result = await service.ingestGitHubRepository(ingestionOptions);

        if (result.processedFiles > 0) {
          response = {
            text: `✅ Successfully ingested ${result.processedFiles} files from the GitHub repository. ${result.errors.length > 0 ? `${result.errors.length} files failed to process.` : 'All files processed successfully.'}`,
          };
        } else {
          response = {
            text: '⚠️ No files were processed from the repository. This might be due to file type filters or repository access issues.',
          };
        }

        if (callback) {
          await callback(response);
        }

        return {
          success: true,
          data: {
            actionName: 'INGEST_GITHUB_REPO',
            repoUrl: ingestionOptions.repoUrl,
            subdirectories: ingestionOptions.subdirectories,
            result,
          },
          values: {
            success: true,
            processedFiles: result.processedFiles,
            failedFiles: result.errors.length,
          },
        };
      } catch (ingestionError: any) {
        logger.error('GitHub ingestion error:', ingestionError);
        response = {
          text: `❌ Failed to ingest from GitHub repository: ${ingestionError.message}. Please check the repository URL and try again.`,
        };
        if (callback) {
          await callback(response);
        }
        return {
          success: false,
          data: {
            actionName: 'INGEST_GITHUB_REPO',
            error: ingestionError.message,
          },
          values: {
            success: false,
            error: ingestionError.message,
          },
        };
      }
    } catch (error: any) {
      logger.error('Error in INGEST_GITHUB_REPO action:', error);
      const errorResponse: Content = {
        text: `Error processing GitHub repository: ${error.message}`,
      };
      if (callback) {
        await callback(errorResponse);
      }
      return {
        success: false,
        data: {
          actionName: 'INGEST_GITHUB_REPO',
          error: error.message,
        },
        values: {
          success: false,
          error: error.message,
        },
      };
    }
  },
};

/**
 * Action to ingest knowledge from a web page
 */
export const ingestWebPageAction: Action = {
  name: 'INGEST_WEB_PAGE',
  description:
    'Extract and ingest knowledge from a web page URL. Can be chained with SEARCH_KNOWLEDGE to find ingested content or KNOWLEDGE_ANALYTICS to see updated stats',

  similes: [
    'ingest web page',
    'import web content',
    'extract from url',
    'process web page',
    'add web knowledge',
  ],

  examples: [
    // Multi-action: Ingest web page then search
    [
      {
        name: 'user',
        content: {
          text: 'Extract knowledge from https://eliza.how/docs/intro and search for key points',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll extract the knowledge from that web page and then search for key points.",
          actions: ['INGEST_WEB_PAGE', 'SEARCH_KNOWLEDGE'],
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Extract knowledge from https://eliza.how/docs/intro',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll extract the knowledge from that web page.",
          actions: ['INGEST_WEB_PAGE'],
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    const hasWebKeywords = ['web', 'page', 'url', 'website', 'site'].some((k) => text.includes(k));
    const hasIngestionKeywords = ['extract', 'ingest', 'import', 'process', 'add'].some((k) =>
      text.includes(k)
    );
    const hasUrl = /https?:\/\/[^\s]+/.test(text);

    const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
    return !!(service && hasUrl && (hasWebKeywords || hasIngestionKeywords));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
      if (!service) {
        throw new Error('Knowledge service not available');
      }

      const text = message.content.text || '';

      // Extract URL
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (!urlMatch) {
        const errorResponse: Content = {
          text: 'Please provide a valid web page URL.',
        };
        if (callback) {
          await callback(errorResponse);
        }
        return {
          success: false,
          data: {
            actionName: 'INGEST_WEB_PAGE',
            error: 'No valid URL found',
          },
          values: {
            success: false,
            error: 'No valid URL found',
          },
        };
      }

      const url = urlMatch[0];

      const ingestionOptions: WebPageIngestionOptions = {
        url,
        minTextLength: 30, // Filter out short text elements
        metadata: {
          worldId: message.roomId,
          roomId: message.roomId,
          entityId: message.entityId,
          source: 'web_page_ingestion_action',
          messageId: message.id,
        },
      };

      let response: Content;

      try {
        const result = await service.ingestWebPage(ingestionOptions);

        if (result.error) {
          response = {
            text: `⚠️ Failed to extract content from the web page: ${result.error}. Please try adding the knowledge from a file instead.`,
          };
        } else if (result.textLength > 0) {
          response = {
            text: `✅ Successfully extracted ${result.textLength} characters from the web page "${result.title || url}". The content has been added to my knowledge base.`,
          };
        } else {
          response = {
            text: '⚠️ No meaningful content could be extracted from the web page. Please check the URL or try a different page.',
          };
        }

        if (callback) {
          await callback(response);
        }

        return {
          success: true,
          data: {
            actionName: 'INGEST_WEB_PAGE',
            url: ingestionOptions.url,
            result,
          },
          values: {
            success: true,
            textLength: result.textLength,
            title: result.title || 'Untitled',
          },
        };
      } catch (ingestionError: any) {
        logger.error('Web page ingestion error:', ingestionError);
        response = {
          text: `❌ Failed to extract from web page: ${ingestionError.message}. Please try adding the knowledge from a file instead.`,
        };
        if (callback) {
          await callback(response);
        }
        return {
          success: false,
          data: {
            actionName: 'INGEST_WEB_PAGE',
            error: ingestionError.message,
          },
          values: {
            success: false,
            error: ingestionError.message,
          },
        };
      }
    } catch (error: any) {
      logger.error('Error in INGEST_WEB_PAGE action:', error);
      const errorResponse: Content = {
        text: `Error processing web page: ${error.message}`,
      };
      if (callback) {
        await callback(errorResponse);
      }
      return {
        success: false,
        data: {
          actionName: 'INGEST_WEB_PAGE',
          error: error.message,
        },
        values: {
          success: false,
          error: error.message,
        },
      };
    }
  },
};

// Update the export to include new actions
export const knowledgeActions = [
  processKnowledgeAction,
  searchKnowledgeAction,
  advancedSearchAction,
  knowledgeAnalyticsAction,
  exportKnowledgeAction,
  ingestGitHubAction,
  ingestWebPageAction,
];
