import { defineConfig } from 'cypress';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { cypressTasks } from './cypress/support/tasks';

const execAsync = promisify(exec);

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 30000,
  requestTimeout: 30000,
  responseTimeout: 30000,
  pageLoadTimeout: 60000,
  retries: {
    runMode: 2,
    openMode: 0
  },
  
  e2e: {
    // Support dynamic baseUrl from environment variables
    baseUrl: process.env.CYPRESS_FRONTEND_URL || process.env.FRONTEND_URL || `http://localhost:${process.env.FRONTEND_PORT || '5173'}`,
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Add file system and process tasks
      on('task', {
        fileExists(filename: string) {
          return existsSync(filename);
        },
        
        log(message: string) {
          console.log(message);
          return null;
        },
        
        async killProcessByPort(port: number) {
          try {
            // Kill process on macOS/Linux
            await execAsync(`lsof -ti:${port} | xargs kill -9`).catch(() => {
              // Ignore errors - process might not exist
            });
            return null;
          } catch (error) {
            console.log(`Could not kill process on port ${port}:`, error);
            return null;
          }
        },
        
        async startBackendServer() {
          try {
            // Start the backend server in background
            const process = exec('cd packages/game && npm run dev:backend');
            return { success: true, pid: process.pid };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        
        // Add all our custom tasks for API key testing
        ...cypressTasks
      });
    },
  },
}); 