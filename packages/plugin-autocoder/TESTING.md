# Testing Sandbox-based Claude Code Generation

This guide explains how to verify that the sandbox-based Claude Code generation
is working correctly.

## Prerequisites

You need the following API keys:

- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude
- `E2B_API_KEY` - Your E2B API key for sandbox creation

## Running the Verification Test

1. First, ensure you have built the package:

   ```bash
   bun run build
   ```

2. Run the verification script with your API keys:

   ```bash
   ANTHROPIC_API_KEY=your_anthropic_key E2B_API_KEY=your_e2b_key node scripts/verify-sandbox.js
   ```

   Or use the npm script:

   ```bash
   ANTHROPIC_API_KEY=your_anthropic_key E2B_API_KEY=your_e2b_key bun run verify-sandbox
   ```

## What the Test Does

The verification script:

1. **Creates an E2B sandbox** - A secure Node.js environment
2. **Installs Claude Code inside the sandbox** - Using npm install
3. **Runs Claude Code iteratively** - Generates a simple hello plugin
4. **Monitors progress** - Runs tests and builds after each iteration
5. **Extracts generated files** - Returns all created files
6. **Validates the output** - Ensures tests pass and build succeeds

## Expected Output

A successful test will show:

- ✅ API keys configured
- ✅ E2B service started
- ✅ Code generation successful
- Files created (usually 5-10 files)
- Tests pass: ✅
- Build pass: ✅

## Troubleshooting

### Missing API Keys

If you see "Missing required environment variables", ensure both API keys are
set.

### Build Errors

If the build fails, run `bun run build` first.

### Timeout Errors

The generation can take 2-5 minutes. If it times out, the script will retry
automatically.

### Claude Code Installation Failed

This might happen if npm is having issues in the sandbox. The script will retry.

## How It Works

The key innovation is that Claude Code runs **inside the E2B sandbox**, not on
your local machine:

```python
# Inside the sandbox
os.environ['ANTHROPIC_API_KEY'] = 'your_key'
subprocess.run(["npm", "install", "-g", "@anthropic-ai/claude-code"])
subprocess.run(["claude", "--print", "--max-turns", "30", prompt])
```

This provides:

- **Security** - Code generation is isolated
- **Consistency** - Same environment every time
- **Monitoring** - Can track progress and fix issues
- **Iteration** - Automatically fixes failing tests

## Next Steps

Once verified, you can use the full code generation action in your agent:

- Request code generation through the chat interface
- The agent will create a form to gather requirements
- Generation happens inside the sandbox
- Results are returned with all files and test status
