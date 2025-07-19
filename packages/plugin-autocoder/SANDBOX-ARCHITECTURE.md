# Sandbox-Based Code Generation Architecture

## Overview

The plugin-autocoder is designed to run Claude Code **entirely inside E2B
sandboxes**, ensuring security, isolation, and reproducibility. Claude Code is
never executed on the host machine.

## Key Principles

1. **Complete Isolation**: All code generation happens inside E2B sandboxes
2. **No Local Dependencies**: Users don't need Claude Code installed locally
3. **Secure Execution**: API keys and code execution are isolated in the sandbox
4. **Iterative Development**: The system automatically runs tests and fixes
   errors

## Architecture Flow

```
User Request → Forms Service → Code Generation Service → E2B Sandbox
                                                              ↓
                                                     Install Claude Code
                                                              ↓
                                                     Run Claude Code
                                                              ↓
                                                     Monitor Progress
                                                              ↓
                                                     Test & Build
                                                              ↓
                                                     Fix Errors (loop)
                                                              ↓
                                                     Extract Files
                                                              ↓
                                                     Return Results
```

## Key Components

### 1. CodeGenerationService

The main service orchestrates the entire code generation process:

- **`generateCodeInternal()`**: Main method that creates sandbox and manages
  generation
- **`installClaudeCodeInSandbox()`**: Installs Claude Code inside the sandbox
  using npm
- **`runClaudeCodeInSandbox()`**: Executes Claude Code with continuous
  monitoring
- **`generateWithClaudeCodeInSandbox()`**: High-level method that coordinates
  the process

### 2. Sandbox Monitoring

The system uses a Python script inside the sandbox that:

1. Installs Claude Code globally via npm
2. Sets the ANTHROPIC_API_KEY environment variable
3. Runs Claude Code with appropriate parameters
4. Monitors the generated files
5. Runs tests and builds after each iteration
6. Automatically fixes failing tests by re-running Claude Code with error
   feedback
7. Continues until all tests pass and the build succeeds (up to max iterations)

### 3. Iterative Development Process

```python
while iterations < max_iterations:
    # Run Claude Code
    result = subprocess.run(["claude", "--print", prompt])

    # Check if project is ready
    if os.path.exists('package.json'):
        # Install dependencies
        install_result = subprocess.run(["bun", "install"])

        # Run tests
        test_result = subprocess.run(["bun", "test"])

        # Run build
        build_result = subprocess.run(["bun", "run", "build"])

        if test_result.returncode == 0 and build_result.returncode == 0:
            print("PROJECT READY")
            break
        else:
            # Update prompt with error feedback
            prompt = f"Fix the following errors: {test_result.stderr}"
```

## Security Benefits

1. **API Key Isolation**: The ANTHROPIC_API_KEY is only exposed inside the
   sandbox
2. **No Local Execution**: Claude Code never runs on the host machine
3. **Sandboxed File System**: Generated code can't affect the host system
4. **Network Isolation**: The sandbox has controlled network access

## Usage

When a user requests code generation:

1. The action handler creates a form to gather requirements
2. Upon form completion, it calls `CodeGenerationService.generateCode()`
3. The service creates an E2B sandbox
4. Claude Code is installed and run inside the sandbox
5. The system monitors progress and ensures quality
6. Files are extracted and returned to the user

## Configuration

Required environment variables:

- `ANTHROPIC_API_KEY`: For Claude Code API access
- `E2B_API_KEY`: For creating and managing sandboxes

Optional configuration:

- `ANTHROPIC_TIMEOUT`: Timeout for operations (default: 300000ms)
- `ANTHROPIC_MAX_RETRIES`: Maximum retry attempts (default: 3)

## Testing

Tests are designed to work with this sandbox architecture:

1. Unit tests use mock services
2. Integration tests verify the sandbox flow without real API calls
3. E2E tests can run with real APIs when keys are provided

## Future Enhancements

1. **Caching**: Cache Claude Code installation in sandbox templates
2. **Parallel Generation**: Run multiple sandboxes for different parts
3. **Progress Streaming**: Real-time updates from the sandbox
4. **Custom Templates**: Pre-configured E2B templates with common tools
