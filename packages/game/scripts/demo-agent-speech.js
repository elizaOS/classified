#!/usr/bin/env bun

/**
 * Agent Speech Demo
 *
 * Demonstrates how an agent can speak to users through the hardware bridge
 */

import { HardwareBridgeService } from '../src-backend/services/HardwareBridgeService.js';
import readline from 'readline';

class AgentSpeechDemo {
  constructor() {
    this.bridgeService = null;
    this.connectedClients = [];
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    };
    console.log(`${colors[type]}[AGENT-SPEECH] ${message}${colors.reset}`);
  }

  async startDemo() {
    this.log('🎤 Starting Agent Speech Demo...', 'info');

    // Start hardware bridge service
    this.bridgeService = new HardwareBridgeService({
      port: 8888,
      enableStreaming: true,
      enableVirtualHardware: true,
    });

    await this.bridgeService.start();
    this.log('✅ Hardware Bridge Service started on port 8888', 'success');

    this.log('', 'info');
    this.log('🌟 AGENT SPEECH CAPABILITIES DEMO', 'success');
    this.log('================================', 'info');
    this.log('', 'info');
    this.log('The agent can now:', 'info');
    this.log('  • Speak text using browser Text-to-Speech', 'success');
    this.log('  • Play notification sounds and beeps', 'success');
    this.log('  • Send audio files to user speakers', 'success');
    this.log('', 'info');
    this.log('Instructions:', 'info');
    this.log('  1. Open your browser and connect to the hardware bridge', 'warning');
    this.log('  2. Use the commands below to make the agent speak:', 'warning');
    this.log('', 'info');

    this.startInteractiveDemo();
  }

  startInteractiveDemo() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.log('📝 Interactive Commands:', 'info');
    this.log('  say <text>     - Make agent speak text', 'info');
    this.log('  beep           - Play notification beep', 'info');
    this.log('  chime          - Play notification chime', 'info');
    this.log('  clients        - Show connected clients', 'info');
    this.log('  demo           - Run full speech demo', 'info');
    this.log('  help           - Show this help', 'info');
    this.log('  quit           - Exit demo', 'info');
    this.log('', 'info');

    const askForCommand = () => {
      rl.question('\x1b[36mAgent> \x1b[0m', async (input) => {
        const [command, ...args] = input.trim().split(' ');

        try {
          switch (command.toLowerCase()) {
            case 'say':
              if (args.length === 0) {
                this.log('Usage: say <text to speak>', 'warning');
              } else {
                const text = args.join(' ');
                await this.speakText(text);
              }
              break;

            case 'beep':
              await this.playBeep();
              break;

            case 'chime':
              await this.playChime();
              break;

            case 'clients':
              this.showConnectedClients();
              break;

            case 'demo':
              await this.runSpeechDemo();
              break;

            case 'help':
              this.log('📝 Available Commands:', 'info');
              this.log('  say <text>     - Make agent speak text', 'info');
              this.log('  beep           - Play notification beep', 'info');
              this.log('  chime          - Play notification chime', 'info');
              this.log('  clients        - Show connected clients', 'info');
              this.log('  demo           - Run full speech demo', 'info');
              this.log('  quit           - Exit demo', 'info');
              break;

            case 'quit':
            case 'exit':
              this.log('👋 Goodbye!', 'success');
              await this.cleanup();
              rl.close();
              process.exit(0);
              break;

            default:
              this.log(
                `Unknown command: ${command}. Type 'help' for available commands.`,
                'warning'
              );
          }
        } catch (error) {
          this.log(`Error: ${error.message}`, 'error');
        }

        askForCommand();
      });
    };

    askForCommand();
  }

  async speakText(text, options = {}) {
    if (!this.bridgeService) {
      this.log('Bridge service not started', 'error');
      return;
    }

    const success = this.bridgeService.sendTextToSpeech(text, {
      voice: options.voice || 'en-US',
      rate: options.rate || 1.0,
      pitch: options.pitch || 1.0,
    });

    if (success) {
      this.log(`🗣️ Agent speaking: "${text}"`, 'success');
    } else {
      this.log('❌ No clients connected to hear the agent speak', 'warning');
      this.log('   Connect a browser to ws://localhost:8888 first', 'info');
    }
  }

  async playBeep() {
    if (!this.bridgeService) {
      this.log('Bridge service not started', 'error');
      return;
    }

    const success = this.bridgeService.sendNotificationSound({
      type: 'beep',
      frequency: 800,
      duration: 300,
    });

    if (success) {
      this.log('🔔 Agent played beep sound', 'success');
    } else {
      this.log('❌ No clients connected to hear the beep', 'warning');
    }
  }

  async playChime() {
    if (!this.bridgeService) {
      this.log('Bridge service not started', 'error');
      return;
    }

    const success = this.bridgeService.sendNotificationSound({
      type: 'chime',
      frequency: 1200,
      duration: 500,
    });

    if (success) {
      this.log('🎵 Agent played chime sound', 'success');
    } else {
      this.log('❌ No clients connected to hear the chime', 'warning');
    }
  }

  showConnectedClients() {
    const clients = this.bridgeService?.getConnectedClients() || [];

    if (clients.length === 0) {
      this.log('📱 No clients currently connected', 'info');
      this.log('   To connect: Open browser and navigate to your frontend,', 'info');
      this.log('   then establish WebSocket connection to ws://localhost:8888', 'info');
    } else {
      this.log(`📱 Connected clients: ${clients.length}`, 'success');
      clients.forEach((clientId, index) => {
        this.log(`   ${index + 1}. Client ID: ${clientId}`, 'info');
      });
    }
  }

  async runSpeechDemo() {
    this.log('🎭 Running complete speech demonstration...', 'info');

    const demoScripts = [
      { type: 'speak', text: 'Hello! I am your ElizaOS agent.', delay: 2000 },
      {
        type: 'speak',
        text: 'I can now speak directly to you through your speakers.',
        delay: 3000,
      },
      { type: 'beep', delay: 1000 },
      {
        type: 'speak',
        text: 'I can also play notification sounds to get your attention.',
        delay: 3000,
      },
      { type: 'chime', delay: 1000 },
      {
        type: 'speak',
        text: 'This opens up many possibilities for interactive experiences.',
        delay: 3000,
      },
      {
        type: 'speak',
        text: 'I could read your messages aloud, provide audio feedback, or even tell stories!',
        delay: 4000,
      },
      { type: 'speak', text: 'The future of human-AI interaction is audio-visual!', delay: 3000 },
    ];

    for (const script of demoScripts) {
      if (script.type === 'speak') {
        await this.speakText(script.text);
      } else if (script.type === 'beep') {
        await this.playBeep();
      } else if (script.type === 'chime') {
        await this.playChime();
      }

      // Wait before next action
      await new Promise((resolve) => setTimeout(resolve, script.delay));
    }

    this.log('🎭 Demo completed!', 'success');
  }

  async cleanup() {
    if (this.bridgeService) {
      await this.bridgeService.stop();
      this.log('✅ Hardware Bridge Service stopped', 'success');
    }
  }
}

async function main() {
  const demo = new AgentSpeechDemo();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n');
    demo.log('🛑 Shutting down...', 'warning');
    await demo.cleanup();
    process.exit(0);
  });

  try {
    await demo.startDemo();
  } catch (error) {
    console.error(`\x1b[31m[AGENT-SPEECH] Fatal error: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { AgentSpeechDemo };
