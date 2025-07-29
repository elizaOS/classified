#!/usr/bin/env node

/**
 * Test Syntax Validator
 * Checks all test files for syntax errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating Test File Syntax');
console.log('================================\n');

const testFiles = [
  'cypress/e2e/00-production-readiness-master.cy.ts',
  'cypress/e2e/00-COMPLETE-TEST-COVERAGE-REPORT.cy.ts',
  'cypress/e2e/00-missing-routes-coverage.cy.ts',
  'cypress/e2e/00-FINAL-PRODUCTION-VALIDATION.cy.ts',
  'cypress/e2e/03-api-keys-edge-cases.cy.ts',
  'cypress/e2e/03-api-keys-complete.cy.ts',
];

const results = {
  valid: [],
  invalid: [],
};

testFiles.forEach((file) => {
  const fullPath = path.join(process.cwd(), file);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`);
    results.invalid.push({ file, error: 'File not found' });
    return;
  }

  try {
    // Read the file
    const content = fs.readFileSync(fullPath, 'utf8');

    // Basic syntax checks
    let hasError = false;
    let errorMessage = '';

    // Check for common syntax errors
    if (content.includes('describe(') && !content.includes(');')) {
      hasError = true;
      errorMessage = 'Missing closing for describe block';
    }

    if (content.includes('it(') && !content.includes(');')) {
      hasError = true;
      errorMessage = 'Missing closing for it block';
    }

    // Count brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      hasError = true;
      errorMessage = `Bracket mismatch: ${openBrackets} open, ${closeBrackets} close`;
    }

    // Count parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      hasError = true;
      errorMessage = `Parenthesis mismatch: ${openParens} open, ${closeParens} close`;
    }

    // Check for TypeScript compilation (if TypeScript is available)
    try {
      execSync(`npx tsc --noEmit --skipLibCheck "${fullPath}"`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });

      if (!hasError) {
        console.log(`✅ ${file} - Valid syntax`);
        results.valid.push(file);
      }
    } catch (tsError) {
      hasError = true;
      errorMessage = 'TypeScript compilation error';
      console.log(`❌ ${file} - ${errorMessage}`);
      console.error(tsError.stdout || tsError.message);
      results.invalid.push({ file, error: errorMessage });
    }

    if (hasError && !results.invalid.find((r) => r.file === file)) {
      console.log(`❌ ${file} - ${errorMessage}`);
      results.invalid.push({ file, error: errorMessage });
    }
  } catch (error) {
    console.log(`❌ ${file} - Error reading file: ${error.message}`);
    results.invalid.push({ file, error: error.message });
  }
});

// Summary
console.log('\n================================');
console.log('📊 VALIDATION SUMMARY');
console.log('================================');
console.log(`✅ Valid files: ${results.valid.length}`);
console.log(`❌ Invalid files: ${results.invalid.length}`);

if (results.invalid.length > 0) {
  console.log('\n❌ Files with issues:');
  results.invalid.forEach((result) => {
    console.log(`   - ${result.file}: ${result.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🎉 All test files have valid syntax!');
  process.exit(0);
}
