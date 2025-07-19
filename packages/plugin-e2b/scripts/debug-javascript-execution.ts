import { elizaLogger } from '@elizaos/core';
import { E2BService } from '../src/services/E2BService.js';

// Debug what the JavaScript execution actually produces
async function debugJavaScriptExecution() {
  elizaLogger.info('🔍 Debugging JavaScript Execution');

  // Mock runtime
  const mockRuntime: any = {
    agentId: 'debug-agent-id',
    getSetting: (key: string) => {
      switch (key) {
        case 'E2B_API_KEY':
          return process.env.E2B_API_KEY || 'test-key';
        default:
          return process.env[key];
      }
    },
    getService: (name: string) => {
      if (name === 'e2b') {
        return new E2BService(mockRuntime);
      }
      return null;
    },
    logger: elizaLogger,
  };

  const e2bService = mockRuntime.getService('e2b');

  // Simple JavaScript test
  const simpleJsCode = `
console.log("Hello from JavaScript!");
console.log("Testing basic functionality");
const result = 2 + 2;
console.log("2 + 2 =", result);
`;

  try {
    elizaLogger.info('🧪 Testing simple JavaScript execution...');
    const result = await e2bService.executeCode(simpleJsCode, 'javascript');

    elizaLogger.info('📊 Execution Result:');
    elizaLogger.info('🔢 Text:', result.text);
    elizaLogger.info('📋 Stdout:', result.logs.stdout);
    elizaLogger.info('🚨 Stderr:', result.logs.stderr);
    elizaLogger.info('❌ Error:', result.error);

    if (result.logs.stdout.length > 0) {
      elizaLogger.info('✅ JavaScript execution produced output!');
    } else {
      elizaLogger.warn('⚠️ No stdout output from JavaScript execution');
    }
  } catch (error) {
    elizaLogger.error('❌ JavaScript execution failed:', error);
  }
}

// Run if executed directly
if (import.meta.main) {
  debugJavaScriptExecution()
    .then(() => {
      elizaLogger.info('🏁 Debug complete');
      process.exit(0);
    })
    .catch((error) => {
      elizaLogger.error('💥 Debug failed:', error);
      process.exit(1);
    });
}
