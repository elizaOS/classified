# Autocoder Plugin Examples

This directory contains examples and utilities for using the Autocoder plugin in your ElizaOS agents.

## 🚀 Quick Start

### 1. Verify Plugin Configuration

First, ensure the plugin is properly configured:

```bash
bun run examples/verify-autocoder.ts
```

This will check:
- API key availability
- Plugin structure and components
- Available actions and providers
- Dependencies

### 2. Example Agent Configuration

See `autocoder-agent-config.ts` for a complete example of how to configure an agent with autocoder capabilities:

```typescript
import { autocoderAgent } from './examples/autocoder-agent-config';
```

The example includes:
- Character personality optimized for code generation
- Example conversations showing how the agent responds
- Required plugins and dependencies
- Proper system prompts for code generation

### 3. Test the Plugin

To test the plugin in a runtime environment:

```bash
bun run examples/test-autocoder.ts
```

**Note**: This requires database setup. For a simpler verification, use `verify-autocoder.ts`.

## 📋 Usage Examples

### Creating a Plugin

```
User: "Create a plugin that sends email notifications"

Agent: I'll create an email notification plugin for you...
[Searches registry, generates PRD, creates code]
```

### Building an Agent

```
User: "Build an agent that monitors RSS feeds"

Agent: I'll help you create an RSS monitoring agent...
[Analyzes requirements, checks existing solutions, generates agent code]
```

### Generating a Workflow

```
User: "Generate a workflow for processing customer data"

Agent: I'll create a data processing workflow for you...
[Creates workflow with proper error handling and validation]
```

## 🔧 Configuration Requirements

### Required Environment Variables

At least one LLM provider:
- `OPENAI_API_KEY` - For OpenAI models
- `ANTHROPIC_API_KEY` - For Claude models

### Required Plugins

The autocoder plugin depends on:
1. `@elizaos/plugin-sql` - Database functionality
2. `@elizaos/plugin-forms` - Interactive forms for project planning
3. A model provider plugin (OpenAI, Anthropic, etc.)

### Example .env

```bash
# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: For generated projects
GITHUB_TOKEN=ghp_...
DISCORD_BOT_TOKEN=...
# Add other API keys as needed
```

## 🎯 Action Commands

### GENERATE_CODE

Triggers code generation for various project types.

**Aliases**: BUILD_CODE, CREATE_CODE, WRITE_CODE, DEVELOP_CODE, IMPLEMENT_CODE

**Examples**:
- "Generate code for a Twitter bot"
- "Create a plugin that integrates with Slack"
- "Build an agent for customer support"

### CREATE_PROJECT

Starts an interactive project creation process with forms.

**Aliases**: BUILD_PROJECT, CREATE_PLUGIN, CREATE_AGENT, NEW_PROJECT

**Examples**:
- "Create a new project"
- "I want to build a plugin"
- "Start a new agent project"

## 📊 Providers

### PROJECTS_CONTEXT

Provides information about all projects:
- Active projects in progress
- Completed projects
- Failed projects with error details

### CURRENT_PROJECT_CONTEXT

Provides details about the project being generated:
- File structure
- Line counts
- Current generation status

## 🏗️ Project Structure

Generated projects are saved to `./generated-plugins/` with the following structure:

```
generated-plugins/
├── project-name/
│   ├── src/
│   │   ├── index.ts
│   │   ├── actions/
│   │   ├── providers/
│   │   ├── services/
│   │   └── __tests__/
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── .gitignore
```

## 🧪 Testing Generated Code

The autocoder automatically:
1. Runs linting checks
2. Performs type checking
3. Executes tests
4. Validates the build

Failed validations are automatically fixed when possible.

## 🤝 Contributing

To add new examples:
1. Create a new TypeScript file in this directory
2. Include clear documentation
3. Test with both OpenAI and Anthropic providers
4. Update this README

## 📚 Additional Resources

- [Autocoder Plugin Documentation](../README.md)
- [ElizaOS Documentation](https://elizaos.github.io/eliza/)
- [Plugin Development Guide](https://elizaos.github.io/eliza/docs/plugins/)