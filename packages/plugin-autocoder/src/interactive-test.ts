#!/usr/bin/env node

import { query } from '@anthropic-ai/claude-code';
import { AgentRuntime, type IAgentRuntime, type UUID } from '@elizaos/core';
import { createInterface } from 'readline';
import { v4 as uuidv4 } from 'uuid';

interface TestSession {
  sessionId: string;
  runtime: IAgentRuntime;
  projectPath?: string;
  currentProject?: any;
}

class InteractiveClaudeCodeTester {
  private session: TestSession;
  private rl: any;

  constructor() {
    this.session = {
      sessionId: uuidv4(),
      runtime: null as any, // Will be initialized in start()
    };

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🤖 Claude Code > ',
    });
  }

  async start() {
    console.log('\n🚀 Interactive Claude Code Sandbox Test');
    console.log('=====================================\n');

    // Check for required API keys
    const requiredKeys = ['ANTHROPIC_API_KEY'];
    const missingKeys = requiredKeys.filter((key) => !process.env[key]);

    if (missingKeys.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingKeys.forEach((key) => console.error(`   - ${key}`));
      console.log('\nPlease set these environment variables and try again.');
      process.exit(1);
    }

    // Optional keys
    const optionalKeys = ['E2B_API_KEY', 'GITHUB_TOKEN'];
    console.log('📋 Environment Status:');
    [...requiredKeys, ...optionalKeys].forEach((key) => {
      const status = process.env[key] ? '✅' : '❌';
      console.log(`   ${status} ${key}`);
    });

    // Initialize runtime
    try {
      await this.initializeRuntime();
      console.log('\n✅ Runtime initialized successfully!');
    } catch (error) {
      console.error('\n❌ Failed to initialize runtime:', error);
      process.exit(1);
    }

    this.showHelp();
    this.startRepl();
  }

  private async initializeRuntime() {
    console.log('\n🔧 Initializing AgentRuntime...');

    // Force BunSQLite for testing
    process.env.FORCE_BUNSQLITE = 'true';
    process.env.DATABASE_PATH = './.eliza/.test';
    process.env.ELIZA_TEST_MODE = 'true';
    process.env.SECRET_SALT = process.env.SECRET_SALT || 'test-salt-for-testing-only-not-secure';

    // Ensure data directory exists
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      await fs.mkdir(process.env.DATABASE_PATH, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }

    // Create runtime without plugins initially
    const runtime = new AgentRuntime({
      agentId: uuidv4() as UUID,
      character: {
        name: 'Interactive Test Agent',
        bio: ['An agent for testing code generation capabilities'],
        system: 'You are a helpful assistant for code generation.',
        secrets: {},
        settings: {},
        plugins: ['@elizaos/plugin-sql', '@elizaos/plugin-e2b', '@elizaos/plugin-forms', '@elizaos/plugin-autocoder'],
      },
    });

    // Set environment settings
    runtime.getSetting = (key: string) => {
      const value = process.env[key];
      if (value) {
        console.log(
          `🔑 Using ${key}: ${key.includes('KEY') || key.includes('TOKEN') ? '[HIDDEN]' : value}`
        );
      }
      return value;
    };

    // Set initialized flag
    (runtime as any).isInitialized = true;

    // Store runtime in session
    this.session.runtime = runtime;

    // Verify services are available
    const codeGenService = runtime.getService('code-generation');
    const e2bService = runtime.getService('e2b');
    const formsService = runtime.getService('forms');

    if (!codeGenService) {
      throw new Error('Code generation service not found');
    }
    if (!e2bService && process.env.E2B_API_KEY) {
      console.warn('⚠️  E2B service not found (API key is set)');
    }
    if (!formsService) {
      throw new Error('Forms service not found');
    }

    console.log('\n📋 Available services:');
    console.log(`   ✅ code-generation`);
    console.log(`   ${e2bService ? '✅' : '❌'} e2b`);
    console.log(`   ✅ forms`);
  }

  private showHelp() {
    console.log('\n📚 Available Commands:');
    console.log('   help                     - Show this help message');
    console.log('   status                   - Show current session status');
    console.log('   claude <prompt>          - Send direct prompt to Claude Code');
    console.log('   generate <description>   - Generate a complete project');
    console.log('   run <command>            - Run command in sandbox');
    console.log('   write <file> <content>   - Write file to sandbox');
    console.log('   read <file>              - Read file from sandbox');
    console.log('   ls [path]                - List files in sandbox');
    console.log('   clear                    - Clear terminal');
    console.log('   exit                     - Exit the test session');
    console.log('\n💡 Examples:');
    console.log('   claude Create a simple calculator function in TypeScript');
    console.log('   generate A weather plugin that fetches data from OpenWeatherMap');
    console.log('   run npm install');
    console.log('   write package.json {"name": "test"}');
    console.log('   read src/index.ts');
    console.log('');
  }

  private startRepl() {
    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const line = input.trim();

      if (!line) {
        this.rl.prompt();
        return;
      }

      await this.processCommand(line);
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n👋 Goodbye!');
      this.cleanup();
      process.exit(0);
    });
  }

  private async processCommand(input: string) {
    const [command, ...args] = input.split(' ');
    const fullArgs = args.join(' ');

    try {
      switch (command.toLowerCase()) {
        case 'help':
          this.showHelp();
          break;

        case 'status':
          await this.showStatus();
          break;

        case 'claude':
          if (!fullArgs) {
            console.log('❌ Please provide a prompt. Usage: claude <prompt>');
            break;
          }
          await this.runClaudeCode(fullArgs);
          break;

        case 'generate':
          if (!fullArgs) {
            console.log('❌ Please provide a description. Usage: generate <description>');
            break;
          }
          await this.generateProject(fullArgs);
          break;

        case 'run':
          if (!fullArgs) {
            console.log('❌ Please provide a command. Usage: run <command>');
            break;
          }
          await this.runSandboxCommand(fullArgs);
          break;

        case 'write':
          const [filename, ...contentParts] = args;
          if (!filename || contentParts.length === 0) {
            console.log('❌ Please provide filename and content. Usage: write <file> <content>');
            break;
          }
          await this.writeFile(filename, contentParts.join(' '));
          break;

        case 'read':
          if (!fullArgs) {
            console.log('❌ Please provide a filename. Usage: read <file>');
            break;
          }
          await this.readFile(fullArgs);
          break;

        case 'ls':
          await this.listFiles(fullArgs || '.');
          break;

        case 'clear':
          console.clear();
          break;

        case 'exit':
          this.rl.close();
          break;

        default:
          console.log(`❌ Unknown command: ${command}`);
          console.log('Type "help" for available commands.');
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
    }
  }

  private async showStatus() {
    console.log('\n📊 Session Status:');
    console.log(`   Session ID: ${this.session.sessionId}`);
    console.log(`   Runtime: ${this.session.runtime ? 'Initialized' : 'Not initialized'}`);
    console.log(`   Agent ID: ${this.session.runtime?.agentId || 'None'}`);
    console.log(`   Current Project: ${this.session.currentProject?.name || 'None'}`);
    console.log(`   Project Path: ${this.session.projectPath || 'None'}`);
    console.log('');
  }

  private async runClaudeCode(prompt: string) {
    console.log('\n🧠 Sending to Claude Code...');
    console.log(`📝 Prompt: ${prompt}`);

    const startTime = Date.now();

    try {
      let fullResponse = '';

      for await (const message of query({
        prompt: prompt,
        options: {
          maxTurns: 1,
          customSystemPrompt: 'You are Claude Code, an expert code generation assistant.',
        },
      })) {
        if (message.type === 'assistant') {
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === 'text') {
                fullResponse += item.text;
              }
            }
          }
        } else if ((message as any).type === 'tool_use') {
          console.log(`🔧 Tool used: ${(message as any).name}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n✅ Claude Code Response (${duration}ms):`);
      console.log('─'.repeat(50));
      console.log(fullResponse);
      console.log('─'.repeat(50));
    } catch (error) {
      console.error('❌ Claude Code Error:', (error as Error).message);
    }
  }

  private async generateProject(description: string) {
    console.log('\n🚀 Generating project...');
    console.log(`📝 Description: ${description}`);

    const startTime = Date.now();

    try {
      const codeGenService = this.session.runtime.getService('code-generation');
      if (!codeGenService) {
        throw new Error('Code generation service not available');
      }

      const request = {
        projectName: `generated-project-${Date.now()}`,
        description: description,
        requirements: [description],
        apis: [],
        targetType: 'plugin' as const,
        testScenarios: ['Basic functionality test'],
      };

      const result = await (codeGenService as any).generateCode(request);
      const duration = Date.now() - startTime;

      console.log(`\n✅ Project Generated (${duration}ms):`);
      console.log('─'.repeat(50));
      console.log(`📁 Project: ${request.projectName}`);
      console.log(`✅ Success: ${result.success}`);

      if (result.files) {
        console.log(`📄 Files generated: ${result.files.length}`);
        result.files.forEach((file: any) => {
          console.log(`   - ${file.path}`);
        });
      }

      if (result.errors && result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach((error: string) => console.log(`   - ${error}`));
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach((warning: string) => console.log(`   - ${warning}`));
      }

      console.log('─'.repeat(50));

      // Update session state
      this.session.currentProject = request;
      this.session.projectPath = result.projectPath;
    } catch (error) {
      console.error('❌ Generation Error:', (error as Error).message);
    }
  }

  private async runSandboxCommand(command: string) {
    console.log(`\n🔧 Running: ${command}`);

    const e2bService = this.session.runtime.getService('e2b');
    if (!e2bService) {
      console.log('❌ E2B service not available');
      return;
    }

    try {
      // Execute command in sandbox
      const result = await (e2bService as any).executeCode(
        `
import subprocess
result = subprocess.run('${command}'.split(), capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("EXIT_CODE:", result.returncode)
        `,
        'python'
      );

      if (result.text) {
        console.log(result.text);
      }
      if (result.error) {
        console.error('Error:', result.error);
      }
    } catch (error) {
      console.error('❌ Command Error:', (error as Error).message);
    }
  }

  private async writeFile(filename: string, content: string) {
    console.log(`\n📝 Writing file: ${filename}`);

    const e2bService = this.session.runtime.getService('e2b');
    if (!e2bService) {
      console.log('❌ E2B service not available');
      return;
    }

    try {
      await (e2bService as any).executeCode(
        `
with open('${filename}', 'w') as f:
    f.write('''${content}''')
print(f"✅ File '{filename}' written successfully")
        `,
        'python'
      );
    } catch (error) {
      console.error('❌ Write Error:', (error as Error).message);
    }
  }

  private async readFile(filename: string) {
    console.log(`\n📖 Reading file: ${filename}`);

    const e2bService = this.session.runtime.getService('e2b');
    if (!e2bService) {
      console.log('❌ E2B service not available');
      return;
    }

    try {
      const result = await (e2bService as any).executeCode(
        `
try:
    with open('${filename}', 'r') as f:
        content = f.read()
    print("─" * 50)
    print(content)
    print("─" * 50)
except FileNotFoundError:
    print(f"❌ File '{filename}' not found")
        `,
        'python'
      );

      if (result.text) {
        console.log(result.text);
      }
    } catch (error) {
      console.error('❌ Read Error:', (error as Error).message);
    }
  }

  private async listFiles(path: string) {
    console.log(`\n📁 Listing files in: ${path}`);

    const e2bService = this.session.runtime.getService('e2b');
    if (!e2bService) {
      console.log('❌ E2B service not available');
      return;
    }

    try {
      const result = await (e2bService as any).executeCode(
        `
import os
import subprocess

# Try to use ls -la for better output
result = subprocess.run(['ls', '-la', '${path}'], capture_output=True, text=True)
if result.returncode == 0:
    print(result.stdout)
else:
    print(f"❌ Error: {result.stderr}")
        `,
        'python'
      );

      if (result.text) {
        console.log(result.text);
      }
    } catch (error) {
      console.error('❌ List Error:', (error as Error).message);
    }
  }

  private async cleanup() {
    console.log('\n🧹 Cleaning up...');

    try {
      // Stop all services through runtime
      if (this.session.runtime) {
        const e2bService = this.session.runtime.getService('e2b');
        if (e2bService) {
          await (e2bService as any).stop();
          console.log('✅ E2B service stopped');
        }

        const codeGenService = this.session.runtime.getService('code-generation');
        if (codeGenService) {
          await (codeGenService as any).stop();
          console.log('✅ Code generation service stopped');
        }
      }
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', (error as Error).message);
    }
  }
}

// Main execution
async function main() {
  console.log('🎯 Interactive Claude Code Sandbox Test');
  console.log('=======================================\n');

  const tester = new InteractiveClaudeCodeTester();
  await tester.start();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { InteractiveClaudeCodeTester };
