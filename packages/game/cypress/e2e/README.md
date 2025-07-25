# ELIZA Game Test Structure

This directory contains **clean, organized tests** that replace the previous 110+ chaotic test files.

## Test Categories

### 01-server/ - Server & API Tests

**Required tests** - System is not functional if these fail.

- `startup.cy.ts` - Server starts, containers healthy, basic health checks
- `api-endpoints.cy.ts` - All backend API endpoints work correctly
- `database.cy.ts` - Database operations and data persistence

### 02-agent/ - Agent Runtime Tests

**Required tests** - Core AI functionality.

- `initialization.cy.ts` - Agent starts and is responsive
- `messaging.cy.ts` - Agent can send/receive messages
- `plugins.cy.ts` - Agent plugins are loaded and functional

### 03-frontend/ - Frontend UI Tests

**Optional tests** - UI functionality.

- `ui-components.cy.ts` - All UI elements render correctly
- `user-flows.cy.ts` - Complete user workflows work

### 04-integration/ - Integration Tests

**Optional tests** - Full system workflows.

- `end-to-end.cy.ts` - Complete user journeys from frontend to backend
- `error-handling.cy.ts` - System handles errors gracefully

## Running Tests

```bash
# Run all tests with the clean test runner
npm test

# Or directly
node scripts/working-test-runner.js
```

## Test Results

- **Required tests** must pass for system to be considered functional
- **Optional tests** indicate quality but don't block functionality
- Results are saved to `cypress/reports/test-report.json`

## What Was Removed

We removed **100+ duplicate test files** including:

- `comprehensive-*` files (7 duplicates)
- `complete-*` files (8 duplicates)
- `final-*` files (12 duplicates)
- Multiple test runners doing the same thing

The new structure covers all the same functionality with better organization and no duplication.
