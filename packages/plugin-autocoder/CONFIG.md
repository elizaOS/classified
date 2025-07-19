# Autocoder Plugin Configuration

This document describes all configuration options for the ElizaOS Autocoder
plugin. The plugin uses environment variables for configuration, with sensible
defaults for different environments.

## Quick Start

Create a `.env` file in your project root with the following required variables:

```bash
# Required - E2B API Key for sandbox functionality
E2B_API_KEY=your_e2b_api_key_here

# Optional - AI Provider API Keys (at least one recommended)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## Environment Variables Reference

### Core Service Configuration

#### E2B Sandbox Configuration

- **`E2B_API_KEY`** (required) - API key for E2B sandbox service
- **`E2B_TEMPLATE_ID`** (optional, default: `nextjs-developer`) - E2B template
  to use for sandboxes
- **`E2B_TIMEOUT_MS`** (optional, default: `300000`) - Timeout for E2B
  operations in milliseconds
- **`E2B_MAX_SANDBOXES`** (optional, default: `5`) - Maximum number of
  concurrent sandboxes

#### AI/LLM Configuration

- **`ANTHROPIC_API_KEY`** (optional) - Anthropic API key for Claude models
- **`OPENAI_API_KEY`** (optional) - OpenAI API key for GPT models
- **`AUTOCODER_PREFERRED_MODEL`** (optional, default: `claude`) - Preferred AI
  model: `claude`, `openai`, or `local`
- **`AUTOCODER_MAX_TOKENS`** (optional, default: `8000`) - Maximum tokens for AI
  responses
- **`AUTOCODER_TEMPERATURE`** (optional, default: `0.3`) - Temperature for AI
  generation (0.0-1.0)

### Blockchain Configuration

#### Ethereum

- **`ETHEREUM_RPC_URL`** (optional, default: `https://rpc.sepolia.org`) -
  Ethereum RPC endpoint
- **`ETHEREUM_PRIVATE_KEY`** (optional) - Private key for Ethereum transactions
- **`ETHEREUM_NETWORK_ID`** (optional, default: `11155111`) - Ethereum network
  ID (Sepolia)
- **`ETHEREUM_GAS_LIMIT`** (optional, default: `8000000`) - Gas limit for
  transactions
- **`ETHEREUM_GAS_PRICE`** (optional, default: `20000000000`) - Gas price in wei

#### Solana

- **`SOLANA_RPC_URL`** (optional, default: `https://api.devnet.solana.com`) -
  Solana RPC endpoint
- **`SOLANA_KEYPAIR_PATH`** (optional) - Path to Solana keypair file
- **`SOLANA_COMMITMENT`** (optional, default: `confirmed`) - Commitment level:
  `processed`, `confirmed`, `finalized`
- **`SOLANA_CLUSTER`** (optional, default: `devnet`) - Solana cluster: `devnet`,
  `testnet`, `mainnet`

#### Base

- **`BASE_RPC_URL`** (optional, default: `https://sepolia.base.org`) - Base RPC
  endpoint
- **`BASE_PRIVATE_KEY`** (optional) - Private key for Base transactions
- **`BASE_NETWORK_ID`** (optional, default: `84532`) - Base network ID (Sepolia)

#### Arbitrum

- **`ARBITRUM_RPC_URL`** (optional, default:
  `https://sepolia-rollup.arbitrum.io/rpc`) - Arbitrum RPC endpoint
- **`ARBITRUM_PRIVATE_KEY`** (optional) - Private key for Arbitrum transactions
- **`ARBITRUM_NETWORK_ID`** (optional, default: `421614`) - Arbitrum network ID
  (Sepolia)

#### Polygon

- **`POLYGON_RPC_URL`** (optional, default:
  `https://rpc-amoy.polygon.technology`) - Polygon RPC endpoint
- **`POLYGON_PRIVATE_KEY`** (optional) - Private key for Polygon transactions
- **`POLYGON_NETWORK_ID`** (optional, default: `80002`) - Polygon network ID
  (Amoy)

### Contract Configuration

- **`AUTOCODER_DEFAULT_NETWORK`** (optional, default: `sepolia`) - Default
  network for deployments
- **`AUTOCODER_ENABLE_VERIFICATION`** (optional, default:
  environment-dependent) - Enable contract verification
- **`AUTOCODER_OPTIMIZATION_RUNS`** (optional, default: environment-dependent) -
  Solidity optimization runs
- **`AUTOCODER_COMPILER_VERSION`** (optional, default: `latest`) - Solidity
  compiler version
- **`AUTOCODER_CONTRACT_TIMEOUT_MS`** (optional, default:
  environment-dependent) - Contract operation timeout

### Plugin Creation Configuration

- **`AUTOCODER_MAX_CONCURRENT_JOBS`** (optional, default: `5`) - Maximum
  concurrent plugin creation jobs
- **`AUTOCODER_JOB_TIMEOUT_MS`** (optional, default: `1800000`) - Job timeout in
  milliseconds (30 minutes)
- **`AUTOCODER_MAX_OUTPUT_SIZE`** (optional, default: `1048576`) - Maximum
  output size in bytes (1MB)
- **`AUTOCODER_RATE_LIMIT_WINDOW_MS`** (optional, default: `3600000`) - Rate
  limit window (1 hour)
- **`AUTOCODER_MAX_JOBS_PER_WINDOW`** (optional, default: `10`) - Maximum jobs
  per rate limit window
- **`AUTOCODER_PLUGIN_MODEL`** (optional, default:
  `claude-3-5-sonnet-20241022`) - Model for plugin creation
- **`AUTOCODER_ENABLE_TEMPLATES_FALLBACK`** (optional, default: `true`) - Enable
  template fallback if AI fails

### Benchmark Configuration

- **`AUTOCODER_BENCHMARKS_ENABLED`** (optional, default: `true`) - Enable
  benchmark functionality
- **`AUTOCODER_BENCHMARK_ITERATIONS`** (optional, default: `5`) - Performance
  benchmark iterations
- **`AUTOCODER_BENCHMARK_TIMEOUT`** (optional, default: `600000`) - Benchmark
  timeout (10 minutes)
- **`AUTOCODER_BENCHMARK_MAX_MEMORY`** (optional, default: `2147483648`) - Max
  memory for benchmarks (2GB)
- **`AUTOCODER_ENABLE_SYSTEM_METRICS`** (optional, default: `true`) - Enable
  system metrics collection

### Security Configuration

- **`AUTOCODER_ENABLE_SANDBOX_ISOLATION`** (optional, default:
  environment-dependent) - Enable sandbox isolation
- **`AUTOCODER_ALLOWED_FILE_EXTENSIONS`** (optional, default:
  environment-dependent) - Comma-separated allowed file extensions
- **`AUTOCODER_MAX_FILE_SIZE`** (optional, default: environment-dependent) -
  Maximum file size in bytes
- **`AUTOCODER_SANITIZE_OUTPUT`** (optional, default: environment-dependent) -
  Sanitize output for security

### Development Configuration

- **`AUTOCODER_DEBUG_LOGGING`** (optional, default: environment-dependent) -
  Enable debug logging
- **`AUTOCODER_PRESERVE_ARTIFACTS`** (optional, default:
  environment-dependent) - Preserve generated artifacts
- **`AUTOCODER_ENABLE_MOCK_SERVICES`** (optional, default:
  environment-dependent) - Enable mock services for testing
- **`AUTOCODER_ARTIFACTS_PATH`** (optional, default: environment-dependent) -
  Path to store artifacts

## Environment-Specific Defaults

### Production Environment (`NODE_ENV=production`)

```bash
# Security-focused defaults
AUTOCODER_ENABLE_VERIFICATION=true
AUTOCODER_OPTIMIZATION_RUNS=200
AUTOCODER_ENABLE_SANDBOX_ISOLATION=true
AUTOCODER_SANITIZE_OUTPUT=true
AUTOCODER_DEBUG_LOGGING=false
AUTOCODER_PRESERVE_ARTIFACTS=false
AUTOCODER_ENABLE_MOCK_SERVICES=false
```

### Development Environment (`NODE_ENV=development`)

```bash
# Developer-friendly defaults
AUTOCODER_ENABLE_VERIFICATION=false
AUTOCODER_OPTIMIZATION_RUNS=0
AUTOCODER_ENABLE_SANDBOX_ISOLATION=true
AUTOCODER_SANITIZE_OUTPUT=false
AUTOCODER_DEBUG_LOGGING=true
AUTOCODER_PRESERVE_ARTIFACTS=true
AUTOCODER_ENABLE_MOCK_SERVICES=false
```

### Test Environment (`NODE_ENV=test`)

```bash
# Testing-optimized defaults
AUTOCODER_DEFAULT_NETWORK=devnet
AUTOCODER_ENABLE_VERIFICATION=false
AUTOCODER_OPTIMIZATION_RUNS=0
AUTOCODER_ENABLE_SANDBOX_ISOLATION=false
AUTOCODER_DEBUG_LOGGING=true
AUTOCODER_PRESERVE_ARTIFACTS=true
AUTOCODER_ENABLE_MOCK_SERVICES=true
```

## Configuration Validation

The plugin validates configuration on startup and will:

1. **Fail** if required values are missing
2. **Warn** for missing optional values that may limit functionality
3. **Validate** private key formats for different blockchains
4. **Check** reasonable limits for timeouts and file sizes

## Usage Examples

### Basic Setup for Contract Generation

```bash
E2B_API_KEY=your_e2b_key
ANTHROPIC_API_KEY=your_anthropic_key
ETHEREUM_PRIVATE_KEY=0x1234...
```

### Development with Debug Logging

```bash
NODE_ENV=development
E2B_API_KEY=your_e2b_key
AUTOCODER_DEBUG_LOGGING=true
AUTOCODER_PRESERVE_ARTIFACTS=true
```

### Production with Enhanced Security

```bash
NODE_ENV=production
E2B_API_KEY=your_e2b_key
ANTHROPIC_API_KEY=your_anthropic_key
AUTOCODER_ENABLE_VERIFICATION=true
AUTOCODER_SANITIZE_OUTPUT=true
AUTOCODER_MAX_FILE_SIZE=1048576
```

### Multi-Blockchain Setup

```bash
# Ethereum
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
ETHEREUM_PRIVATE_KEY=0x1234...

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_KEYPAIR_PATH=/path/to/keypair.json

# Base
BASE_RPC_URL=https://mainnet.base.org
BASE_PRIVATE_KEY=0x5678...
```

## Security Considerations

1. **Never commit private keys** to version control
2. **Use environment variables** or secure key management for production
3. **Limit file extensions** and sizes in production environments
4. **Enable sandbox isolation** in production
5. **Use separate keys** for different environments
6. **Monitor API key usage** to prevent abuse

## Troubleshooting

### Common Issues

1. **"E2B_API_KEY is required"**

   - Ensure E2B_API_KEY is set in your environment
   - Check that the API key is valid and has proper permissions

2. **"No AI API keys configured"**

   - This is a warning - plugin creation will use templates only
   - Add ANTHROPIC_API_KEY or OPENAI_API_KEY for AI-powered generation

3. **"Invalid private key format"**

   - Ensure private keys are in the correct format for each blockchain
   - Ethereum/EVM: 64 hex characters (with or without 0x prefix)
   - Solana: Base58 or Base64 encoded

4. **"Configuration validation failed"**
   - Check all required environment variables are set
   - Verify RPC URLs are accessible
   - Ensure timeout values are reasonable

### Debugging Configuration

Enable debug logging to see the current configuration:

```bash
AUTOCODER_DEBUG_LOGGING=true
```

This will log the configuration summary on startup (without sensitive values).

## Migration from Previous Versions

If upgrading from a previous version:

1. **Review new environment variables** in this document
2. **Update your .env file** with new variable names if changed
3. **Test in development** before deploying to production
4. **Check deprecated warnings** in the logs

## Support

For configuration issues:

1. Check the logs for validation errors
2. Verify environment variables are correctly set
3. Test with minimal configuration first
4. Refer to the ElizaOS documentation for core setup
