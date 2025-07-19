# Interactive Claude Code Sandbox Test

This interactive test allows you to send commands and receive outputs from Claude Code in a live sandbox environment.

## Prerequisites

### Required Environment Variables
- `ANTHROPIC_API_KEY` - Your Anthropic API key for Claude Code

### Optional Environment Variables
- `E2B_API_KEY` - For real E2B sandbox (otherwise uses mock)
- `GITHUB_TOKEN` - For GitHub integration features

## Installation

1. Build the plugin:
```bash
cd packages/plugin-autocoder
bun run build
```

2. Run the interactive test:
```bash
bun run test:interactive
```

## Usage

The interactive test provides a command-line interface where you can:

### Direct Claude Code Interaction
```bash
🤖 Claude Code > claude Create a simple calculator function in TypeScript
```

### Project Generation
```bash
🤖 Claude Code > generate A weather plugin that fetches data from OpenWeatherMap
```

### Sandbox Commands
```bash
🤖 Claude Code > run npm install
🤖 Claude Code > run ls -la
🤖 Claude Code > run cat package.json
```

### File Operations
```bash
🤖 Claude Code > write package.json {"name": "test", "version": "1.0.0"}
🤖 Claude Code > read package.json
🤖 Claude Code > ls src/
```

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show help message | `help` |
| `status` | Show session status | `status` |
| `claude <prompt>` | Send direct prompt to Claude Code | `claude Write a TypeScript function` |
| `generate <description>` | Generate complete project | `generate A todo list API` |
| `run <command>` | Run command in sandbox | `run npm test` |
| `write <file> <content>` | Write file to sandbox | `write src/index.ts console.log('hello')` |
| `read <file>` | Read file from sandbox | `read src/index.ts` |
| `ls [path]` | List files in sandbox | `ls src/` |
| `clear` | Clear terminal | `clear` |
| `exit` | Exit test session | `exit` |

## Features

### Real-time Claude Code Integration
- Direct access to Claude Code SDK
- Real-time response streaming
- Error handling and timeout management

### Live Sandbox Environment
- Real E2B sandbox (if API key provided)
- Mock sandbox for testing without E2B
- File operations (read, write, list)
- Command execution with stdout/stderr capture

### Project Generation
- Complete project scaffolding
- ElizaOS plugin and agent generation
- Quality assurance workflow
- Iterative development with validation

### Session Management
- Persistent session state
- Project tracking
- Sandbox lifecycle management
- Graceful cleanup on exit

## Example Session

```bash
🚀 Interactive Claude Code Sandbox Test
=====================================

📋 Environment Status:
   ✅ ANTHROPIC_API_KEY
   ✅ E2B_API_KEY
   ❌ GITHUB_TOKEN

🏗️  E2B sandbox created: sbx_abc123
✅ Services initialized successfully!

🤖 Claude Code > claude Create a simple TypeScript function that adds two numbers

🧠 Sending to Claude Code...
📝 Prompt: Create a simple TypeScript function that adds two numbers

✅ Claude Code Response (1250ms):
──────────────────────────────────────────────────
Here's a simple TypeScript function that adds two numbers:

```typescript
function add(a: number, b: number): number {
  return a + b;
}

// Example usage:
const result = add(5, 3);
console.log(result); // Output: 8
```

This function:
- Takes two parameters `a` and `b` of type `number`
- Returns their sum as a `number`
- Has explicit type annotations for clarity
──────────────────────────────────────────────────

🤖 Claude Code > write src/math.ts function add(a: number, b: number): number { return a + b; }

📝 Writing file: src/math.ts
✅ File written successfully

🤖 Claude Code > read src/math.ts

📖 Reading file: src/math.ts
──────────────────────────────────────────────────
function add(a: number, b: number): number { return a + b; }
──────────────────────────────────────────────────

🤖 Claude Code > generate A simple calculator plugin for ElizaOS

🚀 Generating project...
📝 Description: A simple calculator plugin for ElizaOS

✅ Project Generated (3420ms):
──────────────────────────────────────────────────
📁 Project: generated-project-1752037891234
✅ Success: true
📄 Files generated: 8
   - package.json
   - tsconfig.json
   - src/index.ts
   - src/actions/calculator.ts
   - src/providers/math.ts
   - README.md
   - .gitignore
   - build.ts
──────────────────────────────────────────────────

🤖 Claude Code > exit

🧹 Cleaning up...
✅ Sandbox cleaned up
✅ Code generation service stopped
👋 Goodbye!
```

## Troubleshooting

### Common Issues

1. **Missing API Key**
   ```
   ❌ Missing required environment variables:
      - ANTHROPIC_API_KEY
   ```
   Solution: Set your Anthropic API key in your environment

2. **E2B Connection Failed**
   ```
   ⚠️  E2B service failed, using mock: Connection timeout
   ```
   Solution: This is expected without E2B_API_KEY. Mock sandbox will be used.

3. **Command Not Found**
   ```
   ❌ Unknown command: xyz
   ```
   Solution: Type `help` to see available commands

### Debug Mode

To run with debug output:
```bash
DEBUG=1 bun run test:interactive
```

### Manual Execution

You can also run the test directly:
```bash
bun run src/interactive-test.ts
```

## Development

The interactive test is built on top of:
- `@anthropic-ai/claude-code` - Claude Code SDK
- `CodeGenerationService` - Project generation logic
- `E2BService` - Sandbox management
- Node.js `readline` - Interactive terminal interface

To modify the test, edit `src/interactive-test.ts` and rebuild:
```bash
bun run build
```

## Next Steps

After testing, you can:
1. Use the generated projects as starting points
2. Modify the code generation prompts
3. Add custom project templates
4. Integrate with CI/CD pipelines
5. Create custom commands for specific workflows