# Billing System Integration Tests

This directory contains comprehensive integration tests for the billing system, validating real-world scenarios and production readiness.

## Test Structure

### Integration Tests (`/integration/`)

1. **stripe-integration.test.ts**

   - Real Stripe API integration testing
   - Payment intent creation and confirmation
   - Concurrent transaction safety
   - Auto top-up integration
   - Payment method management
   - Error handling and edge cases
   - Performance and load testing

2. **webhook-security.test.ts**

   - Webhook signature validation
   - Deduplication and replay attack protection
   - Concurrent webhook processing
   - Error handling and resilience
   - Performance under load

3. **crypto-payment.test.ts**

   - Real blockchain API integration (Alchemy)
   - Payment monitoring setup
   - Transaction verification
   - Payment processing and status tracking
   - Expired payment cleanup

4. **end-to-end.test.ts**
   - Complete payment flows from initiation to completion
   - Auto top-up end-to-end scenarios
   - Crypto payment complete flows
   - Concurrent operations and race conditions
   - System integration and performance

## Running Tests

### Prerequisites

1. **Environment Variables** - Create `.env.test` file:

   ```bash
   # Database (use test database)
   DATABASE_URL=postgresql://test:test@localhost:5432/platform_test

   # Stripe Test Keys
   STRIPE_TEST_SECRET_KEY=sk_test_your_test_key_here
   STRIPE_TEST_PUBLISHABLE_KEY=pk_test_your_test_key_here
   STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret

   # Alchemy API (for crypto tests)
   ALCHEMY_API_KEY=your_alchemy_api_key_here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

2. **Test Database** - Set up a dedicated test database:
   ```bash
   createdb platform_test
   # Run migrations on test database
   ```

### Test Commands

```bash
# Run all integration tests
npm run test:integration

# Run specific test suites
npm run test:integration:stripe    # Stripe integration tests
npm run test:integration:webhook   # Webhook security tests
npm run test:integration:crypto    # Crypto payment tests
npm run test:integration:e2e       # End-to-end flow tests

# Run with coverage
npm run test:integration:coverage

# Watch mode for development
npm run test:integration:watch

# Debug mode with verbose output
npm run test:debug
```

## Test Categories

### 🔵 Unit Tests

- Individual function and method testing
- Mocked dependencies
- Fast execution
- Located in component directories

### 🟡 Integration Tests

- Real service integration (Stripe, Alchemy, Database)
- Cross-component interaction testing
- Realistic scenarios
- Longer execution time

### 🔴 End-to-End Tests

- Complete user flows
- Real payment processing
- System-wide validation
- Production-like environment

## Key Testing Scenarios

### Payment Processing

- ✅ Payment intent creation and confirmation
- ✅ Credit addition with atomic transactions
- ✅ Duplicate payment prevention
- ✅ Failed payment handling
- ✅ Concurrent payment safety

### Auto Top-up

- ✅ Threshold-based triggering
- ✅ Payment method retrieval
- ✅ Automatic payment processing
- ✅ Duplicate prevention
- ✅ Bulk organization processing

### Webhook Security

- ✅ Signature validation
- ✅ Replay attack prevention
- ✅ Deduplication under load
- ✅ Concurrent processing safety
- ✅ Error handling and resilience

### Crypto Payments

- ✅ Blockchain API integration
- ✅ Transaction verification
- ✅ Payment monitoring and expiration
- ✅ Real-time status tracking
- ✅ Cleanup of expired payments

### System Integration

- ✅ Database transaction isolation
- ✅ Race condition prevention
- ✅ Performance under load
- ✅ Error propagation and handling
- ✅ Resource cleanup

## Performance Benchmarks

The tests include performance validation to ensure production readiness:

- **Payment Processing**: < 5 seconds for 10 concurrent payments
- **Webhook Processing**: < 10 seconds for 50 concurrent webhooks
- **Auto Top-up Check**: < 30 seconds for 10 organizations
- **Database Operations**: Atomic with proper isolation

## Security Validation

### Stripe Security

- ✅ Valid signature verification
- ✅ Invalid signature rejection
- ✅ Metadata validation
- ✅ Amount verification

### Webhook Security

- ✅ Timestamp validation (replay protection)
- ✅ Duplicate event detection
- ✅ Concurrent processing safety
- ✅ Error containment

### Database Security

- ✅ Transaction isolation
- ✅ Row-level locking
- ✅ Constraint enforcement
- ✅ Audit trail maintenance

## Error Scenarios

Tests validate proper handling of:

- Network failures
- API rate limiting
- Database connection issues
- Invalid payment data
- Expired payment methods
- Insufficient funds
- Malformed webhooks
- Concurrent access conflicts

## Test Data Management

### Setup

- Creates isolated test organizations
- Uses Stripe test mode only
- Generates unique identifiers per test run

### Cleanup

- Automatic cleanup after each test
- Stripe resource deletion
- Database record removal
- No test data pollution

### Safety

- Prevents production data access
- Validates test-only API keys
- Isolated test database usage

## Debugging

### Verbose Mode

```bash
VERBOSE_TESTS=true npm run test:integration
```

### Debug Specific Issues

```bash
# Database connection issues
npm run test:debug --testNamePattern="database"

# Stripe API issues
npm run test:debug --testNamePattern="stripe"

# Timing-sensitive tests
npm run test:debug --testTimeout=60000
```

### Common Issues

1. **Database Connection**: Ensure test database is running and accessible
2. **Stripe Keys**: Verify test keys are valid and have required permissions
3. **Network Access**: Some tests require internet access for API calls
4. **Timing**: Integration tests may be sensitive to system load

## Continuous Integration

The tests are designed for CI environments:

- **Deterministic**: Consistent results across runs
- **Isolated**: No external dependencies beyond APIs
- **Fast**: Optimized for CI runtime constraints
- **Comprehensive**: Full coverage of critical paths

### CI Configuration

```yaml
# Example GitHub Actions
- name: Run Integration Tests
  run: npm run test:ci
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
    ALCHEMY_API_KEY: ${{ secrets.ALCHEMY_API_KEY }}
```

## Monitoring and Alerts

Production monitoring should track metrics validated by these tests:

- Payment success rates
- Webhook processing latency
- Auto top-up effectiveness
- Error rates by category
- Database transaction performance

## Contributing

When adding new billing features:

1. Add corresponding integration tests
2. Follow existing test patterns
3. Include error scenarios
4. Validate performance impact
5. Update documentation

### Test Checklist

- [ ] Happy path scenario
- [ ] Error handling
- [ ] Edge cases
- [ ] Performance validation
- [ ] Security considerations
- [ ] Cleanup implementation
