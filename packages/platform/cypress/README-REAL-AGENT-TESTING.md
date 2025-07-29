# Real Agent Autocoder E2E Testing

This directory contains comprehensive E2E tests for the ElizaOS Autocoder that use **real agent runtime, real API keys, and real code generation** instead of mocks.

## Requirements Met

✅ **Real agent runtime** - Uses actual `IAgentRuntime` with `AutocoderAgentService`  
✅ **Real API keys** - Requires and uses actual OpenAI, Anthropic API keys  
✅ **Real code generation** - Actual code compilation and execution  
✅ **Real projects** - Creates real GitHub repositories and deployments  
✅ **Comprehensive data recording** - Metrics collection and validation  
✅ **100% success rate requirement** - All scenarios must pass without cheating  
✅ **No mocks, no LARP** - Zero fake implementations

## Test Files

### Primary Real Tests (NO MOCKS)

- `REAL-AGENT-AUTOCODER-E2E.cy.ts` - Comprehensive real agent scenarios
- `REAL-NO-MOCKS-AUTOCODER.cy.ts` - Focused real agent validation

### Legacy Mock Tests (for comparison)

- `13-autocoder-functionality.cy.ts` - Uses mocks (does NOT meet requirements)
- `15-autocoder-end-to-end-workflow.cy.ts` - Uses mocks (does NOT meet requirements)

## Environment Setup

### Required Environment Variables

```bash
# Core API Keys (REQUIRED for real tests)
export OPENAI_API_KEY="sk-your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# GitHub Integration (REQUIRED for deployment tests)
export GITHUB_TOKEN="your-github-token"

# Database (REQUIRED for real data persistence)
export DATABASE_URL="postgresql://user:pass@localhost:5432/elizaos_test"

# Optional: Skip real tests if environment not available
export SKIP_REAL_TESTS="false"
```

### Agent Server Setup

```bash
# Start ElizaOS agent server for real runtime
cd packages/server
npm run dev

# Or use local runtime fallback (tests will adapt automatically)
```

## Running Real Tests

### Run All Real Tests

```bash
npm run test:e2e:real
```

### Run Specific Real Test Suite

```bash
npx cypress run --spec "cypress/e2e/REAL-*.cy.ts"
```

### Run with GUI for Debugging

```bash
npx cypress open
# Then select the REAL-*.cy.ts files
```

### Run Legacy Mock Tests (for comparison)

```bash
npx cypress run --spec "cypress/e2e/13-autocoder-functionality.cy.ts"
```

## Test Scenarios

### Scenario 1: Simple Plugin Creation

- **Input**: Weather plugin description
- **Real Agent**: Analyzes request, creates architecture
- **Real Code Gen**: Generates TypeScript plugin with OpenWeatherMap integration
- **Real Tests**: Runs actual Jest tests on generated code
- **Validation**: 100% test pass rate, 85%+ quality score

### Scenario 2: Complex DeFi Application

- **Input**: Multi-protocol yield farming platform description
- **Real Agent**: Advanced analysis with risk assessment
- **Real Code Gen**: Full-stack DeFi app with smart contracts
- **Real Tests**: Unit, integration, and fork tests
- **Validation**: 90%+ quality score, 500+ lines of code

### Scenario 3: Powell Hedging Strategy

- **Input**: Sophisticated trading algorithm description
- **Real Agent**: Financial analysis with compliance checks
- **Real Code Gen**: Production-ready trading system
- **Real Tests**: Backtesting with historical data
- **Validation**: Enterprise-grade quality metrics

### Scenario 4: Full-Stack Application

- **Input**: Social trading platform description
- **Real Agent**: Architecture design with database schema
- **Real Code Gen**: React frontend + Node.js backend
- **Real Tests**: E2E tests with real database
- **Validation**: Complete application stack

### Scenario 5: Concurrent Sessions Stress Test

- **Input**: Multiple projects simultaneously
- **Real Agent**: Resource management and optimization
- **Real Code Gen**: Parallel processing validation
- **Real Tests**: Performance and reliability metrics
- **Validation**: All projects complete successfully

## Data Recording and Metrics

### Collected Metrics

```typescript
interface TestMetrics {
  scenarioId: string;
  startTime: number;
  endTime: number;
  duration: number;
  agentResponseTime: number;
  codeGenerationTime: number;
  testExecutionTime: number;
  buildTime: number;
  success: boolean;
  errorDetails?: string;
  apiCallCount: number;
  tokensUsed: number;
  linesGenerated: number;
  testsGenerated: number;
  testsPass: number;
  testsFail: number;
  qualityScore: number;
}
```

### Validation Requirements

- **Success Rate**: Must be 100% (no failures allowed)
- **Quality Score**: Minimum 85% for simple, 90% for complex, 95% for enterprise
- **Test Pass Rate**: 100% (all generated tests must pass)
- **Performance**: Maximum 30 minutes per scenario
- **Real Environment**: Agent runtime, API keys, and deployment validation

## Validation Process

### 1. Environment Validation

- Verifies real API keys are present and valid
- Confirms agent runtime is accessible
- Validates database connectivity

### 2. Agent Runtime Validation

- Confirms `AutocoderAgentService` is initialized
- Verifies connection to agent server or local runtime
- Validates no mocks are used in the agent chain

### 3. Code Generation Validation

- Ensures actual code is generated and compiled
- Validates generated code follows best practices
- Confirms all tests pass without modification

### 4. Quality Assurance Validation

- Runs real security analysis
- Performs actual performance benchmarking
- Validates documentation completeness

### 5. Deployment Validation

- Creates real GitHub repositories
- Deploys to actual hosting environments
- Validates production readiness

## Troubleshooting

### Missing API Keys

```
Error: Required environment variable OPENAI_API_KEY not set
Solution: Set real API keys or use SKIP_REAL_TESTS=true
```

### Agent Runtime Connection Failed

```
Error: Real agent initialization failed
Solution: Start agent server or check network connectivity
```

### Test Failures

```
Error: Success rate 85% must be 100%
Solution: Review failed scenarios and improve agent performance
```

### Performance Issues

```
Error: Duration 35 minutes exceeds maximum 30 minutes
Solution: Optimize agent runtime or increase timeout limits
```

## Comparison: Real vs Mock Tests

| Aspect           | Real Tests                 | Mock Tests              |
| ---------------- | -------------------------- | ----------------------- |
| Agent Runtime    | ✅ Real IAgentRuntime      | ❌ cy.intercept() mocks |
| API Keys         | ✅ Actual OpenAI/Anthropic | ❌ Fake responses       |
| Code Generation  | ✅ Real compilation        | ❌ Static mock code     |
| Test Execution   | ✅ Actual Jest/testing     | ❌ Mocked test results  |
| Quality Analysis | ✅ Real metrics            | ❌ Hardcoded scores     |
| Deployment       | ✅ Real GitHub/hosting     | ❌ Mock deployment      |
| Validation       | ✅ Comprehensive           | ❌ UI interactions only |
| Requirements Met | ✅ 100%                    | ❌ 0%                   |

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Real Agent E2E Tests
on: [push, pull_request]
jobs:
  real-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run real E2E tests
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run test:e2e:real
```

## Performance Benchmarks

### Target Performance (100% Success Rate Required)

- Simple Plugin: < 5 minutes, 85%+ quality
- Complex DeFi App: < 15 minutes, 90%+ quality
- Enterprise Trading: < 30 minutes, 95%+ quality
- Full-Stack App: < 20 minutes, 85%+ quality
- Stress Test: < 45 minutes, all scenarios pass

### Actual Performance Tracking

Results are recorded in test metrics and available via:

```bash
npx cypress run --spec "cypress/e2e/REAL-*.cy.ts" --reporter json
```

## Contributing

When adding new real agent tests:

1. **No Mocks**: Never use `cy.intercept()` or mocked responses
2. **Real Environment**: Always validate real API keys and agent runtime
3. **100% Success**: All tests must pass for the suite to be valid
4. **Comprehensive Metrics**: Record detailed performance and quality data
5. **Documentation**: Update this README with new scenarios

## Support

For questions about real agent testing:

- Review existing real test files for examples
- Check environment setup and API key configuration
- Validate agent runtime connectivity
- Ensure all quality and performance requirements are met
