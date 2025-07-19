console.log('Testing E2B API key...');
console.log('E2B_API_KEY exists:', !!process.env.E2B_API_KEY);
console.log('GITHUB_TOKEN exists:', !!process.env.GITHUB_TOKEN);

// Test E2B directly
try {
  const { Sandbox } = require('@e2b/code-interpreter');
  console.log('E2B library imported successfully');

  // Test basic sandbox creation
  console.log('Testing E2B connectivity...');
  Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 10000,
  })
    .then((sandbox) => {
      console.log('✅ E2B sandbox created:', sandbox.sandboxId);
      return sandbox
        .runCode('print("Hello from E2B!")')
        .then((result) => {
          console.log('✅ Code execution result:', result.text);
          return sandbox.kill();
        })
        .then(() => {
          console.log('✅ Sandbox cleaned up');
          process.exit(0);
        });
    })
    .catch((error) => {
      console.error('❌ E2B test failed:', error.message);
      process.exit(1);
    });
} catch (error) {
  console.error('❌ E2B import failed:', error.message);
  process.exit(1);
}
