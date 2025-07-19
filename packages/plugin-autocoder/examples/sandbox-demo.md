# Sandbox Code Generation Demo

This demonstrates how the plugin-autocoder generates code inside an E2B sandbox.

## Example Flow

### 1. User Request

```
User: "Create a plugin that tracks user sentiment in conversations"
```

### 2. Agent Creates Form

The agent uses the Forms service to gather requirements:

```typescript
Form Created: Project Details
- Project Name: sentiment-tracker-plugin
- Type: plugin
- Description: Track and analyze user sentiment
- Requirements:
  - Analyze message sentiment (positive/negative/neutral)
  - Store sentiment history
  - Provide sentiment summaries
- APIs: None required
```

### 3. Sandbox Execution

The code generation happens inside an E2B sandbox:

```python
# Inside the sandbox (Python script)
os.environ['ANTHROPIC_API_KEY'] = 'sk-...'
os.chdir('/tmp/sentiment-tracker-plugin')

# Install Claude Code
subprocess.run(["npm", "install", "-g", "@anthropic-ai/claude-code"])

# Run Claude Code with the prompt
claude_args = [
    "claude",
    "--print",
    "--max-turns", "30",
    "--model", "opus",
    "--dangerously-skip-permissions",
    prompt
]
subprocess.run(claude_args)
```

### 4. Iterative Development

The system monitors and iterates:

```
=== ITERATION 1/10 ===
Running Claude Code...
Created: package.json, src/index.ts, README.md

=== ITERATION 2/10 ===
Running tests...
TEST_RESULT: false
Error: Cannot find module '@elizaos/core'
Fixing: Installing dependencies...

=== ITERATION 3/10 ===
Running tests...
TEST_RESULT: true
Running build...
BUILD_RESULT: true

=== PROJECT READY ===
All tests passing and build successful!
```

### 5. Generated Files

The sandbox returns all generated files:

```
📁 Generated Files:
- package.json (892 bytes)
- src/index.ts (1,245 bytes)
- src/actions/analyzeSentiment.ts (2,341 bytes)
- src/providers/sentimentProvider.ts (1,567 bytes)
- src/services/sentimentService.ts (3,892 bytes)
- src/__tests__/sentiment.test.ts (1,123 bytes)
- README.md (2,456 bytes)
- tsconfig.json (456 bytes)
```

### 6. Quality Checks

All code is validated before returning:

```
🧪 Quality Checks:
Tests: ✅ Pass
Build: ✅ Pass
Types: ✅ Pass
Lint: ✅ Pass
```

## Key Benefits

1. **Security** - Code generation is completely isolated
2. **Reliability** - Same environment every time
3. **Quality** - Automatic fixing of issues
4. **Completeness** - Always produces working code

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Request   │────▶│  ElizaOS Agent  │────▶│  E2B Sandbox    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                          │
                               │                          ▼
                        ┌──────▼────────┐         ┌───────────────┐
                        │ Forms Service │         │ Claude Code   │
                        └───────────────┘         └───────────────┘
                               │                          │
                               │                          ▼
                        ┌──────▼────────┐         ┌───────────────┐
                        │   Generate    │◀────────│ Test & Build  │
                        │   Response    │         └───────────────┘
                        └───────────────┘
```

## Try It Yourself

1. Set up your API keys:

   ```bash
   export ANTHROPIC_API_KEY=your_key
   export E2B_API_KEY=your_key
   ```

2. Run the verification:

   ```bash
   cd packages/plugin-autocoder
   bun run verify-sandbox
   ```

3. Or integrate with your agent and request code generation!
