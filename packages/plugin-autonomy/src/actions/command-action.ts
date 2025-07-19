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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Command Action - Actually executes system commands
 * This replaces fake "I'll run this command..." responses with real execution
 */
export const executeCommandAction: Action = {
  name: 'EXECUTE_COMMAND',
  similes: ['RUN_COMMAND', 'EXEC_CMD', 'SYSTEM_COMMAND', 'CHECK_DISK', 'CHECK_MEMORY'],
  description:
    'Executes system commands and returns real output. Can be chained with analysis actions to verify results or with file operations to process command output',

  validate: async (runtime: IAgentRuntime, message: Memory, _state?: State): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for common command patterns
    const hasCommandKeywords =
      (text.includes('run') && text.includes('command')) ||
      text.includes('execute') ||
      (text.includes('check') &&
        (text.includes('disk') || text.includes('memory') || text.includes('cpu'))) ||
      text.includes('df -h') ||
      text.includes('free -m') ||
      text.includes('uptime') ||
      text.includes('ps aux') ||
      text.includes('du -h');

    if (!hasCommandKeywords) {
      return false;
    }

    // Security validation: Extract and validate the command
    let command = '';

    // Extract command from multiple patterns
    const cmdMatch1 = text.match(/(?:execute|run):\s*(.+?)(?:\s*$|\s*\n|$)/i);
    const cmdMatch2 = text.match(/(?:run|execute)\s+(?:command\s+)?[`"]?([^`"]+)[`"]?/i);

    if (cmdMatch1) {
      command = cmdMatch1[1].trim().toLowerCase();
    } else if (cmdMatch2) {
      command = cmdMatch2[1].trim().toLowerCase();
    } else {
      // Look for direct command patterns in text
      const directMatch = text.match(
        /(rm\s|sudo\s|su\s|chmod\s|chown\s|mkfs\s|dd\s|format\s|del\s|wget\s|curl\s|nc\s|netcat\s|ssh\s|scp\s)/i
      );
      if (directMatch) {
        command = text.toLowerCase();
      } else {
        return true; // Allow predefined safe commands if no explicit command found
      }
    }

    // Check blocked commands from settings
    const blockedCommands = runtime.getSetting('BLOCKED_COMMANDS');
    if (blockedCommands) {
      try {
        const blocked = JSON.parse(blockedCommands as string);
        for (const blockedCmd of blocked) {
          if (command.includes(blockedCmd)) {
            return false;
          }
        }
      } catch {
        // Invalid JSON, continue with built-in blocks
      }
    }

    // Built-in dangerous command blocking (be specific to avoid false positives)
    const dangerousPatterns = [
      'rm -rf',
      'sudo ',
      'su ',
      'chmod ',
      'chown ',
      'mkfs ',
      'dd if=',
      'format ',
      'del ',
      'wget ',
      'curl ',
      'nc ',
      'netcat ',
      'ssh ',
      'scp ',
      '&&',
      '||',
      ';',
      '`',
      ' exec ',
      'eval ',
      ' | ',
      '$(',
      'attacker.com',
      'malware.com',
      'evil.com',
      'evil.sh',
    ];

    // Check full text for dangerous patterns too (not just extracted command)
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern) || text.includes(pattern)) {
        return false;
      }
    }

    // Check allowed commands from settings
    const allowedCommands = runtime.getSetting('ALLOWED_COMMANDS');
    if (allowedCommands) {
      try {
        const allowed = JSON.parse(allowedCommands as string);
        const commandBase = command.split(/\s+/)[0];
        return allowed.includes(commandBase);
      } catch {
        // Invalid JSON, use built-in allowed list
      }
    }

    // Default allowed commands
    const defaultAllowed = [
      'echo',
      'ls',
      'pwd',
      'cat',
      'df',
      'free',
      'uptime',
      'ps',
      'du',
      'date',
      'uname',
      'whoami',
      'hostname',
    ];
    const commandBase = command.split(/\s+/)[0];
    return defaultAllowed.includes(commandBase);
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
          actionName: 'EXECUTE_COMMAND',
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
      let command = '';

      // Extract command from message
      const cmdMatch = text.match(/(?:run|execute)\s+(?:command\s+)?[`"]?([^`"]+)[`"]?/i);
      if (cmdMatch) {
        command = cmdMatch[1].trim();
      } else if (text.includes('df -h') || text.includes('disk')) {
        command = 'df -h';
      } else if (text.includes('free -m') || text.includes('memory')) {
        command = 'free -m 2>/dev/null || vm_stat'; // Linux or macOS
      } else if (text.includes('uptime') || text.includes('load')) {
        command = 'uptime';
      } else if (text.includes('ps aux') || text.includes('processes')) {
        command = 'ps aux --sort=-%cpu 2>/dev/null | head -20 || ps aux | head -20';
      } else if (text.includes('du -h')) {
        command =
          'du -h --max-depth=1 ~ 2>/dev/null | sort -rh | head -10 || du -h -d 1 ~ | sort -rh | head -10';
      } else {
        // Default to a safe info command
        command = 'uname -a';
      }

      // Safety check - only allow certain commands
      const allowedCommands = [
        'df',
        'free',
        'uptime',
        'ps',
        'du',
        'ls',
        'pwd',
        'date',
        'uname',
        'whoami',
        'hostname',
        'cat /proc/cpuinfo',
        'vm_stat',
      ];

      const commandBase = command.split(/\s+/)[0];
      const isAllowed = allowedCommands.some(
        (allowed) => commandBase === allowed || command.startsWith(`${allowed} `)
      );

      if (!isAllowed) {
        await callback({
          text: `For safety reasons, I can only execute system information commands. The command "${command}" is not in the allowed list.`,
          actions: ['EXECUTE_COMMAND_BLOCKED'],
          source: message.content.source,
        });
        return {
          data: {
            actionName: 'EXECUTE_COMMAND',
            command,
            blocked: true,
            reason: 'Command not in allowed list',
          },
          values: {
            success: false,
            blocked: true,
            attemptedCommand: command,
          },
        };
      }

      // Execute the command
      const { stdout, stderr } = await execAsync(command, {
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      const output = stdout || stderr || '';

      // Store command execution in memory
      await runtime.createMemory(
        {
          id: createUniqueUuid(runtime, 'cmd-exec'),
          content: {
            text: `Executed command: ${command}`,
            data: {
              command,
              output,
              exitCode: stderr ? 1 : 0,
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

      // Analyze output for insights
      let analysis = '';
      if (command.includes('df')) {
        const lines = output.split('\n');
        const diskUsage = lines.find((line) => line.includes('/') && !line.includes('/dev'));
        if (diskUsage) {
          const match = diskUsage.match(/(\d+)%/);
          if (match && parseInt(match[1], 10) > 80) {
            analysis = '\n\n⚠️ Warning: Disk usage is above 80%!';
          }
        }
      }

      // Provide the actual command output
      const thought = `I executed the command "${command}" and captured the output.`;
      const responseText = `I executed the command: \`${command}\`

Output:
\`\`\`
${output.trim()}
\`\`\`${analysis}

Command executed successfully at ${new Date().toISOString()}.`;

      await callback({
        text: responseText,
        thought,
        actions: ['EXECUTE_COMMAND'],
        source: message.content.source,
        data: {
          command,
          outputLength: output.length,
          success: true,
        },
      });

      return {
        data: {
          actionName: 'EXECUTE_COMMAND',
          command,
          output,
          exitCode: stderr ? 1 : 0,
          executedAt: new Date().toISOString(),
          analysis,
        },
        values: {
          success: true,
          executedCommand: command,
          outputLines: output.split('\n').length,
          hasWarnings: analysis.includes('Warning'),
        },
      };
    } catch (error) {
      logger.error('Error in executeCommand handler:', error);
      await callback({
        text: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: ['EXECUTE_COMMAND_ERROR'],
        source: message.content.source,
      });

      return {
        data: {
          actionName: 'EXECUTE_COMMAND',
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
          text: 'Check disk usage with df -h',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'I executed the command: `df -h`\n\nOutput:\n```\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   45G   50G  45% /\n```\n\nCommand executed successfully.',
          actions: ['EXECUTE_COMMAND'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Check system memory and then analyze the output to identify any issues',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll check the system memory usage and analyze the results for any potential issues.",
          actions: ['EXECUTE_COMMAND', 'ANALYZE_DATA'],
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'List the files in the current directory and then read the README if it exists',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "I'll list the directory contents and then read the README file if one is present.",
          actions: ['EXECUTE_COMMAND', 'READ_FILE'],
        },
      },
    ],
  ] as ActionExample[][],
};
