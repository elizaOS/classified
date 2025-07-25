#!/usr/bin/env node

import { program } from 'commander';
import { GameLauncher } from './GameLauncher.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// CLI setup
program
  .name('launch-game')
  .description('Launch the ELIZA game with optional containerization')
  .version('1.0.0');

program
  .option('-c, --container', 'Run the agent in a container (sandbox mode)', false)
  .option('-p, --port <number>', 'Port to run the agent on', '7777')
  .option('-d, --data-volume <path>', 'Path for persistent data storage (container mode only)')
  .option('--env <key=value...>', 'Additional environment variables')
  .parse();

const options = program.opts();

// Parse additional environment variables
const additionalEnv: Record<string, string> = {};
if (options.env) {
  for (const envVar of options.env) {
    const [key, value] = envVar.split('=', 2);
    if (key && value) {
      additionalEnv[key] = value;
    }
  }
}

// Launch configuration
const launcherOptions = {
  useContainer: options.container,
  port: parseInt(options.port, 10),
  dataVolume: options.dataVolume,
  environment: {
    ...additionalEnv,
    // Ensure required API keys are passed through
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    // Add other necessary environment variables
  },
};

async function main() {
  console.log('🎮 ELIZA Game Launcher');
  console.log('=======================');

  if (launcherOptions.useContainer) {
    console.log('🐳 Container mode: ENABLED');
    console.log('   - Agent will run in isolated sandbox');
    console.log('   - Requires Podman or Docker');
    console.log('   - Auto-installation available');
  } else {
    console.log('🔧 Direct mode: ENABLED');
    console.log('   - Agent runs directly on host');
    console.log('   - Faster startup, no isolation');
  }

  console.log(`🌐 Port: ${launcherOptions.port}`);

  if (launcherOptions.dataVolume) {
    console.log(`💾 Data volume: ${launcherOptions.dataVolume}`);
  }

  console.log('');

  try {
    const launcher = new GameLauncher(launcherOptions);

    // Set up graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down...');
      await launcher.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Initialize and start
    await launcher.initialize();
    await launcher.start();

    // Show status
    const status = await launcher.getStatus();
    console.log('\n📊 Status:', JSON.stringify(status, null, 2));

    if (launcherOptions.useContainer) {
      console.log('\n🔧 Container commands:');
      console.log('   View logs: docker/podman logs eliza-agent');
      console.log('   Connect:   docker/podman exec -it eliza-agent /bin/bash');
    }

    console.log('\n✅ Game is running! Press Ctrl+C to stop.');

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ Failed to start game:', error.message);

    if (error.message.includes('container runtime')) {
      console.log('\n💡 Suggestions:');
      console.log('   - Install Podman Desktop: https://podman-desktop.io/downloads');
      console.log('   - Or run without containers: launch-game (no -c flag)');
    }

    process.exit(1);
  }
}

main().catch(console.error);
