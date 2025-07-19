import { Sandbox } from '@e2b/code-interpreter';

console.log('Testing E2B in local mode...');

// Test E2B without API key (local mode)
try {
  console.log('Testing E2B local connectivity...');
  const sandbox = await Sandbox.create({
    timeoutMs: 10000,
  });

  console.log('✅ E2B sandbox created in local mode:', sandbox.sandboxId);

  const result = await sandbox.runCode('print("Hello from local E2B!")');
  console.log('✅ Code execution result:', result.text);

  // Test more complex code
  const mathResult = await sandbox.runCode(`
import math
result = math.sqrt(16) + math.pi
print(f"Math result: {result:.2f}")
result
`);
  console.log('✅ Math execution result:', mathResult.text);

  await sandbox.kill();
  console.log('✅ Sandbox cleaned up');

  console.log('🎉 E2B local test passed!');
  process.exit(0);
} catch (error) {
  console.error('❌ E2B local test failed:', error.message);
  console.error('Stack:', error.stack?.split('\n').slice(0, 5));
  process.exit(1);
}
