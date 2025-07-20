# Random Ports Solution for ELIZA Game Testing

## Problem Solved

Previously, multiple agent instances and test runs would conflict because they all tried to use the same hardcoded ports:
- **Frontend**: Always port 5173 (Vite default)
- **Backend**: Always port 7777 (ElizaOS default)

This caused "port already in use" errors when running multiple instances or parallel tests.

## Solution Overview

We've implemented a comprehensive **Environment Variable + Random Port** system that:

1. **Supports configurable ports** via environment variables
2. **Automatically generates random available ports** for test runs
3. **Maintains backwards compatibility** with existing hardcoded defaults
4. **Provides port isolation** between multiple test instances

## Environment Variables

### Backend Port Configuration
```bash
PORT=7777                    # Primary backend port (ElizaOS standard)
SERVER_PORT=7777            # Alternative name (MessageBus compatibility)
```

### Frontend Port Configuration  
```bash
FRONTEND_PORT=5173          # Vite development server port
```

### Test Environment Variables
```bash
CYPRESS_BACKEND_URL=http://localhost:7777    # Direct Cypress backend URL
CYPRESS_FRONTEND_URL=http://localhost:5173   # Direct Cypress frontend URL
VITE_BACKEND_URL=http://localhost:7777       # Frontend API configuration
VITE_BACKEND_PORT=7777                       # Alternative backend port for frontend
```

## Files Modified/Created

### 1. Backend Port Configuration
- **`src-backend/server.ts`**: Now uses `parseInt(process.env.PORT || process.env.SERVER_PORT || '7777')`
- **`scripts/test-runner.js`**: Updated to use environment variables and pass ports to processes

### 2. Frontend Port Configuration
- **`vite.config.ts`**: NEW - Configures Vite to use `FRONTEND_PORT` environment variable
- **`src/components/GameInterface.tsx`**: Uses `import.meta.env.VITE_BACKEND_URL` for API calls
- **`package.json`**: Added new scripts for random port testing

### 3. Random Port System
- **`scripts/port-utils.js`**: NEW - Port management utilities with random generation
- **`scripts/test-runner-random-ports.js`**: NEW - Enhanced test runner with random ports

### 4. Cypress Integration
- **`cypress.config.ts`**: Supports dynamic `baseUrl` from environment variables
- **`cypress/support/commands.ts`**: NEW - Custom commands for random port testing
- **`cypress/e2e/random-port-demo.cy.ts`**: NEW - Demonstration test for random ports

## Usage Examples

### 1. Manual Port Configuration
```bash
# Set specific ports
export PORT=8888
export FRONTEND_PORT=3000

# Start with custom ports
npm run dev:backend    # Uses port 8888
npm run dev:frontend   # Uses port 3000
```

### 2. Random Port Testing
```bash
# Run tests with automatically generated random ports
npm run test:random-ports

# Run specific test with random ports
npm run test:random-ports cypress/e2e/specific-test.cy.ts
```

### 3. Multiple Parallel Instances
```bash
# Terminal 1 - First instance
PORT=7001 FRONTEND_PORT=5001 npm run dev

# Terminal 2 - Second instance  
PORT=7002 FRONTEND_PORT=5002 npm run dev

# Terminal 3 - Third instance
PORT=7003 FRONTEND_PORT=5003 npm run dev
```

## Random Port Generator

The `PortManager` class provides:

### Core Functions
```javascript
const portManager = new PortManager();

// Get single random available port
const port = await portManager.getAvailablePort(3000, 9999);

// Get pair of ports (backend + frontend)
const { backendPort, frontendPort } = await portManager.getPortPair();

// Clear ports of any running processes
await portManager.clearPorts([7777, 5173]);

// Check if port is available
const available = await portManager.isPortAvailable(8080);
```

### Test Configuration Generator
```javascript
import { generateTestConfig } from './scripts/port-utils.js';

const config = await generateTestConfig();
// Returns: { backendPort, frontendPort, env, portManager }
```

## Test Architecture

### Traditional Testing (Fixed Ports)
```bash
npm run test:cypress     # Uses hardcoded ports 7777/5173
```

### Random Port Testing
```bash
npm run test:random-ports    # Generates random ports automatically
```

### How Random Port Tests Work
1. **Port Generation**: Automatically find 2 available random ports
2. **Environment Setup**: Set all necessary environment variables
3. **Server Startup**: Start backend and frontend with assigned ports
4. **Test Execution**: Run Cypress with dynamic configuration
5. **Cleanup**: Kill processes and release ports

## Port Ranges

- **Backend Ports**: 7000-7999 (to stay close to ElizaOS default)
- **Frontend Ports**: 5000-5999 (to stay close to Vite default)
- **Separation**: Ensures backend and frontend never get the same port

## Backwards Compatibility

All existing functionality continues to work:

```bash
# These still work exactly as before
npm run dev              # Uses 7777 and 5173
npm run dev:backend     # Uses 7777
npm run dev:frontend    # Uses 5173
npm run test:cypress    # Uses 5173 for frontend
```

## Benefits

### ✅ **Parallel Testing**
- Run multiple test suites simultaneously without conflicts
- Each test run gets its own isolated ports

### ✅ **Development Flexibility** 
- Developers can run multiple instances for different features
- No more "port already in use" errors

### ✅ **CI/CD Friendly**
- Test runners can spawn multiple parallel jobs safely
- Each job gets unique ports automatically

### ✅ **Debugging Support**
- Port numbers are logged clearly in all outputs
- Easy to track which instance is using which ports

## Example: Running 3 Parallel Tests

```bash
# Terminal 1
npm run test:random-ports cypress/e2e/chat-tests.cy.ts
# Gets ports: Backend=7234, Frontend=5891

# Terminal 2  
npm run test:random-ports cypress/e2e/goals-tests.cy.ts
# Gets ports: Backend=7456, Frontend=5234

# Terminal 3
npm run test:random-ports cypress/e2e/config-tests.cy.ts  
# Gets ports: Backend=7789, Frontend=5567
```

All three run simultaneously without conflicts!

## Troubleshooting

### Port Still In Use?
```bash
# Check what's using a port
lsof -ti:7777

# Kill process on port
npm run port-utils clear 7777

# Generate fresh ports
npm run port-utils generate
```

### Environment Variables Not Working?
```bash
# Check current environment
echo $PORT $FRONTEND_PORT

# Test port generation
cd packages/game
node scripts/port-utils.js generate
```

### Cypress Not Finding Backend?
Check the environment variables are passed correctly:
```bash
export CYPRESS_BACKEND_URL=http://localhost:8888
npm run test:cypress
```

## Summary

This solution completely eliminates port conflicts while maintaining full backwards compatibility. The random port system enables true parallel testing and development, making the ELIZA game development experience much smoother for teams and CI/CD systems.