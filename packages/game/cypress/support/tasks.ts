import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
// OCR functionality - will try to import tesseract.js if available
let Tesseract: any = null;
try {
  Tesseract = require('tesseract.js');
} catch (error) {
  console.warn('Tesseract.js not available - OCR tests will be skipped');
}

export const cypressTasks = {
  /**
   * Clear environment variables that might interfere with testing
   */
  clearEnvironmentKeys: () => {
    // Clear test environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MODEL_PROVIDER;
    
    console.log('Cleared environment keys for testing');
    return null;
  },

  /**
   * Set test environment variables
   */
  setTestEnvironmentKeys: ({ openaiKey, anthropicKey, modelProvider }: {
    openaiKey?: string;
    anthropicKey?: string;
    modelProvider?: string;
  }) => {
    if (openaiKey) {
      process.env.OPENAI_API_KEY = openaiKey;
    }
    if (anthropicKey) {
      process.env.ANTHROPIC_API_KEY = anthropicKey;
    }
    if (modelProvider) {
      process.env.MODEL_PROVIDER = modelProvider;
    }
    
    console.log(`Set test environment keys: ${Object.keys({ openaiKey, anthropicKey, modelProvider }).filter(k => arguments[0][k]).join(', ')}`);
    return null;
  },

  /**
   * Check if the game server is running
   */
  checkServerRunning: async () => {
    try {
      const response = await fetch('http://localhost:7777/api/server/health');
      const result = await response.json();
      return {
        running: response.ok,
        status: result
      };
    } catch (error) {
      return {
        running: false,
        error: error.message
      };
    }
  },

  /**
   * Reset the game database for clean testing
   */
  resetGameDatabase: () => {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
        console.log('Reset game database directory');
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to reset database:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Wait for server to be ready
   */
  waitForServerReady: async (maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('http://localhost:7777/api/server/health');
        if (response.ok) {
          return { ready: true, attempts: i + 1 };
        }
      } catch (error) {
        // Server not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return { ready: false, attempts: maxAttempts };
  },

  /**
   * Get current configuration from the server
   */
  getCurrentConfiguration: async () => {
    try {
      const response = await fetch('http://localhost:7777/api/plugin-config');
      const result = await response.json();
      return {
        success: true,
        configuration: result.data?.configurations
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Directly test database connection
   */
  testDatabaseConnection: async () => {
    try {
      const response = await fetch('http://localhost:7777/api/debug/runtime-state');
      const result = await response.json();
      return {
        success: true,
        database: result.data?.database
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Send test message to agent and verify response
   */
  sendTestMessage: async ({ message, roomId }: { message: string; roomId?: string }) => {
    try {
      const response = await fetch('http://localhost:7777/api/messaging/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          roomId: roomId || 'test-room-id',
          userId: 'test-user-id'
        })
      });
      
      const result = await response.json();
      return {
        success: response.ok,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * OCR verification to ensure text is visible on screen
   */
  ocrVerifyText: async ({ screenshot, expectedTexts }: { 
    screenshot: string; 
    expectedTexts: string[] 
  }) => {
    if (!Tesseract) {
      console.log('Tesseract not available - skipping OCR verification');
      return {
        success: true,
        skipped: true,
        reason: 'Tesseract.js not available'
      };
    }

    try {
      const screenshotPath = path.join('cypress', 'screenshots', 'api-key-setup-comprehensive.cy.ts', `${screenshot}.png`);
      
      if (!fs.existsSync(screenshotPath)) {
        return {
          success: false,
          error: `Screenshot not found: ${screenshotPath}`
        };
      }

      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(screenshotPath);
      await worker.terminate();

      const foundTexts = expectedTexts.filter(expectedText => 
        text.toLowerCase().includes(expectedText.toLowerCase())
      );

      return {
        success: foundTexts.length > 0,
        extractedText: text,
        expectedTexts,
        foundTexts,
        allFound: foundTexts.length === expectedTexts.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * OCR verification to ensure sensitive text is NOT visible on screen
   */
  ocrVerifyTextNotPresent: async ({ screenshot, forbiddenTexts }: { 
    screenshot: string; 
    forbiddenTexts: string[] 
  }) => {
    if (!Tesseract) {
      console.log('Tesseract not available - skipping OCR verification');
      return {
        success: true,
        skipped: true,
        reason: 'Tesseract.js not available'
      };
    }

    try {
      const screenshotPath = path.join('cypress', 'screenshots', 'api-key-setup-comprehensive.cy.ts', `${screenshot}.png`);
      
      if (!fs.existsSync(screenshotPath)) {
        return {
          success: false,
          error: `Screenshot not found: ${screenshotPath}`
        };
      }

      const worker = await Tesseract.createWorker('eng');
      const { data: { text } } = await worker.recognize(screenshotPath);
      await worker.terminate();

      const foundForbiddenTexts = forbiddenTexts.filter(forbiddenText => 
        text.includes(forbiddenText)
      );

      return {
        success: foundForbiddenTexts.length === 0,
        extractedText: text,
        forbiddenTexts,
        foundForbiddenTexts
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Test agent memory functionality
   */
  testAgentMemory: async ({ roomId }: { roomId: string }) => {
    try {
      const response = await fetch(`http://localhost:7777/api/memories?roomId=${roomId}&count=10`);
      const result = await response.json();
      
      return {
        success: response.ok,
        memories: result.data || [],
        count: result.data?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Test autonomy service functionality
   */
  testAutonomyService: async () => {
    try {
      const statusResponse = await fetch('http://localhost:7777/autonomy/status');
      const statusResult = await statusResponse.json();
      
      return {
        success: statusResponse.ok,
        autonomyStatus: statusResult.data,
        serviceAvailable: statusResult.success
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Enable autonomy for testing
   */
  enableAutonomy: async () => {
    try {
      const response = await fetch('http://localhost:7777/autonomy/enable', {
        method: 'POST'
      });
      const result = await response.json();
      
      return {
        success: response.ok,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Disable autonomy for testing
   */
  disableAutonomy: async () => {
    try {
      const response = await fetch('http://localhost:7777/autonomy/disable', {
        method: 'POST'
      });
      const result = await response.json();
      
      return {
        success: response.ok,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Clean up screenshots after tests
   */
  cleanupScreenshots: () => {
    try {
      const screenshotsDir = path.join('cypress', 'screenshots');
      if (fs.existsSync(screenshotsDir)) {
        fs.rmSync(screenshotsDir, { recursive: true, force: true });
        console.log('Cleaned up test screenshots');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Log system information for debugging
   */
  logSystemInfo: () => {
    const info = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      env: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
        modelProvider: process.env.MODEL_PROVIDER || 'not set'
      }
    };
    
    console.log('System info:', info);
    return info;
  }
};

export default cypressTasks;