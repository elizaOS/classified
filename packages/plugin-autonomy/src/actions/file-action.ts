import {
  type Action,
  type ActionResult,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  logger,
  type ActionExample,
  createUniqueUuid,
} from '@elizaos/core';
import * as fs from 'fs/promises';
import * as path from 'node:path';
import { homedir } from 'os';

/**
 * File Action - Actually creates, reads, and manages files
 * This replaces the fake "I'll create a file..." responses with real file operations
 */
export const fileOperationAction: Action = {
  name: 'FILE_OPERATION',
  similes: ['CREATE_FILE', 'WRITE_FILE', 'READ_FILE', 'SAVE_REPORT', 'MAKE_NOTES'],
  description:
    'Performs file operations - create, read, write files. Can be chained with analysis actions to process file contents or command execution to use file data',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Basic action validation
    const hasFileKeywords =
      (text.includes('create') &&
        (text.includes('file') || text.includes('report') || text.includes('notes'))) ||
      text.includes('save') ||
      (text.includes('write') && text.includes('file'));

    if (!hasFileKeywords) {
      return false;
    }

    // Security validation: Check for directory traversal and dangerous paths
    const dangerousPatterns = [
      '../',
      '..\\',
      '/etc/',
      '/root/',
      '/bin/',
      '/usr/',
      '/sys/',
      '/proc/',
      'c:\\windows\\',
      'c:\\program files\\',
      '%systemroot%',
      '~/.ssh/',
      '~/.bash',
      '/home/user/.ssh',
      'passwd',
      'shadow',
      'config/sam',
    ];

    // Special handling: /var/tmp is safe (not /var/ in general)
    const hasDangerousPattern = dangerousPatterns.some((pattern) => {
      if (pattern === '/var/') {
        // Allow /var/tmp but block other /var paths
        return text.includes('/var/') && !text.includes('/var/tmp');
      }
      return text.includes(pattern);
    });

    if (hasDangerousPattern) {
      return false;
    }

    // Check allowed paths from settings
    const allowedPaths = runtime.getSetting('ALLOWED_PATHS');
    if (allowedPaths) {
      try {
        const allowed = JSON.parse(allowedPaths as string);
        // Extract file path from message
        const fileMatch = text.match(/(?:at|to|in)\s+([/~]?[^\s]+)/i);
        if (fileMatch) {
          const requestedPath = fileMatch[1].toLowerCase();
          const isAllowed = allowed.some((allowedPath: string) =>
            requestedPath.startsWith(allowedPath.toLowerCase())
          );
          return isAllowed;
        }
      } catch {
        // Invalid JSON, continue with default checks
      }
    }

    // Default safe paths when no configuration is provided
    const defaultSafePaths = ['/tmp/', '/var/tmp/', './test/', './'];
    const fileMatch = text.match(/(?:at|to|in)\s+([/~]?[^\s]+)/i);
    if (fileMatch) {
      const requestedPath = fileMatch[1].toLowerCase();
      return defaultSafePaths.some((safePath) => requestedPath.startsWith(safePath));
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    if (!callback) {
      return {
        data: {
          actionName: 'FILE_OPERATION',
          error: 'No callback provided',
        },
        values: {
          success: false,
          error: 'No callback provided',
        },
      };
    }

    try {
      const text = message.content.text || '';

      // Determine operation type and file details
      const operation = 'create';
      let fileName = '';
      let content = '';
      let filePath = '';

      // Extract file name and path
      const fileMatch = text.match(
        /(?:create|write|save)\s+(?:a\s+)?(?:file|report|notes?)\s+(?:named\s+|called\s+|at\s+)?([^\s]+)/i
      );
      if (fileMatch) {
        fileName = fileMatch[1];
      } else {
        // Generate a default filename based on context
        const timestamp = new Date().toISOString().split('T')[0];
        if (text.includes('report')) {
          fileName = `report-${timestamp}.md`;
        } else if (text.includes('notes')) {
          fileName = `notes-${timestamp}.md`;
        } else {
          fileName = `file-${timestamp}.txt`;
        }
      }

      // Determine file path
      if (fileName.startsWith('~/')) {
        filePath = path.join(homedir(), fileName.substring(2));
      } else if (fileName.startsWith('/')) {
        filePath = fileName;
      } else {
        // Default to a safe directory
        const baseDir = path.join(homedir(), 'autonomy-files');
        await fs.mkdir(baseDir, { recursive: true });
        filePath = path.join(baseDir, fileName);
      }

      // Extract content if provided
      const contentMatch = text.match(/with\s+content[:\s]+(.+)$/i);
      if (contentMatch) {
        content = contentMatch[1];
      } else {
        // Generate appropriate content based on file type
        if (fileName.endsWith('.md')) {
          content = `# ${fileName
            .replace(/\.md$/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())}

Created by Autonomous Agent on ${new Date().toISOString()}

## Summary

This file was automatically generated based on the request: "${text}"

## Content

[Content will be added here]
`;
        } else {
          content = `File created by Autonomous Agent
Date: ${new Date().toISOString()}
Request: ${text}

[Content to be added]
`;
        }
      }

      // Perform the file operation
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');

      // Verify the file was created
      const stats = await fs.stat(filePath);

      // Store file metadata in memory
      await runtime.createMemory(
        {
          id: createUniqueUuid(runtime, 'file-op'),
          content: {
            text: `Created file: ${fileName}`,
            data: {
              operation,
              filePath,
              fileName,
              size: stats.size,
              created: stats.birthtime || new Date(),
              timestamp: new Date().toISOString(),
            },
          },
          roomId: message.roomId,
          worldId: message.worldId,
          agentId: runtime.agentId,
          entityId: runtime.agentId,
          createdAt: Date.now(),
        },
        'knowledge'
      );

      // Provide confirmation with actual file details
      const thought = `I successfully created the file at ${filePath} with initial content.`;
      const responseText = `I've created the file: ${fileName}

Location: ${filePath}
Size: ${stats.size} bytes
Created: ${stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString()}

The file has been initialized with appropriate content structure. You can now add or modify content as needed.`;

      await callback({
        text: responseText,
        thought,
        actions: ['FILE_OPERATION'],
        source: message.content.source,
        data: {
          operation,
          filePath,
          success: true,
        },
      });

      return {
        data: {
          actionName: 'FILE_OPERATION',
          operation,
          filePath,
          fileName,
          fileSize: stats.size,
          createdAt: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
        },
        values: {
          success: true,
          filePath,
          operationType: operation,
          fileSizeBytes: stats.size,
        },
      };
    } catch (error) {
      logger.error('Error in fileOperation handler:', error);
      await callback({
        text: `I encountered an error with the file operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['FILE_OPERATION_ERROR'],
        source: message.content.source,
      });

      return {
        data: {
          actionName: 'FILE_OPERATION',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        values: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a report file named research-findings.md',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I've created the file: research-findings.md\n\nLocation: /Users/username/autonomy-files/research-findings.md\nSize: 245 bytes\nCreated: 2024-01-15T10:30:00.000Z\n\nThe file has been initialized with appropriate content structure.",
          actions: ['FILE_OPERATION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Create a summary file with the command output results',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll execute the command first to get the results, then create a summary file with the output.",
          actions: ['EXECUTE_COMMAND', 'FILE_OPERATION'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Write the analysis findings to a report and push it to git',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll create a report file with the analysis findings and then commit and push it to the git repository.",
          actions: ['FILE_OPERATION', 'GIT_OPERATION'],
        },
      },
    ],
  ] as ActionExample[][],
};
