# Rolodex Plugin Tests

This directory contains various types of tests for the Rolodex plugin.

## Test Types

### Unit Tests

- Located in `*.test.ts` files
- Test individual functions and components in isolation
- Use mocks for all dependencies
- Run with: `bun test`

### E2E Tests

- Located in `e2e/` directory
- Test full integration with real ElizaOS runtime
- Use actual database, services, and AI capabilities
- Run with: `npm run test:e2e` or `elizaos test`

## Running Tests

### Unit Tests

```bash
# Run all unit tests
bun test

# Run specific test file
bun test src/__tests__/actions.test.ts
```

### E2E Tests

```bash
# Run all E2E tests (requires ElizaOS CLI)
npm run test:e2e

# Or directly with elizaos
elizaos test
```

## Important Notes

### Database Adapter Requirements

The Rolodex plugin requires the SQL plugin (`@elizaos/plugin-sql`) to provide a
database adapter.

For E2E tests, the ElizaOS test runner automatically handles plugin dependencies
and sets up the required database adapter.

For unit tests that need a runtime, we use a simplified setup without database
persistence. If you need database functionality in tests, use the E2E test
framework instead.

### Environment Variables

Tests require the `SECRET_SALT` environment variable for security. The test
helpers automatically set this for you with a test value.

### Test Structure

- Unit tests use Bun's test runner directly
- E2E tests use the ElizaOS test framework with `TestSuite` and `TestCase`
  interfaces
- E2E tests receive a real `IAgentRuntime` instance with all services
  initialized

## Troubleshooting

### "Database adapter not initialized" Error

If you see this error when running tests directly with `bun test`, it means the
test is trying to use features that require the SQL plugin. Convert the test to
an E2E test and run it with `elizaos test` instead.

### Missing Rolodex Service

Make sure the Rolodex plugin is properly initialized in the test runtime. For
E2E tests, the plugin should be included in the character configuration.
