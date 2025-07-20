#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Kill processes on specific ports
 */
async function killPortProcesses(ports) {
  for (const port of ports) {
    try {
      console.log(`🔍 Checking port ${port}...`);
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      
      if (stdout.trim()) {
        console.log(`💀 Killing processes on port ${port}...`);
        await execAsync(`lsof -ti:${port} | xargs kill -9`);
        console.log(`✅ Port ${port} cleared`);
      } else {
        console.log(`✅ Port ${port} already free`);
      }
    } catch (error) {
      console.log(`✅ Port ${port} free (no processes found)`);
    }
  }
}

/**
 * Kill ElizaOS related processes
 */
async function killElizaProcesses() {
  const patterns = [
    'src-backend/server.ts',
    'bun.*server.ts',
    'vite.*dev',
    'cypress'
  ];
  
  for (const pattern of patterns) {
    try {
      console.log(`🔍 Looking for processes matching: ${pattern}`);
      const { stdout } = await execAsync(`pgrep -f "${pattern}"`);
      
      if (stdout.trim()) {
        console.log(`💀 Killing ${pattern} processes...`);
        await execAsync(`pkill -f "${pattern}"`);
        console.log(`✅ ${pattern} processes killed`);
      }
    } catch (error) {
      // No processes found, which is fine
      console.log(`✅ No ${pattern} processes found`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🧹 ELIZA Process Cleaner');
  console.log('========================');
  
  try {
    // Kill by port
    await killPortProcesses([3000, 5173, 5174]);
    
    // Kill by process name
    await killElizaProcesses();
    
    // Wait a moment for cleanup
    console.log('⏳ Waiting for cleanup...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

main().catch(console.error);