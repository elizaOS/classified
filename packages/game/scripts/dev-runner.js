#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Ports we'll be using
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

/**
 * Check if a port is in use
 */
async function isPortInUse(port) {
  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Check if server is responding to health check
 */
async function isServerHealthy(port) {
  try {
    const response = await fetch(`http://localhost:${port}/api/server/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Start backend if not running
 */
async function startBackend() {
  console.log('🔍 Checking backend server...');
  
  const backendInUse = await isPortInUse(BACKEND_PORT);
  
  if (backendInUse) {
    console.log(`⚡ Port ${BACKEND_PORT} in use, checking if healthy...`);
    
    const isHealthy = await isServerHealthy(BACKEND_PORT);
    if (isHealthy) {
      console.log('✅ Backend server already running and healthy!');
      return null;
    } else {
      console.log('⚠️  Backend server on port but not healthy, killing and restarting...');
      try {
        await execAsync(`lsof -ti:${BACKEND_PORT} | xargs kill -9`);
        console.log('💀 Killed unhealthy backend process');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log('⚠️  Could not kill process, continuing...');
      }
    }
  }
  
  console.log('🚀 Starting backend server...');
  const backend = spawn('bun', ['run', 'src-backend/server.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });
  
  backend.stdout.on('data', (data) => {
    process.stdout.write(`[BACKEND] ${data}`);
  });
  
  backend.stderr.on('data', (data) => {
    process.stderr.write(`[BACKEND] ${data}`);
  });
  
  return backend;
}

/**
 * Start frontend if not running
 */
async function startFrontend() {
  console.log('🔍 Checking frontend server...');
  
  const frontendInUse = await isPortInUse(FRONTEND_PORT);
  
  if (frontendInUse) {
    console.log(`⚡ Port ${FRONTEND_PORT} in use, assuming frontend is running`);
    return null;
  }
  
  console.log('🚀 Starting frontend server...');
  const frontend = spawn('npm', ['run', 'dev:frontend'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });
  
  frontend.stdout.on('data', (data) => {
    process.stdout.write(`[FRONTEND] ${data}`);
  });
  
  frontend.stderr.on('data', (data) => {
    process.stderr.write(`[FRONTEND] ${data}`);
  });
  
  return frontend;
}

/**
 * Wait for services to be ready
 */
async function waitForServices() {
  console.log('⏳ Waiting for services to be ready...');
  
  let retries = 30;
  while (retries > 0) {
    const backendReady = await isServerHealthy(BACKEND_PORT);
    const frontendReady = await isPortInUse(FRONTEND_PORT);
    
    if (backendReady && frontendReady) {
      console.log('✅ Both services are ready!');
      console.log(`🌐 Frontend: http://localhost:${FRONTEND_PORT}`);
      console.log(`🔧 Backend:  http://localhost:${BACKEND_PORT}`);
      console.log(`📊 Health:   http://localhost:${BACKEND_PORT}/api/server/health`);
      return;
    }
    
    console.log(`⏳ Waiting for services... (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    retries--;
  }
  
  console.log('⚠️  Services did not start within timeout');
}

/**
 * Main execution
 */
async function main() {
  console.log('🎮 ELIZA Game Development Server');
  console.log('================================');
  
  try {
    // Start services
    const backend = await startBackend();
    const frontend = await startFrontend();
    
    // Wait for readiness
    await waitForServices();
    
    console.log('\\n🎯 Development environment ready!');
    console.log('Press Ctrl+C to stop all services');
    
    // Handle shutdown
    const cleanup = () => {
      console.log('\\n🛑 Shutting down services...');
      if (backend) backend.kill();
      if (frontend) frontend.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error starting development server:', error);
    process.exit(1);
  }
}

main().catch(console.error);