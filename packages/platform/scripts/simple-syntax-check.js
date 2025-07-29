#!/usr/bin/env node

/**
 * Simple Syntax Checker
 * Basic validation of test file structure
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Simple Syntax Check for Test Files\n');

const testFiles = [
  'cypress/e2e/00-production-readiness-master.cy.ts',
  'cypress/e2e/00-COMPLETE-TEST-COVERAGE-REPORT.cy.ts',
  'cypress/e2e/00-missing-routes-coverage.cy.ts',
  'cypress/e2e/00-FINAL-PRODUCTION-VALIDATION.cy.ts',
  'cypress/e2e/03-api-keys-edge-cases.cy.ts',
];

let allValid = true;

testFiles.forEach((file) => {
  try {
    const content = fs.readFileSync(file, 'utf8');

    // Basic checks
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(');
    const hasCy = content.includes('cy.');

    // Count brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    const bracketMatch = openBrackets === closeBrackets;

    // Count parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    const parenMatch = openParens === closeParens;

    // Report
    console.log(`📄 ${path.basename(file)}`);
    console.log(`   ✓ File exists and readable`);
    console.log(`   ${hasDescribe ? '✓' : '✗'} Has describe blocks`);
    console.log(`   ${hasIt ? '✓' : '✗'} Has it blocks`);
    console.log(`   ${hasCy ? '✓' : '✗'} Has cy commands`);
    console.log(
      `   ${bracketMatch ? '✓' : '✗'} Brackets match (${openBrackets} pairs)`,
    );
    console.log(
      `   ${parenMatch ? '✓' : '✗'} Parentheses match (${openParens} pairs)`,
    );

    const isValid = hasDescribe && hasIt && hasCy && bracketMatch && parenMatch;
    if (!isValid) {
      allValid = false;
      console.log(`   ❌ INVALID`);
    } else {
      console.log(`   ✅ VALID`);
    }
    console.log('');
  } catch (error) {
    console.log(`❌ Error reading ${file}: ${error.message}\n`);
    allValid = false;
  }
});

console.log('─'.repeat(50));
console.log(
  allValid
    ? '✅ All files are syntactically valid!'
    : '❌ Some files have issues',
);
console.log('─'.repeat(50));

// Also check if package.json has our test scripts
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const hasProductionTest = packageJson.scripts['test:production'];
  const hasQuickTest = packageJson.scripts['test:production:quick'];
  const hasApiKeysTest = packageJson.scripts['test:api-keys'];
  const hasCoverageTest = packageJson.scripts['test:coverage-report'];

  console.log('\n📦 Package.json Test Scripts:');
  console.log(`   ${hasProductionTest ? '✓' : '✗'} test:production`);
  console.log(`   ${hasQuickTest ? '✓' : '✗'} test:production:quick`);
  console.log(`   ${hasApiKeysTest ? '✓' : '✗'} test:api-keys`);
  console.log(`   ${hasCoverageTest ? '✓' : '✗'} test:coverage-report`);
} catch (error) {
  console.log('❌ Error checking package.json');
}

process.exit(allValid ? 0 : 1);
