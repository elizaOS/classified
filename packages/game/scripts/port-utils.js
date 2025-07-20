#!/usr/bin/env node

/**
 * Utility functions for managing random ports in tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PortManager {
  constructor() {
    this.usedPorts = new Set();
  }

  /**
   * Generate a random port number in the specified range
   * @param {number} min - Minimum port number (default: 3000)
   * @param {number} max - Maximum port number (default: 9999)
   * @returns {number} A random port number
   */
  generateRandomPort(min = 3000, max = 9999) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Check if a port is available on the system
   * @param {number} port - Port number to check
   * @returns {Promise<boolean>} True if port is available
   */
  async isPortAvailable(port) {
    try {
      // Use lsof to check if port is in use (macOS/Linux)
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      return stdout.trim() === ''; // Empty output means port is available
    } catch (error) {
      // lsof returns non-zero exit code if no process found (port available)
      return true;
    }
  }

  /**
   * Get an available random port
   * @param {number} min - Minimum port number
   * @param {number} max - Maximum port number
   * @param {number} maxAttempts - Maximum attempts to find available port
   * @returns {Promise<number>} An available port number
   */
  async getAvailablePort(min = 3000, max = 9999, maxAttempts = 50) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const port = this.generateRandomPort(min, max);
      
      // Skip if we've already used this port in this session
      if (this.usedPorts.has(port)) {
        continue;
      }

      // Check if port is available on the system
      if (await this.isPortAvailable(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }

    throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
  }

  /**
   * Get a pair of random ports (backend and frontend)
   * Ensures they are different and both available
   * @returns {Promise<{backendPort: number, frontendPort: number}>}
   */
  async getPortPair() {
    const backendPort = await this.getAvailablePort(7000, 7999);
    
    // Get frontend port in different range to avoid conflicts
    let frontendPort;
    let attempts = 0;
    do {
      frontendPort = await this.getAvailablePort(5000, 5999);
      attempts++;
      if (attempts > 20) {
        throw new Error('Could not find suitable frontend port');
      }
    } while (frontendPort === backendPort);

    console.log(`[PORT-MANAGER] Allocated ports: Backend=${backendPort}, Frontend=${frontendPort}`);
    
    return { backendPort, frontendPort };
  }

  /**
   * Kill any processes using the specified ports
   * @param {number[]} ports - Array of port numbers to clear
   */
  async clearPorts(ports) {
    console.log(`[PORT-MANAGER] Clearing ports: ${ports.join(', ')}`);
    
    for (const port of ports) {
      try {
        await execAsync(`lsof -ti:${port} | xargs kill -9`);
        console.log(`[PORT-MANAGER] Cleared port ${port}`);
      } catch (error) {
        // Ignore errors - port might not be in use
        console.log(`[PORT-MANAGER] Port ${port} was not in use`);
      }
    }

    // Wait for processes to die
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Release a port from the used ports set
   * @param {number} port - Port to release
   */
  releasePort(port) {
    this.usedPorts.delete(port);
    console.log(`[PORT-MANAGER] Released port ${port}`);
  }

  /**
   * Get current used ports
   * @returns {Set<number>} Set of used port numbers
   */
  getUsedPorts() {
    return new Set(this.usedPorts);
  }
}

/**
 * Generate test configuration with random ports
 * @returns {Promise<{backendPort: number, frontendPort: number, env: object}>}
 */
export async function generateTestConfig() {
  const portManager = new PortManager();
  const { backendPort, frontendPort } = await portManager.getPortPair();
  
  // Create environment variables for the test run
  const env = {
    ...process.env,
    PORT: backendPort.toString(),
    SERVER_PORT: backendPort.toString(), 
    FRONTEND_PORT: frontendPort.toString(),
    NODE_ENV: 'test',
    CYPRESS_BACKEND_URL: `http://localhost:${backendPort}`,
    CYPRESS_FRONTEND_URL: `http://localhost:${frontendPort}`,
    // Disable some features for testing stability
    DISABLE_WEBSOCKET: 'true',
    SKIP_BOOT: 'true'
  };

  return {
    backendPort,
    frontendPort,
    env,
    portManager
  };
}

// CLI interface for manual testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'generate') {
    const config = await generateTestConfig();
    console.log('Generated test configuration:');
    console.log(`Backend Port: ${config.backendPort}`);
    console.log(`Frontend Port: ${config.frontendPort}`);
    console.log('Environment variables:');
    console.log(`PORT=${config.backendPort}`);
    console.log(`FRONTEND_PORT=${config.frontendPort}`);
  } else if (command === 'check') {
    const port = parseInt(process.argv[3]);
    if (!port) {
      console.error('Please provide a port number to check');
      process.exit(1);
    }
    
    const portManager = new PortManager();
    const available = await portManager.isPortAvailable(port);
    console.log(`Port ${port} is ${available ? 'available' : 'in use'}`);
  } else if (command === 'clear') {
    const ports = process.argv.slice(3).map(p => parseInt(p)).filter(p => !isNaN(p));
    if (ports.length === 0) {
      console.error('Please provide port numbers to clear');
      process.exit(1);
    }
    
    const portManager = new PortManager();
    await portManager.clearPorts(ports);
    console.log(`Cleared ports: ${ports.join(', ')}`);
  } else {
    console.log('Usage:');
    console.log('  node port-utils.js generate    - Generate random test configuration');
    console.log('  node port-utils.js check <port> - Check if port is available');
    console.log('  node port-utils.js clear <port1> <port2> ... - Clear specified ports');
  }
}

export default PortManager;