import { Sandbox } from '@e2b/code-interpreter';

console.log('Testing E2B API key...');
console.log('E2B_API_KEY exists:', !!process.env.E2B_API_KEY);
console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);

// Test E2B directly
try {
  console.log('E2B library imported successfully');

  // Test basic sandbox creation
  console.log('Testing E2B connectivity...');
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 10000,
  });

  console.log('✅ E2B sandbox created:', sandbox.sandboxId);

  const result = await sandbox.runCode('print("Hello from E2B!")');
  console.log('✅ Code execution result:', result.text);

  await sandbox.kill();
  console.log('✅ Sandbox cleaned up');

  console.log('🎉 E2B direct test passed!');
  process.exit(0);
} catch (error) {
  console.error('❌ E2B test failed:', error.message);
  process.exit(1);
}
